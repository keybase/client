// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"math/rand"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

const (
	testDiskBlockCacheMaxBytes int64 = 1 << 21
)

type testDiskBlockCacheConfig struct {
	codecGetter
	logMaker
	*testClockGetter
	limiter DiskLimiter
	syncedTlfGetterSetter
	initModeGetter
	bcache data.BlockCache
}

func newTestDiskBlockCacheConfig(t *testing.T) *testDiskBlockCacheConfig {
	return &testDiskBlockCacheConfig{
		newTestCodecGetter(),
		newTestLogMaker(t),
		newTestClockGetter(),
		nil,
		newTestSyncedTlfGetterSetter(),
		testInitModeGetter{InitDefault},
		data.NewBlockCacheStandard(100, 100),
	}
}

func (c testDiskBlockCacheConfig) DiskLimiter() DiskLimiter {
	return c.limiter
}

func (c testDiskBlockCacheConfig) BlockCache() data.BlockCache {
	return c.bcache
}

func newDiskBlockCacheForTest(config *testDiskBlockCacheConfig,
	maxBytes int64) (*diskBlockCacheWrapped, error) {
	maxFiles := int64(10000)
	workingSetCache, err := newDiskBlockCacheLocalForTest(config,
		workingSetCacheLimitTrackerType)
	if err != nil {
		return nil, err
	}
	syncCache, err := newDiskBlockCacheLocalForTest(
		config, syncCacheLimitTrackerType)
	if err != nil {
		return nil, err
	}
	err = workingSetCache.WaitUntilStarted()
	if err != nil {
		return nil, err
	}
	err = syncCache.WaitUntilStarted()
	if err != nil {
		return nil, err
	}
	params := backpressureDiskLimiterParams{
		minThreshold:      0.5,
		maxThreshold:      0.95,
		quotaMinThreshold: 1.0,
		quotaMaxThreshold: 1.2,
		journalFrac:       0.25,
		diskCacheFrac:     0.25,
		syncCacheFrac:     0.25,
		byteLimit:         testDiskBlockCacheMaxBytes,
		fileLimit:         maxFiles,
		maxDelay:          time.Second,
		delayFn:           defaultDoDelay,
		freeBytesAndFilesFn: func() (int64, int64, error) {
			// hackity hackeroni: simulate the disk cache taking up space.
			syncBytes, workingBytes := testGetDiskCacheBytes(
				syncCache, workingSetCache)
			freeBytes := maxBytes - syncBytes - workingBytes
			return freeBytes, maxFiles, nil
		},
		quotaFn: func(
			context.Context, keybase1.UserOrTeamID) (int64, int64) {
			return 0, math.MaxInt64
		},
	}
	config.limiter, err = newBackpressureDiskLimiter(
		config.MakeLogger(""), params)
	if err != nil {
		return nil, err
	}
	return &diskBlockCacheWrapped{
		config:          config,
		storageRoot:     "",
		workingSetCache: workingSetCache,
		syncCache:       syncCache,
	}, nil
}

func initDiskBlockCacheTest(t *testing.T) (*diskBlockCacheWrapped,
	*testDiskBlockCacheConfig) {
	config := newTestDiskBlockCacheConfig(t)
	cache, err := newDiskBlockCacheForTest(config,
		testDiskBlockCacheMaxBytes)
	require.NoError(t, err)
	return cache, config
}

type testDiskBlockCacheGetter struct {
	lock  sync.RWMutex
	cache DiskBlockCache
}

func (dbcg *testDiskBlockCacheGetter) DiskBlockCache() DiskBlockCache {
	dbcg.lock.RLock()
	defer dbcg.lock.RUnlock()
	return dbcg.cache
}

func newTestDiskBlockCacheGetter(t *testing.T,
	cache DiskBlockCache) *testDiskBlockCacheGetter {
	return &testDiskBlockCacheGetter{cache: cache}
}

func shutdownDiskBlockCacheTest(cache DiskBlockCache) {
	cache.Shutdown(context.Background())
}

func setupRealBlockForDiskCache(t *testing.T, ptr data.BlockPointer, block data.Block,
	config diskBlockCacheConfig) ([]byte, kbfscrypto.BlockCryptKeyServerHalf) {
	blockEncoded, err := config.Codec().Encode(block)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	return blockEncoded, serverHalf
}

func setupBlockForDiskCache(t *testing.T, config diskBlockCacheConfig) (
	data.BlockPointer, data.Block, []byte, kbfscrypto.BlockCryptKeyServerHalf) {
	ptr := makeRandomBlockPointer(t)
	block := makeFakeFileBlock(t, true)
	blockEncoded, serverHalf :=
		setupRealBlockForDiskCache(t, ptr, block, config)
	return ptr, block, blockEncoded, serverHalf
}

