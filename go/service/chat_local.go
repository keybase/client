// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// chatLocalHandler implements keybase1.chatLocal.
type chatLocalHandler struct {
	*BaseHandler
	libkb.Contextified
	utils.DebugLabeler

	gh            *gregorHandler
	tlfInfoSource types.TLFInfoSource
	boxer         *chat.Boxer
	store         *chat.AttachmentStore
	identNotifier *chat.IdentifyNotifier

	// Only for testing
	rc                chat1.RemoteInterface
	mockChatUI        libkb.ChatUI
	cachedThreadDelay *time.Duration
}

// newChatLocalHandler creates a chatLocalHandler.
func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, store *chat.AttachmentStore, gh *gregorHandler) *chatLocalHandler {
	tlf := chat.NewKBFSTLFInfoSource(g)
	h := &chatLocalHandler{
		BaseHandler:   NewBaseHandler(xp),
		Contextified:  libkb.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g, "ChatLocalHandler", false),
		gh:            gh,
		tlfInfoSource: tlf,
		boxer:         chat.NewBoxer(g, tlf),
		store:         store,
		identNotifier: chat.NewIdentifyNotifier(g),
	}

	return h
}

func (h *chatLocalHandler) getChatUI(sessionID int) libkb.ChatUI {
	if h.mockChatUI != nil {
		return h.mockChatUI
	}
	return h.BaseHandler.getChatUI(sessionID)
}

func (h *chatLocalHandler) isOfflineError(err error) bool {
	// Check type
	switch terr := err.(type) {
	case libkb.APINetError:
		return true
	case chat.OfflineError:
		return true
	case chat.TransientUnboxingError:
		return h.isOfflineError(terr.Inner())
	}
	// Check error itself
	switch err {
	case context.DeadlineExceeded:
		fallthrough
	case context.Canceled:
		fallthrough
	case ErrGregorTimeout:
		return true
	}

	return false
}

func (h *chatLocalHandler) handleOfflineError(ctx context.Context, err error,
	res chat1.OfflinableResult) error {

	if h.isOfflineError(err) {
		h.Debug(ctx, "handleOfflineError: setting offline: err: %s", err.Error())
		res.SetOffline()

		// Disconnect Gregor if we think we are online
		if h.gh.IsConnected() {
			h.Debug(ctx, "handleOfflineError: inconsistent connected state: reconnecting to server")
			if err := h.gh.Reconnect(ctx); err != nil {
				h.Debug(ctx, "handleOfflineError: error reconnecting: %s", err.Error())
			}
		}
		return nil
	}

	return err
}

func (h *chatLocalHandler) GetInboxNonblockLocal(ctx context.Context, arg chat1.GetInboxNonblockLocalArg) (res chat1.NonblockFetchRes, err error) {
	var breaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &breaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetInboxNonblockLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		return res, libkb.LoginRequiredError{}
	}

	// Create localized conversation callback channel
	chatUI := h.getChatUI(arg.SessionID)
	localizeCb := make(chan chat.NonblockInboxResult, 1)

	// Invoke nonblocking inbox read and get remote inbox version to send back as our result
	localizer := chat.NewNonblockingLocalizer(h.G(), localizeCb, arg.MaxUnbox, h.tlfInfoSource)
	_, rl, err := h.G().InboxSource.Read(ctx, uid.ToBytes(), localizer, true, arg.Query, arg.Pagination)
	if err != nil {
		return res, err
	}
	res.RateLimits = utils.AggRateLimitsP([]*chat1.RateLimit{rl})

	// Wait for inbox to get sent to us
	select {
	case lres := <-localizeCb:
		if lres.InboxRes == nil {
			return res, fmt.Errorf("invalid conversation localize callback received")
		}
		h.Debug(ctx, "GetInboxNonblockLocal: unverified inbox sent: %d convs",
			len(lres.InboxRes.ConvsUnverified))
		chatUI.ChatInboxUnverified(ctx, chat1.ChatInboxUnverifiedArg{
			SessionID: arg.SessionID,
			Inbox: chat1.GetInboxLocalRes{
				ConversationsUnverified: lres.InboxRes.ConvsUnverified,
				Pagination:              lres.InboxRes.Pagination,
				Offline:                 h.G().InboxSource.IsOffline(),
				RateLimits:              res.RateLimits,
			},
		})
	case <-time.After(15 * time.Second):
		return res, fmt.Errorf("timeout waiting for inbox result")
	case <-ctx.Done():
		return res, ctx.Err()
	}

	// Consume localize callbacks and send out to UI.
	var wg sync.WaitGroup
	for convRes := range localizeCb {
		wg.Add(1)
		go func(convRes chat.NonblockInboxResult) {
			if convRes.Err != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: *** error conv: id: %s err: %s",
					convRes.ConvID, convRes.Err.Message)
				chatUI.ChatInboxFailed(ctx, chat1.ChatInboxFailedArg{
					SessionID: arg.SessionID,
					ConvID:    convRes.ConvID,
					Error:     *convRes.Err,
				})
			} else if convRes.ConvRes != nil {
				h.Debug(ctx, "GetInboxNonblockLocal: verified conv: id: %s tlf: %s",
					convRes.ConvID, convRes.ConvRes.Info.TLFNameExpanded())
				chatUI.ChatInboxConversation(ctx, chat1.ChatInboxConversationArg{
					SessionID: arg.SessionID,
					Conv:      *convRes.ConvRes,
				})
			}
			wg.Done()
		}(convRes)
	}
	wg.Wait()

	res.Offline = h.G().InboxSource.IsOffline()
	res.IdentifyFailures = breaks
	return res, nil
}

