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

func waitArchiveMonitor(t *testing.T, r *ChatArchiveRegistry) {
	t.Helper()
	require.Eventually(t, func() bool {
		r.Lock()
		state, wait := r.monitorState, r.monitorWait
		r.Unlock()
		if wait == nil || wait != r.G().MobileAppState.NextUpdate(state) {
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

// A pause that lands after a job launched, but before it registered, pauses
// it on registration.
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
	waitArchiveMonitor(t, r)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	waitArchiveMonitor(t, r)
	close(runner.release)
	requireArchiveJobsPaused(t, r, runner)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	requireArchiveJobsRunning(t, r)
}

// A resume whose delay fired as its run stopped must not launch jobs in the
// run, possibly another user's, that started next; that run resumes on its
// own schedule. The context is left uncanceled: the stopped run's monitor may
// not have exited to cancel it yet.
func TestArchiveStaleResumeAfterRestart(t *testing.T) {
	r, runner, _ := setupAppStateArchive(t, true)
	oldStopCh := make(chan struct{})
	r.Lock()
	r.started = true
	r.stopCh = oldStopCh
	r.Unlock()
	r.beforeResumeDecision = func() {
		r.Lock()
		r.started = false
		close(oldStopCh)
		r.Unlock()
		r.resumeJobsDelay = time.Hour
		r.Start(context.TODO(), gregor1.UID([]byte{5, 6, 7, 8}))
	}
	require.NoError(t, r.resumeAllBgJobs(context.Background(), oldStopCh))
	defer requireArchiveStopped(t, r)
	select {
	case id := <-runner.launched:
		require.FailNow(t, fmt.Sprintf("stale resume launched %v", id))
	case <-time.After(300 * time.Millisecond):
	}
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
		waitArchiveMonitor(t, r)
		select {
		case id := <-runner.launched:
			require.FailNow(t, fmt.Sprintf("resumed %v at a Start in %v", id, state))
		case <-time.After(200 * time.Millisecond):
		}
		requireArchiveStopped(t, r)
	}

	r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	defer requireArchiveStopped(t, r)
	waitArchiveMonitor(t, r)
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
				waitArchiveMonitor(t, r)
				if step.Want == keybase1.MobileAppState_FOREGROUND {
					requireArchiveJobsRunning(t, r)
				} else {
					requireArchiveJobsPaused(t, r, runner)
				}
			})
		})
	}
}

// Each FOREGROUND schedules a resume that the next transition cancels while
// it waits out its delay; the canceled resume must still see its own context.
func TestArchiveCanceledResumesKeepTheirContext(t *testing.T) {
	r, runner, tc := setupAppStateArchive(t, true)
	r.resumeJobsDelay = time.Hour
	r.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	for range 20 {
		for _, state := range []keybase1.MobileAppState{
			keybase1.MobileAppState_INACTIVE,
			keybase1.MobileAppState_FOREGROUND,
		} {
			tc.G.MobileAppState.Update(state)
			waitArchiveMonitor(t, r)
		}
	}
	requireArchiveStopped(t, r)
	launches, _ := runner.counts()
	require.Empty(t, launches)
}

// Rapid transitions race resumes against pauses and the monitor's resume
// contexts against the goroutines using them.
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
	waitArchiveMonitor(t, r)
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