func TestDiskBlockCachePutAndGet(t *testing.T) {
	t.Parallel()
	t.Log("Test that basic disk cache Put and Get operations work.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	tlf1 := tlf.FakeID(0, tlf.Private)
	block1Ptr, _, block1Encoded, block1ServerHalf := setupBlockForDiskCache(
		t, config)

	ctx := context.Background()

	t.Log("Put a block into the cache.")
	err := cache.Put(
		ctx, tlf1, block1Ptr.ID, block1Encoded, block1ServerHalf,
		DiskBlockAnyCache)
	require.NoError(t, err)
	putMd, err := cache.GetMetadata(ctx, block1Ptr.ID)
	require.NoError(t, err)
	config.TestClock().Add(time.Second)

	t.Log("Get that block from the cache. Verify that it's the same.")
	buf, serverHalf, _, err := cache.Get(
		ctx, tlf1, block1Ptr.ID, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, block1ServerHalf, serverHalf)
	require.Equal(t, block1Encoded, buf)

	t.Log("Verify that the Get updated the LRU time for the block.")
	getMd, err := cache.GetMetadata(ctx, block1Ptr.ID)
	require.NoError(t, err)
	require.True(t, getMd.LRUTime.After(putMd.LRUTime.Time), "Get LRU time isn't "+
		"after the Put LRU time. Put metadata: %+v, Get metadata: %+v",
		putMd, getMd)

	t.Log("Attempt to Get a block from the cache that isn't there." +
		" Verify that it fails.")
	ptr2 := makeRandomBlockPointer(t)
	buf, serverHalf, _, err = cache.Get(
		ctx, tlf1, ptr2.ID, DiskBlockAnyCache)
	require.EqualError(t, err, data.NoSuchBlockError{ID: ptr2.ID}.Error())
	require.Equal(t, kbfscrypto.BlockCryptKeyServerHalf{}, serverHalf)
	require.Nil(t, buf)

	t.Log("Verify that the cache returns no metadata for the missing block.")
	_, err = cache.GetMetadata(ctx, ptr2.ID)
	require.EqualError(t, err, errors.ErrNotFound.Error())
}

func TestDiskBlockCacheDelete(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache deletion works.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)
	ctx := context.Background()

	t.Log("Seed the cache with some other TLFs")
	fakeTlfs := []byte{0, 1, 2, 4, 5}
	for _, f := range fakeTlfs {
		tlf := tlf.FakeID(f, tlf.Private)
		blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
			t, config)
		err := cache.Put(
			ctx, tlf, blockPtr.ID, blockEncoded, serverHalf, DiskBlockAnyCache)
		require.NoError(t, err)
	}
	tlf1 := tlf.FakeID(3, tlf.Private)
	block1Ptr, _, block1Encoded, block1ServerHalf := setupBlockForDiskCache(t,
		config)
	block2Ptr, _, block2Encoded, block2ServerHalf := setupBlockForDiskCache(t,
		config)
	block3Ptr, _, block3Encoded, block3ServerHalf := setupBlockForDiskCache(t,
		config)

	t.Log("Put three blocks into the cache.")
	err := cache.Put(
		ctx, tlf1, block1Ptr.ID, block1Encoded, block1ServerHalf,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, tlf1, block2Ptr.ID, block2Encoded, block2ServerHalf,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, tlf1, block3Ptr.ID, block3Encoded, block3ServerHalf,
		DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Delete two of the blocks from the cache.")
	_, _, err = cache.Delete(
		ctx, []kbfsblock.ID{block1Ptr.ID, block2Ptr.ID}, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Verify that only the non-deleted block is still in the cache.")
	_, _, _, err = cache.Get(ctx, tlf1, block1Ptr.ID, DiskBlockAnyCache)
	require.EqualError(t, err, data.NoSuchBlockError{ID: block1Ptr.ID}.Error())
	_, _, _, err = cache.Get(ctx, tlf1, block2Ptr.ID, DiskBlockAnyCache)
	require.EqualError(t, err, data.NoSuchBlockError{ID: block2Ptr.ID}.Error())
	_, _, _, err = cache.Get(ctx, tlf1, block3Ptr.ID, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Verify that the cache returns no LRU time for the missing blocks.")
	_, err = cache.GetMetadata(ctx, block1Ptr.ID)
	require.EqualError(t, err, errors.ErrNotFound.Error())
	_, err = cache.GetMetadata(ctx, block2Ptr.ID)
	require.EqualError(t, err, errors.ErrNotFound.Error())
}

func TestDiskBlockCacheEvictFromTLF(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache eviction works for a single TLF.")
	cache, config := initDiskBlockCacheTest(t)
	standardCache := cache.workingSetCache
	defer shutdownDiskBlockCacheTest(cache)

	tlf1 := tlf.FakeID(3, tlf.Private)
	ctx := context.Background()
	clock := config.TestClock()
	initialTime := clock.Now()
	t.Log("Seed the cache with some other TLFs.")
	fakeTlfs := []byte{0, 1, 2, 4, 5}
	for _, f := range fakeTlfs {
		tlf := tlf.FakeID(f, tlf.Private)
		blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
			t, config)
		err := standardCache.Put(
			ctx, tlf, blockPtr.ID, blockEncoded, serverHalf)
		require.NoError(t, err)
		clock.Add(time.Second)
	}
	tlf1NumBlocks := 100
	t.Log("Put 100 blocks into the cache.")
	for i := 0; i < tlf1NumBlocks; i++ {
		blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
			t, config)
		err := standardCache.Put(
			ctx, tlf1, blockPtr.ID, blockEncoded, serverHalf)
		require.NoError(t, err)
		clock.Add(time.Second)
	}

	previousAvgDuration := 50 * time.Second
	averageDifference := float64(0)
	numEvictionDifferences := 0
	expectedCount := tlf1NumBlocks

	t.Log("Incrementally evict all the tlf1 blocks in the cache.")
	// Because the eviction algorithm is probabilistic, we can't rely on the
	// same number of blocks being evicted every time. So we have to be smart
	// about our assertions.
	for expectedCount != 0 {
		t.Log("Evict 10 blocks from the cache.")
		numRemoved, _, err := standardCache.evictFromTLFLocked(ctx, tlf1, 10)
		require.NoError(t, err)
		expectedCount -= numRemoved

		blockCount := 0
		var avgDuration time.Duration
		func() {
			tlfBytes := tlf1.Bytes()
			tlf1Range := util.BytesPrefix(tlfBytes)
			iter := standardCache.tlfDb.NewIterator(tlf1Range, nil)
			defer iter.Release()
			for iter.Next() {
				blockIDBytes := iter.Key()[len(tlfBytes):]
				blockID, err := kbfsblock.IDFromBytes(blockIDBytes)
				require.NoError(t, err)
				putMd, err := standardCache.GetMetadata(ctx, blockID)
				require.NoError(t, err)
				avgDuration += putMd.LRUTime.Sub(initialTime)
				blockCount++
			}
		}()
		t.Logf("Verify that there are %d blocks in the cache.", expectedCount)
		require.Equal(t, expectedCount, blockCount,
			"Removed %d blocks this round.", numRemoved)
		if expectedCount > 0 {
			avgDuration /= time.Duration(expectedCount)
			t.Logf("Average LRU time of remaining blocks: %.2f",
				avgDuration.Seconds())
			averageDifference += avgDuration.Seconds() -
				previousAvgDuration.Seconds()
			previousAvgDuration = avgDuration
			numEvictionDifferences++
		}
	}
	t.Log("Verify that, on average, the LRU time of the blocks remaining in" +
		" the queue keeps going up.")
	averageDifference /= float64(numEvictionDifferences)
	require.True(t, averageDifference > 3.0,
		"Average overall LRU delta from an eviction: %.2f", averageDifference)
}

