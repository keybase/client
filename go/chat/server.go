package chat

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"regexp"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"golang.org/x/net/context"
)

type ServerConnection interface {
	Reconnect(context.Context) (bool, error)
	GetClient() chat1.RemoteInterface
}

type UISource interface {
	GetChatUI(sessionID int) libkb.ChatUI
	GetStreamUICli() *keybase1.StreamUiClient
}

type Server struct {
	globals.Contextified
	utils.DebugLabeler

	serverConn     ServerConnection
	uiSource       UISource
	boxer          *Boxer
	identNotifier  types.IdentifyNotifier
	uiThreadLoader *UIThreadLoader

	searchMu            sync.Mutex
	searchInboxMu       sync.Mutex
	loadGalleryMu       sync.Mutex
	searchCancelFn      context.CancelFunc
	searchInboxCancelFn context.CancelFunc
	loadGalleryCancelFn context.CancelFunc

	// Only for testing
	rc         chat1.RemoteInterface
	mockChatUI libkb.ChatUI
}

var _ chat1.LocalInterface = (*Server)(nil)

func NewServer(g *globals.Context, serverConn ServerConnection, uiSource UISource) *Server {
	return &Server{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   utils.NewDebugLabeler(g.GetLog(), "Server", false),
		serverConn:     serverConn,
		uiSource:       uiSource,
		boxer:          NewBoxer(g),
		identNotifier:  NewCachingIdentifyNotifier(g),
		uiThreadLoader: NewUIThreadLoader(g),
	}
}

func (h *Server) getChatUI(sessionID int) libkb.ChatUI {
	if h.mockChatUI != nil {
		return h.mockChatUI
	}
	return h.uiSource.GetChatUI(sessionID)
}

func (h *Server) getStreamUICli() *keybase1.StreamUiClient {
	return h.uiSource.GetStreamUICli()
}

func (h *Server) shouldSquashError(err error) bool {
	// these are not offline errors, but we never want the JS to receive them and potentially
	// display a black bar
	switch terr := err.(type) {
	case storage.AbortedError:
		return true
	case TransientUnboxingError:
		return h.shouldSquashError(terr.Inner())
	}
	switch err {
	case utils.ErrConvLockTabDeadlock, context.Canceled:
		return true
	}
	return false
}

func (h *Server) squashSquashableErrors(err error) error {
	if h.shouldSquashError(err) {
		return nil
	}
	return err
}

func (h *Server) handleOfflineError(ctx context.Context, err error,
	res chat1.OfflinableResult) error {
	if err == nil {
		return nil
	}
	if h.shouldSquashError(err) {
		return nil
	}

	errKind := IsOfflineError(err)
	h.Debug(ctx, "handleOfflineError: errType: %T", err)
	if errKind != OfflineErrorKindOnline {
		h.Debug(ctx, "handleOfflineError: setting offline: err: %s", err)
		res.SetOffline()
		switch errKind {
		case OfflineErrorKindOfflineReconnect:
			// Reconnect Gregor if we think we are offline (and told to reconnect)
			h.Debug(ctx, "handleOfflineError: reconnecting to gregor")
			if _, err := h.serverConn.Reconnect(ctx); err != nil {
				h.Debug(ctx, "handleOfflineError: error reconnecting: %s", err)
			} else {
				h.Debug(ctx, "handleOfflineError: success reconnecting")
			}
		}
		return nil
	}
	return err
}

func (h *Server) setResultRateLimit(ctx context.Context, res types.RateLimitedResult) {
	res.SetRateLimits(globals.CtxRateLimits(ctx))
}

func (h *Server) presentUnverifiedInbox(ctx context.Context, convs []types.RemoteConversation,
	p *chat1.Pagination, offline bool) (res chat1.UnverifiedInboxUIItems, err error) {
	for _, rawConv := range convs {
		if len(rawConv.Conv.MaxMsgSummaries) == 0 {
			h.Debug(ctx, "presentUnverifiedInbox: invalid convo, no max msg summaries, skipping: %s",
				rawConv.Conv.GetConvID())
			continue
		}
		res.Items = append(res.Items, utils.PresentRemoteConversation(ctx, h.G(), rawConv))
	}
	res.Pagination = utils.PresentPagination(p)
	res.Offline = offline
	return res, err
}

func (h *Server) suspendBgConvLoads(ctx context.Context) func() {
	return utils.SuspendComponents(ctx, h.G(), []types.Suspendable{
		h.G().ConvLoader,
		h.G().Indexer,
	})
}

func (h *Server) suspendInboxSource(ctx context.Context) func() {
	return utils.SuspendComponent(ctx, h.G(), h.G().InboxSource)
}

func (h *Server) GetInboxNonblockLocal(ctx context.Context, arg chat1.GetInboxNonblockLocalArg) (res chat1.NonblockFetchRes, err error) {
	var breaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &breaks, h.identNotifier)
	ctx = globals.CtxAddLocalizerCancelable(ctx)
	defer h.Trace(ctx, func() error { return err }, "GetInboxNonblockLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetInboxNonblockLocal: result obtained offline")
		}
	}()
	defer h.suspendBgConvLoads(ctx)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Retry helpers
	retryInboxLoad := func() {
		h.G().FetchRetrier.Failure(ctx, uid, NewFullInboxRetry(h.G(), arg.Query, arg.Pagination))
	}
	retryConvLoad := func(convID chat1.ConversationID, tlfID *chat1.TLFID) {
		h.G().FetchRetrier.Failure(ctx, uid, NewConversationRetry(h.G(), convID, tlfID, InboxLoad))
	}
	defer func() {
		// handle errors on the main processing thread, any errors during localizaton are handled
		// in the goroutine for localization callbacks
		if err != nil {
			if arg.Query != nil && len(arg.Query.ConvIDs) > 0 {
				h.Debug(ctx, "GetInboxNonblockLocal: failed to load convID query, retrying all convs")
				for _, convID := range arg.Query.ConvIDs {
					retryConvLoad(convID, nil)
				}
			} else {
				h.Debug(ctx, "GetInboxNonblockLocal: failed to load general query, retrying")
				retryInboxLoad()
			}
		}
	}()

	// Create localized conversation callback channel
	chatUI := h.getChatUI(arg.SessionID)

	// Invoke nonblocking inbox read and get remote inbox version to send back
	// as our result
	_, localizeCb, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerNonblocking,
		types.InboxSourceDataSourceAll, arg.MaxUnbox, arg.Query, arg.Pagination)
	if err != nil {
		return res, err
	}

	// Wait for inbox to get sent to us
	var lres types.AsyncInboxResult
	if arg.SkipUnverified {
		select {
		case lres = <-localizeCb:
			h.Debug(ctx, "GetInboxNonblockLocal: received unverified inbox, skipping send")
		case <-time.After(time.Minute):
			return res, fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
			h.Debug(ctx, "GetInboxNonblockLocal: context canceled waiting for unverified (skip): %s")
			return res, ctx.Err()
		}
	} else {
		select {
		case lres = <-localizeCb:
			if lres.InboxRes == nil {
				return res, fmt.Errorf("invalid conversation localize callback received")
			}
			uires, err := h.presentUnverifiedInbox(ctx, lres.InboxRes.ConvsUnverified,
				lres.InboxRes.Pagination, h.G().InboxSource.IsOffline(ctx))
			if err != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: failed to present untrusted inbox, failing: %s", err.Error())
				return res, err
			}
			jbody, err := json.Marshal(uires)
			if err != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: failed to JSON up unverified inbox: %s", err.Error())
				return res, err
			}
			start := time.Now()
			h.Debug(ctx, "GetInboxNonblockLocal: sending unverified inbox: num convs: %d bytes: %d",
				len(lres.InboxRes.ConvsUnverified), len(jbody))
			if err := chatUI.ChatInboxUnverified(ctx, chat1.ChatInboxUnverifiedArg{
				SessionID: arg.SessionID,
				Inbox:     string(jbody),
			}); err != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: failed to send unverfified inbox: %s", err)
				return res, err
			}
			h.Debug(ctx, "GetInboxNonblockLocal: sent unverified inbox successfully: %v",
				time.Since(start))
		case <-time.After(time.Minute):
			return res, fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
			h.Debug(ctx, "GetInboxNonblockLocal: context canceled waiting for unverified")
			return res, ctx.Err()
		}
	}

	// Consume localize callbacks and send out to UI.
	var wg sync.WaitGroup
	convLocalsCh := make(chan chat1.ConversationLocal, len(lres.InboxRes.ConvsUnverified))
	for convRes := range localizeCb {
		wg.Add(1)
		go func(convRes types.AsyncInboxResult) {
			if convRes.ConvLocal.Error != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: *** error conv: id: %s err: %s",
					convRes.Conv.GetConvID(), convRes.ConvLocal.Error.Message)
				if err := chatUI.ChatInboxFailed(ctx, chat1.ChatInboxFailedArg{
					SessionID: arg.SessionID,
					ConvID:    convRes.Conv.GetConvID(),
					Error:     utils.PresentConversationErrorLocal(ctx, h.G(), *convRes.ConvLocal.Error),
				}); err != nil {
					h.Debug(ctx, "GetInboxNonblockLocal: failed to send failed conv: %s", err)
				}
				// If we get a transient failure, add this to the retrier queue
				if convRes.ConvLocal.Error.Typ == chat1.ConversationErrorType_TRANSIENT {
					retryConvLoad(convRes.Conv.GetConvID(), &convRes.Conv.Conv.Metadata.IdTriple.Tlfid)
				}
			} else {
				pconv := utils.PresentConversationLocal(ctx, convRes.ConvLocal,
					h.G().Env.GetUsername().String())
				jbody, err := json.Marshal(pconv)
				isSuccess := true
				if err != nil {
					h.Debug(ctx, "GetInboxNonblockLocal: failed to JSON conversation, skipping: %s", err)
					isSuccess = false
				} else {
					h.Debug(ctx, "GetInboxNonblockLocal: sending verified conv: id: %s tlf: %s bytes: %d",
						convRes.Conv.GetConvID(), convRes.ConvLocal.Info.TLFNameExpanded(), len(jbody))
					start := time.Now()
					if err := chatUI.ChatInboxConversation(ctx, chat1.ChatInboxConversationArg{
						SessionID: arg.SessionID,
						Conv:      string(jbody),
					}); err != nil {
						h.Debug(ctx, "GetInboxNonblockLocal: failed to send verified conv: %s", err)
						isSuccess = false
					}
					h.Debug(ctx, "GetInboxNonblockLocal: sent verified conv successfully: id: %s time: %v",
						convRes.Conv.GetConvID(), time.Now().Sub(start))
				}
				// Send a note to the retrier that we actually loaded this guy successfully
				if isSuccess {
					h.G().FetchRetrier.Success(ctx, uid,
						NewConversationRetry(h.G(), convRes.Conv.GetConvID(),
							&convRes.Conv.Conv.Metadata.IdTriple.Tlfid, InboxLoad))
				} else {
					h.Debug(ctx, "GetInboxNonblockLocal: failed to transmit conv, retrying")
					retryConvLoad(convRes.Conv.GetConvID(), &convRes.Conv.Conv.Metadata.IdTriple.Tlfid)
				}
				convLocalsCh <- convRes.ConvLocal
			}
			wg.Done()
		}(convRes)
	}

	// Write metadata to the inbox cache
	var convLocals []chat1.ConversationLocal
	go func() {
		wg.Wait()
		close(convLocalsCh)
	}()
	for convLocal := range convLocalsCh {
		convLocals = append(convLocals, convLocal)
	}
	if err = storage.NewInbox(h.G()).MergeLocalMetadata(ctx, uid, convLocals); err != nil {
		// Don't abort the operation on this kind of error
		h.Debug(ctx, "GetInboxNonblockLocal: unable to write inbox local metadata: %s", err)
	}

	res.Offline = h.G().InboxSource.IsOffline(ctx)
	res.IdentifyFailures = breaks
	return res, nil
}

