// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"math"
	"runtime"
	"testing"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
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
			nil,
		},
		codec.UnknownFieldSetHandler{},
	}
}
func makeFakeIndirectFilePtr(t *testing.T, off Int64Offset) IndirectFilePtr {
	return IndirectFilePtr{
		makeRandomBlockInfo(t),
		off,
		false,
		codec.UnknownFieldSetHandler{},
	}
}

func makeFakeIndirectDirPtr(t *testing.T, off StringOffset) IndirectDirPtr {
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

func testPrefetcherCheckGet(
	t *testing.T, bcache BlockCache, ptr BlockPointer, expectedBlock Block,
	expectedPrefetchStatus PrefetchStatus, tlfID tlf.ID,
	dcache DiskBlockCache) {
	block, err := bcache.Get(ptr)
	require.NoError(t, err)
	if dcache == nil {
		return
	}
	require.Equal(t, expectedBlock, block)
	_, _, prefetchStatus, err := dcache.Get(
		context.Background(), tlfID, ptr.ID, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, expectedPrefetchStatus.String(), prefetchStatus.String(), ptr.String())
}

func getStack() string {
	stacktrace := make([]byte, 16384)
	length := runtime.Stack(stacktrace, true)
	return string(stacktrace[:length])
}

func waitForPrefetchOrBust(
	t *testing.T, ctx context.Context, pre Prefetcher, ptr BlockPointer) {
	t.Helper()
	ch, err := pre.WaitChannelForBlockPrefetch(ctx, ptr)
	require.NoError(t, err)

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
		t.Log("Notified sync channel.")
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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		TransientEntry, BlockRequestWithPrefetch)
	continueChRootBlock <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	t.Log("Release the prefetched indirect blocks.")
	continueChIndBlock1 <- nil
	continueChIndBlock2 <- nil

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), ptrs[0].BlockPointer)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), ptrs[1].BlockPointer)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		TransientEntry, BlockRequestWithPrefetch)
	continueChRootBlock <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	t.Log("Release the prefetched indirect blocks.")
	continueChIndBlock1 <- nil
	continueChIndBlock2 <- nil

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), ptrs[0].BlockPointer)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), ptrs[1].BlockPointer)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func testPrefetcherIndirectDirBlockTail(
	t *testing.T, q *blockRetrievalQueue, bg *fakeBlockGetter,
	config *testBlockRetrievalConfig, withSync bool) {
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
	action := BlockRequestPrefetchTail
	if withSync {
		action = BlockRequestPrefetchTailWithSync
	}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		TransientEntry, action)
	continueChRootBlock <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	if withSync {
		t.Log("Release the prefetched indirect blocks.")
		continueChIndBlock1 <- nil
		continueChIndBlock2 <- nil
	}

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	rootStatus := NoPrefetch
	if withSync {
		waitForPrefetchOrBust(t, ctx, q.Prefetcher(), ptrs[0].BlockPointer)
		waitForPrefetchOrBust(t, ctx, q.Prefetcher(), ptrs[1].BlockPointer)
		rootStatus = TriggeredPrefetch
		testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
			indBlock1, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())
		testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
			indBlock2, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())
	}
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		rootStatus, kmd.TlfID(), config.DiskBlockCache())

}

