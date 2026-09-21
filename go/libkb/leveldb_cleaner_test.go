package libkb

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// newMobileCleanerDb makes a LevelDb whose cleaner behaves as on mobile. The
// db is not opened.
func newMobileCleanerDb(t *testing.T, tc *TestContext, config DbCleanerConfig) *LevelDb {
	dir := t.TempDir()
	db := NewLevelDb(tc.G, func() string { return filepath.Join(dir, "test.leveldb") })
	db.cleaner = newLevelDbCleanerWithConfig(NewMetaContextTODO(tc.G), "test", config)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func testCleanerConfig() DbCleanerConfig {
	config := DefaultMobileDbCleanerConfig
	config.CacheCapacity = 10
	return config
}

var cleanerStates = []keybase1.MobileAppState{
	keybase1.MobileAppState_FOREGROUND,
	keybase1.MobileAppState_BACKGROUNDACTIVE,
	keybase1.MobileAppState_INACTIVE,
	keybase1.MobileAppState_BACKGROUND,
}

// waitCleanerRunning waits until a started clean has taken the running flag.
// clean() samples the app state in the same critical section as setting
// running, so a caller who observes running via this has already lost any
// race against that sample.
func waitCleanerRunning(t *testing.T, c *levelDbCleaner) {
	t.Helper()
	require.Eventually(t, func() bool {
		c.Lock()
		defer c.Unlock()
		return c.running
	}, 10*time.Second, time.Millisecond, "clean did not start running")
}

// putKeys writes numKeys keys under db and returns the last one.
func putKeys(t *testing.T, db *LevelDb, numKeys int) DbKey {
	t.Helper()
	var last DbKey
	for i := range numKeys {
		last = DbKey{Key: fmt.Sprintf("k%05d", i), Typ: 0}
		require.NoError(t, db.Put(last, nil, []byte{1}))
	}
	return last
}

// A clean in progress stops before finishing when the app leaves
// BACKGROUNDACTIVE for any other state.
func TestCleanerStopsWhenLeavingBackgroundActive(t *testing.T) {
	for _, next := range cleanerStates {
		if next == keybase1.MobileAppState_BACKGROUNDACTIVE {
			continue
		}
		t.Run(next.String(), func(t *testing.T) {
			tc := SetupTest(t, "LevelDb-cleaner-stop", 0)
			defer tc.Cleanup()
			config := testCleanerConfig()
			config.SleepInterval = 100 * time.Millisecond
			db := newMobileCleanerDb(t, &tc, config)
			tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)

			const numKeys = 3500
			lastKey := putKeys(t, db, numKeys)
			db.cleaner.clearCache()

			done := make(chan error, 1)
			go func() { done <- db.cleaner.clean(true /* force */) }()
			waitCleanerRunning(t, db.cleaner)

			tc.G.MobileAppState.Update(next)
			require.NoError(t, <-done)

			_, found, err := db.Get(lastKey)
			require.NoError(t, err)
			require.True(t, found, "a clean canceled by leaving BACKGROUNDACTIVE should not reach the last key")
		})
	}
}

// A clean that starts outside BACKGROUNDACTIVE is also interrupted by a
// transition to a different non-BACKGROUNDACTIVE state: cancellation depends
// on the landing state, not on where the clean started.
func TestCleanerStopsOnTransitionBetweenNonBackgroundActiveStates(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-stop-fg", 0)
	defer tc.Cleanup()
	config := testCleanerConfig()
	config.SleepInterval = 100 * time.Millisecond
	db := newMobileCleanerDb(t, &tc, config)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)

	const numKeys = 3500
	lastKey := putKeys(t, db, numKeys)
	db.cleaner.clearCache()

	done := make(chan error, 1)
	go func() { done <- db.cleaner.clean(true /* force */) }()
	waitCleanerRunning(t, db.cleaner)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	require.NoError(t, <-done)

	_, found, err := db.Get(lastKey)
	require.NoError(t, err)
	require.True(t, found, "a clean canceled by a transition between non-BACKGROUNDACTIVE states should not reach the last key")
}

// A clean keeps running, with no early return, for as long as the app state
// stays BACKGROUNDACTIVE, including across an unrelated update that collapses
// to a no-op (NextUpdate only fires on a real change).
func TestCleanerContinuesWhileBackgroundActive(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-continue", 0)
	defer tc.Cleanup()
	config := testCleanerConfig()
	config.SleepInterval = 100 * time.Millisecond
	db := newMobileCleanerDb(t, &tc, config)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)

	const numKeys = 3500
	lastKey := putKeys(t, db, numKeys)
	db.cleaner.clearCache()

	done := make(chan error, 1)
	go func() { done <- db.cleaner.clean(true /* force */) }()
	waitCleanerRunning(t, db.cleaner)

	// A same-value update: no real transition, so it must not interrupt the
	// clean.
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	require.NoError(t, <-done)

	_, found, err := db.Get(lastKey)
	require.NoError(t, err)
	require.False(t, found, "a clean that never left BACKGROUNDACTIVE should run to completion")
}

// A clean that starts outside BACKGROUNDACTIVE and then transitions into it
// keeps running: the wake re-arms rather than treating the change itself as
// a cancellation.
func TestCleanerRearmsIntoBackgroundActive(t *testing.T) {
	for _, start := range []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUND,
	} {
		t.Run(start.String(), func(t *testing.T) {
			tc := SetupTest(t, "LevelDb-cleaner-rearm", 0)
			defer tc.Cleanup()
			config := testCleanerConfig()
			config.SleepInterval = 100 * time.Millisecond
			db := newMobileCleanerDb(t, &tc, config)
			tc.G.MobileAppState.Update(start)

			const numKeys = 3500
			lastKey := putKeys(t, db, numKeys)
			db.cleaner.clearCache()

			done := make(chan error, 1)
			go func() { done <- db.cleaner.clean(true /* force */) }()
			waitCleanerRunning(t, db.cleaner)

			tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
			require.NoError(t, <-done)

			_, found, err := db.Get(lastKey)
			require.NoError(t, err)
			require.False(t, found, "a clean that transitions into BACKGROUNDACTIVE should run to completion")
		})
	}
}

// A cleaner still cleans after its db is reopened (Nuke, or Close +
// ForceOpen): start() must reset isShutdown so a reopened cleaner's cache
// isn't stuck discarding everything.
func TestCleanerCleansAfterReopen(t *testing.T) {
	for _, name := range []string{"nuke", "close"} {
		t.Run(name, func(t *testing.T) {
			tc := SetupTest(t, "LevelDb-cleaner-reopen", 0)
			defer tc.Cleanup()
			db := newMobileCleanerDb(t, &tc, testCleanerConfig())
			require.NoError(t, db.ForceOpen())

			switch name {
			case "nuke":
				_, err := db.Nuke()
				require.NoError(t, err)
				require.NoError(t, db.ForceOpen())
			case "close":
				require.NoError(t, db.Close())
				// The first use after Close fails and rearms the lazy open.
				require.Error(t, db.ForceOpen())
				require.NoError(t, db.ForceOpen())
			}

			key := DbKey{Key: "reopen-key", Typ: 0}
			require.NoError(t, db.Put(key, nil, []byte{1}))
			db.cleaner.clearCache()
			require.NoError(t, db.cleaner.clean(true /* force */))

			_, found, err := db.Get(key)
			require.NoError(t, err)
			require.False(t, found, "clean after %s left the key", name)
		})
	}
}
