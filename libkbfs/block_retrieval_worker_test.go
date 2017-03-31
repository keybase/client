// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"crypto/rand"
	"errors"
	"sync"
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// blockReturner contains a block value to copy into requested blocks, and a
// channel to synchronize on with the worker.
type blockReturner struct {
	block      Block
	continueCh chan error
	startCh    chan struct{}
}

// fakeBlockGetter allows specifying and obtaining fake blocks.
type fakeBlockGetter struct {
	mtx           sync.RWMutex
	blockMap      map[BlockPointer]blockReturner
	codec         kbfscodec.Codec
	respectCancel bool
}

// newFakeBlockGetter returns a fakeBlockGetter.
func newFakeBlockGetter(respectCancel bool) *fakeBlockGetter {
	return &fakeBlockGetter{
		blockMap:      make(map[BlockPointer]blockReturner),
		codec:         kbfscodec.NewMsgpack(),
		respectCancel: respectCancel,
	}
}

// setBlockToReturn sets the block that will be returned for a given
// BlockPointer. Returns a writeable channel that getBlock will wait on, to
// allow synchronization of tests.
func (bg *fakeBlockGetter) setBlockToReturn(blockPtr BlockPointer, block Block) (startCh <-chan struct{}, continueCh chan<- error) {
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
func (bg *fakeBlockGetter) getBlock(ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer, block Block) error {
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
			return kbfscodec.Update(bg.codec, block, source.block)
		case <-cancelCh:
			return ctx.Err()
		}
	}
}

func (bg *fakeBlockGetter) assembleBlock(ctx context.Context,
	kmd KeyMetadata, ptr BlockPointer, block Block, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	source, ok := bg.blockMap[ptr]
	if !ok {
		return errors.New("Block doesn't exist in fake block map")
	}
	block.Set(source.block)
	return nil
}

func makeFakeFileBlock(t *testing.T, doHash bool) *FileBlock {
	buf := make([]byte, 16)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	block := &FileBlock{
		Contents: buf,
	}
	if doHash {
		_ = block.GetHash()
	}
	return block
}

func TestBlockRetrievalWorkerBasic(t *testing.T) {
	t.Log("Test the basic ability of a worker to return a block.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer q.Shutdown()

	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, w)
	defer w.Shutdown()

	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)

	block := &FileBlock{}
	ch := q.Request(context.Background(), 1, makeKMD(), ptr1, block, NoCacheEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}

func TestBlockRetrievalWorkerMultipleWorkers(t *testing.T) {
	t.Log("Test the ability of multiple workers to retrieve concurrently.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(2, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer q.Shutdown()

	ptr1, ptr2 := makeRandomBlockPointer(t), makeRandomBlockPointer(t)
	block1, block2 := makeFakeFileBlock(t, false), makeFakeFileBlock(t, false)
	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptr2, block2)

	t.Log("Make 2 requests for 2 different blocks")
	block := &FileBlock{}
	req1Ch := q.Request(context.Background(), 1, makeKMD(), ptr1, block, NoCacheEntry)
	req2Ch := q.Request(context.Background(), 1, makeKMD(), ptr2, block, NoCacheEntry)

	t.Log("Allow the second request to complete before the first")
	continueCh2 <- nil
	err := <-req2Ch
	require.NoError(t, err)
	require.Equal(t, block2, block)

	t.Log("Make another request for ptr2")
	req2Ch = q.Request(context.Background(), 1, makeKMD(), ptr2, block, NoCacheEntry)
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
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer q.Shutdown()

	ptr1, ptr2, ptr3 := makeRandomBlockPointer(t), makeRandomBlockPointer(t), makeRandomBlockPointer(t)
	block1, block2, block3 := makeFakeFileBlock(t, false), makeFakeFileBlock(t, false), makeFakeFileBlock(t, false)
	startCh1, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptr2, block2)
	_, continueCh3 := bg.setBlockToReturn(ptr3, block3)

	t.Log("Make 3 retrievals for 3 different blocks. All retrievals after the first should be queued.")
	block := &FileBlock{}
	testBlock1 := &FileBlock{}
	testBlock2 := &FileBlock{}
	req1Ch := q.Request(context.Background(), 1, makeKMD(), ptr1, block, NoCacheEntry)
	req2Ch := q.Request(context.Background(), 1, makeKMD(), ptr2, block, NoCacheEntry)
	req3Ch := q.Request(context.Background(), 1, makeKMD(), ptr3, testBlock1, NoCacheEntry)
	// Ensure the worker picks up the first request
	<-startCh1
	t.Log("Make a high priority request for the third block, which should complete next.")
	req4Ch := q.Request(context.Background(), 2, makeKMD(), ptr3, testBlock2, NoCacheEntry)

	t.Log("Allow the ptr1 retrieval to complete.")
	continueCh1 <- nil
	err := <-req1Ch
	require.NoError(t, err)
	require.Equal(t, block1, block)

	t.Log("Allow the ptr3 retrieval to complete. Both waiting requests should complete.")
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
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer q.Shutdown()

	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, w)
	defer w.Shutdown()

	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	_, _ = bg.setBlockToReturn(ptr1, block1)

	block := &FileBlock{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ch := q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)
	err := <-ch
	require.EqualError(t, err, context.Canceled.Error())
}

func TestBlockRetrievalWorkerShutdown(t *testing.T) {
	t.Log("Test that worker shutdown works.")
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(0, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer q.Shutdown()

	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, w)

	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	_, continueCh := bg.setBlockToReturn(ptr1, block1)

	w.Shutdown()
	block := &FileBlock{}
	ctx, cancel := context.WithCancel(context.Background())
	// Ensure the context loop is stopped so the test doesn't leak goroutines
	defer cancel()
	ch := q.Request(ctx, 1, makeKMD(), ptr1, block, NoCacheEntry)
	shutdown := false
	select {
	case <-ch:
	case continueCh <- nil:
	default:
		shutdown = true
	}
	require.True(t, shutdown)
	w.Shutdown()
	require.True(t, shutdown)
}

func TestBlockRetrievalWorkerMultipleBlockTypes(t *testing.T) {
	t.Log("Test that we can retrieve the same block into different block types.")
	codec := kbfscodec.NewMsgpack()
	bg := newFakeBlockGetter(false)
	q := newBlockRetrievalQueue(1, newTestBlockRetrievalConfig(t, bg, nil))
	require.NotNil(t, q)
	defer q.Shutdown()

	t.Log("Setup source blocks")
	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	testCommonBlock := &CommonBlock{}
	err := kbfscodec.Update(codec, testCommonBlock, block1)
	require.NoError(t, err)

	t.Log("Make a retrieval for the same block twice, but with a different target block type.")
	testBlock1 := &FileBlock{}
	testBlock2 := &CommonBlock{}
	req1Ch := q.Request(context.Background(), 1, makeKMD(), ptr1, testBlock1, NoCacheEntry)
	req2Ch := q.Request(context.Background(), 1, makeKMD(), ptr1, testBlock2, NoCacheEntry)

	t.Log("Allow the first ptr1 retrieval to complete.")
	continueCh1 <- nil
	err = <-req1Ch
	require.NoError(t, err)
	require.Equal(t, testBlock1, block1)

	t.Log("Allow the second ptr1 retrieval to complete.")
	continueCh1 <- nil
	err = <-req2Ch
	require.NoError(t, err)
	require.Equal(t, testBlock2, testCommonBlock)
}
