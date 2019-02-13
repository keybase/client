// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"
	"testing"
	"time"

	"github.com/eapache/channels"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testBlockRetrievalConfig struct {
	codecGetter
	logMaker
	testCache BlockCache
	bg        blockGetter
	*testDiskBlockCacheGetter
	*testSyncedTlfGetterSetter
	initModeGetter
	clock Clock
}

func newTestBlockRetrievalConfig(t *testing.T, bg blockGetter,
	dbc DiskBlockCache) *testBlockRetrievalConfig {
	return &testBlockRetrievalConfig{
		newTestCodecGetter(),
		newTestLogMakerWithVDebug(t, "vlog2"),
		NewBlockCacheStandard(10, getDefaultCleanBlockCacheCapacity(NewInitModeFromType(InitDefault))),
		bg,
		newTestDiskBlockCacheGetter(t, dbc),
		newTestSyncedTlfGetterSetter(),
		testInitModeGetter{InitDefault},
		newTestClockNow(),
	}
}

func (c *testBlockRetrievalConfig) BlockCache() BlockCache {
	return c.testCache
}

func (c testBlockRetrievalConfig) DataVersion() DataVer {
	return ChildHolesDataVer
}

func (c testBlockRetrievalConfig) Clock() Clock {
	return c.clock
}

func (c testBlockRetrievalConfig) blockGetter() blockGetter {
	return c.bg
}

func makeRandomBlockPointer(t *testing.T) BlockPointer {
	id, err := kbfsblock.MakeTemporaryID()
	require.NoError(t, err)
	return BlockPointer{
		id,
		5,
		1,
		DirectBlock,
		kbfsblock.MakeContext(
			"fake creator",
			"fake writer",
			kbfsblock.RefNonce{0xb},
			keybase1.BlockType_DATA,
		),
	}
}

func makeKMD() KeyMetadata {
	return emptyKeyMetadata{tlf.FakeID(0, tlf.Private), 1}
}

func initBlockRetrievalQueueTest(t *testing.T) *blockRetrievalQueue {
	q := newBlockRetrievalQueue(
		0, 0, 0, newTestBlockRetrievalConfig(t, nil, nil))
	<-q.TogglePrefetcher(false, nil, nil)
	return q
}

func TestBlockRetrievalQueueBasic(t *testing.T) {
	t.Log("Add a block retrieval request to the queue and retrieve it.")
	q := initBlockRetrievalQueueTest(t)
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr1, block,
		NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the request.")
	br := q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, defaultOnDemandRequestPriority, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)
}

func TestBlockRetrievalQueuePreemptPriority(t *testing.T) {
	t.Log("Preempt a lower-priority block retrieval request with a higher " +
		"priority request.")
	q := initBlockRetrievalQueueTest(t)
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	ptr2 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 and a higher priority " +
		"retrieval for ptr2.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr1, block,
		NoCacheEntry, BlockRequestWithPrefetch)
	_ = q.Request(ctx, defaultOnDemandRequestPriority+1, makeKMD(), ptr2,
		block, NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the preempted ptr2 request.")
	br := q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority+1, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)

	t.Log("Begin working on the ptr1 request.")
	br = q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
}

func TestBlockRetrievalQueueInterleavedPreemption(t *testing.T) {
	t.Log("Handle a first request and then preempt another one.")
	q := initBlockRetrievalQueueTest(t)
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	ptr2 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 and ptr2.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr1, block,
		NoCacheEntry, BlockRequestWithPrefetch)
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr2, block,
		NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the ptr1 request.")
	br := q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)

	ptr3 := makeRandomBlockPointer(t)
	t.Log("Preempt the ptr2 request with the ptr3 request.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority+1, makeKMD(), ptr3,
		block, NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the ptr3 request.")
	br = q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr3, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority+1, br.priority)
	require.Equal(t, uint64(2), br.insertionOrder)

	t.Log("Begin working on the ptr2 request.")
	br = q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
}