func TestDiskBlockCacheEvictOverall(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache eviction works overall.")
	cache, config := initDiskBlockCacheTest(t)
	standardCache := cache.workingSetCache
	defer shutdownDiskBlockCacheTest(cache)

	ctx := context.Background()
	clock := config.TestClock()
	initialTime := clock.Now()

	numTlfs := 10
	numBlocksPerTlf := 10
	totalBlocks := numTlfs * numBlocksPerTlf

	t.Log("Seed the cache with some other TLFs.")
	for i := byte(0); int(i) < numTlfs; i++ {
		currTlf := tlf.FakeID(i, tlf.Private)
		for j := 0; j < numBlocksPerTlf; j++ {
			blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
				t, config)
			err := standardCache.Put(
				ctx, currTlf, blockPtr.ID, blockEncoded, serverHalf)
			require.NoError(t, err)
			clock.Add(time.Second)
		}
	}

	// Average LRU will initially be half the total number of blocks, in
	// seconds.
	previousAvgDuration := time.Duration(totalBlocks>>1) * time.Second
	averageDifference := float64(0)
	numEvictionDifferences := 0
	expectedCount := totalBlocks

	t.Log("Incrementally evict all the blocks in the cache.")
	// Because the eviction algorithm is probabilistic, we can't rely on the
	// same number of blocks being evicted every time. So we have to be smart
	// about our assertions.
	for expectedCount != 0 {
		t.Log("Evict 10 blocks from the cache.")
		numRemoved, _, err := standardCache.evictLocked(ctx, 10)
		require.NoError(t, err)
		expectedCount -= numRemoved

		blockCount := 0
		var avgDuration time.Duration
		func() {
			iter := standardCache.metaDb.NewIterator(nil, nil)
			defer iter.Release()
			for iter.Next() {
				metadata := DiskBlockCacheMetadata{}
				err = config.Codec().Decode(iter.Value(), &metadata)
				require.NoError(t, err)
				avgDuration += metadata.LRUTime.Sub(initialTime)
				blockCount++
			}
		}()
		t.Logf("Verify that there are %d blocks in the cache.", expectedCount)
		require.Equal(t, expectedCount, blockCount,
			"Removed %d blocks this round.", numRemoved)
		if expectedCount > 0 {
			avgDuration /= time.Duration(expectedCount)
			t.Logf("Average LRU time of remaining blocks: %.2f",
				avgDuration.Seconds())
			averageDifference += avgDuration.Seconds() -
				previousAvgDuration.Seconds()
			previousAvgDuration = avgDuration
			numEvictionDifferences++
		}
	}
	t.Log("Verify that, on average, the LRU time of the blocks remaining in" +
		" the queue keeps going up.")
	averageDifference /= float64(numEvictionDifferences)
	require.True(t, averageDifference > 3.0,
		"Average overall LRU delta from an eviction: %.2f", averageDifference)
}

