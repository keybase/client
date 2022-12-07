// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

func newIndexedTlfDbForTestWithStorage(
	t *testing.T, tlfS storage.Storage) *IndexedTlfDb {
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	db, err := newIndexedTlfDbFromStorage(config, tlfS)
	require.NoError(t, err)
	return db
}

func newIndexedTlfDbForTest(t *testing.T) (
	*IndexedTlfDb, string) {
	// Use a disk-based level, instead of memory storage, because we
	// want to simulate a restart and memory storages can't be reused.
	tempdir, err := os.MkdirTemp(os.TempDir(), "indexed_tlfs_db")
	require.NoError(t, err)
	tlfS, err := storage.OpenFile(filepath.Join(tempdir, "tlfs"), false)
	require.NoError(t, err)

	db := newIndexedTlfDbForTestWithStorage(t, tlfS)
	return db, tempdir
}

func shutdownIndexedTlfDbTest(db *IndexedTlfDb, tempdir string) {
	db.Shutdown(context.Background())
	os.RemoveAll(tempdir)
}

func TestIndexedTlfDbCreate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	defer func() {
		err := config.Shutdown(context.Background())
		require.NoError(t, err)
	}()

	tempdir, err := os.MkdirTemp(os.TempDir(), "indexed_tlfs_db")
	require.NoError(t, err)
	db, err := newIndexedTlfDb(config, tempdir)
	require.NoError(t, err)
	shutdownIndexedTlfDbTest(db, tempdir)
}

func TestIndexedTlfDb(t *testing.T) {
	t.Skip() // TRIAGE-1674
	t.Parallel()
	t.Log("Test that indexed TLF db Put and Get operations work.")
	db, tempdir := newIndexedTlfDbForTest(t)
	defer func() {
		shutdownIndexedTlfDbTest(db, tempdir)
	}()

	ctx := context.Background()
	tlfID1 := tlf.FakeID(1, tlf.Private)
	ir1 := kbfsmd.Revision(50)
	sr1 := kbfsmd.RevisionUninitialized

	t.Log("Put TLF MD into the db.")
	_, _, err := db.Get(ctx, tlfID1)
	require.Error(t, err) // not in db yet
	err = db.Put(ctx, tlfID1, ir1, sr1)
	require.NoError(t, err)

	t.Log("Get TLF MD from the db.")
	getIR1, getSR1, err := db.Get(ctx, tlfID1)
	require.NoError(t, err)
	checkWrite := func(
		expectedIR, ir, expectedSR, sr kbfsmd.Revision) {
		require.Equal(t, expectedIR, ir)
		require.Equal(t, expectedSR, sr)
	}
	checkWrite(ir1, getIR1, sr1, getSR1)

	t.Log("A second entry.")
	tlfID2 := tlf.FakeID(2, tlf.Private)
	ir2 := kbfsmd.Revision(500)
	sr2 := kbfsmd.Revision(600)

	err = db.Put(ctx, tlfID2, ir2, sr2)
	require.NoError(t, err)
	getIR2, getSR2, err := db.Get(ctx, tlfID2)
	require.NoError(t, err)
	checkWrite(ir2, getIR2, sr2, getSR2)

	t.Log("Override the first block with new start revision")
	sr1 = kbfsmd.Revision(60)
	err = db.Put(ctx, tlfID1, ir1, sr1)
	require.NoError(t, err)
	getIR1, getSR1, err = db.Get(ctx, tlfID1)
	require.NoError(t, err)
	checkWrite(ir1, getIR1, sr1, getSR1)

	t.Log("Restart the db and check the MD")
	db.Shutdown(ctx)
	tlfS, err := storage.OpenFile(filepath.Join(tempdir, "tlfs"), false)
	require.NoError(t, err)
	db = newIndexedTlfDbForTestWithStorage(t, tlfS)
	getIR1, getSR1, err = db.Get(ctx, tlfID1)
	require.NoError(t, err)
	checkWrite(ir1, getIR1, sr1, getSR1)
	getIR2, getSR2, err = db.Get(ctx, tlfID2)
	require.NoError(t, err)
	checkWrite(ir2, getIR2, sr2, getSR2)
}
