// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"runtime"
	"testing"
	"time"

	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func makeRandomBlockInfo(t *testing.T) BlockInfo {
	return BlockInfo{
		makeRandomBlockPointer(t),
		150,
	}
}

func makeRandomDirEntry(
	t *testing.T, typ EntryType, size uint64, path string) DirEntry {
	return DirEntry{
		makeRandomBlockInfo(t),
		EntryInfo{
			typ,
			size,
			path,
			101,
			102,
			"",
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

func initPrefetcherTestWithDiskCache(t *testing.T, dbc DiskBlockCache) (
	*blockRetrievalQueue, *fakeBlockGetter, *testBlockRetrievalConfig) {
	t.Helper()
	// We don't want the block getter to respect cancelation, because we need
	// <-q.Prefetcher().Shutdown() to represent whether the retrieval requests
	// _actually_ completed.
	bg := newFakeBlockGetter(false)
	config := newTestBlockRetrievalConfig(t, bg, dbc)
	q := newBlockRetrievalQueue(1, 1, config)
	require.NotNil(t, q)

	return q, bg, config
}

func initPrefetcherTest(t *testing.T) (*blockRetrievalQueue,
	*fakeBlockGetter, *testBlockRetrievalConfig) {
	return initPrefetcherTestWithDiskCache(t, nil)
}

func shutdownPrefetcherTest(q *blockRetrievalQueue) {
	q.Shutdown()
}

func testPrefetcherCheckGet(t *testing.T, bcache BlockCache, ptr BlockPointer,
	expectedBlock Block, expectedPrefetchStatus PrefetchStatus,
	expectedLifetime BlockCacheLifetime) {
	block, prefetchStatus, lifetime, err := bcache.GetWithPrefetch(ptr)
	require.NoError(t, err)
	require.Equal(t, expectedBlock, block)
	require.Equal(t, expectedPrefetchStatus.String(), prefetchStatus.String())
	require.Equal(t, expectedLifetime.String(), lifetime.String())
}

func getStack() string {
	stacktrace := make([]byte, 16384)
	length := runtime.Stack(stacktrace, true)
	return string(stacktrace[:length])
}

func waitForPrefetchOrBust(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(time.Second):
		t.Fatal("Failed to wait for prefetch. Stack:\n" + getStack())
	}
}

func notifyContinueCh(ch chan<- error) {
	go func() {
		ch <- nil
	}()
}

func notifySyncCh(t *testing.T, ch chan<- struct{}) {
	t.Helper()
	select {
	case ch <- struct{}{}:
	case <-time.After(time.Second):
		t.Fatal("Error notifying sync channel. Stack:\n" + getStack())
	}
}

func notifyContinueChOrBust(t *testing.T, ch chan<- error, err error) {
	t.Helper()
	select {
	case ch <- err:
	case <-time.After(time.Second):
		t.Fatal("Error notifying continue channel. Stack:\n" + getStack())
	}
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
	rootPtr := makeRandomBlockPointer(t)
	rootBlock := &FileBlock{IPtrs: ptrs}
	rootBlock.IsInd = true
	indBlock1 := makeFakeFileBlock(t, true)
	indBlock2 := makeFakeFileBlock(t, true)

	_, continueChRootBlock := bg.setBlockToReturn(rootPtr, rootBlock)
	_, continueChIndBlock1 :=
		bg.setBlockToReturn(ptrs[0].BlockPointer, indBlock1)
	_, continueChIndBlock2 :=
		bg.setBlockToReturn(ptrs[1].BlockPointer, indBlock2)

	var block Block = &FileBlock{}
	ch := q.Request(context.Background(),
		defaultOnDemandRequestPriority, makeKMD(), rootPtr, block,
		TransientEntry)
	continueChRootBlock <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	t.Log("Release the prefetched indirect blocks.")
	continueChIndBlock1 <- nil
	continueChIndBlock2 <- nil

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		TriggeredPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, NoPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, NoPrefetch, TransientEntry)
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
	rootPtr := makeRandomBlockPointer(t)
	rootBlock := &DirBlock{IPtrs: ptrs, Children: make(map[string]DirEntry)}
	rootBlock.IsInd = true
	indBlock1 := makeFakeDirBlock(t, "a")
	indBlock2 := makeFakeDirBlock(t, "b")

	_, continueChRootBlock := bg.setBlockToReturn(rootPtr, rootBlock)
	_, continueChIndBlock1 :=
		bg.setBlockToReturn(ptrs[0].BlockPointer, indBlock1)
	_, continueChIndBlock2 :=
		bg.setBlockToReturn(ptrs[1].BlockPointer, indBlock2)

	block := NewDirBlock()
	ch := q.Request(context.Background(),
		defaultOnDemandRequestPriority, makeKMD(), rootPtr, block,
		TransientEntry)
	continueChRootBlock <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	t.Log("Release the prefetched indirect blocks.")
	continueChIndBlock1 <- nil
	continueChIndBlock2 <- nil

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		TriggeredPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, NoPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, NoPrefetch, TransientEntry)
}