func TestPrefetcherIndirectDirBlockTail(t *testing.T) {
	t.Log("Test indirect dir block tail prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

	testPrefetcherIndirectDirBlockTail(t, q, bg, config, false)
}

func TestPrefetcherIndirectDirBlockTailWithSync(t *testing.T) {
	t.Log("Test indirect dir block tail prefetching with sync.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)

	testPrefetcherIndirectDirBlockTail(t, q, bg, config, true)
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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
	waitForPrefetchOrBust(
		t, ctx, q.Prefetcher(), rootDir.Children["c"].BlockPointer)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["c"].BlockPointer, fileC, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["b"].BlockPointer, dirB, NoPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, TransientEntry, BlockRequestWithPrefetch)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release the prefetch for dirA.")
	continueChDirA <- nil
	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

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
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootDir.Children["a"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dirA, block)

	t.Log("Release the prefetch for fileB.")
	continueChFileB <- nil
	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(
		t, ctx, q.Prefetcher(), rootDir.Children["a"].BlockPointer)
	waitForPrefetchOrBust(
		t, ctx, q.Prefetcher(), rootDir.Children["b"].BlockPointer)

	testPrefetcherCheckGet(t, cache, dirA.Children["b"].BlockPointer, fileB,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	// Check that the dir block is marked as having been prefetched.
	testPrefetcherCheckGet(t, cache, rootDir.Children["a"].BlockPointer, dirA,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Remove the prefetched file block from the cache.")
	cache.DeleteTransient(dirA.Children["b"].BlockPointer.ID, kmd.TlfID())
	_, err = cache.Get(dirA.Children["b"].BlockPointer)
	require.EqualError(t, err,
		NoSuchBlockError{dirA.Children["b"].BlockPointer.ID}.Error())

	t.Log("Request the second-level directory block again. No prefetches " +
		"should be triggered.")
	block = &DirBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootDir.Children["a"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dirA, block)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(
		t, ctx, q.Prefetcher(), rootDir.Children["a"].BlockPointer)
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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, TransientEntry, BlockRequestWithPrefetch)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release the prefetched block.")
	continueChFileA <- nil

	t.Log("Wait for the prefetch to finish, then verify that the prefetched " +
		"block is in the cache.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), ptrA)
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptrA, fileA, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Remove the prefetched block from the cache.")
	cache.DeleteTransient(ptrA.ID, kmd.TlfID())
	_, err = cache.Get(ptrA)
	require.EqualError(t, err, NoSuchBlockError{ptrA.ID}.Error())

	t.Log("Request the root block again. It should be cached, so it should " +
		"return without needing to release the block.")
	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Wait for the prefetch to finish, then verify that the child " +
		"block is still not in the cache.")
	_, err = cache.Get(ptrA)
	require.EqualError(t, err, NoSuchBlockError{ptrA.ID}.Error())
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
}

func TestPrefetcherEmptyDirectDirBlock(t *testing.T) {
	t.Log("Test empty direct dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize an empty direct dir block.")
	rootPtr := makeRandomBlockPointer(t)
	rootDir := &DirBlock{Children: map[string]DirEntry{}}

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)

	var block Block = &DirBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Wait for prefetching to complete.")
	notifySyncCh(t, prefetchSyncCh)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the directory block is in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func testPrefetcherForSyncedTLF(
	t *testing.T, q *blockRetrievalQueue, bg *fakeBlockGetter,
	config *testBlockRetrievalConfig, prefetchSyncCh chan struct{},
	kmd KeyMetadata, explicitSync bool) {
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
	action := BlockRequestWithPrefetch
	if explicitSync {
		action = BlockRequestWithDeepSync
	}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd, rootPtr,
		block, TransientEntry, action)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release all the blocks.")
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	waitChCh := make(chan (<-chan struct{}), 1)
	go func() {
		waitCh, err := q.Prefetcher().WaitChannelForBlockPrefetch(ctx, rootPtr)
		if err != nil {
			waitChCh <- nil
		} else {
			waitChCh <- waitCh
		}
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
	var waitCh <-chan struct{}
	select {
	case waitCh = <-waitChCh:
		require.NotNil(t, waitCh)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	// Release after getting waitCh.
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
	t.Log("Waiting for prefetcher to signal completion")
	select {
	case <-waitCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Ensure that the prefetched blocks are all in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["c"].BlockPointer, fileC, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["b"].BlockPointer, dirB, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		rootDir.Children["a"].BlockPointer, fileA, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		dirB.Children["d"].BlockPointer, dirBfileD, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		dirBfileDptrs[0].BlockPointer, dirBfileDblock1, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		dirBfileDptrs[1].BlockPointer, dirBfileDblock2, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, TransientEntry, BlockRequestWithPrefetch)
	// We don't need to release the block this time because it should be cached
	// already.
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	notifySyncCh(t, prefetchSyncCh)
	t.Log("Wait for prefetching to complete. This shouldn't hang.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func TestPrefetcherForSyncedTLF(t *testing.T) {
	t.Log("Test synced TLF prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	kmd := makeKMD()
	config.SetTlfSyncState(kmd.TlfID(), FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_ENABLED,
	})
	testPrefetcherForSyncedTLF(t, q, bg, config, prefetchSyncCh, kmd, false)
}

func TestPrefetcherForRequestedSync(t *testing.T) {
	t.Log("Test explicitly-requested synced prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	kmd := makeKMD()
	testPrefetcherForSyncedTLF(t, q, bg, config, prefetchSyncCh, kmd, true)
}

func TestPrefetcherMultiLevelIndirectFile(t *testing.T) {
	t.Log("Test multi-level indirect file block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(q)
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()

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
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Fetch indirect block1 on-demand.")
	block = &FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootBlock.IPtrs[0].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
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
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootBlock.IPtrs[1].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
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
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		indBlock1.IPtrs[0].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch

	t.Log("Fetch indirect block12 on-demand.")
	block = &FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		indBlock1.IPtrs[1].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(
		t, ctx, q.Prefetcher(), indBlock1.IPtrs[1].BlockPointer)

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(
		t, config.BlockCache(), indBlock2.IPtrs[0].BlockPointer, indBlock21,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(
		t, config.BlockCache(), indBlock2.IPtrs[1].BlockPointer, indBlock22,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		indBlock1.IPtrs[0].BlockPointer, indBlock11, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		indBlock1.IPtrs[1].BlockPointer, indBlock12, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
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
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		a.Children["aa"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
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
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		aa.Children["aaa"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch file aab.")
	block = &FileBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		aa.Children["aab"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch file ab.")
	block = &FileBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		a.Children["ab"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	contChAB <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch dir a.")
	block = &DirBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		root.Children["a"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of dir a.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch file b.")
	block = &FileBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		root.Children["b"].BlockPointer, block, TransientEntry,
		BlockRequestWithPrefetch)
	contChB <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of root.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		root.Children["a"].BlockPointer, a, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		root.Children["b"].BlockPointer, b, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		a.Children["aa"].BlockPointer, aa, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		a.Children["ab"].BlockPointer, ab, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		aa.Children["aaa"].BlockPointer, aaa, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(),
		aa.Children["aab"].BlockPointer, aab, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
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
	config.SetTlfSyncState(kmd.TlfID(), FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_ENABLED,
	})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, NoPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	t.Log("Fetch dir root again.")
	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aaPtr, aa,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), abPtr, ab,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aaaPtr, aaa,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aabPtr, aab,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func setLimiterLimits(
	limiter *backpressureDiskLimiter, syncLimit, workingLimit int64) {
	limiter.lock.Lock()
	defer limiter.lock.Unlock()
	limiter.syncCacheByteTracker.limit = syncLimit
	limiter.diskCacheByteTracker.limit = workingLimit
}

func testPrefetcherGetCacheBytes(
	ctx context.Context, syncCache, workingCache *DiskBlockCacheLocal) (
	syncBytes, workingBytes int64) {
	syncBytes = int64(syncCache.Status(ctx)[syncCacheName].BlockBytes)
	workingBytes = int64(
		workingCache.Status(ctx)[workingSetCacheName].BlockBytes)
	return syncBytes, workingBytes
}

func TestSyncBlockCacheWithPrefetcher(t *testing.T) {
	t.Log("Test synced TLF prefetching with the disk cache.")
	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	defer shutdownPrefetcherTest(q)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
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
	err := cache.Put(
		ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA, DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), bPtr.ID, encB, serverHalfB, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	block := &DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of root.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Now set the folder to sync.")
	config.SetTlfSyncState(kmd.TlfID(), FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_ENABLED,
	})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, NoPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	t.Log("Set the cache maximum bytes to the current total.")
	syncBytes, workingBytes := testPrefetcherGetCacheBytes(
		ctx, syncCache, workingCache)
	limiter := dbcConfig.DiskLimiter().(*backpressureDiskLimiter)
	setLimiterLimits(limiter, syncBytes, workingBytes)

	t.Log("Fetch dir root again.")
	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	// Notify the sync chan once for the canceled prefetch.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Prefetching shouldn't happen because the disk caches are full.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
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
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"a\" on demand.")
	block = &FileBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, TransientEntry, BlockRequestWithPrefetch)
	t.Log("Release child block \"a\".")
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	// Then we wait for the pending prefetches to complete.
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
}

func TestPrefetcherBasicUnsyncedBackwardPrefetch(t *testing.T) {
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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, TransientEntry, BlockRequestWithPrefetch)
	t.Log("Release child block \"a\".")
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	t.Log("Fetch dir root.")
	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	// Then we wait for the pending prefetches to complete.
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
}

func TestPrefetcherUnsyncedPrefetchEvicted(t *testing.T) {
	t.Log("Test basic unsynced prefetching with a block that has been evicted.")
	dbc, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, dbc)
	// We don't want any of these blocks cached in memory.
	bcache := config.testCache
	defer shutdownPrefetcherTest(q)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
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

	encRoot, serverHalfRoot :=
		setupRealBlockForDiskCache(t, rootPtr, root, dbcConfig)
	encA, serverHalfA := setupRealBlockForDiskCache(t, aPtr, a, dbcConfig)

	_, _ = bg.setBlockToReturn(rootPtr, root)
	_, _ = bg.setBlockToReturn(aPtr, a)
	err := dbc.Put(
		ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = dbc.Put(
		ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	var block Block = &DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	// Notify sync channel for the child block `a`.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Set the metadata of the block in the disk cache to NoPrefetch, " +
		"simulating an eviction and a BlockServer.Get.")
	err = dbc.UpdateMetadata(ctx, rootPtr.ID, NoPrefetch)
	require.NoError(t, err)

	t.Log("Evict the root block from the block cache.")
	err = bcache.DeleteTransient(rootPtr.ID, kmd.TlfID())
	require.NoError(t, err)

	t.Log("Fetch dir root again.")
	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"a\" on demand.")
	block = &FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, TransientEntry, BlockRequestWithPrefetch)
	// Notify sync channel for the child block `a`.
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	// Then we wait for the pending prefetches to complete.
	close(prefetchSyncCh)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
}

func TestPrefetcherUnsyncedPrefetchChildCanceled(t *testing.T) {
	t.Log("Partial regression test for KBFS-2588: when a prefetched block " +
		"has children waiting on a prefetch, a child cancelation should not " +
		"result in a panic for a future parent prefetch.")
	// Note: this test actually passes, because as long as the block count of
	// the parent is non-zero, the first child that completes it will also
	// remove it from the tree. See
	// TestPrefetcherUnsyncedPrefetchRootEvictedCanceled for the actual
	// regression test that reproduces the panic.
	dbc, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, dbc)
	bcache := config.testCache
	defer shutdownPrefetcherTest(q)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a, b}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 10, "a"),
		"b": makeRandomDirEntry(t, File, 10, "b"),
	}}
	aPtr := root.Children["a"].BlockPointer
	bPtr := root.Children["b"].BlockPointer
	a := makeFakeFileBlock(t, true)
	b := makeFakeFileBlock(t, true)

	encRoot, serverHalfRoot :=
		setupRealBlockForDiskCache(t, rootPtr, root, dbcConfig)
	encA, serverHalfA := setupRealBlockForDiskCache(t, aPtr, a, dbcConfig)
	encB, serverHalfB := setupRealBlockForDiskCache(t, bPtr, b, dbcConfig)

	_, _ = bg.setBlockToReturn(rootPtr, root)
	_, _ = bg.setBlockToReturn(aPtr, a)
	_, _ = bg.setBlockToReturn(bPtr, b)
	err := dbc.Put(
		ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = dbc.Put(
		ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA, DiskBlockAnyCache)
	require.NoError(t, err)
	err = dbc.Put(
		ctx, kmd.TlfID(), bPtr.ID, encB, serverHalfB, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	var block Block = &DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	// Notify sync channel for the child blocks `a` and `b`.
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Cancel the prefetch for block 'a'.")
	q.Prefetcher().CancelPrefetch(aPtr)
	// Notify sync channel for the cancelation.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Set the metadata of the root block in the disk cache to " +
		"NoPrefetch, simulating an eviction and a BlockServer.Get.")
	err = dbc.UpdateMetadata(ctx, rootPtr.ID, NoPrefetch)
	require.NoError(t, err)

	t.Log("Evict the root block from the block cache.")
	err = bcache.DeleteTransient(rootPtr.ID, kmd.TlfID())
	require.NoError(t, err)

	t.Log("Fetch dir root again.")
	block = &DirBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	// Notify sync channel for only child block `a`, since `b` wasn't newly
	// triggered.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch child block \"a\" on demand.")
	block = &FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, TransientEntry, BlockRequestWithPrefetch)
	// Notify sync channel for the child block `a`.
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"b\" on demand.")
	block = &FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		bPtr, block, TransientEntry, BlockRequestWithPrefetch)
	// Notify sync channel for the child block `b`.
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	// Then we wait for the pending prefetches to complete.
	close(prefetchSyncCh)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
}

