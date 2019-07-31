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
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	libkeytest "github.com/keybase/client/go/kbfs/libkey/test"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func makeRandomBlockInfo(t *testing.T) data.BlockInfo {
	return data.BlockInfo{
		BlockPointer: makeRandomBlockPointer(t),
		EncodedSize:  testFakeBlockSize,
	}
}

func makeRandomDirEntry(
	t *testing.T, typ data.EntryType, size uint64, path string) data.DirEntry {
	return data.DirEntry{
		BlockInfo: makeRandomBlockInfo(t),
		EntryInfo: data.EntryInfo{
			Type:          typ,
			Size:          size,
			SymPath:       path,
			Mtime:         101,
			Ctime:         102,
			TeamWriter:    "",
			PrevRevisions: nil,
		},
	}
}
func makeFakeIndirectFilePtr(
	t *testing.T, off data.Int64Offset) data.IndirectFilePtr {
	return data.IndirectFilePtr{
		BlockInfo: makeRandomBlockInfo(t),
		Off:       off,
		Holes:     false,
	}
}

func makeFakeIndirectDirPtr(
	t *testing.T, off data.StringOffset) data.IndirectDirPtr {
	return data.IndirectDirPtr{
		BlockInfo: makeRandomBlockInfo(t),
		Off:       off,
	}
}

func makeFakeDirBlock(t *testing.T, name string) *data.DirBlock {
	return &data.DirBlock{
		CommonBlock: data.NewCommonBlockForTesting(false, testFakeBlockSize),
		Children: map[string]data.DirEntry{
			name: makeRandomDirEntry(t, data.Dir, 100, name),
		},
	}
}

func makeFakeDirBlockWithChildren(children map[string]data.DirEntry) *data.DirBlock {
	return &data.DirBlock{
		CommonBlock: data.NewCommonBlockForTesting(false, testFakeBlockSize),
		Children:    children,
	}
}

func makeFakeDirBlockWithIPtrs(iptrs []data.IndirectDirPtr) *data.DirBlock {
	return &data.DirBlock{
		CommonBlock: data.NewCommonBlockForTesting(true, testFakeBlockSize),
		Children:    map[string]data.DirEntry{},
		IPtrs:       iptrs,
	}
}

func initPrefetcherTestWithDiskCache(t *testing.T, dbc DiskBlockCache) (
	*blockRetrievalQueue, *fakeBlockGetter, *testBlockRetrievalConfig) {
	t.Helper()
	// We don't want the block getter to respect cancelation, because we need
	// <-q.Prefetcher().Shutdown() to represent whether the retrieval requests
	// _actually_ completed.
	bg := newFakeBlockGetter(false)
	config := newTestBlockRetrievalConfig(t, bg, dbc)
	q := newBlockRetrievalQueue(1, 1, 0, config)
	require.NotNil(t, q)

	return q, bg, config
}

func initPrefetcherTest(t *testing.T) (*blockRetrievalQueue,
	*fakeBlockGetter, *testBlockRetrievalConfig) {
	return initPrefetcherTestWithDiskCache(t, nil)
}

func shutdownPrefetcherTest(t *testing.T, q *blockRetrievalQueue, syncCh chan struct{}) {
	ch := q.Shutdown()
	if syncCh != nil {
		select {
		case _, isOpen := <-syncCh:
			if isOpen {
				close(syncCh)
			}
		default:
			close(syncCh)
		}
	}
	<-ch
}