func (h *chatLocalHandler) MarkAsReadLocal(ctx context.Context, arg chat1.MarkAsReadLocalArg) (res chat1.MarkAsReadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "MarkAsReadLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.MarkAsReadLocalRes{}, err
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
func (h *chatLocalHandler) GetInboxAndUnboxLocal(ctx context.Context, arg chat1.GetInboxAndUnboxLocalArg) (res chat1.GetInboxAndUnboxLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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
	localizer := chat.NewBlockingLocalizer(h.G(), h.tlfInfoSource)
	ib, rl, err := h.G().InboxSource.Read(ctx, uid.ToBytes(), localizer, true, arg.Query,
		arg.Pagination)
	if err != nil {
		return res, err
	}

	res = chat1.GetInboxAndUnboxLocalRes{
		Conversations:    ib.Convs,
		Pagination:       ib.Pagination,
		Offline:          h.G().InboxSource.IsOffline(),
		RateLimits:       utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
		IdentifyFailures: identBreaks,
	}

	return res, nil
}

func (h *chatLocalHandler) GetCachedThread(ctx context.Context, arg chat1.GetCachedThreadArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetCachedThread")()
	defer h.handleOfflineError(ctx, err, &res)
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
		Offline:          h.G().ConvSource.IsOffline(),
		IdentifyFailures: identBreaks,
	}, nil
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *chatLocalHandler) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "GetThreadLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.GetThreadLocalRes{}, err
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
		Offline:          h.G().ConvSource.IsOffline(),
		RateLimits:       utils.AggRateLimitsP(rl),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *chatLocalHandler) GetThreadNonblock(ctx context.Context, arg chat1.GetThreadNonblockArg) (res chat1.NonblockFetchRes, fullErr error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return fullErr }, "GetThreadNonblock")()
	defer func() { fullErr = h.handleOfflineError(ctx, fullErr, &res) }()
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	// Grab local copy first
	uid := h.G().Env.GetUID()
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
				gregor1.UID(uid.ToBytes()), arg.Query, arg.Pagination)
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
		h.Debug(ctx, "GetThreadNonblock: cached thread sent")
		chatUI.ChatThreadCached(bctx, chat1.ChatThreadCachedArg{
			SessionID: arg.SessionID,
			Thread:    resThread,
		})
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()

		// Run the full Pull operation, and redo pagination
		var remoteThread chat1.ThreadView
		var rl []*chat1.RateLimit
		remoteThread, rl, fullErr = h.G().ConvSource.Pull(bctx, arg.ConversationID,
			gregor1.UID(uid.ToBytes()), arg.Query, arg.Pagination)
		if fullErr != nil {
			h.Debug(ctx, "GetThreadNonblock: error running Pull, returning error: %s", fullErr.Error())
			return
		}
		res.RateLimits = utils.AggRateLimitsP(rl)

		// Acquire lock and send up actual response
		uilock.Lock()
		defer uilock.Unlock()
		h.Debug(ctx, "GetThreadNonblock: full thread sent")
		chatUI.ChatThreadFull(bctx, chat1.ChatThreadFullArg{
			SessionID: arg.SessionID,
			Thread:    remoteThread,
		})

		// This means we transmitted with success, so cancel local thread
		cancel()
	}()
	wg.Wait()

	// Clean up context
	cancel()

	res.Offline = h.G().ConvSource.IsOffline()
	return res, fullErr
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
// Create a new conversation. Or in the case of CHAT, create-or-get a conversation.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, arg chat1.NewConversationLocalArg) (res chat1.NewConversationLocalRes, reserr error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return reserr }, "NewConversationLocal")()
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	info, err := h.tlfInfoSource.Lookup(ctx, arg.TlfName, arg.TlfVisibility)
	if err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	triple := chat1.ConversationIDTriple{
		Tlfid:     info.ID,
		TopicType: arg.TopicType,
		TopicID:   make(chat1.TopicID, 16),
	}

	for i := 0; i < 3; i++ {
		h.Debug(ctx, "NewConversationLocal: attempt: %v", i)
		triple.TopicID, err = utils.NewChatTopicID()
		if err != nil {
			return chat1.NewConversationLocalRes{}, fmt.Errorf("error creating topic ID: %s", err)
		}

		firstMessageBoxed, err := h.makeFirstMessage(ctx, triple, info.CanonicalName, arg.TlfVisibility, arg.TopicName)
		if err != nil {
			return chat1.NewConversationLocalRes{}, fmt.Errorf("error preparing message: %s", err)
		}

		var ncrres chat1.NewConversationRemoteRes
		ncrres, reserr = h.remoteClient().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
			IdTriple:   triple,
			TLFMessage: *firstMessageBoxed,
		})
		if ncrres.RateLimit != nil {
			res.RateLimits = append(res.RateLimits, *ncrres.RateLimit)
		}
		convID := ncrres.ConvID
		if reserr != nil {
			switch cerr := reserr.(type) {
			case libkb.ChatConvExistsError:
				// This triple already exists.
				h.Debug(ctx, "NewConversationLocal: conv exists: %v", cerr.ConvID)

				if triple.TopicType != chat1.TopicType_CHAT {
					// Not a chat conversation. Multiples are fine. Just retry with a
					// different topic ID.
					continue
				}
				// A chat conversation already exists; just reuse it.
				// Note that from this point on, TopicID is entirely the wrong value.
				convID = cerr.ConvID
			case libkb.ChatCollisionError:
				// The triple did not exist, but a collision occurred on convID. Retry with a different topic ID.
				h.Debug(ctx, "NewConversationLocal: collision: %v", reserr)
				continue
			default:
				return chat1.NewConversationLocalRes{}, fmt.Errorf("error creating conversation: %s", reserr)
			}
		}

		h.Debug(ctx, "NewConversationLocal: established conv: %v", convID)

		// create succeeded; grabbing the conversation and returning
		uid := h.G().Env.GetUID()

		ib, rl, err := h.G().InboxSource.Read(ctx, uid.ToBytes(), nil, false,
			&chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{convID},
			}, nil)
		if err != nil {
			return chat1.NewConversationLocalRes{}, err
		}
		if rl != nil {
			res.RateLimits = append(res.RateLimits, *rl)
		}

		if len(ib.Convs) != 1 {
			return chat1.NewConversationLocalRes{}, fmt.Errorf("newly created conversation fetch error: found %d conversations", len(ib.Convs))
		}
		res.Conv = ib.Convs[0]
		h.Debug(ctx, "NewConversationLocal: fetched conv: %v", res.Conv.GetConvID())

		// Update inbox cache
		updateConv := ib.ConvsUnverified[0]
		if err = h.G().InboxSource.NewConversation(ctx, uid.ToBytes(), 0, updateConv); err != nil {
			return chat1.NewConversationLocalRes{}, err
		}

		if res.Conv.Error != nil {
			return chat1.NewConversationLocalRes{}, errors.New(res.Conv.Error.Message)
		}

		res.IdentifyFailures = identBreaks
		return res, nil
	}

	return chat1.NewConversationLocalRes{}, reserr
}

