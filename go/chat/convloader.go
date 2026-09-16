package chat

import (
	"container/list"
	"context"
	"errors"
	"sync"
	"time"

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
	queue    *list.List
	waitChs  []chan struct{}
	queueMap map[string]bool
	maxSize  int
}

func newJobQueue(maxSize int) *jobQueue {
	return &jobQueue{
		queue:    list.New(),
		queueMap: make(map[string]bool),
		maxSize:  maxSize,
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

func (j *jobQueue) Push(task clTask) (queued bool, err error) {
	j.Lock()
	defer j.Unlock()
	if j.queue.Len() >= j.maxSize {
		return false, errors.New("job queue full")
	}
	defer func() {
		if !queued {
			return
		}
		// Notify waiters we have some stuff for them now
		for _, w := range j.waitChs {
			close(w)
		}
		j.waitChs = nil
	}()
	if task.job.Uniqueness == types.ConvLoaderGeneric && j.queueMap[task.job.String()] {
		return false, nil
	}
	j.queueMap[task.job.String()] = true
	for e := j.queue.Front(); e != nil; e = e.Next() {
		eval := e.Value.(clTask)
		if task.job.HigherPriorityThan(eval.job) {
			j.queue.InsertBefore(task, e)
			return true, nil
		}
	}
	j.queue.PushBack(task)
	return true, nil
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
	delete(j.queueMap, res.job.String())
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

	uid     gregor1.UID
	started bool
	queue   *jobQueue
	stopCh  chan struct{}
	// suspendCh belongs to the current run, so a loop of a stopped run
	// cannot take a suspension meant for its successor.
	suspendCh     chan chan struct{}
	resumeCh      chan struct{}
	loadCh        chan *clTask
	identNotifier types.IdentifyNotifier
	// eg holds the current run's goroutines. Each run gets its own, since
	// Stop waits on it from a goroutine and a Group cannot be added to
	// while somebody waits on it.
	eg *errgroup.Group

	clock      clockwork.Clock
	resumeWait time.Duration
	loadWait   time.Duration

	activeLoads  map[string]activeLoad
	suspendCount int
	// appSuspended is the app-state monitor's own suspension, kept apart
	// from suspendCount so an unbalanced Resume cannot release it.
	appSuspended bool
	// monitorState is the state the current run's monitor last acted on,
	// and monitorWait the change channel it waits on for that state; tests
	// use them to wait until the monitor has caught up.
	monitorState keybase1.MobileAppState
	monitorWait  <-chan struct{}

	// for testing, make this and can check conv load successes
	loads                 chan chat1.ConversationID
	testingNameInfoSource types.NameInfoSource
	appStateCh            chan struct{}
}

var _ types.ConvLoader = (*BackgroundConvLoader)(nil)

func NewBackgroundConvLoader(g *globals.Context) *BackgroundConvLoader {
	b := &BackgroundConvLoader{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.ExternalG(), "BackgroundConvLoader", false),
		stopCh:        make(chan struct{}),
		eg:            new(errgroup.Group),
		identNotifier: NewCachingIdentifyNotifier(g),
		clock:         clockwork.NewRealClock(),
		resumeWait:    time.Second,
		loadWait:      time.Second,
		activeLoads:   make(map[string]activeLoad),
	}
	b.identNotifier.ResetOnGUIConnect()
	b.newQueue()
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

// suspendInAppState is whether background loads pause in state. INACTIVE
// (Control Center, system alerts) keeps loading, as does BACKGROUNDACTIVE.
func suspendInAppState(state keybase1.MobileAppState) bool {
	return state == keybase1.MobileAppState_BACKGROUND
}

func (b *BackgroundConvLoader) setAppStateLocked(ctx context.Context, state keybase1.MobileAppState) {
	suspend := suspendInAppState(state)
	if suspend == b.appSuspended {
		return
	}
	wasSuspended := b.suspendedLocked()
	b.appSuspended = suspend
	if suspend {
		b.Debug(ctx, "setAppState: suspending load thread in %v", state)
		b.cancelActiveLoadsLocked()
	} else {
		b.Debug(ctx, "setAppState: resuming load thread in %v", state)
	}
	b.signalSuspendLocked(ctx, wasSuspended)
}

func (b *BackgroundConvLoader) monitorAppState(stopCh chan struct{}, state keybase1.MobileAppState) error {
	ctx := context.Background()
	b.Debug(ctx, "monitorAppState: starting up in %v", state)
	for {
		next := b.G().MobileAppState.NextUpdate(state)
		b.Lock()
		if b.stopCh == stopCh {
			b.monitorState, b.monitorWait = state, next
		}
		b.Unlock()
		select {
		case <-next:
		case <-stopCh:
			b.Debug(ctx, "monitorAppState: shutting down")
			return nil
		}
		b.Lock()
		if b.stopCh != stopCh {
			b.Unlock()
			return nil
		}
		// Read and apply under the lock, so Start and Stop never interleave
		// with a decision made on a stale state.
		state = b.G().MobileAppState.State()
		b.setAppStateLocked(ctx, state)
		b.Unlock()
		if b.appStateCh != nil {
			select {
			case b.appStateCh <- struct{}{}:
			case <-stopCh:
				return nil
			}
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
	var prevRun *errgroup.Group
	if b.started {
		prevRun = b.endRunLocked()
	}
	b.newQueue()
	b.started = true
	b.uid = uid
	stopCh, eg, queue, loadCh := b.stopCh, b.eg, b.queue, b.loadCh
	if prevRun != nil {
		// Stop waits for the replaced run too.
		eg.Go(prevRun.Wait)
	}
	b.suspendCh = make(chan chan struct{}, 10)
	suspendCh := b.suspendCh
	// Hand a suspension that outlived the last run to this run's loop.
	if b.suspendedLocked() && b.resumeCh != nil {
		suspendCh <- b.resumeCh
	}
	state := b.G().MobileAppState.State()
	b.setAppStateLocked(ctx, state)
	eg.Go(func() error { return b.loop(uid, stopCh, suspendCh, queue, loadCh) })
	eg.Go(func() error { return b.loadLoop(uid, stopCh, queue, loadCh) })
	eg.Go(func() error { return b.monitorAppState(stopCh, state) })
}

// endRunLocked stops the current run's goroutines and returns their group.
// The app-state suspension is left as is; the next Start seeds it again.
func (b *BackgroundConvLoader) endRunLocked() *errgroup.Group {
	eg := b.eg
	b.started = false
	close(b.stopCh)
	b.stopCh = make(chan struct{})
	b.eg = new(errgroup.Group)
	b.monitorWait = nil
	return eg
}

func (b *BackgroundConvLoader) Stop(ctx context.Context) chan struct{} {
	b.Lock()
	defer b.Unlock()
	b.Debug(ctx, "Stop")
	b.cancelActiveLoadsLocked()
	ch := make(chan struct{})
	if b.started {
		eg := b.endRunLocked()
		go func() {
			_ = eg.Wait()
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (b *BackgroundConvLoader) setTestingNameInfoSource(ni types.NameInfoSource) {
	b.Debug(context.TODO(), "setTestingNameInfoSource: setting to %T", ni)
	b.testingNameInfoSource = ni
}

func (b *BackgroundConvLoader) Queue(ctx context.Context, job types.ConvLoaderJob) error {
	// allow high priority to be queued even in the bkg loader context. Often times, this is something like
	// an ephemeral purge which we don't want to block.
	if job.Priority != types.ConvLoaderPriorityHighest && utils.IsConvLoaderContext(ctx) {
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

func (b *BackgroundConvLoader) suspendedLocked() bool {
	return b.suspendCount > 0 || b.appSuspended
}

// signalSuspendLocked tells the loop about a change in suspension, given
// whether it was suspended before the change.
func (b *BackgroundConvLoader) signalSuspendLocked(ctx context.Context, wasSuspended bool) {
	suspended := b.suspendedLocked()
	switch {
	case suspended && !wasSuspended:
		b.Debug(ctx, "Suspend: sending on suspendCh")
		b.resumeCh = make(chan struct{})
		select {
		case b.suspendCh <- b.resumeCh:
		default:
			b.Debug(ctx, "Suspend: failed to suspend loop")
		}
	case !suspended && wasSuspended && b.resumeCh != nil:
		b.Debug(ctx, "Resume: closing resumeCh")
		close(b.resumeCh)
		b.resumeCh = nil
	}
}

func (b *BackgroundConvLoader) Suspend(ctx context.Context) (canceled bool) {
	defer b.Trace(ctx, nil, "Suspend")()
	b.Lock()
	defer b.Unlock()
	if !b.started {
		return false
	}
	wasSuspended := b.suspendedLocked()
	b.suspendCount++
	b.signalSuspendLocked(ctx, wasSuspended)
	return b.cancelActiveLoadsLocked()
}

func (b *BackgroundConvLoader) Resume(ctx context.Context) bool {
	defer b.Trace(ctx, nil, "Resume")()
	b.Lock()
	defer b.Unlock()
	if b.suspendCount == 0 {
		return false
	}
	wasSuspended := b.suspendedLocked()
	b.suspendCount--
	b.signalSuspendLocked(ctx, wasSuspended)
	return b.suspendCount == 0
}

func (b *BackgroundConvLoader) isSuspended() bool {
	b.Lock()
	defer b.Unlock()
	return b.suspendedLocked()
}

func (b *BackgroundConvLoader) isRunning() bool {
	b.Lock()
	defer b.Unlock()
	return b.started
}

func (b *BackgroundConvLoader) enqueue(ctx context.Context, task clTask) error {
	b.Lock()
	defer b.Unlock()
	return b.push(ctx, b.queue, task)
}

// requeue puts a task back on the queue of the run that loaded it, and drops
// it once that run has stopped, so it never reaches a later run (or user).
func (b *BackgroundConvLoader) requeue(ctx context.Context, stopCh chan struct{}, queue *jobQueue, task clTask) {
	select {
	case <-stopCh:
		b.Debug(ctx, "requeue: run stopped, dropping task: %s", task.job)
		return
	default:
	}
	if err := b.push(ctx, queue, task); err != nil {
		b.Debug(ctx, "enqueue error %s", err)
	}
}

func (b *BackgroundConvLoader) push(ctx context.Context, queue *jobQueue, task clTask) error {
	b.Debug(ctx, "enqueue: adding task: %s", task.job)
	queued, err := queue.Push(task)
	if err != nil {
		return err
	}
	if !queued {
		b.Debug(ctx, "enqueue: skipped queueing job: %s", task.job)
	}
	return nil
}

func (b *BackgroundConvLoader) loop(uid gregor1.UID, stopCh chan struct{}, suspendCh chan chan struct{},
	queue *jobQueue, loadCh chan *clTask,
) error {
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
		b.clock.Sleep(libkb.RandomJitter(b.resumeWait))
		b.Debug(bgctx, "waitForResume: resuming loop")
		return true
	}
	// On mobile fresh start, apply the foreground wait
	if b.G().IsMobileAppType() {
		b.Debug(bgctx, "loop: delaying startup since on mobile")
		b.clock.Sleep(libkb.RandomJitter(b.resumeWait))
	}

	// Main loop
	for {
		b.Debug(bgctx, "loop: waiting for job")
		select {
		case <-queue.Wait():
			task, ok := queue.PopFront()
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
				duration = max(bgLoaderErrDelay-time.Since(task.lastAttemptAt), bgLoaderInitDelay)
			}
			// Make sure we aren't suspended (also make sure we don't get shutdown). Charge through if
			// neither have any data on them.
			select {
			case <-b.clock.After(duration):
			case ch := <-suspendCh:
				b.Debug(bgctx, "loop: pulled queue task, but suspended, so waiting")
				if !waitForResume(ch) {
					return nil
				}
			}
			b.Debug(bgctx, "loop: pulled queued task: %s", task.job)
			select {
			case loadCh <- &task:
			default:
				b.Debug(bgctx, "loop: failed to dispatch load, queue full")
			}
		case ch := <-suspendCh:
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

func (b *BackgroundConvLoader) loadLoop(uid gregor1.UID, stopCh chan struct{}, queue *jobQueue,
	loadCh chan *clTask,
) error {
	bgctx := context.Background()
	b.Debug(bgctx, "loadLoop: starting for uid: %s", uid)
	for {
		select {
		case task := <-loadCh:
			select {
			case <-stopCh:
				b.Debug(bgctx, "loadLoop: shutting down for %s", uid)
				return nil
			default:
			}
			if b.isSuspended() {
				b.Debug(bgctx, "loadLoop: suspended, re-enqueueing task: %s", task.job)
				b.requeue(bgctx, stopCh, queue, *task)
			} else {
				b.Debug(bgctx, "loadLoop: running task: %s", task.job)
				if nextTask := b.load(bgctx, *task, uid); nextTask != nil {
					b.requeue(bgctx, stopCh, queue, *nextTask)
				}
			}
			b.clock.Sleep(b.loadWait)
		case <-stopCh:
			b.Debug(bgctx, "loadLoop: shutting down for %s", uid)
			return nil
		}
	}
}

func (b *BackgroundConvLoader) newQueue() {
	b.queue = newJobQueue(1000)
	b.loadCh = make(chan *clTask, 100)
}

func (b *BackgroundConvLoader) retriableError(err error) bool {
	if IsOfflineError(err) != OfflineErrorKindOnline {
		return true
	}
	if errors.Is(err, context.Canceled) {
		return true
	}
	switch err.(type) {
	case storage.AbortedError:
		return true
	default:
		return false
	}
}

func (b *BackgroundConvLoader) IsBackgroundActive() bool {
	b.Lock()
	defer b.Unlock()
	return len(b.activeLoads) > 0
}

func (b *BackgroundConvLoader) load(ictx context.Context, task clTask, uid gregor1.UID) *clTask {
	defer b.Trace(ictx, nil, "load: %s", task.job)()
	defer b.PerfTrace(ictx, nil, "load: %s", task.job)()
	b.Lock()
	var al activeLoad
	al.Ctx, al.CancelFn = context.WithCancel(
		globals.ChatCtx(utils.MakeConvLoaderContext(ictx), b.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil,
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
	query := &chat1.GetThreadQuery{MarkAsRead: false}
	pagination := job.Pagination
	if pagination == nil {
		pagination = &chat1.Pagination{Num: 50}
	}
	var tv chat1.ThreadView
	if pagination.Num > 0 {
		var err error
		tv, err = b.G().ConvSource.Pull(ctx, job.ConvID, uid,
			chat1.GetThreadReason_BACKGROUNDCONVLOAD, nil, query, pagination)
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
	} else {
		b.Debug(ctx, "load: skipped job load because of 0 pagination")
	}
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
