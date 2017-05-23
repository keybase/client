package chat

import (
	"encoding/hex"
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
	"github.com/keybase/go-codec/codec"
	context "golang.org/x/net/context"
)

type FetchType int

const (
	InboxLoad FetchType = iota
	ThreadLoad
	FullInboxLoad
)

const fetchInitialInterval = 3 * time.Second
const fetchMultiplier = 1.5
const fetchMaxTime = 24 * time.Hour
const fetchMaxAttempts = 100

type ConversationRetry struct {
	globals.Contextified
	utils.DebugLabeler

	convID chat1.ConversationID
	kind   FetchType
}

var _ types.RetryDescription = (*ConversationRetry)(nil)

func NewConversationRetry(g *globals.Context, convID chat1.ConversationID, kind FetchType) *ConversationRetry {
	dstr := fmt.Sprintf("ConversationRetry(%s,%v)", convID, kind)
	return &ConversationRetry{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, dstr, false),
		convID:       convID,
		kind:         kind,
	}
}

func (c *ConversationRetry) String() string {
	return fmt.Sprintf("%s:%v", c.convID, c.kind)
}

func (c *ConversationRetry) SendStale(ctx context.Context, uid gregor1.UID) {
	c.G().Syncer.SendChatStaleNotifications(ctx, uid, []chat1.ConversationID{c.convID}, false)
}

func (c *ConversationRetry) Fix(ctx context.Context, uid gregor1.UID) error {
	if c.kind == ThreadLoad {
		return c.fixThreadFetch(ctx, uid)
	}
	return c.fixInboxFetch(ctx, uid)
}

func (c *ConversationRetry) fixInboxFetch(ctx context.Context, uid gregor1.UID) error {
	c.Debug(ctx, "fixInboxFetch: retrying conversation")

	// Reload this conversation and hope it works
	inbox, _, err := c.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{c.convID},
	}, nil)
	if err != nil {
		c.Debug(ctx, "fixInboxFetch: failed to read inbox: msg: %s", err.Error())
		return err
	}
	if len(inbox.Convs) != 1 {
		c.Debug(ctx, "fixInboxFetch: unusual number of results for Read call: len: %d", len(inbox.Convs))
		return errors.New("inbox fetch failed: unusual number of conversation returned")
	}
	conv := inbox.Convs[0]

	if conv.Error == nil {
		c.Debug(ctx, "fixInboxFetch: fixed convID: %s", conv.GetConvID())
		return nil
	}
	c.Debug(ctx, "fixInboxFetch: convID failed again: msg: %s typ: %v",
		conv.Error.Message, conv.Error.Typ)

	return fmt.Errorf("inbox fetch failed: %s", conv.Error.Message)
}

func (c *ConversationRetry) fixThreadFetch(ctx context.Context, uid gregor1.UID) error {
	c.Debug(ctx, "fixThreadFetch: retrying conversation")
	// Attempt a pull of 50 messages to simulate whatever request got the
	// conversation in this queue.
	_, _, err := c.G().ConvSource.Pull(ctx, c.convID, uid, nil, &chat1.Pagination{
		Num: 50,
	})
	if err == nil {
		c.Debug(ctx, "fixThreadFetch: fixed")
		return nil
	}

	c.Debug(ctx, "fixThreadFetch: convID failed again: msg: %s", err.Error())
	return err
}

type FullInboxRetry struct {
	globals.Contextified
	utils.DebugLabeler

	query      *chat1.GetInboxLocalQuery
	pagination *chat1.Pagination
}

var _ types.RetryDescription = (*FullInboxRetry)(nil)

func NewFullInboxRetry(g *globals.Context, query *chat1.GetInboxLocalQuery, p *chat1.Pagination) FullInboxRetry {
	return FullInboxRetry{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "FullInboxRetry", false),
		query:        query,
		pagination:   p,
	}
}

