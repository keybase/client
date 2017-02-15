// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
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
	*testClockGetter
}

func newTestDiskBlockCacheConfig(t *testing.T) testDiskBlockCacheConfig {
	return testDiskBlockCacheConfig{
		newTestCodecGetter(),
		newTestLogMaker(t),
		newTestClockGetter(),
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
	cache.Shutdown(context.Background())
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
	putTime, err := cache.getLRU(tlf1, block1Id)
	require.NoError(t, err)
	config.TestClock().Add(time.Second)

	t.Log("Get that block from the cache. Verify that it's the same.")
	buf, serverHalf, err := cache.Get(ctx, tlf1, block1Id)
	require.NoError(t, err)
	require.Equal(t, block1ServerHalf, serverHalf)
	require.Equal(t, block1Encoded, buf)

	t.Log("Verify that the Get updated the LRU time for the block.")
	getTime, err := cache.getLRU(tlf1, block1Id)
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
	_, err = cache.getLRU(tlf1, ptr2.ID)
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
	_, err = cache.getLRU(tlf1, block1Id)
	require.EqualError(t, err, errors.ErrNotFound.Error())
	_, err = cache.getLRU(tlf1, block2Id)
	require.EqualError(t, err, errors.ErrNotFound.Error())
}

func TestDiskBlockCacheEvict(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache eviction works.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	tlf1 := tlf.FakeID(0, false)
	ctx := context.Background()
	clock := config.TestClock()
	initialTime := clock.Now()
	t.Log("Put 100 blocks into the cache.")
	cache.log = logger.NewNull()
	for i := 0; i < 100; i++ {
		blockId, blockEncoded, serverHalf := setupBlockForDiskCache(t, config)
		err := cache.Put(ctx, tlf1, blockId, blockEncoded, serverHalf)
		require.NoError(t, err)
		clock.Add(time.Second)
	}

	previousAvgDuration := 50 * time.Second
	averageDifference := float64(0)

	t.Log("Incrementally evict all the blocks in the cache.")
	// Because the eviction algorithm is probabilistic, we can't rely on the
	// same number of blocks being evicted every time. So we have to be smart
	// about our measurement assertions.
	for i := 1; i <= 10; i++ {
		t.Log("Evict 10 blocks from the cache.")
		numRemoved, err := cache.evictLocked(ctx, tlf1, 10)
		require.NoError(t, err)
		require.Equal(t, 10, numRemoved)

		expectedCount := int64(100 - (10 * i))
		t.Logf("Verify that there are %d blocks in the cache.", expectedCount)
		iter := cache.lruDb.NewIterator(nil, nil)
		defer iter.Release()
		blockCount := int64(0)
		var avgDuration time.Duration
		for iter.Next() {
			putTime, err := cache.timeFromBytes(iter.Value())
			duration := putTime.Sub(initialTime)
			avgDuration += duration
			require.NoError(t, err)
			blockCount++
		}
		require.Equal(t, expectedCount, blockCount)
		if expectedCount > 0 {
			avgDuration /= time.Duration(expectedCount)
			t.Logf("Average LRU time of remaining blocks: %.2f",
				avgDuration.Seconds())
			averageDifference += avgDuration.Seconds() -
				previousAvgDuration.Seconds()
			previousAvgDuration = avgDuration
		}
	}
	averageDifference /= 9.0
	t.Logf("Average overall LRU delta: %.2f", averageDifference)
	require.True(t, averageDifference > 3.0)
}
