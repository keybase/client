// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
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

// waitCleanerRunning waits until a started clean has taken the running flag.
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
	for i := 0; i < numKeys; i++ {
		last = DbKey{Key: fmt.Sprintf("k%05d", i), Typ: 0}
		require.NoError(t, db.Put(last, nil, []byte{1}))
	}
	return last
}

// A cleaner still cleans after its db is reopened (Nuke, or Close +
// ForceOpen): a reopen must leave the cleaner's cache and shutdown state
// working, since Close's Shutdown() call leaves a one-entry cache and a
// permanent shutdown flag that neither is ever undone.
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
				// require.Error here pins that existing open-after-close
				// semantics (not itself the bug under test), so the "close"
				// case reaches the same reopened state as "nuke" before the
				// two share the clean() assertion below.
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

// A reopened db is a different key space, so a clean on it starts from the
// beginning rather than where a clean of the old db left off.
func TestCleanerStartsFromBeginningAfterReopen(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-reopen-lastkey", 0)
	defer tc.Cleanup()
	db := newMobileCleanerDb(t, &tc, testCleanerConfig())
	require.NoError(t, db.ForceOpen())

	key := DbKey{Key: "aaaa", Typ: 0}
	db.cleaner.Lock()
	db.cleaner.lastKey = DbKey{Key: "zzzz", Typ: 0}.ToBytes()
	db.cleaner.Unlock()

	_, err := db.Nuke()
	require.NoError(t, err)
	require.NoError(t, db.Put(key, nil, []byte{1}))
	db.cleaner.clearCache()
	require.NoError(t, db.cleaner.clean(true /* force */))

	_, found, err := db.Get(key)
	require.NoError(t, err)
	require.False(t, found, "clean skipped keys below the old db's lastKey")
}

// Status reads cleaner state that a reopen replaces; -race only, it catches
// a data race between the reopen's setDb and a concurrent Status/clearCache.
func TestCleanerStatusDuringReopen(t *testing.T) {
	if !raceEnabled {
		t.Skip("race-only test; run with -race")
	}
	tc := SetupTest(t, "LevelDb-cleaner-status-reopen", 0)
	defer tc.Cleanup()
	db := newMobileCleanerDb(t, &tc, testCleanerConfig())
	require.NoError(t, db.ForceOpen())

	stop := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			select {
			case <-stop:
				return
			default:
				_ = db.cleaner.Status()
				db.cleaner.clearCache()
			}
		}
	}()
	for i := 0; i < 20; i++ {
		_, err := db.Nuke()
		require.NoError(t, err)
		require.NoError(t, db.ForceOpen())
	}
	close(stop)
	<-done
}

// Close waits for a running clean to exit before closing the db under it,
// and a clean that sleeps between batches exits promptly when stopped.
func TestCleanerCloseWaitsForRunningClean(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-close-waits", 0)
	defer tc.Cleanup()
	config := testCleanerConfig()
	config.SleepInterval = time.Minute
	db := newMobileCleanerDb(t, &tc, config)

	putKeys(t, db, 3500)
	db.cleaner.clearCache()
	done := make(chan error, 1)
	go func() { done <- db.cleaner.clean(true /* force */) }()
	waitCleanerRunning(t, db.cleaner)

	// Wait for the first batch to land, so the clean is headed for its long
	// sleep. The conditions below run on another goroutine, where require
	// can't stop the test, so read errors go through the CollectT and are
	// reported if the wait times out.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		keys, err := db.KeysWithPrefixes(tablePrefix(levelDbTableKv))
		if !assert.NoError(c, err) {
			return
		}
		assert.Less(c, len(keys), 3500, "the first batch never landed")
	}, 10*time.Second, time.Millisecond)

	// Once the first batch lands, wait out a settle delay before Close: the
	// batch's write, its compaction, and the size check that follows still
	// touch the db briefly after the key count stops moving, so Close could
	// otherwise race an in-flight db operation instead of the intended
	// target, clean() blocked in its minute-long SleepInterval. Implemented
	// as a streak of unchanged polls (a poll-based sleep) rather than a flat
	// time.Sleep, since it still bails out via the wait's overall timeout
	// instead of hanging if the count never stabilizes. 60 reads 5ms apart
	// is ~300ms of margin, widened for slow/-race runners.
	const stableReadsNeeded = 60
	stableCount, streak := -1, 0
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		keys, err := db.KeysWithPrefixes(tablePrefix(levelDbTableKv))
		if !assert.NoError(c, err) {
			streak = 0
			return
		}
		count := len(keys)
		if count == stableCount {
			streak++
		} else {
			stableCount = count
			streak = 1
		}
		assert.GreaterOrEqual(c, streak, stableReadsNeeded, "key count never stabilized before the sleep")
	}, 10*time.Second, 5*time.Millisecond)

	start := time.Now()
	require.NoError(t, db.Close())
	require.Less(t, time.Since(start), 10*time.Second, "Close waited out the clean's sleep")
	db.cleaner.Lock()
	running := db.cleaner.running
	db.cleaner.Unlock()
	require.False(t, running, "Close returned with a clean still running on the closed db")
	require.NoError(t, <-done)
}

// A clean that starts after Close has no db to clean.
func TestCleanerAfterCloseIsNoop(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-after-close", 0)
	defer tc.Cleanup()
	db := newMobileCleanerDb(t, &tc, testCleanerConfig())
	require.NoError(t, db.ForceOpen())
	require.NoError(t, db.Close())
	require.NoError(t, db.cleaner.clean(true /* force */))
}
