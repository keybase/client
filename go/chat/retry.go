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

const fetchInitialInterval = 5 * time.Second
const fetchMultiplier = 1.5
const fetchMaxTime = 24 * time.Hour
const fetchMaxAttempts = 100

type retrierAction struct {
	globals.Contextified
	utils.DebugLabeler

	clock      clockwork.Clock
	uid        gregor1.UID
	convID     chat1.ConversationID
	kind       types.FetchType
	forceCh    chan struct{}
	shutdownCh chan chan struct{}
}

func newRetrierAction(g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	kind types.FetchType, clock clockwork.Clock) *retrierAction {
	return &retrierAction{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, fmt.Sprintf("retrierAction(%s,%v)", convID, kind), false),
		clock:        clock,
		convID:       convID,
		kind:         kind,
		uid:          uid,
		forceCh:      make(chan struct{}, 1),
		shutdownCh:   make(chan chan struct{}, 1),
	}
}

// nextAttemptTime calculates the next try for a given retry item. It uses an exponential
// decay calculation.
func (r *retrierAction) nextAttemptTime(attempts int, lastAttempt time.Time) time.Time {
	wait := time.Duration(float64(attempts) * fetchMultiplier * float64(fetchInitialInterval))
	return lastAttempt.Add(time.Duration(wait))
}

func (r *retrierAction) Start(ctx context.Context) {
	r.Debug(ctx, "Start: convID: %s kind: %v", r.convID, r.kind)
	var fixFn func(context.Context, gregor1.UID, chat1.ConversationID) error
	switch r.kind {
	case types.InboxLoad:
		fixFn = r.fixInboxFetch
	case types.ThreadLoad:
		fixFn = r.fixThreadFetch
	}

	attempts := 1
	nextTime := r.nextAttemptTime(attempts, r.clock.Now())
	ctx = BackgroundContext(ctx, r.G().Env)
	go func() {
		for {
			select {
			case <-r.clock.AfterTime(nextTime):
				if err := fixFn(ctx, r.uid, r.convID); err == nil {
					return
				}
			case <-r.forceCh:
				if err := fixFn(ctx, r.uid, r.convID); err == nil {
					return
				}
			case ch := <-r.shutdownCh:
				defer close(ch)
				r.Debug(ctx, "Start: shutdown received, going down")
				return
			}

			// Only increment attempts if we are online
			if r.G().Syncer.IsConnected(ctx) {
				attempts++
			}

			if attempts > fetchMaxAttempts {
				r.Debug(ctx, "Start: max attempts reached, bailing")
			}
			nextTime = r.nextAttemptTime(attempts, nextTime)
			r.Debug(ctx, "Start: next retry at: %v", nextTime)
		}
	}()
}

func (r *retrierAction) Stop(ctx context.Context) chan struct{} {
	r.Debug(ctx, "Stop: received")
	ch := make(chan struct{})
	r.shutdownCh <- ch
	return ch
}

func (r *retrierAction) Force(ctx context.Context) {
	r.Debug(ctx, "Force: received")
	r.forceCh <- struct{}{}
}

func (r *retrierAction) fixInboxFetch(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) error {
	r.Debug(ctx, "fixInboxFetch: retrying conversation: %s", convID)

	// Reload this conversation and hope it works
	inbox, _, err := r.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		r.Debug(ctx, "fixInboxFetch: failed to read inbox: convID: %s msg: %s",
			convID, err.Error())
		return err
	}
	if len(inbox.Convs) != 1 {
		r.Debug(ctx, "fixInboxFetch: unusual number of results for Read call: convID: %s len: %d",
			convID, len(inbox.Convs))
		return errors.New("inbox fetch failed: unusual number of conversation returned")
	}
	conv := inbox.Convs[0]

	if conv.Error == nil {
		r.Debug(ctx, "fixInboxFetch: fixed convID: %s", conv.GetConvID())
		return nil
	}
	r.Debug(ctx, "fixInboxFetches: convID failed again: convID: %s msg: %s typ: %v", convID,
		conv.Error.Message, conv.Error.Typ)

	return fmt.Errorf("inbox fetch failed: %s", conv.Error.Message)
}

func (r *retrierAction) fixThreadFetch(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) error {
	r.Debug(ctx, "fixThreadFetch: retrying conversation: %s", convID)
	// Attempt a pull of 50 messages to simulate whatever request got the
	// conversation in this queue.
	_, _, err := r.G().ConvSource.Pull(ctx, convID, uid, nil, &chat1.Pagination{
		Num: 50,
	})
	if err == nil {
		r.Debug(ctx, "fixThreadFetch: fixed convID: %s", convID)
		return nil
	}

	r.Debug(ctx, "fixThreadFetches: convID failed again: msg: %s", err.Error())
	return err
}

// FetchRetrier is responsible for tracking any nonblock fetch failures, and retrying
// them automatically.
type FetchRetrier struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	actions          map[string]*retrierAction
	shutdownCh       chan chan struct{}
	clock            clockwork.Clock
	offline, running bool
}

var _ types.FetchRetrier = (*FetchRetrier)(nil)

func NewFetchRetrier(g *globals.Context) *FetchRetrier {
	f := &FetchRetrier{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "FetchRetrier", false),
		clock:        clockwork.NewRealClock(),
		shutdownCh:   make(chan chan struct{}, 1),
		actions:      make(map[string]*retrierAction),
	}
	return f
}

// SetClock sets a custom clock for testing.
func (f *FetchRetrier) SetClock(clock clockwork.Clock) {
	f.clock = clock
}

// Failure indicates a failure of type kind has happened when loading a conversation.
func (f *FetchRetrier) Failure(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind types.FetchType) (err error) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Failure(%s)", convID))()

	if _, ok := f.actions[convID.String()]; !ok {
		action := newRetrierAction(f.G(), uid, convID, kind, f.clock)
		action.Start(ctx)
		f.actions[convID.String()] = action
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

	if action, ok := f.actions[convID.String()]; ok {
		<-action.Stop(ctx)
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
	for _, action := range f.actions {
		action.Force(ctx)
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
	for _, action := range f.actions {
		action.Force(ctx)
	}
}
