// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb"
)

type teardowner struct {
	sync.Mutex

	actions  []func()
	torndown bool
}

func (td *teardowner) register(teardownAction func()) {
	td.Lock()
	defer td.Unlock()
	if td.torndown {
		panic("already torndown")
	}
	td.actions = append(td.actions, teardownAction)
}

func (td *teardowner) teardown() {
	td.Lock()
	defer td.Unlock()
	if td.torndown {
		panic("already torndown")
	}
	for _, a := range td.actions {
		a()
	}
}

func createTempLevelDbForTest(tc *TestContext, td *teardowner) (*LevelDb, error) {
	dir, err := os.MkdirTemp("", "level-db-test-")
	if err != nil {
		return nil, err
	}

	db := NewLevelDb(tc.G, func() string {
		return filepath.Join(dir, "test.leveldb")
	})

	td.register(func() {
		db.Close()
		os.RemoveAll(dir)
	})

	return db, nil
}

func doSomeIO() error {
	dir, err := os.MkdirTemp("", "level-db-test-")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "some-io"), []byte("O_O"), 0o600)
}

func levelDbStats(t *testing.T, db *LevelDb) (stats leveldb.DBStats) {
	require.NoError(t, db.doWhileOpenAndNukeIfCorrupted(func() error {
		return db.db.Load().Stats(&stats)
	}))
	return stats
}

func levelDbTableCount(t *testing.T, db *LevelDb) (count int) {
	for _, n := range levelDbStats(t, db).LevelTablesCounts {
		count += n
	}
	return count
}

// levelDbJournalSize returns the size of the journal (*.log) files, which
// hold writes not yet flushed to a table.
func levelDbJournalSize(t *testing.T, db *LevelDb) (size int64) {
	journals, err := filepath.Glob(filepath.Join(db.GetFilename(), "*.log"))
	require.NoError(t, err)
	require.NotEmpty(t, journals)
	for _, j := range journals {
		fi, err := os.Stat(j)
		require.NoError(t, err)
		size += fi.Size()
	}
	return size
}

func testLevelDbPut(db *LevelDb) (key DbKey, err error) {
	key = DbKey{Key: "test-key", Typ: 0}
	v := []byte{1, 2, 3, 4}
	if err := db.Put(key, nil, v); err != nil {
		return DbKey{}, err
	}
	if val, found, err := db.Get(key); err != nil {
		return DbKey{}, err
	} else if !found {
		return DbKey{}, fmt.Errorf("stored object was not found by Get")
	} else if !bytes.Equal(val, v) {
		return DbKey{}, fmt.Errorf("stored object has incorrect data. expect %v, got %v", v, val)
	}

	return key, nil
}