func TestPrefetcherDirectDirBlock(t *testing.T) {
	t.Log("Test direct dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

	t.Log("Initialize a direct dir block with entries pointing to 3 files.")
	fileA := makeFakeFileBlock(t, true)
	fileC := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 100, "a"),
		"b": makeRandomDirEntry(t, Dir, 60, "b"),
		"c": makeRandomDirEntry(t, Exec, 20, "c"),
	}}
	dirB := &DirBlock{Children: map[string]DirEntry{
		"d": makeRandomDirEntry(t, File, 100, "d"),
	}}
	dirBfileD := makeFakeFileBlock(t, true)

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)
	_, continueChFileA :=
		bg.setBlockToReturn(rootDir.Children["a"].BlockPointer, fileA)
	_, continueChDirB :=
		bg.setBlockToReturn(rootDir.Children["b"].BlockPointer, dirB)
	_, continueChFileC :=
		bg.setBlockToReturn(rootDir.Children["c"].BlockPointer, fileC)
	_, _ = bg.setBlockToReturn(dirB.Children["d"].BlockPointer, dirBfileD)

	var block Block = &DirBlock{}
	ch := q.Request(context.Background(),
		defaultOnDemandRequestPriority, makeKMD(), rootPtr, block,
		TransientEntry)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release the blocks in ascending order of their size. The largest " +
		"block will error.")
	continueChFileC <- nil
	continueChDirB <- nil
	continueChFileA <- context.Canceled
	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		TriggeredPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["c"].BlockPointer, fileC, NoPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["b"].BlockPointer, dirB, NoPrefetch, TransientEntry)

	t.Log("Ensure that the largest block isn't in the cache.")
	block, err = config.BlockCache().Get(rootDir.Children["a"].BlockPointer)
	require.EqualError(t, err,
		NoSuchBlockError{rootDir.Children["a"].BlockPointer.ID}.Error())
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	block, err = config.BlockCache().Get(dirB.Children["d"].BlockPointer)
	require.EqualError(t, err,
		NoSuchBlockError{dirB.Children["d"].BlockPointer.ID}.Error())
}

func TestPrefetcherAlreadyCached(t *testing.T) {
	t.Log("Test direct dir block prefetching when the dir block is cached.")
	q, bg, config := initPrefetcherTest(t)
	cache := config.BlockCache()
	defer shutdownPrefetcherTest(q)

	t.Log("Initialize a direct dir block with an entry pointing to 1 " +
		"folder, which in turn points to 1 file.")
	fileB := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, Dir, 60, "a"),
	}}
	dirA := &DirBlock{Children: map[string]DirEntry{
		"b": makeRandomDirEntry(t, File, 100, "b"),
	}}

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)
	_, continueChDirA :=
		bg.setBlockToReturn(rootDir.Children["a"].BlockPointer, dirA)
	_, continueChFileB :=
		bg.setBlockToReturn(dirA.Children["b"].BlockPointer, fileB)

	t.Log("Request the root block.")
	kmd := makeKMD()
	var block Block = &DirBlock{}
	ch := q.Request(context.Background(),
		defaultOnDemandRequestPriority, kmd, rootPtr, block, TransientEntry)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release the prefetch for dirA.")
	continueChDirA <- nil
	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
	q.TogglePrefetcher(true, nil)

	t.Log("Ensure that the prefetched block is in the cache.")
	block, err = cache.Get(rootDir.Children["a"].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, dirA, block)
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	block, err = cache.Get(dirA.Children["b"].BlockPointer)
	require.EqualError(t, err,
		NoSuchBlockError{dirA.Children["b"].BlockPointer.ID}.Error())

	t.Log("Request the already-cached second-level directory block. We don't " +
		"need to unblock this one.")
	block = &DirBlock{}
	ch = q.Request(context.Background(),
		defaultOnDemandRequestPriority, kmd,
		rootDir.Children["a"].BlockPointer, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dirA, block)

	t.Log("Release the prefetch for fileB.")
	continueChFileB <- nil
	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
	q.TogglePrefetcher(true, nil)

	testPrefetcherCheckGet(t, cache, dirA.Children["b"].BlockPointer, fileB,
		NoPrefetch, TransientEntry)
	// Check that the dir block is marked as having been prefetched.
	testPrefetcherCheckGet(t, cache, rootDir.Children["a"].BlockPointer, dirA,
		TriggeredPrefetch, TransientEntry)

	t.Log("Remove the prefetched file block from the cache.")
	cache.DeleteTransient(dirA.Children["b"].BlockPointer, kmd.TlfID())
	_, err = cache.Get(dirA.Children["b"].BlockPointer)
	require.EqualError(t, err,
		NoSuchBlockError{dirA.Children["b"].BlockPointer.ID}.Error())

	t.Log("Request the second-level directory block again. No prefetches " +
		"should be triggered.")
	block = &DirBlock{}
	ch = q.Request(context.Background(),
		defaultOnDemandRequestPriority, kmd,
		rootDir.Children["a"].BlockPointer, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dirA, block)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
}

