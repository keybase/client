package chat

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

const fetchInitialInterval = 5 * time.Second
const fetchMultiplier = 1.5
const fetchMaxTime = 24 * time.Hour

// FetchRetrier is responsible for tracking any nonblock fetch failures, and retrying
// them automatically.
type FetchRetrier struct {
	libkb.Contextified
	utils.DebugLabeler
	sync.Mutex

	forceCh          chan struct{}
	shutdownCh       chan chan struct{}
	clock            clockwork.Clock
	offline, running bool
}

var _ types.FetchRetrier = (*FetchRetrier)(nil)

func NewFetchRetrier(g *libkb.GlobalContext) *FetchRetrier {
	f := &FetchRetrier{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "FetchRetrier", false),
		clock:        clockwork.NewRealClock(),
		forceCh:      make(chan struct{}, 10),
		shutdownCh:   make(chan chan struct{}, 1),
	}
	return f
}

// SetClock sets a custom clock for testing.
func (f *FetchRetrier) SetClock(clock clockwork.Clock) {
	f.clock = clock
}

func (f *FetchRetrier) boxKey(kind types.FetchType) string {
	return fmt.Sprintf("%v", kind)
}

// Failure indicates a failure of type kind has happened when loading a conversation.
func (f *FetchRetrier) Failure(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind types.FetchType) (err error) {
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Failure(%s)", convID))()

	return storage.NewConversationFailureBox(f.G(), uid, f.boxKey(kind)).Failure(ctx, convID)
}

// Success indicates a success of type kind loading a conversation. This effectively removes
// that conversation from the retry queue.
func (f *FetchRetrier) Success(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind types.FetchType) (err error) {
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Success(%s)", convID))()

	return storage.NewConversationFailureBox(f.G(), uid, f.boxKey(kind)).Success(ctx, convID)
}

// Connected is called when a connection to the chat server is established, and forces a
// pass over the retry queue
func (f *FetchRetrier) Connected(ctx context.Context) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return nil }, "Connected")()
	f.offline = false
	f.forceCh <- struct{}{}
}

// Disconnected is called when we lose connection to the chat server, and pauses attempts
// on the retry queue.
func (f *FetchRetrier) Disconnected(ctx context.Context) {
	f.Lock()
	defer f.Unlock()
	f.offline = true
}

// IsOffline returns if the module thinks we are connected to the chat server.
func (f *FetchRetrier) IsOffline() bool {
	f.Lock()
	defer f.Unlock()
	return f.offline
}

// Force forces a run of the retry loop.
func (f *FetchRetrier) Force(ctx context.Context) {
	defer f.Trace(ctx, func() error { return nil }, "Force")()
	f.forceCh <- struct{}{}
}

// Start initiates the retry loop thread.
func (f *FetchRetrier) Start(ctx context.Context, uid gregor1.UID) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return nil }, "Start")()

	<-f.doStop(ctx)

	f.running = true
	go f.retryLoop(uid)
}

// Stop suspends the retry loop thread.
func (f *FetchRetrier) Stop(ctx context.Context) chan struct{} {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return nil }, "Stop")()
	return f.doStop(ctx)
}

func (f *FetchRetrier) doStop(ctx context.Context) chan struct{} {
	cb := make(chan struct{})
	if f.running {
		f.Debug(ctx, "stopping")
		f.shutdownCh <- cb
		f.running = false
		return cb
	}

	close(cb)
	return cb
}

func (f *FetchRetrier) retryLoop(uid gregor1.UID) {
	for {
		select {
		case <-f.clock.After(fetchInitialInterval):
			f.retryOnce(uid, false)
		case <-f.forceCh:
			f.retryOnce(uid, true)
		case cb := <-f.shutdownCh:
			f.Debug(context.Background(), "shutting down retryLoop: uid: %s", uid)
			defer close(cb)
			return
		}
	}
}

// nextAttemptTime calculates the next try for a given retry item. It uses an exponential
// decay calculation.
func (f *FetchRetrier) nextAttemptTime(attempts int, lastAttempt time.Time) time.Time {
	wait := time.Duration(float64(attempts) * fetchMultiplier * float64(fetchInitialInterval))
	return lastAttempt.Add(time.Duration(wait))
}