func testPrefetcherCheckGet(
	t *testing.T, bcache data.BlockCache, ptr data.BlockPointer, expectedBlock data.Block,
	expectedPrefetchStatus PrefetchStatus, tlfID tlf.ID,
	dcache DiskBlockCache) {
	block, err := bcache.Get(ptr)
	require.NoError(t, err)
	if dcache == nil {
		return
	}
	if dbcw, ok := dcache.(*diskBlockCacheWrapped); ok {
		err := dbcw.waitForDeletes(context.Background())
		require.NoError(t, err)
	}
	require.Equal(t, expectedBlock, block)
	prefetchStatus, err := dcache.GetPrefetchStatus(
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
	ctx context.Context, t *testing.T, pre Prefetcher, ptr data.BlockPointer) {
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

func TestPrefetcherIndirectFileBlock(t *testing.T) {
	t.Log("Test indirect file block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(t, q, nil)

	t.Log("Initialize an indirect file block pointing to 2 file data blocks.")
	ptrs := []data.IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 0),
		makeFakeIndirectFilePtr(t, 150),
	}
	rootPtr := makeRandomBlockPointer(t)
	rootBlock := &data.FileBlock{IPtrs: ptrs}
	rootBlock.IsInd = true
	indBlock1 := makeFakeFileBlock(t, true)
	indBlock2 := makeFakeFileBlock(t, true)

	_, continueChRootBlock := bg.setBlockToReturn(rootPtr, rootBlock)
	_, continueChIndBlock1 :=
		bg.setBlockToReturn(ptrs[0].BlockPointer, indBlock1)
	_, continueChIndBlock2 :=
		bg.setBlockToReturn(ptrs[1].BlockPointer, indBlock2)

	var block data.Block = &data.FileBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		data.TransientEntry, BlockRequestWithPrefetch)
	continueChRootBlock <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	t.Log("Release the prefetched indirect blocks.")
	continueChIndBlock1 <- nil
	continueChIndBlock2 <- nil

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), ptrs[0].BlockPointer)
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), ptrs[1].BlockPointer)

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
	defer shutdownPrefetcherTest(t, q, nil)

	t.Log("Initialize an indirect dir block pointing to 2 dir data blocks.")
	ptrs := []data.IndirectDirPtr{
		makeFakeIndirectDirPtr(t, "a"),
		makeFakeIndirectDirPtr(t, "b"),
	}
	rootPtr := makeRandomBlockPointer(t)
	rootBlock := makeFakeDirBlockWithIPtrs(ptrs)
	indBlock1 := makeFakeDirBlock(t, "a")
	indBlock2 := makeFakeDirBlock(t, "b")

	_, continueChRootBlock := bg.setBlockToReturn(rootPtr, rootBlock)
	_, continueChIndBlock1 :=
		bg.setBlockToReturn(ptrs[0].BlockPointer, indBlock1)
	_, continueChIndBlock2 :=
		bg.setBlockToReturn(ptrs[1].BlockPointer, indBlock2)

	block := data.NewDirBlock()
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		data.TransientEntry, BlockRequestWithPrefetch)
	continueChRootBlock <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootBlock, block)

	t.Log("Release the prefetched indirect blocks.")
	continueChIndBlock1 <- nil
	continueChIndBlock2 <- nil

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), ptrs[0].BlockPointer)
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), ptrs[1].BlockPointer)

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
	ptrs := []data.IndirectDirPtr{
		makeFakeIndirectDirPtr(t, "a"),
		makeFakeIndirectDirPtr(t, "b"),
	}
	rootPtr := makeRandomBlockPointer(t)
	rootBlock := &data.DirBlock{IPtrs: ptrs, Children: make(map[string]data.DirEntry)}
	rootBlock.IsInd = true
	indBlock1 := makeFakeDirBlock(t, "a")
	indBlock2 := makeFakeDirBlock(t, "b")

	_, continueChRootBlock := bg.setBlockToReturn(rootPtr, rootBlock)
	_, continueChIndBlock1 :=
		bg.setBlockToReturn(ptrs[0].BlockPointer, indBlock1)
	_, continueChIndBlock2 :=
		bg.setBlockToReturn(ptrs[1].BlockPointer, indBlock2)

	block := data.NewDirBlock()
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
		data.TransientEntry, action)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	rootStatus := NoPrefetch
	if withSync {
		waitForPrefetchOrBust(ctx, t, q.Prefetcher(), ptrs[0].BlockPointer)
		waitForPrefetchOrBust(ctx, t, q.Prefetcher(), ptrs[1].BlockPointer)
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
	defer shutdownPrefetcherTest(t, q, nil)

	testPrefetcherIndirectDirBlockTail(t, q, bg, config, false)
}

func TestPrefetcherIndirectDirBlockTailWithSync(t *testing.T) {
	t.Log("Test indirect dir block tail prefetching with sync.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(t, q, nil)

	testPrefetcherIndirectDirBlockTail(t, q, bg, config, true)
}

func TestPrefetcherDirectDirBlock(t *testing.T) {
	t.Log("Test direct dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	defer shutdownPrefetcherTest(t, q, nil)

	t.Log("Initialize a direct dir block with entries pointing to 3 files.")
	fileA := makeFakeFileBlock(t, true)
	fileC := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 100, "a"),
		"b": makeRandomDirEntry(t, data.Dir, 60, "b"),
		"c": makeRandomDirEntry(t, data.Exec, 20, "c"),
	})
	dirB := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"d": makeRandomDirEntry(t, data.File, 100, "d"),
	})
	dirBfileD := makeFakeFileBlock(t, true)

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)
	_, continueChFileA :=
		bg.setBlockToReturn(rootDir.Children["a"].BlockPointer, fileA)
	_, continueChDirB :=
		bg.setBlockToReturn(rootDir.Children["b"].BlockPointer, dirB)
	_, continueChFileC :=
		bg.setBlockToReturn(rootDir.Children["c"].BlockPointer, fileC)
	_, _ = bg.setBlockToReturn(dirB.Children["d"].BlockPointer, dirBfileD)

	var block data.Block = &data.DirBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		data.TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
	waitForPrefetchOrBust(
		ctx, t, q.Prefetcher(), rootDir.Children["c"].BlockPointer)

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
	_, err = config.BlockCache().Get(rootDir.Children["a"].BlockPointer)
	require.EqualError(t, err,
		data.NoSuchBlockError{
			ID: rootDir.Children["a"].BlockPointer.ID,
		}.Error())
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	_, err = config.BlockCache().Get(dirB.Children["d"].BlockPointer)
	require.EqualError(t, err,
		data.NoSuchBlockError{ID: dirB.Children["d"].BlockPointer.ID}.Error())
}