func TestPrefetcherNoRepeatedPrefetch(t *testing.T) {
	t.Log("Test that prefetches are only triggered once for a given block.")
	q, bg, config := initPrefetcherTest(t)
	cache := config.BlockCache().(*BlockCacheStandard)
	defer shutdownPrefetcherTest(q)

	t.Log("Initialize a direct dir block with an entry pointing to 1 file.")
	fileA := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 60, "a"),
	}}
	ptrA := rootDir.Children["a"].BlockPointer

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)
	_, continueChFileA := bg.setBlockToReturn(ptrA, fileA)

	t.Log("Request the root block.")
	var block Block = &DirBlock{}
	kmd := makeKMD()
	ch := q.Request(context.Background(),
		defaultOnDemandRequestPriority, kmd, rootPtr, block, TransientEntry)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release the prefetched block.")
	continueChFileA <- nil

	t.Log("Wait for the prefetch to finish, then verify that the prefetched " +
		"block is in the cache.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
	q.TogglePrefetcher(true, nil)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrA, fileA, NoPrefetch,
		TransientEntry)

	t.Log("Remove the prefetched block from the cache.")
	cache.DeleteTransient(ptrA, kmd.TlfID())
	_, err = cache.Get(ptrA)
	require.EqualError(t, err, NoSuchBlockError{ptrA.ID}.Error())

	t.Log("Request the root block again. It should be cached, so it should " +
		"return without needing to release the block.")
	block = &DirBlock{}
	ch = q.Request(context.Background(),
		defaultOnDemandRequestPriority, kmd, rootPtr, block, TransientEntry)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Wait for the prefetch to finish, then verify that the child " +
		"block is still not in the cache.")
	_, err = cache.Get(ptrA)
	require.EqualError(t, err, NoSuchBlockError{ptrA.ID}.Error())
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
}

