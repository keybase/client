package chat

import (
	"container/list"
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
	job           types.ConvLoaderJob
	attempt       int
	lastAttemptAt time.Time
}

type jobQueue struct {
	sync.Mutex
	queue   *list.List
	waitChs []chan struct{}
	maxSize int
}

func newJobQueue(maxSize int) *jobQueue {
	return &jobQueue{
		queue:   list.New(),
		maxSize: maxSize,
	}
}

func (j *jobQueue) Wait() <-chan struct{} {
	j.Lock()
	defer j.Unlock()
	if j.queue.Len() == 0 {
		ch := make(chan struct{})
		j.waitChs = append(j.waitChs, ch)
		return ch
	}
	ch := make(chan struct{})
	close(ch)
	return ch
}

func (j *jobQueue) Push(task clTask) error {
	j.Lock()
	defer j.Unlock()
	if j.queue.Len() >= j.maxSize {
		return errors.New("job queue full")
	}
	defer func() {
		// Notify waiters we have some stuff for them now
		for _, w := range j.waitChs {
			close(w)
		}
		j.waitChs = nil
	}()
	for e := j.queue.Front(); e != nil; e = e.Next() {
		eval := e.Value.(clTask)
		if task.job.HigherPriorityThan(eval.job) {
			j.queue.InsertBefore(task, e)
			return nil
		}
	}
	j.queue.PushBack(task)
	return nil
}

func (j *jobQueue) PopFront() (res clTask, ok bool) {
	j.Lock()
	defer j.Unlock()
	if j.queue.Len() == 0 {
		return res, false
	}
	el := j.queue.Front()
	res = el.Value.(clTask)
	j.queue.Remove(el)
	return res, true
}

type BackgroundConvLoader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid           gregor1.UID
	started       bool
	queue         *jobQueue
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
		stopCh:        make(chan chan struct{}),
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
	state := keybase1.AppState_FOREGROUND
	for {
		state = <-b.G().AppState.NextUpdate(&state)
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
			if !suspended {
				b.Suspend(ctx)
				suspended = true
			}
		}
		if b.appStateCh != nil {
			b.appStateCh <- struct{}{}
		}
	}
}

