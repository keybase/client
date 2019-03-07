// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
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
	dir, err := ioutil.TempDir("", "level-db-test-")
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
	dir, err := ioutil.TempDir("", "level-db-test-")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(filepath.Join(dir, "some-io"), []byte("O_O"), 0666)
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
				go db.doWhileOpenAndNukeIfCorrupted(func() error {
					defer wg.Done()
					select {
					case <-time.After(8 * time.Second):
						t.Error("doWhileOpenAndNukeIfCorrupted is not concurrent")
					case <-ch:
					}
					return nil
				})
				go db.doWhileOpenAndNukeIfCorrupted(func() error {
					defer wg.Done()
					select {
					case <-time.After(8 * time.Second):
						t.Error("doWhileOpenAndNukeIfCorrupted does not support concurrent ops")
					case ch <- struct{}{}:
					}
					return nil
				})
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
						t.Errorf("timeout")
					case chOpen <- struct{}{}:
					}

					if err = tr.Put(key, nil, []byte{41}); err != nil {
						t.Error(err)
					}

					// We do some IO here to give Go's runtime a chance to schedule
					// different routines and channel operations, to *hopefully* make
					// sure:
					// 1) The channel operation is done;
					// 2) If there exists, any broken OpenTransaction() implementation
					//		that does not block until this transaction finishes, the broken
					//		OpenTransaction() would have has returned
					if err = doSomeIO(); err != nil {
						t.Error(err)
					}

					// we send to a buffered channel right before Commit() to make sure
					// the channel is ready to read right after the commit
					chCommitted <- struct{}{}

					if err = tr.Commit(); err != nil {
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

					if err = tr.Put(key, nil, []byte{d[0] + 1}); err != nil {
						t.Error(err)
					}
					if err = tr.Commit(); err != nil {
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