func TestBlockRetrievalQueueMultipleRequestsSameBlock(t *testing.T) {
	t.Log("Request the same block multiple times.")
	q := initBlockRetrievalQueueTest(t)
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 twice.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr1, block,
		NoCacheEntry, BlockRequestWithPrefetch)
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr1, block,
		NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has 2 requests and that the queue is now empty.")
	br := q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, defaultOnDemandRequestPriority, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)
	require.Len(t, *q.heap, 0)
	require.Equal(t, block, br.requests[0].block)
	require.Equal(t, block, br.requests[1].block)
}

func TestBlockRetrievalQueueElevatePriorityExistingRequest(t *testing.T) {
	t.Log("Elevate the priority on an existing request.")
	q := initBlockRetrievalQueueTest(t)
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	ptr2 := makeRandomBlockPointer(t)
	ptr3 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request 3 block retrievals, each preempting the previous one.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr1, block,
		NoCacheEntry, BlockRequestWithPrefetch)
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority+1, makeKMD(), ptr2,
		block, NoCacheEntry, BlockRequestWithPrefetch)
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority+2, makeKMD(), ptr3,
		block, NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the ptr3 retrieval.")
	br := q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr3, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority+2, br.priority)
	require.Equal(t, uint64(2), br.insertionOrder)

	t.Log("Preempt the remaining retrievals with another retrieval for ptr1.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority+2, makeKMD(), ptr1,
		block, NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has increased in priority and has 2 requests.")
	br = q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority+2, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)

	t.Log("Begin working on the ptr2 retrieval.")
	br = q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, defaultOnDemandRequestPriority+1, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
}

func TestBlockRetrievalQueueCurrentlyProcessingRequest(t *testing.T) {
	t.Log("Begin processing a request and then add another one for the same block.")
	q := initBlockRetrievalQueueTest(t)
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority, makeKMD(), ptr1, block,
		NoCacheEntry, BlockRequestWithPrefetch)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has 1 request.")
	br := q.popIfNotEmpty()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, defaultOnDemandRequestPriority, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)

	t.Log("Request another block retrieval for ptr1 before it has finished. " +
		"Verify that the priority has elevated and there are now 2 requests.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority+1, makeKMD(), ptr1,
		block, NoCacheEntry, BlockRequestWithPrefetch)
	require.Equal(t, defaultOnDemandRequestPriority+1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)
	require.Equal(t, block, br.requests[0].block)
	require.Equal(t, block, br.requests[1].block)

	t.Log("Finalize the existing request for ptr1.")
	q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, nil)
	t.Log("Make another request for the same block. Verify that this is a new request.")
	_ = q.Request(
		ctx, defaultOnDemandRequestPriority+1, makeKMD(), ptr1,
		block, NoCacheEntry, BlockRequestWithPrefetch)
	br = q.popIfNotEmpty()
	defer q.FinalizeRequest(br, &FileBlock{}, DiskBlockAnyCache, io.EOF)
	require.Equal(t, defaultOnDemandRequestPriority+1, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)
}

func TestBlockRetrievalQueueThrottling(t *testing.T) {
	t.Log("Start test with no throttling channel so we can pass in our own")
	q := initBlockRetrievalQueueTest(t)
	require.NotNil(t, q)
	defer q.Shutdown()

	throttleCh := channels.NewInfiniteChannel()
	q.throttledWorkCh = throttleCh

	t.Log("Make a few throttled requests that won't be serviced until we " +
		"start the background loop.")

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	block1 := &FileBlock{}
	_ = q.Request(
		ctx, throttleRequestPriority, makeKMD(), ptr1, block1,
		NoCacheEntry, BlockRequestSolo)
	ptr2 := makeRandomBlockPointer(t)
	block2 := &FileBlock{}
	_ = q.Request(
		ctx, throttleRequestPriority-100, makeKMD(), ptr2, block2,
		NoCacheEntry, BlockRequestSolo)

	t.Log("Make sure they are queued to be throttled")
	require.Equal(t, 2, throttleCh.Len())

	t.Log("Start background loop with short period")
	go q.throttleReleaseLoop(1 * time.Millisecond)
	ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()
	for throttleCh.Len() > 0 {
		time.Sleep(1 * time.Millisecond)
		select {
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		default:
		}
	}
}