func (h *chatLocalHandler) makeFirstMessage(ctx context.Context, triple chat1.ConversationIDTriple, tlfName string, tlfVisibility chat1.TLFVisibility, topicName *string) (*chat1.MessageBoxed, error) {
	var msg chat1.MessagePlaintext
	if topicName != nil {
		msg = chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        triple,
				TlfName:     tlfName,
				TlfPublic:   tlfVisibility == chat1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_METADATA,
				Prev:        nil, // TODO
				// Sender and SenderDevice filled by prepareMessageForRemote
			},
			MessageBody: chat1.NewMessageBodyWithMetadata(
				chat1.MessageConversationMetadata{
					ConversationTitle: *topicName,
				}),
		}
	} else {
		msg = chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        triple,
				TlfName:     tlfName,
				TlfPublic:   tlfVisibility == chat1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_TLFNAME,
				Prev:        nil, // TODO
				// Sender and SenderDevice filled by prepareMessageForRemote
			},
		}
	}

	sender := chat.NewBlockingSender(h.G(), h.boxer, h.store, h.remoteClient)
	mbox, _, err := sender.Prepare(ctx, msg, nil)
	return mbox, err
}

func (h *chatLocalHandler) GetInboxSummaryForCLILocal(ctx context.Context, arg chat1.GetInboxSummaryForCLILocalQuery) (res chat1.GetInboxSummaryForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks, h.identNotifier)
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
	if arg.Visibility != chat1.TLFVisibility_ANY {
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

func (h *chatLocalHandler) GetConversationForCLILocal(ctx context.Context, arg chat1.GetConversationForCLILocalQuery) (res chat1.GetConversationForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks, h.identNotifier)
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

func (h *chatLocalHandler) GetMessagesLocal(ctx context.Context, arg chat1.GetMessagesLocalArg) (res chat1.GetMessagesLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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
	conv, rl, err := utils.GetUnverifiedConv(ctx, h.G(), uid.ToBytes(), arg.ConversationID, true)
	if err != nil {
		return deflt, err
	}
	if rl != nil {
		rlimits = append(rlimits, *rl)
	}

	// use ConvSource to get the messages, to try the cache first
	messages, err := h.G().ConvSource.GetMessages(ctx, arg.ConversationID, uid.ToBytes(), arg.MessageIDs, conv.Metadata.FinalizeInfo)
	if err != nil {
		return deflt, err
	}

	// unless arg says not to, transform the superseded messages
	if !arg.DisableResolveSupersedes {
		messages, err = h.G().ConvSource.TransformSupersedes(ctx, arg.ConversationID, uid.ToBytes(), messages, conv.Metadata.FinalizeInfo)
		if err != nil {
			return deflt, err
		}
	}

	return chat1.GetMessagesLocalRes{
		Messages:         messages,
		Offline:          h.G().ConvSource.IsOffline(),
		RateLimits:       utils.AggRateLimits(rlimits),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *chatLocalHandler) SetConversationStatusLocal(ctx context.Context, arg chat1.SetConversationStatusLocalArg) (res chat1.SetConversationStatusLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "SetConversationStatusLocal")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}

	scsres, err := h.remoteClient().SetConversationStatus(ctx, chat1.SetConversationStatusArg{
		ConversationID: arg.ConversationID,
		Status:         arg.Status,
	})
	if err != nil {
		return chat1.SetConversationStatusLocalRes{}, err
	}

	return chat1.SetConversationStatusLocalRes{
		RateLimits:       utils.AggRateLimitsP([]*chat1.RateLimit{scsres.RateLimit}),
		IdentifyFailures: identBreaks,
	}, nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *chatLocalHandler) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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

	sender := chat.NewBlockingSender(h.G(), h.boxer, h.store, h.remoteClient)

	_, msgID, rl, err := sender.Send(ctx, arg.ConversationID, arg.Msg, 0)
	if err != nil {
		return chat1.PostLocalRes{}, fmt.Errorf("PostLocal: unable to send message: %s", err.Error())
	}

	return chat1.PostLocalRes{
		RateLimits:       utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
		MessageID:        msgID,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *chatLocalHandler) PostDeleteNonblock(ctx context.Context, arg chat1.PostDeleteNonblockArg) (chat1.PostLocalNonblockRes, error) {

	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.Conv = arg.Conv
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_DELETE
	parg.Msg.ClientHeader.Supersedes = arg.Supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic

	return h.PostLocalNonblock(ctx, parg)
}