func (h *Server) MarkAsReadLocal(ctx context.Context, arg chat1.MarkAsReadLocalArg) (res chat1.MarkAsReadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("MarkAsReadLocal(%s, %v)", arg.ConversationID, arg.MsgID))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.MarkAsReadLocalRes{}, err
	}
	// Don't send remote mark as read if we somehow get this in the background.
	if h.G().MobileAppState.State() != keybase1.MobileAppState_FOREGROUND {
		h.Debug(ctx, "MarkAsReadLocal: not marking as read, app state not foreground: %v",
			h.G().MobileAppState.State())
		return chat1.MarkAsReadLocalRes{
			Offline: h.G().InboxSource.IsOffline(ctx),
		}, nil
	}
	if err = h.G().InboxSource.MarkAsRead(ctx, arg.ConversationID, uid, arg.MsgID); err != nil {
		return res, err
	}
	return chat1.MarkAsReadLocalRes{
		Offline: h.G().InboxSource.IsOffline(ctx),
	}, nil
}

// GetInboxAndUnboxLocal implements keybase.chatLocal.getInboxAndUnboxLocal protocol.
func (h *Server) GetInboxAndUnboxLocal(ctx context.Context, arg chat1.GetInboxAndUnboxLocalArg) (res chat1.GetInboxAndUnboxLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	if arg.Query != nil && arg.Query.TopicType != nil && *arg.Query.TopicType != chat1.TopicType_CHAT {
		// make this cancelable for things like KBFS file edit convs
		ctx = globals.CtxAddLocalizerCancelable(ctx)
	}
	defer h.Trace(ctx, func() error { return err }, "GetInboxAndUnboxLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Read inbox from the source
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, arg.Query, arg.Pagination)
	if err != nil {
		if _, ok := err.(UnknownTLFNameError); ok {
			h.Debug(ctx, "GetInboxAndUnboxLocal: got unknown TLF name error, returning blank results")
			ib.Convs = nil
			ib.Pagination = nil
		} else {
			return res, err
		}
	}

	return chat1.GetInboxAndUnboxLocalRes{
		Conversations:    ib.Convs,
		Pagination:       ib.Pagination,
		Offline:          h.G().InboxSource.IsOffline(ctx),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetInboxAndUnboxUILocal(ctx context.Context, arg chat1.GetInboxAndUnboxUILocalArg) (res chat1.GetInboxAndUnboxUILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetInboxAndUnboxUILocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	// Read inbox from the source
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, arg.Query, arg.Pagination)
	if err != nil {
		if _, ok := err.(UnknownTLFNameError); ok {
			h.Debug(ctx, "GetInboxAndUnboxUILocal: got unknown TLF name error, returning blank results")
			ib.Convs = nil
			ib.Pagination = nil
		} else {
			return res, err
		}
	}
	return chat1.GetInboxAndUnboxUILocalRes{
		Conversations:    utils.PresentConversationLocals(ctx, ib.Convs, h.G().Env.GetUsername().String()),
		Pagination:       ib.Pagination,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetCachedThread(ctx context.Context, arg chat1.GetCachedThreadArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetCachedThread")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Get messages from local disk only
	thread, err := h.G().ConvSource.PullLocalOnly(ctx, arg.ConversationID, uid,
		arg.Query, arg.Pagination, 0)
	if err != nil {
		return res, err
	}

	return chat1.GetThreadLocalRes{
		Thread:           thread,
		IdentifyFailures: identBreaks,
	}, nil
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *Server) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetThreadLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}
	thread, err := h.uiThreadLoader.Load(ctx, uid, arg.ConversationID, arg.Reason, arg.Query,
		arg.Pagination)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}
	return chat1.GetThreadLocalRes{
		Thread:           thread,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetUnreadline(ctx context.Context, arg chat1.GetUnreadlineArg) (res chat1.UnreadlineRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("GetUnreadline: convID: %v, readMsgID: %v", arg.ConvID, arg.ReadMsgID))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()

	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	res.UnreadlineID, err = h.G().ConvSource.GetUnreadline(ctx, arg.ConvID, uid, arg.ReadMsgID)
	if err != nil {
		h.Debug(ctx, "GetUnreadline: unable to run UnreadMsgID: %v", err)
		return res, err
	}
	return res, nil
}

func (h *Server) GetThreadNonblock(ctx context.Context, arg chat1.GetThreadNonblockArg) (res chat1.NonblockFetchRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("GetThreadNonblock(%s,%v,%v)", arg.ConversationID, arg.CbMode, arg.Reason))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer h.suspendBgConvLoads(ctx)()
	defer h.suspendInboxSource(ctx)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.NonblockFetchRes{}, err
	}
	chatUI := h.getChatUI(arg.SessionID)
	return res, h.uiThreadLoader.LoadNonblock(ctx, chatUI, uid, arg.ConversationID, arg.Reason,
		arg.Pgmode, arg.CbMode, arg.Query, arg.Pagination)
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
// Create a new conversation. Or in the case of CHAT, create-or-get a conversation.
func (h *Server) NewConversationLocal(ctx context.Context, arg chat1.NewConversationLocalArg) (res chat1.NewConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("NewConversationLocal(%s|%v)", arg.TlfName, arg.MembersType))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	conv, err := NewConversation(ctx, h.G(), uid, arg.TlfName, arg.TopicName,
		arg.TopicType, arg.MembersType, arg.TlfVisibility, h.remoteClient, NewConvFindExistingNormal)
	if err != nil {
		return res, err
	}

	res.Conv = conv
	res.UiConv = utils.PresentConversationLocal(ctx, conv, h.G().GetEnv().GetUsername().String())
	res.IdentifyFailures = identBreaks
	return res, nil
}

func (h *Server) GetInboxSummaryForCLILocal(ctx context.Context, arg chat1.GetInboxSummaryForCLILocalQuery) (res chat1.GetInboxSummaryForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetInboxSummaryForCLILocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return chat1.GetInboxSummaryForCLILocalRes{}, err
	}

	var after time.Time
	if len(arg.After) > 0 {
		after, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.After)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", arg.After, err)
		}
	}
	var before time.Time
	if len(arg.Before) > 0 {
		before, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.Before)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", arg.Before, err)
		}
	}

	var queryBase chat1.GetInboxLocalQuery
	queryBase.ComputeActiveList = true
	queryBase.OneChatTypePerTLF = new(bool)
	*queryBase.OneChatTypePerTLF = true
	if !after.IsZero() {
		gafter := gregor1.ToTime(after)
		queryBase.After = &gafter
	}
	if !before.IsZero() {
		gbefore := gregor1.ToTime(before)
		queryBase.Before = &gbefore
	}
	if arg.TopicType != chat1.TopicType_NONE {
		queryBase.TopicType = &arg.TopicType
	}
	if arg.Visibility != keybase1.TLFVisibility_ANY {
		queryBase.TlfVisibility = &arg.Visibility
	}
	queryBase.Status = arg.Status

	var gires chat1.GetInboxAndUnboxLocalRes
	if arg.UnreadFirst {
		if arg.UnreadFirstLimit.AtMost <= 0 {
			arg.UnreadFirstLimit.AtMost = int(^uint(0) >> 1) // maximum int
		}
		if arg.UnreadFirstLimit.AtMost < arg.UnreadFirstLimit.AtLeast {
			arg.UnreadFirstLimit.AtMost = arg.UnreadFirstLimit.AtLeast
		}
		query := queryBase
		query.UnreadOnly, query.ReadOnly = true, false
		if gires, err = h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Pagination:       &chat1.Pagination{Num: arg.UnreadFirstLimit.AtMost},
			Query:            &query,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}); err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
		res.Conversations = gires.Conversations

		more := utils.Collar(
			arg.UnreadFirstLimit.AtLeast-len(res.Conversations),
			arg.UnreadFirstLimit.NumRead,
			arg.UnreadFirstLimit.AtMost-len(res.Conversations),
		)
		if more > 0 {
			query := queryBase
			query.UnreadOnly, query.ReadOnly = false, true
			if gires, err = h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
				Pagination: &chat1.Pagination{Num: more},
				Query:      &query,
			}); err != nil {
				return chat1.GetInboxSummaryForCLILocalRes{}, err
			}
			res.Conversations = append(res.Conversations, gires.Conversations...)
		}
	} else {
		if arg.ActivitySortedLimit <= 0 {
			arg.ActivitySortedLimit = int(^uint(0) >> 1) // maximum int
		}
		query := queryBase
		query.UnreadOnly, query.ReadOnly = false, false
		if gires, err = h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Pagination:       &chat1.Pagination{Num: arg.ActivitySortedLimit},
			Query:            &query,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}); err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
		res.Conversations = gires.Conversations
	}
	res.Offline = gires.Offline
	return res, nil
}