func TestPrefetcherAlreadyCached(t *testing.T) {
	t.Log("Test direct dir block prefetching when the dir block is cached.")
	q, bg, config := initPrefetcherTest(t)
	cache := config.BlockCache()
	defer shutdownPrefetcherTest(t, q, nil)

	t.Log("Initialize a direct dir block with an entry pointing to 1 " +
		"folder, which in turn points to 1 file.")
	fileB := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 60, "a"),
	})
	dirA := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"b": makeRandomDirEntry(t, data.File, 100, "b"),
	})

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)
	_, continueChDirA :=
		bg.setBlockToReturn(rootDir.Children["a"].BlockPointer, dirA)
	_, continueChFileB :=
		bg.setBlockToReturn(dirA.Children["b"].BlockPointer, fileB)

	t.Log("Request the root block.")
	kmd := makeKMD()
	var block data.Block = &data.DirBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, data.TransientEntry, BlockRequestWithPrefetch)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release the prefetch for dirA.")
	continueChDirA <- nil
	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the prefetched block is in the cache.")
	block, err = cache.Get(rootDir.Children["a"].BlockPointer)
	require.NoError(t, err)
	require.Equal(t, dirA, block)
	t.Log("Ensure that the second-level directory didn't cause a prefetch.")
	_, err = cache.Get(dirA.Children["b"].BlockPointer)
	require.EqualError(t, err,
		data.NoSuchBlockError{ID: dirA.Children["b"].BlockPointer.ID}.Error())

	t.Log("Request the already-cached second-level directory block. We don't " +
		"need to unblock this one.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootDir.Children["a"].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dirA, block)

	t.Log("Release the prefetch for fileB.")
	continueChFileB <- nil
	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(
		ctx, t, q.Prefetcher(), rootDir.Children["a"].BlockPointer)
	waitForPrefetchOrBust(
		ctx, t, q.Prefetcher(), rootDir.Children["b"].BlockPointer)

	testPrefetcherCheckGet(t, cache, dirA.Children["b"].BlockPointer, fileB,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	// Check that the dir block is marked as having been prefetched.
	testPrefetcherCheckGet(t, cache, rootDir.Children["a"].BlockPointer, dirA,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Remove the prefetched file block from the cache.")
	err = cache.DeleteTransient(dirA.Children["b"].BlockPointer.ID, kmd.TlfID())
	require.NoError(t, err)
	_, err = cache.Get(dirA.Children["b"].BlockPointer)
	require.EqualError(t, err,
		data.NoSuchBlockError{ID: dirA.Children["b"].BlockPointer.ID}.Error())

	t.Log("Request the second-level directory block again. No prefetches " +
		"should be triggered.")
	block = &data.DirBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootDir.Children["a"].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, dirA, block)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(
		ctx, t, q.Prefetcher(), rootDir.Children["a"].BlockPointer)
}

func TestPrefetcherNoRepeatedPrefetch(t *testing.T) {
	t.Log("Test that prefetches are only triggered once for a given block.")
	q, bg, config := initPrefetcherTest(t)
	cache := config.BlockCache().(*data.BlockCacheStandard)
	defer shutdownPrefetcherTest(t, q, nil)

	t.Log("Initialize a direct dir block with an entry pointing to 1 file.")
	fileA := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 60, "a"),
	})
	ptrA := rootDir.Children["a"].BlockPointer

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)
	_, continueChFileA := bg.setBlockToReturn(ptrA, fileA)

	t.Log("Request the root block.")
	var block data.Block = &data.DirBlock{}
	kmd := makeKMD()
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, data.TransientEntry, BlockRequestWithPrefetch)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release the prefetched block.")
	continueChFileA <- nil

	t.Log("Wait for the prefetch to finish, then verify that the prefetched " +
		"block is in the cache.")
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), ptrA)
	testPrefetcherCheckGet(
		t, config.BlockCache(), ptrA, fileA, FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Remove the prefetched block from the cache.")
	err = cache.DeleteTransient(ptrA.ID, kmd.TlfID())
	require.NoError(t, err)
	_, err = cache.Get(ptrA)
	require.EqualError(t, err, data.NoSuchBlockError{ID: ptrA.ID}.Error())

	t.Log("Request the root block again. It should be cached, so it should " +
		"return without needing to release the block.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Wait for the prefetch to finish, then verify that the child " +
		"block is still not in the cache.")
	_, err = cache.Get(ptrA)
	require.EqualError(t, err, data.NoSuchBlockError{ID: ptrA.ID}.Error())
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
}

