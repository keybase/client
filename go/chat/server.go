package chat

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"encoding/base64"
	"encoding/hex"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
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

	serverConn    ServerConnection
	uiSource      UISource
	boxer         *Boxer
	store         *AttachmentStore
	identNotifier *IdentifyNotifier

	// Only for testing
	rc                chat1.RemoteInterface
	mockChatUI        libkb.ChatUI
	cachedThreadDelay *time.Duration
}

func NewServer(g *globals.Context, store *AttachmentStore, serverConn ServerConnection,
	uiSource UISource) *Server {
	return &Server{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "Server", false),
		serverConn:    serverConn,
		uiSource:      uiSource,
		store:         store,
		boxer:         NewBoxer(g),
		identNotifier: NewIdentifyNotifier(g),
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

type offlineErrorKind int

const (
	offlineErrorKindOnline offlineErrorKind = iota
	offlineErrorKindOfflineBasic
	offlineErrorKindOfflineReconnect
)

func (h *Server) isOfflineError(err error) offlineErrorKind {
	// Check type
	switch terr := err.(type) {
	case net.Error:
		return offlineErrorKindOfflineReconnect
	case libkb.APINetError:
		return offlineErrorKindOfflineBasic
	case OfflineError:
		return offlineErrorKindOfflineBasic
	case TransientUnboxingError:
		return h.isOfflineError(terr.Inner())
	}
	// Check error itself
	switch err {
	case context.DeadlineExceeded:
		fallthrough
	case context.Canceled:
		fallthrough
	case ErrChatServerTimeout:
		return offlineErrorKindOfflineReconnect
	case ErrDuplicateConnection:
		return offlineErrorKindOfflineBasic
	}

	return offlineErrorKindOnline
}

func (h *Server) handleOfflineError(ctx context.Context, err error,
	res chat1.OfflinableResult) error {

	errKind := h.isOfflineError(err)
	if errKind != offlineErrorKindOnline {
		h.Debug(ctx, "handleOfflineError: setting offline: err: %s", err)
		res.SetOffline()
		switch errKind {
		case offlineErrorKindOfflineReconnect:
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

func (h *Server) presentUnverifiedInbox(ctx context.Context, convs []types.RemoteConversation,
	p *chat1.Pagination, offline bool) (res chat1.UnverifiedInboxUIItems, err error) {
	for _, rawConv := range convs {
		if len(rawConv.Conv.MaxMsgSummaries) == 0 {
			h.Debug(ctx, "presentUnverifiedInbox: invalid convo, no max msg summaries, skipping: %s",
				rawConv.Conv.GetConvID())
			continue
		}
		res.Items = append(res.Items, utils.PresentRemoteConversation(rawConv))
	}
	res.Pagination = utils.PresentPagination(p)
	res.Offline = offline
	return res, err
}

func (h *Server) GetInboxNonblockLocal(ctx context.Context, arg chat1.GetInboxNonblockLocalArg) (res chat1.NonblockFetchRes, err error) {
	var breaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &breaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetInboxNonblockLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetInboxNonblockLocal: result obtained offline")
		}
	}()
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		return res, libkb.LoginRequiredError{}
	}

	// Create localized conversation callback channel
	chatUI := h.getChatUI(arg.SessionID)
	localizeCb := make(chan NonblockInboxResult, 1)

	// Invoke nonblocking inbox read and get remote inbox version to send back as our result
	localizer := NewNonblockingLocalizer(h.G(), localizeCb, arg.MaxUnbox)
	_, rl, err := h.G().InboxSource.Read(ctx, uid.ToBytes(), localizer, true, arg.Query, arg.Pagination)
	if err != nil {
		// If this is a convID based query, let's go ahead and drop those onto the retrier
		if arg.Query != nil && len(arg.Query.ConvIDs) > 0 {
			h.Debug(ctx, "GetInboxNonblockLocal: failed to get unverified inbox, marking convIDs as failed")
			for _, convID := range arg.Query.ConvIDs {
				h.G().FetchRetrier.Failure(ctx, uid.ToBytes(),
					NewConversationRetry(h.G(), convID, nil, InboxLoad))
			}
		} else {
			h.Debug(ctx, "GetInboxNonblockLocal: failed to load untrusted inbox, general query")
			h.G().FetchRetrier.Failure(ctx, uid.ToBytes(),
				NewFullInboxRetry(h.G(), arg.Query, arg.Pagination))
		}
		return res, err
	}
	res.RateLimits = utils.AggRateLimitsP([]*chat1.RateLimit{rl})

	// Wait for inbox to get sent to us
	var lres NonblockInboxResult
	if arg.SkipUnverified {
		select {
		case lres = <-localizeCb:
			h.Debug(ctx, "GetInboxNonblockLocal: received unverified inbox, skipping send")
		case <-time.After(15 * time.Second):
			return res, fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
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
			chatUI.ChatInboxUnverified(ctx, chat1.ChatInboxUnverifiedArg{
				SessionID: arg.SessionID,
				Inbox:     string(jbody),
			})
			h.Debug(ctx, "GetInboxNonblockLocal: sent unverified inbox successfully: %v", time.Now().Sub(start))
		case <-time.After(15 * time.Second):
			return res, fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
			return res, ctx.Err()
		}
	}

	// Consume localize callbacks and send out to UI.
	var wg sync.WaitGroup
	convLocalsCh := make(chan chat1.ConversationLocal, len(lres.InboxRes.ConvsUnverified))
	for convRes := range localizeCb {
		wg.Add(1)
		go func(convRes NonblockInboxResult) {
			if convRes.Err != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: *** error conv: id: %s err: %s",
					convRes.Conv.GetConvID(), convRes.Err.Message)
				chatUI.ChatInboxFailed(ctx, chat1.ChatInboxFailedArg{
					SessionID: arg.SessionID,
					ConvID:    convRes.Conv.GetConvID(),
					Error:     *convRes.Err,
				})

				// If we get a transient failure, add this to the retrier queue
				if convRes.Err.Typ == chat1.ConversationErrorType_TRANSIENT {
					h.G().FetchRetrier.Failure(ctx, uid.ToBytes(),
						NewConversationRetry(h.G(), convRes.Conv.GetConvID(),
							&convRes.Conv.Metadata.IdTriple.Tlfid, InboxLoad))
				}
			} else if convRes.ConvRes != nil {
				pconv := utils.PresentConversationLocal(*convRes.ConvRes)
				jbody, err := json.Marshal(pconv)
				if err != nil {
					h.Debug(ctx, "GetInboxNonblockLocal: failed to JSON conversation, skipping: %s",
						err.Error())
				} else {
					h.Debug(ctx, "GetInboxNonblockLocal: verified conv: id: %s tlf: %s bytes: %d",
						convRes.Conv.GetConvID(), convRes.ConvRes.Info.TLFNameExpanded(), len(jbody))
					chatUI.ChatInboxConversation(ctx, chat1.ChatInboxConversationArg{
						SessionID: arg.SessionID,
						Conv:      string(jbody),
					})
				}
				convLocalsCh <- *convRes.ConvRes

				// Send a note to the retrier that we actually loaded this guy successfully
				h.G().FetchRetrier.Success(ctx, uid.ToBytes(),
					NewConversationRetry(h.G(), convRes.Conv.GetConvID(),
						&convRes.Conv.Metadata.IdTriple.Tlfid, InboxLoad))
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
	if err = storage.NewInbox(h.G(), uid.ToBytes()).MergeLocalMetadata(ctx, convLocals); err != nil {
		// Don't abort the operaton on this kind of error
		h.Debug(ctx, "GetInboxNonblockLocal: unable to write inbox local metadata: %s", err)
	}

	res.Offline = h.G().InboxSource.IsOffline(ctx)
	res.IdentifyFailures = breaks
	return res, nil
}

func (h *Server) MarkAsReadLocal(ctx context.Context, arg chat1.MarkAsReadLocalArg) (res chat1.MarkAsReadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("MarkAsReadLocal(%s)", arg.ConversationID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.MarkAsReadLocalRes{}, err
	}
	uid := gregor1.UID(h.G().Env.GetUID().ToBytes())

	// Don't send remote mark as read if we somehow get this in the background.
	if h.G().AppState.State() != keybase1.AppState_FOREGROUND {
		h.Debug(ctx, "MarkAsReadLocal: not marking as read, app state not foreground: %v",
			h.G().AppState.State())
		return chat1.MarkAsReadLocalRes{
			Offline: h.G().Syncer.IsConnected(ctx),
		}, nil
	}

	// Check local copy to see if we have this convo, and have fully read it. If so, we skip the remote call
	_, readRes, _, err := storage.NewInbox(h.G(), uid).Read(ctx, &chat1.GetInboxQuery{
		ConvID: &arg.ConversationID,
	}, nil)
	if err == nil && len(readRes) > 0 && readRes[0].GetConvID().Eq(arg.ConversationID) &&
		readRes[0].Conv.ReaderInfo.ReadMsgid == readRes[0].Conv.ReaderInfo.MaxMsgid {
		h.Debug(ctx, "MarkAsReadLocal: conversation fully read: %s, not sending remote call",
			arg.ConversationID)
		return chat1.MarkAsReadLocalRes{
			Offline: h.G().Syncer.IsConnected(ctx),
		}, nil
	}

	rres, err := h.remoteClient().MarkAsRead(ctx, chat1.MarkAsReadArg{
		ConversationID: arg.ConversationID,
		MsgID:          arg.MsgID,
	})
	if err != nil {
		return res, err
	}
	return chat1.MarkAsReadLocalRes{
		Offline:    h.G().Syncer.IsConnected(ctx),
		RateLimits: utils.AggRateLimitsP([]*chat1.RateLimit{rres.RateLimit}),
	}, nil
}

// GetInboxAndUnboxLocal implements keybase.chatLocal.getInboxAndUnboxLocal protocol.
func (h *Server) GetInboxAndUnboxLocal(ctx context.Context, arg chat1.GetInboxAndUnboxLocalArg) (res chat1.GetInboxAndUnboxLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetInboxAndUnboxLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		err = libkb.LoginRequiredError{}
		return res, err
	}

	// Read inbox from the source
	localizer := NewBlockingLocalizer(h.G())
	ib, rl, err := h.G().InboxSource.Read(ctx, uid.ToBytes(), localizer, true, arg.Query,
		arg.Pagination)
	if err != nil {
		return res, err
	}

	res = chat1.GetInboxAndUnboxLocalRes{
		Conversations:    ib.Convs,
		Pagination:       ib.Pagination,
		Offline:          h.G().InboxSource.IsOffline(ctx),
		RateLimits:       utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
		IdentifyFailures: identBreaks,
	}

	return res, nil
}

func (h *Server) GetCachedThread(ctx context.Context, arg chat1.GetCachedThreadArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetCachedThread")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	// Get messages from local disk only
	uid := h.G().Env.GetUID()
	thread, err := h.G().ConvSource.PullLocalOnly(ctx, arg.ConversationID,
		gregor1.UID(uid.ToBytes()), arg.Query, arg.Pagination)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	return chat1.GetThreadLocalRes{
		Thread:           thread,
		Offline:          h.G().ConvSource.IsOffline(ctx),
		IdentifyFailures: identBreaks,
	}, nil
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *Server) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetThreadLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	// Xlate pager control into pagination if given
	if arg.Query != nil {
		arg.Pagination = utils.XlateMessageIDControlToPagination(arg.Query.MessageIDControl)
	}

	// Get messages from the source
	uid := h.G().Env.GetUID()
	thread, rl, err := h.G().ConvSource.Pull(ctx, arg.ConversationID,
		gregor1.UID(uid.ToBytes()), arg.Query, arg.Pagination)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	return chat1.GetThreadLocalRes{
		Thread:           thread,
		Offline:          h.G().ConvSource.IsOffline(ctx),
		RateLimits:       utils.AggRateLimitsP(rl),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) presentThreadView(ctx context.Context, uid gregor1.UID, tv chat1.ThreadView) (res chat1.UIMessages) {
	res.Pagination = utils.PresentPagination(tv.Pagination)
	for _, msg := range tv.Messages {
		res.Messages = append(res.Messages, utils.PresentMessageUnboxed(ctx, msg, uid,
			h.G().TeamChannelSource))
	}
	return res
}

func (h *Server) GetThreadNonblock(ctx context.Context, arg chat1.GetThreadNonblockArg) (res chat1.NonblockFetchRes, fullErr error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	uid := gregor1.UID(h.G().Env.GetUID().ToBytes())
	defer h.Trace(ctx, func() error { return fullErr },
		fmt.Sprintf("GetThreadNonblock(%s)", arg.ConversationID))()
	defer func() {
		fullErr = h.handleOfflineError(ctx, fullErr, &res)

		// Detect any problem loading the thread, and queue it up in the retrier if there is a problem.
		// Otherwise, send notice that we successfully loaded the conversation.
		if res.Offline || fullErr != nil {
			h.G().FetchRetrier.Failure(ctx, uid,
				NewConversationRetry(h.G(), arg.ConversationID, nil, ThreadLoad))
		} else {
			h.G().FetchRetrier.Success(ctx, uid,
				NewConversationRetry(h.G(), arg.ConversationID, nil, ThreadLoad))
		}
	}()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetThreadNonblock: result obtained offline")
		}
	}()
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	// Decode presentation form pagination
	pagination, err := utils.DecodePagination(arg.Pagination)
	if err != nil {
		return res, err
	}

	// Xlate pager control into pagination if given
	if arg.Query != nil {
		pagination = utils.XlateMessageIDControlToPagination(arg.Query.MessageIDControl)
	}

	// Grab local copy first
	chatUI := h.getChatUI(arg.SessionID)

	// Race the full operation versus the local one, so we don't lose anytime grabbing the local
	// version if they are roughly as fast. However, the full operation has preference, so if it does
	// win the race we don't send anything up from the local operation.
	var uilock sync.Mutex
	var wg sync.WaitGroup
	bctx, cancel := context.WithCancel(ctx)
	wg.Add(1)
	go func() {
		defer wg.Done()

		// Get local copy of the thread, abort the call if we have sent the full copy
		var resThread *chat1.ThreadView
		var localThread chat1.ThreadView
		ch := make(chan error, 1)
		go func() {
			var err error
			if h.cachedThreadDelay != nil {
				time.Sleep(*h.cachedThreadDelay)
			}
			localThread, err = h.G().ConvSource.PullLocalOnly(bctx, arg.ConversationID,
				uid, arg.Query, pagination)
			ch <- err
		}()
		select {
		case err := <-ch:
			if err != nil {
				h.Debug(ctx, "GetThreadNonblock: error running PullLocalOnly (sending miss): %s",
					err.Error())
			} else {
				resThread = &localThread
			}
		case <-bctx.Done():
			h.Debug(ctx, "GetThreadNonblock: context canceled before PullLocalOnly returned")
			return
		}

		uilock.Lock()
		defer uilock.Unlock()
		// Check this again, since we might have waited on the lock while full sent
		select {
		case <-bctx.Done():
			h.Debug(ctx, "GetThreadNonblock: context canceled before local copy sent")
			return
		default:
		}
		var pthread *string
		if resThread != nil {
			h.Debug(ctx, "GetThreadNonblock: sending cached response: %d messages", len(resThread.Messages))
			var jsonPt []byte
			var err error
			pt := h.presentThreadView(ctx, uid, *resThread)
			if jsonPt, err = json.Marshal(pt); err != nil {
				h.Debug(ctx, "GetThreadNonblock: failed to JSON cached response: %s", err)
				return
			}
			sJSONPt := string(jsonPt)
			pthread = &sJSONPt
		} else {
			h.Debug(ctx, "GetThreadNonblock: sending nil cached response")
		}
		chatUI.ChatThreadCached(bctx, chat1.ChatThreadCachedArg{
			SessionID: arg.SessionID,
			Thread:    pthread,
		})
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()

		// Run the full Pull operation, and redo pagination
		var remoteThread chat1.ThreadView
		var rl []*chat1.RateLimit
		remoteThread, rl, fullErr = h.G().ConvSource.Pull(bctx, arg.ConversationID,
			uid, arg.Query, pagination)
		if fullErr != nil {
			h.Debug(ctx, "GetThreadNonblock: error running Pull, returning error: %s", fullErr.Error())
			return
		}
		res.RateLimits = utils.AggRateLimitsP(rl)

		// Acquire lock and send up actual response
		h.Debug(ctx, "GetThreadNonblock: sending full response: %d messages", len(remoteThread.Messages))
		uilock.Lock()
		defer uilock.Unlock()
		uires := h.presentThreadView(bctx, uid, remoteThread)
		var jsonUIRes []byte
		if jsonUIRes, fullErr = json.Marshal(uires); fullErr != nil {
			h.Debug(ctx, "GetThreadNonblock: failed to JSON full result: %s", fullErr)
			return
		}
		chatUI.ChatThreadFull(bctx, chat1.ChatThreadFullArg{
			SessionID: arg.SessionID,
			Thread:    string(jsonUIRes),
		})

		// This means we transmitted with success, so cancel local thread
		cancel()
	}()
	wg.Wait()

	// Clean up context
	cancel()

	res.Offline = h.G().ConvSource.IsOffline(ctx)
	return res, fullErr
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
// Create a new conversation. Or in the case of CHAT, create-or-get a conversation.
func (h *Server) NewConversationLocal(ctx context.Context, arg chat1.NewConversationLocalArg) (res chat1.NewConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("NewConversationLocal(%s|%v)", arg.TlfName, arg.MembersType))()
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	uid := gregor1.UID(h.G().Env.GetUID().ToBytes())
	conv, rl, err := NewConversation(ctx, h.G(), uid, arg.TlfName, arg.TopicName,
		arg.TopicType, arg.MembersType, arg.TlfVisibility, h.remoteClient)
	if err != nil {
		return res, err
	}

	res.Conv = conv
	res.RateLimits = utils.AggRateLimits(rl)
	res.IdentifyFailures = identBreaks
	return res, nil
}