func (h *Server) GetConversationForCLILocal(ctx context.Context, arg chat1.GetConversationForCLILocalQuery) (res chat1.GetConversationForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetConversationForCLILocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}

	if arg.Limit.AtMost <= 0 {
		arg.Limit.AtMost = int(^uint(0) >> 1) // maximum int
	}
	if arg.Limit.AtMost < arg.Limit.AtLeast {
		arg.Limit.AtMost = arg.Limit.AtLeast
	}

	convLocal := arg.Conv

	var since time.Time
	if arg.Since != nil {
		since, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), *arg.Since)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", *arg.Since, since)
		}
	}

	query := chat1.GetThreadQuery{
		MarkAsRead:   arg.MarkAsRead,
		MessageTypes: arg.MessageTypes,
	}
	if !since.IsZero() {
		gsince := gregor1.ToTime(since)
		query.After = &gsince
	}

	tv, err := h.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID:   convLocal.Info.Id,
		Query:            &query,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return chat1.GetConversationForCLILocalRes{}, err
	}

	// apply message count limits
	var messages []chat1.MessageUnboxed
	for _, m := range tv.Thread.Messages {
		messages = append(messages, m)

		arg.Limit.AtMost--
		arg.Limit.AtLeast--
		if m.GetMessageID() <= convLocal.ReaderInfo.ReadMsgid {
			arg.Limit.NumRead--
		}
		if arg.Limit.AtMost <= 0 ||
			(arg.Limit.NumRead <= 0 && arg.Limit.AtLeast <= 0) {
			break
		}
	}

	return chat1.GetConversationForCLILocalRes{
		Conversation: convLocal,
		Messages:     messages,
		Offline:      tv.Offline,
	}, nil
}

func (h *Server) GetMessagesLocal(ctx context.Context, arg chat1.GetMessagesLocalArg) (res chat1.GetMessagesLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetMessagesLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	reason := chat1.GetThreadReason_GENERAL
	messages, err := h.G().ChatHelper.GetMessages(ctx, uid, arg.ConversationID, arg.MessageIDs,
		!arg.DisableResolveSupersedes, &reason)
	if err != nil {
		return res, err
	}
	return chat1.GetMessagesLocalRes{
		Messages:         messages,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetNextAttachmentMessageLocal(ctx context.Context,
	arg chat1.GetNextAttachmentMessageLocalArg) (res chat1.GetNextAttachmentMessageLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetNextAttachmentMessageLocal(%s,%d,%v)",
		arg.ConvID, arg.MessageID, arg.BackInTime)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	gallery := attachments.NewGallery(h.G())
	unboxed, _, err := gallery.NextMessage(ctx, uid, arg.ConvID, arg.MessageID,
		attachments.NextMessageOptions{
			BackInTime: arg.BackInTime,
			AssetTypes: arg.AssetTypes,
		},
	)
	if err != nil {
		return res, err
	}
	var resMsg *chat1.UIMessage
	if unboxed != nil {
		resMsg = new(chat1.UIMessage)
		*resMsg = utils.PresentMessageUnboxed(ctx, h.G(), *unboxed, uid, arg.ConvID)
	}
	return chat1.GetNextAttachmentMessageLocalRes{
		Message:          resMsg,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) SetConversationStatusLocal(ctx context.Context, arg chat1.SetConversationStatusLocalArg) (res chat1.SetConversationStatusLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetConversationStatusLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}
	if err := h.G().InboxSource.RemoteSetConversationStatus(ctx, uid, arg.ConversationID, arg.Status); err != nil {
		return res, err
	}
	return chat1.SetConversationStatusLocalRes{
		IdentifyFailures: identBreaks,
	}, nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *Server) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Sanity check that we have a TLF name here
	if len(arg.Msg.ClientHeader.TlfName) == 0 {
		h.Debug(ctx, "PostLocal: no TLF name specified: convID: %s uid: %s",
			arg.ConversationID, uid)
		return res, fmt.Errorf("no TLF name specified")
	}

	// Check for any slash command hits for an execute
	if handled, err := h.G().CommandsSource.AttemptBuiltinCommand(ctx, uid, arg.ConversationID,
		arg.Msg.ClientHeader.TlfName, arg.Msg.MessageBody, arg.ReplyTo); handled {
		h.Debug(ctx, "PostLocal: handled slash command with error: %s", err)
		return res, nil
	}

	// Run Stellar UI on any payments in the body
	if arg.Msg.MessageBody, err = h.runStellarSendUI(ctx, 0, uid, arg.ConversationID,
		arg.Msg.MessageBody); err != nil {
		return res, err
	}

	var prepareOpts chat1.SenderPrepareOptions
	prepareOpts.ReplyTo = arg.ReplyTo
	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)
	_, msgBoxed, err := sender.Send(ctx, arg.ConversationID, arg.Msg, 0, nil, nil, &prepareOpts)
	if err != nil {
		h.Debug(ctx, "PostLocal: unable to send message: %s", err.Error())
		return res, err
	}

	return chat1.PostLocalRes{
		MessageID:        msgBoxed.GetMessageID(),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) PostDeleteNonblock(ctx context.Context, arg chat1.PostDeleteNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_DELETE
	parg.Msg.ClientHeader.Supersedes = arg.Supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostEditNonblock(ctx context.Context, arg chat1.PostEditNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostEditNonblock")()

	var parg chat1.PostLocalNonblockArg
	var supersedes chat1.MessageID
	if arg.Target.MessageID != nil && *arg.Target.MessageID > 0 {
		supersedes = *arg.Target.MessageID
	}
	if supersedes.IsNil() && arg.Target.OutboxID == nil {
		return res, errors.New("must specify a messageID or outboxID for edit")
	}
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_EDIT
	parg.Msg.ClientHeader.Supersedes = supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
		MessageID: supersedes,
		Body:      arg.Body,
	})
	if supersedes.IsNil() {
		h.Debug(ctx, "PostEditNonblock: setting supersedes outboxID: %s", arg.Target.OutboxID)
		parg.Msg.SupersedesOutboxID = arg.Target.OutboxID
	}
	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) runStellarSendUI(ctx context.Context, sessionID int, uid gregor1.UID,
	convID chat1.ConversationID, msgBody chat1.MessageBody) (res chat1.MessageBody, err error) {
	defer h.Trace(ctx, func() error { return err }, "runStellarSendUI")()
	ui := h.getChatUI(sessionID)
	bodyTyp, err := msgBody.MessageType()
	if err != nil || bodyTyp != chat1.MessageType_TEXT {
		return msgBody, nil
	}
	body := msgBody.Text().Body
	parsedPayments := h.G().StellarSender.ParsePayments(ctx, uid, convID, body)
	if len(parsedPayments) == 0 {
		h.Debug(ctx, "runStellarSendUI: no payments")
		return msgBody, nil
	}
	h.Debug(ctx, "runStellarSendUI: payments found, showing confirm screen")
	if err := ui.ChatStellarShowConfirm(ctx); err != nil {
		return res, err
	}
	defer func() {
		ui.ChatStellarDone(ctx, err != nil)
	}()
	uiSummary, toSend, err := h.G().StellarSender.DescribePayments(ctx, uid, convID, parsedPayments)
	if err != nil {
		if err := libkb.ExportErrorAsStatus(h.G().GlobalContext, err); err != nil {
			ui.ChatStellarDataError(ctx, *err)
		} else {
			h.Debug(ctx, "error exported to nothing") // should never happen
		}
		return res, err
	}
	h.Debug(ctx, "runStellarSendUI: payments described, telling UI")
	accepted, err := ui.ChatStellarDataConfirm(ctx, uiSummary)
	if err != nil {
		return res, err
	}
	if !accepted {
		return res, errors.New("Payment message declined")
	}
	h.Debug(ctx, "runStellarSendUI: message confirmed, sending payments")
	payments, err := h.G().StellarSender.SendPayments(ctx, convID, toSend)
	if err != nil {
		// Send regardless here
		h.Debug(ctx, "runStellarSendUI: failed to send payments, but continuing on: %s", err)
		return msgBody, nil
	}
	return chat1.NewMessageBodyWithText(chat1.MessageText{
		Body:     body,
		Payments: payments,
	}), nil
}

func (h *Server) PostTextNonblock(ctx context.Context, arg chat1.PostTextNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostTextNonblock")()

	var parg chat1.PostLocalNonblockArg
	parg.SessionID = arg.SessionID
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.ReplyTo = arg.ReplyTo
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_TEXT
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: arg.Body,
	})
	if arg.EphemeralLifetime != nil {
		parg.Msg.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{
			Lifetime: *arg.EphemeralLifetime,
		}
	}
	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostReactionNonblock(ctx context.Context, arg chat1.PostReactionNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_REACTION
	parg.Msg.ClientHeader.Supersedes = arg.Supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithReaction(chat1.MessageReaction{
		MessageID: arg.Supersedes,
		Body:      arg.Body,
	})

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostHeadlineNonblock(ctx context.Context, arg chat1.PostHeadlineNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
		Headline: arg.Headline,
	})

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostHeadline(ctx context.Context, arg chat1.PostHeadlineArg) (chat1.PostLocalRes, error) {
	var parg chat1.PostLocalArg
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
		Headline: arg.Headline,
	})

	return h.PostLocal(ctx, parg)
}

func (h *Server) PostMetadataNonblock(ctx context.Context, arg chat1.PostMetadataNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_METADATA
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
		ConversationTitle: arg.ChannelName,
	})

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostMetadata(ctx context.Context, arg chat1.PostMetadataArg) (chat1.PostLocalRes, error) {
	var parg chat1.PostLocalArg
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_METADATA
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
		ConversationTitle: arg.ChannelName,
	})

	return h.PostLocal(ctx, parg)
}