func (h *chatLocalHandler) PostEditNonblock(ctx context.Context, arg chat1.PostEditNonblockArg) (chat1.PostLocalNonblockRes, error) {

	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.Conv = arg.Conv
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

func (h *chatLocalHandler) PostTextNonblock(ctx context.Context, arg chat1.PostTextNonblockArg) (chat1.PostLocalNonblockRes, error) {

	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.Conv = arg.Conv
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_TEXT
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: arg.Body,
	})

	return h.PostLocalNonblock(ctx, parg)

}

func (h *chatLocalHandler) PostLocalNonblock(ctx context.Context, arg chat1.PostLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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
	sender := chat.NewBlockingSender(h.G(), h.boxer, h.store, h.remoteClient)
	nonblockSender := chat.NewNonblockingSender(h.G(), sender)

	obid, _, rl, err := nonblockSender.Send(ctx, arg.ConversationID, arg.Msg, arg.ClientPrev)
	if err != nil {
		return chat1.PostLocalNonblockRes{},
			fmt.Errorf("PostLocalNonblock: unable to send message: err: %s", err.Error())
	}
	return chat1.PostLocalNonblockRes{
		OutboxID:         obid,
		RateLimits:       utils.AggRateLimitsP([]*chat1.RateLimit{rl}),
		IdentifyFailures: identBreaks,
	}, nil
}