func (b *BackgroundConvLoader) Start(ctx context.Context, uid gregor1.UID) {
	b.Lock()
	defer b.Unlock()
	b.Debug(ctx, "Start")
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
	b.Debug(ctx, "Stop")
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

func (b *BackgroundConvLoader) Queue(ctx context.Context, job types.ConvLoaderJob) error {
	if b.isConvLoaderContext(ctx) {
		b.Debug(ctx, "Queue: refusing to queue in background loader context: convID: %s", job)
		return nil
	}
	return b.enqueue(ctx, clTask{job: job})
}

func (b *BackgroundConvLoader) Suspend(ctx context.Context) (canceled bool) {
	b.Lock()
	defer b.Unlock()
	if !b.started {
		return false
	}
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
	b.Debug(ctx, "enqueue: adding task: %s", task.job)
	return b.queue.Push(task)
}

func (b *BackgroundConvLoader) setTestingNameInfoSource(ni types.NameInfoSource) {
	b.testingNameInfoSource = ni
}

// recvWithShutdown receives from a blank channel, and aborts if a shutdown event happens
func (b *BackgroundConvLoader) recvWithShutdown(ctx context.Context, ch chan struct{}, reason string) bool {
	select {
	case <-ch:
	case ch := <-b.stopCh:
		b.Debug(ctx, "loop: shutting down: uid: %s reason: %s", b.uid, reason)
		close(ch)
		return false
	}
	return true
}

// recvTimeWithShutdown receives from time channel, and aborts if a shutdown event happens
func (b *BackgroundConvLoader) recvTimeWithShutdown(ctx context.Context, ch <-chan time.Time, reason string) bool {
	select {
	case <-ch:
	case ch := <-b.stopCh:
		b.Debug(ctx, "loop: shutting down: uid: %s reason: %s", b.uid, reason)
		close(ch)
		return false
	}
	return true
}

// recvTaskWithShutdown receives a task, but also will abort on shutdown
func (b *BackgroundConvLoader) recvTaskWithShutdown(ctx context.Context, cb chan *clTask) (*clTask, bool) {
	select {
	case task := <-cb:
		return task, true
	case ch := <-b.stopCh:
		b.Debug(ctx, "loop: shutting down: uid: %s reason: load task", b.uid)
		close(ch)
		return nil, false
	}
}

func (b *BackgroundConvLoader) loop() {
	bgctx := context.Background()
	uid := b.uid
	b.Debug(bgctx, "loop: starting conv loader loop for %s", uid)

	// waitForResume is called on suspend. It will wait for a resume event, and then pause
	// for b.resumeWait amount of time. Returns false if the outer loop should shutdown.
	waitForResume := func(ch chan struct{}) bool {
		b.Debug(bgctx, "waitForResume: suspending loop")
		if !b.recvWithShutdown(bgctx, ch, "waitForResume: resume") {
			return false
		}
		if !b.recvTimeWithShutdown(bgctx, b.clock.After(b.resumeWait), "waitForResume: resumeWait") {
			return false
		}
		b.Debug(bgctx, "waitForResume: resuming loop")
		return true
	}
	// On mobile fresh start, apply the foreground wait
	if b.G().GetAppType() == libkb.MobileAppType {
		b.Debug(bgctx, "loop: delaying startup since on mobile")
		if !b.recvTimeWithShutdown(bgctx, b.clock.After(b.resumeWait), "initial mobile wait") {
			return
		}
	}

	// Main loop
	for {
		b.Debug(bgctx, "loop: waiting for job")
		select {
		case <-b.queue.Wait():
			task, ok := b.queue.PopFront()
			if !ok {
				continue
			}
			if task.job.ConvID.IsNil() {
				// means we closed this channel
				continue
			}

			// Make sure we aren't suspended (also make sure we don't get shutdown). Charge through if
			// neither have any data on them.
			select {
			case ch := <-b.suspendCh:
				b.Debug(bgctx, "loop: pulled queue task, but suspended, so waiting")
				if !waitForResume(ch) {
					return
				}
			case ch := <-b.stopCh:
				b.Debug(bgctx, "loop: shutting down (in queue wait) for %s", uid)
				close(ch)
				return
			default:
			}
			b.Debug(bgctx, "loop: pulled queued task: %s", task.job)

			// Wait for a small amount of time before loading, this way we aren't in a tight loop
			// charging through conversations
			duration := bgLoaderInitDelay
			if task.attempt > 0 {
				duration = bgLoaderErrDelay - time.Since(task.lastAttemptAt)
				if duration < bgLoaderInitDelay {
					duration = bgLoaderInitDelay
				}
			}
			if !b.recvTimeWithShutdown(bgctx, b.clock.After(duration), "load pause") {
				return
			}

			// Run the load of the conversation with a callback so we can abort the loop on shutdown. If
			// the load failed, it will return a new task to enqueue (if we haven't been shutdown).
			cb := make(chan *clTask, 1)
			go func() {
				gtask := b.load(bgctx, task, uid)
				cb <- gtask
			}()
			nextTask, resume := b.recvTaskWithShutdown(bgctx, cb)
			if !resume {
				return
			}
			if nextTask != nil {
				if err := b.enqueue(bgctx, *nextTask); err != nil {
					b.Debug(bgctx, "enqueue error %s", err)
				}

			}
		case ch := <-b.suspendCh:
			b.Debug(bgctx, "loop: received suspend")
			if !waitForResume(ch) {
				return
			}
		case ch := <-b.stopCh:
			b.Debug(bgctx, "loop: shutting down for %s", uid)
			close(ch)
			return
		}
	}
}

func (b *BackgroundConvLoader) newQueue() {
	b.queue = newJobQueue(1000)
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

func (b *BackgroundConvLoader) load(ictx context.Context, task clTask, uid gregor1.UID) *clTask {
	b.Debug(ictx, "load: loading conversation %s", task.job)
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

	job := task.job
	query := &chat1.GetThreadQuery{MarkAsRead: false}
	pagination := job.Pagination
	if pagination == nil {
		pagination = &chat1.Pagination{Num: 50}
	}
	tv, _, err := b.G().ConvSource.Pull(ctx, job.ConvID, uid, query, pagination)
	if err != nil {
		b.Debug(ctx, "load: ConvSource.Pull error: %s (%T)", err, err)
		if b.retriableError(err) && task.attempt+1 < bgLoaderMaxAttempts {
			b.Debug(ctx, "transient error, retrying")
			task.attempt++
			task.lastAttemptAt = time.Now()
			return &task
		}
		b.Debug(ctx, "load: failed to load job: %s", job)
		return nil
	}
	b.Debug(ctx, "load: loaded job: %s", job)
	if job.PostLoadHook != nil {
		b.Debug(ctx, "load: invoking post load hook on job: %s", job)
		job.PostLoadHook(ctx, tv, job)
	}

	// if testing, put the convID on the loads channel
	if b.loads != nil {
		b.Debug(ctx, "load: putting convID %s on loads chan", job.ConvID)
		b.loads <- job.ConvID
	}
	return nil
}

func newConvLoaderPagebackHook(g *globals.Context, curCalls, maxCalls int) func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
	return func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
		if curCalls >= maxCalls || tv.Pagination == nil || tv.Pagination.Last {
			g.GetLog().CDebugf(ctx, "newConvLoaderPagebackHook: bailing out: job: %s curcalls: %d p: %s",
				job, curCalls, tv.Pagination)
			return
		}
		job.Pagination.Next = tv.Pagination.Next
		job.Pagination.Previous = nil
		job.Priority = types.ConvLoaderPriorityLow
		job.PostLoadHook = newConvLoaderPagebackHook(g, curCalls+1, maxCalls)
		// Create a new context here so that we don't trip conv loader blocking rule
		ctx = BackgroundContext(ctx, g)
		if err := g.ConvLoader.Queue(ctx, job); err != nil {
			g.GetLog().CDebugf(ctx, "newConvLoaderPagebackHook: failed to queue job: job: %s err: %s",
				job, err)
		}
	}
}