func TestPrefetcherEmptyDirectDirBlock(t *testing.T) {
	t.Log("Test empty direct dir block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize an empty direct dir block.")
	rootPtr := makeRandomBlockPointer(t)
	rootDir := makeFakeDirBlockWithChildren(map[string]data.DirEntry{})

	_, continueChRootDir := bg.setBlockToReturn(rootPtr, rootDir)

	var block data.Block = &data.DirBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Wait for prefetching to complete.")
	notifySyncCh(t, prefetchSyncCh)
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

	t.Log("Ensure that the directory block is in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func testPrefetcherForSyncedTLF(
	t *testing.T, q *blockRetrievalQueue, bg *fakeBlockGetter,
	config *testBlockRetrievalConfig, prefetchSyncCh chan struct{},
	kmd libkey.KeyMetadata, explicitSync bool) {
	t.Log("Initialize a direct dir block with entries pointing to 2 files " +
		"and 1 directory. The directory has an entry pointing to another " +
		"file, which has 2 indirect blocks.")
	fileA := makeFakeFileBlock(t, true)
	fileC := makeFakeFileBlock(t, true)
	rootPtr := makeRandomBlockPointer(t)
	rootDir := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 100, "a"),
		"b": makeRandomDirEntry(t, data.Dir, 60, "b"),
		"c": makeRandomDirEntry(t, data.Exec, 20, "c"),
	})
	dirB := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"d": makeRandomDirEntry(t, data.File, 100, "d"),
	})
	dirBfileDptrs := []data.IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 0),
		makeFakeIndirectFilePtr(t, 150),
	}
	dirBfileD := makeFakeFileBlockWithIPtrs(dirBfileDptrs)
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

	var block data.Block = &data.DirBlock{}
	action := BlockRequestWithPrefetch
	if explicitSync {
		action = BlockRequestWithDeepSync
	}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd, rootPtr,
		block, data.TransientEntry, action)
	continueChRootDir <- nil
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	t.Log("Release all the blocks.")
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	waitChCh := make(chan (<-chan struct{}), 1)
	statusCh := make(chan PrefetchProgress)
	go func() {
		waitCh, err := q.Prefetcher().WaitChannelForBlockPrefetch(ctx, rootPtr)
		if err != nil {
			waitChCh <- nil
		} else {
			waitChCh <- waitCh
		}
		status, _ := q.Prefetcher().Status(ctx, rootPtr)
		statusCh <- status
		overallStatus := q.Prefetcher().OverallSyncStatus()
		statusCh <- overallStatus
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
	select {
	case status := <-statusCh:
		// The root block has 3 children (the root block itself
		// doesn't count in the bytes total).
		require.Equal(t, uint64(3*testFakeBlockSize), status.SubtreeBytesTotal)
		require.Equal(t, uint64(0), status.SubtreeBytesFetched)
		require.Equal(t, config.Clock().Now(), status.Start)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	select {
	case overallStatus := <-statusCh:
		// The root block _does_ count in the overall total, and has
		// already been fetched.
		require.Equal(
			t, uint64(4*testFakeBlockSize), overallStatus.SubtreeBytesTotal)
		require.Equal(
			t, uint64(1*testFakeBlockSize), overallStatus.SubtreeBytesFetched)
		require.Equal(t, config.Clock().Now(), overallStatus.Start)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
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

	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr,
		block, data.TransientEntry, BlockRequestWithPrefetch)
	// We don't need to release the block this time because it should be cached
	// already.
	err = <-ch
	require.NoError(t, err)
	require.Equal(t, rootDir, block)

	notifySyncCh(t, prefetchSyncCh)
	t.Log("Wait for prefetching to complete.")

	// FIXME: Unknown synchronization flake coming from the prefetches above.
	// To make CI work again, we close the `prefetchSyncCh` which unblocks all
	// prefetches.
	close(prefetchSyncCh)
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootDir,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
}

func TestPrefetcherForSyncedTLF(t *testing.T) {
	t.Log("Test synced TLF prefetching.")
	q, bg, config := initPrefetcherTest(t)
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	kmd := makeKMD()
	_, err := config.SetTlfSyncState(
		context.Background(), kmd.TlfID(), FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		})
	require.NoError(t, err)
	testPrefetcherForSyncedTLF(t, q, bg, config, prefetchSyncCh, kmd, false)
}

func TestPrefetcherForRequestedSync(t *testing.T) {
	t.Log("Test explicitly-requested synced prefetching.")
	q, bg, config := initPrefetcherTest(t)
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	kmd := makeKMD()
	testPrefetcherForSyncedTLF(t, q, bg, config, prefetchSyncCh, kmd, true)
}

