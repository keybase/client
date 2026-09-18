package chat

import (
	"context"
	"fmt"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// archiveJobRunner stands in for ChatArchiver: a launched job waits for
// release, registers as running through Set, and runs until paused.
type archiveJobRunner struct {
	r       *ChatArchiveRegistry
	release chan struct{}

	mu       sync.Mutex
	launches map[chat1.ArchiveJobID]int
	active   int
	launched chan chat1.ArchiveJobID
}

func (a *archiveJobRunner) run(ctx context.Context, uid gregor1.UID, req chat1.ArchiveChatJobRequest) error {
	a.mu.Lock()
	a.launches[req.JobID]++
	a.active++
	a.mu.Unlock()
	defer func() {
		a.mu.Lock()
		a.active--
		a.mu.Unlock()
	}()
	select {
	case a.launched <- req.JobID:
	default:
	}
	<-a.release
	pauseCh := make(chan struct{})
	var once sync.Once
	pause := func() { once.Do(func() { close(pauseCh) }) }
	job := chat1.ArchiveChatJob{Request: req, Status: chat1.ArchiveChatJobStatus_RUNNING}
	if err := a.r.Set(ctx, pause, job); err != nil {
		return err
	}
	<-pauseCh
	return nil
}

func (a *archiveJobRunner) counts() (launches map[chat1.ArchiveJobID]int, active int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	launches = make(map[chat1.ArchiveJobID]int, len(a.launches))
	for id, n := range a.launches {
		launches[id] = n
	}
	return launches, a.active
}

var archiveTestJobIDs = []chat1.ArchiveJobID{"job-a", "job-b", "job-c"}

// setupAppStateArchive returns a registry whose history holds paused jobs
// and is treated as already read from disk.
func setupAppStateArchive(t *testing.T, released bool) (*ChatArchiveRegistry, *archiveJobRunner, libkb.TestContext) {
	tc := externalstest.SetupTest(t, "archive-appstate", 0)
	t.Cleanup(tc.Cleanup)
	g := globals.NewContext(tc.G, &globals.ChatContext{CtxFactory: appStateCtxFactory{}})
	r := NewChatArchiveRegistry(g, nil)
	r.resumeJobsDelay = 0
	// The real key needs a logged-in user.
	r.edb = encrypteddb.New(tc.G, func(g *libkb.GlobalContext) *libkb.JSONLocalDb { return g.LocalChatDb },
		func(context.Context) ([32]byte, error) { return [32]byte{}, nil })
	r.inited = true
	for _, id := range archiveTestJobIDs {
		r.jobHistory.JobHistory[id] = chat1.ArchiveChatJob{
			Request: chat1.ArchiveChatJobRequest{JobID: id},
			Status:  chat1.ArchiveChatJobStatus_BACKGROUND_PAUSED,
		}
	}
	runner := &archiveJobRunner{
		r:        r,
		release:  make(chan struct{}),
		launches: make(map[chat1.ArchiveJobID]int),
		launched: make(chan chat1.ArchiveJobID, 100),
	}
	if released {
		close(runner.release)
	}
	r.runJob = runner.run
	return r, runner, tc
}

func archiveStatuses(r *ChatArchiveRegistry) (statuses map[chat1.ArchiveJobID]chat1.ArchiveChatJobStatus, running int) {
	r.Lock()
	defer r.Unlock()
	statuses = make(map[chat1.ArchiveJobID]chat1.ArchiveChatJobStatus)
	for id, job := range r.jobHistory.JobHistory {
		statuses[id] = job.Status
	}
	return statuses, len(r.runningJobs)
}

func requireArchiveStopped(t *testing.T, r *ChatArchiveRegistry) {
	t.Helper()
	select {
	case <-r.Stop(context.TODO()):
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Stop did not finish")
	}
}

func requireArchiveJobsRunning(t *testing.T, r *ChatArchiveRegistry) {
	t.Helper()
	require.Eventually(t, func() bool {
		statuses, running := archiveStatuses(r)
		for _, status := range statuses {
			if status != chat1.ArchiveChatJobStatus_RUNNING {
				return false
			}
		}
		return running == len(statuses)
	}, 10*time.Second, time.Millisecond, "jobs did not resume")
}

func requireArchiveJobsPaused(t *testing.T, r *ChatArchiveRegistry, runner *archiveJobRunner) {
	t.Helper()
	require.Eventually(t, func() bool {
		statuses, running := archiveStatuses(r)
		for _, status := range statuses {
			if status != chat1.ArchiveChatJobStatus_BACKGROUND_PAUSED {
				return false
			}
		}
		_, active := runner.counts()
		return running == 0 && active == 0
	}, 10*time.Second, time.Millisecond, "jobs did not pause")
}

func TestArchiveConcurrentResumesLaunchOnce(t *testing.T) {
	r, runner, _ := setupAppStateArchive(t, false)
	stopCh := make(chan struct{})
	r.Lock()
	r.started = true
	r.stopCh = stopCh
	r.Unlock()
	defer close(stopCh)

	var wg sync.WaitGroup
	for range 20 {
		wg.Go(func() {
			assert.NoError(t, r.resumeAllBgJobs(context.Background(), stopCh))
		})
	}
	wg.Wait()
	launches, _ := runner.counts()
	for _, id := range archiveTestJobIDs {
		require.Equal(t, 1, launches[id], "launches of %v before it registered", id)
	}

	close(runner.release)
	requireArchiveJobsRunning(t, r)
	for range 5 {
		require.NoError(t, r.resumeAllBgJobs(context.Background(), stopCh))
	}
	launches, _ = runner.counts()
	for _, id := range archiveTestJobIDs {
		require.Equal(t, 1, launches[id], "launches of %v after it registered", id)
	}
	r.Lock()
	require.NoError(t, r.bgPauseAllJobsLocked(context.Background()))
	r.Unlock()
	requireArchiveJobsPaused(t, r, runner)
}

// A job launched by one resume, passed over by a pause because it had not
// registered yet, and skipped by the next resume because it was still
// launching, runs once it registers in the foreground.
func TestArchiveRelaunchAfterPauseWhileLaunching(t *testing.T) {
	r, runner, tc := setupAppStateArchive(t, false)
	stopCh := make(chan struct{})
	r.Lock()
	r.started = true
	r.stopCh = stopCh
	r.Unlock()
	defer close(stopCh)
	ctx := context.Background()

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	require.NoError(t, r.resumeAllBgJobs(ctx, stopCh))
	for range archiveTestJobIDs {
		select {
		case <-runner.launched:
		case <-time.After(10 * time.Second):
			require.FailNow(t, "jobs did not launch")
		}
	}

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	r.Lock()
	require.NoError(t, r.bgPauseAllJobsLocked(ctx))
	r.Unlock()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	require.NoError(t, r.resumeAllBgJobs(ctx, stopCh))
	launches, _ := runner.counts()
	for _, id := range archiveTestJobIDs {
		require.Equal(t, 1, launches[id], "launches of %v", id)
	}

	close(runner.release)
	requireArchiveJobsRunning(t, r)
	r.Lock()
	require.NoError(t, r.bgPauseAllJobsLocked(ctx))
	r.Unlock()
	requireArchiveJobsPaused(t, r, runner)
}

// A job that registers as running while the app is not in the foreground is
// paused at once, and resumes on the next FOREGROUND.
func TestArchiveSetWhileInactivePauses(t *testing.T) {
	r, _, tc := setupAppStateArchive(t, true)
	ctx := context.Background()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
	r.Start(ctx, gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireArchiveStopped(t, r)

	jobID := chat1.ArchiveJobID("job-manual")
	paused := make(chan struct{})
	var once sync.Once
	job := chat1.ArchiveChatJob{
		Request: chat1.ArchiveChatJobRequest{JobID: jobID},
		Status:  chat1.ArchiveChatJobStatus_RUNNING,
	}
	require.NoError(t, r.Set(ctx, func() { once.Do(func() { close(paused) }) }, job))
	select {
	case <-paused:
	default:
		require.FailNow(t, "Set did not pause the job")
	}
	statuses, running := archiveStatuses(r)
	require.Equal(t, chat1.ArchiveChatJobStatus_BACKGROUND_PAUSED, statuses[jobID])
	require.Zero(t, running)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	requireArchiveJobsRunning(t, r)
}

// A pause that lands while launched jobs have not registered yet leaves them
// paused once they do, and the next FOREGROUND resumes them.
func TestArchivePauseBeforeRegistration(t *testing.T) {
	r, runner, tc := setupAppStateArchive(t, false)
	r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireArchiveStopped(t, r)
	for range archiveTestJobIDs {
		select {
		case <-runner.launched:
		case <-time.After(10 * time.Second):
			require.FailNow(t, "jobs did not launch")
		}
	}
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	close(runner.release)
	requireArchiveJobsPaused(t, r, runner)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	requireArchiveJobsRunning(t, r)
}

// A resume whose timer fired as its run stopped must not launch jobs in the
// run, possibly another user's, that started next; that run resumes on its
// own schedule.
func TestArchiveStaleResumeAfterRestart(t *testing.T) {
	r, _, _ := setupAppStateArchive(t, true)
	r.resumeJobsDelay = time.Hour
	r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	r.Lock()
	oldStopCh := r.stopCh
	r.Unlock()
	requireArchiveStopped(t, r)
	r.Start(context.TODO(), gregor1.UID([]byte{5, 6, 7, 8}))
	defer requireArchiveStopped(t, r)

	require.NoError(t, r.resumeAllBgJobs(context.Background(), oldStopCh))
	r.Lock()
	defer r.Unlock()
	require.Empty(t, r.launching, "stale resume launched jobs")
}

// A resume whose timer fired just as a plain Stop, with no Start following
// it, took the lock must not launch jobs: there is no live run left to
// launch them into.
func TestArchiveResumeAfterPlainStopLaunchesNothing(t *testing.T) {
	r, _, _ := setupAppStateArchive(t, true)
	r.resumeJobsDelay = time.Hour
	r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	r.Lock()
	stopCh := r.stopCh
	r.Unlock()
	requireArchiveStopped(t, r)

	require.NoError(t, r.resumeAllBgJobs(context.Background(), stopCh))
	r.Lock()
	defer r.Unlock()
	require.Empty(t, r.launching, "resumed after a plain Stop")
}

// A launch that ends after a later launch of the same job started must not
// clear the later one's entry, or the next resume starts the job again
// before the later launch registers.
func TestArchiveEndedLaunchKeepsLaterLaunch(t *testing.T) {
	r, _, _ := setupAppStateArchive(t, true)
	jobID := archiveTestJobIDs[0]
	r.jobHistory.JobHistory = map[chat1.ArchiveJobID]chat1.ArchiveChatJob{jobID: {
		Request: chat1.ArchiveChatJobRequest{JobID: jobID},
		Status:  chat1.ArchiveChatJobStatus_BACKGROUND_PAUSED,
	}}
	var mu sync.Mutex
	launches := 0
	firstExit := make(chan struct{})
	secondLaunched := make(chan struct{})
	secondRelease := make(chan struct{})
	r.runJob = func(ctx context.Context, uid gregor1.UID, req chat1.ArchiveChatJobRequest) error {
		mu.Lock()
		launches++
		n := launches
		mu.Unlock()
		switch n {
		case 1:
			pauseCh := make(chan struct{})
			job := chat1.ArchiveChatJob{Request: req, Status: chat1.ArchiveChatJobStatus_RUNNING}
			if err := r.Set(ctx, func() { close(pauseCh) }, job); err != nil {
				return err
			}
			<-pauseCh
			<-firstExit
		case 2:
			close(secondLaunched)
			<-secondRelease
		}
		return nil
	}
	launchCount := func() int {
		mu.Lock()
		defer mu.Unlock()
		return launches
	}
	stopCh := make(chan struct{})
	r.Lock()
	r.started = true
	r.stopCh = stopCh
	r.Unlock()
	defer close(stopCh)
	ctx := context.Background()

	require.NoError(t, r.resumeAllBgJobs(ctx, stopCh))
	require.Eventually(t, func() bool {
		_, running := archiveStatuses(r)
		return running == 1
	}, 10*time.Second, time.Millisecond, "first launch did not register")
	r.Lock()
	require.NoError(t, r.bgPauseAllJobsLocked(ctx))
	r.Unlock()
	require.NoError(t, r.resumeAllBgJobs(ctx, stopCh))
	select {
	case <-secondLaunched:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "second launch did not start")
	}

	close(firstExit)
	require.Never(t, func() bool {
		if err := r.resumeAllBgJobs(ctx, stopCh); err != nil {
			return true
		}
		return launchCount() > 2
	}, 300*time.Millisecond, 10*time.Millisecond, "job launched again before its launch registered")
	close(secondRelease)
}

func TestArchiveStartInBackgroundDoesNotResume(t *testing.T) {
	r, runner, tc := setupAppStateArchive(t, true)
	for _, state := range []keybase1.MobileAppState{
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	} {
		tc.G.MobileAppState.Update(state)
		r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
		select {
		case id := <-runner.launched:
			require.FailNow(t, fmt.Sprintf("resumed %v at a Start in %v", id, state))
		case <-time.After(200 * time.Millisecond):
		}
		requireArchiveStopped(t, r)
	}

	r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireArchiveStopped(t, r)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	requireArchiveJobsRunning(t, r)
	launches, _ := runner.counts()
	for _, id := range archiveTestJobIDs {
		require.Equal(t, 1, launches[id])
	}
}

func TestArchiveScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			r, runner, tc := setupAppStateArchive(t, true)
			r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
			defer requireArchiveStopped(t, r)
			lifecycletest.Play(t, tc.G.MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				if step.Want == keybase1.MobileAppState_FOREGROUND {
					requireArchiveJobsRunning(t, r)
				} else {
					requireArchiveJobsPaused(t, r, runner)
				}
			})
		})
	}
}