func (h *Server) GetInboxSummaryForCLILocal(ctx context.Context, arg chat1.GetInboxSummaryForCLILocalQuery) (res chat1.GetInboxSummaryForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetInboxSummaryForCLILocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxSummaryForCLILocalRes{}, err
	}

	var after time.Time
	if len(arg.After) > 0 {
		after, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.After)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.After, err)
		}
	}
	var before time.Time
	if len(arg.Before) > 0 {
		before, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.Before)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.Before, err)
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
		query := queryBase
		query.UnreadOnly, query.ReadOnly = true, false
		if gires, err = h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Pagination:       &chat1.Pagination{Num: arg.UnreadFirstLimit.AtMost},
			Query:            &query,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}); err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
		res.RateLimits = append(res.RateLimits, gires.RateLimits...)
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
			res.RateLimits = append(res.RateLimits, gires.RateLimits...)
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
		res.RateLimits = append(res.RateLimits, gires.RateLimits...)
		res.Conversations = gires.Conversations
	}

	res.Offline = gires.Offline
	res.RateLimits = utils.AggRateLimits(res.RateLimits)

	return res, nil
}

func (h *Server) GetConversationForCLILocal(ctx context.Context, arg chat1.GetConversationForCLILocalQuery) (res chat1.GetConversationForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetConversationForCLILocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetConversationForCLILocalRes{}, err
	}

	var rlimits []chat1.RateLimit

	if arg.Limit.AtMost <= 0 {
		arg.Limit.AtMost = int(^uint(0) >> 1) // maximum int
	}

	convLocal := arg.Conv

	var since time.Time
	if arg.Since != nil {
		since, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), *arg.Since)
		if err != nil {
			return chat1.GetConversationForCLILocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", *arg.Since, since)
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
	rlimits = append(rlimits, tv.RateLimits...)

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
		RateLimits:   utils.AggRateLimits(rlimits),
	}, nil
}

