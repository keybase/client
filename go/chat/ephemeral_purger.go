package chat

import (
	"container/heap"
	"context"
	"sync"
	"time"

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

// An queueItem is something we manage in a priority queue.
type queueItem struct {
	purgeInfo chat1.EphemeralPurgeInfo

	// The index is needed by `update` and is maintained by the heap.Interface methods.
	index int // The index of the queueItem in the heap.
}

// A priorityQueue implements heap.Interface and holds queueItems.
// We also keep a map of queueItems for easy item updates
type priorityQueue struct {
	sync.RWMutex

	queue []*queueItem
	// convID -> *queueItem
	itemMap map[string]*queueItem
}

func newPriorityQueue() *priorityQueue {
	return &priorityQueue{
		queue:   []*queueItem{},
		itemMap: make(map[string]*queueItem),
	}
}

func (pq *priorityQueue) Len() int {
	pq.RLock()
	defer pq.RUnlock()

	return len(pq.queue)
}

func (pq *priorityQueue) Less(i, j int) bool {
	pq.RLock()
	defer pq.RUnlock()

	return pq.queue[i].purgeInfo.NextPurgeTime < pq.queue[j].purgeInfo.NextPurgeTime
}

func (pq *priorityQueue) Swap(i, j int) {
	pq.Lock()
	defer pq.Unlock()

	pq.queue[i], pq.queue[j] = pq.queue[j], pq.queue[i]
	pq.queue[i].index = i
	pq.queue[j].index = j
}

// Note this method should not be used directly since we only want each
// conversation to appear once in the heap. Use
// `BackgroundEphemeralPurger.update` instead since it handles this as
// intended.
func (pq *priorityQueue) Push(x interface{}) {
	pq.Lock()
	defer pq.Unlock()

	item := x.(*queueItem)
	item.index = len(pq.queue)
	pq.queue = append(pq.queue, item)
	pq.itemMap[item.purgeInfo.ConvID.String()] = item
}

func (pq *priorityQueue) Pop() interface{} {
	pq.Lock()
	defer pq.Unlock()

	n := len(pq.queue)
	item := pq.queue[n-1]
	item.index = -1 // for safety
	pq.queue = pq.queue[:n-1]
	delete(pq.itemMap, item.purgeInfo.ConvID.String())
	return item
}

func (pq *priorityQueue) Peek() *queueItem {
	pq.RLock()
	defer pq.RUnlock()

	if len(pq.queue) == 0 {
		return nil
	}
	return pq.queue[0]
}

type BackgroundEphemeralPurger struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid     gregor1.UID
	looping bool
	pq      *priorityQueue
	stopCh  chan chan struct{}
	storage *storage.Storage

	delay        time.Duration
	clock        clockwork.Clock
	outboxTicker *libkb.BgTicker
	purgeTimer   *time.Timer
}

var _ types.EphemeralPurger = (*BackgroundEphemeralPurger)(nil)

func NewBackgroundEphemeralPurger(g *globals.Context, storage *storage.Storage) *BackgroundEphemeralPurger {
	return &BackgroundEphemeralPurger{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "BackgroundEphemeralPurger", false),
		pq:           newPriorityQueue(),
		storage:      storage,
		stopCh:       make(chan chan struct{}),
		delay:        500 * time.Millisecond,
		clock:        clockwork.NewRealClock(),
	}
}

func (b *BackgroundEphemeralPurger) SetClock(clock clockwork.Clock) {
	b.clock = clock
}

func (b *BackgroundEphemeralPurger) Start(ctx context.Context, uid gregor1.UID) {
	b.Debug(ctx, "Start")

	b.Lock()
	defer b.Unlock()

	if b.looping {
		b.stopCh <- make(chan struct{})
	}
	b.cleanupTimers()
	b.uid = uid
	b.initQueue(ctx)

	// Purge the outbox periodically
	b.outboxTicker = libkb.NewBgTicker(5 * time.Minute)
	go func() {
		for {
			<-b.outboxTicker.C
			// Check the outbox for stuck ephemeral messages that need purging
			storage.NewOutbox(b.G(), b.uid).EphemeralPurge(context.Background())
		}
	}()
}

func (b *BackgroundEphemeralPurger) Stop(ctx context.Context) chan struct{} {
	b.Debug(ctx, "Stop")

	b.Lock()
	defer b.Unlock()

	ch := make(chan struct{})
	if b.looping {
		b.stopCh <- ch
	} else {
		close(ch)
	}
	b.cleanupTimers()
	return ch
}

func (b *BackgroundEphemeralPurger) cleanupTimers() {
	if b.outboxTicker != nil {
		b.outboxTicker.Stop()
	}
	if b.purgeTimer != nil {
		b.purgeTimer.Stop()
	}
}

func (b *BackgroundEphemeralPurger) Queue(ctx context.Context, purgeInfo chat1.EphemeralPurgeInfo) {
	b.Debug(ctx, "Queue purgeInfo: %v, queue: %v", purgeInfo, len(b.pq.queue))

	b.Lock()
	defer b.Unlock()

	// We only keep active items in the queue.
	if !purgeInfo.IsActive {
		return
	}

	// If we are starting the queue or get an earlier expiration time, reset or start the timer
	head := b.pq.Peek()
	if head == nil || purgeInfo.NextPurgeTime < head.purgeInfo.NextPurgeTime {
		b.setOrResetTimer(purgeInfo)
	}
	b.updateQueue(purgeInfo)
}

