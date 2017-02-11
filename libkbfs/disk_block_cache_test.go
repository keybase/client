// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

const (
	testDiskBlockCacheMaxBytes uint64 = 1 << 20
)

type testDiskBlockCacheConfig struct {
	codecGetter
	logMaker
}

func newTestDiskBlockCacheConfig(t *testing.T) testDiskBlockCacheConfig {
	return testDiskBlockCacheConfig{
		newTestCodecGetter(),
		newTestLogMaker(t),
	}
}

func newDiskBlockCacheStandardForTest(config diskBlockCacheConfig,
	maxBytes uint64) (*DiskBlockCacheStandard, error) {
	blockStorage := storage.NewMemStorage()
	lruStorage := storage.NewMemStorage()
	return newDiskBlockCacheStandardFromStorage(config, blockStorage,
		lruStorage, maxBytes)
}

func initDiskBlockCacheTest(t *testing.T) (*DiskBlockCacheStandard,
	testDiskBlockCacheConfig) {
	config := newTestDiskBlockCacheConfig(t)
	cache, err := newDiskBlockCacheStandardForTest(config,
		testDiskBlockCacheMaxBytes)
	require.NoError(t, err)
	return cache, config
}

func shutdownDiskBlockCacheTest(cache DiskBlockCache) {
	cache.Shutdown()
}

func setupBlockForDiskCache(t *testing.T, config diskBlockCacheConfig) (
	kbfsblock.ID, []byte, kbfscrypto.BlockCryptKeyServerHalf) {
	ptr := makeRandomBlockPointer(t)
	block := makeFakeFileBlock(t, false)
	blockEncoded, err := config.Codec().Encode(block)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	return ptr.ID, blockEncoded, serverHalf
}

func TestDiskBlockCachePutAndGet(t *testing.T) {
	t.Parallel()
	t.Log("Test that basic disk cache Put and Get operations work.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	tlf1 := tlf.FakeID(0, false)
	block1Id, block1Encoded, block1ServerHalf := setupBlockForDiskCache(t, config)

	ctx := context.Background()

	t.Log("Put a block into the cache.")
	err := cache.Put(ctx, tlf1, block1Id, block1Encoded, block1ServerHalf)
	require.NoError(t, err)
	putTime, err := cache.getLru(tlf1, block1Id)
	require.NoError(t, err)

	t.Log("Get that block from the cache. Verify that it's the same.")
	buf, serverHalf, err := cache.Get(ctx, tlf1, block1Id)
	require.NoError(t, err)
	require.Equal(t, block1ServerHalf, serverHalf)
	require.Equal(t, block1Encoded, buf)

	t.Log("Verify that the Get updated the LRU time for the block.")
	getTime, err := cache.getLru(tlf1, block1Id)
	require.NoError(t, err)
	require.True(t, getTime.After(putTime))

	t.Log("Attempt to Get a block from the cache that isn't there." +
		" Verify that it fails.")
	ptr2 := makeRandomBlockPointer(t)
	buf, serverHalf, err = cache.Get(ctx, tlf1, ptr2.ID)
	require.EqualError(t, err, NoSuchBlockError{ptr2.ID}.Error())
	require.Equal(t, kbfscrypto.BlockCryptKeyServerHalf{}, serverHalf)
	require.Nil(t, buf)

	t.Log("Verify that the cache returns no LRU time for the missing block.")
	_, err = cache.getLru(tlf1, ptr2.ID)
	require.EqualError(t, err, errors.ErrNotFound.Error())
}

func TestDiskBlockCacheDelete(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache deletion works.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	tlf1 := tlf.FakeID(0, false)
	block1Id, block1Encoded, block1ServerHalf := setupBlockForDiskCache(t, config)
	block2Id, block2Encoded, block2ServerHalf := setupBlockForDiskCache(t, config)
	block3Id, block3Encoded, block3ServerHalf := setupBlockForDiskCache(t, config)

	ctx := context.Background()

	t.Log("Put three blocks into the cache.")
	err := cache.Put(ctx, tlf1, block1Id, block1Encoded, block1ServerHalf)
	require.NoError(t, err)
	err = cache.Put(ctx, tlf1, block2Id, block2Encoded, block2ServerHalf)
	require.NoError(t, err)
	err = cache.Put(ctx, tlf1, block3Id, block3Encoded, block3ServerHalf)
	require.NoError(t, err)

	t.Log("Delete two of the blocks from the cache.")
	err = cache.Delete(ctx, tlf1, []kbfsblock.ID{
		block1Id, block2Id})
	require.NoError(t, err)

	t.Log("Verify that only the non-deleted block is still in the cache.")
	_, _, err = cache.Get(ctx, tlf1, block1Id)
	require.EqualError(t, err, NoSuchBlockError{block1Id}.Error())
	_, _, err = cache.Get(ctx, tlf1, block2Id)
	require.EqualError(t, err, NoSuchBlockError{block2Id}.Error())
	_, _, err = cache.Get(ctx, tlf1, block3Id)
	require.NoError(t, err)

	t.Log("Verify that the cache returns no LRU time for the missing blocks.")
	_, err = cache.getLru(tlf1, block1Id)
	require.EqualError(t, err, errors.ErrNotFound.Error())
	_, err = cache.getLru(tlf1, block2Id)
	require.EqualError(t, err, errors.ErrNotFound.Error())
}