func TestPrefetcherUnsyncedPrefetchParentCanceled(t *testing.T) {
	t.Log("Regression test for KBFS-2588: when a prefetched block has " +
		"children waiting on a prefetch, and it is canceled, subsequent " +
		"attempts to prefetch that parent block panic.")
	dbc, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, dbc)
	bcache := config.testCache
	defer shutdownPrefetcherTest(q)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a, b}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 10, "a"),
		"b": makeRandomDirEntry(t, File, 10, "b"),
	}}
	aPtr := root.Children["a"].BlockPointer
	bPtr := root.Children["b"].BlockPointer
	a := makeFakeFileBlock(t, true)
	b := makeFakeFileBlock(t, true)

	encRoot, serverHalfRoot :=
		setupRealBlockForDiskCache(t, rootPtr, root, dbcConfig)
	encA, serverHalfA := setupRealBlockForDiskCache(t, aPtr, a, dbcConfig)
	encB, serverHalfB := setupRealBlockForDiskCache(t, bPtr, b, dbcConfig)

	_, _ = bg.setBlockToReturn(rootPtr, root)
	_, _ = bg.setBlockToReturn(aPtr, a)
	_, _ = bg.setBlockToReturn(bPtr, b)
	err := dbc.Put(
		ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = dbc.Put(
		ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA, DiskBlockAnyCache)
	require.NoError(t, err)
	err = dbc.Put(
		ctx, kmd.TlfID(), bPtr.ID, encB, serverHalfB, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	var block Block = &DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	// Notify sync channel for the child blocks `a` and `b`.
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Cancel the prefetch for the root block.")
	q.Prefetcher().CancelPrefetch(rootPtr)
	// Notify sync channel for the cancelation.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Set the metadata of the root block in the disk cache to " +
		"NoPrefetch, simulating an eviction and a BlockServer.Get.")
	err = dbc.UpdateMetadata(ctx, rootPtr.ID, NoPrefetch)
	require.NoError(t, err)

	t.Log("Evict the root block from the block cache.")
	err = bcache.DeleteTransient(rootPtr.ID, kmd.TlfID())
	require.NoError(t, err)

	t.Log("Fetch dir root again.")
	block = &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	// Neither blocks `a` nor `b` got triggered, since they already existed.
	// So no need to notify the sync channel.

	t.Log("Fetch child block \"a\" on demand.")
	block = &FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, TransientEntry, BlockRequestWithPrefetch)
	// Notify sync channel for the child block `a`.
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"b\" on demand.")
	block = &FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		bPtr, block, TransientEntry, BlockRequestWithPrefetch)
	// Notify sync channel for the child block `b`.
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	// Then we wait for the pending prefetches to complete.
	close(prefetchSyncCh)
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)
}

