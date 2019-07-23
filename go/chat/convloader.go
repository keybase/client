package chat

import (
	"container/list"
	"errors"
	"sync"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"

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

type activeLoad struct {
	Ctx      context.Context
	CancelFn context.CancelFunc
}

type BackgroundConvLoader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid           gregor1.UID
	started       bool
	queue         *jobQueue
	stopCh        chan struct{}
	suspendCh     chan chan struct{}
	resumeCh      chan struct{}
	loadCh        chan *clTask
	identNotifier types.IdentifyNotifier
	eg            errgroup.Group

	clock      clockwork.Clock
	resumeWait time.Duration

	activeLoads  map[string]activeLoad
	suspendCount int

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
		stopCh:        make(chan struct{}),
		suspendCh:     make(chan chan struct{}, 10),
		loadCh:        make(chan *clTask, 100),
		identNotifier: NewCachingIdentifyNotifier(g),
		clock:         clockwork.NewRealClock(),
		resumeWait:    time.Second,
		activeLoads:   make(map[string]activeLoad),
	}
	b.identNotifier.ResetOnGUIConnect()
	b.newQueue()
	go b.monitorAppState()

	return b
}

func (b *BackgroundConvLoader) addActiveLoadLocked(al activeLoad) (key string) {
	key = libkb.RandStringB64(3)
	b.activeLoads[key] = al
	return key
}

func (b *BackgroundConvLoader) removeActiveLoadLocked(key string) {
	delete(b.activeLoads, key)
}