func (h *Server) PostDeleteHistoryUpto(ctx context.Context, arg chat1.PostDeleteHistoryUptoArg) (res chat1.PostLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostDeleteHistoryUpto")()

	delh := chat1.MessageDeleteHistory{Upto: arg.Upto}

	var parg chat1.PostLocalArg
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_DELETEHISTORY
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.ClientHeader.DeleteHistory = &delh
	parg.Msg.MessageBody = chat1.NewMessageBodyWithDeletehistory(delh)

	h.Debug(ctx, "PostDeleteHistoryUpto: deleting upto msgid:%v", delh.Upto)

	return h.PostLocal(ctx, parg)
}

func (h *Server) PostDeleteHistoryThrough(ctx context.Context, arg chat1.PostDeleteHistoryThroughArg) (res chat1.PostLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostDeleteHistoryThrough")()
	return h.PostDeleteHistoryUpto(ctx, chat1.PostDeleteHistoryUptoArg{
		ConversationID:   arg.ConversationID,
		TlfName:          arg.TlfName,
		TlfPublic:        arg.TlfPublic,
		IdentifyBehavior: arg.IdentifyBehavior,
		Upto:             arg.Through + 1,
	})
}

func (h *Server) PostDeleteHistoryByAge(ctx context.Context, arg chat1.PostDeleteHistoryByAgeArg) (res chat1.PostLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostDeleteHistoryByAge")()

	gmRes, err := h.remoteClient().GetMessageBefore(ctx, chat1.GetMessageBeforeArg{
		ConvID: arg.ConversationID,
		Age:    arg.Age,
	})
	if err != nil {
		return res, err
	}
	upto := gmRes.MsgID + 1
	h.Debug(ctx, "PostDeleteHistoryByAge: deleting upto msgid:%v (age:%v)", upto, arg.Age)
	return h.PostDeleteHistoryUpto(ctx, chat1.PostDeleteHistoryUptoArg{
		ConversationID:   arg.ConversationID,
		TlfName:          arg.TlfName,
		TlfPublic:        arg.TlfPublic,
		IdentifyBehavior: arg.IdentifyBehavior,
		Upto:             upto,
	})
}

func (h *Server) GenerateOutboxID(ctx context.Context) (res chat1.OutboxID, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GenerateOutboxID")()
	return storage.NewOutboxID()
}

func (h *Server) PostLocalNonblock(ctx context.Context, arg chat1.PostLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostLocalNonblock")()
	defer h.suspendBgConvLoads(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Sanity check that we have a TLF name here
	if len(arg.Msg.ClientHeader.TlfName) == 0 {
		h.Debug(ctx, "PostLocalNonblock: no TLF name specified: convID: %s uid: %s",
			arg.ConversationID, uid)
		return res, fmt.Errorf("no TLF name specified")
	}

	// Clear draft
	go func(ctx context.Context) {
		if err := h.G().InboxSource.Draft(ctx, uid, arg.ConversationID, nil); err != nil {
			h.Debug(ctx, "PostLocalNonblock: failed to clear draft: %s", err)
		}
	}(globals.BackgroundChatCtx(ctx, h.G()))

	// Check for any slash command hits for an execute
	if handled, err := h.G().CommandsSource.AttemptBuiltinCommand(ctx, uid, arg.ConversationID,
		arg.Msg.ClientHeader.TlfName, arg.Msg.MessageBody, arg.ReplyTo); handled {
		h.Debug(ctx, "PostLocalNonblock: handled slash command with error: %s", err)
		return res, nil
	}

	// Determine if the messages contains any Stellar payments, and execute them if so
	if arg.Msg.MessageBody, err = h.runStellarSendUI(ctx, arg.SessionID, uid, arg.ConversationID,
		arg.Msg.MessageBody); err != nil {
		return res, err
	}

	// Create non block sender
	var prepareOpts chat1.SenderPrepareOptions
	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)
	nonblockSender := NewNonblockingSender(h.G(), sender)
	prepareOpts.ReplyTo = arg.ReplyTo
	obid, _, err := nonblockSender.Send(ctx, arg.ConversationID, arg.Msg, arg.ClientPrev, arg.OutboxID,
		nil, &prepareOpts)
	if err != nil {
		return res, fmt.Errorf("PostLocalNonblock: unable to send message: err: %s", err.Error())
	}
	h.Debug(ctx, "PostLocalNonblock: using outboxID: %s", obid)

	return chat1.PostLocalNonblockRes{
		OutboxID:         obid,
		IdentifyFailures: identBreaks,
	}, nil
}

// MakePreview implements chat1.LocalInterface.MakePreview.
func (h *Server) MakePreview(ctx context.Context, arg chat1.MakePreviewArg) (res chat1.MakePreviewRes, err error) {
	defer h.Trace(ctx, func() error { return err }, "MakePreview")()
	return attachments.NewSender(h.G()).MakePreview(ctx, arg.Filename, arg.OutboxID)
}

func (h *Server) GetUploadTempFile(ctx context.Context, arg chat1.GetUploadTempFileArg) (res string, err error) {
	defer h.Trace(ctx, func() error { return err }, "GetUploadTempFile")()
	return h.G().AttachmentUploader.GetUploadTempFile(ctx, arg.OutboxID, arg.Filename)
}

func (h *Server) MakeUploadTempFile(ctx context.Context, arg chat1.MakeUploadTempFileArg) (res string, err error) {
	defer h.Trace(ctx, func() error { return err }, "MakeUploadTempFile")()
	if res, err = h.G().AttachmentUploader.GetUploadTempFile(ctx, arg.OutboxID, arg.Filename); err != nil {
		return res, err
	}
	return res, ioutil.WriteFile(res, arg.Data, 0644)
}

func (h *Server) PostFileAttachmentLocalNonblock(ctx context.Context,
	arg chat1.PostFileAttachmentLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.Arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostFileAttachmentLocalNonblock")()
	defer h.suspendBgConvLoads(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Create non block sender
	sender := NewNonblockingSender(h.G(), NewBlockingSender(h.G(), h.boxer, h.remoteClient))
	outboxID, _, err := attachments.NewSender(h.G()).PostFileAttachmentMessage(ctx, sender,
		arg.Arg.ConversationID, arg.Arg.TlfName, arg.Arg.Visibility, arg.Arg.OutboxID, arg.Arg.Filename,
		arg.Arg.Title, arg.Arg.Metadata, arg.ClientPrev, arg.Arg.EphemeralLifetime,
		arg.Arg.CallerPreview)
	if err != nil {
		return res, err
	}
	if _, err := h.G().AttachmentUploader.Register(ctx, uid, arg.Arg.ConversationID, outboxID, arg.Arg.Title,
		arg.Arg.Filename, nil, arg.Arg.CallerPreview); err != nil {
		return res, err
	}
	return chat1.PostLocalNonblockRes{
		OutboxID:         outboxID,
		IdentifyFailures: identBreaks,
	}, nil
}

// PostFileAttachmentLocal implements chat1.LocalInterface.PostFileAttachmentLocal.
func (h *Server) PostFileAttachmentLocal(ctx context.Context, arg chat1.PostFileAttachmentLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.Arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostFileAttachmentLocal")()
	defer h.suspendBgConvLoads(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Get base of message we are going to send
	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)
	_, msgID, err := attachments.NewSender(h.G()).PostFileAttachment(ctx, sender, uid, arg.Arg.ConversationID,
		arg.Arg.TlfName, arg.Arg.Visibility, arg.Arg.OutboxID, arg.Arg.Filename, arg.Arg.Title,
		arg.Arg.Metadata, 0, arg.Arg.EphemeralLifetime, arg.Arg.CallerPreview)
	if err != nil {
		return res, err
	}
	if msgID == nil {
		return res, errors.New("no message ID returned from post")
	}
	return chat1.PostLocalRes{
		MessageID:        *msgID,
		IdentifyFailures: identBreaks,
	}, nil
}

// DownloadAttachmentLocal implements chat1.LocalInterface.DownloadAttachmentLocal.
func (h *Server) DownloadAttachmentLocal(ctx context.Context, arg chat1.DownloadAttachmentLocalArg) (res chat1.DownloadAttachmentLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "DownloadAttachmentLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	darg := downloadAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		MessageID:        arg.MessageID,
		Preview:          arg.Preview,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	cli := h.getStreamUICli()
	darg.Sink = libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)

	return h.downloadAttachmentLocal(ctx, uid, darg)
}

// DownloadFileAttachmentLocal implements chat1.LocalInterface.DownloadFileAttachmentLocal.
func (h *Server) DownloadFileAttachmentLocal(ctx context.Context, arg chat1.DownloadFileAttachmentLocalArg) (res chat1.DownloadFileAttachmentLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "DownloadFileAttachmentLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	darg := downloadAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		MessageID:        arg.MessageID,
		Preview:          arg.Preview,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	filename, sink, err := attachments.SinkFromFilename(ctx, h.G(), uid,
		arg.ConversationID, arg.MessageID, arg.Filename)
	if err != nil {
		return res, err
	}
	defer func() {
		// In the event of any error delete the file if it's empty.
		if err != nil {
			h.Debug(ctx, "DownloadFileAttachmentLocal: deleteFileIfEmpty: %v", deleteFileIfEmpty(filename))
		}
	}()
	if err := attachments.Quarantine(ctx, filename); err != nil {
		h.Debug(ctx, "DownloadFileAttachmentLocal: failed to quarantine download: %s", err)
	}
	darg.Sink = sink
	ires, err := h.downloadAttachmentLocal(ctx, uid, darg)
	if err != nil {
		return res, err
	}
	return chat1.DownloadFileAttachmentLocalRes{
		Filename:         filename,
		IdentifyFailures: ires.IdentifyFailures,
	}, nil
}

func deleteFileIfEmpty(filename string) (err error) {
	f, err := os.Stat(filename)
	if err != nil {
		return err
	}
	if f.Size() == 0 {
		return os.Remove(filename)
	}
	return nil
}