func TestDiskBlockCacheStaticLimit(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache eviction works when we hit the static limit.")
	cache, config := initDiskBlockCacheTest(t)
	standardCache := cache.workingSetCache
	defer shutdownDiskBlockCacheTest(cache)

	ctx := context.Background()
	clock := config.TestClock()

	numTlfs := 10
	numBlocksPerTlf := 5
	numBlocks := numTlfs * numBlocksPerTlf

	t.Log("Seed the cache with some blocks.")
	for i := byte(0); int(i) < numTlfs; i++ {
		currTlf := tlf.FakeID(i, tlf.Private)
		for j := 0; j < numBlocksPerTlf; j++ {
			blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
				t, config)
			err := standardCache.Put(
				ctx, currTlf, blockPtr.ID, blockEncoded, serverHalf)
			require.NoError(t, err)
			clock.Add(time.Second)
		}
	}

	t.Log("Set the cache maximum bytes to the current total.")
	currBytes := int64(standardCache.currBytes)
	limiter := config.DiskLimiter().(*backpressureDiskLimiter)
	limiter.diskCacheByteTracker.limit = currBytes

	t.Log("Add a block to the cache. Verify that blocks were evicted.")
	blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
		t, config)
	err := standardCache.Put(
		ctx, tlf.FakeID(10, tlf.Private), blockPtr.ID, blockEncoded, serverHalf)
	require.NoError(t, err)

	require.True(t, int64(standardCache.currBytes) < currBytes)
	require.Equal(t, 1+numBlocks-defaultNumBlocksToEvict, standardCache.numBlocks)
}

func TestDiskBlockCacheDynamicLimit(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache eviction works when we hit a dynamic limit.")
	cache, config := initDiskBlockCacheTest(t)
	standardCache := cache.workingSetCache
	defer shutdownDiskBlockCacheTest(cache)

	ctx := context.Background()
	clock := config.TestClock()

	numTlfs := 10
	numBlocksPerTlf := 5
	numBlocks := numTlfs * numBlocksPerTlf

	t.Log("Seed the cache with some blocks.")
	for i := byte(0); int(i) < numTlfs; i++ {
		currTlf := tlf.FakeID(i, tlf.Private)
		for j := 0; j < numBlocksPerTlf; j++ {
			blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
				t, config)
			err := standardCache.Put(
				ctx, currTlf, blockPtr.ID, blockEncoded, serverHalf)
			require.NoError(t, err)
			clock.Add(time.Second)
		}
	}

	t.Log("Set the cache dynamic limit to its current value by tweaking the" +
		" free space function.")
	currBytes := int64(standardCache.currBytes)
	limiter := config.DiskLimiter().(*backpressureDiskLimiter)
	limiter.freeBytesAndFilesFn = func() (int64, int64, error) {
		// Since the limit is 25% of the total available space, make that true
		// for the current used byte count.  We do this by setting the free
		// byte count to 75% of the total, which is 3x used bytes.
		freeBytes := currBytes * 3
		// arbitrarily large number
		numFiles := int64(100000000)
		return freeBytes, numFiles, nil
	}

	t.Log("Add a round of blocks to the cache. Verify that blocks were" +
		" evicted each time we went past the limit.")
	start := numBlocks - defaultNumBlocksToEvict
	for i := 1; i <= numBlocks; i++ {
		blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
			t, config)
		err := standardCache.Put(
			ctx, tlf.FakeID(10, tlf.Private), blockPtr.ID, blockEncoded,
			serverHalf)
		require.NoError(t, err)
		require.Equal(t, start+(i%defaultNumBlocksToEvict), standardCache.numBlocks)
	}

	require.True(t, int64(standardCache.currBytes) < currBytes)
	require.Equal(t, start, standardCache.numBlocks)
}

