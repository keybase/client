// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
package libkbfs

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// blockReturner contains a block value to copy into requested blocks, and a
// channel to synchronize on with the worker.
type blockReturner struct {
	block      data.Block
	continueCh chan error
	startCh    chan struct{}
}

// fakeBlockGetter allows specifying and obtaining fake blocks.
type fakeBlockGetter struct {
	mtx           sync.RWMutex
	blockMap      map[data.BlockPointer]blockReturner
	codec         kbfscodec.Codec
	respectCancel bool
}

// newFakeBlockGetter returns a fakeBlockGetter.
func newFakeBlockGetter(respectCancel bool) *fakeBlockGetter {
	return &fakeBlockGetter{
		blockMap:      make(map[data.BlockPointer]blockReturner),
		codec:         kbfscodec.NewMsgpack(),
		respectCancel: respectCancel,
	}
}

// setBlockToReturn sets the block that will be returned for a given
// BlockPointer. Returns a writeable channel that getBlock will wait on, to
// allow synchronization of tests.
func (bg *fakeBlockGetter) setBlockToReturn(blockPtr data.BlockPointer,
	block data.Block) (startCh <-chan struct{}, continueCh chan<- error) {
	bg.mtx.Lock()
	defer bg.mtx.Unlock()
	sCh, cCh := make(chan struct{}), make(chan error)
	bg.blockMap[blockPtr] = blockReturner{
		block:      block,
		startCh:    sCh,
		continueCh: cCh,
	}
	return sCh, cCh
}

// getBlock implements the interface for realBlockGetter.
func (bg *fakeBlockGetter) getBlock(
	ctx context.Context, kmd libkey.KeyMetadata, blockPtr data.BlockPointer,
	block data.Block, _ DiskBlockCacheType) error {
	bg.mtx.RLock()
	defer bg.mtx.RUnlock()
	source, ok := bg.blockMap[blockPtr]
	if !ok {
		return errors.New("Block doesn't exist in fake block map")
	}
	cancelCh := make(chan struct{})
	if bg.respectCancel {
		go func() {
			<-ctx.Done()
			close(cancelCh)
		}()
	}
	// Wait until the caller tells us to continue
	for {
		select {
		case source.startCh <- struct{}{}:
		case err := <-source.continueCh:
			if err != nil {
				return err
			}
			block.Set(source.block)
			return nil
		case <-cancelCh:
			return ctx.Err()
		}
	}
}

func (bg *fakeBlockGetter) assembleBlock(ctx context.Context,
	kmd libkey.KeyMetadata, ptr data.BlockPointer, block data.Block, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	bg.mtx.RLock()
	defer bg.mtx.RUnlock()
	source, ok := bg.blockMap[ptr]
	if !ok {
		return errors.New("Block doesn't exist in fake block map")
	}
	block.Set(source.block)
	return nil
}

