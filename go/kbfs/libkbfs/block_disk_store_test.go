// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupBlockDiskStoreTest(t *testing.T) (tempdir string, s *blockDiskStore) {
	codec := kbfscodec.NewMsgpack()

	tempdir, err := ioutil.TempDir(os.TempDir(), "block_disk_store")
	require.NoError(t, err)

	s = makeBlockDiskStore(codec, tempdir)
	return tempdir, s
}

func teardownBlockDiskStoreTest(t *testing.T, tempdir string) {
	err := ioutil.RemoveAll(tempdir)
	assert.NoError(t, err)
}

func putBlockDisk(
	ctx context.Context, t *testing.T, s *blockDiskStore, data []byte) (
	kbfsblock.ID, kbfsblock.Context, kbfscrypto.BlockCryptKeyServerHalf) {
	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	bCtx := kbfsblock.MakeFirstContext(
		uid1.AsUserOrTeam(), keybase1.BlockType_DATA)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	didPut, err := s.put(ctx, true, bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	err = s.addReference(ctx, bID, bCtx, "tag")
	require.NoError(t, err)
	require.True(t, didPut)

	return bID, bCtx, serverHalf
}

func addBlockDiskRef(
	ctx context.Context, t *testing.T, s *blockDiskStore,
	bID kbfsblock.ID) kbfsblock.Context {
	nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	bCtx2 := kbfsblock.MakeContext(
		uid1.AsUserOrTeam(), uid2.AsUserOrTeam(), nonce,
		keybase1.BlockType_DATA)
	err = s.addReference(ctx, bID, bCtx2, "")
	require.NoError(t, err)
	return bCtx2
}

func getAndCheckBlockDiskData(
	ctx context.Context, t *testing.T, s *blockDiskStore,
	bID kbfsblock.ID, bCtx kbfsblock.Context, expectedData []byte,
	expectedServerHalf kbfscrypto.BlockCryptKeyServerHalf) {
	data, serverHalf, err := s.getDataWithContext(ctx, bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, expectedData, data)
	require.Equal(t, expectedServerHalf, serverHalf)
}

func TestBlockDiskStoreBasic(t *testing.T) {
	tempdir, s := setupBlockDiskStoreTest(t)
	defer teardownBlockDiskStoreTest(t, tempdir)
	ctx := context.Background()

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockDisk(ctx, t, s, data)

	// Make sure we get the same block back.
	getAndCheckBlockDiskData(ctx, t, s, bID, bCtx, data, serverHalf)

	// Add a reference.
	bCtx2 := addBlockDiskRef(ctx, t, s, bID)

	// Make sure we get the same block via that reference.
	getAndCheckBlockDiskData(ctx, t, s, bID, bCtx2, data, serverHalf)

	// Shutdown and restart.
	s = makeBlockDiskStore(s.codec, tempdir)

	// Make sure we get the same block for both refs.

	getAndCheckBlockDiskData(ctx, t, s, bID, bCtx, data, serverHalf)
	getAndCheckBlockDiskData(ctx, t, s, bID, bCtx2, data, serverHalf)
}

func TestBlockDiskStoreAddReference(t *testing.T) {
	tempdir, s := setupBlockDiskStoreTest(t)
	defer teardownBlockDiskStoreTest(t, tempdir)
	ctx := context.Background()

	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	// Add a reference, which should succeed.
	bCtx := addBlockDiskRef(ctx, t, s, bID)

	// Of course, the block get should still fail.
	_, _, err = s.getDataWithContext(ctx, bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)
}

func TestBlockDiskStoreArchiveReferences(t *testing.T) {
	tempdir, s := setupBlockDiskStoreTest(t)
	defer teardownBlockDiskStoreTest(t, tempdir)
	ctx := context.Background()

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockDisk(ctx, t, s, data)

	// Add a reference.
	bCtx2 := addBlockDiskRef(ctx, t, s, bID)

	// Archive references.
	err := s.archiveReferences(
		ctx, kbfsblock.ContextMap{bID: {bCtx, bCtx2}}, "")
	require.NoError(t, err)

	// Get block should still succeed.
	getAndCheckBlockDiskData(ctx, t, s, bID, bCtx, data, serverHalf)
}

func TestBlockDiskStoreArchiveNonExistentReference(t *testing.T) {
	tempdir, s := setupBlockDiskStoreTest(t)
	defer teardownBlockDiskStoreTest(t, tempdir)
	ctx := context.Background()

	uid1 := keybase1.MakeTestUID(1)

	bCtx := kbfsblock.MakeFirstContext(
		uid1.AsUserOrTeam(), keybase1.BlockType_DATA)

	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	// Archive references.
	err = s.archiveReferences(ctx, kbfsblock.ContextMap{bID: {bCtx}}, "")
	require.NoError(t, err)
}

func TestBlockDiskStoreRemoveReferences(t *testing.T) {
	tempdir, s := setupBlockDiskStoreTest(t)
	defer teardownBlockDiskStoreTest(t, tempdir)
	ctx := context.Background()

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockDisk(ctx, t, s, data)

	// Add a reference.
	bCtx2 := addBlockDiskRef(ctx, t, s, bID)

	// Remove references.
	liveCount, err := s.removeReferences(
		ctx, bID, []kbfsblock.Context{bCtx, bCtx2}, "")
	require.NoError(t, err)
	require.Equal(t, 0, liveCount)

	// Make sure the block data is inaccessible.
	_, _, err = s.getDataWithContext(ctx, bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)

	// But the actual data should remain.
	buf, half, err := s.getData(ctx, bID)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, half)
}

func TestBlockDiskStoreRemove(t *testing.T) {
	tempdir, s := setupBlockDiskStoreTest(t)
	defer teardownBlockDiskStoreTest(t, tempdir)
	ctx := context.Background()

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, _ := putBlockDisk(ctx, t, s, data)

	// Should not be removable.
	err := s.remove(ctx, bID)
	require.Error(t, err, "Trying to remove data")

	// Remove reference.
	liveCount, err := s.removeReferences(
		ctx, bID, []kbfsblock.Context{bCtx}, "")
	require.NoError(t, err)
	require.Equal(t, 0, liveCount)

	// Should now be removable.
	err = s.remove(ctx, bID)
	require.NoError(t, err)

	_, _, err = s.getData(ctx, bID)
	require.Equal(t, blockNonExistentError{bID}, err)

	err = filepath.Walk(s.dir,
		func(path string, info os.FileInfo, _ error) error {
			// We should only find the blocks directory here.
			if path != s.dir {
				t.Errorf("Found unexpected block path: %s", path)
			}
			return nil
		})
	require.NoError(t, err)
}