type downloadAttachmentArg struct {
	SessionID        int
	ConversationID   chat1.ConversationID
	MessageID        chat1.MessageID
	Sink             io.WriteCloser
	Preview          bool
	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

func (h *Server) downloadAttachmentLocal(ctx context.Context, uid gregor1.UID, arg downloadAttachmentArg) (res chat1.DownloadAttachmentLocalRes, err error) {

	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int64) {
		parg := chat1.ChatAttachmentDownloadProgressArg{
			SessionID:     arg.SessionID,
			BytesComplete: bytesComplete,
			BytesTotal:    bytesTotal,
		}
		chatUI.ChatAttachmentDownloadProgress(ctx, parg)
	}

	h.Debug(ctx, "downloadAttachmentLocal: fetching asset from attachment message: convID: %s messageID: %d",
		arg.ConversationID, arg.MessageID)

	chatUI.ChatAttachmentDownloadStart(ctx)
	err = attachments.Download(ctx, h.G(), uid, arg.ConversationID,
		arg.MessageID, arg.Sink, arg.Preview, progress, h.remoteClient)
	if err != nil {
		return res, err
	}
	chatUI.ChatAttachmentDownloadDone(ctx)

	return chat1.DownloadAttachmentLocalRes{
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) CancelPost(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "CancelPost(%s)", outboxID)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	outbox := storage.NewOutbox(h.G(), uid)
	if err := outbox.RemoveMessage(ctx, outboxID); err != nil {
		return err
	}
	// Alert the attachment uploader as well, in case this outboxID corresponds to an attachment upload
	return h.G().AttachmentUploader.Cancel(ctx, outboxID)
}

func (h *Server) RetryPost(ctx context.Context, arg chat1.RetryPostArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("RetryPost: obr: %v", arg.OutboxID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Mark as retry in the outbox
	outbox := storage.NewOutbox(h.G(), uid)
	obr, err := outbox.RetryMessage(ctx, arg.OutboxID, arg.IdentifyBehavior)
	if err != nil {
		return err
	} else if obr == nil {
		return nil
	}
	switch {
	case obr.IsAttachment():
		if _, err := h.G().AttachmentUploader.Retry(ctx, obr.OutboxID); err != nil {
			h.Debug(ctx, "RetryPost: failed to retry attachment upload: %s", err)
		}
	}

	// Force the send loop to try again
	h.G().MessageDeliverer.ForceDeliverLoop(ctx)

	return nil
}

// remoteClient returns a client connection to gregord.
func (h *Server) remoteClient() chat1.RemoteInterface {
	if h.rc != nil {
		return h.rc
	}
	return h.serverConn.GetClient()
}

func (h *Server) setTestRemoteClient(ri chat1.RemoteInterface) {
	h.rc = ri
}

func (h *Server) FindConversationsLocal(ctx context.Context,
	arg chat1.FindConversationsLocalArg) (res chat1.FindConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "FindConversationsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	res.Conversations, err = FindConversations(ctx, h.G(), h.DebugLabeler,
		types.InboxSourceDataSourceAll, h.remoteClient,
		uid, arg.TlfName, arg.TopicType, arg.MembersType, arg.Visibility, arg.TopicName, arg.OneChatPerTLF)
	if err != nil {
		return res, err
	}
	res.UiConversations = utils.PresentConversationLocals(ctx, res.Conversations,
		h.G().Env.GetUsername().String())
	return res, nil
}

func (h *Server) UpdateUnsentText(ctx context.Context, arg chat1.UpdateUnsentTextArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("UpdateUnsentText convID: %s", arg.ConversationID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Save draft
	var draftText *string
	if len(arg.Text) > 0 {
		draftText = &arg.Text
	}
	if err := h.G().InboxSource.Draft(ctx, uid, arg.ConversationID, draftText); err != nil {
		h.Debug(ctx, "UpdateUnsentText: failed to save draft: %s", err)
	}

	// Attempt to prefetch any unfurls in the background that are in the message text
	go h.G().Unfurler.Prefetch(globals.BackgroundChatCtx(ctx, h.G()), uid, arg.ConversationID, arg.Text)

	// Preview any slash commands in the text
	go h.G().CommandsSource.PreviewBuiltinCommand(globals.BackgroundChatCtx(ctx, h.G()), uid,
		arg.ConversationID, arg.TlfName, arg.Text)

	return nil
}

func (h *Server) UpdateTyping(ctx context.Context, arg chat1.UpdateTypingArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("UpdateTyping convID: %s", arg.ConversationID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	// Just bail out if we are offline
	if !h.G().Syncer.IsConnected(ctx) {
		return nil
	}
	deviceID := make([]byte, libkb.DeviceIDLen)
	if err := h.G().Env.GetDeviceID().ToBytes(deviceID); err != nil {
		return err
	}
	if err := h.remoteClient().UpdateTypingRemote(ctx, chat1.UpdateTypingRemoteArg{
		Uid:      uid,
		DeviceID: deviceID,
		ConvID:   arg.ConversationID,
		Typing:   arg.Typing,
	}); err != nil {
		h.Debug(ctx, "UpdateTyping: failed to hit the server: %s", err.Error())
	}
	return nil
}

func (h *Server) JoinConversationByIDLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("JoinConversationByIDLocal: convID: %s", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "JoinConversationByIDLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	err = JoinConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) JoinConversationLocal(ctx context.Context, arg chat1.JoinConversationLocalArg) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("JoinConversation(%s)",
		arg.TopicName))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "JoinConversationLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if err = JoinConversationByName(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, arg.TlfName,
		arg.TopicName, arg.TopicType, arg.Visibility); err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) LeaveConversationLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("LeaveConversation(%s)", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "LeaveConversationLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	err = LeaveConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) PreviewConversationByIDLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.PreviewConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("PreviewConversationByIDLocal: convID: %s", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "PreviewConversationByIDLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	conv, err := PreviewConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Conv = utils.PresentConversationLocal(ctx, conv, h.G().Env.GetUsername().String())
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) DeleteConversationLocal(ctx context.Context, arg chat1.DeleteConversationLocalArg) (res chat1.DeleteConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("DeleteConversation(%s)", arg.ConvID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "DeleteConversationLocal: result obtained offline")
		}
	}()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	return h.deleteConversationLocal(ctx, arg)
}

// deleteConversationLocal contains the functionality of
// DeleteConversationLocal split off for easier testing.
func (h *Server) deleteConversationLocal(ctx context.Context, arg chat1.DeleteConversationLocalArg) (res chat1.DeleteConversationLocalRes, err error) {
	ui := h.getChatUI(arg.SessionID)
	confirmed := arg.Confirmed
	if !confirmed {
		confirmed, err = ui.ChatConfirmChannelDelete(ctx, chat1.ChatConfirmChannelDeleteArg{
			SessionID: arg.SessionID,
			Channel:   arg.ChannelName,
		})
		if err != nil {
			return res, err
		}
	}
	if !confirmed {
		return res, errors.New("channel delete unconfirmed")
	}

	_, err = h.remoteClient().DeleteConversation(ctx, arg.ConvID)
	if err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) GetTLFConversationsLocal(ctx context.Context, arg chat1.GetTLFConversationsLocalArg) (res chat1.GetTLFConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("GetTLFConversationsLocal(%s)",
		arg.TlfName))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetTLFConversationsLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Fetch the TLF ID from specified name
	nameInfo, err := CreateNameInfoSource(ctx, h.G(), arg.MembersType).LookupID(ctx, arg.TlfName, false)
	if err != nil {
		h.Debug(ctx, "GetTLFConversationsLocal: failed to get TLFID from name: %s", err.Error())
		return res, err
	}

	var convs []chat1.ConversationLocal
	convs, err = h.G().TeamChannelSource.GetChannelsFull(ctx, uid, nameInfo.ID, arg.TopicType)
	if err != nil {
		return res, err
	}
	res.Convs = utils.PresentConversationLocals(ctx, convs, h.G().Env.GetUsername().String())
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) SetAppNotificationSettingsLocal(ctx context.Context,
	arg chat1.SetAppNotificationSettingsLocalArg) (res chat1.SetAppNotificationSettingsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("SetAppNotificationSettings(%s)",
		arg.ConvID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "SetAppNotificationSettingsLocal: result obtained offline")
		}
	}()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}

	var nsettings chat1.ConversationNotificationInfo
	nsettings.ChannelWide = arg.ChannelWide
	nsettings.Settings = make(map[keybase1.DeviceType]map[chat1.NotificationKind]bool)
	nsettings.Settings[keybase1.DeviceType_MOBILE] = make(map[chat1.NotificationKind]bool)
	nsettings.Settings[keybase1.DeviceType_DESKTOP] = make(map[chat1.NotificationKind]bool)
	for _, setting := range arg.Settings {
		nsettings.Settings[setting.DeviceType][setting.Kind] = setting.Enabled
	}
	_, err = h.remoteClient().SetAppNotificationSettings(ctx, chat1.SetAppNotificationSettingsArg{
		ConvID:   arg.ConvID,
		Settings: nsettings,
	})
	if err != nil {
		h.Debug(ctx, "SetAppNotificationSettings: failed to post to remote: %s", err.Error())
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) UnboxMobilePushNotification(ctx context.Context, arg chat1.UnboxMobilePushNotificationArg) (res string, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("UnboxMobilePushNotification(%s)",
		arg.ConvID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	bConvID, err := hex.DecodeString(arg.ConvID)
	if err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: invalid convID: %s msg: %s", arg.ConvID, err.Error())
		return res, err
	}
	convID := chat1.ConversationID(bConvID)
	mp := NewMobilePush(h.G())
	msg, err := mp.UnboxPushNotification(ctx, uid, convID, arg.MembersType, arg.Payload)
	if err != nil {
		return res, err
	}
	if res, err = mp.FormatPushText(ctx, uid, convID, arg.MembersType, msg); err != nil {
		return res, err
	}
	if arg.ShouldAck {
		mp.AckNotificationSuccess(ctx, arg.PushIDs)
	}
	return res, nil
}

func (h *Server) SetGlobalAppNotificationSettingsLocal(ctx context.Context,
	strSettings map[string]bool) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetGlobalAppNotificationSettings")()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return err
	}
	return setGlobalAppNotificationSettings(ctx, h.G(), h.remoteClient, strSettings)
}

func (h *Server) GetGlobalAppNotificationSettingsLocal(ctx context.Context) (res chat1.GlobalAppNotificationSettings, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetGlobalAppNotificationSettings")()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}
	return getGlobalAppNotificationSettings(ctx, h.G(), h.remoteClient)
}

