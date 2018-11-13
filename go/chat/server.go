package chat

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"regexp"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
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

	serverConn        ServerConnection
	uiSource          UISource
	boxer             *Boxer
	identNotifier     types.IdentifyNotifier
	clock             clockwork.Clock
	convPageStatus    map[string]chat1.Pagination
	cachedThreadDelay *time.Duration

	// Only for testing
	rc                chat1.RemoteInterface
	mockChatUI        libkb.ChatUI
	remoteThreadDelay *time.Duration
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
		clock:          clockwork.NewRealClock(),
		convPageStatus: make(map[string]chat1.Pagination),
	}
}

func (h *Server) SetClock(clock clockwork.Clock) {
	h.clock = clock
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

func (h *Server) handleOfflineError(ctx context.Context, err error,
	res chat1.OfflinableResult) error {
	if err == nil {
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
	res.SetRateLimits(CtxRateLimits(ctx))
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

func (h *Server) suspendComponent(ctx context.Context, suspendable types.Suspendable) func() {
	if canceled := suspendable.Suspend(ctx); canceled {
		h.Debug(ctx, "suspendComponent: canceled background task")
	}
	return func() {
		suspendable.Resume(ctx)
	}
}

// suspendConvLoader will suspend the global ConvLoader until the return function is called. This allows
// a succinct call like defer suspendConvLoader(ctx)() in RPC handlers wishing to lock out the
// conv loader.
func (h *Server) suspendConvLoader(ctx context.Context) func() {
	return h.suspendComponent(ctx, h.G().ConvLoader)
}

func (h *Server) suspendInboxSource(ctx context.Context) func() {
	return h.suspendComponent(ctx, h.G().InboxSource)
}

func (h *Server) getUID() gregor1.UID {
	return gregor1.UID(h.G().Env.GetUID().ToBytes())
}

func (h *Server) GetInboxNonblockLocal(ctx context.Context, arg chat1.GetInboxNonblockLocalArg) (res chat1.NonblockFetchRes, err error) {
	var breaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &breaks, h.identNotifier)
	ctx = makeLocalizerCancelableContext(ctx)
	defer h.Trace(ctx, func() error { return err }, "GetInboxNonblockLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetInboxNonblockLocal: result obtained offline")
		}
	}()
	defer h.suspendConvLoader(ctx)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Create localized conversation callback channel
	chatUI := h.getChatUI(arg.SessionID)

	// Invoke nonblocking inbox read and get remote inbox version to send back
	// as our result
	_, localizeCb, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerNonblocking,
		true, arg.MaxUnbox, arg.Query, arg.Pagination)
	if err != nil {
		// If this is a convID based query, let's go ahead and drop those onto
		// the retrier
		if arg.Query != nil && len(arg.Query.ConvIDs) > 0 {
			h.Debug(ctx, "GetInboxNonblockLocal: failed to get unverified inbox, marking convIDs as failed")
			for _, convID := range arg.Query.ConvIDs {
				h.G().FetchRetrier.Failure(ctx, uid,
					NewConversationRetry(h.G(), convID, nil, InboxLoad))
			}
		} else {
			h.Debug(ctx, "GetInboxNonblockLocal: failed to load untrusted inbox, general query")
			h.G().FetchRetrier.Failure(ctx, uid,
				NewFullInboxRetry(h.G(), arg.Query, arg.Pagination))
		}
		return res, err
	}

	// Wait for inbox to get sent to us
	var lres types.AsyncInboxResult
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
		go func(convRes types.AsyncInboxResult) {
			if convRes.ConvLocal.Error != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: *** error conv: id: %s err: %s",
					convRes.Conv.GetConvID(), convRes.ConvLocal.Error.Message)
				chatUI.ChatInboxFailed(ctx, chat1.ChatInboxFailedArg{
					SessionID: arg.SessionID,
					ConvID:    convRes.Conv.GetConvID(),
					Error:     utils.PresentConversationErrorLocal(*convRes.ConvLocal.Error),
				})

				// If we get a transient failure, add this to the retrier queue
				if convRes.ConvLocal.Error.Typ == chat1.ConversationErrorType_TRANSIENT {
					h.G().FetchRetrier.Failure(ctx, uid,
						NewConversationRetry(h.G(), convRes.Conv.GetConvID(),
							&convRes.Conv.Metadata.IdTriple.Tlfid, InboxLoad))
				}
			} else {
				pconv := utils.PresentConversationLocal(convRes.ConvLocal, h.G().Env.GetUsername().String())
				jbody, err := json.Marshal(pconv)
				if err != nil {
					h.Debug(ctx, "GetInboxNonblockLocal: failed to JSON conversation, skipping: %s",
						err.Error())
				} else {
					h.Debug(ctx, "GetInboxNonblockLocal: sending verified conv: id: %s tlf: %s bytes: %d",
						convRes.Conv.GetConvID(), convRes.ConvLocal.Info.TLFNameExpanded(), len(jbody))
					start := time.Now()
					chatUI.ChatInboxConversation(ctx, chat1.ChatInboxConversationArg{
						SessionID: arg.SessionID,
						Conv:      string(jbody),
					})
					h.Debug(ctx, "GetInboxNonblockLocal: sent verified conv successfully: id: %s time: %v",
						convRes.Conv.GetConvID(), time.Now().Sub(start))
				}
				convLocalsCh <- convRes.ConvLocal

				// Send a note to the retrier that we actually loaded this guy successfully
				h.G().FetchRetrier.Success(ctx, uid,
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
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
	if h.G().AppState.State() != keybase1.AppState_FOREGROUND {
		h.Debug(ctx, "MarkAsReadLocal: not marking as read, app state not foreground: %v",
			h.G().AppState.State())
		return chat1.MarkAsReadLocalRes{
			Offline: h.G().Syncer.IsConnected(ctx),
		}, nil
	}

	// Check local copy to see if we have this convo, and have fully read it. If so, we skip the remote call

	readRes, err := storage.NewInbox(h.G()).GetConversation(ctx, uid, arg.ConversationID)
	if err == nil && readRes.GetConvID().Eq(arg.ConversationID) &&
		readRes.Conv.ReaderInfo.ReadMsgid == readRes.Conv.ReaderInfo.MaxMsgid {
		h.Debug(ctx, "MarkAsReadLocal: conversation fully read: %s, not sending remote call",
			arg.ConversationID)
		return chat1.MarkAsReadLocalRes{
			Offline: h.G().Syncer.IsConnected(ctx),
		}, nil
	}

	_, err = h.remoteClient().MarkAsRead(ctx, chat1.MarkAsReadArg{
		ConversationID: arg.ConversationID,
		MsgID:          arg.MsgID,
	})
	if err != nil {
		return res, err
	}
	return chat1.MarkAsReadLocalRes{
		Offline: h.G().Syncer.IsConnected(ctx),
	}, nil
}

// GetInboxAndUnboxLocal implements keybase.chatLocal.getInboxAndUnboxLocal protocol.
func (h *Server) GetInboxAndUnboxLocal(ctx context.Context, arg chat1.GetInboxAndUnboxLocalArg) (res chat1.GetInboxAndUnboxLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	if arg.Query != nil && arg.Query.TopicType != nil && *arg.Query.TopicType != chat1.TopicType_CHAT {
		// make this cancelable for things like KBFS file edit convs
		ctx = makeLocalizerCancelableContext(ctx)
	}
	defer h.Trace(ctx, func() error { return err }, "GetInboxAndUnboxLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Read inbox from the source
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, true, nil,
		arg.Query, arg.Pagination)
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetInboxAndUnboxUILocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	// Read inbox from the source
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, true, nil,
		arg.Query, arg.Pagination)
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
		Conversations:    utils.PresentConversationLocals(ib.Convs, h.G().Env.GetUsername().String()),
		Pagination:       ib.Pagination,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetCachedThread(ctx context.Context, arg chat1.GetCachedThreadArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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
		Offline:          h.G().ConvSource.IsOffline(ctx),
		IdentifyFailures: identBreaks,
	}, nil
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *Server) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetThreadLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	// Xlate pager control into pagination if given
	if arg.Query != nil && arg.Query.MessageIDControl != nil {
		arg.Pagination = utils.XlateMessageIDControlToPagination(arg.Query.MessageIDControl)
	}

	// Get messages from the source
	thread, err := h.G().ConvSource.Pull(ctx, arg.ConversationID, uid,
		arg.Reason, arg.Query, arg.Pagination)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	return chat1.GetThreadLocalRes{
		Thread:           thread,
		Offline:          h.G().ConvSource.IsOffline(ctx),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) mergeLocalRemoteThread(ctx context.Context, remoteThread, localThread *chat1.ThreadView,
	mode chat1.GetThreadNonblockCbMode) (res chat1.ThreadView, err error) {
	defer func() {
		if err != nil || localThread == nil {
			return
		}
		rm := make(map[chat1.MessageID]bool)
		for _, m := range res.Messages {
			rm[m.GetMessageID()] = true
		}
		// Check for any stray placeholders in the local thread we sent, and set them to some
		// undisplayable type
		for _, m := range localThread.Messages {
			state, err := m.State()
			if err != nil {
				continue
			}
			if state == chat1.MessageUnboxedState_PLACEHOLDER && !rm[m.GetMessageID()] {
				h.Debug(ctx, "mergeLocalRemoteThread: subbing in dead placeholder: msgID: %d",
					m.GetMessageID())
				res.Messages = append(res.Messages, utils.CreateHiddenPlaceholder(m.GetMessageID()))
			}
		}
		sort.Sort(utils.ByMsgUnboxedMsgID(res.Messages))
	}()

	shouldAppend := func(newMsg chat1.MessageUnboxed, oldMsgs map[chat1.MessageID]chat1.MessageUnboxed) bool {
		oldMsg, ok := oldMsgs[newMsg.GetMessageID()]
		if !ok {
			return true
		}
		// If either message is not valid, return the new one, something weird might be going on
		if !oldMsg.IsValid() || !newMsg.IsValid() {
			return true
		}
		// If newMsg is now superseded by something different than what we sent, then let's include it
		if newMsg.Valid().ServerHeader.SupersededBy != oldMsg.Valid().ServerHeader.SupersededBy {
			h.Debug(ctx, "mergeLocalRemoteThread: including supersededBy change: msgID: %d",
				newMsg.GetMessageID())
			return true
		}
		return false
	}
	switch mode {
	case chat1.GetThreadNonblockCbMode_FULL:
		return *remoteThread, nil
	case chat1.GetThreadNonblockCbMode_INCREMENTAL:
		if localThread != nil {
			lm := make(map[chat1.MessageID]chat1.MessageUnboxed)
			for _, m := range localThread.Messages {
				lm[m.GetMessageID()] = m
			}
			res.Pagination = remoteThread.Pagination
			for _, m := range remoteThread.Messages {
				if shouldAppend(m, lm) {
					res.Messages = append(res.Messages, m)
				}
			}
			h.Debug(ctx, "mergeLocalRemoteThread: incremental cb mode: orig: %d post: %d",
				len(remoteThread.Messages), len(res.Messages))
			return res, nil
		}
		return *remoteThread, nil
	}
	return res, errors.New("unknown get thread cb mode")
}

