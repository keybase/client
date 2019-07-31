// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"os"
	"testing"

	kbfsdata "github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type blockJournalEntryFuture struct {
	blockJournalEntry
	kbfscodec.Extra
}

func (ef blockJournalEntryFuture) toCurrent() blockJournalEntry {
	return ef.blockJournalEntry
}

func (ef blockJournalEntryFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return ef.toCurrent()
}

func makeFakeBlockJournalEntryFuture(t *testing.T) blockJournalEntryFuture {
	ef := blockJournalEntryFuture{
		blockJournalEntry{
			blockPutOp,
			kbfsblock.ContextMap{
				kbfsblock.FakeID(1): {
					makeFakeBlockContext(t),
					makeFakeBlockContext(t),
					makeFakeBlockContext(t),
				},
			},
			kbfsmd.RevisionInitial,
			false,
			false,
			false,
			codec.UnknownFieldSetHandler{},
		},
		kbfscodec.MakeExtraOrBust("blockJournalEntry", t),
	}
	return ef
}

func TestBlockJournalEntryUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeBlockJournalEntryFuture(t))
}

func TestSaturateAdd(t *testing.T) {
	var x int64
	saturateAdd(&x, math.MaxInt64-1)
	require.Equal(t, int64(math.MaxInt64-1), x)
	saturateAdd(&x, math.MaxInt64-1)
	require.Equal(t, int64(math.MaxInt64), x)
	saturateAdd(&x, math.MinInt64+2)
	require.Equal(t, int64(1), x)
	saturateAdd(&x, math.MinInt64)
	require.Equal(t, int64(0), x)

	x = math.MinInt64
	saturateAdd(&x, math.MinInt64)
	require.Equal(t, int64(0), x)

	x = -1
	saturateAdd(&x, math.MinInt64)
	require.Equal(t, int64(0), x)

	x = -1
	saturateAdd(&x, 5)
	require.Equal(t, int64(5), x)

	x = -1
	saturateAdd(&x, 0)
	require.Equal(t, int64(0), x)
}