func TestLevelDb(t *testing.T) {
	var td teardowner

	tests := []struct {
		name     string
		testBody func(t *testing.T)
	}{
		{
			name: "simple", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-simple", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				key, err := testLevelDbPut(db)
				require.NoError(t, err)

				err = db.Delete(key)
				require.NoError(t, err)

				_, found, err := db.Get(key)
				require.NoError(t, err)
				require.False(t, found)
			},
		},
		{
			name: "flush", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-flush", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				// Flush before the lazy open is a no-op.
				require.NoError(t, db.Flush())

				key, err := testLevelDbPut(db)
				require.NoError(t, err)
				require.Zero(t, levelDbTableCount(t, db), "the put should still be in the memtable")

				require.NoError(t, db.Flush())
				require.NotZero(t, levelDbTableCount(t, db), "flush should write the memtable to a table")
				require.NoError(t, db.Flush())

				// Data survives the flush.
				val, found, err := db.Get(key)
				require.NoError(t, err)
				require.True(t, found)
				require.Equal(t, []byte{1, 2, 3, 4}, val)

				// Writes still work after a flush.
				_, err = testLevelDbPut(db)
				require.NoError(t, err)
			},
		},
		{
			name: "flush-memtable-only", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-flush-memtable-only", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)
				require.NoError(t, db.ForceOpen())

				putAcrossPrefixes := func(round int) {
					for _, prefix := range []string{"aa", "kv", "lo", "pm", "zz"} {
						for i := 0; i < 20; i++ {
							key := []byte(fmt.Sprintf("%s:%d:%d", prefix, round, i))
							require.NoError(t, db.db.Load().Put(key, bytes.Repeat([]byte{byte(i)}, 100), nil))
						}
					}
				}
				// Existing tables spanning the whole key space, so a table
				// compaction of the flushed memtable would have inputs.
				for round := 0; round < 2; round++ {
					putAcrossPrefixes(round)
					tr, err := db.db.Load().OpenTransaction()
					require.NoError(t, err)
					tr.Discard()
				}
				putAcrossPrefixes(2)
				require.NotZero(t, levelDbJournalSize(t, db))
				before := levelDbStats(t, db).LevelTablesCounts
				beforeTotal := levelDbTableCount(t, db)

				require.NoError(t, db.Flush())

				after := levelDbStats(t, db).LevelTablesCounts
				for level, n := range before {
					require.GreaterOrEqual(t, after[level], n, "no table should be compacted away (level %d)", level)
				}
				require.Equal(t, beforeTotal+1, levelDbTableCount(t, db), "flush should add exactly one table")
				require.Zero(t, levelDbJournalSize(t, db), "the flushed memtable's journal should be gone")
				val, err := db.db.Load().Get([]byte("zz:2:19"), nil)
				require.NoError(t, err)
				require.Equal(t, bytes.Repeat([]byte{19}, 100), val)
			},
		},
		{
			// A write and a Flush call that a flush's own hook makes reentrantly
			// must still be flushed before the outer call returns: the hook runs
			// after the transaction is discarded, so goleveldb's write lock is
			// already free and the nested call is a plain second flush.
			name: "flush-reentrant", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-flush-reentrant", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)
				_, err = testLevelDbPut(db)
				require.NoError(t, err)

				rotations := 0
				db.flushHook = func() {
					rotations++
					if rotations == 1 {
						require.NoError(t, db.db.Load().Put([]byte("kv:late"), []byte{1}, nil))
						require.NoError(t, db.Flush())
					}
				}
				require.NoError(t, db.Flush())
				require.Equal(t, 2, rotations)
				require.Zero(t, levelDbJournalSize(t, db))
			},
		},
		{
			// TestConcurrentFlushes: 8 goroutines call Flush with writes
			// interleaved. Flush no longer coalesces concurrent callers, so this
			// exercises goleveldb's own write-lock serialization of the memtable
			// rotation instead.
			name: "flush-concurrent", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-flush-concurrent", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)
				require.NoError(t, db.ForceOpen())

				const writers, iterations = 8, 25
				var wg sync.WaitGroup
				for w := 0; w < writers; w++ {
					wg.Add(1)
					go func(w int) {
						defer wg.Done()
						for i := 0; i < iterations; i++ {
							key := DbKey{Key: fmt.Sprintf("%d-%d", w, i), Typ: 0}
							assert.NoError(t, db.Put(key, nil, []byte{byte(i)}))
							assert.NoError(t, db.Flush())
						}
					}(w)
				}
				wg.Wait()

				require.Zero(t, levelDbJournalSize(t, db), "the last writes must be flushed")
				for w := 0; w < writers; w++ {
					_, found, err := db.Get(DbKey{Key: fmt.Sprintf("%d-%d", w, iterations-1), Typ: 0})
					require.NoError(t, err)
					require.True(t, found)
				}
			},
		},
		{
			name: "open-transaction-after-close", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-transaction-closed", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				require.NoError(t, db.ForceOpen())
				require.NoError(t, db.Close())
				_, err = db.OpenTransaction()
				require.ErrorAs(t, err, &LevelDBOpenClosedError{})
			},
		},
		{
			name: "concurrent-open", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-concurrent-open", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				// Under -race, this catches the lazy open assigning db.db while
				// Flush reads it.
				var wg sync.WaitGroup
				for i := 0; i < 8; i++ {
					wg.Add(2)
					go func() {
						defer wg.Done()
						_, _, err := db.Get(DbKey{Key: "test-key", Typ: 0})
						assert.NoError(t, err)
					}()
					go func() {
						defer wg.Done()
						assert.NoError(t, db.Flush())
					}()
				}
				wg.Wait()

				// A lazy open racing a Nuke reopens rather than reporting closed.
				for i := 0; i < 8; i++ {
					wg.Add(2)
					go func() {
						defer wg.Done()
						key := DbKey{Key: "test-key", Typ: 0}
						assert.NoError(t, db.Put(key, nil, []byte{1}))
						_, _, err := db.Get(key)
						assert.NoError(t, err)
					}()
					go func() {
						defer wg.Done()
						_, err := db.Nuke()
						assert.NoError(t, err)
					}()
				}
				wg.Wait()
			},
		},
		{
			name: "cleaner", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-cleaner", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				key := DbKey{Key: "test-key", Typ: 0}
				v, err := RandBytes(1024 * 1024)
				require.NoError(t, err)
				err = db.Put(key, nil, v)
				require.NoError(t, err)

				// this key will not be deleted since it is in the permanent
				// table.
				require.True(t, IsPermDbKey(DBDiskLRUEntries))
				permKey := DbKey{Key: "test-key", Typ: DBDiskLRUEntries}
				err = db.Put(permKey, nil, v)
				require.NoError(t, err)

				// cleaner will not clean the key since it was recently used
				err = db.cleaner.clean(true /* force */)
				require.NoError(t, err)
				_, found, err := db.Get(key)
				require.NoError(t, err)
				require.True(t, found)
				_, found, err = db.Get(permKey)
				require.NoError(t, err)
				require.True(t, found)

				db.cleaner.clearCache()
				err = db.cleaner.clean(true /* force */)
				require.NoError(t, err)
				_, found, err = db.Get(key)
				require.NoError(t, err)
				require.False(t, found)
				_, found, err = db.Get(permKey)
				require.NoError(t, err)
				require.True(t, found)
			},
		},
		{
			name: "concurrent", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-concurrent", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				var wg sync.WaitGroup
				wg.Add(2)
				// synchronize between two doWhileOpenAndNukeIfCorrupted calls to know
				// for sure they can happen concurrently.
				ch := make(chan struct{})
				go func() {
					_ = db.doWhileOpenAndNukeIfCorrupted(func() error {
						defer wg.Done()
						select {
						case <-time.After(8 * time.Second):
							t.Error("doWhileOpenAndNukeIfCorrupted is not concurrent")
						case <-ch:
						}
						return nil
					})
				}()
				go func() {
					_ = db.doWhileOpenAndNukeIfCorrupted(func() error {
						defer wg.Done()
						select {
						case <-time.After(8 * time.Second):
							t.Error("doWhileOpenAndNukeIfCorrupted does not support concurrent ops")
						case ch <- struct{}{}:
						}
						return nil
					})
				}()
				wg.Wait()
			},
		},
		{
			name: "nuke", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-nuke", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				key, err := testLevelDbPut(db)
				require.NoError(t, err)

				_, err = db.Nuke()
				require.NoError(t, err)

				_, found, err := db.Get(key)
				require.NoError(t, err)
				require.False(t, found)

				// make sure db still works after nuking
				_, err = testLevelDbPut(db)
				require.NoError(t, err)
			},
		},
		{
			name: "use-after-close", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-use-after-close", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				// not closed yet; should be good
				_, err = testLevelDbPut(db)
				require.NoError(t, err)

				err = db.Close()
				require.NoError(t, err)

				_, err = testLevelDbPut(db)
				require.Error(t, err)

				err = db.ForceOpen()
				require.NoError(t, err)
			},
		},
		{
			name: "transactions", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-transactions", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				// have something in the DB
				key, err := testLevelDbPut(db)
				require.NoError(t, err)

				var wg sync.WaitGroup
				wg.Add(2)

				// channels for communicating from first routine to 2nd.
				chOpen := make(chan struct{})
				chCommitted := make(chan struct{}, 1)

				go func() {
					defer wg.Done()

					tr, err := db.OpenTransaction()
					if err != nil {
						t.Error(err)
					}

					select {
					case <-time.After(8 * time.Second):
						t.Error("timeout")
					case chOpen <- struct{}{}:
					}

					err = tr.Put(key, nil, []byte{41})
					if err != nil {
						t.Error(err)
					}

					// We do some IO here to give Go's runtime a chance to schedule
					// different routines and channel operations, to *hopefully* make
					// sure:
					// 1) The channel operation is done;
					// 2) If there exists, any broken OpenTransaction() implementation
					//		that does not block until this transaction finishes, the broken
					//		OpenTransaction() would have has returned
					err = doSomeIO()
					if err != nil {
						t.Error(err)
					}

					// we send to a buffered channel right before Commit() to make sure
					// the channel is ready to read right after the commit
					chCommitted <- struct{}{}

					err = tr.Commit()
					if err != nil {
						t.Error(err)
					}
				}()

				go func() {
					defer wg.Done()

					// wait until the other transaction has opened
					select {
					case <-time.After(8 * time.Second):
						t.Error("timeout")
					case <-chOpen:
					}

					tr, err := db.OpenTransaction()
					select {
					case <-chCommitted:
						// fine
					default:
						t.Error("second transaction did not block until first one finished")
					}
					if err != nil {
						t.Error(err)
					}

					d, found, err := tr.Get(key)
					if err != nil {
						t.Error(err)
					}
					if !found {
						t.Errorf("key %v is not found", found)
					}

					err = tr.Put(key, nil, []byte{d[0] + 1})
					if err != nil {
						t.Error(err)
					}
					err = tr.Commit()
					if err != nil {
						t.Error(err)
					}
				}()

				wg.Wait()

				data, found, err := db.Get(key)
				require.NoError(t, err)
				require.True(t, found)
				require.Len(t, data, 1)
				require.EqualValues(t, 42, data[0])
			},
		},
		{
			name: "transaction-discard", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-transaction-discard", 0)
				defer tc.Cleanup()
				db, err := createTempLevelDbForTest(&tc, &td)
				require.NoError(t, err)

				// have something in the DB
				key, err := testLevelDbPut(db)
				require.NoError(t, err)

				tr, err := db.OpenTransaction()
				require.NoError(t, err)
				err = tr.Delete(key)
				require.NoError(t, err)
				tr.Discard()

				_, found, err := db.Get(key)
				require.NoError(t, err)
				require.True(t, found)
			},
		},
	}

	for _, test := range tests {
		if !t.Run(test.name, test.testBody) {
			t.Fail() // mark as failed but continue with next test
		}
	}

	td.teardown()
}