func (h *Server) AddTeamMemberAfterReset(ctx context.Context,
	arg chat1.AddTeamMemberAfterResetArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "AddTeamMemberAfterReset")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Lookup conversation to get team ID
	iboxRes, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{arg.ConvID},
		}, nil)
	if err != nil {
		return err
	}
	if len(iboxRes.Convs) != 1 {
		return errors.New("failed to find conversation to add reset user back into")
	}
	var teamID keybase1.TeamID
	conv := iboxRes.Convs[0]
	switch conv.Info.MembersType {
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		team, err := NewTeamLoader(h.G().ExternalG()).loadTeam(ctx, conv.Info.Triple.Tlfid, conv.Info.TlfName,
			conv.Info.MembersType, conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC, nil)
		if err != nil {
			return err
		}
		teamID = team.ID
	case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_TEAM:
		teamID = keybase1.TeamID(conv.Info.Triple.Tlfid.String())
	default:
		return fmt.Errorf("unable to add member back to non team conversation: %v",
			conv.Info.MembersType)
	}
	return teams.ReAddMemberAfterReset(ctx, h.G().ExternalG(), teamID, arg.Username)
}

func (h *Server) SetConvRetentionLocal(ctx context.Context, arg chat1.SetConvRetentionLocalArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetConvRetentionLocal(%v, %v)", arg.ConvID, arg.Policy.Summary())()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	// short circuit if the policy is unchanged.
	policy := arg.Policy
	conv, err := utils.GetVerifiedConv(ctx, h.G(), uid, arg.ConvID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	if convRetention := conv.ConvRetention; convRetention != nil && policy.Eq(*convRetention) {
		h.Debug(ctx, "retention policy unchanged, skipping update")
		return nil
	}

	if _, err = h.remoteClient().SetConvRetention(ctx, chat1.SetConvRetentionArg{
		ConvID: arg.ConvID,
		Policy: policy,
	}); err != nil {
		return err
	}

	// Post a SYSTEM message to conversation about the change. If we're
	// inheriting the team policy, fetch that for the message.
	isInherit := false
	typ, err := policy.Typ()
	if err != nil {
		return err
	}
	switch typ {
	case chat1.RetentionPolicyType_INHERIT:
		isInherit = true
	}

	if isInherit {
		teamRetention := conv.TeamRetention
		if teamRetention == nil {
			policy = chat1.RetentionPolicy{}
		} else {
			policy = *teamRetention
		}
	}
	username := h.G().Env.GetUsername()
	subBody := chat1.NewMessageSystemWithChangeretention(chat1.MessageSystemChangeRetention{
		User:        username.String(),
		IsTeam:      false,
		IsInherit:   isInherit,
		MembersType: conv.GetMembersType(),
		Policy:      policy,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)
	return h.G().ChatHelper.SendMsgByID(ctx, arg.ConvID, conv.Info.TlfName, body, chat1.MessageType_SYSTEM,
		conv.Info.Visibility)
}

func (h *Server) SetTeamRetentionLocal(ctx context.Context, arg chat1.SetTeamRetentionLocalArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetTeamRetentionLocal(%v, %v)", arg.TeamID, arg.Policy.Summary())()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return err
	}
	teamRetention, err := h.GetTeamRetentionLocal(ctx, arg.TeamID)
	if err != nil {
		return err
	}
	policy := arg.Policy
	if teamRetention != nil && policy.Eq(*teamRetention) {
		h.Debug(ctx, "retention policy unchanged, skipping update")
		return nil
	}

	if _, err = h.remoteClient().SetTeamRetention(ctx, chat1.SetTeamRetentionArg{
		TeamID: arg.TeamID,
		Policy: policy,
	}); err != nil {
		return err
	}

	// Post a SYSTEM message to the #general channel about the change.
	tlfID, err := chat1.MakeTLFID(arg.TeamID.String())
	if err != nil {
		return err
	}
	username := h.G().Env.GetUsername()
	subBody := chat1.NewMessageSystemWithChangeretention(chat1.MessageSystemChangeRetention{
		User:        username.String(),
		IsTeam:      true,
		IsInherit:   false,
		MembersType: chat1.ConversationMembersType_TEAM,
		Policy:      arg.Policy,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)
	info, err := CreateNameInfoSource(ctx, h.G(), chat1.ConversationMembersType_TEAM).LookupName(ctx, tlfID, false)
	if err != nil {
		return err
	}
	return h.G().ChatHelper.SendMsgByName(ctx, info.CanonicalName, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM)
}

func (h *Server) GetTeamRetentionLocal(ctx context.Context, teamID keybase1.TeamID) (res *chat1.RetentionPolicy, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetTeamRetentionLocal(%s)", teamID)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	tlfID, err := chat1.MakeTLFID(teamID.String())
	if err != nil {
		return res, err
	}
	p := chat1.Pagination{Num: 1}
	ib, err := h.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			TlfID: &tlfID,
		}, &p)
	if err != nil {
		return res, err
	}
	if len(ib.ConvsUnverified) != 1 {
		return res, errors.New("no conversations found")
	}
	return ib.ConvsUnverified[0].Conv.TeamRetention, nil
}

func (h *Server) SetConvMinWriterRoleLocal(ctx context.Context, arg chat1.SetConvMinWriterRoleLocalArg) (err error) {
	defer h.Trace(ctx, func() error { return err }, "SetConvMinWriterRole(%v, %v)", arg.ConvID, arg.Role)()
	_, err = h.remoteClient().SetConvMinWriterRole(ctx, chat1.SetConvMinWriterRoleArg{
		ConvID: arg.ConvID,
		Role:   arg.Role,
	})
	return err
}

func (h *Server) UpgradeKBFSConversationToImpteam(ctx context.Context, convID chat1.ConversationID) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "UpgradeKBFSConversationToImpteam(%s)", convID)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	ibox, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		}, nil)
	if err != nil {
		return err
	}
	if len(ibox.Convs) == 0 {
		return errors.New("no conversation found")
	}
	conv := ibox.Convs[0]
	if conv.GetMembersType() != chat1.ConversationMembersType_KBFS {
		return fmt.Errorf("cannot upgrade %v conversation", conv.GetMembersType())
	}
	tlfID := conv.Info.Triple.Tlfid
	tlfName := conv.Info.TlfName
	public := conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC
	return h.G().ChatHelper.UpgradeKBFSToImpteam(ctx, tlfName, tlfID, public)
}

func (h *Server) cancelActiveSearchLocked() {
	if h.searchCancelFn != nil {
		h.searchCancelFn()
		h.searchCancelFn = nil
	}
}

func (h *Server) getSearchContext(ctx context.Context) context.Context {
	// enforce a single search happening at a time
	h.searchMu.Lock()
	h.cancelActiveSearchLocked()
	ctx, h.searchCancelFn = context.WithCancel(ctx)
	h.searchMu.Unlock()
	return ctx
}

func (h *Server) CancelActiveSearch(ctx context.Context) (err error) {
	defer h.Trace(ctx, func() error { return err }, "CancelActiveSearch")()
	h.searchMu.Lock()
	h.cancelActiveSearchLocked()
	h.searchMu.Unlock()
	return nil
}

func (h *Server) getSearchRegexp(query string, opts chat1.SearchOpts) (re *regexp.Regexp, err error) {
	if opts.IsRegex {
		re, err = regexp.Compile(query)
	} else {
		// String queries are set case insensitive
		re, err = utils.GetQueryRe(query)
	}
	if err != nil {
		return nil, err
	}
	return re, nil
}

func (h *Server) SearchRegexp(ctx context.Context, arg chat1.SearchRegexpArg) (res chat1.SearchRegexpRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SearchRegexp")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	ctx = h.getSearchContext(ctx)

	query, opts := search.UpgradeSearchOptsFromQuery(arg.Query, arg.Opts,
		h.G().GetEnv().GetUsername().String())
	re, err := h.getSearchRegexp(query, opts)
	if err != nil {
		return res, err
	}

	chatUI := h.getChatUI(arg.SessionID)
	uiCh := make(chan chat1.ChatSearchHit, 10)
	ch := make(chan struct{})
	go func() {
		for searchHit := range uiCh {
			select {
			case <-ctx.Done():
				return
			default:
				chatUI.ChatSearchHit(ctx, chat1.ChatSearchHitArg{
					SearchHit: searchHit,
				})
			}
		}
		close(ch)
	}()
	hits, _, err := h.G().RegexpSearcher.Search(ctx, uid, arg.ConvID, re, uiCh, opts)
	if err != nil {
		return res, err
	}

	<-ch
	chatUI.ChatSearchDone(ctx, chat1.ChatSearchDoneArg{
		NumHits: len(hits),
	})
	return chat1.SearchRegexpRes{
		Hits:             hits,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) cancelActiveInboxSearchLocked() {
	if h.searchInboxCancelFn != nil {
		h.searchInboxCancelFn()
		h.searchInboxCancelFn = nil
	}
}

func (h *Server) getInboxSearchContext(ctx context.Context) context.Context {
	// enforce a single search happening at a time
	h.searchInboxMu.Lock()
	h.cancelActiveInboxSearchLocked()
	ctx, h.searchInboxCancelFn = context.WithCancel(ctx)
	h.searchInboxMu.Unlock()
	return ctx
}

func (h *Server) CancelActiveInboxSearch(ctx context.Context) (err error) {
	defer h.Trace(ctx, func() error { return err }, "CancelActiveInboxSearch")()
	h.searchInboxMu.Lock()
	h.cancelActiveInboxSearchLocked()
	h.searchInboxMu.Unlock()
	return nil
}

func (h *Server) delegateInboxSearch(ctx context.Context, uid gregor1.UID, query, origQuery string,
	opts chat1.SearchOpts, ui libkb.ChatUI) (res chat1.ChatSearchInboxResults, err error) {
	defer h.Trace(ctx, func() error { return err }, "delegateInboxSearch")()
	convs, err := h.G().Indexer.SearchableConvs(ctx, uid, opts.ConvID)
	if err != nil {
		return res, err
	}
	re, err := h.getSearchRegexp(query, opts)
	if err != nil {
		return res, err
	}
	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		ui.ChatSearchConvHits(ctx, chat1.UIChatSearchConvHits{})
	}
	var numHits, numConvs int
	for index, conv := range convs {
		uiCh := make(chan chat1.ChatSearchHit, 10)
		ch := make(chan struct{})
		go func() {
			for searchHit := range uiCh {
				select {
				case <-ctx.Done():
					return
				default:
					ui.ChatSearchHit(ctx, chat1.ChatSearchHitArg{
						SearchHit: searchHit,
					})
				}
			}
			close(ch)
		}()
		hits, _, err := h.G().RegexpSearcher.Search(ctx, uid, conv.GetConvID(), re, uiCh, opts)
		if err != nil {
			h.Debug(ctx, "delegateInboxSearch: failed to search conv: %s", err)
			continue
		}
		<-ch
		if len(hits) == 0 {
			continue
		}
		numHits += len(hits)
		numConvs++
		inboxHit := chat1.ChatSearchInboxHit{
			ConvID:   conv.GetConvID(),
			TeamType: conv.GetTeamType(),
			ConvName: conv.GetName(),
			Query:    origQuery,
			Time:     hits[0].HitMessage.Valid().Ctime,
			Hits:     hits,
		}
		select {
		case <-ctx.Done():
			return res, ctx.Err()
		default:
			ui.ChatSearchInboxHit(ctx, chat1.ChatSearchInboxHitArg{
				SearchHit: inboxHit,
			})
		}
		res.Hits = append(res.Hits, inboxHit)
		if opts.MaxConvsHit > 0 && len(res.Hits) > opts.MaxConvsHit {
			break
		}
		if opts.MaxConvsSearched > 0 && index > opts.MaxConvsSearched {
			break
		}
	}

	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		ui.ChatSearchInboxDone(ctx, chat1.ChatSearchInboxDoneArg{
			Res: chat1.ChatSearchInboxDone{
				NumHits:   numHits,
				NumConvs:  numConvs,
				Delegated: true,
			},
		})
	}
	return res, nil
}