func TestPrefetcherEmptyDirectDirBlock(t *testing.T) {
	t.Log("Test empty direct dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

	t.Log("Initialize an empty direct dir block.")
	rootPtr := makeRandomBlockPointer(t)
	rootDir := &DirBlock{Children: map[string]DirEntry{}}

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)

	var block Block = &DirBlock{}
	ch := q.Request(context.Background(),
		defaultOnDemandRequestPriority, makeKMD(), rootPtr, block,
		TransientEntry)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Wait for prefetching to complete.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	t.Log("Ensure that the directory block is in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, TransientEntry)
}

func TestPrefetcherForSyncedTLF(t *testing.T) {
	t.Log("Test synced TLF prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	kmd := makeKMD()
	config.SetTlfSyncState(kmd.TlfID(), true)

	t.Log("Initialize a direct dir block with entries pointing to 2 files " +
		"and 1 directory. The directory has an entry pointing to another " +
		"file, which has 2 indirect blocks.")
	fileA := makeFakeFileBlock(t, true)
	fileC := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 100, "a"),
		"b": makeRandomDirEntry(t, Dir, 60, "b"),
		"c": makeRandomDirEntry(t, Exec, 20, "c"),
	}}
	dirB := &DirBlock{Children: map[string]DirEntry{
		"d": makeRandomDirEntry(t, File, 100, "d"),
	}}
	dirBfileDptrs := []IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 0),
		makeFakeIndirectFilePtr(t, 150),
	}
	dirBfileD := &FileBlock{IPtrs: dirBfileDptrs}
	dirBfileD.IsInd = true
	dirBfileDblock1 := makeFakeFileBlock(t, true)
	dirBfileDblock2 := makeFakeFileBlock(t, true)

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)
	_, continueChFileA :=
		bg.setBlockToReturn(rootDir.Children["a"].BlockPointer, fileA)
	_, continueChDirB :=
		bg.setBlockToReturn(rootDir.Children["b"].BlockPointer, dirB)
	_, continueChFileC :=
		bg.setBlockToReturn(rootDir.Children["c"].BlockPointer, fileC)
	_, continueChDirBfileD :=
		bg.setBlockToReturn(dirB.Children["d"].BlockPointer, dirBfileD)

	_, continueChDirBfileDblock1 :=
		bg.setBlockToReturn(dirBfileDptrs[0].BlockPointer, dirBfileDblock1)
	_, continueChDirBfileDblock2 :=
		bg.setBlockToReturn(dirBfileDptrs[1].BlockPointer, dirBfileDblock2)

	var block Block = &DirBlock{}
	ch := q.Request(context.Background(),
		defaultOnDemandRequestPriority, kmd, rootPtr, block, TransientEntry)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release all the blocks.")
	go func() {
		continueChFileC <- nil
		continueChDirB <- nil
		// After this, the prefetch worker can either pick up the third child of
		// dir1 (continueCh2), or the first child of dir2 (continueCh5).
		// TODO: The prefetcher should have a "global" prefetch priority
		// reservation system that goes down with each next set of prefetches.
		notifyContinueCh(continueChFileA)
		notifyContinueCh(continueChDirBfileD)
		notifyContinueCh(continueChDirBfileDblock1)
		notifyContinueCh(continueChDirBfileDblock2)
	}()
	t.Log("Wait for prefetching to complete.")
	// Release after prefetching rootDir
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching fileC
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching dirB
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching fileA
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching dirBfileD
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching dirBfileDblock1
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching dirBfileDblock2
	notifySyncCh(t, prefetchSyncCh)
	// Then we wait for the pending prefetches to complete.
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Ensure that the prefetched blocks are all in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["c"].BlockPointer, fileC, FinishedPrefetch,
		TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["b"].BlockPointer, dirB, FinishedPrefetch,
		TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["a"].BlockPointer, fileA, FinishedPrefetch,
		TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		dirB.Children["d"].BlockPointer, dirBfileD, FinishedPrefetch,
		TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		dirBfileDptrs[0].BlockPointer, dirBfileDblock1, FinishedPrefetch,
		TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		dirBfileDptrs[1].BlockPointer, dirBfileDblock2, FinishedPrefetch,
		TransientEntry)

	block = &DirBlock{}
	ch = q.Request(context.Background(),
		defaultOnDemandRequestPriority, kmd, rootPtr, block, TransientEntry)
	// We don't need to release the block this time because it should be cached
	// already.
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	notifySyncCh(t, prefetchSyncCh)
	t.Log("Wait for prefetching to complete. This shouldn't hang.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, TransientEntry)
}

