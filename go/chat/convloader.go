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
	// gen counts Start and Stop calls, so a Start that waited for the
	// previous run can tell whether a later call overtook it.
	gen    uint64
	queue  *jobQueue
	stopCh chan struct{}
	// suspendCh wakes the loop when Suspend takes hold; the loop reads the
	// suspension itself.
	suspendCh     chan struct{}
	resumeCh      chan struct{}
	loadCh        chan *clTask
	identNotifier types.IdentifyNotifier
	// eg holds the last run's goroutines, which may still be exiting. Each
	// run gets its own, since a Group cannot be added to while somebody
	// waits on it.
	eg *errgroup.Group

	clock      clockwork.Clock
	resumeWait time.Duration
	loadWait   time.Duration

	activeLoads  map[string]activeLoad
	suspendCount int

	// for testing, make this and can check conv load successes
	loads                 chan chat1.ConversationID
	testingNameInfoSource types.NameInfoSource
}

var _ types.ConvLoader = (*BackgroundConvLoader)(nil)

func NewBackgroundConvLoader(g *globals.Context) *BackgroundConvLoader {
	b := &BackgroundConvLoader{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.ExternalG(), "BackgroundConvLoader", false),
		stopCh:        make(chan struct{}),
		suspendCh:     make(chan struct{}, 1),
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

// Start replaces any current run with one for uid, once the previous run's
// goroutines have exited. The last Start or Stop wins: a Start that a later
// Start or Stop overtook while it waited returns without starting a run.
func (b *BackgroundConvLoader) Start(ctx context.Context, uid gregor1.UID) {
	if b.G().GetEnv().GetDisableBgConvLoader() {
		b.Debug(ctx, "BackgroundConvLoader disabled, aborting Start")
		return
	}
	b.Debug(ctx, "Start")
	b.Lock()
	b.gen++
	gen := b.gen
	prevRun := b.endRunLocked()
	b.Unlock()

	// The previous run's goroutines take b's lock, so wait for them outside it.
	_ = prevRun.Wait()

	b.Lock()
	defer b.Unlock()
	if b.gen != gen {
		b.Debug(ctx, "Start: overtaken by a later Start or Stop")
		return
	}
	// A wake-up the previous run never read would park this run's loop; a
	// suspension still in force parks it anyway, through suspendCount.
	select {
	case <-b.suspendCh:
	default:
	}
	b.newQueue()
	b.started = true
	b.uid = uid
	b.eg = new(errgroup.Group)
	stopCh, eg, queue, loadCh := b.stopCh, b.eg, b.queue, b.loadCh
	eg.Go(func() error { return b.loop(uid, stopCh, queue, loadCh) })
	eg.Go(func() error { return b.loadLoop(uid, stopCh, queue, loadCh) })
}

// endRunLocked ends the current run, if there is one, and returns the group of
// the last run's goroutines.
func (b *BackgroundConvLoader) endRunLocked() *errgroup.Group {
	if b.started {
		b.started = false
		b.cancelActiveLoadsLocked()
		close(b.stopCh)
		b.stopCh = make(chan struct{})
	}
	return b.eg
}

func (b *BackgroundConvLoader) Stop(ctx context.Context) chan struct{} {
	b.Lock()
	defer b.Unlock()
	b.Debug(ctx, "Stop")
	b.gen++
	eg := b.endRunLocked()
	ch := make(chan struct{})
	go func() {
		_ = eg.Wait()
		close(ch)
	}()
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

func (b *BackgroundConvLoader) Suspend(ctx context.Context) (canceled bool) {
	defer b.Trace(ctx, nil, "Suspend")()
	b.Lock()
	defer b.Unlock()
	if !b.started {
		return false
	}
	if b.suspendCount == 0 {
		b.Debug(ctx, "Suspend: waking loop")
		b.resumeCh = make(chan struct{})
		select {
		case b.suspendCh <- struct{}{}:
		default:
		}
	}
	b.suspendCount++
	return b.cancelActiveLoadsLocked()
}

func (b *BackgroundConvLoader) Resume(ctx context.Context) bool {
	defer b.Trace(ctx, nil, "Resume")()
	b.Lock()
	defer b.Unlock()
	if b.suspendCount == 0 {
		return false
	}
	b.suspendCount--
	if b.suspendCount > 0 {
		return false
	}
	b.Debug(ctx, "Resume: closing resumeCh")
	close(b.resumeCh)
	return true
}

func (b *BackgroundConvLoader) suspendedLocked() bool {
	return b.suspendCount > 0 || suspendInAppState(b.G().MobileAppState.State())
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

// requeue puts a task back on the queue of the run that loaded it. Once that
// run has stopped, nobody reads its queue.
func (b *BackgroundConvLoader) requeue(ctx context.Context, queue *jobQueue, task clTask) {
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

func (b *BackgroundConvLoader) loop(uid gregor1.UID, stopCh chan struct{}, queue *jobQueue,
	loadCh chan *clTask,
) error {
	bgctx := context.Background()
	b.Debug(bgctx, "loop: starting conv loader loop for %s", uid)
	appState := b.G().MobileAppState
	state := appState.State()

	// appStateChanged reads the new app state and reports whether it suspends
	// the loop. Nothing else watches the app state, so going to BACKGROUND
	// cancels active loads here, at once.
	appStateChanged := func() (suspended bool) {
		state = appState.State()
		if !suspendInAppState(state) {
			return false
		}
		b.Debug(bgctx, "loop: suspending in %v", state)
		b.Lock()
		b.cancelActiveLoadsLocked()
		b.Unlock()
		return true
	}
	// suspension reports whether the loop is held, with the channel Resume
	// closes when a Suspend holds it.
	suspension := func() (held bool, resumeCh chan struct{}) {
		b.Lock()
		defer b.Unlock()
		if b.suspendCount > 0 {
			return true, b.resumeCh
		}
		return suspendInAppState(state), nil
	}
	// waitForResume parks the loop until neither Suspend nor the app state
	// holds it, then waits for b.resumeWait with jitter. Returns false if the
	// run stopped.
	waitForResume := func() bool {
		b.Debug(bgctx, "waitForResume: suspending loop")
		var resumeDelay <-chan time.Time
		for {
			held, resumeCh := suspension()
			switch {
			case held:
				resumeDelay = nil
			case resumeDelay == nil:
				resumeDelay = b.clock.After(libkb.RandomJitter(b.resumeWait))
			}
			select {
			case <-resumeCh:
			case <-b.suspendCh:
			case <-resumeDelay:
				b.Debug(bgctx, "waitForResume: resuming loop")
				return true
			case <-appState.NextUpdate(state):
				appStateChanged()
			case <-stopCh:
				return false
			}
		}
	}
	// Park if already suspended, and on a mobile fresh start apply the
	// foreground wait.
	if held, _ := suspension(); held || b.G().IsMobileAppType() {
		if !waitForResume() {
			return nil
		}
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
			// neither have any data on them. An app-state change that doesn't suspend keeps waiting
			// out the delay, so a retry still gets its full backoff.
			delay := b.clock.After(duration)
		waitDelay:
			for {
				select {
				case <-delay:
					break waitDelay
				case <-b.suspendCh:
					b.Debug(bgctx, "loop: pulled queue task, but suspended, so waiting")
					if !waitForResume() {
						return nil
					}
					break waitDelay
				case <-appState.NextUpdate(state):
					if !appStateChanged() {
						continue
					}
					if !waitForResume() {
						return nil
					}
					break waitDelay
				case <-stopCh:
					b.Debug(bgctx, "loop: shutting down for %s", uid)
					return nil
				}
			}
			b.Debug(bgctx, "loop: pulled queued task: %s", task.job)
			select {
			case loadCh <- &task:
			default:
				b.Debug(bgctx, "loop: failed to dispatch load, queue full")
			}
		case <-b.suspendCh:
			b.Debug(bgctx, "loop: received suspend")
			if !waitForResume() {
				return nil
			}
		case <-appState.NextUpdate(state):
			if appStateChanged() && !waitForResume() {
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
			if nextTask := b.load(bgctx, stopCh, *task, uid); nextTask != nil {
				b.requeue(bgctx, queue, *nextTask)
			}
			select {
			case <-b.clock.After(b.loadWait):
			case <-stopCh:
				b.Debug(bgctx, "loadLoop: shutting down for %s", uid)
				return nil
			}
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

// load runs task unless its run has stopped, and returns a task to requeue:
// task itself while suspended, or its retry.
func (b *BackgroundConvLoader) load(ictx context.Context, stopCh chan struct{}, task clTask,
	uid gregor1.UID,
) *clTask {
	b.Lock()
	// Checked under the lock that cancels active loads, so a load either sees
	// the stop or the suspension here, or is registered in time to be canceled.
	select {
	case <-stopCh:
		b.Unlock()
		b.Debug(ictx, "load: run stopped, dropping task: %s", task.job)
		return nil
	default:
	}
	if b.suspendedLocked() {
		b.Unlock()
		b.Debug(ictx, "load: suspended, re-enqueueing task: %s", task.job)
		return &task
	}
	defer b.Trace(ictx, nil, "load: %s", task.job)()
	defer b.PerfTrace(ictx, nil, "load: %s", task.job)()
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
