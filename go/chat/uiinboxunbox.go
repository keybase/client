package chat

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

const (
	inboxUnboxAttempts     = 2
	inboxUnboxRetryBackoff = time.Second
	// how long a pass waits on the localizer, which a suspend holds for as long as it lasts
	inboxUnboxLocalizeTimeout = 30 * time.Second
)

// inboxUnboxPass reads and localizes convIDs and sends the UI a final result for each one, except the
// convs it returns: those failed transiently and want another attempt. On the final attempt it
// returns nothing, sending those failures as they are.
type inboxUnboxPass func(ctx context.Context, convIDs []chat1.ConversationID, final bool) (retry []chat1.ConversationID)

// inboxUnboxer runs the UI's unbox requests for one session. A conv is unboxed by one pass at a time;
// a request for a conv already being unboxed joins that pass, and a forced one gets one more pass
// after it.
type inboxUnboxer struct {
	sync.Mutex
	clock    clockwork.Clock
	pass     inboxUnboxPass
	canRetry func(ctx context.Context) bool
	// convs with a pass running; true when a forced request came in meanwhile
	running map[chat1.ConvIDStr]bool
}

func newInboxUnboxer(clock clockwork.Clock, pass inboxUnboxPass, canRetry func(context.Context) bool) *inboxUnboxer {
	return &inboxUnboxer{
		clock:    clock,
		pass:     pass,
		canRetry: canRetry,
		running:  make(map[chat1.ConvIDStr]bool),
	}
}

// request marks the convs that need a pass of their own as running and returns them.
func (u *inboxUnboxer) request(convIDs []chat1.ConversationID, force bool) (start []chat1.ConversationID) {
	u.Lock()
	defer u.Unlock()
	seen := make(map[chat1.ConvIDStr]bool, len(convIDs))
	for _, convID := range convIDs {
		key := convID.ConvIDStr()
		if seen[key] {
			continue
		}
		seen[key] = true
		if _, ok := u.running[key]; ok {
			if force {
				u.running[key] = true
			}
			continue
		}
		u.running[key] = false
		start = append(start, convID)
	}
	return start
}

// finish ends the pass for convIDs and returns those forced meanwhile, which stay running.
func (u *inboxUnboxer) finish(convIDs []chat1.ConversationID) (again []chat1.ConversationID) {
	u.Lock()
	defer u.Unlock()
	for _, convID := range convIDs {
		key := convID.ConvIDStr()
		if u.running[key] {
			u.running[key] = false
			again = append(again, convID)
		} else {
			delete(u.running, key)
		}
	}
	return again
}

// run unboxes convIDs, which request returned, until no forced request is left for them. It stops
// without finishing them when ctx ends: the session that owns this unboxer is over.
func (u *inboxUnboxer) run(ctx context.Context, convIDs []chat1.ConversationID) {
	for len(convIDs) > 0 {
		u.attempt(ctx, convIDs)
		if ctx.Err() != nil {
			return
		}
		convIDs = u.finish(convIDs)
	}
}

func (u *inboxUnboxer) attempt(ctx context.Context, convIDs []chat1.ConversationID) {
	backoff := inboxUnboxRetryBackoff
	for attempt := 1; len(convIDs) > 0; attempt++ {
		final := attempt == inboxUnboxAttempts || !u.canRetry(ctx)
		convIDs = u.pass(ctx, convIDs, final)
		if len(convIDs) == 0 {
			return
		}
		select {
		case <-u.clock.After(backoff):
		case <-ctx.Done():
			return
		}
		backoff *= 2
	}
}

// unboxMissedResponse answers a requested conv the inbox read gave no conversation for. It goes to
// the UI as a transient failure, which keeps whatever the UI already shows for the conv.
type unboxMissedResponse struct {
	ConvID  chat1.ConversationID
	Message string
	// hand the conv to the FetchRetrier: the read failed rather than finding nothing
	Retry bool
}

// UnboxConvs sends the UI a final result for each of convIDs: a conversation, or a failure (see
// inboxUnboxer). The work runs on the loader's session, not on ctx, so it outlives the request.
func (h *UIInboxLoader) UnboxConvs(ctx context.Context, convIDs []chat1.ConversationID, force bool) (err error) {
	defer h.Trace(ctx, &err, "UnboxConvs: convs: %d force: %v", len(convIDs), force)()
	if _, err := h.sessionUID(ctx); err != nil {
		return err
	}
	h.Lock()
	defer h.Unlock()
	if !h.started {
		return storage.NewAbortedError()
	}
	start := h.unboxer.request(convIDs, force)
	h.Debug(ctx, "UnboxConvs: starting a pass for %d convs", len(start))
	if len(start) == 0 {
		return nil
	}
	unboxer := h.unboxer
	// cancelled once the run ends, so a request leaves nothing registered on the session or the
	// loader's stop context
	bgCtx, cancel := globals.BackgroundChatCtxWithCancel(globals.CtxAddLocalizerCancelable(ctx), h.G())
	workCtx := globals.WithStop(bgCtx, h.workCtx)
	// added under the lock while started, so it never races a Stop's eg.Wait
	h.eg.Go(func() error {
		defer cancel()
		unboxer.run(workCtx, start)
		return nil
	})
	return nil
}