func (h *Server) GetMessagesLocal(ctx context.Context, arg chat1.GetMessagesLocalArg) (res chat1.GetMessagesLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetMessagesLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	deflt := chat1.GetMessagesLocalRes{}

	if err := h.assertLoggedIn(ctx); err != nil {
		return deflt, err
	}

	var rlimits []chat1.RateLimit

	// if arg.ConversationID is a finalized TLF, the TLF name in boxed.Msgs
	// could need expansion.  Look up the conversation metadata.
	uid := h.G().Env.GetUID()
	conv, rl, err := GetUnverifiedConv(ctx, h.G(), uid.ToBytes(), arg.ConversationID, true)
	if err != nil {
		return deflt, err
	}
	if rl != nil {
		rlimits = append(rlimits, *rl)
	}

	// use ConvSource to get the messages, to try the cache first
	messages, err := h.G().ConvSource.GetMessages(ctx, conv, uid.ToBytes(), arg.MessageIDs)
	if err != nil {
		return deflt, err
	}

	// unless arg says not to, transform the superseded messages
	if !arg.DisableResolveSupersedes {
		messages, err = h.G().ConvSource.TransformSupersedes(ctx, conv, uid.ToBytes(), messages)
		if err != nil {
			return deflt, err
		}
	}

	return chat1.GetMessagesLocalRes{
		Messages:         messages,
		Offline:          h.G().ConvSource.IsOffline(ctx),
		RateLimits:       utils.AggRateLimits(rlimits),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) SetConversationStatusLocal(ctx context.Context, arg chat1.SetConversationStatusLocalArg) (res chat1.SetConversationStatusLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetConversationStatusLocal")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}

	var rlimits []chat1.RateLimit
	scsres, err := h.remoteClient().SetConversationStatus(ctx, chat1.SetConversationStatusArg{
		ConversationID: arg.ConversationID,
		Status:         arg.Status,
	})
	if err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}
	if scsres.RateLimit != nil {
		rlimits = append(rlimits, *scsres.RateLimit)
	}

	// Send word to API server about the report
	if arg.Status == chat1.ConversationStatus_REPORTED {
		h.Debug(ctx, "SetConversationStatusLocal: sending report to server")

		tlfname := "<error fetching TLF name>"

		// Get TLF name to post
		uid := h.G().Env.GetUID()
		ib, rl, err := h.G().InboxSource.Read(ctx, uid.ToBytes(), nil, true, &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{arg.ConversationID},
		}, nil)
		if err != nil {
			h.Debug(ctx, "SetConversationStatusLocal: failed to fetch conversation: %s", err.Error())
		} else {
			if len(ib.Convs) > 0 {
				tlfname = ib.Convs[0].Info.TLFNameExpanded()
			}
			if rl != nil {
				rlimits = append(rlimits, *rl)
			}
		}

		args := libkb.NewHTTPArgs()
		args.Add("tlfname", libkb.S{Val: tlfname})
		_, err = h.G().API.Post(libkb.APIArg{
			Endpoint:    "report/conversation",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args:        args,
		})
		if err != nil {
			h.Debug(ctx, "SetConversationStatusLocal: failed to post report: %s", err.Error())
		}
	}

	return chat1.SetConversationStatusLocalRes{
		RateLimits:       rlimits,
		IdentifyFailures: identBreaks,
	}, nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *Server) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostLocal")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.PostLocalRes{}, err
	}
	uid := h.G().Env.GetUID()

	// Sanity check that we have a TLF name here
	if len(arg.Msg.ClientHeader.TlfName) == 0 {
		h.Debug(ctx, "PostLocal: no TLF name specified: convID: %s uid: %s",
			arg.ConversationID, uid)
		return chat1.PostLocalRes{}, fmt.Errorf("no TLF name specified")
	}

	// Make sure sender is set
	db := make([]byte, 16)
	deviceID := h.G().Env.GetDeviceID()
	if err = deviceID.ToBytes(db); err != nil {
		return chat1.PostLocalRes{}, err
	}
	arg.Msg.ClientHeader.Sender = uid.ToBytes()
	arg.Msg.ClientHeader.SenderDevice = gregor1.DeviceID(db)

	sender := NewBlockingSender(h.G(), h.boxer, h.store, h.remoteClient)

	_, msgBoxed, rl, err := sender.Send(ctx, arg.ConversationID, arg.Msg, 0, nil)
	if err != nil {
		h.Debug(ctx, "PostLocal: unable to send message: %s", err.Error())
		return chat1.PostLocalRes{}, err
	}

	return chat1.PostLocalRes{
		RateLimits:       utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
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

func (h *Server) PostEditNonblock(ctx context.Context, arg chat1.PostEditNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_EDIT
	parg.Msg.ClientHeader.Supersedes = arg.Supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
		MessageID: arg.Supersedes,
		Body:      arg.Body,
	})

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostTextNonblock(ctx context.Context, arg chat1.PostTextNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_TEXT
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: arg.Body,
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

func (h *Server) GenerateOutboxID(ctx context.Context) (res chat1.OutboxID, err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GenerateOutboxID")()
	return storage.NewOutboxID()
}

func (h *Server) PostLocalNonblock(ctx context.Context, arg chat1.PostLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostLocalNonblock")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.PostLocalNonblockRes{}, err
	}
	uid := h.G().Env.GetUID()

	// Sanity check that we have a TLF name here
	if len(arg.Msg.ClientHeader.TlfName) == 0 {
		h.Debug(ctx, "PostLocalNonblock: no TLF name specified: convID: %s uid: %s",
			arg.ConversationID, uid)
		return chat1.PostLocalNonblockRes{}, fmt.Errorf("no TLF name specified")
	}

	// Add outbox information
	var prevMsgID chat1.MessageID
	if arg.ClientPrev == 0 {
		h.Debug(ctx, "PostLocalNonblock: ClientPrev not specified using local storage")
		thread, err := h.G().ConvSource.PullLocalOnly(ctx, arg.ConversationID, uid.ToBytes(), nil,
			&chat1.Pagination{Num: 1})
		if err != nil || len(thread.Messages) == 0 {
			h.Debug(ctx, "PostLocalNonblock: unable to read local storage, setting ClientPrev to 1")
			prevMsgID = 1
		} else {
			prevMsgID = thread.Messages[0].GetMessageID()
		}
	} else {
		prevMsgID = arg.ClientPrev
	}
	h.Debug(ctx, "PostLocalNonblock: using prevMsgID: %d", prevMsgID)
	arg.Msg.ClientHeader.OutboxInfo = &chat1.OutboxInfo{
		Prev: prevMsgID,
	}

	// Create non block sender
	sender := NewBlockingSender(h.G(), h.boxer, h.store, h.remoteClient)
	nonblockSender := NewNonblockingSender(h.G(), sender)

	obid, _, rl, err := nonblockSender.Send(ctx, arg.ConversationID, arg.Msg, arg.ClientPrev, arg.OutboxID)
	if err != nil {
		return chat1.PostLocalNonblockRes{},
			fmt.Errorf("PostLocalNonblock: unable to send message: err: %s", err.Error())
	}
	h.Debug(ctx, "PostLocalNonblock: using outboxID: %s", obid)

	return chat1.PostLocalNonblockRes{
		OutboxID:         obid,
		RateLimits:       utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
		IdentifyFailures: identBreaks,
	}, nil
}

