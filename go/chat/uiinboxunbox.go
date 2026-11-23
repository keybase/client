package chat

import (
	"context"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/clockwork"
)

const (
	inboxUnboxAttempts     = 3
	inboxUnboxRetryBackoff = time.Second
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
		return nil
	}
	start := h.unboxer.request(convIDs, force)
	h.Debug(ctx, "UnboxConvs: starting a pass for %d convs", len(start))
	if len(start) == 0 {
		return nil
	}
	unboxer := h.unboxer
	workCtx := globals.WithStop(globals.BackgroundChatCtx(globals.CtxAddLocalizerCancelable(ctx), h.G()),
		h.workCtx)
	// added under the lock while started, so it never races a Stop's eg.Wait
	h.eg.Go(func() error {
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
	_, localizeCb, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerNonblocking,
		types.InboxSourceDataSourceAll, nil, &query)
	if err != nil {
		h.Debug(ctx, "unboxPass: read failed: final: %v err: %s", final, err)
		if _, sessErr := h.sessionUID(ctx); sessErr != nil {
			return nil
		}
		if !final {
			return convIDs
		}
		for _, convID := range convIDs {
			transmit(unboxMissedResponse{ConvID: convID, Message: err.Error(), Retry: true})
		}
		return nil
	}
	pending := make(map[chat1.ConvIDStr]chat1.ConversationID, len(convIDs))
	for _, convID := range convIDs {
		pending[convID.ConvIDStr()] = convID
	}
	for done := false; !done; {
		select {
		case res, ok := <-localizeCb:
			if !ok {
				done = true
				break
			}
			if res.InboxRes != nil {
				continue
			}
			convID := res.Conv.GetConvID()
			if _, ok := pending[convID.ConvIDStr()]; !ok {
				continue
			}
			delete(pending, convID.ConvIDStr())
			switch {
			case res.ConvLocal.Error == nil:
				transmit(conversationResponse{Conv: res.ConvLocal})
			case res.ConvLocal.Error.Typ == chat1.ConversationErrorType_TRANSIENT && !final:
				retry = append(retry, convID)
			default:
				transmit(failedResponse{Conv: res.ConvLocal})
			}
		case <-ctx.Done():
			return nil
		}
	}
	if _, err := h.sessionUID(ctx); err != nil {
		return nil
	}
	// unknown to the inbox: not found, left, or self-finalized
	for _, convID := range pending {
		transmit(unboxMissedResponse{ConvID: convID, Message: "conversation not found"})
	}
	return retry
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
		}); err != nil {
			h.Debug(ctx, "flushMissed: failed to send: %s", err)
		}
	}
	if r.Retry {
		h.G().FetchRetrier.Failure(ctx, uid, NewConversationRetry(h.G(), r.ConvID, nil, InboxLoad))
	}
}