func (b *BackgroundConvLoader) monitorAppState() error {
	ctx := context.Background()
	b.Debug(ctx, "monitorAppState: starting up")

	suspended := false
	state := keybase1.MobileAppState_FOREGROUND
	for {
		select {
		case state = <-b.G().MobileAppState.NextUpdate(&state):
			switch state {
			case keybase1.MobileAppState_FOREGROUND, keybase1.MobileAppState_BACKGROUNDACTIVE:
				b.Debug(ctx, "monitorAppState: active state: %v", state)
				// Only resume if we had suspended earlier (frontend can spam us with these)
				if suspended {
					b.Debug(ctx, "monitorAppState: resuming load thread")
					b.Resume(ctx)
					suspended = false
				}
			case keybase1.MobileAppState_BACKGROUND:
				b.Debug(ctx, "monitorAppState: backgrounded, suspending load thread")
				if !suspended {
					b.Suspend(ctx)
					suspended = true
				}
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

	if b.G().GetEnv().GetDisableBgConvLoader() {
		b.Debug(ctx, "BackgroundConvLoader disabled, aborting Start")
		return
	}
	b.Debug(ctx, "Start")
	if b.started {
		close(b.stopCh)
		b.stopCh = make(chan struct{})
	}
	b.newQueue()
	b.started = true
	b.uid = uid
	b.eg.Go(func() error { return b.loop(uid, b.stopCh) })
	b.eg.Go(func() error { return b.loadLoop(uid, b.stopCh) })
}

func (b *BackgroundConvLoader) Stop(ctx context.Context) chan struct{} {
	b.Lock()
	defer b.Unlock()
	b.Debug(ctx, "Stop")
	b.cancelActiveLoadsLocked()
	ch := make(chan struct{})
	if b.started {
		close(b.stopCh)
		b.stopCh = make(chan struct{})
		b.started = false
		go func() {
			b.eg.Wait()
			close(ch)
		}()
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

func (b *BackgroundConvLoader) setTestingNameInfoSource(ni types.NameInfoSource) {
	b.Debug(context.TODO(), "setTestingNameInfoSource: setting to %T", ni)
	b.testingNameInfoSource = ni
}

func (b *BackgroundConvLoader) Queue(ctx context.Context, job types.ConvLoaderJob) error {
	if b.isConvLoaderContext(ctx) {
		b.Debug(ctx, "Queue: refusing to queue in background loader context: convID: %s", job)
		return nil
	}
	return b.enqueue(ctx, clTask{job: job})
}

func (b *BackgroundConvLoader) cancelActiveLoadsLocked() (canceled bool) {
	for _, activeLoad := range b.activeLoads {
		select {
		case <-activeLoad.Ctx.Done():
			b.Debug(activeLoad.Ctx, "Suspend: active load already canceled")
		default:
			b.Debug(activeLoad.Ctx, "Suspend: canceling active load")
			activeLoad.CancelFn()
			canceled = true
		}
	}
	return canceled
}

func (b *BackgroundConvLoader) Suspend(ctx context.Context) (canceled bool) {
	defer b.Trace(ctx, func() error { return nil }, "Suspend")()
	b.Lock()
	defer b.Unlock()
	if !b.started {
		return false
	}
	if b.suspendCount == 0 {
		b.Debug(ctx, "Suspend: sending on suspendCh")
		b.resumeCh = make(chan struct{})
		select {
		case b.suspendCh <- b.resumeCh:
		default:
			b.Debug(ctx, "Suspend: failed to suspend loop")
		}
	}
	b.suspendCount++
	return b.cancelActiveLoadsLocked()
}

func (b *BackgroundConvLoader) Resume(ctx context.Context) bool {
	defer b.Trace(ctx, func() error { return nil }, "Resume")()
	b.Lock()
	defer b.Unlock()
	if b.suspendCount > 0 {
		b.suspendCount--
		if b.suspendCount == 0 && b.resumeCh != nil {
			b.Debug(ctx, "Resume: closing resumeCh")
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

func (b *BackgroundConvLoader) loop(uid gregor1.UID, stopCh chan struct{}) error {
	bgctx := context.Background()
	b.Debug(bgctx, "loop: starting conv loader loop for %s", uid)

	// waitForResume is called on suspend. It will wait for a resume event, and then pause
	// for b.resumeWait amount of time. Returns false if the outer loop should shutdown.
	waitForResume := func(ch chan struct{}) bool {
		b.Debug(bgctx, "waitForResume: suspending loop")
		select {
		case <-ch:
		case <-stopCh:
			return false
		}
		b.clock.Sleep(b.resumeWait)
		b.Debug(bgctx, "waitForResume: resuming loop")
		return true
	}
	// On mobile fresh start, apply the foreground wait
	if b.G().GetAppType() == libkb.MobileAppType {
		b.Debug(bgctx, "loop: delaying startup since on mobile")
		b.clock.Sleep(b.resumeWait)
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
			// Wait for a small amount of time before loading, this way we aren't in a tight loop
			// charging through conversations
			duration := bgLoaderInitDelay
			if task.attempt > 0 {
				duration = bgLoaderErrDelay - time.Since(task.lastAttemptAt)
				if duration < bgLoaderInitDelay {
					duration = bgLoaderInitDelay
				}
			}
			// Make sure we aren't suspended (also make sure we don't get shutdown). Charge through if
			// neither have any data on them.
			select {
			case <-b.clock.After(duration):
			case ch := <-b.suspendCh:
				b.Debug(bgctx, "loop: pulled queue task, but suspended, so waiting")
				if !waitForResume(ch) {
					return nil
				}
			}
			b.Debug(bgctx, "loop: pulled queued task: %s", task.job)
			select {
			case b.loadCh <- &task:
			default:
				b.Debug(bgctx, "loop: failed to dispatch load, queue full")
			}
		case ch := <-b.suspendCh:
			b.Debug(bgctx, "loop: received suspend")
			if !waitForResume(ch) {
				return nil
			}
		case <-stopCh:
			b.Debug(bgctx, "loop: shutting down for %s", uid)
			return nil
		}
	}
}

func (b *BackgroundConvLoader) loadLoop(uid gregor1.UID, stopCh chan struct{}) error {
	bgctx := context.Background()
	b.Debug(bgctx, "loadLoop: starting for uid: %s", uid)

	for {
		select {
		case task := <-b.loadCh:
			b.Debug(bgctx, "loadLoop: running task: %s", task.job)
			nextTask := b.load(bgctx, *task, uid)
			if nextTask != nil {
				if err := b.enqueue(bgctx, *nextTask); err != nil {
					b.Debug(bgctx, "enqueue error %s", err)
				}
			}
		case <-stopCh:
			return nil
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
	switch err {
	case context.Canceled:
		return true
	}
	switch err.(type) {
	case storage.AbortedError:
		return true
	}
	return false
}

func (b *BackgroundConvLoader) IsBackgroundActive() bool {
	b.Lock()
	defer b.Unlock()
	return len(b.activeLoads) > 0
}

func (b *BackgroundConvLoader) load(ictx context.Context, task clTask, uid gregor1.UID) *clTask {
	b.Debug(ictx, "load: loading conversation %s", task.job)
	b.Lock()
	var al activeLoad
	al.Ctx, al.CancelFn = context.WithCancel(
		globals.ChatCtx(b.makeConvLoaderContext(ictx), b.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil,
			b.identNotifier))
	ctx := al.Ctx
	alKey := b.addActiveLoadLocked(al)
	b.Unlock()
	if b.testingNameInfoSource != nil {
		ctx = globals.CtxAddOverrideNameInfoSource(ctx, b.testingNameInfoSource)
		b.Debug(ctx, "setting testing nameinfo source: %T", b.testingNameInfoSource)
	}
	defer func() {
		b.Lock()
		b.removeActiveLoadLocked(alKey)
		al.CancelFn()
		b.Unlock()
	}()

	job := task.job
	query := job.Query
	if query == nil {
		query = &chat1.GetThreadQuery{MarkAsRead: false}
	}
	pagination := job.Pagination
	if pagination == nil {
		pagination = &chat1.Pagination{Num: 50}
	}
	tv, err := b.G().ConvSource.Pull(ctx, job.ConvID, uid,
		chat1.GetThreadReason_BACKGROUNDCONVLOAD, query, pagination)
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
		ctx = globals.BackgroundChatCtx(ctx, g)
		if err := g.ConvLoader.Queue(ctx, job); err != nil {
			g.GetLog().CDebugf(ctx, "newConvLoaderPagebackHook: failed to queue job: job: %s err: %s",
				job, err)
		}
	}
}
