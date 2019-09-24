package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

type UIInboxLoader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid     gregor1.UID
	stopCh  chan struct{}
	started bool
	eg      errgroup.Group

	clock             clockwork.Clock
	transmitCh        chan interface{}
	convTransmitBatch map[string]chat1.ConversationLocal
	batchDelay        time.Duration
	lastBatchFlush    time.Time
}

func NewUIInboxLoader(g *globals.Context) *UIInboxLoader {
	return &UIInboxLoader{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g.GetLog(), "UIInboxLoader", false),
		convTransmitBatch: make(map[string]chat1.ConversationLocal),
		clock:             clockwork.NewRealClock(),
		batchDelay:        200 * time.Millisecond,
	}
}

func (h *UIInboxLoader) Start(ctx context.Context, uid gregor1.UID) {
	defer h.Trace(ctx, func() error { return nil }, "Start")()
	h.Lock()
	defer h.Unlock()
	if h.started {
		return
	}
	h.transmitCh = make(chan interface{}, 1000)
	h.stopCh = make(chan struct{})
	h.started = true
	h.uid = uid
	h.eg.Go(func() error { return h.transmitLoop(h.stopCh) })
}

func (h *UIInboxLoader) Stop(ctx context.Context) chan struct{} {
	defer h.Trace(ctx, func() error { return nil }, "Stop")()
	h.Lock()
	defer h.Unlock()
	ch := make(chan struct{})
	if h.started {
		close(h.stopCh)
		h.started = false
		go func() {
			err := h.eg.Wait()
			if err != nil {
				h.Debug(ctx, "Stop: error waiting: %+v", err)
			}
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (h *UIInboxLoader) getChatUI(ctx context.Context) (libkb.ChatUI, error) {
	ui, err := h.G().UIRouter.GetChatUI()
	if err != nil {
		return nil, err
	}
	if ui == nil {
		h.Debug(ctx, "getChatUI: no chat UI found")
		return nil, errors.New("no chat UI available")
	}
	return ui, nil
}

func (h *UIInboxLoader) presentUnverifiedInbox(ctx context.Context, convs []types.RemoteConversation,
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

type unverifiedResponse struct {
	Convs      []types.RemoteConversation
	Query      *chat1.GetInboxLocalQuery
	Pagination *chat1.Pagination
}

type conversationResponse struct {
	Conv chat1.ConversationLocal
}

type failedResponse struct {
	Conv chat1.ConversationLocal
}

func (h *UIInboxLoader) flushConvBatch() (err error) {
	if len(h.convTransmitBatch) == 0 {
		return nil
	}
	ctx := context.Background()
	var convs []chat1.ConversationLocal
	for _, conv := range h.convTransmitBatch {
		convs = append(convs, conv)
	}
	h.lastBatchFlush = h.clock.Now()
	h.convTransmitBatch = make(map[string]chat1.ConversationLocal) // clear batch always
	defer func() {
		if err != nil {
			h.Debug(ctx, "flushConvBatch: failed to transmit, retrying convs: num: %d err: %s",
				len(convs), err)
			for _, conv := range convs {
				h.G().FetchRetrier.Failure(ctx, h.uid,
					NewConversationRetry(h.G(), conv.GetConvID(), &conv.Info.Triple.Tlfid, InboxLoad))
			}
		}
		if err = h.G().InboxSource.MergeLocalMetadata(ctx, h.uid, convs); err != nil {
			h.Debug(ctx, "flushConvBatch: unable to write inbox local metadata: %s", err)
		}
	}()

	dat, err := json.Marshal(utils.PresentConversationLocals(ctx, h.G(), h.uid, convs))
	if err != nil {
		return err
	}
	ui, err := h.getChatUI(ctx)
	if err != nil {
		return err
	}
	return ui.ChatInboxConversation(ctx, chat1.ChatInboxConversationArg{
		Convs: string(dat),
	})
}

func (h *UIInboxLoader) flushUnverified(r unverifiedResponse) (err error) {
	ctx := context.Background()
	defer func() {
		if err != nil {
			h.Debug(ctx, "flushUnverified: failed to transmit, retrying: %s", err)
			h.G().FetchRetrier.Failure(ctx, h.uid, NewFullInboxRetry(h.G(), r.Query, r.Pagination))
		}
	}()
	uires, err := h.presentUnverifiedInbox(ctx, r.Convs, r.Pagination, h.G().InboxSource.IsOffline(ctx))
	if err != nil {
		h.Debug(ctx, "flushUnverified: failed to present untrusted inbox, failing: %s", err.Error())
		return err
	}
	jbody, err := json.Marshal(uires)
	if err != nil {
		h.Debug(ctx, "flushUnverified: failed to JSON up unverified inbox: %s", err.Error())
		return err
	}
	ui, err := h.getChatUI(ctx)
	if err != nil {
		return err
	}
	start := time.Now()
	h.Debug(ctx, "flushUnverified: sending unverified inbox: num convs: %d bytes: %d", len(r.Convs),
		len(jbody))
	if err := ui.ChatInboxUnverified(ctx, chat1.ChatInboxUnverifiedArg{
		Inbox: string(jbody),
	}); err != nil {
		h.Debug(ctx, "flushUnverified: failed to send unverfified inbox: %s", err)
		return err
	}
	h.Debug(ctx, "LoadNonblock: sent unverified inbox successfully: %v", time.Since(start))
	return nil
}

func (h *UIInboxLoader) flushFailed(r failedResponse) {
	ctx := context.Background()
	ui, err := h.getChatUI(ctx)
	if err == nil {
		if err := ui.ChatInboxFailed(ctx, chat1.ChatInboxFailedArg{
			ConvID: r.Conv.GetConvID(),
			Error:  utils.PresentConversationErrorLocal(ctx, h.G(), *r.Conv.Error),
		}); err != nil {
			h.Debug(ctx, "flushFailed: failed to send failed conv: %s", err)
		}
	}
	// If we get a transient failure, add this to the retrier queue
	if r.Conv.Error.Typ == chat1.ConversationErrorType_TRANSIENT {
		h.G().FetchRetrier.Failure(ctx, h.uid,
			NewConversationRetry(h.G(), r.Conv.GetConvID(), &r.Conv.Info.Triple.Tlfid, InboxLoad))
	}
}

func (h *UIInboxLoader) transmitOnce(imsg interface{}) {
	switch msg := imsg.(type) {
	case unverifiedResponse:
		_ = h.flushConvBatch()
		_ = h.flushUnverified(msg)
	case failedResponse:
		_ = h.flushConvBatch()
		h.flushFailed(msg)
	case conversationResponse:
		h.convTransmitBatch[msg.Conv.GetConvID().String()] = msg.Conv
		if h.clock.Since(h.lastBatchFlush) > h.batchDelay {
			_ = h.flushConvBatch()
		}
	}
}

func (h *UIInboxLoader) transmitLoop(shutdownCh chan struct{}) error {
	for {
		select {
		case msg := <-h.transmitCh:
			h.transmitOnce(msg)
		case <-h.clock.After(h.batchDelay):
			_ = h.flushConvBatch()
		case <-shutdownCh:
			return nil
		}
	}
}

func (h *UIInboxLoader) LoadNonblock(ctx context.Context, query *chat1.GetInboxLocalQuery,
	pagination *chat1.Pagination, maxUnbox *int, skipUnverified bool) (err error) {
	defer h.Trace(ctx, func() error { return err }, "LoadNonblock")()
	uid := h.uid
	// Retry helpers
	retryInboxLoad := func() {
		h.G().FetchRetrier.Failure(ctx, uid, NewFullInboxRetry(h.G(), query, pagination))
	}
	retryConvLoad := func(convID chat1.ConversationID, tlfID *chat1.TLFID) {
		h.G().FetchRetrier.Failure(ctx, uid, NewConversationRetry(h.G(), convID, tlfID, InboxLoad))
	}
	defer func() {
		// handle errors on the main processing thread, any errors during localizaton are handled
		// in the goroutine for localization callbacks
		if err != nil {
			if query != nil && len(query.ConvIDs) > 0 {
				h.Debug(ctx, "LoadNonblock: failed to load convID query, retrying all convs")
				for _, convID := range query.ConvIDs {
					retryConvLoad(convID, nil)
				}
			} else {
				h.Debug(ctx, "LoadNonblock: failed to load general query, retrying")
				retryInboxLoad()
			}
		}
	}()

	// Invoke nonblocking inbox read and get remote inbox version to send back
	// as our result
	_, localizeCb, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerNonblocking,
		types.InboxSourceDataSourceAll, maxUnbox, query, pagination)
	if err != nil {
		return err
	}

	// Wait for inbox to get sent to us
	var lres types.AsyncInboxResult
	if skipUnverified {
		select {
		case lres = <-localizeCb:
			h.Debug(ctx, "LoadNonblock: received unverified inbox, skipping send")
		case <-time.After(time.Minute):
			return fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
			h.Debug(ctx, "LoadNonblock: context canceled waiting for unverified (skip): %s")
			return ctx.Err()
		}
	} else {
		select {
		case lres = <-localizeCb:
			if lres.InboxRes == nil {
				return fmt.Errorf("invalid conversation localize callback received")
			}
			h.transmitCh <- unverifiedResponse{
				Convs:      lres.InboxRes.ConvsUnverified,
				Query:      query,
				Pagination: pagination,
			}
		case <-time.After(time.Minute):
			return fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
			h.Debug(ctx, "LoadNonblock: context canceled waiting for unverified")
			return ctx.Err()
		}
	}

	// Consume localize callbacks and send out to UI.
	for convRes := range localizeCb {
		go func(convRes types.AsyncInboxResult) {
			if convRes.ConvLocal.Error != nil {
				h.Debug(ctx, "LoadNonblock: *** error conv: id: %s err: %s",
					convRes.Conv.GetConvID(), convRes.ConvLocal.Error.Message)
				h.transmitCh <- failedResponse{
					Conv: convRes.ConvLocal,
				}
			} else {
				h.transmitCh <- conversationResponse{
					Conv: convRes.ConvLocal,
				}
			}
		}(convRes)
	}
	return nil
}