func (h *Server) SearchInbox(ctx context.Context, arg chat1.SearchInboxArg) (res chat1.SearchInboxRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SearchInbox")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer h.suspendBgConvLoads(ctx)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	chatUI := h.getChatUI(arg.SessionID)
	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		chatUI.ChatSearchInboxStart(ctx)
	}

	username := h.G().GetEnv().GetUsernameForUID(keybase1.UID(uid.String())).String()
	query, opts := search.UpgradeSearchOptsFromQuery(arg.Query, arg.Opts, username)
	doSearch := !arg.NamesOnly && len(query) > 0
	forceDelegate := false
	if arg.Opts.ConvID != nil {
		fullyIndexed, err := h.G().Indexer.FullyIndexed(ctx, *arg.Opts.ConvID, uid)
		if err != nil {
			h.Debug(ctx, "SearchInbox: failed to check fully indexed, delegating... err: %s", err)
			forceDelegate = true
		} else {
			forceDelegate = !fullyIndexed
		}
		if len(query) < search.MinTokenLength {
			forceDelegate = true
		}
		if forceDelegate {
			h.Debug(ctx, "SearchInbox: force delegating since not indexed")
		}
		ctx = h.getSearchContext(ctx)
	} else {
		ctx = h.getInboxSearchContext(ctx)
	}

	if doSearch && (opts.IsRegex || forceDelegate) {
		inboxRes, err := h.delegateInboxSearch(ctx, uid, query, arg.Query, opts, chatUI)
		if err != nil {
			return res, err
		}
		res.Res = &inboxRes
		res.IdentifyFailures = identBreaks
		return res, nil
	}

	// stream hits back to client UI
	hitUICh := make(chan chat1.ChatSearchInboxHit, 10)
	hitUIDone := make(chan struct{})
	numHits := 0
	go func() {
		defer close(hitUIDone)
		if !doSearch {
			return
		}
		for searchHit := range hitUICh {
			numHits += len(searchHit.Hits)
			select {
			case <-ctx.Done():
				return
			default:
				chatUI.ChatSearchInboxHit(ctx, chat1.ChatSearchInboxHitArg{
					SearchHit: searchHit,
				})
			}
		}
	}()
	// stream index status back to client UI
	indexUICh := make(chan chat1.ChatSearchIndexStatus, 10)
	indexUIDone := make(chan struct{})
	go func() {
		defer close(indexUIDone)
		if !doSearch {
			return
		}
		for status := range indexUICh {
			select {
			case <-ctx.Done():
				return
			default:
				chatUI.ChatSearchIndexStatus(ctx, chat1.ChatSearchIndexStatusArg{
					Status: status,
				})
			}
		}
	}()

	// send up conversation name matches
	convUIDone := make(chan struct{})
	go func() {
		defer close(convUIDone)
		if opts.MaxNameConvs == 0 {
			return
		}
		convHits, err := h.G().InboxSource.Search(ctx, uid, query, opts.MaxNameConvs)
		if err != nil {
			h.Debug(ctx, "SearchInbox: failed to get conv hits: %s", err)
		} else {
			select {
			case <-ctx.Done():
				return
			default:
				chatUI.ChatSearchConvHits(ctx, chat1.UIChatSearchConvHits{
					Hits:          utils.PresentRemoteConversationsAsSearchHits(convHits, username),
					UnreadMatches: len(query) == 0,
				})
			}
		}
	}()

	var searchRes *chat1.ChatSearchInboxResults
	if doSearch {
		select {
		case <-time.After(50 * time.Millisecond):
		case <-ctx.Done():
			return
		}
		if searchRes, err = h.G().Indexer.Search(ctx, uid, query, arg.Query, opts, hitUICh, indexUICh); err != nil {
			return res, err
		}
	}
	<-hitUIDone
	<-indexUIDone
	<-convUIDone

	var doneRes chat1.ChatSearchInboxDone
	if searchRes != nil {
		doneRes = chat1.ChatSearchInboxDone{
			NumHits:        numHits,
			NumConvs:       len(searchRes.Hits),
			PercentIndexed: searchRes.PercentIndexed,
		}
	}
	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		chatUI.ChatSearchInboxDone(ctx, chat1.ChatSearchInboxDoneArg{
			Res: doneRes,
		})
	}
	return chat1.SearchInboxRes{
		Res:              searchRes,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) ProfileChatSearch(ctx context.Context, identifyBehavior keybase1.TLFIdentifyBehavior) (res map[string]chat1.ProfileSearchConvStats, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), identifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "ProfileChatSearch")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return nil, err
	}

	res, err = h.G().Indexer.IndexInbox(ctx, uid)
	if err != nil {
		return nil, err
	}
	b, err := json.Marshal(res)
	if err != nil {
		return nil, err
	}
	h.Debug(ctx, "%s\n", string(b))
	return res, err
}

func (h *Server) GetStaticConfig(ctx context.Context) (res chat1.StaticConfig, err error) {
	defer h.Trace(ctx, func() error { return err }, "GetStaticConfig")()
	return chat1.StaticConfig{
		DeletableByDeleteHistory: chat1.DeletableMessageTypesByDeleteHistory(),
		BuiltinCommands:          h.G().CommandsSource.GetBuiltins(ctx),
	}, nil
}

func (h *Server) ResolveUnfurlPrompt(ctx context.Context, arg chat1.ResolveUnfurlPromptArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	defer func() {
		// squash all errors coming out of here
		err = nil
	}()
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "ResolveUnfurlPrompt")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	fetchAndUnfurl := func() error {
		conv, err := utils.GetUnverifiedConv(ctx, h.G(), uid, arg.ConvID, types.InboxSourceDataSourceAll)
		if err != nil {
			return err
		}
		msgs, err := h.G().ConvSource.GetMessages(ctx, conv.Conv, uid, []chat1.MessageID{arg.MsgID}, nil)
		if err != nil {
			return err
		}
		msgs, err = h.G().ConvSource.TransformSupersedes(ctx, conv.Conv, uid, msgs, nil, nil, nil)
		if err != nil {
			return err
		}
		if len(msgs) != 1 {
			return errors.New("message not found")
		}
		h.G().Unfurler.UnfurlAndSend(ctx, uid, arg.ConvID, msgs[0])
		return nil
	}
	atyp, err := arg.Result.ActionType()
	if err != nil {
		return err
	}
	switch atyp {
	case chat1.UnfurlPromptAction_NOTNOW:
		// do nothing
	case chat1.UnfurlPromptAction_ACCEPT:
		if err = h.G().Unfurler.WhitelistAdd(ctx, uid, arg.Result.Accept()); err != nil {
			return fmt.Errorf("failed to add to whitelist, doing nothing: %s", err)
		}
		if err = fetchAndUnfurl(); err != nil {
			return fmt.Errorf("failed to fetch and unfurl: %s", err)
		}
	case chat1.UnfurlPromptAction_ONETIME:
		h.G().Unfurler.WhitelistAddExemption(ctx, uid,
			unfurl.NewSingleMessageWhitelistExemption(arg.ConvID, arg.MsgID, arg.Result.Onetime()))
		if err = fetchAndUnfurl(); err != nil {
			return fmt.Errorf("failed to fetch and unfurl: %s", err)
		}
	case chat1.UnfurlPromptAction_NEVER:
		if err = h.G().Unfurler.SetMode(ctx, uid, chat1.UnfurlMode_NEVER); err != nil {
			return fmt.Errorf("failed to set mode to never: %s", err)
		}
	case chat1.UnfurlPromptAction_ALWAYS:
		if err = h.G().Unfurler.SetMode(ctx, uid, chat1.UnfurlMode_ALWAYS); err != nil {
			return fmt.Errorf("failed to set mode to always: %s", err)
		}
		if err = fetchAndUnfurl(); err != nil {
			return fmt.Errorf("failed to fetch and unfurl: %s", err)
		}
	}
	return nil
}

func (h *Server) GetUnfurlSettings(ctx context.Context) (res chat1.UnfurlSettingsDisplay, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetUnfurlSettings")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	settings, err := h.G().Unfurler.GetSettings(ctx, uid)
	if err != nil {
		return res, err
	}
	res.Mode = settings.Mode
	for w := range settings.Whitelist {
		res.Whitelist = append(res.Whitelist, w)
	}
	sort.Slice(res.Whitelist, func(i, j int) bool {
		return res.Whitelist[i] < res.Whitelist[j]
	})
	return res, nil
}

