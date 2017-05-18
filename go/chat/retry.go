package chat

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

const fetchInitialInterval = 3 * time.Second
const fetchMultiplier = 1.5
const fetchMaxTime = 24 * time.Hour
const fetchMaxAttempts = 100

type retrierControl struct {
	forceCh    chan struct{}
	shutdownCh chan struct{}
}

func newRetrierControl() *retrierControl {
	return &retrierControl{
		forceCh:    make(chan struct{}, 1),
		shutdownCh: make(chan struct{}, 1),
	}
}

func (c *retrierControl) Shutdown() {
	select {
	case c.shutdownCh <- struct{}{}:
	default:
	}
}

func (c *retrierControl) Force() {
	select {
	case c.forceCh <- struct{}{}:
	default:
	}
}

// FetchRetrier is responsible for tracking any nonblock fetch failures, and retrying
// them automatically.
type FetchRetrier struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	retriers         map[string]*retrierControl
	clock            clockwork.Clock
	offline, running bool
}

var _ types.FetchRetrier = (*FetchRetrier)(nil)

func NewFetchRetrier(g *globals.Context) *FetchRetrier {
	f := &FetchRetrier{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "FetchRetrier", false),
		clock:        clockwork.NewRealClock(),
		retriers:     make(map[string]*retrierControl),
	}
	return f
}

// SetClock sets a custom clock for testing.
func (f *FetchRetrier) SetClock(clock clockwork.Clock) {
	f.clock = clock
}

func (f *FetchRetrier) key(uid gregor1.UID, convID chat1.ConversationID) string {
	return fmt.Sprintf("%s:%s", uid, convID)
}

// nextAttemptTime calculates the next try for a given retry item. It uses an exponential
// decay calculation.
func (f *FetchRetrier) nextAttemptTime(attempts int, lastAttempt time.Time) time.Time {
	wait := time.Duration(float64(attempts) * fetchMultiplier * float64(fetchInitialInterval))
	return lastAttempt.Add(time.Duration(wait))
}

func (f *FetchRetrier) sendStale(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) {
	f.G().Syncer.SendChatStaleNotifications(ctx, uid, []chat1.ConversationID{convID}, false)
}

func (f *FetchRetrier) spawnRetrier(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, kind types.FetchType, control *retrierControl) {
	var fixFn func(context.Context, gregor1.UID, chat1.ConversationID) error
	switch kind {
	case types.InboxLoad:
		fixFn = f.fixInboxFetch
	case types.ThreadLoad:
		fixFn = f.fixThreadFetch
	}

	attempts := 1
	nextTime := f.nextAttemptTime(attempts, f.clock.Now())
	ctx = BackgroundContext(ctx, f.G().Env)
	go func() {
		for {
			select {
			case <-f.clock.AfterTime(nextTime):
				// Only attempts if we are online. Otherwise just retry
				// at the same interval that we used last time.
				if !f.offline {
					f.Debug(ctx, "spawnRetrier: retrying conversation after time: convID: %s", convID)
					if err := fixFn(ctx, uid, convID); err == nil {
						f.Lock()
						delete(f.retriers, f.key(uid, convID))
						f.Unlock()
						f.sendStale(ctx, uid, convID)
						return
					}
				}
			case <-control.forceCh:
				f.Debug(ctx, "spawnRetrier: retrying conversation (forced): convID: %s", convID)
				if err := fixFn(ctx, uid, convID); err == nil {
					f.Lock()
					delete(f.retriers, f.key(uid, convID))
					f.Unlock()
					f.sendStale(ctx, uid, convID)
					return
				}
			case <-control.shutdownCh:
				f.Lock()
				defer f.Unlock()
				f.Debug(ctx, "spawnRetrier: shutdown received, going down: convID: %s", convID)
				delete(f.retriers, f.key(uid, convID))
				return
			}

			attempts++
			if attempts > fetchMaxAttempts {
				f.Debug(ctx, "spawnRetrier: max attempts reached, bailing: convID: %s", convID)
				control.Shutdown()
			}
			nextTime = f.nextAttemptTime(attempts, f.clock.Now())
			f.Debug(ctx, "spawnRetrier: convID: %s attempts: %d next: %v", convID, attempts, nextTime)
		}
	}()
}

func (f *FetchRetrier) fixInboxFetch(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) error {
	f.Debug(ctx, "fixInboxFetch: retrying conversation: %s", convID)

	// Reload this conversation and hope it works
	inbox, _, err := f.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		f.Debug(ctx, "fixInboxFetch: failed to read inbox: convID: %s msg: %s",
			convID, err.Error())
		return err
	}
	if len(inbox.Convs) != 1 {
		f.Debug(ctx, "fixInboxFetch: unusual number of results for Read call: convID: %s len: %d",
			convID, len(inbox.Convs))
		return errors.New("inbox fetch failed: unusual number of conversation returned")
	}
	conv := inbox.Convs[0]

	if conv.Error == nil {
		f.Debug(ctx, "fixInboxFetch: fixed convID: %s", conv.GetConvID())
		return nil
	}
	f.Debug(ctx, "fixInboxFetch: convID failed again: convID: %s msg: %s typ: %v", convID,
		conv.Error.Message, conv.Error.Typ)

	return fmt.Errorf("inbox fetch failed: %s", conv.Error.Message)
}

func (f *FetchRetrier) fixThreadFetch(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) error {
	f.Debug(ctx, "fixThreadFetch: retrying conversation: %s", convID)
	// Attempt a pull of 50 messages to simulate whatever request got the
	// conversation in this queue.
	_, _, err := f.G().ConvSource.Pull(ctx, convID, uid, nil, &chat1.Pagination{
		Num: 50,
	})
	if err == nil {
		f.Debug(ctx, "fixThreadFetch: fixed convID: %s", convID)
		return nil
	}

	f.Debug(ctx, "fixThreadFetch: convID failed again: msg: %s", err.Error())
	return err
}

// Failure indicates a failure of type kind has happened when loading a conversation.
func (f *FetchRetrier) Failure(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind types.FetchType) (err error) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Failure(%s)", convID))()
	if !f.running {
		f.Debug(ctx, "Failure: not starting new retrier, not running")
		return nil
	}
	key := f.key(uid, convID)
	if _, ok := f.retriers[key]; !ok {
		f.Debug(ctx, "Failure: spawning new retrier: convID: %s", convID)
		control := newRetrierControl()
		f.retriers[key] = control
		f.spawnRetrier(ctx, convID, uid, kind, control)
	}

	return nil
}

// Success indicates a success of type kind loading a conversation. This effectively removes
// that conversation from the retry queue.
func (f *FetchRetrier) Success(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind types.FetchType) (err error) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Success(%s)", convID))()

	key := f.key(uid, convID)
	if control, ok := f.retriers[key]; ok {
		control.Shutdown()
	}

	return nil
}

// Connected is called when a connection to the chat server is established, and forces a
// pass over the retry queue
func (f *FetchRetrier) Connected(ctx context.Context) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return nil }, "Connected")()
	f.offline = false
	for _, control := range f.retriers {
		control.Force()
	}
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
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return nil }, "Force")()
	for _, control := range f.retriers {
		control.Force()
	}
}

func (f *FetchRetrier) Stop(ctx context.Context) chan struct{} {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return nil }, "Shutdown")()
	f.running = false
	for _, control := range f.retriers {
		control.Shutdown()
	}
	ch := make(chan struct{})
	close(ch)
	return ch
}

func (f *FetchRetrier) Start(ctx context.Context, uid gregor1.UID) {
	f.Lock()
	defer f.Unlock()
	f.running = true
}