func (h *Server) applyPagerModeIncoming(ctx context.Context, convID chat1.ConversationID,
	pagination *chat1.Pagination, pgmode chat1.GetThreadNonblockPgMode) (res *chat1.Pagination) {
	defer func() {
		h.Debug(ctx, "applyPagerModeIncoming: mode: %v convID: %s xform: %s -> %s", pgmode, convID,
			pagination, res)
	}()
	switch pgmode {
	case chat1.GetThreadNonblockPgMode_DEFAULT:
		return pagination
	case chat1.GetThreadNonblockPgMode_SERVER:
		if pagination == nil {
			return nil
		}
		if len(pagination.Next) > 0 {
			return &chat1.Pagination{
				Num:  pagination.Num,
				Next: h.convPageStatus[convID.String()].Next,
			}
		} else if len(pagination.Previous) > 0 {
			return &chat1.Pagination{
				Num:      pagination.Num,
				Previous: h.convPageStatus[convID.String()].Previous,
			}
		} else {
			return pagination
		}
	}
	return pagination
}

func (h *Server) applyPagerModeOutgoing(ctx context.Context, convID chat1.ConversationID,
	pagination *chat1.Pagination, incoming *chat1.Pagination, pgmode chat1.GetThreadNonblockPgMode) {
	switch pgmode {
	case chat1.GetThreadNonblockPgMode_DEFAULT:
	case chat1.GetThreadNonblockPgMode_SERVER:
		if pagination == nil {
			return
		}
		if incoming.FirstPage() {
			h.Debug(ctx, "applyPagerModeOutgoing: resetting pagination: convID: %s p: %s", convID, pagination)
			h.convPageStatus[convID.String()] = *pagination
		} else {
			oldStored := h.convPageStatus[convID.String()]
			if len(incoming.Next) > 0 {
				oldStored.Next = pagination.Next
				h.Debug(ctx, "applyPagerModeOutgoing: setting next pagination: convID: %s p: %s", convID,
					pagination)
			} else if len(incoming.Previous) > 0 {
				h.Debug(ctx, "applyPagerModeOutgoing: setting prev pagination: convID: %s p: %s", convID,
					pagination)
				oldStored.Previous = pagination.Previous
			}
			h.convPageStatus[convID.String()] = oldStored
		}
	}
}