func TestDiskBlockCacheWithRetrievalQueue(t *testing.T) {
	t.Parallel()
	t.Log("Test the interaction of the disk block cache and retrieval queue.")
	cache, dbcConfig := initDiskBlockCacheTest(t)
	require.NotNil(t, cache)
	defer shutdownDiskBlockCacheTest(cache)

	t.Log("Create a queue with 0 workers to rule it out from serving blocks.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		0, 0, 0, newTestBlockRetrievalConfig(t, bg, cache))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	ctx := context.Background()
	kmd := makeKMD()
	ptr1, block1, block1Encoded, serverHalf1 := setupBlockForDiskCache(
		t, dbcConfig)
	err := cache.Put(
		ctx, kmd.TlfID(), ptr1.ID, block1Encoded, serverHalf1,
		DiskBlockAnyCache)
	require.NoError(t, err)
	// No workers initialized, so no need to clean up the continue ch since
	// there will be nothing blocking on it.
	_, _ = bg.setBlockToReturn(ptr1, block1)

	t.Log("Request a block retrieval for ptr1. " +
		"Verify the block against the one we put in the disk block cache.")
	block := &data.FileBlock{}
	ch := q.Request(
		ctx, 1, kmd, ptr1, block, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}

func seedDiskBlockCacheForTest(ctx context.Context, t *testing.T,
	cache *diskBlockCacheWrapped, config diskBlockCacheConfig, numTlfs,
	numBlocksPerTlf int) {
	t.Log("Seed the cache with some blocks.")
	clock := config.Clock().(*clocktest.TestClock)
	for i := byte(0); int(i) < numTlfs; i++ {
		currTlf := tlf.FakeID(i, tlf.Private)
		for j := 0; j < numBlocksPerTlf; j++ {
			blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
				t, config)
			err := cache.Put(
				ctx, currTlf, blockPtr.ID, blockEncoded, serverHalf,
				DiskBlockSyncCache)
			require.NoError(t, err)
			clock.Add(time.Second)
		}
	}
}

func testPutBlockWhenSyncCacheFull(
	ctx context.Context, t *testing.T, putCache *DiskBlockCacheLocal,
	cache *diskBlockCacheWrapped, config *testDiskBlockCacheConfig) {
	numTlfs := 10
	numBlocksPerTlf := 5
	numBlocks := numTlfs * numBlocksPerTlf
	seedDiskBlockCacheForTest(ctx, t, cache, config, numTlfs, numBlocksPerTlf)

	t.Log("Set the cache maximum bytes to the current total.")
	require.Equal(t, 0, putCache.numBlocks)
	currBytes := int64(cache.syncCache.currBytes)
	limiter := config.DiskLimiter().(*backpressureDiskLimiter)
	limiter.syncCacheByteTracker.limit = currBytes

	t.Log("Add a block to the cache. Verify that no blocks were evicted " +
		"and the working set got a new block.")
	blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
		t, config)
	err := putCache.Put(
		ctx, tlf.FakeID(0, tlf.Private), blockPtr.ID, blockEncoded, serverHalf)
	require.NoError(t, err)

	require.Equal(t, int64(cache.syncCache.currBytes), currBytes)
	require.Equal(t, numBlocks, cache.syncCache.numBlocks)
	require.Equal(t, 1, putCache.numBlocks)
}

func TestSyncBlockCacheStaticLimit(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache eviction doesn't happen in sync cache")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)
	ctx := context.Background()

	testPutBlockWhenSyncCacheFull(ctx, t, cache.workingSetCache, cache, config)
}