func (h *UIInboxLoader) unboxPass(ctx context.Context, transmitCh chan any, convIDs []chat1.ConversationID,
	final bool,
) (retry []chat1.ConversationID) {
	transmit := func(msg any) {
		select {
		case transmitCh <- msg:
		case <-ctx.Done():
		}
	}
	uid, err := h.sessionUID(ctx)
	if err != nil {
		return nil
	}
	query := chat1.GetInboxLocalQuery{
		ComputeActiveList: true,
		ConvIDs:           convIDs,
	}
	inbox, localizeCb, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerNonblocking,
		types.InboxSourceDataSourceAll, nil, &query)
	if err != nil {
		h.Debug(ctx, "unboxPass: read failed: final: %v err: %s", final, err)
		if _, sessErr := h.sessionUID(ctx); sessErr != nil {
			return nil
		}
		if !final && retryableReadError(err) {
			return convIDs
		}
		for _, convID := range convIDs {
			transmit(unboxMissedResponse{ConvID: convID, Message: err.Error(), Retry: true})
		}
		return nil
	}
	// the localizer answers every conv the read returned except self-finalized ones, which it drops
	username := h.G().Env.GetUsername().String()
	read := make(map[chat1.ConvIDStr]bool, len(inbox.ConvsUnverified))
	for _, conv := range inbox.ConvsUnverified {
		if !conv.Conv.IsSelfFinalized(username) {
			read[conv.ConvIDStr] = true
		}
	}
	var want, notFound []chat1.ConversationID
	for _, convID := range convIDs {
		if read[convID.ConvIDStr()] {
			want = append(want, convID)
		} else {
			notFound = append(notFound, convID)
		}
	}
	undelivered, err := collectLocalized(ctx, h.clock, inboxUnboxLocalizeTimeout, localizeCb, want,
		func(conv chat1.ConversationLocal) {
			switch {
			case conv.Error == nil:
				transmit(conversationResponse{Conv: conv})
			case conv.Error.Typ == chat1.ConversationErrorType_TRANSIENT && !final:
				retry = append(retry, conv.GetConvID())
			default:
				transmit(failedResponse{Conv: conv})
			}
		})
	if err != nil {
		return nil
	}
	if _, err := h.sessionUID(ctx); err != nil {
		return nil
	}
	// the localizer is stopped, held by a suspend past the timeout, or dropped the job: retrying in
	// the pass would wait on it again
	for _, convID := range undelivered {
		transmit(unboxMissedResponse{ConvID: convID, Message: "conversation not unboxed", Retry: true})
	}
	// unknown to the inbox: not found, left, or self-finalized
	for _, convID := range notFound {
		transmit(unboxMissedResponse{ConvID: convID, Message: "conversation not found"})
	}
	return retry
}

// retryableReadError reports whether an inbox read that failed with err is worth another attempt in
// the pass. One that failed offline or under a rate limit fails the same way right after, so it goes
// to the FetchRetrier instead.
func retryableReadError(err error) bool {
	if IsOfflineError(err) != OfflineErrorKindOnline {
		return false
	}
	var chatRateLimit libkb.ChatRateLimitError
	if errors.As(err, &chatRateLimit) {
		return false
	}
	var status libkb.AppStatusError
	return !errors.As(err, &status) || (status.Code != libkb.SCRateLimit && status.Code != libkb.SCChatRateLimit)
}

// collectLocalized hands each conv of want to onLocalized as the localizer delivers it, until all are
// delivered, the channel closes, or timeout passes, and returns the convs of want it gave up on. The
// channel is buffered for every result, so leaving it unread never blocks the localizer.
func collectLocalized(ctx context.Context, clock clockwork.Clock, timeout time.Duration,
	localizeCb <-chan types.AsyncInboxResult, want []chat1.ConversationID,
	onLocalized func(chat1.ConversationLocal),
) (undelivered []chat1.ConversationID, err error) {
	pending := make(map[chat1.ConvIDStr]bool, len(want))
	for _, convID := range want {
		pending[convID.ConvIDStr()] = true
	}
	deadline := clock.After(timeout)
	for len(pending) > 0 {
		select {
		case res, ok := <-localizeCb:
			if !ok {
				return pendingConvs(want, pending), nil
			}
			key := res.Conv.GetConvID().ConvIDStr()
			if res.InboxRes != nil || !pending[key] {
				continue
			}
			delete(pending, key)
			onLocalized(res.ConvLocal)
		case <-deadline:
			return pendingConvs(want, pending), nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return nil, nil
}

func pendingConvs(convIDs []chat1.ConversationID, pending map[chat1.ConvIDStr]bool) (res []chat1.ConversationID) {
	for _, convID := range convIDs {
		if pending[convID.ConvIDStr()] {
			res = append(res, convID)
		}
	}
	return res
}

func (h *UIInboxLoader) flushMissed(ctx context.Context, r unboxMissedResponse) {
	uid, sessErr := h.sessionUID(ctx)
	if sessErr != nil {
		return
	}
	h.Debug(ctx, "flushMissed: transmitting: %s retry: %v", r.ConvID, r.Retry)
	if ui, err := h.getChatUI(ctx); err == nil {
		if err := ui.ChatInboxFailed(ctx, chat1.ChatInboxFailedArg{
			ConvID: r.ConvID,
			Error: chat1.InboxUIItemError{
				Typ:        chat1.ConversationErrorType_TRANSIENT,
				Message:    r.Message,
				RemoteConv: chat1.UnverifiedInboxUIItem{ConvID: r.ConvID.ConvIDStr()},
			},
			Uid: keybase1.UID(uid.String()),
		}); err != nil {
			h.Debug(ctx, "flushMissed: failed to send: %s", err)
		}
	}
	if r.Retry {
		h.G().FetchRetrier.Failure(ctx, uid, NewConversationRetry(h.G(), r.ConvID, nil, InboxLoad))
	}
}