func TestPrefetcherMultiLevelIndirectFile(t *testing.T) {
	t.Log("Test multi-level indirect file block prefetching.")
	q, bg, config := initPrefetcherTest(t)
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()

	t.Log("Initialize an indirect file block pointing to 2 file data blocks.")
	ptrs := []data.IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 0),
		makeFakeIndirectFilePtr(t, 150),
	}
	rootPtr := makeRandomBlockPointer(t)
	rootBlock := &data.FileBlock{IPtrs: ptrs}
	rootBlock.IsInd = true
	indBlock1 := &data.FileBlock{IPtrs: []data.IndirectFilePtr{
		makeFakeIndirectFilePtr(t, 10),
		makeFakeIndirectFilePtr(t, 20),
	}}
	indBlock1.IsInd = true
	indBlock2 := &data.FileBlock{IPtrs: []data.IndirectFilePtr{
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

	var block data.Block = &data.FileBlock{}
	kmd := makeKMD()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd, rootPtr, block,
		data.TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Ensure that the prefetched blocks are in the cache.")
	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, rootBlock,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[0].BlockPointer,
		indBlock1, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), ptrs[1].BlockPointer,
		indBlock2, NoPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Fetch indirect block1 on-demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootBlock.IPtrs[0].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release the prefetch for indirect block1.")
	// Release 2 blocks
	continueChIndBlock11 <- nil
	notifySyncCh(t, prefetchSyncCh)
	continueChIndBlock12 <- nil
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch indirect block2 on-demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootBlock.IPtrs[1].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release the prefetch for indirect block2.")
	// Release 2 blocks
	continueChIndBlock21 <- nil
	notifySyncCh(t, prefetchSyncCh)
	continueChIndBlock22 <- nil
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch indirect block11 on-demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		indBlock1.IPtrs[0].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch indirect block12 on-demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		indBlock1.IPtrs[1].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(
		ctx, t, q.Prefetcher(), indBlock1.IPtrs[1].BlockPointer)

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
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa -> {aab, aaa}}}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 10, "a"),
		"b": makeRandomDirEntry(t, data.File, 20, "b"),
	})
	a := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"aa": makeRandomDirEntry(t, data.Dir, 30, "aa"),
		"ab": makeRandomDirEntry(t, data.File, 40, "ab"),
	})
	b := makeFakeFileBlock(t, true)
	aa := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"aaa": makeRandomDirEntry(t, data.File, 50, "aaa"),
		"aab": makeRandomDirEntry(t, data.File, 60, "aab"),
	})
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
	var block data.Block = &data.DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		a.Children["aa"].BlockPointer, block, data.TransientEntry,
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
	block = &data.FileBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		aa.Children["aaa"].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch file aab.")
	block = &data.FileBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		aa.Children["aab"].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch file ab.")
	block = &data.FileBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		a.Children["ab"].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	contChAB <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch dir a.")
	block = &data.DirBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		root.Children["a"].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of dir a.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch file b.")
	block = &data.FileBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		root.Children["b"].BlockPointer, block, data.TransientEntry,
		BlockRequestWithPrefetch)
	contChB <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch dir root.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of root.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

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
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa -> {aab, aaa}}}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 10, "a"),
		"b": makeRandomDirEntry(t, data.File, 20, "b"),
	})
	aPtr := root.Children["a"].BlockPointer
	a := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"aa": makeRandomDirEntry(t, data.Dir, 30, "aa"),
		"ab": makeRandomDirEntry(t, data.File, 40, "ab"),
	})
	bPtr := root.Children["b"].BlockPointer
	b := makeFakeFileBlock(t, true)
	aaPtr := a.Children["aa"].BlockPointer
	aa := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"aaa": makeRandomDirEntry(t, data.File, 50, "aaa"),
		"aab": makeRandomDirEntry(t, data.File, 60, "aab"),
	})
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
	block := &data.DirBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	_, err = config.SetTlfSyncState(ctx, kmd.TlfID(), FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_ENABLED,
	})
	require.NoError(t, err)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, NoPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	t.Log("Fetch dir root again.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)

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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

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
	limiter.syncCacheByteTracker.updateSemaphoreMax()
	limiter.diskCacheByteTracker.limit = workingLimit
	limiter.diskCacheByteTracker.updateSemaphoreMax()
}

func testGetDiskCacheBytes(syncCache, workingCache *DiskBlockCacheLocal) (
	syncBytes, workingBytes int64) {
	syncBytes = int64(syncCache.getCurrBytes())
	workingBytes = int64(workingCache.getCurrBytes())
	return syncBytes, workingBytes
}

func TestSyncBlockCacheWithPrefetcher(t *testing.T) {
	t.Log("Test synced TLF prefetching with the disk cache.")
	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	defer cache.Shutdown(ctx)
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	syncCache := cache.syncCache
	workingCache := cache.workingSetCache

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa -> {aab, aaa}}}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 10, "a"),
		"b": makeRandomDirEntry(t, data.File, 20, "b"),
	})
	aPtr := root.Children["a"].BlockPointer
	a := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"aa": makeRandomDirEntry(t, data.Dir, 30, "aa"),
		"ab": makeRandomDirEntry(t, data.File, 40, "ab"),
	})
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
	block := &data.DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetched children of root.")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Now set the folder to sync.")
	_, err = config.SetTlfSyncState(ctx, kmd.TlfID(), FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_ENABLED,
	})
	require.NoError(t, err)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, NoPrefetch,
		kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	t.Log("Set the cache maximum bytes to the current total.")
	syncBytes, workingBytes := testGetDiskCacheBytes(syncCache, workingCache)
	limiter := dbcConfig.DiskLimiter().(*backpressureDiskLimiter)
	setLimiterLimits(limiter, syncBytes, workingBytes)

	t.Log("Fetch dir root again.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)

	// Notify the sync chan once for the canceled prefetch.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Prefetching shouldn't happen because the disk caches are full.")
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
}