func TestPrefetcherReschedules(t *testing.T) {
	t.Log("Test synced TLF prefetch rescheduling.")
	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	defer shutdownPrefetcherTest(q)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	syncCache := cache.syncCache
	workingCache := cache.workingSetCache

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa}}")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, Dir, 10, "a"),
		"b": makeRandomDirEntry(t, File, 20, "b"),
	}}
	aPtr := root.Children["a"].BlockPointer
	a := &DirBlock{Children: map[string]DirEntry{
		"aa": makeRandomDirEntry(t, File, 30, "aa"),
		"ab": makeRandomDirEntry(t, File, 40, "ab"),
	}}
	aaPtr := a.Children["aa"].BlockPointer
	aa := makeFakeFileBlock(t, true)
	abPtr := a.Children["ab"].BlockPointer
	ab := makeFakeFileBlock(t, true)
	bPtr := root.Children["b"].BlockPointer
	b := makeFakeFileBlock(t, true)

	encRoot, serverHalfRoot :=
		setupRealBlockForDiskCache(t, rootPtr, root, dbcConfig)
	encA, serverHalfA := setupRealBlockForDiskCache(t, aPtr, a, dbcConfig)
	encB, serverHalfB := setupRealBlockForDiskCache(t, bPtr, b, dbcConfig)
	encAA, serverHalfAA := setupRealBlockForDiskCache(t, aaPtr, aa, dbcConfig)
	encAB, serverHalfAB := setupRealBlockForDiskCache(t, abPtr, ab, dbcConfig)

	_, _ = bg.setBlockToReturn(rootPtr, root)
	_, _ = bg.setBlockToReturn(aPtr, a)
	_, _ = bg.setBlockToReturn(aaPtr, aa)
	_, _ = bg.setBlockToReturn(abPtr, ab)
	_, _ = bg.setBlockToReturn(bPtr, b)
	err := cache.Put(
		ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA, DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), aaPtr.ID, encAA, serverHalfAA, DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), abPtr.ID, encAB, serverHalfAB, DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), bPtr.ID, encB, serverHalfB, DiskBlockAnyCache)
	require.NoError(t, err)

	config.SetTlfSyncState(kmd.TlfID(), FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_ENABLED,
	})
	q.TogglePrefetcher(true, prefetchSyncCh)
	q.Prefetcher().(*blockPrefetcher).makeNewBackOff = func() backoff.BackOff {
		t.Log("ZERO\n")
		return &backoff.ZeroBackOff{}
	}
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Set the cache maximum bytes to the current total.")
	syncBytes, workingBytes := testPrefetcherGetCacheBytes(
		ctx, syncCache, workingCache)
	limiter := dbcConfig.DiskLimiter().(*backpressureDiskLimiter)
	setLimiterLimits(limiter, syncBytes, workingBytes)

	t.Log("Fetch dir root.")
	block := &DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release reschedule request of root.")
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Make room in the cache.")
	setLimiterLimits(limiter, math.MaxInt64, math.MaxInt64)

	t.Log("Release reschedule request of root.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Release reschedule request of two root children.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	blockA := &DirBlock{}
	chA := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, blockA, TransientEntry, BlockRequestWithPrefetch)
	err = <-chA
	require.NoError(t, err)
	blockB := &FileBlock{}
	chB := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		bPtr, blockB, TransientEntry, BlockRequestWithPrefetch)
	err = <-chB
	require.NoError(t, err)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Set the cache maximum bytes to the current total again.")
	syncBytes, workingBytes = testPrefetcherGetCacheBytes(
		ctx, syncCache, workingCache)
	setLimiterLimits(limiter, syncBytes, workingBytes)

	t.Log("Release reschedule requests of two more children.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Make room in the cache again.")
	setLimiterLimits(limiter, math.MaxInt64, math.MaxInt64)

	t.Log("Finish all the prefetching.")
	close(prefetchSyncCh)

	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aaPtr, aa,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), abPtr, ab,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func TestPrefetcherWithDedupBlocks(t *testing.T) {
	t.Log("Test how the prefetcher works with block IDs that " +
		"have multiple refs.")

	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	defer shutdownPrefetcherTest(q)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a, b}, where a and b are refs to the same block ID.")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, File, 10, "a"),
	}}
	aPtr := root.Children["a"].BlockPointer
	childB := root.Children["a"]
	bNonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)
	childB.RefNonce = bNonce
	root.Children["b"] = childB
	bPtr := childB.BlockPointer

	aBlock := &FileBlock{}

	encRoot, serverHalfRoot :=
		setupRealBlockForDiskCache(t, rootPtr, root, dbcConfig)
	encA, serverHalfA := setupRealBlockForDiskCache(t, aPtr, aBlock, dbcConfig)

	err = cache.Put(
		ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA, DiskBlockAnyCache)
	require.NoError(t, err)

	_, _ = bg.setBlockToReturn(rootPtr, root)
	_, _ = bg.setBlockToReturn(aPtr, aBlock)
	_, _ = bg.setBlockToReturn(bPtr, aBlock)

	t.Log("Fetch dir root.")
	block := &DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithDeepSync)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetches of the one unique child pointer.")
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func TestPrefetcherWithCanceledDedupBlocks(t *testing.T) {
	t.Log("Test how the prefetcher works with block IDs that " +
		"have multiple refs.")

	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	defer shutdownPrefetcherTest(q)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: root -> a -> b")
	rootPtr := makeRandomBlockPointer(t)
	root := &DirBlock{Children: map[string]DirEntry{
		"a": makeRandomDirEntry(t, Dir, 10, "a"),
	}}
	aPtr := root.Children["a"].BlockPointer
	aBlock := &DirBlock{Children: map[string]DirEntry{
		"b": makeRandomDirEntry(t, File, 10, "b"),
	}}
	bPtr := aBlock.Children["b"].BlockPointer
	bBlock := &FileBlock{}

	encRoot, serverHalfRoot :=
		setupRealBlockForDiskCache(t, rootPtr, root, dbcConfig)
	encA, serverHalfA := setupRealBlockForDiskCache(t, aPtr, aBlock, dbcConfig)
	encB, serverHalfB := setupRealBlockForDiskCache(t, bPtr, bBlock, dbcConfig)

	err := cache.Put(
		ctx, kmd.TlfID(), rootPtr.ID, encRoot, serverHalfRoot,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), aPtr.ID, encA, serverHalfA, DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), bPtr.ID, encB, serverHalfB, DiskBlockAnyCache)
	require.NoError(t, err)

	_, _ = bg.setBlockToReturn(rootPtr, root)
	_, _ = bg.setBlockToReturn(aPtr, aBlock)
	_, _ = bg.setBlockToReturn(bPtr, bBlock)

	t.Log("Fetch dir root.")
	block := &DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, TransientEntry, BlockRequestWithDeepSync)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetch of a.")
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Before prefetching the child, update the root block to have a " +
		"new subdir pointing to the same ID but different nonce.")

	root2Ptr := makeRandomBlockPointer(t)
	root2 := &DirBlock{Children: map[string]DirEntry{
		"a2": makeRandomDirEntry(t, Dir, 10, "a2"),
	}}
	a2Ptr := root2.Children["a2"].BlockPointer
	childB2 := aBlock.Children["b"]
	b2Nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)
	childB2.RefNonce = b2Nonce
	a2Block := &DirBlock{Children: map[string]DirEntry{
		"b2": childB2,
	}}
	b2Ptr := a2Block.Children["b2"].BlockPointer
	_, _ = bg.setBlockToReturn(a2Ptr, a2Block)
	_, _ = bg.setBlockToReturn(b2Ptr, bBlock)

	encRoot2, serverHalfRoot2 :=
		setupRealBlockForDiskCache(t, root2Ptr, root2, dbcConfig)
	encA2, serverHalfA2 := setupRealBlockForDiskCache(
		t, a2Ptr, a2Block, dbcConfig)

	err = cache.Put(
		ctx, kmd.TlfID(), root2Ptr.ID, encRoot2, serverHalfRoot2,
		DiskBlockAnyCache)
	require.NoError(t, err)
	err = cache.Put(
		ctx, kmd.TlfID(), a2Ptr.ID, encA2, serverHalfA2, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Start prefetch of a2, which adds a parent entry for bPtr.ID.")
	block2 := &DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		a2Ptr, block2, TransientEntry, BlockRequestWithDeepSync)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Cancel the original b prefetch")
	q.Prefetcher().CancelPrefetch(bPtr)

	t.Log("Release all the cancels and prefetches.")
	close(prefetchSyncCh)

	t.Log("Wait for the prefetch to finish.")
	waitCh, err := q.Prefetcher().WaitChannelForBlockPrefetch(ctx, a2Ptr)
	require.NoError(t, err)

	select {
	case <-waitCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Ensure that the prefetched blocks are in the cache, " +
		"and the prefetch statuses are correct.")
	testPrefetcherCheckGet(t, config.BlockCache(), a2Ptr, a2Block,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())

	waitForPrefetchOrBust(t, ctx, q.Prefetcher(), a2Ptr)
}