// Read all purgeInfo from disk and startup our queue.
func (b *BackgroundEphemeralPurger) initQueue(ctx context.Context) {
	allPurgeInfo, err := b.storage.GetAllPurgeInfo(ctx, b.uid)
	if err != nil {
		b.Debug(ctx, "unable to get purgeInfo: %v", allPurgeInfo)
	}
	for _, purgeInfo := range allPurgeInfo {
		if purgeInfo.IsActive {
			b.updateQueue(purgeInfo)
		}
	}
	b.queuePurges(ctx)
}

func (b *BackgroundEphemeralPurger) updateQueue(purgeInfo chat1.EphemeralPurgeInfo) {
	item, ok := b.pq.itemMap[purgeInfo.ConvID.String()]
	if ok {
		item.purgeInfo = purgeInfo
		heap.Fix(b.pq, item.index)
	} else {
		heap.Push(b.pq, &queueItem{purgeInfo: purgeInfo})
	}
}

// This runs when we are waiting to run a job but will shut itself down if we
// have no work.
func (b *BackgroundEphemeralPurger) loop(duration time.Duration) {
	b.looping = true
	defer func() { b.looping = false }()
	bgctx := context.Background()
	for {
		b.Debug(bgctx, "loop: waiting for job, timer to fire at: %v", b.clock.Now().Add(duration))
		select {
		case <-b.purgeTimer.C:
			select {
			case ch := <-b.stopCh:
				b.Debug(bgctx, "loop: shutting down (in lock wait) for %s", b.uid)
				close(ch)
				return
			default:
			}
			b.Lock()
			stop := b.queuePurges(bgctx)
			b.Unlock()
			// If we are out of jobs currently, shut down our loop since we
			// have no timer to listen for.
			if stop {
				return
			}
		case ch := <-b.stopCh:
			b.Debug(bgctx, "loop: shutting down for %s", b.uid)
			close(ch)
			return
		}
	}
}

// Send any conversations that need an ephemeral message purged to the
// convLoader. We reset our timer with the next minimum time (if any) returning
// if the work loop should stop or not.
func (b *BackgroundEphemeralPurger) queuePurges(ctx context.Context) bool {
	b.Debug(ctx, "queuePurges")

	now := b.clock.Now()
	i := 0
	// Peek into the queue for any expired convs
	for _, item := range b.pq.queue {
		purgeInfo := item.purgeInfo
		nextPurgeTime := purgeInfo.NextPurgeTime.Time()
		if nextPurgeTime.Before(now) || nextPurgeTime.Equal(now) {
			job := types.NewConvLoaderJob(purgeInfo.ConvID, &chat1.Pagination{},
				types.ConvLoaderPriorityHigh, newConvLoaderEphemeralPurgeHook(b.G(), b.storage, b.uid, &purgeInfo))
			if err := b.G().ConvLoader.Queue(ctx, job); err != nil {
				b.Debug(ctx, "convLoader Queue error %s", err)
			}
			// Don't spam out to the convloader
			if i > 0 {
				b.clock.Sleep(b.delay)
			}
			i++
		} else {
			break
		}
	}
	// Maintain the queue and pop off any items we just sent off for purging
	for i > 0 {
		heap.Pop(b.pq)
		i--
	}
	nextItem := b.pq.Peek()
	if nextItem == nil {
		if b.purgeTimer != nil {
			b.purgeTimer.Stop()
		}
		return true
	}
	// Reset our time for the next min item of the queue.
	b.setOrResetTimer(nextItem.purgeInfo)
	return false
}

func (b *BackgroundEphemeralPurger) setOrResetTimer(purgeInfo chat1.EphemeralPurgeInfo) {
	duration := purgeInfo.NextPurgeTime.Time().Sub(b.clock.Now())
	if b.purgeTimer == nil {
		b.purgeTimer = time.NewTimer(duration)
	} else {
		b.purgeTimer.Stop()
		b.purgeTimer.Reset(duration)
	}
	if !b.looping {
		go b.loop(duration)
	}
}

func newConvLoaderEphemeralPurgeHook(g *globals.Context, chatStorage *storage.Storage, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
	return func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
		_, explodedMsgs, err := chatStorage.EphemeralPurge(ctx, job.ConvID, uid, purgeInfo)
		if err != nil {
			g.GetLog().CDebugf(ctx, "ephemeralPurge: %s", err)
		} else {
			if len(explodedMsgs) > 0 {
				ib, err := g.InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
					ConvIDs: []chat1.ConversationID{job.ConvID},
				}, nil)
				if err != nil || len(ib.Convs) != 1 {
					g.GetLog().CDebugf(ctx, "FindConversationsByID: convs: %v err: %v", ib.Convs, err)
					return
				}
				inboxUIItem := utils.PresentConversationLocal(ib.Convs[0], g.Env.GetUsername().String())

				purgedMsgs := []chat1.UIMessage{}
				for _, msg := range explodedMsgs {
					purgedMsgs = append(purgedMsgs, utils.PresentMessageUnboxed(ctx, g, msg, uid, job.ConvID))
				}
				act := chat1.NewChatActivityWithEphemeralPurge(chat1.EphemeralPurgeNotifInfo{
					ConvID: job.ConvID,
					Msgs:   purgedMsgs,
					Conv:   &inboxUIItem,
				})
				g.NotifyRouter.HandleNewChatActivity(ctx, keybase1.UID(uid.String()), &act)
			}
		}
	}
}