// MakePreview implements chat1.LocalInterface.MakePreview.
func (h *Server) MakePreview(ctx context.Context, arg chat1.MakePreviewArg) (res chat1.MakePreviewRes, err error) {
	defer h.Trace(ctx, func() error { return err }, "MakePreview")()
	src, err := newFileSource(arg.Attachment)
	if err != nil {
		return chat1.MakePreviewRes{}, err
	}
	defer src.Close()
	pre, err := h.preprocessAsset(ctx, arg.SessionID, src, nil)
	if err != nil {
		return chat1.MakePreviewRes{}, err
	}

	res = chat1.MakePreviewRes{
		MimeType: pre.ContentType,
	}

	if pre.Preview != nil {
		f, err := ioutil.TempFile(arg.OutputDir, "prev")
		if err != nil {
			return res, err
		}
		buf := pre.Preview.Bytes()
		n, err := f.Write(buf)
		f.Close()
		if err != nil {
			return res, err
		}
		if n != len(buf) {
			return res, io.ErrShortWrite
		}
		name := f.Name()
		if strings.HasPrefix(pre.ContentType, "image/") {
			suffix := strings.TrimPrefix(pre.ContentType, "image/")
			suffixName := name + "." + suffix
			h.Debug(ctx, "renaming preview file %q to %q", name, suffixName)
			if err := os.Rename(name, suffixName); err != nil {
				return res, err
			}
			name = suffixName
		}
		res.Filename = &name

		md := pre.PreviewMetadata()
		var empty chat1.AssetMetadata
		if md != empty {
			res.Metadata = &md
		}

		baseMd := pre.BaseMetadata()
		if baseMd != empty {
			res.BaseMetadata = &baseMd
		}
	}

	return res, nil
}

// PostAttachmentLocal implements chat1.LocalInterface.PostAttachmentLocal.
func (h *Server) PostAttachmentLocal(ctx context.Context, arg chat1.PostAttachmentLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostAttachmentLocal")()
	parg := postAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		TlfName:          arg.TlfName,
		Visibility:       arg.Visibility,
		Attachment:       newStreamSource(arg.Attachment),
		Title:            arg.Title,
		Metadata:         arg.Metadata,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	defer parg.Attachment.Close()

	if arg.Preview != nil {
		parg.Preview = new(attachmentPreview)
		if arg.Preview.Filename != nil {
			parg.Preview.source, err = newFileSource(chat1.LocalFileSource{
				Filename: *arg.Preview.Filename,
			})
			if err != nil {
				return res, err
			}
		}
		if arg.Preview.Metadata != nil {
			parg.Preview.md = arg.Preview.Metadata
		}
		if arg.Preview.BaseMetadata != nil {
			parg.Preview.baseMd = arg.Preview.BaseMetadata
		}
		parg.Preview.mimeType = arg.Preview.MimeType
		defer parg.Preview.source.Close()
	}

	return h.postAttachmentLocal(ctx, parg)
}

// PostFileAttachmentLocal implements chat1.LocalInterface.PostFileAttachmentLocal.
func (h *Server) PostFileAttachmentLocal(ctx context.Context, arg chat1.PostFileAttachmentLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostFileAttachmentLocal")()
	parg := postAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		TlfName:          arg.TlfName,
		Visibility:       arg.Visibility,
		Title:            arg.Title,
		Metadata:         arg.Metadata,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	asrc, err := newFileSource(arg.Attachment)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}
	parg.Attachment = asrc
	defer parg.Attachment.Close()

	if arg.Preview != nil {
		parg.Preview = new(attachmentPreview)
		if arg.Preview.Filename != nil && *arg.Preview.Filename != "" {
			parg.Preview.source, err = newFileSource(chat1.LocalFileSource{
				Filename: *arg.Preview.Filename,
			})
			if err != nil {
				return res, err
			}
			defer parg.Preview.source.Close()
		}
		if arg.Preview.Metadata != nil {
			parg.Preview.md = arg.Preview.Metadata
		}
		if arg.Preview.BaseMetadata != nil {
			parg.Preview.baseMd = arg.Preview.BaseMetadata
		}
		parg.Preview.mimeType = arg.Preview.MimeType
	}

	return h.postAttachmentLocal(ctx, parg)
}

type attachmentPreview struct {
	source   assetSource
	mimeType string
	md       *chat1.AssetMetadata
	baseMd   *chat1.AssetMetadata
}

// postAttachmentArg is a shared arg struct for the multiple PostAttachment* endpoints
type postAttachmentArg struct {
	SessionID        int
	ConversationID   chat1.ConversationID
	TlfName          string
	Visibility       keybase1.TLFVisibility
	Attachment       assetSource
	Preview          *attachmentPreview
	Title            string
	Metadata         []byte
	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

func (h *Server) postAttachmentLocal(ctx context.Context, arg postAttachmentArg) (res chat1.PostLocalRes, err error) {
	if os.Getenv("KEYBASE_CHAT_ATTACHMENT_UNORDERED") == "" {
		return h.postAttachmentLocalInOrder(ctx, arg)
	}

	if os.Getenv("CHAT_S3_FAKE") == "1" {
		ctx = s3.NewFakeS3Context(ctx)
	}
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int64) {
		parg := chat1.ChatAttachmentUploadProgressArg{
			SessionID:     arg.SessionID,
			BytesComplete: bytesComplete,
			BytesTotal:    bytesTotal,
		}
		chatUI.ChatAttachmentUploadProgress(ctx, parg)
	}

	// preprocess asset (get content type, create preview if possible)
	pre, err := h.preprocessAsset(ctx, arg.SessionID, arg.Attachment, arg.Preview)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}
	if pre.Preview != nil {
		h.Debug(ctx, "postAttachmentLocal: created preview in preprocess")
		md := pre.PreviewMetadata()
		baseMd := pre.BaseMetadata()
		arg.Preview = &attachmentPreview{
			source:   pre.Preview,
			md:       &md,
			baseMd:   &baseMd,
			mimeType: pre.PreviewContentType,
		}
	}

	// get s3 upload params from server
	params, err := h.remoteClient().GetS3Params(ctx, arg.ConversationID)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}

	// upload attachment and (optional) preview concurrently
	var object chat1.Asset
	var preview *chat1.Asset
	var g errgroup.Group

	h.Debug(ctx, "postAttachmentLocal: uploading assets")
	g.Go(func() error {
		chatUI.ChatAttachmentUploadStart(ctx, pre.BaseMetadata(), 0)
		var err error
		object, err = h.uploadAsset(ctx, arg.SessionID, params, arg.Attachment, arg.ConversationID, progress)
		chatUI.ChatAttachmentUploadDone(ctx)
		if err != nil {
			h.Debug(ctx, "postAttachmentLocal: error uploading primary asset to s3: %s", err)
		}
		return err
	})

	if arg.Preview != nil && arg.Preview.source != nil {
		g.Go(func() error {
			chatUI.ChatAttachmentPreviewUploadStart(ctx, pre.PreviewMetadata())
			// copy the params so as not to mess with the main params above
			previewParams := params

			// add preview suffix to object key (P in hex)
			// the s3path in gregor is expecting hex here
			previewParams.ObjectKey += "50"
			prev, err := h.uploadAsset(ctx, arg.SessionID, previewParams, arg.Preview.source, arg.ConversationID, nil)
			chatUI.ChatAttachmentPreviewUploadDone(ctx)
			if err == nil {
				preview = &prev
			} else {
				h.Debug(ctx, "postAttachmentLocal: error uploading preview asset to s3: %s", err)
			}
			return err
		})
	} else {
		g.Go(func() error {
			chatUI.ChatAttachmentPreviewUploadStart(ctx, chat1.AssetMetadata{})
			chatUI.ChatAttachmentPreviewUploadDone(ctx)
			return nil
		})
	}

	h.Debug(ctx, "postAttachmentLocal: waiting for frontend")
	if err := g.Wait(); err != nil {
		return chat1.PostLocalRes{}, err
	}
	h.Debug(ctx, "postAttachmentLocal: frontend returned")

	// note that we only want to set the Title to what the user entered,
	// even if that is nothing.
	object.Title = arg.Title
	object.MimeType = pre.ContentType
	object.Metadata = pre.BaseMetadata()

	attachment := chat1.MessageAttachment{
		Object:   object,
		Metadata: arg.Metadata,
		Uploaded: true,
	}
	if preview != nil {
		h.Debug(ctx, "postAttachmentLocal: attachment preview asset added")
		preview.Title = arg.Title
		preview.MimeType = pre.PreviewContentType
		preview.Metadata = pre.PreviewMetadata()
		preview.Tag = chat1.AssetTag_PRIMARY
		attachment.Previews = []chat1.Asset{*preview}
		attachment.Preview = preview
	}

	// edit the placeholder  attachment message with the asset information
	postArg := chat1.PostLocalArg{
		ConversationID: arg.ConversationID,
		Msg: chat1.MessagePlaintext{
			MessageBody: chat1.NewMessageBodyWithAttachment(attachment),
		},
		IdentifyBehavior: arg.IdentifyBehavior,
	}

	// set msg client header explicitly
	postArg.Msg.ClientHeader.MessageType = chat1.MessageType_ATTACHMENT
	postArg.Msg.ClientHeader.TlfName = arg.TlfName
	postArg.Msg.ClientHeader.TlfPublic = arg.Visibility == keybase1.TLFVisibility_PUBLIC

	h.Debug(ctx, "postAttachmentLocal: attachment assets uploaded, posting attachment message")
	plres, err := h.PostLocal(ctx, postArg)
	if err != nil {
		h.Debug(ctx, "postAttachmentLocal: error posting attachment message: %s", err)
	} else {
		h.Debug(ctx, "postAttachmentLocal: posted attachment message successfully")
	}

	return plres, err
}

