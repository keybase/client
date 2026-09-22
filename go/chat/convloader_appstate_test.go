package chat

import (
	"context"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type appStateCtxFactory struct{}

func (appStateCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (appStateCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

// pullRecorder is the only part of ConversationSource a background load
// reaches; anything else panics on the nil embedded interface.
type pullRecorder struct {
	types.ConversationSource
	pulls chan chat1.ConversationID
}

func (p *pullRecorder) Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination,
) (chat1.ThreadView, error) {
	select {
	case p.pulls <- convID:
	default:
	}
	return chat1.ThreadView{}, nil
}

func setupAppStateConvLoader(t *testing.T) (*BackgroundConvLoader, *pullRecorder, libkb.TestContext) {
	tc := externalstest.SetupTest(t, "convloader-appstate", 0)
	t.Cleanup(tc.Cleanup)
	tc.G.ConnectionManager = libkb.NewConnectionManager()
	pulls := &pullRecorder{pulls: make(chan chat1.ConversationID, 100)}
	g := globals.NewContext(tc.G, &globals.ChatContext{
		CtxFactory: appStateCtxFactory{},
		ConvSource: pulls,
	})
	b := NewBackgroundConvLoader(g)
	b.resumeWait = time.Millisecond
	b.loadWait = time.Millisecond
	return b, pulls, tc
}

func requireConvLoaderStopped(t *testing.T, b *BackgroundConvLoader) {
	t.Helper()
	select {
	case <-b.Stop(context.TODO()):
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Stop did not finish")
	}
}

var convLoaderTestConvID = chat1.ConversationID([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})

func convLoaderTestJob() types.ConvLoaderJob {
	return types.NewConvLoaderJob(convLoaderTestConvID, &chat1.Pagination{Num: 1},
		types.ConvLoaderPriorityHigh, types.ConvLoaderGeneric, nil)
}

// A load checks for a stop and a suspension under the lock that cancels
// active loads, so it never starts after either.
func TestConvLoaderLoadChecksStopAndSuspension(t *testing.T) {
	b, pulls, tc := setupAppStateConvLoader(t)
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	task := clTask{job: convLoaderTestJob()}

	stopped := make(chan struct{})
	close(stopped)
	require.Nil(t, b.load(context.TODO(), stopped, task, uid))

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	next := b.load(context.TODO(), make(chan struct{}), task, uid)
	require.NotNil(t, next)
	require.Equal(t, task.job.ConvID, next.job.ConvID)
	require.Zero(t, next.attempt)

	select {
	case <-pulls.pulls:
		require.FailNow(t, "loaded after a stop or in BACKGROUND")
	default:
	}
}

// Stop does not wait for the loop's delay before dispatching a job.
func TestConvLoaderStopDuringLoadDelay(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	clock := clockwork.NewFakeClock()
	b.clock = clock
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	clock.BlockUntil(1)
	requireConvLoaderStopped(t, b)
}

// The loop also watches the app state while it waits out the delay before
// dispatching the next job, with the previous job still loading.
func TestConvLoaderBackgroundCancelsDuringLoadDelay(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	pulls := newCtxPuller(false)
	b.G().ConvSource = pulls
	clock := clockwork.NewFakeClock()
	b.clock = clock
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireConvLoaderStopped(t, b)
	defer close(pulls.release)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	clock.BlockUntil(1)
	clock.Advance(bgLoaderInitDelay)
	load := requirePull(t, pulls)

	otherConvID := chat1.ConversationID([]byte{16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1})
	require.NoError(t, b.Queue(context.TODO(), types.NewConvLoaderJob(otherConvID, &chat1.Pagination{Num: 1},
		types.ConvLoaderPriorityHigh, types.ConvLoaderGeneric, nil)))
	// the loop has pulled the second job and waits out its delay
	clock.BlockUntil(1)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	select {
	case <-load.ctx.Done():
	case <-time.After(100 * time.Millisecond):
		require.FailNow(t, "active load not canceled on BACKGROUND")
	}
}

// An app-state change that doesn't suspend the loop, like FOREGROUND ->
// INACTIVE, keeps the loop waiting out the load delay instead of dispatching
// the job early.
func TestConvLoaderNonSuspendingStateKeepsLoadDelay(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	pulls := newCtxPuller(false)
	b.G().ConvSource = pulls
	clock := clockwork.NewFakeClock()
	b.clock = clock
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireConvLoaderStopped(t, b)
	defer close(pulls.release)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	clock.BlockUntil(1)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
	select {
	case <-pulls.calls:
		require.FailNow(t, "dispatched before the load delay ran out")
	case <-time.After(100 * time.Millisecond):
	}
	clock.Advance(bgLoaderInitDelay)
	requirePull(t, pulls)
}

// Each run's loop watches the app state: BACKGROUND cancels its active load
// and parks it, and leaving BACKGROUND loads the retry.
func TestConvLoaderAppStateAcrossRuns(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	pulls := newCtxPuller(false)
	b.G().ConvSource = pulls
	defer close(pulls.release)
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	appState := tc.G.MobileAppState
	requireCanceled := func(i int, load pullCall) {
		t.Helper()
		select {
		case <-load.ctx.Done():
		case <-time.After(10 * time.Second):
			require.FailNow(t, "load not canceled in BACKGROUND", "run %d", i)
		}
	}
	for i := range 3 {
		appState.Update(keybase1.MobileAppState_FOREGROUND)
		b.Start(context.TODO(), uid)
		require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
		load := requirePull(t, pulls)

		appState.Update(keybase1.MobileAppState_BACKGROUND)
		requireCanceled(i, load)

		appState.Update(keybase1.MobileAppState_INACTIVE)
		load = requirePull(t, pulls)

		appState.Update(keybase1.MobileAppState_BACKGROUND)
		requireCanceled(i, load)
		requireConvLoaderStopped(t, b)

		// A run started in BACKGROUND loads nothing until the app leaves it.
		b.Start(context.TODO(), uid)
		require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
		select {
		case <-pulls.calls:
			require.FailNow(t, "loaded in BACKGROUND", "run %d", i)
		case <-time.After(300 * time.Millisecond):
		}
		appState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
		load = requirePull(t, pulls)
		appState.Update(keybase1.MobileAppState_BACKGROUND)
		requireCanceled(i, load)
		requireConvLoaderStopped(t, b)
	}
}

func TestConvLoaderBackgroundLaunchStaysSuspended(t *testing.T) {
	b, pulls, tc := setupAppStateConvLoader(t)
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	require.False(t, b.Suspend(context.TODO()), "Suspend before Start")
	require.False(t, b.Resume(context.TODO()))
	b.Start(context.TODO(), uid)
	defer requireConvLoaderStopped(t, b)

	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	select {
	case <-pulls.pulls:
		require.FailNow(t, "loaded in BACKGROUND")
	case <-time.After(300 * time.Millisecond):
	}

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	select {
	case convID := <-pulls.pulls:
		require.Equal(t, convLoaderTestConvID, convID)
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no load after FOREGROUND")
	}
}

// An unbalanced Resume, or a Suspend and Resume pair, must not release the
// app-state suspension.
func TestConvLoaderResumeKeepsAppStateSuspension(t *testing.T) {
	b, pulls, tc := setupAppStateConvLoader(t)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireConvLoaderStopped(t, b)
	require.False(t, b.Resume(context.TODO()))
	b.Suspend(context.TODO())
	require.True(t, b.Resume(context.TODO()))

	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	select {
	case <-pulls.pulls:
		require.FailNow(t, "loaded in BACKGROUND")
	case <-time.After(300 * time.Millisecond):
	}
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	select {
	case convID := <-pulls.pulls:
		require.Equal(t, convLoaderTestConvID, convID)
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no load after FOREGROUND")
	}
}

// A Suspend's wake-up that the previous run never read doesn't park the next
// run's loop.
func TestConvLoaderStartDropsStaleSuspendWake(t *testing.T) {
	b, pulls, _ := setupAppStateConvLoader(t)
	b.resumeWait = time.Hour
	b.suspendCh <- struct{}{}
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireConvLoaderStopped(t, b)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	select {
	case convID := <-pulls.pulls:
		require.Equal(t, convLoaderTestConvID, convID)
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no load: the stale wake-up parked the loop")
	}
}

// A Stop that comes while a Start waits for the previous run wins: it waits
// for that run too, and the Start does not start a new one.
func TestConvLoaderStopOvertakesWaitingStart(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	pulls := newCtxPuller(true)
	b.G().ConvSource = pulls
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	b.Start(context.TODO(), uid)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	requirePull(t, pulls)

	started := make(chan struct{})
	go func() {
		b.Start(context.TODO(), uid)
		close(started)
	}()
	// the waiting Start has ended the previous run
	require.Eventually(t, func() bool { return !b.isRunning() }, 10*time.Second, time.Millisecond)
	stopped := b.Stop(context.TODO())
	select {
	case <-stopped:
		require.FailNow(t, "Stop finished while the previous run was still running")
	case <-time.After(200 * time.Millisecond):
	}
	close(pulls.release)
	for _, ch := range []chan struct{}{started, stopped} {
		select {
		case <-ch:
		case <-time.After(10 * time.Second):
			require.FailNow(t, "Start or Stop did not return")
		}
	}
	require.False(t, b.isRunning(), "an overtaken Start started a run")
}

// Of two Starts waiting for the previous run, the later one's run is the one
// that starts.
func TestConvLoaderLastWaitingStartWins(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	pulls := newCtxPuller(true)
	b.G().ConvSource = pulls
	baseline := runtime.NumGoroutine()
	oldUID := gregor1.UID([]byte{1, 2, 3, 4})
	uids := []gregor1.UID{{5, 6, 7, 8}, {9, 10, 11, 12}}
	b.Start(context.TODO(), oldUID)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	requirePull(t, pulls)

	var wg sync.WaitGroup
	for i, uid := range uids {
		wg.Go(func() { b.Start(context.TODO(), uid) })
		require.Eventually(t, func() bool {
			b.Lock()
			defer b.Unlock()
			return b.gen == uint64(i+2)
		}, 10*time.Second, time.Millisecond, "Start %d did not begin waiting", i)
	}
	close(pulls.release)
	wg.Wait()
	require.True(t, b.isRunning())
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	require.Equal(t, uids[1], requirePull(t, pulls).uid)
	// the overtaken Start left no run of its own behind
	requireConvLoaderStopped(t, b)
	requireNoGoroutineLeak(t, baseline)
}

// A suspension that outlives a run parks the next run's loop before it
// takes anything off the queue.
func TestConvLoaderSuspensionCarriesIntoNextRun(t *testing.T) {
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	for _, tt := range []struct {
		name    string
		suspend func(*BackgroundConvLoader, libkb.TestContext)
	}{
		{"background", func(_ *BackgroundConvLoader, tc libkb.TestContext) {
			tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
		}},
		{"suspend", func(b *BackgroundConvLoader, _ libkb.TestContext) {
			require.False(t, b.Suspend(context.TODO()))
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			b, _, tc := setupAppStateConvLoader(t)
			clock := clockwork.NewFakeClock()
			b.clock = clock
			b.Start(context.TODO(), uid)
			tt.suspend(b, tc)
			requireConvLoaderStopped(t, b)
			b.Start(context.TODO(), uid)
			defer requireConvLoaderStopped(t, b)

			require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
			// A loop that pulls the job waits out its delay on the clock.
			blocked := make(chan struct{})
			go func() {
				clock.BlockUntil(1)
				close(blocked)
			}()
			defer clock.After(time.Hour)
			select {
			case <-blocked:
				require.FailNow(t, "loop pulled a job while suspended")
			case <-time.After(300 * time.Millisecond):
			}
			b.Lock()
			queued := b.queue.queue.Len()
			b.Unlock()
			require.Equal(t, 1, queued, "queue drained while suspended")
		})
	}
}

// pullBlocker fails the first load of the old user's conversation once
// released, so the old run asks to retry it.
type pullBlocker struct {
	types.ConversationSource
	oldUID  gregor1.UID
	started chan struct{}
	release chan struct{}

	mu   sync.Mutex
	uids []gregor1.UID
}

func (p *pullBlocker) Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination,
) (chat1.ThreadView, error) {
	p.mu.Lock()
	p.uids = append(p.uids, uid)
	p.mu.Unlock()
	if uid.Eq(p.oldUID) {
		close(p.started)
		<-p.release
		return chat1.ThreadView{}, context.Canceled
	}
	return chat1.ThreadView{}, nil
}

func TestConvLoaderReplacedRunRetryStaysInItsRun(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	oldUID, newUID := gregor1.UID([]byte{1, 2, 3, 4}), gregor1.UID([]byte{5, 6, 7, 8})
	pulls := &pullBlocker{oldUID: oldUID, started: make(chan struct{}), release: make(chan struct{})}
	b.G().ConvSource = pulls
	b.Start(context.TODO(), oldUID)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	select {
	case <-pulls.started:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "old run did not load")
	}
	started := make(chan struct{})
	go func() {
		b.Start(context.TODO(), newUID)
		close(started)
	}()
	defer requireConvLoaderStopped(t, b)
	close(pulls.release)
	select {
	case <-started:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Start did not return")
	}

	// past the retry delay and the new run's load delays
	time.Sleep(time.Second)
	b.Lock()
	queued := b.queue.queue.Len()
	b.Unlock()
	require.Zero(t, queued, "old run's retry reached the new queue")
	pulls.mu.Lock()
	defer pulls.mu.Unlock()
	require.Equal(t, []gregor1.UID{oldUID}, pulls.uids)
}