func setupBlockJournalTest(t *testing.T) (
	ctx context.Context, cancel context.CancelFunc, tempdir string,
	log logger.Logger, j *blockJournal) {
	codec := kbfscodec.NewMsgpack()
	log = logger.NewTestLogger(t)

	tempdir, err := ioutil.TempDir(os.TempDir(), "block_journal")
	require.NoError(t, err)

	// Clean up the tempdir if the rest of the setup fails.
	setupSucceeded := false
	defer func() {
		if !setupSucceeded {
			err := ioutil.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	ctx, cancel = context.WithTimeout(
		context.Background(), individualTestTimeout)

	// Clean up the context if the rest of the setup fails.
	defer func() {
		if !setupSucceeded {
			cancel()
		}
	}()

	j, err = makeBlockJournal(ctx, codec, tempdir, log, libkb.NewVDebugLog(log))
	require.NoError(t, err)
	require.Equal(t, uint64(0), j.length())

	setupSucceeded = true
	return ctx, cancel, tempdir, log, j
}

func teardownBlockJournalTest(ctx context.Context, t *testing.T,
	cancel context.CancelFunc, tempdir string, j *blockJournal) {
	cancel()

	err := j.checkInSyncForTest()
	assert.NoError(t, err)

	err = ioutil.RemoveAll(tempdir)
	assert.NoError(t, err)
}

func putBlockData(
	ctx context.Context, t *testing.T, j *blockJournal, data []byte) (
	kbfsblock.ID, kbfsblock.Context, kbfscrypto.BlockCryptKeyServerHalf) {
	oldLength := j.length()

	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	bCtx := kbfsblock.MakeFirstContext(
		uid1.AsUserOrTeam(), keybase1.BlockType_DATA)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	putData, err := j.putBlockData(ctx, bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.True(t, putData)
	err = j.appendBlock(ctx, bID, bCtx, int64(len(data)))
	require.NoError(t, err)

	require.Equal(t, oldLength+1, j.length())

	return bID, bCtx, serverHalf
}

func addBlockRef(
	ctx context.Context, t *testing.T, j *blockJournal,
	bID kbfsblock.ID) kbfsblock.Context {
	oldLength := j.length()

	nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	bCtx2 := kbfsblock.MakeContext(
		uid1.AsUserOrTeam(), uid2.AsUserOrTeam(), nonce,
		keybase1.BlockType_DATA)
	err = j.addReference(ctx, bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, oldLength+1, j.length())
	return bCtx2
}

func getAndCheckBlockData(ctx context.Context, t *testing.T, j *blockJournal,
	bID kbfsblock.ID, bCtx kbfsblock.Context, expectedData []byte,
	expectedServerHalf kbfscrypto.BlockCryptKeyServerHalf) {
	data, serverHalf, err := j.getDataWithContext(ctx, bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, expectedData, data)
	require.Equal(t, expectedServerHalf, serverHalf)
}

func TestBlockJournalBasic(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Make sure we get the same block back.
	getAndCheckBlockData(ctx, t, j, bID, bCtx, data, serverHalf)

	// Add a reference.
	bCtx2 := addBlockRef(ctx, t, j, bID)

	// Make sure we get the same block via that reference.
	getAndCheckBlockData(ctx, t, j, bID, bCtx2, data, serverHalf)

	// Shutdown and restart.
	err := j.checkInSyncForTest()
	require.NoError(t, err)
	j, err = makeBlockJournal(ctx, j.codec, tempdir, j.log, j.vlog)
	require.NoError(t, err)

	require.Equal(t, uint64(2), j.length())

	// Make sure we get the same block for both refs.

	getAndCheckBlockData(ctx, t, j, bID, bCtx, data, serverHalf)
	getAndCheckBlockData(ctx, t, j, bID, bCtx2, data, serverHalf)
}

func TestBlockJournalDuplicatePut(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	data := []byte{1, 2, 3, 4}

	oldLength := j.length()

	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	bCtx := kbfsblock.MakeFirstContext(
		uid1.AsUserOrTeam(), keybase1.BlockType_DATA)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	putData, err := j.putBlockData(ctx, bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.True(t, putData)
	err = j.appendBlock(ctx, bID, bCtx, int64(len(data)))
	require.NoError(t, err)

	require.Equal(t, int64(len(data)), j.getStoredBytes())
	require.Equal(t, int64(len(data)), j.getUnflushedBytes())
	require.Equal(t, int64(filesPerBlockMax), j.getStoredFiles())

	// Put a second time.
	putData, err = j.putBlockData(ctx, bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.False(t, putData)
	err = j.appendBlock(ctx, bID, bCtx, 0)
	require.NoError(t, err)

	require.Equal(t, oldLength+2, j.length())

	// Shouldn't count the block twice.
	require.Equal(t, int64(len(data)), j.getStoredBytes())
	require.Equal(t, int64(len(data)), j.getUnflushedBytes())
	require.Equal(t, int64(filesPerBlockMax), j.getStoredFiles())
}

func TestBlockJournalAddReference(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	// Add a reference, which should succeed.
	bCtx := addBlockRef(ctx, t, j, bID)

	// Of course, the block get should still fail.
	_, _, err = j.getDataWithContext(ctx, bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)
}

func TestBlockJournalArchiveReferences(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add a reference.
	bCtx2 := addBlockRef(ctx, t, j, bID)

	// Archive references.
	err := j.archiveReferences(
		ctx, kbfsblock.ContextMap{bID: {bCtx, bCtx2}})
	require.NoError(t, err)
	require.Equal(t, uint64(3), j.length())

	// Get block should still succeed.
	getAndCheckBlockData(ctx, t, j, bID, bCtx, data, serverHalf)
}

func TestBlockJournalArchiveNonExistentReference(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	uid1 := keybase1.MakeTestUID(1)

	bCtx := kbfsblock.MakeFirstContext(
		uid1.AsUserOrTeam(), keybase1.BlockType_DATA)

	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	// Archive references.
	err = j.archiveReferences(
		ctx, kbfsblock.ContextMap{bID: {bCtx}})
	require.NoError(t, err)
}

func TestBlockJournalRemoveReferences(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add a reference.
	bCtx2 := addBlockRef(ctx, t, j, bID)

	// Remove references.
	liveCounts, err := j.removeReferences(
		ctx, kbfsblock.ContextMap{bID: {bCtx, bCtx2}})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID: 0}, liveCounts)
	require.Equal(t, uint64(3), j.length())

	// Make sure the block data is inaccessible.
	_, _, err = j.getDataWithContext(ctx, bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)

	// But the actual data should remain (for flushing).
	buf, half, err := j.getData(ctx, bID)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, half)
}

func TestBlockJournalDuplicateRemove(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put the block.
	data := []byte{1, 2, 3, 4}
	dataLen := int64(len(data))
	bID, bCtx, _ := putBlockData(ctx, t, j, data)

	require.Equal(t, dataLen, j.getStoredBytes())
	require.Equal(t, dataLen, j.getUnflushedBytes())
	require.Equal(t, int64(filesPerBlockMax), j.getStoredFiles())

	// Remove the only reference to the block, then remove the
	// block.
	liveCounts, err := j.removeReferences(
		ctx, kbfsblock.ContextMap{bID: {bCtx}})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID: 0}, liveCounts)
	removedBytes, removedFiles, err := j.remove(ctx, bID)
	require.NoError(t, err)
	require.Equal(t, dataLen, removedBytes)
	require.Equal(t, int64(filesPerBlockMax), removedFiles)
	err = j.unstoreBlocks(removedBytes, removedFiles)
	require.NoError(t, err)

	// This violates the invariant that UnflushedBytes <=
	// StoredBytes, but that's because we're manually removing the
	// block -- normally, the block would be flushed first, then
	// removed.
	require.Equal(t, int64(0), j.getStoredBytes())
	require.Equal(t, dataLen, j.getUnflushedBytes())
	require.Equal(t, int64(0), j.getStoredFiles())

	// Remove the block again.
	removedBytes, removedFiles, err = j.remove(ctx, bID)
	require.NoError(t, err)
	require.Equal(t, int64(0), removedBytes)
	require.Equal(t, int64(0), removedFiles)

	// Shouldn't account for the block again.
	require.Equal(t, int64(0), j.getStoredBytes())
	require.Equal(t, dataLen, j.getUnflushedBytes())
	require.Equal(t, int64(0), j.getStoredFiles())
}

