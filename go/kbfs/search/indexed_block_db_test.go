// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

func newIndexedBlockDbForTestWithStorage(
	t *testing.T, blockS, tlfS storage.Storage) (db *IndexedBlockDb, done func()) {
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	db, err := newIndexedBlockDbFromStorage(config, blockS, tlfS)
	require.NoError(t, err)
	return db, func() { _ = config.Shutdown(context.Background()) }
}

func newIndexedBlockDbForTest(t *testing.T) (
	db *IndexedBlockDb, tempdir string, done func()) {
	// Use a disk-based level, instead of memory storage, because we
	// want to simulate a restart and memory storages can't be reused.
	tempdir, err := os.MkdirTemp(os.TempDir(), "indexed_blocks_db")
	require.NoError(t, err)
	blockS, err := storage.OpenFile(filepath.Join(tempdir, "blocks"), false)
	require.NoError(t, err)
	tlfS, err := storage.OpenFile(filepath.Join(tempdir, "tlf"), false)
	require.NoError(t, err)

	db, done = newIndexedBlockDbForTestWithStorage(t, blockS, tlfS)
	return db, tempdir, done
}

func shutdownIndexedBlockDbTest(db *IndexedBlockDb, tempdir string) {
	db.Shutdown(context.Background())
	os.RemoveAll(tempdir)
}

func TestIndexedBlockDbCreate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	defer func() {
		err := config.Shutdown(context.Background())
		require.NoError(t, err)
	}()
	tempdir, err := os.MkdirTemp(os.TempDir(), "indexed_blocks_db")
	require.NoError(t, err)
	db, err := newIndexedBlockDb(config, tempdir)
	require.NoError(t, err)
	shutdownIndexedBlockDbTest(db, tempdir)
}

func TestIndexedBlockDb(t *testing.T) {
	t.Parallel()
	t.Log("Test that indexed block db Put and Get operations work.")
	db, tempdir, done := newIndexedBlockDbForTest(t)
	defer func() {
		shutdownIndexedBlockDbTest(db, tempdir)
		done()
	}()

	ctx := context.Background()
	tlfID := tlf.FakeID(1, tlf.Private)

	id1, err := kbfsblock.MakeTemporaryID()
	require.NoError(t, err)
	ptr1 := data.BlockPointer{
		ID:      id1,
		KeyGen:  kbfsmd.FirstValidKeyGen,
		DataVer: 1,
	}
	ver1 := uint64(1)
	docID1 := "1"
	dirDone1 := false

	t.Log("Put block MD into the db.")
	_, _, _, err = db.Get(ctx, ptr1)
	require.Error(t, err) // not dbd yet
	err = db.Put(ctx, tlfID, ptr1, ver1, docID1, dirDone1)
	require.NoError(t, err)

	t.Log("Get block MD from the db.")
	getVer1, getDocID1, getDirDone1, err := db.Get(ctx, ptr1)
	require.NoError(t, err)
	checkWrite := func(
		expectedVer, ver uint64, expectedDocID, docID string,
		expectedDirDone, dirDone bool) {
		require.Equal(t, expectedVer, ver)
		require.Equal(t, expectedDocID, docID)
		require.Equal(t, expectedDirDone, dirDone)
	}
	checkWrite(ver1, getVer1, docID1, getDocID1, dirDone1, getDirDone1)

	t.Log("A second entry.")
	id2, err := kbfsblock.MakeTemporaryID()
	require.NoError(t, err)
	ptr2 := data.BlockPointer{
		ID:      id2,
		KeyGen:  kbfsmd.FirstValidKeyGen,
		DataVer: 1,
	}
	ver2 := uint64(1)
	docID2 := "2"
	dirDone2 := true

	err = db.Put(ctx, tlfID, ptr2, ver2, docID2, dirDone2)
	require.NoError(t, err)
	getVer2, getDocID2, getDirDone2, err := db.Get(ctx, ptr2)
	require.NoError(t, err)
	checkWrite(ver2, getVer2, docID2, getDocID2, dirDone2, getDirDone2)

	t.Log("Override the first block with new version.")
	ver1 = 2
	err = db.Put(ctx, tlfID, ptr1, ver1, docID1, dirDone1)
	require.NoError(t, err)
	getVer1, getDocID1, getDirDone1, err = db.Get(ctx, ptr1)
	require.NoError(t, err)
	checkWrite(ver1, getVer1, docID1, getDocID1, dirDone1, getDirDone1)

	t.Log("Add a pointer with the same ID, but a non-zero ref nonce")
	nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)
	ptr3 := data.BlockPointer{
		ID:      id2,
		KeyGen:  kbfsmd.FirstValidKeyGen,
		DataVer: 1,
		Context: kbfsblock.Context{
			RefNonce: nonce,
		},
	}
	ver3 := uint64(1)
	docID3 := "3"
	dirDone3 := false
	err = db.Put(ctx, tlfID, ptr3, ver3, docID3, dirDone3)
	require.NoError(t, err)
	getVer3, getDocID3, getDirDone3, err := db.Get(ctx, ptr3)
	require.NoError(t, err)
	checkWrite(ver3, getVer3, docID3, getDocID3, dirDone3, getDirDone3)
	getVer2, getDocID2, getDirDone2, err = db.Get(ctx, ptr2)
	require.NoError(t, err)
	checkWrite(ver2, getVer2, docID2, getDocID2, dirDone2, getDirDone2)

	t.Log("Get new doc IDs")
	res, err := db.GetNextDocIDs(11)
	require.NoError(t, err)
	require.Len(t, res, 11)
	require.Equal(t, "1", res[0])
	require.Equal(t, "b", res[10])

	t.Log("Restart the db and check the MD")
	db.Shutdown(ctx)
	blockS, err := storage.OpenFile(filepath.Join(tempdir, "blocks"), false)
	require.NoError(t, err)
	tlfS, err := storage.OpenFile(filepath.Join(tempdir, "tlfs"), false)
	require.NoError(t, err)
	db, done2 := newIndexedBlockDbForTestWithStorage(t, blockS, tlfS)
	defer done2()
	getVer1, getDocID1, getDirDone1, err = db.Get(ctx, ptr1)
	require.NoError(t, err)
	checkWrite(ver1, getVer1, docID1, getDocID1, dirDone1, getDirDone1)
	getVer2, getDocID2, getDirDone2, err = db.Get(ctx, ptr2)
	require.NoError(t, err)
	checkWrite(ver2, getVer2, docID2, getDocID2, dirDone2, getDirDone2)
	getVer3, getDocID3, getDirDone3, err = db.Get(ctx, ptr3)
	require.NoError(t, err)
	checkWrite(ver3, getVer3, docID3, getDocID3, dirDone3, getDirDone3)
	res, err = db.GetNextDocIDs(1)
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "c", res[0])
}