func TestPrefetcherMultiLevelIndirectFile(t *testing.T) {
	t.Log("Test multi-level indirect file block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)
	ctx := context.Background()

	t.Log("Initialize an indirect file block pointing to 2 file data blocks.")
	ptrs := []IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 0),
		makeFakeIndirectFilePtr(t, 150),
	}
	rootPtr := makeRandomBlockPointer(t)
	rootBlock := &FileBlock{IPtrs: ptrs}
	rootBlock.IsInd = true
	indBlock1 := &FileBlock{IPtrs: []IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 10),
		makeFakeIndirectFilePtr(t, 20),
	}}
	indBlock1.IsInd = true
	indBlock2 := &FileBlock{IPtrs: []IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 30),
		makeFakeIndirectFilePtr(t, 40),
	}}
	indBlock2.IsInd = true
	indBlock11 := makeFakeFileBlock(t, true)
	indBlock12 := makeFakeFileBlock(t, true)
	indBlock21 := makeFakeFileBlock(t, true)
	indBlock22 := makeFakeFileBlock(t, true)

	_, continueChRootBlock := bg.setBlockToReturn(rootPtr, rootBlock)
	_, continueChIndBlock1 :=
		bg.setBlockToReturn(ptrs[0].BlockPointer, indBlock1)
	_, continueChIndBlock2 :=
		bg.setBlockToReturn(ptrs[1].BlockPointer, indBlock2)
	_, continueChIndBlock11 :=
		bg.setBlockToReturn(indBlock1.IPtrs[0].BlockPointer, indBlock11)
	_, continueChIndBlock12 :=
		bg.setBlockToReturn(indBlock1.IPtrs[1].BlockPointer, indBlock12)
	_, continueChIndBlock21 :=
		bg.setBlockToReturn(indBlock2.IPtrs[0].BlockPointer, indBlock21)
	_, continueChIndBlock22 :=
		bg.setBlockToReturn(indBlock2.IPtrs[1].BlockPointer, indBlock22)

	var block Block = &FileBlock{}
	ch := q.Request(ctx,
		defaultOnDemandRequestPriority, makeKMD(), rootPtr, block,
		TransientEntry)
	continueChRootBlock <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	t.Log("Release the prefetched indirect blocks.")
	// Release 2 blocks
	continueChIndBlock1 <- nil
	notifySyncCh(t, prefetchSyncCh)
	continueChIndBlock2 <- nil
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		TriggeredPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, NoPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, NoPrefetch, TransientEntry)

	t.Log("Fetch indirect block1 on-demand.")
	block = &FileBlock{}
	ch = q.Request(ctx, defaultOnDemandRequestPriority,
		makeKMD(), rootBlock.IPtrs[0].BlockPointer, block, TransientEntry)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch

	t.Log("Release the prefetch for indirect block1.")
	// Release 2 blocks
	continueChIndBlock11 <- nil
	notifySyncCh(t, prefetchSyncCh)
	continueChIndBlock12 <- nil
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch indirect block2 on-demand.")
	block = &FileBlock{}
	ch = q.Request(ctx, defaultOnDemandRequestPriority,
		makeKMD(), rootBlock.IPtrs[1].BlockPointer, block, TransientEntry)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch

	t.Log("Release the prefetch for indirect block2.")
	// Release 2 blocks
	continueChIndBlock21 <- nil
	notifySyncCh(t, prefetchSyncCh)
	continueChIndBlock22 <- nil
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch indirect block11 on-demand.")
	block = &FileBlock{}
	ch = q.Request(ctx, defaultOnDemandRequestPriority,
		makeKMD(), indBlock1.IPtrs[0].BlockPointer, block, TransientEntry)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch

	t.Log("Fetch indirect block12 on-demand.")
	block = &FileBlock{}
	ch = q.Request(ctx, defaultOnDemandRequestPriority,
		makeKMD(), indBlock1.IPtrs[1].BlockPointer, block, TransientEntry)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, TriggeredPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		indBlock2.IPtrs[0].BlockPointer, indBlock21, NoPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		indBlock2.IPtrs[1].BlockPointer, indBlock22, NoPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		indBlock1.IPtrs[0].BlockPointer, indBlock11, FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		indBlock1.IPtrs[1].BlockPointer, indBlock12, FinishedPrefetch, TransientEntry)
}

