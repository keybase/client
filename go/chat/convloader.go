package chat

import (
	"errors"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type BackgroundConvLoader struct {
	globals.Contextified
	utils.DebugLabeler

	started       bool
	queue         chan chat1.ConversationID
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
	b.Lock()
	defer b.Unlock()

	select {
	case b.queue <- convID:
		b.Debug(ctx, "added %s to queue", convID)
	default:
		b.Debug(ctx, "queue is full, not adding %s", convID)
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
		case convID := <-b.queue:
			b.load(bgctx, convID, uid)
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
	b.queue = make(chan chat1.ConversationID, 200)
}

func (b *BackgroundConvLoader) load(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) {
	b.Debug(ctx, "loading conversation %s", convID)

	var breaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, b.G().GetEnv(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &breaks, b.identNotifier)

	query := &chat1.GetThreadQuery{MarkAsRead: false}
	pagination := &chat1.Pagination{Num: 50}
	_, _, err := b.G().ConvSource.Pull(ctx, convID, uid, query, pagination)
	if err != nil {
		b.Debug(ctx, "ConvSource.Pull error: %s", err)
	} else {
		b.Debug(ctx, "loaded conversation %s", convID)

		// if testing, put the convID on the loads channel
		if b.loads != nil {
			b.Debug(ctx, "putting convID %s on loads chan", convID)
			b.loads <- convID
		}
	}
}
