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
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
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

func waitConvLoaderMonitor(t *testing.T, b *BackgroundConvLoader) {
	t.Helper()
	require.Eventually(t, func() bool {
		b.Lock()
		state, wait := b.monitorState, b.monitorWait
		b.Unlock()
		if wait == nil || wait != b.G().MobileAppState.NextUpdate(state) {
			return false
		}
		select {
		case <-wait:
			return false
		default:
			return true
		}
	}, 10*time.Second, time.Millisecond, "monitor did not catch up")
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

func TestConvLoaderMonitorSurvivesStopStart(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	appState := tc.G.MobileAppState
	for i := range 3 {
		appState.Update(keybase1.MobileAppState_FOREGROUND)
		b.Start(context.TODO(), uid)
		require.False(t, b.isSuspended(), "run %d: suspended at a foreground Start", i)
		waitConvLoaderMonitor(t, b)

		appState.Update(keybase1.MobileAppState_BACKGROUND)
		waitConvLoaderMonitor(t, b)
		require.True(t, b.isSuspended(), "run %d: not suspended in BACKGROUND", i)

		appState.Update(keybase1.MobileAppState_INACTIVE)
		waitConvLoaderMonitor(t, b)
		require.False(t, b.isSuspended(), "run %d: suspended in INACTIVE", i)

		appState.Update(keybase1.MobileAppState_BACKGROUND)
		waitConvLoaderMonitor(t, b)
		require.True(t, b.isSuspended(), "run %d: not suspended in BACKGROUND", i)
		requireConvLoaderStopped(t, b)

		// A Start in BACKGROUND seeds its suspension before any change.
		b.Start(context.TODO(), uid)
		require.True(t, b.isSuspended(), "run %d: not suspended at a background Start", i)
		waitConvLoaderMonitor(t, b)
		appState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
		waitConvLoaderMonitor(t, b)
		require.False(t, b.isSuspended(), "run %d: suspended in BACKGROUNDACTIVE", i)
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
	require.True(t, b.isSuspended())

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

// An unbalanced Resume must not release the monitor's suspension.
func TestConvLoaderResumeKeepsAppStateSuspension(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireConvLoaderStopped(t, b)
	require.False(t, b.Resume(context.TODO()))
	require.True(t, b.isSuspended())
	b.Suspend(context.TODO())
	require.True(t, b.Resume(context.TODO()))
	require.True(t, b.isSuspended())
}

// A Start over a running loader replaces its run; Stop still waits for the
// replaced run's goroutines.
func TestConvLoaderStopWaitsForReplacedRun(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	clock := clockwork.NewFakeClock()
	b.clock = clock
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	b.Start(context.TODO(), uid)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	// the first run's loop has pulled the job and waits out its delay
	clock.BlockUntil(1)
	b.Start(context.TODO(), uid)
	stopped := b.Stop(context.TODO())
	select {
	case <-stopped:
		require.FailNow(t, "Stop finished while the replaced run was still running")
	case <-time.After(200 * time.Millisecond):
	}
	clock.Advance(time.Second)
	select {
	case <-stopped:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Stop did not finish")
	}
}

// A suspension that outlives a run parks the next run's loop before it
// takes anything off the queue.
func TestConvLoaderSuspensionCarriesIntoNextRun(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	clock := clockwork.NewFakeClock()
	b.clock = clock
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	b.Start(context.TODO(), uid)
	requireConvLoaderStopped(t, b)
	b.Start(context.TODO(), uid)
	defer requireConvLoaderStopped(t, b)
	require.Eventually(t, func() bool {
		b.Lock()
		defer b.Unlock()
		return len(b.suspendCh) == 0
	}, 10*time.Second, time.Millisecond, "loop did not take the suspension")

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
	b.Start(context.TODO(), newUID)
	defer requireConvLoaderStopped(t, b)
	close(pulls.release)

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

func TestConvLoaderScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			b, _, tc := setupAppStateConvLoader(t)
			b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
			defer requireConvLoaderStopped(t, b)
			lifecycletest.Play(t, tc.G.MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				waitConvLoaderMonitor(t, b)
				if got, want := b.isSuspended(), step.Want == keybase1.MobileAppState_BACKGROUND; got != want {
					t.Fatalf("step %d %v: suspended %v in %v", i, step.Do, got, step.Want)
				}
			})
		})
	}
}

func TestConvLoaderAppStateStress(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
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

	for _, state := range states {
		tc.G.MobileAppState.Update(state)
		b.Start(context.TODO(), uid)
		waitConvLoaderMonitor(t, b)
		b.Lock()
		appSuspended := b.appSuspended
		b.Unlock()
		require.Equal(t, state == keybase1.MobileAppState_BACKGROUND, appSuspended, "in %v", state)
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