func (h *Server) dispatchOldPagesJob(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	pagination *chat1.Pagination, resultPagination *chat1.Pagination) {
	// Fire off pageback background jobs if we fetched the first page
	if pagination.FirstPage() && resultPagination != nil && !resultPagination.Last {
		p := &chat1.Pagination{
			Num:  50,
			Next: resultPagination.Next,
		}
		h.Debug(ctx, "dispatchOldPagesJob: queuing %s because of first page fetch: p: %s", convID, p)
		if err := h.G().ConvLoader.Queue(ctx, types.NewConvLoaderJob(convID, nil /* query */, p, types.ConvLoaderPriorityLow,
			newConvLoaderPagebackHook(h.G(), 0, 5))); err != nil {
			h.Debug(ctx, "dispatchOldPagesJob: failed to queue conversation load: %s", err)
		}
	}
}

func (h *Server) GetThreadNonblock(ctx context.Context, arg chat1.GetThreadNonblockArg) (res chat1.NonblockFetchRes, fullErr error) {
	var pagination, resultPagination *chat1.Pagination
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	uid := gregor1.UID(h.G().Env.GetUID().ToBytes())
	defer h.Trace(ctx, func() error { return fullErr },
		fmt.Sprintf("GetThreadNonblock(%s,%v,%v)", arg.ConversationID, arg.CbMode, arg.Reason))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
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
			// Load old pages of this conversation on success
			h.dispatchOldPagesJob(ctx, arg.ConversationID, uid, pagination, resultPagination)
		}
	}()
	defer h.suspendConvLoader(ctx)()
	defer h.suspendInboxSource(ctx)()
	// Lock conversation while this is running
	if err := h.G().ConvSource.AcquireConversationLock(ctx, uid, arg.ConversationID); err != nil {
		return res, err
	}
	defer h.G().ConvSource.ReleaseConversationLock(ctx, uid, arg.ConversationID)
	h.Debug(ctx, "GetThreadNonblock: conversation lock obtained")

	if _, err := utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}
	// If this is from a push or foreground, set us into the foreground
	switch arg.Reason {
	case chat1.GetThreadReason_PUSH, chat1.GetThreadReason_FOREGROUND:
		// Also if we get here and we claim to not be in the foreground yet, then hit disconnect
		// to reset any delay checks or timers
		switch h.G().AppState.State() {
		case keybase1.AppState_FOREGROUND, keybase1.AppState_BACKGROUNDACTIVE:
		default:
			h.G().Syncer.Disconnected(ctx)
		}
		h.G().AppState.Update(keybase1.AppState_FOREGROUND)
	}

	// Set last select conversation on syncer
	h.G().Syncer.SelectConversation(ctx, arg.ConversationID)

	// Decode presentation form pagination
	var err error
	if pagination, err = utils.DecodePagination(arg.Pagination); err != nil {
		return res, err
	}

	// Enable delete placeholders for supersede transform
	if arg.Query == nil {
		arg.Query = new(chat1.GetThreadQuery)
	}
	arg.Query.EnableDeletePlaceholders = true

	// Xlate pager control into pagination if given
	if arg.Query != nil && arg.Query.MessageIDControl != nil {
		pagination = utils.XlateMessageIDControlToPagination(arg.Query.MessageIDControl)
	}

	// Apply any pager mode transformations
	pagination = h.applyPagerModeIncoming(ctx, arg.ConversationID, pagination, arg.Pgmode)

	// Grab local copy first
	chatUI := h.getChatUI(arg.SessionID)

	// Race the full operation versus the local one, so we don't lose anytime grabbing the local
	// version if they are roughly as fast. However, the full operation has preference, so if it does
	// win the race we don't send anything up from the local operation.
	var localSentThread *chat1.ThreadView
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
				h.clock.Sleep(*h.cachedThreadDelay)
			}
			localThread, err = h.G().ConvSource.PullLocalOnly(bctx, arg.ConversationID,
				uid, arg.Query, pagination, 10)
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
			resThread = nil
			h.Debug(ctx, "GetThreadNonblock: context canceled before local copy sent")
			return
		default:
		}
		var pthread *string
		if resThread != nil {
			h.Debug(ctx, "GetThreadNonblock: sending cached response: messages: %d pager: %s",
				len(resThread.Messages), resThread.Pagination)
			var jsonPt []byte
			var err error

			localSentThread = resThread
			pt := utils.PresentThreadView(ctx, h.G(), uid, *resThread, arg.ConversationID)
			if jsonPt, err = json.Marshal(pt); err != nil {
				h.Debug(ctx, "GetThreadNonblock: failed to JSON cached response: %s", err)
				return
			}
			sJSONPt := string(jsonPt)
			pthread = &sJSONPt
			h.applyPagerModeOutgoing(bctx, arg.ConversationID, resThread.Pagination, pagination, arg.Pgmode)
		} else {
			h.Debug(ctx, "GetThreadNonblock: sending nil cached response")
		}
		start := time.Now()
		chatUI.ChatThreadCached(bctx, chat1.ChatThreadCachedArg{
			SessionID: arg.SessionID,
			Thread:    pthread,
		})
		h.Debug(ctx, "GetThreadNonblock: cached response send time: %v", time.Since(start))
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()

		// Run the full Pull operation, and redo pagination
		if h.remoteThreadDelay != nil {
			h.clock.Sleep(*h.remoteThreadDelay)
		}
		var remoteThread chat1.ThreadView
		remoteThread, fullErr = h.G().ConvSource.Pull(bctx, arg.ConversationID,
			uid, arg.Reason, arg.Query, pagination)
		if fullErr != nil {
			h.Debug(ctx, "GetThreadNonblock: error running Pull, returning error: %s", fullErr.Error())
			return
		}

		// Acquire lock and send up actual response
		uilock.Lock()
		defer uilock.Unlock()
		var rthread chat1.ThreadView
		if rthread, fullErr =
			h.mergeLocalRemoteThread(ctx, &remoteThread, localSentThread, arg.CbMode); fullErr != nil {
			return
		}
		h.Debug(ctx, "GetThreadNonblock: sending full response: messages: %d pager: %s",
			len(rthread.Messages), rthread.Pagination)
		uires := utils.PresentThreadView(bctx, h.G(), uid, rthread, arg.ConversationID)
		var jsonUIRes []byte
		if jsonUIRes, fullErr = json.Marshal(uires); fullErr != nil {
			h.Debug(ctx, "GetThreadNonblock: failed to JSON full result: %s", fullErr)
			return
		}
		resultPagination = rthread.Pagination
		h.applyPagerModeOutgoing(bctx, arg.ConversationID, rthread.Pagination, pagination, arg.Pgmode)
		start := time.Now()
		chatUI.ChatThreadFull(bctx, chat1.ChatThreadFullArg{
			SessionID: arg.SessionID,
			Thread:    string(jsonUIRes),
		})
		h.Debug(ctx, "GetThreadNonblock: full response send time: %v", time.Since(start))

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
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	conv, err := NewConversation(ctx, h.G(), uid, arg.TlfName, arg.TopicName,
		arg.TopicType, arg.MembersType, arg.TlfVisibility, h.remoteClient)
	if err != nil {
		return res, err
	}

	res.Conv = conv
	res.IdentifyFailures = identBreaks
	return res, nil
}