func TestPrefetcherBasicUnsyncedPrefetch(t *testing.T) {
	t.Log("Test basic unsynced prefetching with only 2 blocks.")
	q, bg, config := initPrefetcherTest(t)
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 10, "a"),
	})
	aPtr := root.Children["a"].BlockPointer
	a := makeFakeFileBlock(t, true)

	_, contChRoot := bg.setBlockToReturn(rootPtr, root)
	_, contChA := bg.setBlockToReturn(aPtr, a)

	t.Log("Fetch dir root.")
	var block data.Block = &data.DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	contChRoot <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"a\" on demand.")
	block = &data.FileBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
}

func TestPrefetcherBasicUnsyncedBackwardPrefetch(t *testing.T) {
	t.Log("Test basic unsynced prefetching with only 2 blocks fetched " +
		"in reverse.")
	q, bg, config := initPrefetcherTest(t)
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 10, "a"),
	})
	aPtr := root.Children["a"].BlockPointer
	a := makeFakeFileBlock(t, true)

	_, contChRoot := bg.setBlockToReturn(rootPtr, root)
	_, contChA := bg.setBlockToReturn(aPtr, a)

	t.Log("Fetch child block \"a\" on demand.")
	var block data.Block = &data.FileBlock{}
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	t.Log("Release child block \"a\".")
	contChA <- nil
	notifySyncCh(t, prefetchSyncCh)
	err := <-ch
	require.NoError(t, err)
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a, FinishedPrefetch,
		kmd.TlfID(), config.DiskBlockCache())

	t.Log("Fetch dir root.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
}

func TestPrefetcherUnsyncedPrefetchEvicted(t *testing.T) {
	t.Log("Test basic unsynced prefetching with a block that has been evicted.")
	dbc, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, dbc)
	// We don't want any of these blocks cached in memory.
	bcache := config.testCache
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 10, "a"),
	})
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
	var block data.Block = &data.DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	// Notify sync channel for the child block `a`.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Set the metadata of the block in the disk cache to NoPrefetch, " +
		"simulating an eviction and a BlockServer.Get.")
	err = dbc.UpdateMetadata(
		ctx, kmd.TlfID(), rootPtr.ID, NoPrefetch, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Evict the root block from the block cache.")
	err = bcache.DeleteTransient(rootPtr.ID, kmd.TlfID())
	require.NoError(t, err)

	t.Log("Fetch dir root again.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"a\" on demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a, b}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 10, "a"),
		"b": makeRandomDirEntry(t, data.File, 10, "b"),
	})
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
	var block data.Block = &data.DirBlock{}
	ch := q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	err = dbc.UpdateMetadata(
		ctx, kmd.TlfID(), rootPtr.ID, NoPrefetch, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Evict the root block from the block cache.")
	err = bcache.DeleteTransient(rootPtr.ID, kmd.TlfID())
	require.NoError(t, err)

	t.Log("Fetch dir root again.")
	block = &data.DirBlock{}
	ch = q.Request(
		context.Background(), defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)
	// Notify sync channel for only child block `a`, since `b` wasn't newly
	// triggered.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Fetch child block \"a\" on demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	// Notify sync channel for the child block `a`.
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"b\" on demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		bPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
}

func TestPrefetcherUnsyncedPrefetchParentCanceled(t *testing.T) {
	t.Log("Regression test for KBFS-2588: when a prefetched block has " +
		"children waiting on a prefetch, and it is canceled, subsequent " +
		"attempts to prefetch that parent block panic.")
	dbc, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, dbc)
	bcache := config.testCache
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a, b}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 10, "a"),
		"b": makeRandomDirEntry(t, data.File, 10, "b"),
	})
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
	var block data.Block = &data.DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	err = dbc.UpdateMetadata(
		ctx, kmd.TlfID(), rootPtr.ID, NoPrefetch, DiskBlockAnyCache)
	require.NoError(t, err)

	t.Log("Evict the root block from the block cache.")
	err = bcache.DeleteTransient(rootPtr.ID, kmd.TlfID())
	require.NoError(t, err)

	t.Log("Fetch dir root again.")
	block = &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)
	// Neither blocks `a` nor `b` got triggered, since they already existed.
	// So no need to notify the sync channel.

	t.Log("Fetch child block \"a\" on demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	// Notify sync channel for the child block `a`.
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Fetch child block \"b\" on demand.")
	block = &data.FileBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		bPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
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
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)
}

