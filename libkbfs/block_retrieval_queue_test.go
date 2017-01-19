// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testBlockRetrievalConfig struct {
	testCodec kbfscodec.Codec
	testCache BlockCache
	t         *testing.T
}

func newTestBlockRetrievalConfig(t *testing.T) *testBlockRetrievalConfig {
	return &testBlockRetrievalConfig{
		kbfscodec.NewMsgpack(),
		NewBlockCacheStandard(10, getDefaultCleanBlockCacheCapacity()),
		t,
	}
}

func (c *testBlockRetrievalConfig) codec() kbfscodec.Codec {
	return c.testCodec
}

func (c *testBlockRetrievalConfig) BlockCache() BlockCache {
	return c.testCache
}

func (c *testBlockRetrievalConfig) MakeLogger(_ string) logger.Logger {
	return logger.NewTestLogger(c.t)
}

func (c testBlockRetrievalConfig) DataVersion() DataVer {
	return FilesWithHolesDataVer
}

func makeRandomBlockPointer(t *testing.T) BlockPointer {
	id, err := kbfsblock.MakeTemporaryID()
	require.NoError(t, err)
	return BlockPointer{
		id,
		5,
		1,
		kbfsblock.MakeContext(
			"fake creator",
			"fake writer",
			kbfsblock.RefNonce{0xb},
		),
	}
}

func makeKMD() KeyMetadata {
	return emptyKeyMetadata{tlf.FakeID(0, false), 1}
}

func makeBlockCache() func() BlockCache {
	cache := NewBlockCacheStandard(10, getDefaultCleanBlockCacheCapacity())
	return func() BlockCache {
		return cache
	}
}

func TestBlockRetrievalQueueBasic(t *testing.T) {
	t.Log("Add a block retrieval request to the queue and retrieve it.")
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t))
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1.")
	_ = q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)

	t.Log("Begin working on the request.")
	br := <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)
}

func TestBlockRetrievalQueuePreemptPriority(t *testing.T) {
	t.Log("Preempt a lower-priority block retrieval request with a higher priority request.")
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t))
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	ptr2 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 and a higher priority retrieval for ptr2.")
	_ = q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)
	_ = q.Request(ctx, 2, makeKMD(), ptr2, block, NoCacheEntry)

	t.Log("Begin working on the preempted ptr2 request.")
	br := <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)

	t.Log("Begin working on the ptr1 request.")
	br = <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
}

func TestBlockRetrievalQueueInterleavedPreemption(t *testing.T) {
	t.Log("Handle a first request and then preempt another one.")
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t))
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	ptr2 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 and ptr2.")
	_ = q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)
	_ = q.Request(ctx, 1, makeKMD(), ptr2, block, NoCacheEntry)

	t.Log("Begin working on the ptr1 request.")
	br := <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)

	ptr3 := makeRandomBlockPointer(t)
	t.Log("Preempt the ptr2 request with the ptr3 request.")
	_ = q.Request(ctx, 2, makeKMD(), ptr3, block, NoCacheEntry)

	t.Log("Begin working on the ptr3 request.")
	br = <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr3, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(2), br.insertionOrder)

	t.Log("Begin working on the ptr2 request.")
	br = <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
}

func TestBlockRetrievalQueueMultipleRequestsSameBlock(t *testing.T) {
	t.Log("Request the same block multiple times.")
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t))
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 twice.")
	_ = q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)
	_ = q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has 2 requests and that the queue is now empty.")
	br := <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)
	require.Len(t, *q.heap, 0)
	require.Equal(t, block, br.requests[0].block)
	require.Equal(t, block, br.requests[1].block)
}

func TestBlockRetrievalQueueElevatePriorityExistingRequest(t *testing.T) {
	t.Log("Elevate the priority on an existing request.")
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t))
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	ptr2 := makeRandomBlockPointer(t)
	ptr3 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request 3 block retrievals, each preempting the previous one.")
	_ = q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)
	_ = q.Request(ctx, 2, makeKMD(), ptr2, block, NoCacheEntry)
	_ = q.Request(ctx, 3, makeKMD(), ptr3, block, NoCacheEntry)

	t.Log("Begin working on the ptr3 retrieval.")
	br := <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr3, br.blockPtr)
	require.Equal(t, 3, br.priority)
	require.Equal(t, uint64(2), br.insertionOrder)

	t.Log("Preempt the remaining retrievals with another retrieval for ptr1.")
	_ = q.Request(ctx, 3, makeKMD(), ptr1, block, NoCacheEntry)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has increased in priority and has 2 requests.")
	br = <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 3, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)

	t.Log("Begin working on the ptr2 retrieval.")
	br = <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
}

func TestBlockRetrievalQueueCurrentlyProcessingRequest(t *testing.T) {
	t.Log("Begin processing a request and then add another one for the same block.")
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t))
	require.NotNil(t, q)
	defer q.Shutdown()

	ctx := context.Background()
	ptr1 := makeRandomBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1.")
	_ = q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has 1 request.")
	br := <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)

	t.Log("Request another block retrieval for ptr1 before it has finished. Verify that the priority is unchanged but there are now 2 requests.")
	_ = q.Request(ctx, 2, makeKMD(), ptr1, block, NoCacheEntry)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)
	require.Equal(t, block, br.requests[0].block)
	require.Equal(t, block, br.requests[1].block)

	t.Log("Finalize the existing request for ptr1.")
	q.FinalizeRequest(br, &FileBlock{}, nil)
	t.Log("Make another request for the same block. Verify that this is a new request.")
	_ = q.Request(ctx, 2, makeKMD(), ptr1, block, NoCacheEntry)
	br = <-q.WorkOnRequest()
	defer q.FinalizeRequest(br, &FileBlock{}, io.EOF)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)
}
