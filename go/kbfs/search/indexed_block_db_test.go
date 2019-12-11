// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"io/ioutil"
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
	t *testing.T, blockS, tlfS storage.Storage) *IndexedBlockDb {
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	cache, err := newIndexedBlockDbFromStorage(config, blockS, tlfS)
	require.NoError(t, err)
	return cache
}

func newIndexedBlockDbForTest(t *testing.T) (
	*IndexedBlockDb, string) {
	// Use a disk-based level, instead of memory storage, because we
	// want to simulate a restart and memory storages can't be reused.
	tempdir, err := ioutil.TempDir(os.TempDir(), "indexed_blocks_db")
	require.NoError(t, err)
	blockS, err := storage.OpenFile(filepath.Join(tempdir, "blocks"), false)
	require.NoError(t, err)
	tlfS, err := storage.OpenFile(filepath.Join(tempdir, "tlf"), false)
	require.NoError(t, err)

	cache := newIndexedBlockDbForTestWithStorage(t, blockS, tlfS)
	return cache, tempdir
}

func shutdownIndexedBlockDbTest(cache *IndexedBlockDb, tempdir string) {
	cache.Shutdown(context.Background())
	os.RemoveAll(tempdir)
}

func TestINdexedBlockDbCreate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	tempdir, err := ioutil.TempDir(os.TempDir(), "indexed_blocks_db")
	require.NoError(t, err)
	cache, err := newIndexedBlockDb(config, tempdir)
	require.NoError(t, err)
	shutdownIndexedBlockDbTest(cache, tempdir)
}

func TestIndexedBlockDb(t *testing.T) {
	t.Parallel()
	t.Log("Test that indexed block db Put and Get operations work.")
	cache, tempdir := newIndexedBlockDbForTest(t)
	defer func() {
		shutdownIndexedBlockDbTest(cache, tempdir)
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
	ver1 := uint(1)
	docID1 := "1"

	t.Log("Put block MD into the cache.")
	_, _, err = cache.Get(ctx, ptr1)
	require.Error(t, err) // not cached yet
	err = cache.Put(ctx, tlfID, ptr1, ver1, docID1)
	require.NoError(t, err)

	t.Log("Get block MD from the cache.")
	getVer1, getDocID1, err := cache.Get(ctx, ptr1)
	require.NoError(t, err)
	checkWrite := func(expectedVer, ver uint, expectedDocID, docID string) {
		require.Equal(t, expectedVer, ver)
		require.Equal(t, expectedDocID, docID)
	}
	checkWrite(ver1, getVer1, docID1, getDocID1)

	t.Log("A second entry.")
	id2, err := kbfsblock.MakeTemporaryID()
	require.NoError(t, err)
	ptr2 := data.BlockPointer{
		ID:      id2,
		KeyGen:  kbfsmd.FirstValidKeyGen,
		DataVer: 1,
	}
	ver2 := uint(1)
	docID2 := "2"

	err = cache.Put(ctx, tlfID, ptr2, ver2, docID2)
	require.NoError(t, err)
	getVer2, getDocID2, err := cache.Get(ctx, ptr2)
	require.NoError(t, err)
	checkWrite(ver2, getVer2, docID2, getDocID2)

	t.Log("Override the first block with new version.")
	ver1 = 2
	err = cache.Put(ctx, tlfID, ptr1, ver1, docID1)
	require.NoError(t, err)
	getVer1, getDocID1, err = cache.Get(ctx, ptr1)
	require.NoError(t, err)
	checkWrite(ver1, getVer1, docID1, getDocID1)

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
	ver3 := uint(1)
	docID3 := "3"
	err = cache.Put(ctx, tlfID, ptr3, ver3, docID3)
	require.NoError(t, err)
	getVer3, getDocID3, err := cache.Get(ctx, ptr3)
	require.NoError(t, err)
	checkWrite(ver3, getVer3, docID3, getDocID3)
	getVer2, getDocID2, err = cache.Get(ctx, ptr2)
	require.NoError(t, err)
	checkWrite(ver2, getVer2, docID2, getDocID2)

	t.Log("Restart the cache and check the MD")
	cache.Shutdown(ctx)
	blockS, err := storage.OpenFile(filepath.Join(tempdir, "blocks"), false)
	require.NoError(t, err)
	tlfS, err := storage.OpenFile(filepath.Join(tempdir, "tlfs"), false)
	require.NoError(t, err)
	cache = newIndexedBlockDbForTestWithStorage(t, blockS, tlfS)
	getVer1, getDocID1, err = cache.Get(ctx, ptr1)
	require.NoError(t, err)
	checkWrite(ver1, getVer1, docID1, getDocID1)
	getVer2, getDocID2, err = cache.Get(ctx, ptr2)
	require.NoError(t, err)
	checkWrite(ver2, getVer2, docID2, getDocID2)
	getVer3, getDocID3, err = cache.Get(ctx, ptr3)
	require.NoError(t, err)
	checkWrite(ver3, getVer3, docID3, getDocID3)
}