// Rapid transitions race resumes against pauses, and Starts and Stops against
// the loop.
func TestArchiveAppStateStress(t *testing.T) {
	r, runner, tc := setupAppStateArchive(t, true)
	// Pauses flush, and the first flush opens the local db and its goroutines.
	r.Lock()
	r.dirty = true
	require.NoError(t, r.flushLocked(context.Background()))
	r.Unlock()
	baseline := runtime.NumGoroutine()
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	states := []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	}
	r.Start(context.TODO(), uid)
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
		for w := range 2 {
			wg.Go(func() {
				rng := rand.New(rand.NewSource(int64(99 + w)))
				for range 40 {
					switch rng.Intn(3) {
					case 0:
						r.Start(context.TODO(), uid)
					case 1:
						<-r.Stop(context.TODO())
					default:
						// Start again without waiting for the old run.
						r.Stop(context.TODO())
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

	r.Start(context.TODO(), uid)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	requireArchiveJobsPaused(t, r, runner)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	requireArchiveJobsRunning(t, r)
	for id, n := range func() map[chat1.ArchiveJobID]int { l, _ := runner.counts(); return l }() {
		require.Positive(t, n, "%v", id)
	}
	_, active := runner.counts()
	require.Equal(t, len(archiveTestJobIDs), active, "one live run per job")
	requireArchiveStopped(t, r)
	requireArchiveJobsPaused(t, r, runner)
	requireNoGoroutineLeak(t, baseline)
}