func TestConvLoaderAppStateStress(t *testing.T) {
	b, pulls, tc := setupAppStateConvLoader(t)
	baseline := runtime.NumGoroutine()
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	states := []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		var wg sync.WaitGroup
		for w := range 4 {
			wg.Go(func() {
				rng := rand.New(rand.NewSource(int64(w)))
				for range 300 {
					tc.G.MobileAppState.Update(states[rng.Intn(len(states))])
				}
			})
		}
		for w := range 4 {
			wg.Go(func() {
				rng := rand.New(rand.NewSource(int64(100 + w)))
				for range 150 {
					switch rng.Intn(4) {
					case 0:
						b.Start(context.TODO(), uid)
					case 1:
						<-b.Stop(context.TODO())
					case 2:
						_ = b.Queue(context.TODO(), convLoaderTestJob())
					default:
						b.Suspend(context.TODO())
						b.Resume(context.TODO())
					}
				}
			})
		}
		wg.Wait()
	}()
	select {
	case <-done:
	case <-time.After(60 * time.Second):
		require.FailNow(t, "deadlock")
	}

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	b.Start(context.TODO(), uid)
	// the loader still loads once the churn is over
	for len(pulls.pulls) > 0 {
		<-pulls.pulls
	}
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	select {
	case <-pulls.pulls:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no load after the churn")
	}
	requireConvLoaderStopped(t, b)
	requireNoGoroutineLeak(t, baseline)
}

