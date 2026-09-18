package libkb

import (
	stderrors "errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb"
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

// putKeys writes numKeys keys under db and returns the first and last ones.
func putKeys(t *testing.T, db *LevelDb, numKeys int) (first, last DbKey) {
	t.Helper()
	for i := range numKeys {
		key := DbKey{Key: fmt.Sprintf("k%05d", i), Typ: 0}
		require.NoError(t, db.Put(key, nil, []byte{1}))
		if i == 0 {
			first = key
		}
		last = key
	}
	return first, last
}

// waitFirstBatchPurged waits until a running clean has purged firstKey, its
// oldest key. clean() samples the app state once, before its first batch;
// waiting for that first batch orders a test's own app-state update after
// that sample, so the update is guaranteed to be seen as a real change
// instead of racing the sample itself.
//
// It reads the raw db rather than going through LevelDb.Get, which would
// mark firstKey recently-used and make the cleaner skip deleting it -- the
// very thing being waited for.
func waitFirstBatchPurged(t *testing.T, db *LevelDb, firstKey DbKey) {
	t.Helper()
	require.Eventually(t, func() bool {
		_, err := db.db.Load().Get(firstKey.ToBytes(), nil)
		return stderrors.Is(err, leveldb.ErrNotFound)
	}, 10*time.Second, time.Millisecond, "clean did not purge its first batch")
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
			firstKey, lastKey := putKeys(t, db, numKeys)
			db.cleaner.clearCache()

			done := make(chan error, 1)
			go func() { done <- db.cleaner.clean(true /* force */) }()
			waitFirstBatchPurged(t, db, firstKey)

			tc.G.MobileAppState.Update(next)
			require.NoError(t, <-done)

			_, found, err := db.Get(lastKey)
			require.NoError(t, err)
			require.True(t, found, "a clean canceled by leaving BACKGROUNDACTIVE should not reach the last key")
		})
	}
}

// A clean keeps running, with no early return, for as long as the app state
// stays BACKGROUNDACTIVE, including across an unrelated update. NextUpdate
// only fires on a real change, so a same-value BACKGROUNDACTIVE update never
// wakes the batch loop at all; a collapsed BACKGROUNDACTIVE -> X ->
// BACKGROUNDACTIVE transition can't be produced deterministically, since the
// loop's poll may or may not land inside the window where the state reads as
// X.
func TestCleanerContinuesAcrossBackgroundActiveReentry(t *testing.T) {
	tc := SetupTest(t, "LevelDb-cleaner-continue", 0)
	defer tc.Cleanup()
	config := testCleanerConfig()
	config.SleepInterval = 100 * time.Millisecond
	db := newMobileCleanerDb(t, &tc, config)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)

	const numKeys = 3500
	firstKey, lastKey := putKeys(t, db, numKeys)
	db.cleaner.clearCache()

	done := make(chan error, 1)
	go func() { done <- db.cleaner.clean(true /* force */) }()
	waitFirstBatchPurged(t, db, firstKey)

	// An unrelated update that collapses to a no-op: still BACKGROUNDACTIVE,
	// so it must not interrupt the clean.
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	require.NoError(t, <-done)

	_, found, err := db.Get(lastKey)
	require.NoError(t, err)
	require.False(t, found, "a clean that never left BACKGROUNDACTIVE should run to completion")
}