func (h *Server) GetInboxSummaryForCLILocal(ctx context.Context, arg chat1.GetInboxSummaryForCLILocalQuery) (res chat1.GetInboxSummaryForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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
		Offline:          h.G().ConvSource.IsOffline(ctx),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetNextAttachmentMessageLocal(ctx context.Context,
	arg chat1.GetNextAttachmentMessageLocalArg) (res chat1.GetNextAttachmentMessageLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetNextAttachmentMessageLocal(%s,%d,%v)",
		arg.ConvID, arg.MessageID, arg.BackInTime)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	gallery := attachments.NewGallery(h.G())
	unboxed, err := gallery.NextMessage(ctx, uid, arg.ConvID, arg.MessageID,
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetConversationStatusLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}

	_, err = h.remoteClient().SetConversationStatus(ctx, chat1.SetConversationStatusArg{
		ConversationID: arg.ConversationID,
		Status:         arg.Status,
	})
	if err != nil {
		return chat1.SetConversationStatusLocalRes{}, err

	}
	// Send word to API server about the report
	if arg.Status == chat1.ConversationStatus_REPORTED {
		h.Debug(ctx, "SetConversationStatusLocal: sending report to server")

		tlfname := "<error fetching TLF name>"

		// Get TLF name to post
		ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, true,
			nil, &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{arg.ConversationID},
			}, nil)
		if err != nil {
			h.Debug(ctx, "SetConversationStatusLocal: failed to fetch conversation: %s", err.Error())
		} else {
			if len(ib.Convs) > 0 {
				tlfname = ib.Convs[0].Info.TLFNameExpanded()
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
		IdentifyFailures: identBreaks,
	}, nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *Server) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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

	// Make sure sender is set
	db := make([]byte, 16)
	deviceID := h.G().Env.GetDeviceID()
	if err = deviceID.ToBytes(db); err != nil {
		return res, err
	}
	arg.Msg.ClientHeader.Sender = uid
	arg.Msg.ClientHeader.SenderDevice = gregor1.DeviceID(db)

	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)

	_, msgBoxed, err := sender.Send(ctx, arg.ConversationID, arg.Msg, 0, nil)
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GenerateOutboxID")()
	return storage.NewOutboxID()
}