func (f *FetchRetrier) filterFailuresByTime(ctx context.Context,
	convFailures []storage.ConversationFailureRecord, force bool) (res []chat1.ConversationID) {
	now := f.clock.Now()
	for _, conv := range convFailures {
		next := f.nextAttemptTime(conv.Attempts, gregor1.FromTime(conv.LastAttempt))
		// Filter out any items whose next time is greater than now
		if force || next.Before(now) {
			res = append(res, conv.ConvID)

			// Output debug info about next time
			if force {
				f.Debug(ctx, "filterFailuresByTime: including convID: %s (forced)", conv.ConvID)
			} else {
				next = f.nextAttemptTime(conv.Attempts+1, f.clock.Now())
				f.Debug(ctx, "filterFailuresByTime: including convID: %s attempts: %d next: %v",
					conv.ConvID, conv.Attempts, next)
			}
		}
	}
	return res
}

func (f *FetchRetrier) retryFetch(uid gregor1.UID, force bool, kind types.FetchType,
	fixFn func(context.Context, gregor1.UID, []chat1.ConversationID) []chat1.ConversationID) {
	var err error
	var breaks []keybase1.TLFIdentifyFailure
	box := storage.NewConversationFailureBox(f.G(), uid, f.boxKey(kind))
	ctx := Context(context.Background(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &breaks,
		NewIdentifyNotifier(f.G()))

	// Get all items that are ready to be retried.
	var convFailures []storage.ConversationFailureRecord
	convFailures, err = box.Read(ctx)
	if err != nil {
		f.Debug(ctx, "retryFetch: failed to read failure box, giving up: %s", err.Error())
		return
	}
	convIDs := f.filterFailuresByTime(ctx, convFailures, force)
	if len(convIDs) == 0 {
		return
	}

	// Run the fix function on the list of fixable fetches, and notifiy with stale
	// messages if any now work.
	f.Debug(ctx, "retryFetch: attempt to fix %d conversations", len(convIDs))
	fixed := fixFn(ctx, uid, convIDs)
	if len(fixed) > 0 {
		f.Debug(ctx, "retryFetch: sending %d stale notifications", len(fixed))
		f.G().ChatSyncer.SendChatStaleNotifications(ctx, uid, fixed, false)
	}
}

func (f *FetchRetrier) fixInboxFetches(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID) (fixed []chat1.ConversationID) {
	// Reload these all conversations and hope they work
	inbox, _, err := f.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: convIDs,
	}, nil)
	if err != nil {
		f.Debug(ctx, "fixInboxFetches: failed to read inbox: %s", err.Error())
		return fixed
	}
	for _, conv := range inbox.Convs {
		if conv.Error == nil {
			f.Debug(ctx, "fixInboxFetches: fixed convID: %s", conv.GetConvID())
			fixed = append(fixed, conv.GetConvID())
			if err := f.Success(ctx, conv.GetConvID(), uid, types.InboxLoad); err != nil {
				f.Debug(ctx, "fixInboxFetches: failure running Success: %s", err.Error())
			}
		} else {
			f.Debug(ctx, "fixInboxFetches: convID failed again: msg: %s typ: %v", conv.Error.Message,
				conv.Error.Typ)
			if err := f.Failure(ctx, conv.GetConvID(), uid, types.InboxLoad); err != nil {
				f.Debug(ctx, "fixInboxFetches: failure running Failure: %s", err.Error())
			}
		}
	}

	return fixed
}

func (f *FetchRetrier) fixThreadFetches(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID) (fixed []chat1.ConversationID) {
	f.Debug(ctx, "fixThreadFetches: retrying %d conversations", len(convIDs))
	for _, convID := range convIDs {
		// Attempt a pull of 50 messages to simulate whatever request got the
		// conversation in this queue.
		_, _, err := f.G().ConvSource.Pull(ctx, convID, uid, nil, &chat1.Pagination{
			Num: 50,
		})
		if err == nil {
			f.Debug(ctx, "fixThreadFetches: fixed convID: %s", convID)
			fixed = append(fixed, convID)
			if err := f.Success(ctx, convID, uid, types.ThreadLoad); err != nil {
				f.Debug(ctx, "fixThreadFetches: failure running Success: %s", err.Error())
			}
		} else {
			f.Debug(ctx, "fixThreadFetches: convID failed again: msg: %s", err.Error())
			if err := f.Failure(ctx, convID, uid, types.ThreadLoad); err != nil {
				f.Debug(ctx, "fixThreadFetches: failure running Failure: %s", err.Error())
			}
		}
	}

	return fixed
}

func (f *FetchRetrier) retryOnce(uid gregor1.UID, force bool) {
	if f.IsOffline() {
		f.Debug(context.Background(), "retryOnce: currently offline, not attempting to fix errors")
		return
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		f.retryFetch(uid, force, types.InboxLoad, f.fixInboxFetches)
		wg.Done()
	}()
	go func() {
		f.retryFetch(uid, force, types.ThreadLoad, f.fixThreadFetches)
		wg.Done()
	}()
	wg.Wait()
}
