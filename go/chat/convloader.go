package chat

import (
	"errors"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	bgLoaderMaxAttempts = 4
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

	activeLoadCtx      context.Context
	activeLoadCancelFn context.CancelFunc
	suspendCount       int

	// for testing, make this and can check conv load successes
	loads                 chan chat1.ConversationID
	testingNameInfoSource types.NameInfoSource
}

var _ types.ConvLoader = (*BackgroundConvLoader)(nil)

func NewBackgroundConvLoader(g *globals.Context) *BackgroundConvLoader {
	b := &BackgroundConvLoader{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "BackgroundConvLoader", false),
		stopCh:        make(chan chan struct{}),
		suspendCh:     make(chan chan struct{}, 10),
		identNotifier: NewCachingIdentifyNotifier(g),
	}
	b.identNotifier.ResetOnGUIConnect()

	b.newQueue()

	return b
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

func (b *BackgroundConvLoader) Queue(ctx context.Context, convID chat1.ConversationID) error {
	return b.enqueue(ctx, clTask{convID: convID})
}

func (b *BackgroundConvLoader) Suspend(ctx context.Context) (canceled bool) {
	b.Lock()
	defer b.Unlock()
	if b.activeLoadCtx != nil {
		b.Debug(b.activeLoadCtx, "canceling active load")
		b.activeLoadCancelFn()
		canceled = true
	}
	if b.suspendCount == 0 {
		b.resumeCh = make(chan struct{})
		b.suspendCh <- b.resumeCh
	}
	b.suspendCount++
	return canceled
}

func (b *BackgroundConvLoader) Resume(ctx context.Context) {

}

func (b *BackgroundConvLoader) enqueue(ctx context.Context, task clTask) error {
	b.Lock()
	defer b.Unlock()

	select {
	case b.queueCh <- task:
		b.Debug(ctx, "added %s to queue", task.convID)
	default:
		b.Debug(ctx, "queue is full, not adding %s", task.convID)
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
	b.Debug(bgctx, "starting conv loader loop for %s", uid)
	for {
		// get a convID from queue, or stop
		select {
		case task := <-b.queueCh:
			// always wait a short amount of time to avoid
			// flood of conversation loads
			duration := bgLoaderInitDelay
			if task.attempt > 0 {
				duration = bgLoaderErrDelay - time.Since(task.lastAttemptAt)
				if duration < bgLoaderInitDelay {
					duration = bgLoaderInitDelay
				}
			}
			time.Sleep(duration)
			b.load(bgctx, task, uid)
		case ch := <-b.stopCh:
			b.Debug(bgctx, "shutting down conv loader loop for %s", uid)
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

func (b *BackgroundConvLoader) load(ictx context.Context, task clTask, uid gregor1.UID) {
	b.Debug(ictx, "loading conversation %s", task.convID)
	b.Lock()
	b.activeLoadCtx, b.activeLoadCancelFn = context.WithCancel(Context(ictx, b.G(),
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, b.identNotifier))
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
		b.Debug(ctx, "ConvSource.Pull error: %s (%T)", err, err)
		if _, ok := err.(*TransientUnboxingError); ok && task.attempt+1 < bgLoaderMaxAttempts {
			b.Debug(ctx, "transient error, retrying")
			task.attempt++
			task.lastAttemptAt = time.Now()
			b.enqueue(ctx, task)
			return
		}
		b.Debug(ctx, "failed to load conv %s", task.convID)
		return
	}
	b.Debug(ctx, "loaded conversation %s", task.convID)

	// if testing, put the convID on the loads channel
	if b.loads != nil {
		b.Debug(ctx, "putting convID %s on loads chan", task.convID)
		b.loads <- task.convID
	}
}