func testBlockJournalGCd(t *testing.T, j *blockJournal) {
	// None of these dirs should exist.
	for _, file := range j.blockJournalFiles() {
		_, err := ioutil.Stat(file)
		require.True(t, ioutil.IsNotExist(err))
	}

	require.True(t, j.empty())
	require.Equal(t, blockAggregateInfo{}, j.aggregateInfo)
}

func goGCForTest(ctx context.Context, t *testing.T, j *blockJournal) (
	int64, int64) {
	length, earliest, latest, err := j.getDeferredGCRange()
	require.NoError(t, err)
	if length == 0 {
		return 0, 0
	}
	removedBytes, removedFiles, err := j.doGC(ctx, earliest, latest)
	require.NoError(t, err)
	_, _, err = j.clearDeferredGCRange(
		ctx, removedBytes, removedFiles, earliest, latest)
	require.NoError(t, err)
	return removedBytes, removedFiles
}

func TestBlockJournalFlush(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add some references.

	bCtx2 := addBlockRef(ctx, t, j, bID)
	bCtx3 := addBlockRef(ctx, t, j, bID)

	// Archive one of the references.

	err := j.archiveReferences(
		ctx, kbfsblock.ContextMap{
			bID: {bCtx3},
		})
	require.NoError(t, err)

	blockServer := NewBlockServerMemory(log)

	tlfID := tlf.FakeID(1, tlf.Private)

	bcache := kbfsdata.NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	flush := func() (flushedBytes, removedBytes, removedFiles int64) {
		end, err := j.end()
		require.NoError(t, err)
		if end == 0 {
			return 0, 0, 0
		}

		// Test that the end parameter is respected.
		var partialEntries blockEntriesToFlush
		var rev kbfsmd.Revision
		if end > firstValidJournalOrdinal+1 {
			partialEntries, _, rev, err = j.getNextEntriesToFlush(
				ctx, end-1, maxJournalBlockFlushBatchSize)
			require.NoError(t, err)
			require.Equal(t, rev, kbfsmd.RevisionUninitialized)
		}

		entries, b, rev, err := j.getNextEntriesToFlush(ctx, end,
			maxJournalBlockFlushBatchSize)
		require.NoError(t, err)
		require.Equal(t, partialEntries.length()+1, entries.length())
		require.Equal(t, rev, kbfsmd.RevisionUninitialized)

		err = flushBlockEntries(
			ctx, j.log, j.deferLog, blockServer, bcache, reporter,
			tlfID, tlf.CanonicalName("fake TLF"), entries, DiskBlockAnyCache)
		require.NoError(t, err)

		flushedBytes, err = j.removeFlushedEntries(
			ctx, entries, tlfID, reporter)
		require.NoError(t, err)
		require.Equal(t, b, flushedBytes)

		removedBytes, removedFiles = goGCForTest(ctx, t, j)
		return flushedBytes, removedBytes, removedFiles
	}

	// Flushing all the reference adds should flush and remove the
	// (now-unreferenced) block.
	flushedBytes, removedBytes, removedFiles := flush()
	require.Equal(t, int64(len(data)), flushedBytes)
	require.Equal(t, int64(len(data)), removedBytes)
	require.Equal(t, int64(filesPerBlockMax), removedFiles)

	// Check the Put.
	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Check the AddReference.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Check the archiving.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Now remove all the references.
	liveCounts, err := j.removeReferences(
		ctx, kbfsblock.ContextMap{
			bID: {bCtx, bCtx2, bCtx3},
		})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID: 0}, liveCounts)

	flushedBytes, removedBytes, removedFiles = flush()
	require.Equal(t, int64(0), flushedBytes)
	require.Equal(t, int64(0), removedBytes)
	require.Equal(t, int64(0), removedFiles)

	// Check they're all gone.
	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)
	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx2, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)
	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx3, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	length := j.length()
	require.Equal(t, uint64(0), length)

	// Make sure the ordinals and blocks are flushed.
	testBlockJournalGCd(t, j)
}