func (h *Server) postAttachmentLocalInOrder(ctx context.Context, arg postAttachmentArg) (res chat1.PostLocalRes, err error) {
	h.Debug(ctx, "postAttachmentLocalInOrder: using postAttachmentLocalInOrder flow to upload attachment")
	if os.Getenv("CHAT_S3_FAKE") == "1" {
		ctx = s3.NewFakeS3Context(ctx)
	}
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int64) {
		parg := chat1.ChatAttachmentUploadProgressArg{
			SessionID:     arg.SessionID,
			BytesComplete: bytesComplete,
			BytesTotal:    bytesTotal,
		}
		chatUI.ChatAttachmentUploadProgress(ctx, parg)
	}

	// preprocess asset (get content type, create preview if possible)
	pre, err := h.preprocessAsset(ctx, arg.SessionID, arg.Attachment, arg.Preview)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}
	if pre.Preview != nil {
		h.Debug(ctx, "postAttachmentLocalInOrder: created preview in preprocess")
		md := pre.PreviewMetadata()
		baseMd := pre.BaseMetadata()
		arg.Preview = &attachmentPreview{
			source:   pre.Preview,
			md:       &md,
			baseMd:   &baseMd,
			mimeType: pre.PreviewContentType,
		}
	}

	// Send a placeholder attachment message that will
	// be edited after the assets are uploaded.  Sending
	// it now to preserve the order of send messages.
	placeholder, err := h.postAttachmentPlaceholder(ctx, arg)
	if err != nil {
		return placeholder, err
	}
	h.Debug(ctx, "postAttachmentLocalInOrder: placeholder message id: %v", placeholder.MessageID)

	// if there are any errors going forward, delete the placeholder message
	defer func() {
		if err == nil {
			return
		}

		h.Debug(ctx, "postAttachmentLocalInOrder: error after placeholder message sent, deleting placeholder message")
		deleteArg := chat1.PostDeleteNonblockArg{
			ConversationID:   arg.ConversationID,
			IdentifyBehavior: arg.IdentifyBehavior,
			Supersedes:       placeholder.MessageID,
			TlfName:          arg.TlfName,
			TlfPublic:        arg.Visibility == keybase1.TLFVisibility_PUBLIC,
		}
		_, derr := h.PostDeleteNonblock(ctx, deleteArg)
		if derr != nil {
			h.Debug(ctx, "error deleting placeholder message: %s", derr)
		}
	}()

	// get s3 upload params from server
	params, err := h.remoteClient().GetS3Params(ctx, arg.ConversationID)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}

	// upload attachment and (optional) preview concurrently
	var object chat1.Asset
	var preview *chat1.Asset
	var g errgroup.Group

	h.Debug(ctx, "postAttachmentLocalInOrder: uploading assets")
	g.Go(func() error {
		chatUI.ChatAttachmentUploadStart(ctx, pre.BaseMetadata(), placeholder.MessageID)
		var err error
		object, err = h.uploadAsset(ctx, arg.SessionID, params, arg.Attachment, arg.ConversationID, progress)
		chatUI.ChatAttachmentUploadDone(ctx)
		if err != nil {
			h.Debug(ctx, "postAttachmentLocalInOrder: error uploading primary asset to s3: %s", err)
		}
		return err
	})

	if arg.Preview != nil && arg.Preview.source != nil {
		g.Go(func() error {
			chatUI.ChatAttachmentPreviewUploadStart(ctx, pre.PreviewMetadata())
			// copy the params so as not to mess with the main params above
			previewParams := params

			// add preview suffix to object key (P in hex)
			// the s3path in gregor is expecting hex here
			previewParams.ObjectKey += "50"
			prev, err := h.uploadAsset(ctx, arg.SessionID, previewParams, arg.Preview.source, arg.ConversationID, nil)
			chatUI.ChatAttachmentPreviewUploadDone(ctx)
			if err == nil {
				preview = &prev
			} else {
				h.Debug(ctx, "postAttachmentLocalInOrder: error uploading preview asset to s3: %s", err)
			}
			return err
		})
	} else {
		g.Go(func() error {
			chatUI.ChatAttachmentPreviewUploadStart(ctx, chat1.AssetMetadata{})
			chatUI.ChatAttachmentPreviewUploadDone(ctx)
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return chat1.PostLocalRes{}, err
	}

	// note that we only want to set the Title to what the user entered,
	// even if that is nothing.
	object.Title = arg.Title
	object.MimeType = pre.ContentType
	object.Metadata = pre.BaseMetadata()

	uploaded := chat1.MessageAttachmentUploaded{
		MessageID: placeholder.MessageID,
		Object:    object,
		Metadata:  arg.Metadata,
	}
	if preview != nil {
		preview.Title = arg.Title
		preview.MimeType = pre.PreviewContentType
		preview.Metadata = pre.PreviewMetadata()
		preview.Tag = chat1.AssetTag_PRIMARY
		uploaded.Previews = []chat1.Asset{*preview}
	}

	// edit the placeholder  attachment message with the asset information
	postArg := chat1.PostLocalArg{
		ConversationID: arg.ConversationID,
		Msg: chat1.MessagePlaintext{
			MessageBody: chat1.NewMessageBodyWithAttachmentuploaded(uploaded),
		},
		IdentifyBehavior: arg.IdentifyBehavior,
	}

	// set msg client header explicitly
	postArg.Msg.ClientHeader.MessageType = chat1.MessageType_ATTACHMENTUPLOADED
	postArg.Msg.ClientHeader.Supersedes = placeholder.MessageID
	postArg.Msg.ClientHeader.TlfName = arg.TlfName
	postArg.Msg.ClientHeader.TlfPublic = arg.Visibility == keybase1.TLFVisibility_PUBLIC

	h.Debug(ctx, "postAttachmentLocalInOrder: attachment assets uploaded, posting attachment message")
	plres, err := h.PostLocal(ctx, postArg)
	if err != nil {
		h.Debug(ctx, "postAttachmentLocalInOrder: error posting attachment message: %s", err)
	} else {
		h.Debug(ctx, "postAttachmentLocalInOrder: posted attachment message successfully")
	}

	return plres, err
}

// DownloadAttachmentLocal implements chat1.LocalInterface.DownloadAttachmentLocal.
func (h *Server) DownloadAttachmentLocal(ctx context.Context, arg chat1.DownloadAttachmentLocalArg) (res chat1.DownloadAttachmentLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "DownloadAttachmentLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	darg := downloadAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		MessageID:        arg.MessageID,
		Preview:          arg.Preview,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	cli := h.getStreamUICli()
	darg.Sink = libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)

	return h.downloadAttachmentLocal(ctx, darg)
}

// DownloadFileAttachmentLocal implements chat1.LocalInterface.DownloadFileAttachmentLocal.
func (h *Server) DownloadFileAttachmentLocal(ctx context.Context, arg chat1.DownloadFileAttachmentLocalArg) (res chat1.DownloadAttachmentLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "DownloadFileAttachmentLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	darg := downloadAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		MessageID:        arg.MessageID,
		Preview:          arg.Preview,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	sink, err := os.OpenFile(arg.Filename, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}
	darg.Sink = sink

	return h.downloadAttachmentLocal(ctx, darg)
}