// PostAttachmentLocal implements chat1.LocalInterface.PostAttachmentLocal.
func (h *chatLocalHandler) PostAttachmentLocal(ctx context.Context, arg chat1.PostAttachmentLocalArg) (res chat1.PostLocalRes, err error) {
	defer h.Trace(ctx, func() error { return err }, "PostAttachmentLocal")()
	parg := postAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		ClientHeader:     arg.ClientHeader,
		Attachment:       newStreamSource(arg.Attachment),
		Title:            arg.Title,
		Metadata:         arg.Metadata,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	defer parg.Attachment.Close()

	if arg.Preview != nil {
		parg.Preview = newStreamSource(*arg.Preview)
		defer parg.Preview.Close()
	}

	return h.postAttachmentLocal(ctx, parg)
}

// PostFileAttachmentLocal implements chat1.LocalInterface.PostFileAttachmentLocal.
func (h *chatLocalHandler) PostFileAttachmentLocal(ctx context.Context, arg chat1.PostFileAttachmentLocalArg) (res chat1.PostLocalRes, err error) {
	defer h.Trace(ctx, func() error { return err }, "PostFileAttachmentLocal")()
	parg := postAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		ClientHeader:     arg.ClientHeader,
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
		psrc, err := newFileSource(*arg.Preview)
		if err != nil {
			return chat1.PostLocalRes{}, err
		}
		parg.Preview = psrc
		defer parg.Preview.Close()
	}

	return h.postAttachmentLocal(ctx, parg)
}