func flushBlockJournalOne(ctx context.Context, t *testing.T,
	j *blockJournal, blockServer BlockServer,
	bcache kbfsdata.BlockCache, reporter Reporter, tlfID tlf.ID) (
	flushedBytes, removedFiles, removedBytes int64) {
	first, err := j.j.readEarliestOrdinal()
	require.NoError(t, err)
	entries, b, _, err := j.getNextEntriesToFlush(ctx, first+1,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, 1, entries.length())
	err = flushBlockEntries(ctx, j.log, j.deferLog, blockServer,
		bcache, reporter, tlfID, tlf.CanonicalName("fake TLF"),
		entries, DiskBlockAnyCache)
	require.NoError(t, err)
	flushedBytes, err = j.removeFlushedEntries(
		ctx, entries, tlfID, reporter)
	require.NoError(t, err)
	require.Equal(t, b, flushedBytes)

	removedBytes, removedFiles = goGCForTest(ctx, t, j)
	require.NoError(t, err)

	err = j.checkInSyncForTest()
	require.NoError(t, err)
	return flushedBytes, removedBytes, removedFiles
}

func TestBlockJournalFlushInterleaved(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add some references.

	bCtx2 := addBlockRef(ctx, t, j, bID)
	bCtx3 := addBlockRef(ctx, t, j, bID)

	// Flush the block put. (Interleave flushes to test
	// checkInSync in intermediate states.)

	blockServer := NewBlockServerMemory(log)

	tlfID := tlf.FakeID(1, tlf.Private)

	bcache := kbfsdata.NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	flushOne := func() (int64, int64, int64) {
		return flushBlockJournalOne(
			ctx, t, j, blockServer, bcache, reporter, tlfID)
	}

	flushedBytes, removedBytes, removedFiles := flushOne()
	require.Equal(t, int64(len(data)), flushedBytes)
	require.Equal(t, int64(0), removedBytes)
	require.Equal(t, int64(0), removedFiles)

	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Remove some references.

	liveCounts, err := j.removeReferences(
		ctx, kbfsblock.ContextMap{
			bID: {bCtx, bCtx2},
		})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID: 1}, liveCounts)

	// Flush the reference adds.

	flushOneZero := func() {
		flushedBytes, removedBytes, removedFiles := flushOne()
		require.Equal(t, int64(0), flushedBytes)
		require.Equal(t, int64(0), removedBytes)
		require.Equal(t, int64(0), removedFiles)
	}

	flushOneZero()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flushing the last reference add should remove the
	// (now-unreferenced) block.
	flushedBytes, removedBytes, removedFiles = flushOne()
	require.Equal(t, int64(0), flushedBytes)
	require.Equal(t, int64(len(data)), removedBytes)
	require.Equal(t, int64(filesPerBlockMax), removedFiles)

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Archive the rest.

	err = j.archiveReferences(
		ctx, kbfsblock.ContextMap{
			bID: {bCtx3},
		})
	require.NoError(t, err)

	// Flush the reference removals.

	flushOneZero()

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx2, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Remove the archived references.

	liveCounts, err = j.removeReferences(
		ctx, kbfsblock.ContextMap{
			bID: {bCtx3},
		})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID: 0}, liveCounts)

	// Flush the reference archival.

	flushOneZero()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flush the last removal.

	flushOneZero()

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx3, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	end, err := j.end()
	require.NoError(t, err)
	entries, b, _, err := j.getNextEntriesToFlush(ctx, end,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, 0, entries.length())
	require.Equal(t, int64(0), b)

	// Make sure the ordinals and blocks are flushed.
	testBlockJournalGCd(t, j)
}