type downloadAttachmentArg struct {
	SessionID        int
	ConversationID   chat1.ConversationID
	MessageID        chat1.MessageID
	Sink             io.WriteCloser
	Preview          bool
	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

func (h *Server) downloadAttachmentLocal(ctx context.Context, arg downloadAttachmentArg) (chat1.DownloadAttachmentLocalRes, error) {

	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int64) {
		parg := chat1.ChatAttachmentDownloadProgressArg{
			SessionID:     arg.SessionID,
			BytesComplete: bytesComplete,
			BytesTotal:    bytesTotal,
		}
		chatUI.ChatAttachmentDownloadProgress(ctx, parg)
	}

	// get s3 params from server
	params, err := h.remoteClient().GetS3Params(ctx, arg.ConversationID)
	if err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}

	attachment, limits, err := h.attachmentMessage(ctx, arg.ConversationID, arg.MessageID, arg.IdentifyBehavior)
	if err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}

	obj := attachment.Object
	if arg.Preview {
		if len(attachment.Previews) > 0 {
			obj = attachment.Previews[0]
		} else if attachment.Preview != nil {
			obj = *attachment.Preview
		} else {
			return chat1.DownloadAttachmentLocalRes{}, errors.New("no preview in attachment")
		}
		h.Debug(ctx, "downloading preview attachment asset")
	}
	chatUI.ChatAttachmentDownloadStart(ctx)
	if err := h.store.DownloadAsset(ctx, params, obj, arg.Sink, h, progress); err != nil {
		arg.Sink.Close()
		return chat1.DownloadAttachmentLocalRes{}, err
	}

	if err := arg.Sink.Close(); err != nil {
		return chat1.DownloadAttachmentLocalRes{}, err
	}

	chatUI.ChatAttachmentDownloadDone(ctx)

	return chat1.DownloadAttachmentLocalRes{
		RateLimits:       limits,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) CancelPost(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "CancelPost")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return err
	}

	uid := h.G().Env.GetUID()
	outbox := storage.NewOutbox(h.G(), uid.ToBytes())
	return outbox.RemoveMessage(ctx, outboxID)
}

func (h *Server) RetryPost(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "RetryPost")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return err
	}

	// Mark as retry in the outbox
	uid := h.G().Env.GetUID()
	outbox := storage.NewOutbox(h.G(), uid.ToBytes())
	if err = outbox.RetryMessage(ctx, outboxID); err != nil {
		return err
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

func (h *Server) assertLoggedIn(ctx context.Context) error {
	if !h.G().ActiveDevice.HaveKeys() {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (h *Server) assertLoggedInUID(ctx context.Context) (uid gregor1.UID, err error) {
	if !h.G().ActiveDevice.HaveKeys() {
		return uid, libkb.LoginRequiredError{}
	}
	k1uid := h.G().Env.GetUID()
	if k1uid.IsNil() {
		return uid, libkb.LoginRequiredError{}
	}
	return gregor1.UID(k1uid.ToBytes()), nil
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (h *Server) Sign(payload []byte) ([]byte, error) {
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return h.remoteClient().S3Sign(context.Background(), arg)
}

func (h *Server) postAttachmentPlaceholder(ctx context.Context, arg postAttachmentArg) (chat1.PostLocalRes, error) {
	// generate outbox id
	rbs, err := libkb.RandBytes(8)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}
	obid := chat1.OutboxID(rbs)
	chatUI := h.getChatUI(arg.SessionID)
	chatUI.ChatAttachmentUploadOutboxID(ctx, chat1.ChatAttachmentUploadOutboxIDArg{SessionID: arg.SessionID, OutboxID: obid})

	attachment := chat1.MessageAttachment{
		Metadata: arg.Metadata,
		Object: chat1.Asset{
			Title: arg.Title,
		},
	}
	if arg.Preview != nil {
		asset := chat1.Asset{
			MimeType: arg.Preview.mimeType,
		}
		if arg.Preview.md != nil {
			asset.Metadata = *arg.Preview.md
		}
		attachment.Previews = []chat1.Asset{asset}
	}
	postArg := chat1.PostLocalArg{
		ConversationID: arg.ConversationID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				TlfName:     arg.TlfName,
				TlfPublic:   arg.Visibility == keybase1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_ATTACHMENT,
				OutboxID:    &obid,
			},
			MessageBody: chat1.NewMessageBodyWithAttachment(attachment),
		},
		IdentifyBehavior: arg.IdentifyBehavior,
	}

	h.Debug(ctx, "posting attachment placeholder message")
	res, err := h.PostLocal(ctx, postArg)
	if err != nil {
		h.Debug(ctx, "error posting attachment placeholder message: %s", err)
	} else {
		h.Debug(ctx, "posted attachment placeholder message successfully")
	}

	return res, err

}

type dimension struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

func (d *dimension) Empty() bool {
	return d.Width == 0 && d.Height == 0
}

func (d *dimension) Encode() string {
	if d.Width == 0 && d.Height == 0 {
		return ""
	}
	enc, err := json.Marshal(d)
	if err != nil {
		return ""
	}
	return string(enc)
}

type preprocess struct {
	ContentType        string
	Preview            *BufferSource
	PreviewContentType string
	BaseDim            *dimension
	BaseDurationMs     int
	PreviewDim         *dimension
	PreviewDurationMs  int
}

func (p *preprocess) BaseMetadata() chat1.AssetMetadata {
	if p.BaseDim == nil || p.BaseDim.Empty() {
		return chat1.AssetMetadata{}
	}
	if p.BaseDurationMs > 0 {
		return chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{Width: p.BaseDim.Width, Height: p.BaseDim.Height, DurationMs: p.BaseDurationMs})
	}
	return chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{Width: p.BaseDim.Width, Height: p.BaseDim.Height})
}

func (p *preprocess) PreviewMetadata() chat1.AssetMetadata {
	if p.PreviewDim == nil || p.PreviewDim.Empty() {
		return chat1.AssetMetadata{}
	}
	if p.PreviewDurationMs > 0 {
		return chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{Width: p.PreviewDim.Width, Height: p.PreviewDim.Height, DurationMs: p.PreviewDurationMs})
	}
	return chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{Width: p.PreviewDim.Width, Height: p.PreviewDim.Height})
}

func (h *Server) preprocessAsset(ctx context.Context, sessionID int, attachment assetSource, preview *attachmentPreview) (*preprocess, error) {
	// create a buffered stream
	cli := h.getStreamUICli()
	src, err := attachment.Open(sessionID, cli)
	if err != nil {
		return nil, err
	}
	defer src.Reset()

	head := make([]byte, 512)
	_, err = io.ReadFull(src, head)
	if err != nil && err != io.ErrUnexpectedEOF {
		return nil, err
	}

	p := preprocess{
		ContentType: http.DetectContentType(head),
	}

	h.Debug(ctx, "detected attachment content type %s", p.ContentType)

	if preview == nil {
		h.Debug(ctx, "no attachment preview included by client, seeing if possible to generate")
		src.Reset()
		previewRes, err := Preview(ctx, h.G().Log, src, p.ContentType, attachment.Basename(), attachment.FileSize())
		if err != nil {
			h.Debug(ctx, "error making preview: %s", err)
			return nil, err
		}
		if previewRes != nil {
			h.Debug(ctx, "made preview for attachment asset")
			p.Preview = previewRes.Source
			p.PreviewContentType = previewRes.ContentType
			if previewRes.BaseWidth > 0 || previewRes.BaseHeight > 0 {
				p.BaseDim = &dimension{Width: previewRes.BaseWidth, Height: previewRes.BaseHeight}
			}
			if previewRes.PreviewWidth > 0 || previewRes.PreviewHeight > 0 {
				p.PreviewDim = &dimension{Width: previewRes.PreviewWidth, Height: previewRes.PreviewHeight}
			}
			p.BaseDurationMs = previewRes.BaseDurationMs
			p.PreviewDurationMs = previewRes.PreviewDurationMs
		}
	} else {
		h.Debug(ctx, "attachment preview info provided, populating metadata")
		p.PreviewContentType = preview.mimeType
		if preview.md != nil {
			typ, err := preview.md.AssetType()
			if err != nil {
				return nil, err
			}
			switch typ {
			case chat1.AssetMetadataType_IMAGE:
				p.PreviewDim = &dimension{Width: preview.md.Image().Width, Height: preview.md.Image().Height}
			case chat1.AssetMetadataType_VIDEO:
				p.PreviewDurationMs = preview.md.Video().DurationMs
				p.PreviewDim = &dimension{Width: preview.md.Video().Width, Height: preview.md.Video().Height}
			case chat1.AssetMetadataType_AUDIO:
				p.PreviewDurationMs = preview.md.Audio().DurationMs
			}
		}
		if preview.baseMd != nil {
			typ, err := preview.baseMd.AssetType()
			if err != nil {
				return nil, err
			}
			switch typ {
			case chat1.AssetMetadataType_IMAGE:
				p.BaseDim = &dimension{Width: preview.baseMd.Image().Width, Height: preview.baseMd.Image().Height}
			case chat1.AssetMetadataType_VIDEO:
				p.BaseDurationMs = preview.baseMd.Video().DurationMs
				p.BaseDim = &dimension{Width: preview.baseMd.Video().Width, Height: preview.baseMd.Video().Height}
			case chat1.AssetMetadataType_AUDIO:
				p.BaseDurationMs = preview.baseMd.Audio().DurationMs
			}
		}
	}

	return &p, nil
}

