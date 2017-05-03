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
	bgLoaderDelay       = 300 * time.Millisecond
)

type clTask struct {
	convID        chat1.ConversationID
	attempt       int
	lastAttemptAt time.Time
}

type BackgroundConvLoader struct {
	globals.Contextified
	utils.DebugLabeler

	started       bool
	queue         chan clTask
	stop          chan bool
	identNotifier *IdentifyNotifier

	loads chan chat1.ConversationID // for testing, make this and can check conv load successes

	sync.Mutex
}

var _ types.ConvLoader = (*BackgroundConvLoader)(nil)

func NewBackgroundConvLoader(g *globals.Context) *BackgroundConvLoader {
	b := &BackgroundConvLoader{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g, "BackgroundConvLoader", false),
		stop:          make(chan bool),
		identNotifier: NewIdentifyNotifier(g),
	}

	b.newQueue()

	return b
}

func (b *BackgroundConvLoader) Start(ctx context.Context, uid gregor1.UID) {
	b.Lock()
	defer b.Unlock()

	if b.started {
		b.stop <- true
	}

	b.newQueue()

	b.started = true
	go b.loop(uid)
}

func (b *BackgroundConvLoader) Stop(ctx context.Context) chan struct{} {
	b.Lock()
	defer b.Unlock()

	if b.started {
		b.stop <- true
		b.started = false
	}
	ch := make(chan struct{})
	close(ch)
	return ch
}

func (b *BackgroundConvLoader) Queue(ctx context.Context, convID chat1.ConversationID) error {
	return b.enqueue(ctx, clTask{convID: convID})
}

func (b *BackgroundConvLoader) enqueue(ctx context.Context, task clTask) error {
	b.Lock()
	defer b.Unlock()

	select {
	case b.queue <- task:
		b.Debug(ctx, "added %s to queue", task.convID)
	default:
		b.Debug(ctx, "queue is full, not adding %s", task.convID)
		return errors.New("queue is full")
	}

	return nil
}

func (b *BackgroundConvLoader) loop(uid gregor1.UID) {
	bgctx := context.Background()
	b.Debug(bgctx, "starting conv loader loop for %s", uid)
	for {
		// get a convID from queue, or stop
		select {
		case task := <-b.queue:
			if task.attempt > 0 {
				time.Sleep(bgLoaderDelay - time.Since(task.lastAttemptAt))
			}
			b.load(bgctx, task, uid)
		case <-b.stop:
			b.Debug(bgctx, "shutting down conv loader loop for %s", uid)
			return
		}
	}
}

func (b *BackgroundConvLoader) newQueue() {
	if b.queue != nil {
		close(b.queue)
	}
	b.queue = make(chan clTask, 200)
}

func (b *BackgroundConvLoader) load(ctx context.Context, task clTask, uid gregor1.UID) {
	b.Debug(ctx, "loading conversation %s", task.convID)

	var breaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, b.G().GetEnv(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &breaks, b.identNotifier)

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

		b.Debug(ctx, "sending conv %s to FetchRetrier", task.convID)
		b.G().FetchRetrier.Failure(ctx, task.convID, uid, types.ThreadLoad)

		return
	}

	b.Debug(ctx, "loaded conversation %s", task.convID)

	// if testing, put the convID on the loads channel
	if b.loads != nil {
		b.Debug(ctx, "putting convID %s on loads chan", task.convID)
		b.loads <- task.convID
	}
}