func TestBlockJournalFlushMDRevMarker(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	putBlockData(ctx, t, j, data)

	// Put a revision marker
	rev := kbfsmd.Revision(10)
	err := j.markMDRevision(ctx, rev, false)
	require.NoError(t, err)

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, tlf.Private)
	bcache := kbfsdata.NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	// Make sure the block journal reports that entries up to `rev`
	// can be flushed.
	last, err := j.j.readLatestOrdinal()
	require.NoError(t, err)
	entries, b, gotRev, err := j.getNextEntriesToFlush(ctx, last+1,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, rev, gotRev)
	require.Equal(t, 2, entries.length())
	err = flushBlockEntries(ctx, j.log, j.deferLog, blockServer,
		bcache, reporter, tlfID, tlf.CanonicalName("fake TLF"),
		entries, DiskBlockAnyCache)
	require.NoError(t, err)
	flushedBytes, err := j.removeFlushedEntries(
		ctx, entries, tlfID, reporter)
	require.NoError(t, err)
	require.Equal(t, int64(len(data)), flushedBytes)
	require.Equal(t, b, flushedBytes)
	removedBytes, removedFiles := goGCForTest(ctx, t, j)
	require.NoError(t, err)
	require.Equal(t, int64(len(data)), removedBytes)
	require.Equal(t, int64(filesPerBlockMax), removedFiles)
	err = j.checkInSyncForTest()
	require.NoError(t, err)
}

func TestBlockJournalFlushMDRevMarkerForPendingLocalSquash(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put some blocks.

	data1 := []byte{1, 2, 3, 4}
	_, _, _ = putBlockData(ctx, t, j, data1)
	data2 := []byte{5, 6, 7, 8}
	id2, _, _ := putBlockData(ctx, t, j, data2)

	// Put a revision marker and say it's from a local squash.
	rev := kbfsmd.Revision(10)
	err := j.markMDRevision(ctx, rev, true)
	require.NoError(t, err)

	// Do another, that isn't from a local squash.
	data3 := []byte{9, 10, 11, 12}
	id3, _, _ := putBlockData(ctx, t, j, data3)
	data4 := []byte{13, 14, 15, 16}
	_, _, _ = putBlockData(ctx, t, j, data4)
	rev++
	err = j.markMDRevision(ctx, rev, false)
	require.NoError(t, err)

	ignoredBytes, err := j.ignoreBlocksAndMDRevMarkers(
		ctx, []kbfsblock.ID{id2, id3}, rev)
	require.NoError(t, err)
	require.Equal(t, int64(len(data2)+len(data3)), ignoredBytes)

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, tlf.Private)
	bcache := kbfsdata.NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	// Make sure the block journal reports that entries up to 10 can
	// be flushed; there should only be two blocks left, and one
	// revision marker (plus 2 ignored blocks and 1 ignored revision
	// marker).
	last, err := j.j.readLatestOrdinal()
	require.NoError(t, err)
	entries, b, gotRev, err := j.getNextEntriesToFlush(ctx, last+1,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, rev-1, gotRev)
	require.Equal(t, 6, entries.length())
	require.Equal(t, 2, entries.puts.numBlocks())
	require.Equal(t, 0, entries.adds.numBlocks())
	require.Len(t, entries.other, 4)

	err = flushBlockEntries(ctx, j.log, j.deferLog, blockServer,
		bcache, reporter, tlfID, tlf.CanonicalName("fake TLF"),
		entries, DiskBlockAnyCache)
	require.NoError(t, err)

	flushedBytes, err := j.removeFlushedEntries(
		ctx, entries, tlfID, reporter)
	require.NoError(t, err)
	require.Equal(t, int64(len(data1)+len(data4)), flushedBytes)
	require.Equal(t, b, flushedBytes)
	removedBytes, removedFiles := goGCForTest(ctx, t, j)
	require.NoError(t, err)
	require.Equal(t, int64(len(data1)+len(data2)+len(data3)+len(data4)),
		removedBytes)
	require.Equal(t, int64(4*filesPerBlockMax), removedFiles)

	err = j.checkInSyncForTest()
	require.NoError(t, err)
}