func (h *Server) SaveUnfurlSettings(ctx context.Context, arg chat1.SaveUnfurlSettingsArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SaveUnfurlSettings")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	wm := make(map[string]bool)
	for _, w := range arg.Whitelist {
		wm[w] = true
	}
	return h.G().Unfurler.SetSettings(ctx, uid, chat1.UnfurlSettings{
		Mode:      arg.Mode,
		Whitelist: wm,
	})
}

func (h *Server) ToggleMessageCollapse(ctx context.Context, arg chat1.ToggleMessageCollapseArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "ToggleMessageCollapse convID=%s msgID=%d collapsed=%v",
		arg.ConvID, arg.MsgID, arg.Collapse)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	if err := utils.NewCollapses(h.G()).ToggleSingle(ctx, uid, arg.ConvID, arg.MsgID, arg.Collapse); err != nil {
		return err
	}
	msg, err := GetMessage(ctx, h.G(), uid, arg.ConvID, arg.MsgID, true, nil)
	if err != nil {
		h.Debug(ctx, "ToggleMessageCollapse: failed to get message: %s", err)
		return nil
	}
	if !msg.IsValid() {
		h.Debug(ctx, "ToggleMessageCollapse: invalid message")
		return nil
	}
	if msg.Valid().MessageBody.IsType(chat1.MessageType_UNFURL) {
		unfurledMsg, err := GetMessage(ctx, h.G(), uid, arg.ConvID,
			msg.Valid().MessageBody.Unfurl().MessageID, true, nil)
		if err != nil {
			h.Debug(ctx, "ToggleMessageCollapse: failed to get unfurl base message: %s", err)
			return nil
		}
		// give a notification about the unfurled message
		notif := chat1.MessagesUpdated{
			ConvID:  arg.ConvID,
			Updates: []chat1.UIMessage{utils.PresentMessageUnboxed(ctx, h.G(), unfurledMsg, uid, arg.ConvID)},
		}
		act := chat1.NewChatActivityWithMessagesUpdated(notif)
		h.G().ActivityNotifier.Activity(ctx, uid, chat1.TopicType_CHAT,
			&act, chat1.ChatActivitySource_LOCAL)
	} else if msg.Valid().MessageBody.IsType(chat1.MessageType_ATTACHMENT) {
		notif := chat1.MessagesUpdated{
			ConvID:  arg.ConvID,
			Updates: []chat1.UIMessage{utils.PresentMessageUnboxed(ctx, h.G(), msg, uid, arg.ConvID)},
		}
		act := chat1.NewChatActivityWithMessagesUpdated(notif)
		h.G().ActivityNotifier.Activity(ctx, uid, chat1.TopicType_CHAT,
			&act, chat1.ChatActivitySource_LOCAL)
	}
	return nil
}

func (h *Server) BulkAddToConv(ctx context.Context, arg chat1.BulkAddToConvArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "BulkAddToConv: convID: %v, numUsers: %v", arg.ConvID, len(arg.Usernames))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	if len(arg.Usernames) == 0 {
		return fmt.Errorf("Unable to BulkAddToConv, no users specified")
	}

	rc, err := utils.GetUnverifiedConv(ctx, h.G(), uid, arg.ConvID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	conv := rc.Conv
	mt := conv.Metadata.MembersType
	switch mt {
	case chat1.ConversationMembersType_TEAM:
	default:
		return fmt.Errorf("BulkAddToConv only available to TEAM conversations. Found %v conv", mt)
	}

	info, err := CreateNameInfoSource(ctx, h.G(), mt).LookupName(
		ctx, conv.Metadata.IdTriple.Tlfid, conv.Metadata.Visibility == keybase1.TLFVisibility_PUBLIC)
	if err != nil {
		return err
	}
	subBody := chat1.NewMessageSystemWithBulkaddtoconv(chat1.MessageSystemBulkAddToConv{
		Usernames: arg.Usernames,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)
	boxer := NewBoxer(h.G())
	sender := NewBlockingSender(h.G(), boxer, h.remoteClient)
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			TlfName:     info.CanonicalName,
			MessageType: chat1.MessageType_SYSTEM,
		},
		MessageBody: body,
	}
	status := chat1.ConversationMemberStatus_ACTIVE
	_, _, err = sender.Send(ctx, arg.ConvID, msg, 0, nil, &chat1.SenderSendOptions{
		JoinMentionsAs: &status,
	}, nil)
	return err
}

func (h *Server) PutReacjiSkinTone(ctx context.Context, skinTone keybase1.ReacjiSkinTone) (res keybase1.UserReacjis, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetReacjiSkinTone")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	store := storage.NewReacjiStore(h.G())
	store.PutSkinTone(ctx, uid, skinTone)
	res = store.UserReacjis(ctx, uid)
	return res, nil
}

func (h *Server) ResolveMaybeMention(ctx context.Context, mention chat1.MaybeMention) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "ResolveMaybeMention")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Try to load as user
	if mention.Channel == "" {
		nn := libkb.NewNormalizedUsername(mention.Name)
		if _, err = h.G().GetUPAKLoader().LookupUID(ctx, nn); err != nil {
			h.Debug(ctx, "ResolveMaybeMention: not a user")
		} else {
			h.getChatUI(0).ChatMaybeMentionUpdate(ctx, mention.Name, mention.Channel,
				chat1.NewUIMaybeMentionInfoWithUser())
			return nil
		}
	}
	// Try to load as team
	return h.G().TeamMentionLoader.LoadTeamMention(ctx, uid, mention, nil, true)
}

func (h *Server) getLoadGalleryContext(ctx context.Context) context.Context {
	// enforce a single search happening at a time
	h.loadGalleryMu.Lock()
	if h.loadGalleryCancelFn != nil {
		h.loadGalleryCancelFn()
		h.loadGalleryCancelFn = nil
	}
	ctx, h.loadGalleryCancelFn = context.WithCancel(ctx)
	h.loadGalleryMu.Unlock()
	return ctx
}

func (h *Server) LoadGallery(ctx context.Context, arg chat1.LoadGalleryArg) (res chat1.LoadGalleryRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "LoadGallery")()
	defer func() { err = h.squashSquashableErrors(err) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer h.suspendBgConvLoads(ctx)()

	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	ctx = h.getLoadGalleryContext(ctx)
	chatUI := h.getChatUI(arg.SessionID)
	convID := arg.ConvID
	var opts attachments.NextMessageOptions
	opts.BackInTime = true
	switch arg.Typ {
	case chat1.GalleryItemTyp_MEDIA:
		opts.MessageType = chat1.MessageType_ATTACHMENT
		opts.AssetTypes = []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE,
			chat1.AssetMetadataType_VIDEO}
	case chat1.GalleryItemTyp_LINK:
		opts.MessageType = chat1.MessageType_TEXT
		opts.FilterLinks = true
	case chat1.GalleryItemTyp_DOC:
		opts.MessageType = chat1.MessageType_ATTACHMENT
		opts.AssetTypes = []chat1.AssetMetadataType{chat1.AssetMetadataType_NONE}
	default:
		return res, errors.New("invalid gallery type")
	}
	var msgID chat1.MessageID
	if arg.FromMsgID != nil {
		msgID = *arg.FromMsgID
	} else {
		conv, err := utils.GetUnverifiedConv(ctx, h.G(), uid, convID, types.InboxSourceDataSourceAll)
		if err != nil {
			return res, err
		}
		msgID = conv.Conv.ReaderInfo.MaxMsgid + 1
	}

	hitCh := make(chan chat1.UIMessage)
	go func(ctx context.Context) {
		for msg := range hitCh {
			chatUI.ChatLoadGalleryHit(ctx, msg)
		}
	}(ctx)
	gallery := attachments.NewGallery(h.G())
	msgs, last, err := gallery.NextMessages(ctx, uid, convID, msgID, arg.Num, opts, hitCh)
	if err != nil {
		return res, err
	}
	return chat1.LoadGalleryRes{
		Last:     last,
		Messages: utils.PresentMessagesUnboxed(ctx, h.G(), msgs, uid, convID),
	}, nil
}

func (h *Server) LoadFlip(ctx context.Context, arg chat1.LoadFlipArg) (res chat1.LoadFlipRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "LoadFlip")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	statusCh, errCh := h.G().CoinFlipManager.LoadFlip(ctx, uid, arg.HostConvID, arg.HostMsgID,
		arg.FlipConvID, arg.GameID)
	select {
	case status := <-statusCh:
		res.Status = status
	case err = <-errCh:
		return res, err
	}
	res.IdentifyFailures = identBreaks
	return res, nil
}

func (h *Server) LocationUpdate(ctx context.Context, coord chat1.Coordinate) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "LocationUpdate")()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	h.G().LiveLocationTracker.LocationUpdate(ctx, coord)
	return nil
}

func (h *Server) LocationDenied(ctx context.Context, convID chat1.ConversationID) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "LocationDenied")()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	return h.getChatUI(0).ChatCommandStatus(ctx, convID,
		"Failed to access your location. Please allow Keybase to access your location in the phone settings.",
		chat1.UICommandStatusDisplayTyp_ERROR,
		[]chat1.UICommandStatusActionTyp{chat1.UICommandStatusActionTyp_APPSETTINGS})
}

func (h *Server) AdvertiseBotCommandsLocal(ctx context.Context, arg chat1.AdvertiseBotCommandsLocalArg) (res chat1.AdvertiseBotCommandsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "AdvertiseBotCommandsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if err := h.G().BotCommandManager.Advertise(ctx, arg.Alias, arg.Advertisements); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) ClearBotCommandsLocal(ctx context.Context) (res chat1.ClearBotCommandsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "ClearBotCommandsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if err := h.G().BotCommandManager.Clear(ctx); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) ListBotCommandsLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.ListBotCommandsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "ListBotCommandsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	completeCh, err := h.G().BotCommandManager.UpdateCommands(ctx, convID, nil)
	if err != nil {
		return res, err
	}
	if err := <-completeCh; err != nil {
		h.Debug(ctx, "ListBotCommandsLocal: failed to update commands, list might be stale: %s", err)
	}
	lres, err := h.G().BotCommandManager.ListCommands(ctx, convID)
	if err != nil {
		return res, err
	}
	res.Commands = lres
	return res, nil
}