// requireNoGoroutineLeak polls without require.Eventually, whose own
// goroutines would count against the baseline.
func requireNoGoroutineLeak(t *testing.T, baseline int) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline, "leaked goroutines")
}

type pullCall struct {
	ctx context.Context
	uid gregor1.UID
}

// ctxPuller hands each load to the test and holds it until release closes,
// or until its ctx is canceled unless ignoreCancel is set.
type ctxPuller struct {
	types.ConversationSource
	calls        chan pullCall
	release      chan struct{}
	ignoreCancel bool
}

func newCtxPuller(ignoreCancel bool) *ctxPuller {
	return &ctxPuller{
		calls:        make(chan pullCall, 100),
		release:      make(chan struct{}),
		ignoreCancel: ignoreCancel,
	}
}

func (p *ctxPuller) Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination,
) (chat1.ThreadView, error) {
	p.calls <- pullCall{ctx: ctx, uid: uid}
	done := ctx.Done()
	if p.ignoreCancel {
		done = nil
	}
	select {
	case <-p.release:
	case <-done:
	}
	return chat1.ThreadView{}, ctx.Err()
}

func requirePull(t *testing.T, p *ctxPuller) pullCall {
	t.Helper()
	select {
	case call := <-p.calls:
		return call
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no load")
		return pullCall{}
	}
}

func TestConvLoaderStartWaitsForPreviousRun(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	pulls := newCtxPuller(true)
	b.G().ConvSource = pulls
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	b.Start(context.TODO(), uid)
	defer requireConvLoaderStopped(t, b)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	load := requirePull(t, pulls)

	started := make(chan struct{})
	go func() {
		b.Start(context.TODO(), uid)
		close(started)
	}()
	select {
	case <-started:
		require.FailNow(t, "Start returned while the previous run's load was still running")
	case <-time.After(200 * time.Millisecond):
	}
	require.Error(t, load.ctx.Err(), "Start did not cancel the previous run's load")
	close(pulls.release)
	select {
	case <-started:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Start did not return after the previous run exited")
	}
	require.True(t, b.isRunning())
}

func TestConvLoaderBackgroundCancelsActiveLoadImmediately(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	pulls := newCtxPuller(false)
	b.G().ConvSource = pulls
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireConvLoaderStopped(t, b)
	defer close(pulls.release)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	load := requirePull(t, pulls)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	select {
	case <-load.ctx.Done():
	case <-time.After(100 * time.Millisecond):
		require.FailNow(t, "active load not canceled on BACKGROUND")
	}
}