func (h *Server) PostLocalNonblock(ctx context.Context, arg chat1.PostLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostLocalNonblock")()
	defer h.suspendConvLoader(ctx)()
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

	// Add outbox information
	var prevMsgID chat1.MessageID
	if arg.ClientPrev == 0 {
		h.Debug(ctx, "PostLocalNonblock: ClientPrev not specified using local storage")
		thread, err := h.G().ConvSource.PullLocalOnly(ctx, arg.ConversationID, uid, nil,
			&chat1.Pagination{Num: 1}, 0)
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
	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)
	nonblockSender := NewNonblockingSender(h.G(), sender)

	obid, _, err := nonblockSender.Send(ctx, arg.ConversationID, arg.Msg, arg.ClientPrev, arg.OutboxID)
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

func (h *Server) PostFileAttachmentMessageLocalNonblock(ctx context.Context,
	arg chat1.PostFileAttachmentMessageLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostFileAttachmentMessageLocalNonblock")()
	defer h.suspendConvLoader(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()

	// Create non block sender
	sender := NewNonblockingSender(h.G(), NewBlockingSender(h.G(), h.boxer, h.remoteClient))
	outboxID, _, err := attachments.NewSender(h.G()).PostFileAttachmentMessage(ctx, sender,
		arg.ConvID, arg.TlfName, arg.Visibility, arg.OutboxID, arg.Filename, arg.Title, arg.Metadata,
		arg.ClientPrev, arg.EphemeralLifetime)
	if err != nil {
		return res, err
	}
	return chat1.PostLocalNonblockRes{
		OutboxID:         outboxID,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) PostFileAttachmentUploadLocalNonblock(ctx context.Context,
	arg chat1.PostFileAttachmentUploadLocalNonblockArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err },
		fmt.Sprintf("PostFileAttachmentUploadLocalNonblock(%s)", arg.OutboxID))()
	defer h.suspendConvLoader(ctx)()

	uid := h.getUID()
	if _, err = h.G().AttachmentUploader.Register(ctx, uid, arg.ConvID, arg.OutboxID, arg.Title,
		arg.Filename, arg.Metadata, arg.CallerPreview); err != nil {
		return err
	}
	return nil
}

// PostFileAttachmentLocal implements chat1.LocalInterface.PostFileAttachmentLocal.
func (h *Server) PostFileAttachmentLocal(ctx context.Context, arg chat1.PostFileAttachmentLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.Arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "PostFileAttachmentLocal")()
	defer h.suspendConvLoader(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()

	// Get base of message we are going to send
	uid := h.getUID()
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "DownloadAttachmentLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "DownloadFileAttachmentLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
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
	darg.Sink = sink
	ires, err := h.downloadAttachmentLocal(ctx, uid, darg)
	if err != nil {
		return res, err
	}
	if err := attachments.Quarantine(ctx, filename); err != nil {
		h.Debug(ctx, "DownloadFileAttachmentLocal: failed to quarantine download: %s", err)
	}
	return chat1.DownloadFileAttachmentLocalRes{
		Filename:         filename,
		IdentifyFailures: ires.IdentifyFailures,
	}, nil
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
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
	if obr.IsAttachment() {
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
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "FindConversationsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	res.Conversations, err = FindConversations(ctx, h.G(), h.DebugLabeler, true /* useLocalData */, h.remoteClient,
		uid, arg.TlfName, arg.TopicType, arg.MembersType, arg.Visibility, arg.TopicName, arg.OneChatPerTLF)
	if err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) UpdateTyping(ctx context.Context, arg chat1.UpdateTypingArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("StartTyping(%s)", arg.ConversationID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	deviceID := make([]byte, libkb.DeviceIDLen)
	if err := h.G().Env.GetDeviceID().ToBytes(deviceID); err != nil {
		return err
	}

	// Just bail out if we are offline
	if !h.G().Syncer.IsConnected(ctx) {
		return nil
	}
	if err := h.remoteClient().UpdateTypingRemote(ctx, chat1.UpdateTypingRemoteArg{
		Uid:      uid,
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
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

	// Fetch the TLF ID from specified name
	nameInfo, err := CreateNameInfoSource(ctx, h.G(), chat1.ConversationMembersType_TEAM).LookupID(ctx,
		arg.TlfName, arg.Visibility == keybase1.TLFVisibility_PUBLIC)
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
	teamConvsLocal, _, err := h.G().InboxSource.Localize(ctx, uid,
		utils.RemoteConvs(teamConvs.Conversations), types.ConversationLocalizerBlocking)
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

	err = JoinConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) LeaveConversationLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
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

func (h *Server) PreviewConversationByIDLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("PreviewConversation(%s)", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "PreviewConversationLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	err = PreviewConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) DeleteConversationLocal(ctx context.Context, arg chat1.DeleteConversationLocalArg) (res chat1.DeleteConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, fmt.Sprintf("GetTLFConversations(%s)",
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
	res.Convs = utils.PresentConversationLocals(convs, h.G().Env.GetUsername().String())
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
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
	mbu, err := mp.UnboxPushNotification(ctx, uid, convID, arg.MembersType, arg.Payload)
	if err != nil {
		return res, err
	}
	if res, err = mp.FormatPushText(ctx, uid, convID, arg.MembersType, mbu); err != nil {
		return res, err
	}
	if arg.ShouldAck {
		mp.AckNotificationSuccess(ctx, arg.PushIDs)
	}
	return res, nil
}

func (h *Server) SetGlobalAppNotificationSettingsLocal(ctx context.Context,
	strSettings map[string]bool) (err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetGlobalAppNotificationSettings")()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
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
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}
	return h.remoteClient().GetGlobalAppNotificationSettings(ctx)
}

func (h *Server) AddTeamMemberAfterReset(ctx context.Context,
	arg chat1.AddTeamMemberAfterResetArg) (err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "AddTeamMemberAfterReset")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Lookup conversation to get team ID
	iboxRes, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, true, nil,
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
	defer h.Trace(ctx, func() error { return err }, "SetConvRetention(%v, %v)", arg.ConvID, arg.Policy.Summary())()
	_, err = h.remoteClient().SetConvRetention(ctx, chat1.SetConvRetentionArg{
		ConvID: arg.ConvID,
		Policy: arg.Policy,
	})
	return err
}

func (h *Server) SetTeamRetentionLocal(ctx context.Context, arg chat1.SetTeamRetentionLocalArg) (err error) {
	defer h.Trace(ctx, func() error { return err }, "SetTeamRetention(%v, %v)", arg.TeamID, arg.Policy.Summary())()
	_, err = h.remoteClient().SetTeamRetention(ctx, chat1.SetTeamRetentionArg{
		TeamID: arg.TeamID,
		Policy: arg.Policy,
	})
	return err
}

func (h *Server) GetTeamRetentionLocal(ctx context.Context, teamID keybase1.TeamID) (res *chat1.RetentionPolicy, err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
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
	ib, err := h.G().InboxSource.ReadUnverified(ctx, uid, true, &chat1.GetInboxQuery{
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
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "UpgradeKBFSConversationToImpteam(%s)", convID)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	ibox, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, true, nil,
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

func (h *Server) SearchRegexp(ctx context.Context, arg chat1.SearchRegexpArg) (res chat1.SearchRegexpRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SearchRegexp")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	var re *regexp.Regexp
	if arg.IsRegex {
		re, err = regexp.Compile(arg.Query)
	} else {
		// String queries are set case insensitive
		re, err = utils.GetQueryRe(arg.Query)
	}

	if err != nil {
		return res, err
	}

	chatUI := h.getChatUI(arg.SessionID)
	uiCh := make(chan chat1.ChatSearchHit)
	ch := make(chan struct{})
	go func() {
		for searchHit := range uiCh {
			chatUI.ChatSearchHit(ctx, chat1.ChatSearchHitArg{
				SessionID: arg.SessionID,
				SearchHit: searchHit,
			})
		}
		close(ch)
	}()
	hits, err := h.G().RegexpSearcher.Search(ctx, uid, arg.ConvID, re, uiCh, arg.Opts)
	if err != nil {
		return res, err
	}

	<-ch
	chatUI.ChatSearchDone(ctx, chat1.ChatSearchDoneArg{
		SessionID: arg.SessionID,
		NumHits:   len(hits),
	})
	return chat1.SearchRegexpRes{
		Hits:             hits,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) SearchInbox(ctx context.Context, arg chat1.SearchInboxArg) (res chat1.SearchInboxRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SearchInbox")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	chatUI := h.getChatUI(arg.SessionID)
	// stream hits back to client UI
	hitUICh := make(chan chat1.ChatSearchInboxHit)
	hitUIDone := make(chan struct{})
	numHits := 0
	go func() {
		for searchHit := range hitUICh {
			numHits += len(searchHit.Hits)
			chatUI.ChatSearchInboxHit(ctx, chat1.ChatSearchInboxHitArg{
				SessionID: arg.SessionID,
				SearchHit: searchHit,
			})
		}
		close(hitUIDone)
	}()
	// stream index status back to client UI
	indexUICh := make(chan chat1.ChatSearchIndexStatus)
	indexUIDone := make(chan struct{})
	go func() {
		for status := range indexUICh {
			chatUI.ChatSearchIndexStatus(ctx, chat1.ChatSearchIndexStatusArg{
				SessionID: arg.SessionID,
				Status:    status,
			})
		}
		close(indexUIDone)
	}()

	searchRes, err := h.G().Indexer.Search(ctx, uid, arg.Query, arg.Opts, hitUICh, indexUICh)
	if err != nil {
		return res, err
	}
	<-hitUIDone
	<-indexUIDone

	var doneRes chat1.ChatSearchInboxDone
	if searchRes != nil {
		doneRes = chat1.ChatSearchInboxDone{
			NumHits:        numHits,
			NumConvs:       len(searchRes.Hits),
			PercentIndexed: searchRes.PercentIndexed,
		}
	}
	chatUI.ChatSearchInboxDone(ctx, chat1.ChatSearchInboxDoneArg{
		SessionID: arg.SessionID,
		Res:       doneRes,
	})
	return chat1.SearchInboxRes{
		Res:              searchRes,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) ProfileChatSearch(ctx context.Context, identifyBehavior keybase1.TLFIdentifyBehavior) (res map[string]chat1.ProfileSearchConvStats, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, h.G(), identifyBehavior, &identBreaks, h.identNotifier)
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
	}, nil
}

func (h *Server) ResolveUnfurlPrompt(ctx context.Context, arg chat1.ResolveUnfurlPromptArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	defer func() {
		// squash all errors coming out of here
		err = nil
	}()
	ctx = Context(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "ResolveUnfurlPrompt")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	fetchAndUnfurl := func() error {
		conv, err := GetUnverifiedConv(ctx, h.G(), uid, arg.ConvID, true)
		if err != nil {
			return err
		}
		msgs, err := h.G().ConvSource.GetMessages(ctx, conv, uid, []chat1.MessageID{arg.MsgID}, nil)
		if err != nil {
			return err
		}
		msgs, err = h.G().ConvSource.TransformSupersedes(ctx, conv, uid, msgs)
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