func TestCrDirtyBlockCacheStaticLimit(t *testing.T) {
	t.Parallel()
	t.Log("Test that cr cache accepts blocks even when sync limit is hit")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)
	crCache, err := newDiskBlockCacheLocalForTest(
		config, crDirtyBlockCacheLimitTrackerType)
	require.NoError(t, err)
	ctx := context.Background()
	defer crCache.Shutdown(ctx)

	err = crCache.WaitUntilStarted()
	require.NoError(t, err)

	testPutBlockWhenSyncCacheFull(ctx, t, crCache, cache, config)
}

func TestDiskBlockCacheLastUnrefPutAndGet(t *testing.T) {
	t.Parallel()
	t.Log("Test that basic disk cache last unref Put and Get operations work.")
	cache, _ := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	ctx := context.Background()

	t.Log("Put and get a last unref revision into the cache.")
	tlf1 := tlf.FakeID(0, tlf.Private)
	rev1 := kbfsmd.Revision(1)
	ct := DiskBlockWorkingSetCache
	err := cache.PutLastUnrefRev(ctx, tlf1, rev1, ct)
	require.NoError(t, err)
	getRev1, err := cache.GetLastUnrefRev(ctx, tlf1, ct)
	require.NoError(t, err)
	require.Equal(t, rev1, getRev1)

	t.Log("Put and get a last unref revision into the cache for another TLF.")
	tlf2 := tlf.FakeID(1, tlf.Public)
	rev2 := kbfsmd.Revision(200)
	err = cache.PutLastUnrefRev(ctx, tlf2, rev2, ct)
	require.NoError(t, err)
	getRev2, err := cache.GetLastUnrefRev(ctx, tlf2, ct)
	require.NoError(t, err)
	require.Equal(t, rev2, getRev2)

	t.Log("Put a lower revision; should be ignored")
	rev2b := kbfsmd.Revision(100)
	err = cache.PutLastUnrefRev(ctx, tlf2, rev2b, ct)
	require.NoError(t, err)
	getRev2, err = cache.GetLastUnrefRev(ctx, tlf2, ct)
	require.NoError(t, err)
	require.Equal(t, rev2, getRev2)

	// Force re-read from DB.
	cache.syncCache.tlfLastUnrefs = nil
	err = cache.syncCache.syncBlockCountsAndUnrefsFromDb()
	require.NoError(t, err)
	getRev1, err = cache.GetLastUnrefRev(ctx, tlf1, ct)
	require.NoError(t, err)
	require.Equal(t, rev1, getRev1)
	getRev2, err = cache.GetLastUnrefRev(ctx, tlf2, ct)
	require.NoError(t, err)
	require.Equal(t, rev2, getRev2)
}

func TestDiskBlockCacheUnsyncTlf(t *testing.T) {
	t.Parallel()
	t.Log("Test that blocks are cleaned up after unsyncing a TLF.")

	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfscache")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	// Use a real config, since we need the real SetTlfSyncState
	// implementation.
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "u1")
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)

	clock := clocktest.NewTestClockNow()
	config.SetClock(clock)

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.loadSyncedTlfsLocked()
	require.NoError(t, err)
	config.diskCacheMode = DiskCacheModeLocal
	err = config.MakeDiskBlockCacheIfNotExists()
	require.NoError(t, err)
	cache := config.DiskBlockCache().(*diskBlockCacheWrapped)
	standardCache := cache.syncCache
	err = standardCache.WaitUntilStarted()
	require.NoError(t, err)

	numTlfs := 3
	numBlocksPerTlf := 5
	numBlocks := numTlfs * numBlocksPerTlf
	seedDiskBlockCacheForTest(ctx, t, cache, config, numTlfs, numBlocksPerTlf)
	require.Equal(t, numBlocks, standardCache.numBlocks)

	standardCache.clearTickerDuration = 0
	standardCache.numBlocksToEvictOnClear = 1

	tlfToUnsync := tlf.FakeID(1, tlf.Private)
	ch, err := config.SetTlfSyncState(ctx, tlfToUnsync, FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_DISABLED,
	})
	require.NoError(t, err)
	t.Log("Waiting for unsynced blocks to be cleared.")
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, numBlocks-numBlocksPerTlf, standardCache.numBlocks)
}