func (f FullInboxRetry) String() string {
	qstr := "<empty>"
	if f.query != nil {
		mh := codec.MsgpackHandle{WriteExt: true}
		var data []byte
		enc := codec.NewEncoderBytes(&data, &mh)
		enc.Encode(*f.query)
		qstr = hex.EncodeToString(data)
	}
	pstr := "<empty>"
	if f.pagination != nil {
		pstr = fmt.Sprintf("%d:%x:%x", f.pagination.Num, f.pagination.Previous, f.pagination.Next)
	}
	return qstr + pstr
}

func (f FullInboxRetry) SendStale(ctx context.Context, uid gregor1.UID) {
	f.G().Syncer.SendChatStaleNotifications(ctx, uid, nil, true)
}

func (f FullInboxRetry) Fix(ctx context.Context, uid gregor1.UID) error {
	query, _, err := f.G().InboxSource.GetInboxQueryLocalToRemote(ctx, f.query)
	if err != nil {
		f.Debug(ctx, "Fix: failed to convert query: %s", err.Error())
		return err
	}
	_, _, err = f.G().InboxSource.ReadUnverified(ctx, uid, true, query, f.pagination)
	if err != nil {
		f.Debug(ctx, "Fix: failed to load again: %d", err.Error())
	}
	return nil
}

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

func (f *FetchRetrier) key(uid gregor1.UID, desc types.RetryDescription) string {
	return fmt.Sprintf("%s:%s", uid, desc)
}

// nextAttemptTime calculates the next try for a given retry item. It uses an exponential
// decay calculation.
func (f *FetchRetrier) nextAttemptTime(attempts int, lastAttempt time.Time) time.Time {
	wait := time.Duration(float64(attempts) * fetchMultiplier * float64(fetchInitialInterval))
	return lastAttempt.Add(time.Duration(wait))
}

func (f *FetchRetrier) spawnRetrier(ctx context.Context, uid gregor1.UID, desc types.RetryDescription,
	control *retrierControl) {

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
					f.Debug(ctx, "spawnRetrier: retrying after time: desc: %s", desc)
					if err := desc.Fix(ctx, uid); err == nil {
						f.Lock()
						delete(f.retriers, f.key(uid, desc))
						f.Unlock()
						desc.SendStale(ctx, uid)
						return
					}
				}
			case <-control.forceCh:
				f.Debug(ctx, "spawnRetrier: retrying (forced): desc: %s", desc)
				if err := desc.Fix(ctx, uid); err == nil {
					f.Lock()
					delete(f.retriers, f.key(uid, desc))
					f.Unlock()
					desc.SendStale(ctx, uid)
					return
				}
			case <-control.shutdownCh:
				f.Lock()
				defer f.Unlock()
				f.Debug(ctx, "spawnRetrier: shutdown received, going down: desc: %s", desc)
				delete(f.retriers, f.key(uid, desc))
				return
			}

			attempts++
			if attempts > fetchMaxAttempts {
				f.Debug(ctx, "spawnRetrier: max attempts reached, bailing: desc: %s", desc)
				control.Shutdown()
			}
			nextTime = f.nextAttemptTime(attempts, f.clock.Now())
			f.Debug(ctx, "spawnRetrier: attempts: %d next: %v desc: %s", attempts, nextTime, desc)
		}
	}()
}

// Failure indicates a failure of type kind has happened when loading a conversation.
func (f *FetchRetrier) Failure(ctx context.Context, uid gregor1.UID, desc types.RetryDescription) (err error) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Failure(%s)", desc))()
	if !f.running {
		f.Debug(ctx, "Failure: not starting new retrier, not running")
		return nil
	}
	key := f.key(uid, desc)
	if _, ok := f.retriers[key]; !ok {
		f.Debug(ctx, "Failure: spawning new retrier: desc: %s", desc)
		control := newRetrierControl()
		f.retriers[key] = control
		f.spawnRetrier(ctx, uid, desc, control)
	}

	return nil
}

// Success indicates a success of type kind loading a conversation. This effectively removes
// that conversation from the retry queue.
func (f *FetchRetrier) Success(ctx context.Context, uid gregor1.UID, desc types.RetryDescription) (err error) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Success(%s)", desc))()

	key := f.key(uid, desc)
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
