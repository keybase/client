package chat

import (
	"errors"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

const (
	bgLoaderMaxAttempts = 10
	bgLoaderInitDelay   = 100 * time.Millisecond
	bgLoaderErrDelay    = 300 * time.Millisecond
)

type clTask struct {
	convID        chat1.ConversationID
	attempt       int
	lastAttemptAt time.Time
}

type BackgroundConvLoader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid           gregor1.UID
	started       bool
	queueCh       chan clTask
	stopCh        chan chan struct{}
	suspendCh     chan chan struct{}
	resumeCh      chan struct{}
	identNotifier types.IdentifyNotifier

	clock      clockwork.Clock
	resumeWait time.Duration

	activeLoadCtx      context.Context
	activeLoadCancelFn context.CancelFunc
	suspendCount       int

	// for testing, make this and can check conv load successes
	loads                 chan chat1.ConversationID
	testingNameInfoSource types.NameInfoSource
	appStateCh            chan struct{}
}

var _ types.ConvLoader = (*BackgroundConvLoader)(nil)

func NewBackgroundConvLoader(g *globals.Context) *BackgroundConvLoader {
	b := &BackgroundConvLoader{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "BackgroundConvLoader", false),
		stopCh:        make(chan chan struct{}, 5),
		suspendCh:     make(chan chan struct{}, 10),
		identNotifier: NewCachingIdentifyNotifier(g),
		clock:         clockwork.NewRealClock(),
		resumeWait:    time.Second,
	}
	b.identNotifier.ResetOnGUIConnect()
	b.newQueue()
	go b.monitorAppState()

	return b
}

func (b *BackgroundConvLoader) monitorAppState() {
	ctx := context.Background()
	suspended := false
	b.Debug(ctx, "monitorAppState: starting up")
	for {
		state := <-b.G().AppState.NextUpdate()
		switch state {
		case keybase1.AppState_FOREGROUND:
			b.Debug(ctx, "monitorAppState: foregrounded")
			// Only resume if we had suspended earlier (frontend can spam us with these)
			if suspended {
				b.Debug(ctx, "monitorAppState: resuming load thread")
				b.Resume(ctx)
				suspended = false
			}
		case keybase1.AppState_BACKGROUND:
			b.Debug(ctx, "monitorAppState: backgrounded, suspending load thread")
			b.Suspend(ctx)
			suspended = true
		}
		if b.appStateCh != nil {
			b.appStateCh <- struct{}{}
		}
	}
}

func (b *BackgroundConvLoader) Start(ctx context.Context, uid gregor1.UID) {
	b.Lock()
	defer b.Unlock()
	if b.started {
		b.stopCh <- make(chan struct{})
	}
	b.newQueue()
	b.started = true
	b.uid = uid
	go b.loop()
}

func (b *BackgroundConvLoader) Stop(ctx context.Context) chan struct{} {
	b.Lock()
	defer b.Unlock()
	ch := make(chan struct{})
	if b.started {
		b.stopCh <- ch
		b.started = false
	} else {
		close(ch)
	}
	return ch
}

type bgOperationKey int

var bgOpKey bgOperationKey

func (b *BackgroundConvLoader) makeConvLoaderContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, bgOpKey, true)
}

func (b *BackgroundConvLoader) isConvLoaderContext(ctx context.Context) bool {
	val := ctx.Value(bgOpKey)
	if _, ok := val.(bool); ok {
		return true
	}
	return false
}

func (b *BackgroundConvLoader) Queue(ctx context.Context, convID chat1.ConversationID) error {
	if b.isConvLoaderContext(ctx) {
		b.Debug(ctx, "Queue: refusing to queue in background loader context: convID: %s", convID)
		return nil
	}
	return b.enqueue(ctx, clTask{convID: convID})
}

func (b *BackgroundConvLoader) Suspend(ctx context.Context) (canceled bool) {
	b.Lock()
	defer b.Unlock()
	if b.suspendCount == 0 {
		b.resumeCh = make(chan struct{})
		b.suspendCh <- b.resumeCh
	}
	b.suspendCount++
	if b.activeLoadCtx != nil {
		b.Debug(b.activeLoadCtx, "Suspend: canceling active load")
		b.activeLoadCancelFn()
		canceled = true
	}
	return canceled
}

func (b *BackgroundConvLoader) Resume(ctx context.Context) bool {
	b.Lock()
	defer b.Unlock()
	if b.suspendCount > 0 {
		b.suspendCount--
		if b.suspendCount == 0 && b.resumeCh != nil {
			close(b.resumeCh)
			return true
		}
	}
	return false
}