func waitDoneCh(ctx context.Context, t *testing.T, doneCh <-chan struct{}) {
	t.Helper()
	select {
	case <-doneCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
}

func TestPrefetcherReschedules(t *testing.T) {
	t.Log("Test synced TLF prefetch rescheduling.")
	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	syncCache := cache.syncCache
	workingCache := cache.workingSetCache

	t.Log("Initialize a folder tree with structure: " +
		"root -> {b, a -> {ab, aa}}")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 10, "a"),
		"b": makeRandomDirEntry(t, data.File, 20, "b"),
	})
	aPtr := root.Children["a"].BlockPointer
	a := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"aa": makeRandomDirEntry(t, data.File, 30, "aa"),
		"ab": makeRandomDirEntry(t, data.File, 40, "ab"),
	})
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

	_, err = config.SetTlfSyncState(ctx, kmd.TlfID(), FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_ENABLED,
	})
	require.NoError(t, err)
	// We must use a special channel here to learn when each
	// prefetcher operation has finished.  That's because we shouldn't
	// adjust the disk limiter limits during the processing of a
	// prefetcher operation.  If we do, we introduce racy behavior
	// where sometimes the prefetcher will be able to write stuff to
	// the cache, and sometimes not.
	prefetchDoneCh := make(chan struct{})
	q.TogglePrefetcher(true, prefetchSyncCh, prefetchDoneCh)
	q.Prefetcher().(*blockPrefetcher).makeNewBackOff = func() backoff.BackOff {
		return &backoff.ZeroBackOff{}
	}

	t.Log("Set the cache maximum bytes to the current total.")
	syncBytes, workingBytes := testGetDiskCacheBytes(syncCache, workingCache)
	limiter := dbcConfig.DiskLimiter().(*backpressureDiskLimiter)
	setLimiterLimits(limiter, syncBytes, workingBytes)

	t.Log("Fetch dir root.")
	block := &data.DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release reschedule request of root.")
	notifySyncCh(t, prefetchSyncCh)
	waitDoneCh(ctx, t, prefetchDoneCh)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		NoPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Make room in the cache.")
	setLimiterLimits(limiter, math.MaxInt64, math.MaxInt64)

	t.Log("Handle root's prefetch request")
	notifySyncCh(t, prefetchSyncCh)
	waitDoneCh(ctx, t, prefetchDoneCh)

	t.Log("Handle two child prefetch requests (a and b)")
	notifySyncCh(t, prefetchSyncCh)
	waitDoneCh(ctx, t, prefetchDoneCh)
	notifySyncCh(t, prefetchSyncCh)
	waitDoneCh(ctx, t, prefetchDoneCh)

	blockA := &data.DirBlock{}
	chA := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		aPtr, blockA, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-chA
	require.NoError(t, err)
	blockB := &data.FileBlock{}
	chB := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		bPtr, blockB, data.TransientEntry, BlockRequestWithPrefetch)
	err = <-chB
	require.NoError(t, err)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a,
		TriggeredPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), bPtr, b,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())

	t.Log("Set the cache maximum bytes to the current total again.")
	syncBytes, workingBytes = testGetDiskCacheBytes(syncCache, workingCache)
	setLimiterLimits(limiter, syncBytes, workingBytes)

	t.Log("Process requests of two more children (aa and ab)")
	notifySyncCh(t, prefetchSyncCh)
	waitDoneCh(ctx, t, prefetchDoneCh)
	notifySyncCh(t, prefetchSyncCh)
	waitDoneCh(ctx, t, prefetchDoneCh)

	t.Log("Make room in the cache again.")
	setLimiterLimits(limiter, math.MaxInt64, math.MaxInt64)

	t.Log("Finish all the prefetching.")
	close(prefetchSyncCh)
	// We can't close the done channel right away since the prefetcher
	// still needs to send on it for every remaining operation it
	// processes, so just spawn a goroutine to drain it, and close the
	// channel when the test is over.
	defer close(prefetchDoneCh)
	go func() {
		for range prefetchDoneCh {
		}
	}()

	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

	testPrefetcherCheckGet(t, config.BlockCache(), rootPtr, root,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aPtr, a,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), aaPtr, aa,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	testPrefetcherCheckGet(t, config.BlockCache(), abPtr, ab,
		FinishedPrefetch, kmd.TlfID(), config.DiskBlockCache())
	<-q.Prefetcher().Shutdown()
}

func TestPrefetcherWithDedupBlocks(t *testing.T) {
	t.Log("Test how the prefetcher works with block IDs that " +
		"have multiple refs.")

	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, config := initPrefetcherTestWithDiskCache(t, cache)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: " +
		"root -> {a, b}, where a and b are refs to the same block ID.")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.File, 10, "a"),
	})
	aPtr := root.Children["a"].BlockPointer
	childB := root.Children["a"]
	bNonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)
	childB.RefNonce = bNonce
	root.Children["b"] = childB
	bPtr := childB.BlockPointer

	aBlock := makeFakeFileBlock(t, true)

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
	block := &data.DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithDeepSync)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetches of the one unique child pointer.")
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Wait for the prefetch to finish.")
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr)

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
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	kmd := makeKMD()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Initialize a folder tree with structure: root -> a -> b")
	rootPtr := makeRandomBlockPointer(t)
	root := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 10, "a"),
	})
	aPtr := root.Children["a"].BlockPointer
	aBlock := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"b": makeRandomDirEntry(t, data.File, 10, "b"),
	})
	bPtr := aBlock.Children["b"].BlockPointer
	bBlock := makeFakeFileBlock(t, true)

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
	block := &data.DirBlock{}
	ch := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		rootPtr, block, data.TransientEntry, BlockRequestWithDeepSync)
	notifySyncCh(t, prefetchSyncCh)
	err = <-ch
	require.NoError(t, err)

	t.Log("Release prefetch of a.")
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Before prefetching the child, update the root block to have a " +
		"new subdir pointing to the same ID but different nonce.")

	root2Ptr := makeRandomBlockPointer(t)
	root2 := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a2": makeRandomDirEntry(t, data.Dir, 10, "a2"),
	})
	a2Ptr := root2.Children["a2"].BlockPointer
	childB2 := aBlock.Children["b"]
	b2Nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)
	childB2.RefNonce = b2Nonce
	a2Block := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"b2": childB2,
	})
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
	block2 := &data.DirBlock{}
	ch = q.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		a2Ptr, block2, data.TransientEntry, BlockRequestWithDeepSync)
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

	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), a2Ptr)
}