func TestBlockJournalIgnoreBlocks(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put a few blocks
	data1 := []byte{1, 2, 3}
	bID1, _, _ := putBlockData(ctx, t, j, data1)

	// Put a revision marker
	rev := kbfsmd.Revision(9)
	firstRev := rev
	err := j.markMDRevision(ctx, rev, false)
	require.NoError(t, err)

	data2 := []byte{4, 5, 6, 7}
	bID2, _, _ := putBlockData(ctx, t, j, data2)

	// Put a revision marker
	rev = kbfsmd.Revision(10)
	err = j.markMDRevision(ctx, rev, false)
	require.NoError(t, err)

	data3 := []byte{8, 9, 10, 11, 12}
	bID3, _, _ := putBlockData(ctx, t, j, data3)
	data4 := []byte{13, 14, 15, 16, 17, 18}
	bID4, _, _ := putBlockData(ctx, t, j, data4)

	// Put a revision marker
	rev = kbfsmd.Revision(11)
	err = j.markMDRevision(ctx, rev, false)
	require.NoError(t, err)

	ignoredBytes, err := j.ignoreBlocksAndMDRevMarkers(
		ctx, []kbfsblock.ID{bID2, bID3}, firstRev)
	require.NoError(t, err)
	require.Equal(t, int64(len(data2)+len(data3)), ignoredBytes)

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, tlf.Private)
	bcache := kbfsdata.NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	// Flush and make sure we only flush the non-ignored blocks.
	last, err := j.j.readLatestOrdinal()
	require.NoError(t, err)
	entries, b, gotRev, err := j.getNextEntriesToFlush(ctx, last+1,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.RevisionUninitialized, gotRev)
	require.Equal(t, 7, entries.length())
	require.Equal(t, 2, entries.puts.numBlocks())
	require.Equal(t, 0, entries.adds.numBlocks())
	require.Len(t, entries.other, 5)
	ptrs := entries.puts.Ptrs()
	ids := make([]kbfsblock.ID, len(ptrs))
	for i, ptr := range ptrs {
		ids[i] = ptr.ID
	}
	require.Contains(t, ids, bID1)
	require.Contains(t, ids, bID4)
	err = flushBlockEntries(ctx, j.log, j.deferLog, blockServer,
		bcache, reporter, tlfID, tlf.CanonicalName("fake TLF"),
		entries, DiskBlockAnyCache)
	require.NoError(t, err)
	flushedBytes, err := j.removeFlushedEntries(
		ctx, entries, tlfID, reporter)
	require.NoError(t, err)
	require.Equal(t, int64(len(data1)+len(data4)), flushedBytes)
	require.Equal(t, b, flushedBytes)

	// Flush everything.
	removedBytes, removedFiles := goGCForTest(ctx, t, j)
	require.NoError(t, err)
	require.Equal(t, int64(len(data1)+len(data2)+len(data3)+len(data4)),
		removedBytes)
	require.Equal(t, int64(4*filesPerBlockMax), removedFiles)

	err = j.checkInSyncForTest()
	require.NoError(t, err)
}

