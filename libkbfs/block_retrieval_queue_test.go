package libkbfs

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestBlockRetrievalQueueBasic(t *testing.T) {
	t.Log("Add a block retrieval request to the queue and retrieve it")
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	_ = q.Request(ctx, 1, ptr1, block)

	br := <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, -1, br.index)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
	require.Len(t, br.requests, 1)
	require.Equal(t, block, br.requests[0].block)
}

func TestBlockRetrievalQueuePreemptPriority(t *testing.T) {
	t.Log("Preempt a lower-priority block retrieval request with a higher priority request")
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	ptr2 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	_ = q.Request(ctx, 1, ptr1, block)
	_ = q.Request(ctx, 2, ptr2, block)

	br := <-q.WorkOnRequest()
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)

	br = <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)
}

func TestBlockRetrievalQueueInterleavedPreemption(t *testing.T) {
	t.Log("Handle a first request and then preempt another one")
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	ctx := context.Background()
	ptr1 := makeFakeBlockPointer(t)
	ptr2 := makeFakeBlockPointer(t)
	block := &FileBlock{}
	_ = q.Request(ctx, 1, ptr1, block)
	_ = q.Request(ctx, 1, ptr2, block)

	br := <-q.WorkOnRequest()
	require.Equal(t, ptr1, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(0), br.insertionOrder)

	ptr3 := makeFakeBlockPointer(t)
	_ = q.Request(ctx, 2, ptr3, block)

	br = <-q.WorkOnRequest()
	require.Equal(t, ptr3, br.blockPtr)
	require.Equal(t, 2, br.priority)
	require.Equal(t, uint64(2), br.insertionOrder)

	br = <-q.WorkOnRequest()
	require.Equal(t, ptr2, br.blockPtr)
	require.Equal(t, 1, br.priority)
	require.Equal(t, uint64(1), br.insertionOrder)
}