func (b *BackgroundConvLoader) enqueue(ctx context.Context, task clTask) error {
	b.Lock()
	defer b.Unlock()
	select {
	case b.queueCh <- task:
		b.Debug(ctx, "enqueue: added %s to queue", task.convID)
	default:
		b.Debug(ctx, "enqueue: queue is full, not adding %s", task.convID)
		return errors.New("queue is full")
	}
	return nil
}

func (b *BackgroundConvLoader) setTestingNameInfoSource(ni types.NameInfoSource) {
	b.testingNameInfoSource = ni
}

func (b *BackgroundConvLoader) loop() {
	bgctx := context.Background()
	uid := b.uid
	b.Debug(bgctx, "loop: starting conv loader loop for %s", uid)
	waitForResume := func(ch chan struct{}) {
		b.Debug(bgctx, "waitForResume: suspending loop")
		<-ch
		b.clock.Sleep(b.resumeWait)
		b.Debug(bgctx, "waitForResume: resuming loop")
	}
	// On mobile fresh start, apply the foreground wait
	if b.G().GetAppType() == libkb.MobileAppType {
		b.Debug(bgctx, "loop: delaying startup since on mobile")
		b.clock.Sleep(b.resumeWait)
	}
	for {
		// get a convID from queue, or stop
		select {
		case task := <-b.queueCh:
			if task.convID.IsNil() {
				// means we closed this channel
				continue
			}
			// Make sure we aren't suspended
			select {
			case ch := <-b.suspendCh:
				b.Debug(bgctx, "loop: pulled queue task, but suspended, so waiting")
				waitForResume(ch)
			default:
			}
			b.Debug(bgctx, "loop: pulled queued task: %s", task.convID)
			// always wait a short amount of time to avoid
			// flood of conversation loads
			duration := bgLoaderInitDelay
			if task.attempt > 0 {
				duration = bgLoaderErrDelay - time.Since(task.lastAttemptAt)
				if duration < bgLoaderInitDelay {
					duration = bgLoaderInitDelay
				}
			}
			b.clock.Sleep(duration)
			b.load(bgctx, task, uid)
		case ch := <-b.suspendCh:
			b.Debug(bgctx, "loop: received suspend")
			waitForResume(ch)
		case ch := <-b.stopCh:
			b.Debug(bgctx, "loop: shutting down for %s", uid)
			close(ch)
			return
		}
	}
}

func (b *BackgroundConvLoader) newQueue() {
	if b.queueCh != nil {
		close(b.queueCh)
	}
	b.queueCh = make(chan clTask, 200)
}

func (b *BackgroundConvLoader) retriableError(err error) bool {
	if IsOfflineError(err) != OfflineErrorKindOnline {
		return true
	}
	switch err.(type) {
	case storage.AbortedError:
		return true
	}
	return false
}

func (b *BackgroundConvLoader) load(ictx context.Context, task clTask, uid gregor1.UID) {
	b.Debug(ictx, "load: loading conversation %s", task.convID)
	b.Lock()
	b.activeLoadCtx, b.activeLoadCancelFn = context.WithCancel(
		Context(b.makeConvLoaderContext(ictx), b.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil,
			b.identNotifier))
	ctx := b.activeLoadCtx
	b.Unlock()
	if b.testingNameInfoSource != nil {
		CtxKeyFinder(ctx, b.G()).SetNameInfoSourceOverride(b.testingNameInfoSource)
	}
	defer func() {
		b.Lock()
		b.activeLoadCancelFn()
		b.activeLoadCtx = nil
		b.activeLoadCancelFn = nil
		b.Unlock()
	}()

	query := &chat1.GetThreadQuery{MarkAsRead: false}
	pagination := &chat1.Pagination{Num: 50}
	_, _, err := b.G().ConvSource.Pull(ctx, task.convID, uid, query, pagination)
	if err != nil {
		b.Debug(ctx, "load: ConvSource.Pull error: %s (%T)", err, err)
		if b.retriableError(err) && task.attempt+1 < bgLoaderMaxAttempts {
			b.Debug(ctx, "transient error, retrying")
			task.attempt++
			task.lastAttemptAt = time.Now()
			b.enqueue(ctx, task)
			return
		}
		b.Debug(ctx, "load: failed to load conv %s", task.convID)
		return
	}
	b.Debug(ctx, "load: loaded conversation %s", task.convID)

	// if testing, put the convID on the loads channel
	if b.loads != nil {
		b.Debug(ctx, "load: putting convID %s on loads chan", task.convID)
		b.loads <- task.convID
	}
}