func TestBlockJournalSaveUntilMDFlush(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// Put a few blocks
	data1 := []byte{1, 2, 3, 4}
	bID1, _, _ := putBlockData(ctx, t, j, data1)
	data2 := []byte{5, 6, 7, 8}
	bID2, _, _ := putBlockData(ctx, t, j, data2)

	// Put a revision marker
	rev := kbfsmd.Revision(10)
	err := j.markMDRevision(ctx, rev, false)
	require.NoError(t, err)

	data3 := []byte{9, 10, 11, 12}
	bID3, _, _ := putBlockData(ctx, t, j, data3)
	data4 := []byte{13, 14, 15, 16}
	bID4, _, _ := putBlockData(ctx, t, j, data4)

	// Put a revision marker
	rev = kbfsmd.Revision(11)
	err = j.markMDRevision(ctx, rev, false)
	require.NoError(t, err)

	savedBlocks := []kbfsblock.ID{bID1, bID2, bID3, bID4}

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, tlf.Private)
	bcache := kbfsdata.NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	// Flush all the entries, but they should still remain accessible.
	flushAll := func() int64 {
		last, err := j.j.readLatestOrdinal()
		require.NoError(t, err)
		entries, b, _, err := j.getNextEntriesToFlush(ctx, last+1,
			maxJournalBlockFlushBatchSize)
		require.NoError(t, err)
		err = flushBlockEntries(ctx, j.log, j.deferLog, blockServer,
			bcache, reporter, tlfID, tlf.CanonicalName("fake TLF"),
			entries, DiskBlockAnyCache)
		require.NoError(t, err)
		flushedBytes, err := j.removeFlushedEntries(
			ctx, entries, tlfID, reporter)
		require.NoError(t, err)
		require.Equal(t, b, flushedBytes)
		return flushedBytes
	}
	flushedBytes := flushAll()
	require.Equal(t, int64(len(data1)+len(data2)+len(data3)+len(data4)),
		flushedBytes)

	// The blocks can still be fetched from the journal.
	for _, bid := range savedBlocks {
		ok, err := j.hasData(ctx, bid)
		require.NoError(t, err)
		require.True(t, ok)
	}

	// No more blocks to flush though.
	end, err := j.end()
	require.NoError(t, err)
	entries, b, gotRev, err := j.getNextEntriesToFlush(ctx, end,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, 0, entries.length())
	require.Equal(t, kbfsmd.RevisionUninitialized, gotRev)
	require.Equal(t, int64(0), b)

	// Add a few more blocks and save those too.
	data5 := []byte{17, 18, 19, 20}
	bID5, _, _ := putBlockData(ctx, t, j, data5)
	data6 := []byte{21, 22, 23, 24}
	bID6, _, _ := putBlockData(ctx, t, j, data6)
	savedBlocks = append(savedBlocks, bID5, bID6)
	flushedBytes = flushAll()
	require.Equal(t, int64(len(data5)+len(data6)), flushedBytes)

	// Make sure all the blocks still exist, including both the old
	// and the new ones.
	for _, bid := range savedBlocks {
		ok, err := j.hasData(ctx, bid)
		require.NoError(t, err)
		require.True(t, ok)
	}

	// Now remove all the data.
	var expectedBytes int64
	var expectedFiles int64
	for i := 0; i < len(savedBlocks)-1+2; i++ {
		if i%3 != 2 {
			expectedBytes += 4
			expectedFiles += filesPerBlockMax
		}
	}
	expectedBytes += 4
	expectedFiles += filesPerBlockMax

	removedBytes, removedFiles := goGCForTest(ctx, t, j)
	require.NoError(t, err)
	require.Equal(t, expectedBytes, removedBytes)
	require.Equal(t, expectedFiles, removedFiles)

	ok, err := j.isUnflushed(ctx, bID1)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = j.isUnflushed(ctx, bID2)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = j.isUnflushed(ctx, bID3)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = j.isUnflushed(ctx, bID4)
	require.NoError(t, err)
	require.False(t, ok)

	testBlockJournalGCd(t, j)
}

