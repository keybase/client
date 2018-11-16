// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

const (
	testDiskBlockCacheMaxBytes int64 = 1 << 20
)

type testDiskBlockCacheConfig struct {
	codecGetter
	logMaker
	*testClockGetter
	limiter DiskLimiter
	syncedTlfGetterSetter
	initModeGetter
}

func newTestDiskBlockCacheConfig(t *testing.T) *testDiskBlockCacheConfig {
	return &testDiskBlockCacheConfig{
		newTestCodecGetter(),
		newTestLogMaker(t),
		newTestClockGetter(),
		nil,
		newTestSyncedTlfGetterSetter(),
		testInitModeGetter{InitDefault},
	}
}

func (c testDiskBlockCacheConfig) DiskLimiter() DiskLimiter {
	return c.limiter
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
			freeBytes := maxBytes - int64(syncCache.currBytes) -
				int64(workingSetCache.currBytes)
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
	cache DiskBlockCache
}

func (dbcg *testDiskBlockCacheGetter) DiskBlockCache() DiskBlockCache {
	return dbcg.cache
}

func newTestDiskBlockCacheGetter(t *testing.T,
	cache DiskBlockCache) *testDiskBlockCacheGetter {
	return &testDiskBlockCacheGetter{cache}
}

func shutdownDiskBlockCacheTest(cache DiskBlockCache) {
	cache.Shutdown(context.Background())
}

func setupRealBlockForDiskCache(t *testing.T, ptr BlockPointer, block Block,
	config diskBlockCacheConfig) ([]byte, kbfscrypto.BlockCryptKeyServerHalf) {
	blockEncoded, err := config.Codec().Encode(block)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	return blockEncoded, serverHalf
}

func setupBlockForDiskCache(t *testing.T, config diskBlockCacheConfig) (
	BlockPointer, Block, []byte, kbfscrypto.BlockCryptKeyServerHalf) {
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
	err := cache.Put(ctx, tlf1, block1Ptr.ID, block1Encoded, block1ServerHalf)
	require.NoError(t, err)
	putMd, err := cache.GetMetadata(ctx, block1Ptr.ID)
	require.NoError(t, err)
	config.TestClock().Add(time.Second)

	t.Log("Get that block from the cache. Verify that it's the same.")
	buf, serverHalf, _, err := cache.Get(ctx, tlf1, block1Ptr.ID)
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
	buf, serverHalf, _, err = cache.Get(ctx, tlf1, ptr2.ID)
	require.EqualError(t, err, NoSuchBlockError{ptr2.ID}.Error())
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
		err := cache.Put(ctx, tlf, blockPtr.ID, blockEncoded, serverHalf)
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
	err := cache.Put(ctx, tlf1, block1Ptr.ID, block1Encoded, block1ServerHalf)
	require.NoError(t, err)
	err = cache.Put(ctx, tlf1, block2Ptr.ID, block2Encoded, block2ServerHalf)
	require.NoError(t, err)
	err = cache.Put(ctx, tlf1, block3Ptr.ID, block3Encoded, block3ServerHalf)
	require.NoError(t, err)

	t.Log("Delete two of the blocks from the cache.")
	_, _, err = cache.Delete(ctx, []kbfsblock.ID{block1Ptr.ID, block2Ptr.ID})
	require.NoError(t, err)

	t.Log("Verify that only the non-deleted block is still in the cache.")
	_, _, _, err = cache.Get(ctx, tlf1, block1Ptr.ID)
	require.EqualError(t, err, NoSuchBlockError{block1Ptr.ID}.Error())
	_, _, _, err = cache.Get(ctx, tlf1, block2Ptr.ID)
	require.EqualError(t, err, NoSuchBlockError{block2Ptr.ID}.Error())
	_, _, _, err = cache.Get(ctx, tlf1, block3Ptr.ID)
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
		err := standardCache.Put(ctx, tlf, blockPtr.ID, blockEncoded, serverHalf)
		require.NoError(t, err)
		clock.Add(time.Second)
	}
	tlf1NumBlocks := 100
	t.Log("Put 100 blocks into the cache.")
	for i := 0; i < tlf1NumBlocks; i++ {
		blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
			t, config)
		err := standardCache.Put(ctx, tlf1, blockPtr.ID, blockEncoded, serverHalf)
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
			err := standardCache.Put(ctx, currTlf, blockPtr.ID, blockEncoded, serverHalf)
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
			err := standardCache.Put(ctx, currTlf, blockPtr.ID, blockEncoded, serverHalf)
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
	require.Equal(t, 1+numBlocks-int(defaultNumBlocksToEvict), standardCache.numBlocks)
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
			err := standardCache.Put(ctx, currTlf, blockPtr.ID, blockEncoded, serverHalf)
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
	q := newBlockRetrievalQueue(0, 0, newTestBlockRetrievalConfig(t, bg, cache))
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	kmd := makeKMD()
	ptr1, block1, block1Encoded, serverHalf1 := setupBlockForDiskCache(
		t, dbcConfig)
	err := cache.Put(ctx, kmd.TlfID(), ptr1.ID, block1Encoded, serverHalf1)
	require.NoError(t, err)
	_, _ = bg.setBlockToReturn(ptr1, block1)

	t.Log("Request a block retrieval for ptr1. " +
		"Verify the block against the one we put in the disk block cache.")
	block := &FileBlock{}
	ch := q.Request(ctx, 1, kmd, ptr1, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)

	t.Log("Remove the block from the disk cache to rule it out for " +
		"the next step.")
	numRemoved, _, err := cache.Delete(ctx, []kbfsblock.ID{ptr1.ID})
	require.NoError(t, err)
	require.Equal(t, 1, numRemoved)

	block = &FileBlock{}
	t.Log("Request the same block again to verify the memory cache.")
	ch = q.Request(ctx, 1, makeKMD(), ptr1, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}

