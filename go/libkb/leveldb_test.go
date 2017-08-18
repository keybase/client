// Copyright 2017 Keybase. Inc. All rights reserved. Use of
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
				db, err := createTempLevelDbForTest(&tc, &td)
				if err != nil {
					t.Fatal(err)
				}

				key, err := testLevelDbPut(db)
				if err != nil {
					t.Fatal(err)
				}

				if err = db.Delete(key); err != nil {
					t.Fatal(err)
				}
				_, found, err := db.Get(key)
				if err != nil {
					t.Fatal(err)
				}
				if found {
					t.Fatalf("delete did not delete object")
				}
			},
		},
		{
			name: "concurrent", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-concurrent", 0)
				db, err := createTempLevelDbForTest(&tc, &td)
				if err != nil {
					t.Fatal(err)
				}

				var wg sync.WaitGroup
				wg.Add(2)
				// synchronize between two doWhileOpenAndNukeIfCorrupted calls to know
				// for sure they can happen concurrently.
				ch := make(chan struct{})
				go db.doWhileOpenAndNukeIfCorrupted(func() error {
					defer wg.Done()
					select {
					case <-time.After(8 * time.Second):
						t.Fatalf("doWhileOpenAndNukeIfCorrupted is not concurrent")
					case <-ch:
					}
					return nil
				})
				go db.doWhileOpenAndNukeIfCorrupted(func() error {
					defer wg.Done()
					select {
					case <-time.After(8 * time.Second):
						t.Fatalf("doWhileOpenAndNukeIfCorrupted does not support concurrent ops")
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
				db, err := createTempLevelDbForTest(&tc, &td)
				if err != nil {
					t.Fatal(err)
				}

				key, err := testLevelDbPut(db)
				if err != nil {
					t.Fatal(err)
				}

				if _, err := db.Nuke(); err != nil {
					t.Fatal(err)
				}
				if _, found, err := db.Get(key); err != nil {
					t.Fatal(err)
				} else if found {
					t.Fatalf("nuking failed")
				}

				// make sure db still works after nuking
				if _, err = testLevelDbPut(db); err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			name: "use-after-close", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-use-after-close", 0)
				db, err := createTempLevelDbForTest(&tc, &td)
				if err != nil {
					t.Fatal(err)
				}

				// not closed yet; should be good
				if _, err = testLevelDbPut(db); err != nil {
					t.Fatal(err)
				}

				if err = db.Close(); err != nil {
					t.Fatal(err)
				}

				if _, err = testLevelDbPut(db); err == nil {
					t.Fatalf("use after close did not error")
				}

				if err = db.ForceOpen(); err == nil {
					t.Fatalf("use after close did not error")
				}
			},
		},
		{
			name: "transactions", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-transactions", 0)
				db, err := createTempLevelDbForTest(&tc, &td)
				if err != nil {
					t.Fatal(err)
				}

				// have something in the DB
				key, err := testLevelDbPut(db)
				if err != nil {
					t.Fatal(err)
				}

				var wg sync.WaitGroup
				wg.Add(2)

				// channels for communicating from first routine to 2nd.
				chOpen := make(chan struct{})
				chCommitted := make(chan struct{}, 1)

				go func() {
					defer wg.Done()

					tr, err := db.OpenTransaction()
					if err != nil {
						fmt.Println(err)
						t.Fatal(err)
					}

					select {
					case <-time.After(8 * time.Second):
						t.Fatalf("timeout")
					case chOpen <- struct{}{}:
					}

					if err = tr.Put(key, nil, []byte{41}); err != nil {
						t.Fatal(err)
					}

					// We do some IO here to give Go's runtime a chance to schedule
					// different routines and channel operations, to *hopefully* make
					// sure:
					// 1) The channel operation is done;
					// 2) If there exists, any broken OpenTransaction() implementation
					//		that does not block until this transaction finishes, the broken
					//		OpenTransaction() would have has returned
					if err = doSomeIO(); err != nil {
						t.Fatal(err)
					}

					// we send to a buffered channel right before Commit() to make sure
					// the channel is ready to read right after the commit
					chCommitted <- struct{}{}

					if err = tr.Commit(); err != nil {
						t.Fatal(err)
					}

				}()

				go func() {
					defer wg.Done()

					// wait until the other transaction has opened
					select {
					case <-time.After(8 * time.Second):
						t.Fatalf("timeout")
					case <-chOpen:
					}

					tr, err := db.OpenTransaction()
					select {
					case <-chCommitted:
						// fine
					default:
						t.Fatalf("second transaction did not block until first one finished")
					}
					if err != nil {
						t.Fatal(err)
					}

					d, found, err := tr.Get(key)
					if err != nil {
						t.Fatal(err)
					}
					if !found {
						t.Fatalf("key %v is not found", found)
					}

					if err = tr.Put(key, nil, []byte{d[0] + 1}); err != nil {
						t.Fatal(err)
					}
					if err = tr.Commit(); err != nil {
						t.Fatal(err)
					}
				}()

				wg.Wait()

				data, found, err := db.Get(key)
				if err != nil {
					t.Fatal(err)
				}
				if !found {
					t.Fatalf("key %v is not found", found)
				}
				if len(data) != 1 || data[0] != 42 {
					t.Fatalf("incorrect data after transaction. expected 42, got %d", data[0])
				}
			},
		},
		{
			name: "transaction-discard", testBody: func(t *testing.T) {
				tc := SetupTest(t, "LevelDb-transaction-discard", 0)
				db, err := createTempLevelDbForTest(&tc, &td)
				if err != nil {
					t.Fatal(err)
				}

				// have something in the DB
				key, err := testLevelDbPut(db)
				if err != nil {
					t.Fatal(err)
				}

				tr, err := db.OpenTransaction()
				if err != nil {
					t.Fatal(err)
				}
				if err = tr.Delete(key); err != nil {
					t.Fatal(err)
				}
				tr.Discard()

				_, found, err := db.Get(key)
				if err != nil {
					t.Fatal(err)
				}
				if !found {
					t.Fatalf("discarded transaction was committed?")
				}
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