func TestDiskBlockCacheMoveBlock(t *testing.T) {
	t.Parallel()
	t.Log("Test that blocks can be moved between caches.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	ctx := context.Background()
	tlf1 := tlf.FakeID(0, tlf.Private)
	block1Ptr, _, block1Encoded, block1ServerHalf := setupBlockForDiskCache(
		t, config)

	t.Log("Put a block into the default cache.")
	err := cache.Put(
		ctx, tlf1, block1Ptr.ID, block1Encoded, block1ServerHalf,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.UpdateMetadata(
		ctx, tlf1, block1Ptr.ID, FinishedPrefetch, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, 1, cache.workingSetCache.numBlocks)
	require.Equal(t, 0, cache.syncCache.numBlocks)

	t.Log("Move the block by getting it with a different preferred cache.")
	_, _, _, err = cache.Get(ctx, tlf1, block1Ptr.ID, DiskBlockSyncCache)
	require.NoError(t, err)
	err = cache.waitForDeletes(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, cache.syncCache.numBlocks)
	require.Equal(t, 0, cache.workingSetCache.numBlocks)

	t.Log("After the move, make sure the prefetch status is downgraded.")
	_, _, prefetchStatus, err := cache.Get(
		ctx, tlf1, block1Ptr.ID, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, 1, cache.syncCache.numBlocks)
	require.Equal(t, TriggeredPrefetch, prefetchStatus)
}

// seedTlf seeds the cache with blocks from a given TLF ID. Notably,
// it does NOT give them different times,
// because that makes TLFs filled first more likely to face eviction.
func seedTlf(ctx context.Context, t *testing.T,
	cache *diskBlockCacheWrapped, config diskBlockCacheConfig, tlfID tlf.ID,
	numBlocksPerTlf int) {
	for j := 0; j < numBlocksPerTlf; j++ {
		blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
			t, config)
		err := cache.Put(
			ctx, tlfID, blockPtr.ID, blockEncoded, serverHalf,
			DiskBlockSyncCache)
		require.NoError(t, err)
	}

}

func TestDiskBlockCacheHomeDirPriorities(t *testing.T) {
	t.Parallel()
	t.Log("Test that blocks from a home directory aren't evicted when there" +
		" are other options.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	ctx := context.Background()

	rand.Seed(1)

	t.Log("Set home directories on the cache")
	homeTLF := tlf.FakeID(100, tlf.Private)
	err := cache.AddHomeTLF(ctx, homeTLF)
	require.NoError(t, err)
	homePublicTLF := tlf.FakeID(101, tlf.Public)
	err = cache.AddHomeTLF(ctx, homePublicTLF)
	require.NoError(t, err)

	t.Log("Seed the cache with blocks")
	totalBlocks := 0
	homeTLFBlocksEach := 50
	originalSizes := map[tlf.ID]int{
		homePublicTLF: homeTLFBlocksEach,
		homeTLF:       homeTLFBlocksEach,
	}

	seedTlf(ctx, t, cache, config, homePublicTLF, homeTLFBlocksEach)
	seedTlf(ctx, t, cache, config, homeTLF, homeTLFBlocksEach)
	totalBlocks += 2 * homeTLFBlocksEach
	otherTlfIds := []tlf.ID{
		tlf.FakeID(1, tlf.Private),
		tlf.FakeID(2, tlf.Public),
		tlf.FakeID(3, tlf.Private),
		tlf.FakeID(4, tlf.Private),
		tlf.FakeID(5, tlf.Public),
	}

	// Distribute the blocks exponentially over the non-home TLFs.
	// Use LOTS of blocks to get better statistical behavior.
	nextTlfSize := 200
	for _, tlfID := range otherTlfIds {
		seedTlf(ctx, t, cache, config, tlfID, nextTlfSize)
		originalSizes[tlfID] = nextTlfSize
		totalBlocks += nextTlfSize
		nextTlfSize *= 2
	}

	t.Log("Evict half the non-home TLF blocks using small eviction sizes.")
	evictionSize := 5
	numEvictions := (totalBlocks - 2*homeTLFBlocksEach) / (evictionSize * 2)
	for i := 0; i < numEvictions; i++ {
		_, _, err := cache.syncCache.evictLocked(ctx, evictionSize)
		require.NoError(t, err)
		totalBlocks -= evictionSize
	}

	t.Log("Verify that the non-home TLFs have been reduced in size by about" +
		" half")
	// Allow a tolerance of .5, so 25-75% of the original size.
	for _, tlfID := range otherTlfIds {
		original := originalSizes[tlfID]
		current := cache.syncCache.tlfCounts[tlfID]
		t.Logf("ID: %v, Current: %d, Original: %d", tlfID, current, original)
		require.InEpsilon(t, original/2, current, 0.5)
	}
	require.Equal(t, homeTLFBlocksEach, cache.syncCache.tlfCounts[homeTLF])
	require.Equal(t, homeTLFBlocksEach, cache.syncCache.tlfCounts[homePublicTLF])

	t.Log("Evict the rest of the non-home TLF blocks in 2 evictions.")
	numEvictions = 2
	evictionSize1 := (totalBlocks - 2*homeTLFBlocksEach) / numEvictions
	// In the second eviction, evict enough blocks to touch the public home.
	publicHomeEvict := 10
	evictionSize2 := totalBlocks - 2*homeTLFBlocksEach - evictionSize1 + publicHomeEvict

	_, _, err = cache.syncCache.evictLocked(ctx, evictionSize1)
	require.NoError(t, err)

	// Make sure the home TLFs are not touched.
	require.Equal(t, homeTLFBlocksEach, cache.syncCache.tlfCounts[homeTLF])
	require.Equal(t, homeTLFBlocksEach, cache.syncCache.tlfCounts[homePublicTLF])

	_, _, err = cache.syncCache.evictLocked(ctx, evictionSize2)
	require.NoError(t, err)

	// Make sure the home TLFs are minimally touched.
	require.Equal(t, homeTLFBlocksEach, cache.syncCache.tlfCounts[homeTLF])
	require.Equal(t, homeTLFBlocksEach-publicHomeEvict,
		cache.syncCache.tlfCounts[homePublicTLF])

	t.Log("Evict enough blocks to get rid of the public home TLF.")
	_, _, err = cache.syncCache.evictLocked(ctx, homeTLFBlocksEach-publicHomeEvict)
	require.NoError(t, err)
	require.Equal(t, homeTLFBlocksEach, cache.syncCache.tlfCounts[homeTLF])
	require.Equal(t, 0, cache.syncCache.tlfCounts[homePublicTLF])

	t.Log("Evict enough blocks to get rid of the private home TLF.")
	_, _, err = cache.syncCache.evictLocked(ctx, homeTLFBlocksEach)
	require.NoError(t, err)
	require.Equal(t, 0, cache.syncCache.tlfCounts[homeTLF])
	require.Equal(t, 0, cache.syncCache.tlfCounts[homePublicTLF])
}

func TestDiskBlockCacheMark(t *testing.T) {
	t.Parallel()
	t.Log("Test that basic disk cache marking and deleting work.")
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)
	standardCache := cache.syncCache
	ctx := context.Background()

	t.Log("Insert lots of blocks.")
	numTlfs := 3
	numBlocksPerTlf := 5
	numBlocks := numTlfs * numBlocksPerTlf
	seedDiskBlockCacheForTest(ctx, t, cache, config, numTlfs, numBlocksPerTlf)
	require.Equal(t, numBlocks, standardCache.numBlocks)

	t.Log("Generate some blocks we can mark.")
	tlfID := tlf.FakeID(1, tlf.Private)
	ids := make([]kbfsblock.ID, numBlocksPerTlf)
	for i := 0; i < numBlocksPerTlf; i++ {
		blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
			t, config)
		err := cache.Put(
			ctx, tlfID, blockPtr.ID, blockEncoded, serverHalf,
			DiskBlockSyncCache)
		require.NoError(t, err)
		ids[i] = blockPtr.ID
	}
	numBlocks += numBlocksPerTlf
	require.Equal(t, numBlocks, standardCache.numBlocks)

	t.Log("Mark a couple blocks.")
	tag := "mark"
	err := cache.Mark(ctx, ids[1], tag, DiskBlockSyncCache)
	require.NoError(t, err)
	err = cache.Mark(ctx, ids[3], tag, DiskBlockSyncCache)
	require.NoError(t, err)

	t.Log("Delete all unmarked blocks.")
	standardCache.clearTickerDuration = 0
	standardCache.numUnmarkedBlocksToCheck = 1
	err = cache.DeleteUnmarked(ctx, tlfID, tag, DiskBlockSyncCache)
	require.NoError(t, err)
	require.Equal(t, numBlocks-(2*numBlocksPerTlf-2), standardCache.numBlocks)
	_, _, _, err = cache.Get(ctx, tlfID, ids[0], DiskBlockAnyCache)
	require.EqualError(t, err, data.NoSuchBlockError{ID: ids[0]}.Error())
	_, _, _, err = cache.Get(ctx, tlfID, ids[2], DiskBlockAnyCache)
	require.EqualError(t, err, data.NoSuchBlockError{ID: ids[2]}.Error())
	_, _, _, err = cache.Get(ctx, tlfID, ids[4], DiskBlockAnyCache)
	require.EqualError(t, err, data.NoSuchBlockError{ID: ids[4]}.Error())
}
