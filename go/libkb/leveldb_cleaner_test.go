package libkb

import (
	"fmt"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// newMobileCleanerDb makes a LevelDb whose cleaner behaves as on mobile. The
// db is not opened.
func newMobileCleanerDb(t *testing.T, tc *TestContext, config DbCleanerConfig) *LevelDb {
	dir := t.TempDir()
	db := NewLevelDb(tc.G, func() string { return filepath.Join(dir, "test.leveldb") })
	db.cleaner = newLevelDbCleanerWithConfig(NewMetaContextTODO(tc.G), "test", config, true)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func testCleanerConfig() DbCleanerConfig {
	config := DefaultMobileDbCleanerConfig
	config.CacheCapacity = 10
	return config
}

func (c *levelDbCleaner) snapshot() (cancelCh chan struct{}, monitors int) {
	c.Lock()
	defer c.Unlock()
	return c.cancelCh, c.monitors
}

// waitCleanerMonitor waits until the cleaner's monitor has acted on the
// current state and is waiting for the next change.
func waitCleanerMonitor(t *testing.T, c *levelDbCleaner) {
	t.Helper()
	require.Eventually(t, func() bool {
		c.Lock()
		state, wait, monitors := c.monitorState, c.monitorWait, c.monitors
		c.Unlock()
		if monitors != 1 || wait == nil || wait != c.G().MobileAppState.NextUpdate(state) {
			return false
		}
		select {
		case <-wait:
			return false
		default:
			return true
		}
	}, 10*time.Second, time.Millisecond, "cleaner monitor did not catch up")
}

func isClosed(ch chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

var cleanerStates = []keybase1.MobileAppState{
	keybase1.MobileAppState_FOREGROUND,
	keybase1.MobileAppState_BACKGROUNDACTIVE,
	keybase1.MobileAppState_INACTIVE,
	keybase1.MobileAppState_BACKGROUND,
}

// requireCancelOnTransition moves to next and checks that a clean running
// across the transition is canceled unless next is BACKGROUNDACTIVE.
func requireCancelOnTransition(t *testing.T, db *LevelDb, next keybase1.MobileAppState) {
	t.Helper()
	cancelCh, _ := db.cleaner.snapshot()
	db.G().MobileAppState.Update(next)
	waitCleanerMonitor(t, db.cleaner)
	want := next != keybase1.MobileAppState_BACKGROUNDACTIVE
	require.Equal(t, want, isClosed(cancelCh), "transition to %v", next)
}

func TestLevelDbCleanerCancelsOutsideBackgroundActive(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-cancel", 0)
	defer tc.Cleanup()
	db := newMobileCleanerDb(t, &tc, testCleanerConfig())
	require.NoError(t, db.ForceOpen())
	waitCleanerMonitor(t, db.cleaner)
	for _, from := range cleanerStates {
		for _, to := range cleanerStates {
			if from == to {
				continue
			}
			tc.G.MobileAppState.Update(from)
			waitCleanerMonitor(t, db.cleaner)
			requireCancelOnTransition(t, db, to)
		}
	}
}

// A clean in progress stops at a transition out of BACKGROUNDACTIVE and runs
// to completion across a transition into it.
func TestLevelDbCleanerRunningCleanFollowsAppState(t *testing.T) {
	for _, next := range cleanerStates {
		t.Run(next.String(), func(t *testing.T) {
			tc := SetupTest(t, "LevelDb-cleaner-running", 0)
			defer tc.Cleanup()
			config := testCleanerConfig()
			config.SleepInterval = 100 * time.Millisecond
			db := newMobileCleanerDb(t, &tc, config)
			start := keybase1.MobileAppState_INACTIVE
			if next == start {
				start = keybase1.MobileAppState_FOREGROUND
			}
			tc.G.MobileAppState.Update(start)
			const numKeys = 3500
			for i := range numKeys {
				require.NoError(t, db.Put(DbKey{Key: fmt.Sprintf("k%05d", i), Typ: 0}, nil, []byte{1}))
			}
			waitCleanerMonitor(t, db.cleaner)
			db.cleaner.clearCache()

			done := make(chan error, 1)
			go func() { done <- db.cleaner.clean(true /* force */) }()
			require.Eventually(t, func() bool {
				db.cleaner.Lock()
				defer db.cleaner.Unlock()
				return db.cleaner.running
			}, 10*time.Second, time.Millisecond)
			tc.G.MobileAppState.Update(next)
			waitCleanerMonitor(t, db.cleaner)
			require.NoError(t, <-done)

			_, found, err := db.Get(DbKey{Key: fmt.Sprintf("k%05d", numKeys-1), Typ: 0})
			require.NoError(t, err)
			require.Equal(t, next != keybase1.MobileAppState_BACKGROUNDACTIVE, found,
				"last key after a clean across a transition to %v", next)
		})
	}
}

func TestLevelDbCleanerSeedsFromState(t *testing.T) {
	for _, initial := range cleanerStates {
		t.Run(initial.String(), func(t *testing.T) {
			tc := SetupTest(t, "LevelDb-cleaner-seed", 0)
			defer tc.Cleanup()
			tc.G.MobileAppState.Update(initial)
			db := newMobileCleanerDb(t, &tc, testCleanerConfig())
			cancelCh, monitors := db.cleaner.snapshot()
			require.Zero(t, monitors, "monitor running before the db opened")
			require.NoError(t, db.ForceOpen())
			waitCleanerMonitor(t, db.cleaner)
			require.False(t, isClosed(cancelCh), "canceled without a transition from %v", initial)
		})
	}
}

func TestLevelDbCleanerMonitorSurvivesReopen(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-reopen", 0)
	defer tc.Cleanup()
	db := newMobileCleanerDb(t, &tc, testCleanerConfig())
	require.NoError(t, db.ForceOpen())
	waitCleanerMonitor(t, db.cleaner)
	requireCancelOnTransition(t, db, keybase1.MobileAppState_BACKGROUND)

	reopens := map[string]func(){
		"nuke": func() {
			_, err := db.Nuke()
			require.NoError(t, err)
			require.NoError(t, db.ForceOpen())
		},
		"close": func() {
			require.NoError(t, db.Close())
			// The first use after Close fails and rearms the lazy open.
			require.Error(t, db.ForceOpen())
			require.NoError(t, db.ForceOpen())
		},
	}
	for _, name := range []string{"nuke", "close", "nuke"} {
		reopens[name]()
		_, monitors := db.cleaner.snapshot()
		require.Equal(t, 1, monitors, "after %s", name)
		waitCleanerMonitor(t, db.cleaner)
		requireCancelOnTransition(t, db, keybase1.MobileAppState_FOREGROUND)
		requireCancelOnTransition(t, db, keybase1.MobileAppState_BACKGROUNDACTIVE)
		requireCancelOnTransition(t, db, keybase1.MobileAppState_BACKGROUND)

		// A reopened cleaner cleans again.
		key := DbKey{Key: "reopen-key", Typ: 0}
		require.NoError(t, db.Put(key, nil, []byte{1}))
		db.cleaner.clearCache()
		require.NoError(t, db.cleaner.clean(true /* force */))
		_, found, err := db.Get(key)
		require.NoError(t, err)
		require.False(t, found, "clean after %s left the key", name)
	}
	require.NoError(t, db.Close())
	require.Eventually(t, func() bool {
		_, monitors := db.cleaner.snapshot()
		return monitors == 0
	}, 10*time.Second, time.Millisecond, "monitor outlived Close")
}

func TestLevelDbCleanerScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			tc := SetupTest(t, "LevelDb-cleaner-scenario", 0)
			defer tc.Cleanup()
			h := lifecycletest.NewHarness(t, tc.G.MobileAppState, sc.Platform)
			defer h.Close()
			db := newMobileCleanerDb(t, &tc, testCleanerConfig())
			require.NoError(t, db.ForceOpen())
			waitCleanerMonitor(t, db.cleaner)
			prev := sc.Platform.InitialState()
			for i, step := range sc.Steps {
				cancelCh, _ := db.cleaner.snapshot()
				h.Do(step)
				waitCleanerMonitor(t, db.cleaner)
				db.cleaner.Lock()
				monitorState := db.cleaner.monitorState
				db.cleaner.Unlock()
				require.Equal(t, step.Want, monitorState, "step %d %v", i, step.Do)
				canceled := isClosed(cancelCh)
				switch {
				case step.Want != prev && step.Want != keybase1.MobileAppState_BACKGROUNDACTIVE:
					require.True(t, canceled, "step %d %v: clean not canceled in %v", i, step.Do, step.Want)
				case step.Want == keybase1.MobileAppState_BACKGROUNDACTIVE && step.Gen <= 1:
					require.False(t, canceled, "step %d %v: clean canceled in BACKGROUNDACTIVE", i, step.Do)
				case step.Want == prev && step.Gen <= 1:
					require.False(t, canceled, "step %d %v: clean canceled without a transition", i, step.Do)
				}
				prev = step.Want
			}
			h.CheckObserved(sc.Observed)
		})
	}
}

