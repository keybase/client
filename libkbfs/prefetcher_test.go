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

func initPrefetcherTest(t *testing.T) (*blockRetrievalQueue,
	*fakeBlockGetter, *testBlockRetrievalConfig) {
	// We don't want the block getter to respect cancelation, because we need
	// <-q.Prefetcher().Shutdown() to represent whether the retrieval requests
	// _actually_ completed.
	bg := newFakeBlockGetter(false)
	config := newTestBlockRetrievalConfig(t, bg, nil)
	q := newBlockRetrievalQueue(1, 1, config)
	require.NotNil(t, q)

	return q, bg, config
}

func shutdownPrefetcherTest(q *blockRetrievalQueue) {
	q.Shutdown()
}

func testPrefetcherCheckGet(t *testing.T, bcache BlockCache,
	ptr BlockPointer, expectedBlock Block, expectedHasPrefetch bool,
	expectedLifetime BlockCacheLifetime) {
	block, hasPrefetched, lifetime, err := bcache.GetWithPrefetch(ptr)
	require.NoError(t, err)
	require.Equal(t, expectedBlock, block)
	if expectedHasPrefetch {
		require.True(t, hasPrefetched)
	} else {
		require.False(t, hasPrefetched)
	}
	require.Equal(t, expectedLifetime, lifetime)
}

func TestPrefetcherIndirectFileBlock(t *testing.T) {
	t.Log("Test indirect file block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

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
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptr1, block1, true, TransientEntry)
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptrs[0].BlockPointer, block2, false,
		TransientEntry)
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptrs[1].BlockPointer, block3, false,
		TransientEntry)
}

func TestPrefetcherIndirectDirBlock(t *testing.T) {
	t.Log("Test indirect dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

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
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptr1, block1, true, TransientEntry)
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptrs[0].BlockPointer, block2, false,
		TransientEntry)
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptrs[1].BlockPointer, block3, false,
		TransientEntry)
}

func TestPrefetcherDirectDirBlock(t *testing.T) {
	t.Log("Test direct dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

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
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptr1, dir1, true, TransientEntry)
	testPrefetcherCheckGet(
		t, config.BlockCache(), dir1.Children["c"].BlockPointer, file2, false,
		TransientEntry)
	testPrefetcherCheckGet(
		t, config.BlockCache(), dir1.Children["b"].BlockPointer, dir2, false,
		TransientEntry)

	t.Log("Ensure that the largest block isn't in the cache.")
	block, err = config.BlockCache().Get(dir1.Children["a"].BlockPointer)
	require.EqualError(t, err, NoSuchBlockError{dir1.Children["a"].BlockPointer.ID}.Error())
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	block, err = config.BlockCache().Get(dir2.Children["d"].BlockPointer)
	require.EqualError(t, err, NoSuchBlockError{dir2.Children["d"].BlockPointer.ID}.Error())
}

