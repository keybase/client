package search

import (
	"context"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// syncRecorder stands in for SelectiveSync: each sync runs until canceled.
type syncRecorder struct {
	mu     sync.Mutex
	starts int
	active int
}

func (s *syncRecorder) sync(ctx context.Context) error {
	s.mu.Lock()
	s.starts++
	s.active++
	s.mu.Unlock()
	<-ctx.Done()
	s.mu.Lock()
	s.active--
	s.mu.Unlock()
	return ctx.Err()
}

func (s *syncRecorder) counts() (starts, active int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.starts, s.active
}

type syncLoopTest struct {
	t        *testing.T
	tc       libkb.TestContext
	idx      *Indexer
	syncs    *syncRecorder
	stopCh   chan struct{}
	loopDone chan error
}

// The loop's ticker is left at an hour: a BgTicker cannot tick faster than its
// 5s resume wait. The start delay and pokes reach the same attemptSync.
func newAppStateSyncLoop(t *testing.T, state keybase1.MobileAppState) *syncLoopTest {
	tc := externalstest.SetupTest(t, "indexer-appstate", 0)
	t.Cleanup(tc.Cleanup)
	tc.G.MobileAppState.Update(state)
	g := globals.NewContext(tc.G, &globals.ChatContext{CtxFactory: stubCtxFactory{}})
	idx := NewIndexer(g)
	idx.SetStartSyncDelay(0)
	idx.syncInterval = time.Hour
	s := &syncLoopTest{
		t:        t,
		tc:       tc,
		idx:      idx,
		syncs:    &syncRecorder{},
		stopCh:   make(chan struct{}),
		loopDone: make(chan error, 1),
	}
	idx.selectiveSync = s.syncs.sync
	return s
}

func startAppStateSyncLoop(t *testing.T, state keybase1.MobileAppState) *syncLoopTest {
	s := newAppStateSyncLoop(t, state)
	s.start()
	return s
}

func (s *syncLoopTest) start() {
	go func() { s.loopDone <- s.idx.SyncLoop(s.stopCh) }()
}

func (s *syncLoopTest) stop() {
	close(s.stopCh)
	select {
	case err := <-s.loopDone:
		require.NoError(s.t, err)
	case <-time.After(10 * time.Second):
		require.FailNow(s.t, "SyncLoop did not stop")
	}
}

// poke sends a poke and returns once the loop has finished handling it: the
// loop takes one message at a time, so taking a second poke means it is done
// with the first.
func (s *syncLoopTest) poke() {
	for range 2 {
		s.idx.PokeSync(context.Background())
		require.Eventually(s.t, func() bool { return len(s.idx.pokeSyncCh) == 0 },
			10*time.Second, time.Millisecond, "poke not taken")
	}
}

func (s *syncLoopTest) requireActive(active int, msg string) {
	s.t.Helper()
	require.Eventually(s.t, func() bool {
		_, got := s.syncs.counts()
		return got == active
	}, 10*time.Second, time.Millisecond, msg)
}

func TestSyncLoopDoesNotSyncOutsideForeground(t *testing.T) {
	for _, state := range []keybase1.MobileAppState{
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	} {
		t.Run(state.String(), func(t *testing.T) {
			s := startAppStateSyncLoop(t, state)
			defer s.stop()
			for range 5 {
				s.poke()
			}
			time.Sleep(100 * time.Millisecond)
			starts, _ := s.syncs.counts()
			require.Zero(t, starts, "synced in %v", state)

			s.tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
			s.poke()
			s.requireActive(1, "no sync after FOREGROUND")
		})
	}
}

func TestSyncLoopBackgroundCancelsSync(t *testing.T) {
	s := startAppStateSyncLoop(t, keybase1.MobileAppState_FOREGROUND)
	defer s.stop()
	s.poke()
	s.requireActive(1, "no sync in FOREGROUND")
	s.tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	s.requireActive(0, "sync not canceled by BACKGROUND")
	s.poke()
	time.Sleep(50 * time.Millisecond)
	starts, active := s.syncs.counts()
	require.Equal(t, 1, starts)
	require.Zero(t, active)
}

// The loop can start a sync on a poke before it wakes for the change into
// FOREGROUND. A BACKGROUND that lands before it returns to its select must
// still cancel that sync.
func TestSyncLoopBackgroundAfterUnobservedForeground(t *testing.T) {
	s := newAppStateSyncLoop(t, keybase1.MobileAppState_BACKGROUND)
	var beforeOnce, afterOnce sync.Once
	s.idx.beforeSyncStateCheck = func() {
		beforeOnce.Do(func() { s.tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND) })
	}
	s.idx.afterSyncStart = func() {
		afterOnce.Do(func() {
			for {
				if _, active := s.syncs.counts(); active == 1 {
					break
				}
				time.Sleep(time.Millisecond)
			}
			s.tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
		})
	}
	s.start()
	defer s.stop()
	s.poke()
	s.requireActive(0, "sync kept running in BACKGROUND")
	starts, _ := s.syncs.counts()
	require.Equal(t, 1, starts)
}

func TestSyncLoopScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			s := startAppStateSyncLoop(t, keybase1.MobileAppState_FOREGROUND)
			defer s.stop()
			lifecycletest.Play(t, s.tc.G.MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				if step.Want == keybase1.MobileAppState_FOREGROUND {
					s.poke()
					s.requireActive(1, "no sync in FOREGROUND")
					return
				}
				s.requireActive(0, "sync running outside FOREGROUND")
				before, _ := s.syncs.counts()
				s.poke()
				if starts, _ := s.syncs.counts(); starts != before {
					t.Fatalf("step %d %v: sync started in %v", i, step.Do, step.Want)
				}
			})
		})
	}
}

func TestSyncLoopAppStateStress(t *testing.T) {
	s := newAppStateSyncLoop(t, keybase1.MobileAppState_FOREGROUND)
	baseline := runtime.NumGoroutine()
	s.start()
	states := []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	}
	var wg sync.WaitGroup
	for w := range 4 {
		wg.Go(func() {
			rng := rand.New(rand.NewSource(int64(w)))
			for range 500 {
				s.tc.G.MobileAppState.Update(states[rng.Intn(len(states))])
				if rng.Intn(4) == 0 {
					s.idx.PokeSync(context.Background())
				}
			}
		})
	}
	wg.Wait()
	s.tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	s.requireActive(0, "sync running in BACKGROUND")
	s.tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	s.poke()
	s.requireActive(1, "no sync in FOREGROUND")
	s.stop()
	s.requireActive(0, "sync outlived the loop")
	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline, "leaked goroutines")
}
