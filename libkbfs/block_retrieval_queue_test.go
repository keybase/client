// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestBlockRetrievalQueueBasic(t *testing.T) {
	t.Log("Add a block retrieval request to the queue and retrieve it.")
	q := newBlockRetrievalQueue(1, kbfscodec.NewMsgpack())
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1.")
	_ = q.Request(ctx, 1, nil, ptr1, block)

	t.Log("Begin working on the request.")
	br := <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)
}

func TestBlockRetrievalQueuePreemptPriority(t *testing.T) {
	t.Log("Preempt a lower-priority block retrieval request with a higher priority request.")
	q := newBlockRetrievalQueue(1, kbfscodec.NewMsgpack())
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	ptr2 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 and a higher priority retrieval for ptr2.")
	_ = q.Request(ctx, 1, nil, ptr1, block)
	_ = q.Request(ctx, 2, nil, ptr2, block)

	t.Log("Begin working on the preempted ptr2 request.")
	br := <-q.WorkOnRequest()
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)

	t.Log("Begin working on the ptr1 request.")
	br = <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
}

func TestBlockRetrievalQueueInterleavedPreemption(t *testing.T) {
	t.Log("Handle a first request and then preempt another one.")
	q := newBlockRetrievalQueue(1, kbfscodec.NewMsgpack())
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	ptr2 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 and ptr2.")
	_ = q.Request(ctx, 1, nil, ptr1, block)
	_ = q.Request(ctx, 1, nil, ptr2, block)

	t.Log("Begin working on the ptr1 request.")
	br := <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)

	ptr3 := makeFakeBlockPointer(t)
	t.Log("Preempt the ptr2 request with the ptr3 request.")
	_ = q.Request(ctx, 2, nil, ptr3, block)

	t.Log("Begin working on the ptr3 request.")
	br = <-q.WorkOnRequest()
	require.Equal(t, ptr3, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(2), br.insertionOrder)

	t.Log("Begin working on the ptr2 request.")
	br = <-q.WorkOnRequest()
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
}

func TestBlockRetrievalQueueMultipleRequestsSameBlock(t *testing.T) {
	t.Log("Request the same block multiple times.")
	q := newBlockRetrievalQueue(1, kbfscodec.NewMsgpack())
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1 twice.")
	_ = q.Request(ctx, 1, nil, ptr1, block)
	_ = q.Request(ctx, 1, nil, ptr1, block)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has 2 requests and that the queue is now empty.")
	br := <-q.WorkOnRequest()
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
	q := newBlockRetrievalQueue(1, kbfscodec.NewMsgpack())
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	ptr2 := makeFakeBlockPointer(t)
	ptr3 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request 3 block retrievals, each preempting the previous one.")
	_ = q.Request(ctx, 1, nil, ptr1, block)
	_ = q.Request(ctx, 2, nil, ptr2, block)
	_ = q.Request(ctx, 3, nil, ptr3, block)

	t.Log("Begin working on the ptr3 retrieval.")
	br := <-q.WorkOnRequest()
	require.Equal(t, ptr3, br.blockPtr)
	require.Equal(t, 3, br.priority)
	require.Equal(t, uint64(2), br.insertionOrder)

	t.Log("Preempt the remaining retrievals with another retrieval for ptr1.")
	_ = q.Request(ctx, 3, nil, ptr1, block)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has increased in priority and has 2 requests.")
	br = <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 3, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)

	t.Log("Begin working on the ptr2 retrieval.")
	br = <-q.WorkOnRequest()
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
}

func TestBlockRetrievalQueueCurrentlyProcessingRequest(t *testing.T) {
	t.Log("Begin processing a request and then add another one for the same block.")
	q := newBlockRetrievalQueue(1, kbfscodec.NewMsgpack())
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	t.Log("Request a block retrieval for ptr1.")
	_ = q.Request(ctx, 1, nil, ptr1, block)

	t.Log("Begin working on the ptr1 retrieval. Verify that it has 1 request.")
	br := <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)

	t.Log("Request another block retrieval for ptr1 before it has finished. Verify that the priority is unchanged but there are now 2 requests.")
	_ = q.Request(ctx, 2, nil, ptr1, block)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 2)
	require.Equal(t, block, br.requests[0].block)
	require.Equal(t, block, br.requests[1].block)

	t.Log("Finalize the existing request for ptr1.")
	q.FinalizeRequest(br, nil, nil)
	t.Log("Make another request for the same block. Verify that this is a new request.")
	_ = q.Request(ctx, 2, nil, ptr1, block)
	br = <-q.WorkOnRequest()
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)
}
