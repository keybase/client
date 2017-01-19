// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"

	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func makeRandomBlockInfo(t *testing.T) BlockInfo {
	return BlockInfo{
		makeRandomBlockPointer(t),
		150,
	}
}

func makeRandomDirEntry(t *testing.T, typ EntryType, size uint64, path string) DirEntry {
	return DirEntry{
		makeRandomBlockInfo(t),
		EntryInfo{
			typ,
			size,
			path,
			101,
			102,
		},
		codec.UnknownFieldSetHandler{},
	}
}
func makeFakeIndirectFilePtr(t *testing.T, off int64) IndirectFilePtr {
	return IndirectFilePtr{
		makeRandomBlockInfo(t),
		off,
		false,
		codec.UnknownFieldSetHandler{},
	}
}

func makeFakeIndirectDirPtr(t *testing.T, off string) IndirectDirPtr {
	return IndirectDirPtr{
		makeRandomBlockInfo(t),
		off,
		codec.UnknownFieldSetHandler{},
	}
}

func makeFakeDirBlock(t *testing.T, name string) *DirBlock {
	return &DirBlock{Children: map[string]DirEntry{
		name: makeRandomDirEntry(t, Dir, 100, name),
	}}
}

func initPrefetcherTest(t *testing.T) (*blockRetrievalQueue, *blockRetrievalWorker, *fakeBlockGetter, func() BlockCache) {
	config := newTestBlockRetrievalConfig(t)
	q := newBlockRetrievalQueue(1, config)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, w)

	return q, w, bg, config.BlockCache
}

func shutdownPrefetcherTest(q *blockRetrievalQueue, w *blockRetrievalWorker) {
	q.Shutdown()
	w.Shutdown()
}

func TestPrefetcherIndirectFileBlock(t *testing.T) {
	t.Log("Test indirect file block prefetching.")
	q, w, bg, cacheFunc := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q, w)

	t.Log("Initialize an indirect file block pointing to 2 file data blocks.")
	ptrs := []IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 0),
		makeFakeIndirectFilePtr(t, 150),
	}
	ptr1 := makeRandomBlockPointer(t)
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
	<-q.Prefetcher().Shutdown()

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
	q, w, bg, cacheFunc := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q, w)

	t.Log("Initialize an indirect dir block pointing to 2 dir data blocks.")
	ptrs := []IndirectDirPtr{
		makeFakeIndirectDirPtr(t, "a"),
		makeFakeIndirectDirPtr(t, "b"),
	}
	ptr1 := makeRandomBlockPointer(t)
	block1 := &DirBlock{IPtrs: ptrs, Children: make(map[string]DirEntry)}
	block1.IsInd = true
	block2 := makeFakeDirBlock(t, "a")
	block3 := makeFakeDirBlock(t, "b")

	_, continueCh1 := bg.setBlockToReturn(ptr1, block1)
	_, continueCh2 := bg.setBlockToReturn(ptrs[0].BlockPointer, block2)
	_, continueCh3 := bg.setBlockToReturn(ptrs[1].BlockPointer, block3)

	block := NewDirBlock()
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)

	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	continueCh2 <- nil
	continueCh3 <- nil
	<-q.Prefetcher().Shutdown()

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
	q, w, bg, cacheFunc := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q, w)

	t.Log("Initialize a direct dir block with entries pointing to 3 files.")
	file1 := makeFakeFileBlock(t, true)
	file2 := makeFakeFileBlock(t, true)
	ptr1 := makeRandomBlockPointer(t)
	dir1 := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 100, "a"),
		"b": makeRandomDirEntry(t, Dir, 60, "b"),
		"c": makeRandomDirEntry(t, Exec, 20, "c"),
	}}
	dir2 := &DirBlock{Children: map[string]DirEntry{
		"d": makeRandomDirEntry(t, File, 100, "d"),
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
	<-q.Prefetcher().Shutdown()

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

func TestPrefetcherDirectDirBlockAlreadyCached(t *testing.T) {
	t.Log("Test direct dir block prefetching when the dir block is cached.")
	q, w, bg, cacheFunc := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q, w)

	t.Log("Initialize a direct dir block with an entry pointing to 1 folder, which in turn points to 1 file.")
	file1 := makeFakeFileBlock(t, true)
	ptr1 := makeRandomBlockPointer(t)
	dir1 := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, Dir, 60, "a"),
	}}
	dir2 := &DirBlock{Children: map[string]DirEntry{
		"b": makeRandomDirEntry(t, File, 100, "b"),
	}}

	_, continueCh1 := bg.setBlockToReturn(ptr1, dir1)
	_, continueCh2 := bg.setBlockToReturn(dir1.Children["a"].BlockPointer, dir2)
	_, continueCh3 := bg.setBlockToReturn(dir2.Children["b"].BlockPointer, file1)

	t.Log("Request the block for ptr1.")
	var block Block = &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, dir1, block)

	t.Log("Release the prefetch for dir2.")
	continueCh2 <- nil
	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	<-q.Prefetcher().Shutdown()

	t.Log("Ensure that the prefetched block is in the cache.")
	block, err = cacheFunc().Get(dir1.Children["a"].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, dir2, block)
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	block, err = cacheFunc().Get(dir2.Children["b"].BlockPointer)
	require.EqualError(t, err, NoSuchBlockError{dir2.Children["b"].BlockPointer.ID}.Error())

	t.Log("Restart the prefetcher.")
	q.TogglePrefetcher(context.Background(), true)

	t.Log("Request the already-cached second-level directory block. We don't need to unblock this one.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), dir1.Children["a"].BlockPointer, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dir2, block)

	t.Log("Release the prefetch for file1.")
	continueCh3 <- nil
	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	<-q.Prefetcher().Shutdown()

	block, err = cacheFunc().Get(dir2.Children["b"].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, file1, block)
}