func (h *Server) uploadAsset(ctx context.Context, sessionID int, params chat1.S3Params, local assetSource, conversationID chat1.ConversationID, progress ProgressReporter) (chat1.Asset, error) {
	// create a buffered stream
	cli := h.getStreamUICli()
	src, err := local.Open(sessionID, cli)
	if err != nil {
		return chat1.Asset{}, err
	}

	task := UploadTask{
		S3Params:       params,
		Filename:       local.Basename(),
		FileSize:       local.FileSize(),
		Plaintext:      src,
		S3Signer:       h,
		ConversationID: conversationID,
		UserID:         h.G().Env.GetUID(),
		Progress:       progress,
	}
	return h.store.UploadAsset(ctx, &task)
}

func (h *Server) attachmentMessage(ctx context.Context, conversationID chat1.ConversationID, msgID chat1.MessageID, idBehavior keybase1.TLFIdentifyBehavior) (*chat1.MessageAttachment, []chat1.RateLimit, error) {
	arg := chat1.GetMessagesLocalArg{
		ConversationID:   conversationID,
		MessageIDs:       []chat1.MessageID{msgID},
		IdentifyBehavior: idBehavior,
	}
	msgs, err := h.GetMessagesLocal(ctx, arg)
	if err != nil {
		return nil, nil, err
	}
	if len(msgs.Messages) == 0 {
		return nil, nil, libkb.NotFoundError{}
	}
	first := msgs.Messages[0]

	st, err := first.State()
	if err != nil {
		return nil, msgs.RateLimits, err
	}
	if st == chat1.MessageUnboxedState_ERROR {
		em := first.Error().ErrMsg
		return nil, msgs.RateLimits, errors.New(em)
	}

	msg := first.Valid()
	body := msg.MessageBody
	t, err := body.MessageType()
	if err != nil {
		return nil, msgs.RateLimits, err
	}

	switch t {
	case chat1.MessageType_ATTACHMENT:
		attachment := msg.MessageBody.Attachment()
		return &attachment, msgs.RateLimits, nil
	case chat1.MessageType_ATTACHMENTUPLOADED:
		uploaded := msg.MessageBody.Attachmentuploaded()
		attachment := chat1.MessageAttachment{
			Object:   uploaded.Object,
			Previews: uploaded.Previews,
			Metadata: uploaded.Metadata,
		}
		return &attachment, msgs.RateLimits, nil
	}

	return nil, msgs.RateLimits, errors.New("not an attachment message")

}

func (h *Server) deleteAssets(ctx context.Context, conversationID chat1.ConversationID, assets []chat1.Asset) {
	if len(assets) == 0 {
		return
	}

	// get s3 params from server
	params, err := h.remoteClient().GetS3Params(ctx, conversationID)
	if err != nil {
		h.Debug(ctx, "error getting s3 params: %s", err)
		return
	}

	if err := h.store.DeleteAssets(ctx, params, h, assets); err != nil {
		h.Debug(ctx, "error deleting assets: %s", err)

		// there's no way to get asset information after this point.
		// any assets not deleted will be stranded on s3.

		return
	}

	h.Debug(ctx, "deleted %d assets", len(assets))
}

func (h *Server) FindConversationsLocal(ctx context.Context,
	arg chat1.FindConversationsLocalArg) (res chat1.FindConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "FindConversationsLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	uid := gregor1.UID(h.G().Env.GetUID().ToBytes())

	res.Conversations, res.RateLimits, err = FindConversations(ctx, h.G(), h.DebugLabeler, h.remoteClient,
		uid, arg.TlfName, arg.TopicType, arg.MembersType, arg.Visibility, arg.TopicName, arg.OneChatPerTLF)
	if err != nil {
		return res, err
	}
	res.RateLimits = utils.AggRateLimits(res.RateLimits)
	return res, nil
}

func (h *Server) UpdateTyping(ctx context.Context, arg chat1.UpdateTypingArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("StartTyping(%s)", arg.ConversationID))()
	if err = h.assertLoggedIn(ctx); err != nil {
		return err
	}
	uid := h.G().Env.GetUID()
	deviceID := make([]byte, libkb.DeviceIDLen)
	if err := h.G().Env.GetDeviceID().ToBytes(deviceID); err != nil {
		return err
	}

	// Just bail out if we are offline
	if !h.G().Syncer.IsConnected(ctx) {
		return nil
	}
	if err := h.remoteClient().UpdateTypingRemote(ctx, chat1.UpdateTypingRemoteArg{
		Uid:      uid.ToBytes(),
		DeviceID: deviceID,
		ConvID:   arg.ConversationID,
		Typing:   arg.Typing,
	}); err != nil {
		h.Debug(ctx, "StartTyping: failed to hit the server: %s", err.Error())
	}

	return nil
}

func (h *Server) JoinConversationByIDLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("JoinConversationByID(%s)", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "JoinConversationByIDLocal: result obtained offline")
		}
	}()

	uid, err := h.assertLoggedInUID(ctx)
	if err != nil {
		return res, err
	}

	rl, err := JoinConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.RateLimits = utils.AggRateLimits(rl)
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) JoinConversationLocal(ctx context.Context, arg chat1.JoinConversationLocalArg) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("JoinConversation(%s)",
		arg.TopicName))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "JoinConversationLocal: result obtained offline")
		}
	}()
	uid, err := h.assertLoggedInUID(ctx)
	if err != nil {
		return res, err
	}

	// Fetch the TLF ID from specified name
	nameInfo, err := CtxKeyFinder(ctx, h.G()).Find(ctx, arg.TlfName, chat1.ConversationMembersType_TEAM,
		arg.Visibility == keybase1.TLFVisibility_PUBLIC)
	if err != nil {
		h.Debug(ctx, "JoinConversationLocal: failed to get TLFID from name: %s", err.Error())
		return res, err
	}

	// List all the conversations on the team
	teamConvs, err := h.remoteClient().GetTLFConversations(ctx, chat1.GetTLFConversationsArg{
		TlfID:            nameInfo.ID,
		TopicType:        arg.TopicType,
		SummarizeMaxMsgs: false, // tough call here, depends on if we are in most of convos on the team
	})
	if err != nil {
		h.Debug(ctx, "JoinConversationLocal: failed to list team conversations: %s", err.Error())
		return res, err
	}
	if teamConvs.RateLimit != nil {
		res.RateLimits = append(res.RateLimits, *teamConvs.RateLimit)
	}

	// Localize the conversations so we can find the conversation ID
	teamConvsLocal, err := NewBlockingLocalizer(h.G()).Localize(ctx, uid, types.Inbox{
		ConvsUnverified: utils.RemoteConvs(teamConvs.Conversations),
	})
	if err != nil {
		h.Debug(ctx, "JoinConversationLocal: failed to localize conversations: %s", err.Error())
		return res, err
	}

	var convID chat1.ConversationID
	for _, conv := range teamConvsLocal {
		topicName := utils.GetTopicName(conv)
		if topicName != "" && topicName == arg.TopicName {
			convID = conv.GetConvID()
		}
	}
	if convID.IsNil() {
		return res, fmt.Errorf("no topic name %s exists on specified team", arg.TopicName)
	}

	rl, err := JoinConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.RateLimits = utils.AggRateLimits(rl)
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) LeaveConversationLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("LeaveConversation(%s)", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "LeaveConversationLocal: result obtained offline")
		}
	}()
	uid, err := h.assertLoggedInUID(ctx)
	if err != nil {
		return res, err
	}

	rl, err := LeaveConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}

	res.RateLimits = utils.AggRateLimits(rl)
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) DeleteConversationLocal(ctx context.Context, arg chat1.DeleteConversationLocalArg) (res chat1.DeleteConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("DeleteConversation(%s)", arg.ConvID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "DeleteConversationLocal: result obtained offline")
		}
	}()
	_, err = h.assertLoggedInUID(ctx)
	if err != nil {
		return res, err
	}

	ui := h.getChatUI(arg.SessionID)
	confirmed, err := ui.ChatConfirmChannelDelete(ctx, chat1.ChatConfirmChannelDeleteArg{
		SessionID: arg.SessionID,
		Channel:   arg.ChannelName,
	})
	if err != nil {
		return res, err
	}
	if !confirmed {
		return res, errors.New("channel delete unconfirmed")
	}

	delRes, err := h.remoteClient().DeleteConversation(ctx, arg.ConvID)
	if err != nil {
		return res, err
	}
	if delRes.RateLimit != nil {
		res.RateLimits = []chat1.RateLimit{*delRes.RateLimit}
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) GetTLFConversationsLocal(ctx context.Context, arg chat1.GetTLFConversationsLocalArg) (res chat1.GetTLFConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("GetTLFConversations(%s)",
		arg.TlfName))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetTLFConversationsLocal: result obtained offline")
		}
	}()
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	uid := gregor1.UID(h.G().Env.GetUID().ToBytes())

	// Fetch the TLF ID from specified name
	nameInfo, err := CtxKeyFinder(ctx, h.G()).Find(ctx, arg.TlfName, arg.MembersType, false)
	if err != nil {
		h.Debug(ctx, "GetTLFConversationsLocal: failed to get TLFID from name: %s", err.Error())
		return res, err
	}

	var convs []chat1.ConversationLocal
	convs, res.RateLimits, err = h.G().TeamChannelSource.GetChannelsFull(ctx, uid, nameInfo.ID, arg.TopicType)
	if err != nil {
		return res, err
	}
	res.Convs = utils.PresentConversationLocals(convs)
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) SetAppNotificationSettingsLocal(ctx context.Context,
	arg chat1.SetAppNotificationSettingsLocalArg) (res chat1.SetAppNotificationSettingsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("SetAppNotificationSettings(%s)",
		arg.ConvID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "SetAppNotificationSettingsLocal: result obtained offline")
		}
	}()
	if err = h.assertLoggedIn(ctx); err != nil {
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
	setRes, err := h.remoteClient().SetAppNotificationSettings(ctx, chat1.SetAppNotificationSettingsArg{
		ConvID:   arg.ConvID,
		Settings: nsettings,
	})
	if err != nil {
		h.Debug(ctx, "SetAppNotificationSettings: failed to post to remote: %s", err.Error())
		return res, err
	}
	if setRes.RateLimit != nil {
		res.RateLimits = append(res.RateLimits, *setRes.RateLimit)
	}

	res.RateLimits = utils.AggRateLimits(res.RateLimits)
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

type remoteNotificationSuccessHandler struct{}

func (g *remoteNotificationSuccessHandler) HandlerName() string {
	return "remote notification success"
}
func (g *remoteNotificationSuccessHandler) OnConnect(ctx context.Context, conn *rpc.Connection, cli rpc.GenericClient, srv *rpc.Server) error {
	return nil
}
func (g *remoteNotificationSuccessHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
}
func (g *remoteNotificationSuccessHandler) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
}
func (g *remoteNotificationSuccessHandler) OnDoCommandError(err error, nextTime time.Duration) {}
func (g *remoteNotificationSuccessHandler) ShouldRetry(name string, err error) bool {
	return false
}
func (g *remoteNotificationSuccessHandler) ShouldRetryOnConnect(err error) bool {
	return false
}