// Nukes, closes and reopens racing app-state changes leave one working
// monitor while the db is open and none after it closes.
func TestLevelDbCleanerMonitorStress(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-stress", 0)
	defer tc.Cleanup()
	baseline := runtime.NumGoroutine()
	db := newMobileCleanerDb(t, &tc, testCleanerConfig())

	var wg sync.WaitGroup
	stop := make(chan struct{})
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; ; i++ {
			select {
			case <-stop:
				return
			default:
			}
			tc.G.MobileAppState.Update(cleanerStates[i%len(cleanerStates)])
		}
	}()
	for w := range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range 50 {
				switch (w + i) % 3 {
				case 0:
					_, _ = db.Nuke()
				case 1:
					_ = db.Close()
				default:
					_ = db.Put(DbKey{Key: fmt.Sprintf("w%d-%d", w, i), Typ: 0}, nil, []byte{1})
				}
				_ = db.ForceOpen()
			}
		}()
	}
	time.Sleep(10 * time.Millisecond)
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 50 {
				_ = db.ForceOpen()
			}
		}()
	}
	time.Sleep(200 * time.Millisecond)
	close(stop)
	wg.Wait()

	// A racing Close leaves one failed open before the next open succeeds.
	require.Eventually(t, func() bool { return db.ForceOpen() == nil }, 10*time.Second, time.Millisecond)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	waitCleanerMonitor(t, db.cleaner)
	requireCancelOnTransition(t, db, keybase1.MobileAppState_BACKGROUND)

	require.NoError(t, db.Close())
	require.Eventually(t, func() bool {
		_, monitors := db.cleaner.snapshot()
		return monitors == 0 && runtime.NumGoroutine() <= baseline+5
	}, 10*time.Second, 10*time.Millisecond, "monitor or goroutines outlived Close")
}