func TestPrefetcherBackwardPrefetch(t *testing.T) {
	t.Log("Test synced TLF prefetching in a more complex fetch order.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa -> {aab, aaa}}}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, Dir, 10, "a"),
		"b": makeRandomDirEntry(t, File, 20, "b"),
	}}
	a := &DirBlock{Children: map[string]DirEntry{
		"aa": makeRandomDirEntry(t, Dir, 30, "aa"),
		"ab": makeRandomDirEntry(t, File, 40, "ab"),
	}}
	b := makeFakeFileBlock(t, true)
	aa := &DirBlock{Children: map[string]DirEntry{
		"aaa": makeRandomDirEntry(t, File, 50, "aaa"),
		"aab": makeRandomDirEntry(t, File, 60, "aab"),
	}}
	ab := makeFakeFileBlock(t, true)
	aaa := makeFakeFileBlock(t, true)
	aab := makeFakeFileBlock(t, true)

	_, contChRoot := bg.setBlockToReturn(rootPtr, root)
	_, contChA := bg.setBlockToReturn(root.Children["a"].BlockPointer, a)
	_, contChB := bg.setBlockToReturn(root.Children["b"].BlockPointer, b)
	_, contChAA := bg.setBlockToReturn(a.Children["aa"].BlockPointer, aa)
	_, contChAB := bg.setBlockToReturn(a.Children["ab"].BlockPointer, ab)
	_, contChAAA := bg.setBlockToReturn(aa.Children["aaa"].BlockPointer, aaa)
	_, contChAAB := bg.setBlockToReturn(aa.Children["aab"].BlockPointer, aab)

	t.Log("Fetch dir aa.")
	var block Block = &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		a.Children["aa"].BlockPointer, block, TransientEntry)
	contChAA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, aa, block)

	t.Log("Release prefetched children of dir aa.")
	contChAAA <- nil
	notifySyncCh(t, prefetchSyncCh)
	contChAAB <- nil
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch file aaa.")
	block = &FileBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		aa.Children["aaa"].BlockPointer, block, TransientEntry)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch file aab.")
	block = &FileBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		aa.Children["aab"].BlockPointer, block, TransientEntry)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch file ab.")
	block = &FileBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		a.Children["ab"].BlockPointer, block, TransientEntry)
	contChAB <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch dir a.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		root.Children["a"].BlockPointer, block, TransientEntry)
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of dir a.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch file b.")
	block = &FileBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		root.Children["b"].BlockPointer, block, TransientEntry)
	contChB <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of root.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		root.Children["a"].BlockPointer, a, FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		root.Children["b"].BlockPointer, b, FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		a.Children["aa"].BlockPointer, aa, FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		a.Children["ab"].BlockPointer, ab, FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		aa.Children["aaa"].BlockPointer, aaa, FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(),
		aa.Children["aab"].BlockPointer, aab, FinishedPrefetch, TransientEntry)
}

func TestPrefetcherUnsyncedThenSyncedPrefetch(t *testing.T) {
	t.Log("Test synced TLF prefetching in a more complex fetch order.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa -> {aab, aaa}}}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, Dir, 10, "a"),
		"b": makeRandomDirEntry(t, File, 20, "b"),
	}}
	aPtr := root.Children["a"].BlockPointer
	a := &DirBlock{Children: map[string]DirEntry{
		"aa": makeRandomDirEntry(t, Dir, 30, "aa"),
		"ab": makeRandomDirEntry(t, File, 40, "ab"),
	}}
	bPtr := root.Children["b"].BlockPointer
	b := makeFakeFileBlock(t, true)
	aaPtr := a.Children["aa"].BlockPointer
	aa := &DirBlock{Children: map[string]DirEntry{
		"aaa": makeRandomDirEntry(t, File, 50, "aaa"),
		"aab": makeRandomDirEntry(t, File, 60, "aab"),
	}}
	abPtr := a.Children["ab"].BlockPointer
	ab := makeFakeFileBlock(t, true)
	aaaPtr := aa.Children["aaa"].BlockPointer
	aaa := makeFakeFileBlock(t, true)
	aabPtr := aa.Children["aab"].BlockPointer
	aab := makeFakeFileBlock(t, true)

	_, contChRoot := bg.setBlockToReturn(rootPtr, root)
	_, contChA := bg.setBlockToReturn(aPtr, a)
	_, contChB := bg.setBlockToReturn(bPtr, b)
	_, contChAA := bg.setBlockToReturn(aaPtr, aa)
	_, contChAB := bg.setBlockToReturn(abPtr, ab)
	_, contChAAA := bg.setBlockToReturn(aaaPtr, aaa)
	_, contChAAB := bg.setBlockToReturn(aabPtr, aab)

	t.Log("Fetch dir root.")
	block := &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of root.")
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	contChB <- nil
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Now set the folder to sync.")
	config.SetTlfSyncState(kmd.TlfID(), true)
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, NoPrefetch,
		TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, NoPrefetch,
		TransientEntry)

	t.Log("Fetch dir root again.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry)
	err = <-ch

	t.Log("Release all the blocks.")
	go func() {
		// After this, the prefetch worker order is less clear due to
		// priorities.
		// TODO: The prefetcher should have a "global" prefetch priority
		// reservation system that goes down with each next set of prefetches.
		notifyContinueCh(contChAA)
		notifyContinueCh(contChAB)
		notifyContinueCh(contChAAA)
		notifyContinueCh(contChAAB)
	}()

	t.Log("Wait for prefetching to complete.")
	// Release after prefetching root
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching a
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching b
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching aa
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching ab
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching aaa
	notifySyncCh(t, prefetchSyncCh)
	// Release after prefetching aab
	notifySyncCh(t, prefetchSyncCh)
	// Then we wait for the pending prefetches to complete.
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aaPtr, aa,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), abPtr, ab,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aaaPtr, aaa,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aabPtr, aab,
		FinishedPrefetch, TransientEntry)
}