// postAttachmentArg is a shared arg struct for the multiple PostAttachment* endpoints
type postAttachmentArg struct {
	SessionID        int
	ConversationID   chat1.ConversationID
	ClientHeader     chat1.MessageClientHeader
	Attachment       assetSource
	Preview          assetSource
	Title            string
	Metadata         []byte
	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

func (h *chatLocalHandler) postAttachmentLocal(ctx context.Context, arg postAttachmentArg) (res chat1.PostLocalRes, err error) {
	if os.Getenv("KEYBASE_CHAT_ATTACHMENT_ORDERED") == "1" {
		return h.postAttachmentLocalInOrder(ctx, arg)
	}

	if os.Getenv("CHAT_S3_FAKE") == "1" {
		ctx = s3.NewFakeS3Context(ctx)
	}
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int) {
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
		h.Debug(ctx, "created preview in preprocess")
		arg.Preview = pre.Preview
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

	g.Go(func() error {
		chatUI.ChatAttachmentUploadStart(ctx, pre.BaseMetadata(), 0)
		var err error
		object, err = h.uploadAsset(ctx, arg.SessionID, params, arg.Attachment, arg.ConversationID, progress)
		chatUI.ChatAttachmentUploadDone(ctx)
		if err != nil {
			h.Debug(ctx, "error uploading primary asset to s3: %s", err)
		}
		return err
	})

	if arg.Preview != nil {
		g.Go(func() error {
			chatUI.ChatAttachmentPreviewUploadStart(ctx, pre.PreviewMetadata())
			// copy the params so as not to mess with the main params above
			previewParams := params

			// add preview suffix to object key (P in hex)
			// the s3path in gregor is expecting hex here
			previewParams.ObjectKey += "50"
			prev, err := h.uploadAsset(ctx, arg.SessionID, previewParams, arg.Preview, arg.ConversationID, nil)
			chatUI.ChatAttachmentPreviewUploadDone(ctx)
			if err == nil {
				preview = &prev
			} else {
				h.Debug(ctx, "error uploading preview asset to s3: %s", err)
			}
			return err
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

	attachment := chat1.MessageAttachment{
		Object:   object,
		Metadata: arg.Metadata,
		Uploaded: true,
	}
	if preview != nil {
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
	postArg.Msg.ClientHeader.Conv = arg.ClientHeader.Conv
	postArg.Msg.ClientHeader.MessageType = chat1.MessageType_ATTACHMENT
	postArg.Msg.ClientHeader.TlfName = arg.ClientHeader.TlfName
	postArg.Msg.ClientHeader.TlfPublic = arg.ClientHeader.TlfPublic

	h.Debug(ctx, "attachment assets uploaded, posting attachment message")
	plres, err := h.PostLocal(ctx, postArg)
	if err != nil {
		h.Debug(ctx, "error posting attachment message: %s", err)
	} else {
		h.Debug(ctx, "posted attachment message successfully")
	}

	return plres, err
}

func (h *chatLocalHandler) postAttachmentLocalInOrder(ctx context.Context, arg postAttachmentArg) (res chat1.PostLocalRes, err error) {
	h.Debug(ctx, "using postAttachmentLocalInOrder flow to upload attachment")
	if os.Getenv("CHAT_S3_FAKE") == "1" {
		ctx = s3.NewFakeS3Context(ctx)
	}
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int) {
		parg := chat1.ChatAttachmentUploadProgressArg{
			SessionID:     arg.SessionID,
			BytesComplete: bytesComplete,
			BytesTotal:    bytesTotal,
		}
		chatUI.ChatAttachmentUploadProgress(ctx, parg)
	}

	// Send a placeholder attachment message that will
	// be edited after the assets are uploaded.  Sending
	// it now to preserve the order of send messages.
	placeholder, err := h.postAttachmentPlaceholder(ctx, arg)
	if err != nil {
		return placeholder, err
	}
	h.Debug(ctx, "placeholder message id: %v", placeholder.MessageID)

	// if there are any errors going forward, delete the placeholder message
	defer func() {
		if err == nil {
			return
		}

		h.Debug(ctx, "postAttachmentLocal error after placeholder message sent, deleting placeholder message")
		deleteArg := chat1.PostDeleteNonblockArg{
			ConversationID:   arg.ConversationID,
			IdentifyBehavior: arg.IdentifyBehavior,
			Conv:             arg.ClientHeader.Conv,
			Supersedes:       placeholder.MessageID,
			TlfName:          arg.ClientHeader.TlfName,
			TlfPublic:        arg.ClientHeader.TlfPublic,
		}
		_, derr := h.PostDeleteNonblock(ctx, deleteArg)
		if derr != nil {
			h.Debug(ctx, "error deleting placeholder message: %s", derr)
		}
	}()

	// preprocess asset (get content type, create preview if possible)
	pre, err := h.preprocessAsset(ctx, arg.SessionID, arg.Attachment, arg.Preview)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}
	if pre.Preview != nil {
		h.Debug(ctx, "created preview in preprocess")
		arg.Preview = pre.Preview
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

	g.Go(func() error {
		chatUI.ChatAttachmentUploadStart(ctx, pre.BaseMetadata(), placeholder.MessageID)
		var err error
		object, err = h.uploadAsset(ctx, arg.SessionID, params, arg.Attachment, arg.ConversationID, progress)
		chatUI.ChatAttachmentUploadDone(ctx)
		if err != nil {
			h.Debug(ctx, "error uploading primary asset to s3: %s", err)
		}
		return err
	})

	if arg.Preview != nil {
		g.Go(func() error {
			chatUI.ChatAttachmentPreviewUploadStart(ctx, pre.PreviewMetadata())
			// copy the params so as not to mess with the main params above
			previewParams := params

			// add preview suffix to object key (P in hex)
			// the s3path in gregor is expecting hex here
			previewParams.ObjectKey += "50"
			prev, err := h.uploadAsset(ctx, arg.SessionID, previewParams, arg.Preview, arg.ConversationID, nil)
			chatUI.ChatAttachmentPreviewUploadDone(ctx)
			if err == nil {
				preview = &prev
			} else {
				h.Debug(ctx, "error uploading preview asset to s3: %s", err)
			}
			return err
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
	postArg.Msg.ClientHeader.Conv = arg.ClientHeader.Conv
	postArg.Msg.ClientHeader.MessageType = chat1.MessageType_ATTACHMENTUPLOADED
	postArg.Msg.ClientHeader.Supersedes = placeholder.MessageID
	postArg.Msg.ClientHeader.TlfName = arg.ClientHeader.TlfName
	postArg.Msg.ClientHeader.TlfPublic = arg.ClientHeader.TlfPublic

	h.Debug(ctx, "attachment assets uploaded, posting attachment message")
	plres, err := h.PostLocal(ctx, postArg)
	if err != nil {
		h.Debug(ctx, "error posting attachment message: %s", err)
	} else {
		h.Debug(ctx, "posted attachment message successfully")
	}

	return plres, err
}

// DownloadAttachmentLocal implements chat1.LocalInterface.DownloadAttachmentLocal.
func (h *chatLocalHandler) DownloadAttachmentLocal(ctx context.Context, arg chat1.DownloadAttachmentLocalArg) (res chat1.DownloadAttachmentLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
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
func (h *chatLocalHandler) DownloadFileAttachmentLocal(ctx context.Context, arg chat1.DownloadFileAttachmentLocalArg) (res chat1.DownloadAttachmentLocalRes, err error) {
	defer h.Trace(ctx, func() error { return err }, "DownloadFileAttachmentLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	darg := downloadAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		MessageID:        arg.MessageID,
		Preview:          arg.Preview,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	sink, err := os.Create(arg.Filename)
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

func (h *chatLocalHandler) downloadAttachmentLocal(ctx context.Context, arg downloadAttachmentArg) (chat1.DownloadAttachmentLocalRes, error) {

	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	chatUI := h.getChatUI(arg.SessionID)
	progress := func(bytesComplete, bytesTotal int) {
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

func (h *chatLocalHandler) CancelPost(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "CancelPost")()
	if err = h.assertLoggedIn(ctx); err != nil {
		return err
	}

	uid := h.G().Env.GetUID()
	outbox := storage.NewOutbox(h.G(), uid.ToBytes())
	if err = outbox.RemoveMessage(ctx, outboxID); err != nil {
		return err
	}

	return nil
}

func (h *chatLocalHandler) RetryPost(ctx context.Context, outboxID chat1.OutboxID) (err error) {
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

// getSecretUI returns a SecretUI, preferring a delegated SecretUI if
// possible.
func (h *chatLocalHandler) getSecretUI() libkb.SecretUI {
	ui, err := h.G().UIRouter.GetSecretUI(0)
	if err == nil && ui != nil {
		h.Debug(context.Background(), "chatLocalHandler: using delegated SecretUI")
		return ui
	}
	h.Debug(context.Background(), "chatLocalHandler: using local SecretUI")
	return h.BaseHandler.getSecretUI(0, h.G())
}

// remoteClient returns a client connection to gregord.
func (h *chatLocalHandler) remoteClient() chat1.RemoteInterface {
	if h.rc != nil {
		return h.rc
	}
	return &chat1.RemoteClient{Cli: h.gh.cli}
}

func (h *chatLocalHandler) setTestRemoteClient(ri chat1.RemoteInterface) {
	h.rc = ri
}

func (h *chatLocalHandler) assertLoggedIn(ctx context.Context) error {
	ok, err := h.G().LoginState().LoggedInProvisionedLoad()
	if err != nil {
		if _, ok := err.(libkb.APINetError); ok {
			h.Debug(ctx, "assertLoggedIn: skipping API error and returning success")
			return nil
		}
		return err
	}
	if !ok {
		return libkb.LoginRequiredError{}
	}
	return nil
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (h *chatLocalHandler) Sign(payload []byte) ([]byte, error) {
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return h.remoteClient().S3Sign(context.Background(), arg)
}

func (h *chatLocalHandler) postAttachmentPlaceholder(ctx context.Context, arg postAttachmentArg) (chat1.PostLocalRes, error) {
	attachment := chat1.MessageAttachment{
		Metadata: arg.Metadata,
	}
	postArg := chat1.PostLocalArg{
		ConversationID: arg.ConversationID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: arg.ClientHeader,
			MessageBody:  chat1.NewMessageBodyWithAttachment(attachment),
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
	Preview            *chat.BufferSource
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

func (h *chatLocalHandler) preprocessAsset(ctx context.Context, sessionID int, attachment, preview assetSource) (*preprocess, error) {
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
		previewRes, err := chat.Preview(ctx, h.G().Log, src, p.ContentType, attachment.Basename(), attachment.FileSize())
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
	}

	return &p, nil
}

func (h *chatLocalHandler) uploadAsset(ctx context.Context, sessionID int, params chat1.S3Params, local assetSource, conversationID chat1.ConversationID, progress chat.ProgressReporter) (chat1.Asset, error) {
	// create a buffered stream
	cli := h.getStreamUICli()
	src, err := local.Open(sessionID, cli)
	if err != nil {
		return chat1.Asset{}, err
	}

	task := chat.UploadTask{
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

func (h *chatLocalHandler) attachmentMessage(ctx context.Context, conversationID chat1.ConversationID, msgID chat1.MessageID, idBehavior keybase1.TLFIdentifyBehavior) (*chat1.MessageAttachment, []chat1.RateLimit, error) {
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

func (h *chatLocalHandler) deleteAssets(ctx context.Context, conversationID chat1.ConversationID, assets []chat1.Asset) {
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

func (h *chatLocalHandler) FindConversationsLocal(ctx context.Context,
	arg chat1.FindConversationsLocalArg) (res chat1.FindConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, func() error { return err }, "FindConversationsLocal")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if err = h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	uid := h.G().Env.GetUID()

	// First look in the local user inbox
	query := chat1.GetInboxLocalQuery{
		TlfName:           &arg.TlfName,
		TlfVisibility:     &arg.Visibility,
		TopicType:         &arg.TopicType,
		TopicName:         &arg.TopicName,
		OneChatTypePerTLF: arg.OneChatPerTLF,
	}
	inbox, err := h.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
		Query:            &query,
		IdentifyBehavior: arg.IdentifyBehavior,
	})
	if err != nil {
		return res, err
	}
	res.RateLimits = append(res.RateLimits, inbox.RateLimits...)
	res.IdentifyFailures = inbox.IdentifyFailures
	res.Offline = h.G().InboxSource.IsOffline()

	// If we have inbox hits, return those
	if len(inbox.Conversations) > 0 {
		h.Debug(ctx, "FindConversation: found conversations in inbox: tlfName: %s num: %d",
			arg.TlfName, len(inbox.Conversations))
		res.Conversations = inbox.Conversations
	} else if arg.Visibility == chat1.TLFVisibility_PUBLIC {
		h.Debug(ctx, "FindConversation: no conversations found in inbox, trying public chats")

		// Check for offline and return an error
		if res.Offline {
			return res, chat.OfflineError{}
		}

		// If we miss the inbox, and we are looking for a public TLF, let's try and find
		// any conversation that matches
		tlfInfo, err := chat.GetInboxQueryTLFInfo(ctx, h.tlfInfoSource, &query)
		if err != nil {
			return res, err
		}

		// Call into gregor to try and find some public convs
		pubConvs, err := h.remoteClient().GetPublicConversations(ctx, chat1.GetPublicConversationsArg{
			TlfID:            tlfInfo.ID,
			TopicType:        arg.TopicType,
			SummarizeMaxMsgs: true,
		})
		if err != nil {
			return res, err
		}
		if pubConvs.RateLimit != nil {
			res.RateLimits = append(res.RateLimits, *pubConvs.RateLimit)
		}

		// Localize the convs (if any)
		if len(pubConvs.Conversations) > 0 {
			localizer := chat.NewBlockingLocalizer(h.G(), h.tlfInfoSource)
			convsLocal, err := localizer.Localize(ctx, uid.ToBytes(), chat1.Inbox{
				ConvsUnverified: pubConvs.Conversations,
			})
			if err != nil {
				return res, nil
			}

			// Search for conversations that match the topic name
			for _, convLocal := range convsLocal {
				if convLocal.Info.TopicName == arg.TopicName {
					h.Debug(ctx, "FindConversation: found matching public conv: id: %s topicName: %s",
						convLocal.GetConvID(), arg.TopicName)
					res.Conversations = append(res.Conversations, convLocal)
				}
			}
		}

	}

	res.RateLimits = utils.AggRateLimits(res.RateLimits)
	return res, nil
}
