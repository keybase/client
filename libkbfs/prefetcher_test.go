package libkbfs

import (
	"context"
	"testing"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/stretchr/testify/require"
)

func makeFakeIndirectFilePtr(t *testing.T, off int64) IndirectFilePtr {
	return IndirectFilePtr{
		makeFakeBlockInfo(t),
		off,
		false,
		codec.UnknownFieldSetHandler{},
	}
}

func makeFakeIndirectDirPtr(t *testing.T, off string) IndirectDirPtr {
	return IndirectDirPtr{
		makeFakeBlockInfo(t),
		off,
		codec.UnknownFieldSetHandler{},
	}
}

func makeFakeDirBlock(t *testing.T, name string) *DirBlock {
	return &DirBlock{
		CommonBlock{},
		map[string]DirEntry{
			name: makeFakeDirEntry(t, Dir, 100),
		},
		nil,
	}
}

func initPrefetcherTest(t *testing.T) (Prefetcher, *blockRetrievalQueue, *blockRetrievalWorker, *fakeBlockGetter, func() BlockCache) {
	cacheFunc := makeBlockCache()
	q := newBlockRetrievalQueue(1, kbfscodec.NewMsgpack(), cacheFunc)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, w)

	p := newBlockPrefetcher(q)
	require.NotNil(t, q)
	q.prefetcher = p

	return p, q, w, bg, cacheFunc
}

func shutdownPrefetcherTest(q *blockRetrievalQueue, w *blockRetrievalWorker) {
	q.Shutdown()
	w.Shutdown()
}

func TestPrefetcherIndirectFileBlock(t *testing.T) {
	t.Log("Test indirect file block prefetching.")
	p, q, w, bg, cacheFunc := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q, w)

	t.Log("Initialize an indirect file block pointing to 2 file data blocks.")
	ptrs := []IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 0),
		makeFakeIndirectFilePtr(t, 150),
	}
	ptr1 := makeFakeBlockPointer(t)
	block1 := &FileBlock{IPtrs: ptrs}
	block1.IsInd = true
	block2 := makeFakeFileBlock(t, true)
	block3 := makeFakeFileBlock(t, true)

	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptrs[0].BlockPointer, block2)
	_, continueCh3 := bg.setBlockToReturn(ptrs[1].BlockPointer, block3)

	var block Block = &FileBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)

	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	continueCh2 <- nil
	continueCh3 <- nil
	<-p.Shutdown()

	t.Log("Ensure that the prefetched blocks are in the cache.")
	block, err = cacheFunc().Get(ptr1)
	require.NoError(t, err)
	require.Equal(t, block1, block)
	block, err = cacheFunc().Get(ptrs[0].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, block2, block)
	block, err = cacheFunc().Get(ptrs[1].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, block3, block)
}

func TestPrefetcherIndirectDirBlock(t *testing.T) {
	t.Log("Test indirect dir block prefetching.")
	p, q, w, bg, cacheFunc := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q, w)

	t.Log("Initialize an indirect dir block pointing to 2 dir data blocks.")
	ptrs := []IndirectDirPtr{
		makeFakeIndirectDirPtr(t, "a"),
		makeFakeIndirectDirPtr(t, "b"),
	}
	ptr1 := makeFakeBlockPointer(t)
	block1 := &DirBlock{IPtrs: ptrs}
	block1.IsInd = true
	block2 := makeFakeDirBlock(t, "a")
	block3 := makeFakeDirBlock(t, "b")

	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptrs[0].BlockPointer, block2)
	_, continueCh3 := bg.setBlockToReturn(ptrs[1].BlockPointer, block3)

	var block Block = &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)

	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	continueCh2 <- nil
	continueCh3 <- nil
	<-p.Shutdown()

	t.Log("Ensure that the prefetched blocks are in the cache.")
	block, err = cacheFunc().Get(ptr1)
	require.NoError(t, err)
	require.Equal(t, block1, block)
	block, err = cacheFunc().Get(ptrs[0].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, block2, block)
	block, err = cacheFunc().Get(ptrs[1].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, block3, block)
}

func TestPrefetcherDirectDirBlock(t *testing.T) {
	t.Log("Test direct dir block prefetching.")
	p, q, w, bg, cacheFunc := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q, w)

	t.Log("Initialize a direct dir block with entries pointing to 3 files.")
	file1 := makeFakeFileBlock(t, true)
	file2 := makeFakeFileBlock(t, true)
	ptr1 := makeFakeBlockPointer(t)
	dir1 := &DirBlock{Children: map[string]DirEntry{
		"a": makeFakeDirEntry(t, File, 100),
		"b": makeFakeDirEntry(t, Dir, 60),
		"c": makeFakeDirEntry(t, Exec, 20),
	}}
	dir2 := &DirBlock{Children: map[string]DirEntry{
		"d": makeFakeDirEntry(t, File, 100),
	}}
	file3 := makeFakeFileBlock(t, true)

	_, continueCh1 := bg.setBlockToReturn(ptr1, dir1)
	_, continueCh2 := bg.setBlockToReturn(dir1.Children["a"].BlockPointer, file1)
	_, continueCh3 := bg.setBlockToReturn(dir1.Children["b"].BlockPointer, dir2)
	_, continueCh4 := bg.setBlockToReturn(dir1.Children["c"].BlockPointer, file2)
	_, _ = bg.setBlockToReturn(dir2.Children["d"].BlockPointer, file3)

	var block Block = &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, dir1, block)

	t.Log("Release the blocks in ascending order of their size. The largest block will error.")
	continueCh4 <- nil
	continueCh3 <- nil
	continueCh2 <- context.Canceled
	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	<-p.Shutdown()

	t.Log("Ensure that the prefetched blocks are in the cache.")
	block, err = cacheFunc().Get(ptr1)
	require.NoError(t, err)
	require.Equal(t, dir1, block)
	block, err = cacheFunc().Get(dir1.Children["c"].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, file2, block)
	block, err = cacheFunc().Get(dir1.Children["b"].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, dir2, block)
	t.Log("Ensure that the largest block isn't in the cache.")
	block, err = cacheFunc().Get(dir1.Children["a"].BlockPointer)
	require.EqualError(t, err, NoSuchBlockError{dir1.Children["a"].BlockPointer.ID}.Error())
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	block, err = cacheFunc().Get(dir2.Children["d"].BlockPointer)
	require.EqualError(t, err, NoSuchBlockError{dir2.Children["d"].BlockPointer.ID}.Error())
}
