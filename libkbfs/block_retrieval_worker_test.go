// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"crypto/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func makeFakeFileBlock(t *testing.T) *FileBlock {
	buf := make([]byte, 16)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	return &FileBlock{
		Contents: buf,
	}
}

func TestBlockRetrievalWorkerBasic(t *testing.T) {
	t.Log("Test the basic ability of a worker to return a block.")
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, q)
	require.NotNil(t, w)

	ptr1 := makeFakeBlockPointer(t)
	block1 := makeFakeFileBlock(t)
	ch1 := bg.setBlockToReturn(ptr1, block1)

	block := &FileBlock{}
	ch := q.Request(context.Background(), 1, ptr1, block)
	ch1 <- struct{}{}
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}

func TestBlockRetrievalWorkerMultipleWorkers(t *testing.T) {
	t.Log("Test the ability of multiple workers to retrieve concurrently.")
	q := newBlockRetrievalQueue(2)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w1 := newBlockRetrievalWorker(bg, q)
	w2 := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, q)
	require.NotNil(t, w1)
	require.NotNil(t, w2)

	ptr1, ptr2 := makeFakeBlockPointer(t), makeFakeBlockPointer(t)
	block1, block2 := makeFakeFileBlock(t), makeFakeFileBlock(t)
	ch1 := bg.setBlockToReturn(ptr1, block1)
	ch2 := bg.setBlockToReturn(ptr2, block2)

	t.Log("Make 2 requests for 2 different blocks")
	block := &FileBlock{}
	req1Ch := q.Request(context.Background(), 1, ptr1, block)
	req2Ch := q.Request(context.Background(), 1, ptr2, block)

	t.Log("Allow the second request to complete before the first")
	ch2 <- struct{}{}
	err := <-req2Ch
	require.NoError(t, err)
	require.Equal(t, block2, block)

	t.Log("Make another request for ptr2")
	req2Ch = q.Request(context.Background(), 1, ptr2, block)
	ch2 <- struct{}{}
	err = <-req2Ch
	require.NoError(t, err)
	require.Equal(t, block2, block)

	t.Log("Complete the ptr1 request")
	ch1 <- struct{}{}
	err = <-req1Ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}

func TestBlockRetrievalWorkerWithQueue(t *testing.T) {
	t.Log("Test the ability of a worker and queue to work correctly together.")
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w1 := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, q)
	require.NotNil(t, w1)

	ptr1, ptr2, ptr3 := makeFakeBlockPointer(t), makeFakeBlockPointer(t), makeFakeBlockPointer(t)
	block1, block2, block3 := makeFakeFileBlock(t), makeFakeFileBlock(t), makeFakeFileBlock(t)
	ch1 := bg.setBlockToReturn(ptr1, block1)
	ch2 := bg.setBlockToReturn(ptr2, block2)
	ch3 := bg.setBlockToReturn(ptr3, block3)

	t.Log("Make 3 retrievals for 3 different blocks. All retrievals after the first should be queued.")
	block := &FileBlock{}
	testBlock1 := &FileBlock{}
	testBlock2 := &FileBlock{}
	req1Ch := q.Request(context.Background(), 1, ptr1, block)
	req2Ch := q.Request(context.Background(), 1, ptr2, block)
	req3Ch := q.Request(context.Background(), 1, ptr3, testBlock1)
	// Ensure the worker picks up the request
	time.Sleep(50 * time.Millisecond)
	t.Log("Make a high priority request for the third block, which should complete next.")
	req4Ch := q.Request(context.Background(), 2, ptr3, testBlock2)

	t.Log("Allow the ptr1 retrieval to complete.")
	ch1 <- struct{}{}
	err := <-req1Ch
	require.NoError(t, err)
	require.Equal(t, block1, block)

	t.Log("Allow the ptr3 retrieval to complete. Both waiting requests should complete.")
	ch3 <- struct{}{}
	err1 := <-req3Ch
	err2 := <-req4Ch
	require.NoError(t, err1)
	require.NoError(t, err2)
	require.Equal(t, block3, testBlock1)
	require.Equal(t, block3, testBlock2)

	t.Log("Complete the ptr1 retrieval.")
	ch2 <- struct{}{}
	err = <-req2Ch
	require.NoError(t, err)
	require.Equal(t, block2, block)
}

func TestBlockRetrievalWorkerCancel(t *testing.T) {
	t.Log("Test the ability of a worker to handle a request cancelation.")
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, q)
	require.NotNil(t, w)

	ptr1 := makeFakeBlockPointer(t)
	block1 := makeFakeFileBlock(t)
	_ = bg.setBlockToReturn(ptr1, block1)

	block := &FileBlock{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ch := q.Request(ctx, 1, ptr1, block)
	err := <-ch
	require.EqualError(t, err, context.Canceled.Error())
}

func TestBlockRetrievalWorkerShutdown(t *testing.T) {
	t.Log("Test that worker shutdown works.")
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, q)
	require.NotNil(t, w)

	ptr1 := makeFakeBlockPointer(t)
	block1 := makeFakeFileBlock(t)
	reqCh := bg.setBlockToReturn(ptr1, block1)

	w.Shutdown()
	block := &FileBlock{}
	ch := q.Request(context.Background(), 1, ptr1, block)
	shutdown := false
	select {
	case <-ch:
	case reqCh <- struct{}{}:
	default:
		shutdown = true
	}
	require.True(t, shutdown)
	w.Shutdown()
	require.True(t, shutdown)
}