func TestPrefetcherCancelTlfPrefetches(t *testing.T) {
	t.Log("Test that prefetches from a given TLF can all be canceled.")

	cache, dbcConfig := initDiskBlockCacheTest(t)
	q, bg, _ := initPrefetcherTestWithDiskCache(t, cache)
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()
	prefetchSyncCh := make(chan struct{})
	defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
	q.TogglePrefetcher(true, prefetchSyncCh, nil)
	notifySyncCh(t, prefetchSyncCh)

	kmd1 := libkeytest.NewEmptyKeyMetadata(tlf.FakeID(1, tlf.Private), 1)
	kmd2 := libkeytest.NewEmptyKeyMetadata(tlf.FakeID(2, tlf.Private), 1)

	bg.respectCancel = true

	t.Log("Make two blocks each for two different TLFs")
	rootPtr1 := makeRandomBlockPointer(t)
	root1 := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 10, "a"),
	})
	encRoot1, serverHalfRoot1 :=
		setupRealBlockForDiskCache(t, rootPtr1, root1, dbcConfig)
	err := cache.Put(
		ctx, kmd1.TlfID(), rootPtr1.ID, encRoot1, serverHalfRoot1,
		DiskBlockAnyCache)
	require.NoError(t, err)
	_, _ = bg.setBlockToReturn(rootPtr1, root1)

	rootPtr2 := makeRandomBlockPointer(t)
	root2 := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"a": makeRandomDirEntry(t, data.Dir, 10, "a"),
	})
	encRoot2, serverHalfRoot2 :=
		setupRealBlockForDiskCache(t, rootPtr2, root2, dbcConfig)
	err = cache.Put(
		ctx, kmd2.TlfID(), rootPtr2.ID, encRoot2, serverHalfRoot2,
		DiskBlockAnyCache)
	require.NoError(t, err)
	_, _ = bg.setBlockToReturn(rootPtr2, root2)

	aPtr1 := root1.Children["a"].BlockPointer
	aBlock1 := makeFakeDirBlockWithChildren(map[string]data.DirEntry{
		"b": makeRandomDirEntry(t, data.Dir, 10, "b"),
	})
	// Don't put this block in the disk cache; let the prefetcher try
	// to fetch it from the block getter, and never release it.
	require.NoError(t, err)
	getA1, _ := bg.setBlockToReturn(aPtr1, aBlock1)

	aPtr2 := root2.Children["a"].BlockPointer
	aBlock2 := makeFakeDirBlockWithChildren(map[string]data.DirEntry{})
	encA2, serverHalfA2 :=
		setupRealBlockForDiskCache(t, aPtr2, aBlock2, dbcConfig)
	err = cache.Put(
		ctx, kmd2.TlfID(), aPtr2.ID, encA2, serverHalfA2,
		DiskBlockAnyCache)
	require.NoError(t, err)
	_, _ = bg.setBlockToReturn(aPtr2, aBlock2)

	t.Log("Request both roots")
	block1 := &data.DirBlock{}
	ch1 := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd1,
		rootPtr1, block1, data.TransientEntry, BlockRequestPrefetchUntilFull)
	block2 := &data.DirBlock{}
	ch2 := q.Request(
		ctx, defaultOnDemandRequestPriority, kmd2,
		rootPtr2, block2, data.TransientEntry, BlockRequestPrefetchUntilFull)
	err = <-ch1
	require.NoError(t, err)
	err = <-ch2
	require.NoError(t, err)

	t.Log("Release both root blocks for prefetching")
	notifySyncCh(t, prefetchSyncCh)
	notifySyncCh(t, prefetchSyncCh)

	select {
	case <-getA1:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Cancel the first TLF's prefetches")
	ch := make(chan struct{})
	go func() {
		notifySyncCh(t, prefetchSyncCh)
		close(ch)
	}()
	err = q.Prefetcher().CancelTlfPrefetches(ctx, kmd1.TlfID())
	<-ch
	require.NoError(t, err)

	// Handle another CancelPrefetch call from the a1's request
	// context being canceled.
	notifySyncCh(t, prefetchSyncCh)

	t.Log("Now we should be able to wait for the prefetcher to " +
		"complete with only a single notify, for root2's child.")
	notifySyncCh(t, prefetchSyncCh)
	waitForPrefetchOrBust(ctx, t, q.Prefetcher(), rootPtr2)
}