func (h *Server) sendRemoteNotificationSuccessful(ctx context.Context, pushIDs []string) {
	// Get session token
	status, err := h.G().LoginState().APIServerSession(false)
	if err != nil {
		h.Debug(ctx, "sendRemoteNotificationSuccessful: failed to get logged in session: %s", err.Error())
		return
	}

	// Make an ad hoc connection to gregor
	uri, err := rpc.ParseFMPURI(h.G().Env.GetGregorURI())
	if err != nil {
		h.Debug(ctx, "sendRemoteNotificationSuccessful: failed to parse chat server UR: %s", err.Error())
		return
	}

	var conn *rpc.Connection
	if uri.UseTLS() {
		rawCA := h.G().Env.GetBundledCA(uri.Host)
		if len(rawCA) == 0 {
			h.Debug(ctx, "sendRemoteNotificationSuccessful: failed to parse CAs: %s", err.Error())
			return
		}
		conn = rpc.NewTLSConnection(rpc.NewFixedRemote(uri.HostPort),
			[]byte(rawCA), libkb.NewContextifiedErrorUnwrapper(h.G().ExternalG()),
			&remoteNotificationSuccessHandler{}, libkb.NewRPCLogFactory(h.G().ExternalG()), h.G().Log,
			rpc.ConnectionOpts{})
	} else {
		t := rpc.NewConnectionTransport(uri, nil, libkb.MakeWrapError(h.G().ExternalG()))
		conn = rpc.NewConnectionWithTransport(&remoteNotificationSuccessHandler{}, t,
			libkb.NewContextifiedErrorUnwrapper(h.G().ExternalG()), h.G().Log, rpc.ConnectionOpts{})
	}
	defer conn.Shutdown()

	// Make remote successful call on our ad hoc conn
	cli := chat1.RemoteClient{Cli: NewRemoteClient(h.G(), conn.GetClient())}
	if err = cli.RemoteNotificationSuccessful(ctx,
		chat1.RemoteNotificationSuccessfulArg{
			AuthToken:        gregor1.SessionToken(status.SessionToken),
			CompanionPushIDs: pushIDs,
		}); err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: failed to invoke remote notification success: %",
			err.Error())
	}
}

func (h *Server) formatPushText(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	membersType chat1.ConversationMembersType, msg chat1.MessageUnboxed) string {
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		// Try to get the channel name
		ib, _, err := h.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		}, nil)
		if err != nil || len(ib.Convs) == 0 {
			// Don't give up here, just display the team name only
			h.Debug(ctx, "formatPushText: failed to unbox convo, using team only")
			return fmt.Sprintf("%s (%s): %s", msg.Valid().SenderUsername, msg.Valid().ClientHeader.TlfName,
				msg.Valid().MessageBody.Text().Body)
		}
		return fmt.Sprintf("%s (%s#%s): %s", msg.Valid().SenderUsername, msg.Valid().ClientHeader.TlfName,
			utils.GetTopicName(ib.Convs[0]), msg.Valid().MessageBody.Text().Body)
	default:
		return fmt.Sprintf("%s: %s", msg.Valid().SenderUsername, msg.Valid().MessageBody.Text().Body)
	}
}

func (h *Server) UnboxMobilePushNotification(ctx context.Context, arg chat1.UnboxMobilePushNotificationArg) (res string, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("UnboxMobilePushNotification(%s)",
		arg.ConvID))()
	uid := gregor1.UID(h.G().Env.GetUID().ToBytes())
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	defer func() {
		if err == nil {
			// If we have succeeded, let us let the server know that it can abort the push notification
			// associated with this silent one
			h.sendRemoteNotificationSuccessful(ctx, arg.PushIDs)
		}
	}()

	// Parse the message payload and convID
	bConvID, err := hex.DecodeString(arg.ConvID)
	if err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: invalid convID: %s msg: %s", arg.ConvID, err.Error())
		return res, err
	}
	convID := chat1.ConversationID(bConvID)
	bMsg, err := base64.StdEncoding.DecodeString(arg.Payload)
	if err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: invalid message payload: %s", err.Error())
		return res, err
	}
	var msgBoxed chat1.MessageBoxed
	mh := codec.MsgpackHandle{WriteExt: true}
	if err = codec.NewDecoderBytes(bMsg, &mh).Decode(&msgBoxed); err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: failed to msgpack decode payload: %s", err.Error())
		return res, err
	}

	// Let's just take this whole message and add it to the message body cache. Alternatively,
	// we can try to just unbox if this fails, since it will need the convo in cache.
	msgUnboxed, _, err := h.G().ConvSource.Push(ctx, convID, uid, msgBoxed)
	if err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: failed to push message to conv source: %s", err.Error())
		// Try to just unbox without pushing
		unboxInfo := newBasicUnboxConversationInfo(convID, arg.MembersType, nil)
		if msgUnboxed, err = NewBoxer(h.G()).UnboxMessage(ctx, msgBoxed, unboxInfo); err != nil {
			h.Debug(ctx, "UnboxMobilePushNotification: failed simple unbox as well, bailing: %s", err.Error())
			return res, err
		}
	}

	if msgUnboxed.IsValid() && msgUnboxed.GetMessageType() == chat1.MessageType_TEXT {
		res = h.formatPushText(ctx, uid, convID, arg.MembersType, msgUnboxed)
		h.Debug(ctx, "UnboxMobilePushNotification: successful unbox: %s", res)
		return res, nil
	}

	h.Debug(ctx, "UnboxMobilePushNotification: invalid message received: typ: %v",
		msgUnboxed.GetMessageType())
	return "", errors.New("invalid message")
}

func (h *Server) SetGlobalAppNotificationSettingsLocal(ctx context.Context,
	strSettings map[string]bool) (err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetGlobalAppNotificationSettings")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return err
	}
	var settings chat1.GlobalAppNotificationSettings
	settings.Settings = make(map[chat1.GlobalAppNotificationSetting]bool)
	for k, v := range strSettings {
		key, err := strconv.Atoi(k)
		if err != nil {
			h.Debug(ctx, "SetGlobalAppNotificationSettings: failed to convert key: %s", err.Error())
			continue
		}
		gkey := chat1.GlobalAppNotificationSetting(key)
		h.Debug(ctx, "SetGlobalAppNotificationSettings: setting typ: %s enabled: %v",
			chat1.GlobalAppNotificationSettingRevMap[gkey], v)
		settings.Settings[gkey] = v
	}

	return h.remoteClient().SetGlobalAppNotificationSettings(ctx, settings)
}

func (h *Server) GetGlobalAppNotificationSettingsLocal(ctx context.Context) (res chat1.GlobalAppNotificationSettings, err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetGlobalAppNotificationSettings")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	return h.remoteClient().GetGlobalAppNotificationSettings(ctx)
}