func TestPrefetcherAlreadyCached(t *testing.T) {
	t.Log("Test direct dir block prefetching when the dir block is cached.")
	q, bg, config := initPrefetcherTest(t)
	cache := config.BlockCache()
	defer shutdownPrefetcherTest(q)

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
	kmd := makeKMD()
	var block Block = &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, kmd, ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, dir1, block)

	t.Log("Release the prefetch for dir2.")
	continueCh2 <- nil
	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	<-q.Prefetcher().Shutdown()

	t.Log("Ensure that the prefetched block is in the cache.")
	block, err = cache.Get(dir1.Children["a"].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, dir2, block)
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	block, err = cache.Get(dir2.Children["b"].BlockPointer)
	require.EqualError(t, err, NoSuchBlockError{dir2.Children["b"].BlockPointer.ID}.Error())

	t.Log("Restart the prefetcher.")
	q.TogglePrefetcher(context.Background(), true)

	t.Log("Request the already-cached second-level directory block. We don't need to unblock this one.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd, dir1.Children["a"].BlockPointer, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dir2, block)

	t.Log("Release the prefetch for file1.")
	continueCh3 <- nil
	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	<-q.Prefetcher().Shutdown()

	testPrefetcherCheckGet(
		t, cache, dir2.Children["b"].BlockPointer, file1, false,
		TransientEntry)
	// Check that the dir block is marked as having been prefetched.
	testPrefetcherCheckGet(
		t, cache, dir1.Children["a"].BlockPointer, dir2, true,
		TransientEntry)

	t.Log("Remove the prefetched file block from the cache.")
	cache.DeleteTransient(dir2.Children["b"].BlockPointer, kmd.TlfID())
	_, err = cache.Get(dir2.Children["b"].BlockPointer)
	require.EqualError(t, err, NoSuchBlockError{dir2.Children["b"].BlockPointer.ID}.Error())

	t.Log("Restart the prefetcher.")
	q.TogglePrefetcher(context.Background(), true)

	t.Log("Request the second-level directory block again. No prefetches should be triggered.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd, dir1.Children["a"].BlockPointer, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dir2, block)

	t.Log("Shutdown the prefetcher and wait until it's done prefetching. Since no prefetches were triggered, this shouldn't hang.")
	<-q.Prefetcher().Shutdown()
}

func TestPrefetcherNoPrefetchWhileCacheFull(t *testing.T) {
	t.Log("Test that prefetches aren't triggered when the cache is full with permanent entries.")
	q, bg, config := initPrefetcherTest(t)
	cache := NewBlockCacheStandard(1, uint64(1))
	config.testCache = cache
	defer shutdownPrefetcherTest(q)

	t.Log("Initialize a direct dir block with an entry pointing to 1 file.")
	file1 := makeFakeFileBlock(t, true)
	file2 := makeFakeFileBlock(t, true)
	ptr1 := makeRandomBlockPointer(t)
	ptr2 := makeRandomBlockPointer(t)
	dir1 := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 60, "a"),
	}}

	_, continueCh1 := bg.setBlockToReturn(ptr1, file1)
	_, continueCh2 := bg.setBlockToReturn(ptr2, dir1)
	_, _ = bg.setBlockToReturn(dir1.Children["a"].BlockPointer, file2)

	t.Log("Request the block for ptr1 as a permanent entry to fill up the cache.")
	var block Block = &FileBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr1, block, PermanentEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	_ = block.(*FileBlock).GetHash()
	require.Equal(t, file1, block)
	require.Equal(t, uint64(16), cache.cleanTotalBytes)

	t.Log("Request the block for ptr2.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr2, block, TransientEntry)
	continueCh2 <- nil
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dir1, block)

	t.Log("Shutdown the prefetcher and wait until it's done prefetching." +
		" This shouldn't hang, indicating that no prefetches were triggered.")
	<-q.Prefetcher().Shutdown()
}

func TestPrefetcherNoRepeatedPrefetch(t *testing.T) {
	t.Log("Test that prefetches are only triggered once for a given block.")
	q, bg, config := initPrefetcherTest(t)
	cache := config.BlockCache().(*BlockCacheStandard)
	defer shutdownPrefetcherTest(q)

	t.Log("Initialize a direct dir block with an entry pointing to 1 file.")
	file1 := makeFakeFileBlock(t, true)
	ptr1 := makeRandomBlockPointer(t)
	dir1 := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 60, "a"),
	}}
	childPtr := dir1.Children["a"].BlockPointer

	_, continueCh1 := bg.setBlockToReturn(ptr1, dir1)
	_, continueCh2 := bg.setBlockToReturn(childPtr, file1)

	t.Log("Request the block for ptr1.")
	var block Block = &DirBlock{}
	kmd := makeKMD()
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, kmd, ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, dir1, block)

	t.Log("Release the prefetched block.")
	continueCh2 <- nil

	t.Log("Wait for the prefetch to finish, then verify that the prefetched block is in the cache.")
	<-q.Prefetcher().Shutdown()
	testPrefetcherCheckGet(
		t, config.BlockCache(), childPtr, file1, false, TransientEntry)

	t.Log("Remove the prefetched block from the cache.")
	cache.DeleteTransient(childPtr, kmd.TlfID())
	_, err = cache.Get(childPtr)
	require.EqualError(t, err, NoSuchBlockError{childPtr.ID}.Error())

	t.Log("Restart the prefetcher.")
	q.TogglePrefetcher(context.Background(), true)

	t.Log("Request the block for ptr1 again. Should be cached.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd, ptr1, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dir1, block)

	t.Log("Wait for the prefetch to finish, then verify that the child block is still not in the cache.")
	<-q.Prefetcher().Shutdown()
	_, err = cache.Get(childPtr)
	require.EqualError(t, err, NoSuchBlockError{childPtr.ID}.Error())
}

func TestPrefetcherEmptyDirectDirBlock(t *testing.T) {
	t.Log("Test empty direct dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

	t.Log("Initialize a direct dir block with entries pointing to 3 files.")
	ptr1 := makeRandomBlockPointer(t)
	dir1 := &DirBlock{Children: map[string]DirEntry{}}

	_, continueCh1 := bg.setBlockToReturn(ptr1, dir1)

	var block Block = &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, makeKMD(), ptr1, block, TransientEntry)
	continueCh1 <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, dir1, block)

	t.Log("Shutdown the prefetcher and wait until it's done prefetching.")
	<-q.Prefetcher().Shutdown()

	t.Log("Ensure that the directory block is in the cache.")
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptr1, dir1, true, TransientEntry)
}