func TestBlockRetrievalWorkerBasic(t *testing.T) {
	t.Log("Test the basic ability of a worker to return a block.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		0, 1, 0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)

	block := &data.FileBlock{}
	ch := q.Request(
		context.Background(), 1, makeKMD(), ptr1, block,
		data.NoCacheEntry, BlockRequestSolo)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}

func TestBlockRetrievalWorkerBasicSoloCached(t *testing.T) {
	t.Log("Test the worker fetching and caching a solo block.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		0, 1, 0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)

	block := &data.FileBlock{}
	ch := q.Request(
		context.Background(), 1, makeKMD(), ptr1, block, data.TransientEntry,
		BlockRequestSolo)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)

	_, err = q.config.BlockCache().Get(ptr1)
	require.NoError(t, err)
}

func TestBlockRetrievalWorkerMultipleWorkers(t *testing.T) {
	t.Log("Test the ability of multiple workers to retrieve concurrently.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		2, 0, 0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	ptr1, ptr2 := makeRandomBlockPointer(t), makeRandomBlockPointer(t)
	block1, block2 := makeFakeFileBlock(t, false), makeFakeFileBlock(t, false)
	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptr2, block2)

	t.Log("Make 2 requests for 2 different blocks")
	block := &data.FileBlock{}
	// Set the base priority to be above the default on-demand
	// fetching, so that the pre-prefetch request for a block doesn't
	// override the other blocks' requests.
	basePriority := defaultOnDemandRequestPriority + 1
	req1Ch := q.Request(
		context.Background(), basePriority, makeKMD(), ptr1, block,
		data.NoCacheEntry, BlockRequestSolo)
	req2Ch := q.Request(
		context.Background(), basePriority, makeKMD(), ptr2, block,
		data.NoCacheEntry, BlockRequestSolo)

	t.Log("Allow the second request to complete before the first")
	continueCh2 <- nil
	err := <-req2Ch
	require.NoError(t, err)
	require.Equal(t, block2, block)

	t.Log("Make another request for ptr2")
	req2Ch = q.Request(
		context.Background(), basePriority, makeKMD(), ptr2, block,
		data.NoCacheEntry, BlockRequestSolo)
	continueCh2 <- nil
	err = <-req2Ch
	require.NoError(t, err)
	require.Equal(t, block2, block)

	t.Log("Complete the ptr1 request")
	continueCh1 <- nil
	err = <-req1Ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}

func TestBlockRetrievalWorkerWithQueue(t *testing.T) {
	t.Log("Test the ability of a worker and queue to work correctly together.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		1, 0, 0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	ptr1, ptr2, ptr3 := makeRandomBlockPointer(t), makeRandomBlockPointer(t),
		makeRandomBlockPointer(t)
	block1, block2, block3 := makeFakeFileBlock(t, false),
		makeFakeFileBlock(t, false), makeFakeFileBlock(t, false)
	startCh1, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptr2, block2)
	_, continueCh3 := bg.setBlockToReturn(ptr3, block3)

	t.Log("Make 3 retrievals for 3 different blocks. All retrievals after " +
		"the first should be queued.")
	block := &data.FileBlock{}
	testBlock1 := &data.FileBlock{}
	testBlock2 := &data.FileBlock{}
	// Set the base priority to be above the default on-demand
	// fetching, so that the pre-prefetch request for a block doesn't
	// override the other blocks' requests.
	basePriority := defaultOnDemandRequestPriority + 1
	req1Ch := q.Request(
		context.Background(), basePriority, makeKMD(), ptr1,
		block, data.NoCacheEntry, BlockRequestSolo)
	req2Ch := q.Request(
		context.Background(), basePriority, makeKMD(), ptr2,
		block, data.NoCacheEntry, BlockRequestSolo)
	req3Ch := q.Request(
		context.Background(), basePriority, makeKMD(), ptr3, testBlock1,
		data.NoCacheEntry, BlockRequestSolo)
	// Ensure the worker picks up the first request
	<-startCh1
	t.Log("Make a high priority request for the third block, which should " +
		"complete next.")
	req4Ch := q.Request(
		context.Background(), basePriority+1, makeKMD(), ptr3, testBlock2,
		data.NoCacheEntry, BlockRequestSolo)

	t.Log("Allow the ptr1 retrieval to complete.")
	continueCh1 <- nil
	err := <-req1Ch
	require.NoError(t, err)
	require.Equal(t, block1, block)

	t.Log("Allow the ptr3 retrieval to complete. Both waiting requests " +
		"should complete.")
	continueCh3 <- nil
	err1 := <-req3Ch
	err2 := <-req4Ch
	require.NoError(t, err1)
	require.NoError(t, err2)
	require.Equal(t, block3, testBlock1)
	require.Equal(t, block3, testBlock2)

	t.Log("Complete the ptr2 retrieval.")
	continueCh2 <- nil
	err = <-req2Ch
	require.NoError(t, err)
	require.Equal(t, block2, block)
}

func TestBlockRetrievalWorkerCancel(t *testing.T) {
	t.Log("Test the ability of a worker to handle a request cancelation.")
	bg := newFakeBlockGetter(true)
	q := newBlockRetrievalQueue(
		0, 1, 0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	// Don't need continueCh here.
	_, _ = bg.setBlockToReturn(ptr1, block1)

	block := &data.FileBlock{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ch := q.Request(
		ctx, 1, makeKMD(), ptr1, block, data.NoCacheEntry, BlockRequestSolo)
	err := <-ch
	require.EqualError(t, err, context.Canceled.Error())
}

func TestBlockRetrievalWorkerShutdown(t *testing.T) {
	t.Log("Test that worker shutdown works.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		1, 0, 0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	w := q.workers[0]
	require.NotNil(t, w)

	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	_, continueCh := bg.setBlockToReturn(ptr1, block1)

	w.Shutdown()
	block := &data.FileBlock{}
	ctx, cancel := context.WithCancel(context.Background())
	// Ensure the context loop is stopped so the test doesn't leak goroutines
	defer cancel()
	ch := q.Request(
		ctx, 1, makeKMD(), ptr1, block, data.NoCacheEntry, BlockRequestSolo)
	shutdown := false
	select {
	case <-ch:
		t.Fatal("Expected not to retrieve a result from the Request.")
	case continueCh <- nil:
		t.Fatal("Expected the block getter not to be receiving.")
	default:
		shutdown = true
	}
	require.True(t, shutdown)

	// Ensure the test completes in a reasonable time.
	timer := time.NewTimer(10 * time.Second)
	doneCh := make(chan struct{})
	go func() {
		w.Shutdown()
		close(doneCh)
	}()
	select {
	case <-timer.C:
		t.Fatal("Expected another Shutdown not to block.")
	case <-doneCh:
	}
}

func TestBlockRetrievalWorkerPrefetchedPriorityElevation(t *testing.T) {
	t.Log("Test that we can escalate the priority of a request and it " +
		"correctly switches workers.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		1, 1, 0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer endBlockRetrievalQueueTest(t, q)

	t.Log("Setup source blocks")
	ptr1, ptr2 := makeRandomBlockPointer(t), makeRandomBlockPointer(t)
	block1, block2 := makeFakeFileBlock(t, false), makeFakeFileBlock(t, false)
	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptr2, block2)

	t.Log("Make a low-priority request. This will get to the worker.")
	testBlock1 := &data.FileBlock{}
	req1Ch := q.Request(
		context.Background(), 1, makeKMD(), ptr1, testBlock1,
		data.NoCacheEntry, BlockRequestSolo)

	t.Log("Make another low-priority request. This will block.")
	testBlock2 := &data.FileBlock{}
	req2Ch := q.Request(
		context.Background(), 1, makeKMD(), ptr2, testBlock2,
		data.NoCacheEntry, BlockRequestSolo)

	t.Log("Make an on-demand request for the same block as the blocked " +
		"request.")
	testBlock3 := &data.FileBlock{}
	req3Ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority,
		makeKMD(), ptr2, testBlock3, data.NoCacheEntry, BlockRequestSolo)

	t.Log("Release the requests for the second block first. " +
		"Since the prefetch worker is still blocked, this confirms that the " +
		"escalation to an on-demand worker was successful.")
	continueCh2 <- nil
	err := <-req3Ch
	require.NoError(t, err)
	require.Equal(t, testBlock3, block2)
	err = <-req2Ch
	require.NoError(t, err)
	require.Equal(t, testBlock2, block2)

	t.Log("Allow the initial ptr1 request to complete.")
	continueCh1 <- nil
	err = <-req1Ch
	require.NoError(t, err)
	require.Equal(t, testBlock1, block1)
}

func TestBlockRetrievalWorkerStopIfFull(t *testing.T) {
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	dbc, dbcConfig := initDiskBlockCacheTest(t)
	defer dbc.Shutdown(ctx)

	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(
		1, 1, 0, newTestBlockRetrievalConfig(t, bg, dbc))
	require.NotNil(t, q)
	<-q.TogglePrefetcher(false, nil, nil)
	defer endBlockRetrievalQueueTest(t, q)

	ptr := makeRandomBlockPointer(t)
	syncCache := dbc.syncCache
	workingCache := dbc.workingSetCache

	t.Log("Set the cache maximum bytes to the current total.")
	syncBytes, workingBytes := testGetDiskCacheBytes(syncCache, workingCache)
	limiter := dbcConfig.DiskLimiter().(*backpressureDiskLimiter)
	setLimiterLimits(limiter, syncBytes, workingBytes)

	t.Log("Request with stop-if-full, when full")
	testBlock := &data.FileBlock{}
	req := q.Request(
		ctx, 1, makeKMD(), ptr, testBlock, data.NoCacheEntry,
		BlockRequestPrefetchUntilFull)
	select {
	case err := <-req:
		require.IsType(t, DiskCacheTooFullForBlockError{}, err)
	case <-ctx.Done():
		require.FailNow(t, ctx.Err().Error())
	}

	t.Log("Request without stop-if-full, when full")
	block := makeFakeFileBlock(t, false)
	startCh, continueCh := bg.setBlockToReturn(ptr, block)
	req = q.Request(
		ctx, 1, makeKMD(), ptr, testBlock, data.NoCacheEntry,
		BlockRequestSolo)
	<-startCh
	continueCh <- nil
	select {
	case err := <-req:
		require.NoError(t, err)
	case <-ctx.Done():
		require.FailNow(t, ctx.Err().Error())
	}
}