func seedDiskBlockCacheForTest(
	t *testing.T, ctx context.Context, cache *diskBlockCacheWrapped,
	config diskBlockCacheConfig, numTlfs, numBlocksPerTlf int) {
	t.Log("Seed the cache with some blocks.")
	clock := config.Clock().(*TestClock)
	for i := byte(0); int(i) < numTlfs; i++ {
		currTlf := tlf.FakeID(i, tlf.Private)
		_, err := config.SetTlfSyncState(currTlf, FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		})
		require.NoError(t, err)
		for j := 0; j < numBlocksPerTlf; j++ {
			blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
				t, config)
			err := cache.Put(ctx, currTlf, blockPtr.ID, blockEncoded,
				serverHalf)
			require.NoError(t, err)
			clock.Add(time.Second)
		}
	}
}

func TestSyncBlockCacheStaticLimit(t *testing.T) {
	t.Parallel()
	t.Log("Test that disk cache eviction works when we hit the static limit.")
	cache, config := initDiskBlockCacheTest(t)
	standardCache := cache.syncCache
	defer shutdownDiskBlockCacheTest(standardCache)
	ctx := context.Background()

	numTlfs := 10
	numBlocksPerTlf := 5
	numBlocks := numTlfs * numBlocksPerTlf
	seedDiskBlockCacheForTest(t, ctx, cache, config, numTlfs, numBlocksPerTlf)

	t.Log("Set the cache maximum bytes to the current total.")
	require.Equal(t, 0, cache.workingSetCache.numBlocks)
	currBytes := int64(standardCache.currBytes)
	limiter := config.DiskLimiter().(*backpressureDiskLimiter)
	limiter.syncCacheByteTracker.limit = currBytes

	t.Log("Add a block to the cache. Verify that no blocks were evicted " +
		"and the working set got a new block.")
	blockPtr, _, blockEncoded, serverHalf := setupBlockForDiskCache(
		t, config)
	err := cache.Put(
		ctx, tlf.FakeID(0, tlf.Private), blockPtr.ID, blockEncoded, serverHalf)
	require.NoError(t, err)

	require.Equal(t, int64(standardCache.currBytes), currBytes)
	require.Equal(t, numBlocks, standardCache.numBlocks)
	require.Equal(t, 1, cache.workingSetCache.numBlocks)
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
	err := cache.PutLastUnrefRev(ctx, tlf1, rev1)
	require.NoError(t, err)
	getRev1, err := cache.GetLastUnrefRev(ctx, tlf1)
	require.NoError(t, err)
	require.Equal(t, rev1, getRev1)

	t.Log("Put and get a last unref revision into the cache for another TLF.")
	tlf2 := tlf.FakeID(1, tlf.Public)
	rev2 := kbfsmd.Revision(200)
	err = cache.PutLastUnrefRev(ctx, tlf2, rev2)
	require.NoError(t, err)
	getRev2, err := cache.GetLastUnrefRev(ctx, tlf2)
	require.NoError(t, err)
	require.Equal(t, rev2, getRev2)

	t.Log("Put a lower revision; should be ignored")
	rev2b := kbfsmd.Revision(100)
	err = cache.PutLastUnrefRev(ctx, tlf2, rev2b)
	require.NoError(t, err)
	getRev2, err = cache.GetLastUnrefRev(ctx, tlf2)
	require.NoError(t, err)
	require.Equal(t, rev2, getRev2)

	// Force re-read from DB.
	cache.syncCache.tlfLastUnrefs = nil
	err = cache.syncCache.syncBlockCountsAndUnrefsFromDb()
	require.NoError(t, err)
	getRev1, err = cache.GetLastUnrefRev(ctx, tlf1)
	require.NoError(t, err)
	require.Equal(t, rev1, getRev1)
	getRev2, err = cache.GetLastUnrefRev(ctx, tlf2)
	require.NoError(t, err)
	require.Equal(t, rev2, getRev2)
}

func TestDiskBlockCacheUnsyncTlf(t *testing.T) {
	t.Parallel()
	t.Log("Test that blocks are cleaned up after unsyncing a TLF.")

	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfscache")
	require.NoError(t, err)
	defer ioutil.RemoveAll(tempdir)

	// Use a real config, since we need the real SetTlfSyncState
	// implementation.
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "u1")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	clock := newTestClockNow()
	config.SetClock(clock)

	config.EnableDiskLimiter(tempdir)
	config.loadSyncedTlfsLocked()
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
	seedDiskBlockCacheForTest(t, ctx, cache, config, numTlfs, numBlocksPerTlf)
	require.Equal(t, numBlocks, standardCache.numBlocks)

	tlfToUnsync := tlf.FakeID(1, tlf.Private)
	ch, err := config.SetTlfSyncState(tlfToUnsync, FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_DISABLED,
	})
	require.NoError(t, err)
	t.Log("Waiting for unsynced blocks to be cleared.")
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, numBlocks-numBlocksPerTlf, standardCache.numBlocks)
}