func TestBlockJournalByteCounters(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	// In this test, stored bytes and unflushed bytes should
	// change identically.
	requireCounts := func(expectedBytes, expectedFiles int) {
		require.Equal(t, int64(expectedBytes), j.getStoredBytes())
		require.Equal(t, int64(expectedBytes), j.getUnflushedBytes())
		require.Equal(t, int64(expectedFiles), j.getStoredFiles())
		var info blockAggregateInfo
		err := kbfscodec.DeserializeFromFile(
			j.codec, aggregateInfoPath(j.dir), &info)
		if !ioutil.IsNotExist(err) {
			require.NoError(t, err)
		}
		require.Equal(t, int64(expectedBytes), info.StoredBytes)
		require.Equal(t, int64(expectedBytes), info.UnflushedBytes)
		require.Equal(t, int64(expectedFiles), info.StoredFiles)
	}

	// Prime the cache.
	requireCounts(0, 0)

	data1 := []byte{1, 2, 3, 4}
	bID1, bCtx1, _ := putBlockData(ctx, t, j, data1)

	requireCounts(len(data1), filesPerBlockMax)

	data2 := []byte{1, 2, 3, 4, 5}
	bID2, bCtx2, _ := putBlockData(ctx, t, j, data2)

	expectedSize := len(data1) + len(data2)
	requireCounts(expectedSize, 2*filesPerBlockMax)

	// Adding, archive, or removing references shouldn't change
	// anything.

	bCtx1b := addBlockRef(ctx, t, j, bID1)
	requireCounts(expectedSize, 2*filesPerBlockMax)

	data3 := []byte{1, 2, 3}
	bID3, err := kbfsblock.MakePermanentID(
		data3, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)
	_ = addBlockRef(ctx, t, j, bID3)
	require.NoError(t, err)

	err = j.archiveReferences(
		ctx, kbfsblock.ContextMap{bID2: {bCtx2}})
	require.NoError(t, err)
	requireCounts(expectedSize, 2*filesPerBlockMax)

	liveCounts, err := j.removeReferences(
		ctx, kbfsblock.ContextMap{bID1: {bCtx1, bCtx1b}})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID1: 0}, liveCounts)
	requireCounts(expectedSize, 2*filesPerBlockMax)

	liveCounts, err = j.removeReferences(
		ctx, kbfsblock.ContextMap{bID2: {bCtx2}})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID2: 0}, liveCounts)
	requireCounts(expectedSize, 2*filesPerBlockMax)

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, tlf.Private)
	bcache := kbfsdata.NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)
	flushOne := func() (int64, int64, int64) {
		return flushBlockJournalOne(
			ctx, t, j, blockServer, bcache, reporter, tlfID)
	}

	// Flush the first put. This causes the block to be GCed since
	// the subsequent ops for that block remove the references.
	flushedBytes, removedBytes, removedFiles := flushOne()
	require.Equal(t, int64(len(data1)), flushedBytes)
	require.Equal(t, int64(len(data1)), removedBytes)
	require.Equal(t, int64(filesPerBlockMax), removedFiles)
	expectedSize = len(data2)
	requireCounts(expectedSize, filesPerBlockMax)

	// Flush the second put.
	flushedBytes, removedBytes, removedFiles = flushOne()
	require.Equal(t, int64(len(data2)), flushedBytes)
	require.Equal(t, int64(len(data2)), removedBytes)
	require.Equal(t, int64(filesPerBlockMax), removedFiles)
	requireCounts(0, 0)

	// Flush the first add ref.

	flushOneZero := func() {
		flushedBytes, removedBytes, removedFiles := flushOne()
		require.Equal(t, int64(0), flushedBytes)
		require.Equal(t, int64(0), removedBytes)
		require.Equal(t, int64(0), removedFiles)
		requireCounts(0, 0)
	}

	flushOneZero()

	// Flush the second add ref, but push the block to the server
	// first.

	uid1 := keybase1.MakeTestUID(1)
	bCtx3 := kbfsblock.MakeFirstContext(
		uid1.AsUserOrTeam(), keybase1.BlockType_DATA)
	serverHalf3, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	err = blockServer.Put(
		context.Background(), tlfID, bID3, bCtx3, data3, serverHalf3,
		DiskBlockAnyCache)
	require.NoError(t, err)

	flushOneZero()

	// Flush the add archive.
	flushOneZero()

	// Flush the first remove.
	flushOneZero()

	// Flush the second remove.
	flushOneZero()
}

func TestBlockJournalUnflushedBytesIgnore(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(ctx, t, cancel, tempdir, j)

	requireCounts := func(expectedStoredBytes, expectedUnflushedBytes,
		expectedStoredFiles int) {
		require.Equal(t, int64(expectedStoredBytes), j.getStoredBytes())
		require.Equal(t, int64(expectedUnflushedBytes),
			j.getUnflushedBytes())
		require.Equal(t, int64(expectedStoredFiles), j.getStoredFiles())
	}

	// Prime the cache.
	requireCounts(0, 0, 0)

	data1 := []byte{1, 2, 3, 4}
	bID1, _, _ := putBlockData(ctx, t, j, data1)

	requireCounts(len(data1), len(data1), filesPerBlockMax)

	data2 := []byte{1, 2, 3, 4, 5}
	_, _, _ = putBlockData(ctx, t, j, data2)

	requireCounts(len(data1)+len(data2), len(data1)+len(data2),
		2*filesPerBlockMax)

	ignoredBytes, err := j.ignoreBlocksAndMDRevMarkers(
		ctx, []kbfsblock.ID{bID1}, kbfsmd.Revision(0))
	require.NoError(t, err)
	require.Equal(t, int64(len(data1)), ignoredBytes)

	requireCounts(len(data1)+len(data2), len(data2), 2*filesPerBlockMax)
}