func TestSyncBlockCacheWithPrefetcher(t *testing.T) {
	t.Log("Test synced TLF prefetching with the disk cache.")
	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	defer shutdownPrefetcherTest(q)
	ctx := context.Background()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	syncCache := cache.syncCache
	workingCache := cache.workingSetCache

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa -> {aab, aaa}}}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, Dir, 10, "a"),
		"b": makeRandomDirEntry(t, File, 20, "b"),
	}}
	aPtr := root.Children["a"].BlockPointer
	a := &DirBlock{Children: map[string]DirEntry{
		"aa": makeRandomDirEntry(t, Dir, 30, "aa"),
		"ab": makeRandomDirEntry(t, File, 40, "ab"),
	}}
	bPtr := root.Children["b"].BlockPointer
	b := makeFakeFileBlock(t, true)

	encRoot, serverHalfRoot :=
		setupRealBlockForDiskCache(t, rootPtr, root, dbcConfig)
	encA, serverHalfA := setupRealBlockForDiskCache(t, aPtr, a, dbcConfig)
	encB, serverHalfB := setupRealBlockForDiskCache(t, bPtr, b, dbcConfig)

	_, _ = bg.setBlockToReturn(rootPtr, root)
	_, _ = bg.setBlockToReturn(aPtr, a)
	_, _ = bg.setBlockToReturn(bPtr, b)
	err := cache.Put(ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot)
	require.NoError(t, err)
	err = cache.Put(ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA)
	require.NoError(t, err)
	err = cache.Put(ctx, kmd.TlfID(), bPtr.ID, encB, serverHalfB)
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	block := &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of root.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Now set the folder to sync.")
	config.SetTlfSyncState(kmd.TlfID(), true)
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, NoPrefetch,
		TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, NoPrefetch,
		TransientEntry)

	t.Log("Set the cache maximum bytes to the current total.")
	syncBytes := int64(syncCache.currBytes)
	workingBytes := int64(workingCache.currBytes)
	limiter := dbcConfig.DiskLimiter().(*backpressureDiskLimiter)
	limiter.syncCacheByteTracker.limit = syncBytes
	limiter.diskCacheByteTracker.limit = workingBytes

	t.Log("Fetch dir root again.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry)
	err = <-ch
	// Notify the sync chan once for the canceled prefetch.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Prefetching shouldn't happen because the disk caches are full.")
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
}

func TestPrefetcherBasicUnsyncedPrefetch(t *testing.T) {
	t.Log("Test basic unsynced prefetching with only 2 blocks.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 10, "a"),
	}}
	aPtr := root.Children["a"].BlockPointer
	a := makeFakeFileBlock(t, true)

	_, contChRoot := bg.setBlockToReturn(rootPtr, root)
	_, contChA := bg.setBlockToReturn(aPtr, a)

	t.Log("Fetch dir root.")
	var block Block = &DirBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"a\" on demand.")
	block = &FileBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		aPtr, block, TransientEntry)
	t.Log("Release child block \"a\".")
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		TransientEntry)

	// Then we wait for the pending prefetches to complete.
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
}

func TestPrefetcherBasicUnsyncedBackwardPrefetch(t *testing.T) {
	t.Skip("Not working yet, sometimes fails to shutdown cleanly.")
	t.Log("Test basic unsynced prefetching with only 2 blocks fetched " +
		"in reverse.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 10, "a"),
	}}
	aPtr := root.Children["a"].BlockPointer
	a := makeFakeFileBlock(t, true)

	_, contChRoot := bg.setBlockToReturn(rootPtr, root)
	_, contChA := bg.setBlockToReturn(aPtr, a)

	t.Log("Fetch child block \"a\" on demand.")
	var block Block = &FileBlock{}
	ch := q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		aPtr, block, TransientEntry)
	t.Log("Release child block \"a\".")
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		TransientEntry)

	t.Log("Fetch dir root.")
	block = &DirBlock{}
	ch = q.Request(context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, TransientEntry)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		TransientEntry)

	// Then we wait for the pending prefetches to complete.
	waitForPrefetchOrBust(t, q.Prefetcher().Shutdown())
}
