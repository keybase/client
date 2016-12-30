// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
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
			MetadataRevisionInitial,
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

func getBlockJournalLength(t *testing.T, j *blockJournal) int {
	len, err := j.length()
	require.NoError(t, err)
	return int(len)
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

	j, err = makeBlockJournal(ctx, codec, tempdir, log)
	require.NoError(t, err)
	require.Equal(t, 0, getBlockJournalLength(t, j))

	setupSucceeded = true
	return ctx, cancel, tempdir, log, j
}

func teardownBlockJournalTest(t *testing.T, ctx context.Context,
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
	oldLength := getBlockJournalLength(t, j)

	bID, err := kbfsblock.MakePermanentID(data)
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	bCtx := kbfsblock.MakeFirstContext(uid1)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	err = j.putData(ctx, bID, bCtx, data, serverHalf)
	require.NoError(t, err)

	require.Equal(t, oldLength+1, getBlockJournalLength(t, j))

	return bID, bCtx, serverHalf
}

func addBlockRef(
	ctx context.Context, t *testing.T, j *blockJournal,
	bID kbfsblock.ID) kbfsblock.Context {
	oldLength := getBlockJournalLength(t, j)

	nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	bCtx2 := kbfsblock.MakeContext(uid1, uid2, nonce)
	err = j.addReference(ctx, bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, oldLength+1, getBlockJournalLength(t, j))
	return bCtx2
}

func getAndCheckBlockData(ctx context.Context, t *testing.T, j *blockJournal,
	bID kbfsblock.ID, bCtx kbfsblock.Context, expectedData []byte,
	expectedServerHalf kbfscrypto.BlockCryptKeyServerHalf) {
	data, serverHalf, err := j.getDataWithContext(bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, expectedData, data)
	require.Equal(t, expectedServerHalf, serverHalf)
}

func TestBlockJournalBasic(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

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
	j, err = makeBlockJournal(ctx, j.codec, tempdir, j.log)
	require.NoError(t, err)

	require.Equal(t, 2, getBlockJournalLength(t, j))

	// Make sure we get the same block for both refs.

	getAndCheckBlockData(ctx, t, j, bID, bCtx, data, serverHalf)
	getAndCheckBlockData(ctx, t, j, bID, bCtx2, data, serverHalf)
}

func TestBlockJournalAddReference(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data)
	require.NoError(t, err)

	// Add a reference, which should succeed.
	bCtx := addBlockRef(ctx, t, j, bID)

	// Of course, the block get should still fail.
	_, _, err = j.getDataWithContext(bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)
}

func TestBlockJournalArchiveReferences(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add a reference.
	bCtx2 := addBlockRef(ctx, t, j, bID)

	// Archive references.
	err := j.archiveReferences(
		ctx, kbfsblock.ContextMap{bID: {bCtx, bCtx2}})
	require.NoError(t, err)
	require.Equal(t, 3, getBlockJournalLength(t, j))

	// Get block should still succeed.
	getAndCheckBlockData(ctx, t, j, bID, bCtx, data, serverHalf)
}

func TestBlockJournalArchiveNonExistentReference(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	uid1 := keybase1.MakeTestUID(1)

	bCtx := kbfsblock.MakeFirstContext(uid1)

	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data)
	require.NoError(t, err)

	// Archive references.
	err = j.archiveReferences(
		ctx, kbfsblock.ContextMap{bID: {bCtx}})
	require.NoError(t, err)
}

func TestBlockJournalRemoveReferences(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

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
	require.Equal(t, 3, getBlockJournalLength(t, j))

	// Make sure the block data is inaccessible.
	_, _, err = j.getDataWithContext(bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)

	// But the actual data should remain (for flushing).
	buf, half, err := j.s.getData(bID)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, half)
}

func testBlockJournalGCd(t *testing.T, j *blockJournal) {
	err := filepath.Walk(j.dir,
		func(path string, info os.FileInfo, _ error) error {
			// We should only find the blocks directories and
			// aggregate info file here.
			if path != j.dir && path != j.s.dir && path != j.j.dir && path != aggregateInfoPath(j.dir) {
				t.Errorf("Found unexpected block path: %s", path)
			}
			return nil
		})
	require.NoError(t, err)
}

func TestBlockJournalFlush(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

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

	tlfID := tlf.FakeID(1, false)

	bcache := NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	flush := func() {
		end, err := j.end()
		require.NoError(t, err)
		if end == 0 {
			return
		}

		// Test that the end parameter is respected.
		var partialEntries blockEntriesToFlush
		var rev MetadataRevision
		if end > 1 {
			partialEntries, rev, err = j.getNextEntriesToFlush(ctx, end-1,
				maxJournalBlockFlushBatchSize)
			require.NoError(t, err)
			require.Equal(t, rev, MetadataRevisionUninitialized)
		}

		entries, rev, err := j.getNextEntriesToFlush(ctx, end,
			maxJournalBlockFlushBatchSize)
		require.NoError(t, err)
		require.Equal(t, partialEntries.length()+1, entries.length())
		require.Equal(t, rev, MetadataRevisionUninitialized)

		err = flushBlockEntries(
			ctx, j.log, blockServer, bcache, reporter,
			tlfID, CanonicalTlfName("fake TLF"), entries)
		require.NoError(t, err)

		err = j.removeFlushedEntries(ctx, entries, tlfID, reporter)
		require.NoError(t, err)
	}

	flush()

	// Check the Put.
	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Check the AddReference.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Check the archiving.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
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

	flush()

	// Check they're all gone.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx)
	require.IsType(t, kbfsblock.BServerErrorBlockNonExistent{}, err)
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.IsType(t, kbfsblock.BServerErrorBlockNonExistent{}, err)
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.IsType(t, kbfsblock.BServerErrorBlockNonExistent{}, err)

	length, err := j.length()
	require.NoError(t, err)
	require.Zero(t, length)

	// Make sure the ordinals and blocks are flushed.
	testBlockJournalGCd(t, j)
}

func flushBlockJournalOne(ctx context.Context, t *testing.T,
	j *blockJournal, blockServer BlockServer,
	bcache BlockCache, reporter Reporter, tlfID tlf.ID) {
	first, err := j.j.readEarliestOrdinal()
	require.NoError(t, err)
	entries, _, err := j.getNextEntriesToFlush(ctx, first+1,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, 1, entries.length())
	err = flushBlockEntries(ctx, j.log, blockServer,
		bcache, reporter, tlfID, CanonicalTlfName("fake TLF"),
		entries)
	require.NoError(t, err)
	err = j.removeFlushedEntries(ctx, entries, tlfID, reporter)
	require.NoError(t, err)
	err = j.checkInSyncForTest()
	require.NoError(t, err)
}

func TestBlockJournalFlushInterleaved(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add some references.

	bCtx2 := addBlockRef(ctx, t, j, bID)
	bCtx3 := addBlockRef(ctx, t, j, bID)

	// Flush the block put. (Interleave flushes to test
	// checkInSync in intermediate states.)

	blockServer := NewBlockServerMemory(log)

	tlfID := tlf.FakeID(1, false)

	bcache := NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	flushOne := func() {
		flushBlockJournalOne(
			ctx, t, j, blockServer, bcache, reporter, tlfID)
	}

	flushOne()

	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx)
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

	flushOne()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	flushOne()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
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

	flushOne()

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx)
	require.IsType(t, kbfsblock.BServerErrorBlockNonExistent{}, err)

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.IsType(t, kbfsblock.BServerErrorBlockNonExistent{}, err)

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
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

	flushOne()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flush the last removal.

	flushOne()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.IsType(t, kbfsblock.BServerErrorBlockNonExistent{}, err)

	end, err := j.end()
	require.NoError(t, err)
	entries, _, err := j.getNextEntriesToFlush(ctx, end,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, 0, entries.length())

	// Make sure the ordinals and blocks are flushed.
	testBlockJournalGCd(t, j)
}

func TestBlockJournalFlushMDRevMarker(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	putBlockData(ctx, t, j, data)

	// Put a revision marker
	rev := MetadataRevision(10)
	err := j.markMDRevision(ctx, rev)
	require.NoError(t, err)

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, false)
	bcache := NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	// Make sure the block journal reports that entries up to `rev`
	// can be flushed.
	last, err := j.j.readLatestOrdinal()
	require.NoError(t, err)
	entries, gotRev, err := j.getNextEntriesToFlush(ctx, last+1,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, rev, gotRev)
	require.Equal(t, 2, entries.length())
	err = flushBlockEntries(ctx, j.log, blockServer,
		bcache, reporter, tlfID, CanonicalTlfName("fake TLF"),
		entries)
	require.NoError(t, err)
	err = j.removeFlushedEntries(ctx, entries, tlfID, reporter)
	require.NoError(t, err)
	err = j.checkInSyncForTest()
	require.NoError(t, err)
}

func TestBlockJournalIgnoreBlocks(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	// Put a few blocks
	data1 := []byte{1, 2, 3, 4}
	bID1, _, _ := putBlockData(ctx, t, j, data1)
	data2 := []byte{5, 6, 7, 8}
	bID2, _, _ := putBlockData(ctx, t, j, data2)

	// Put a revision marker
	rev := MetadataRevision(10)
	err := j.markMDRevision(ctx, rev)
	require.NoError(t, err)

	data3 := []byte{9, 10, 11, 12}
	bID3, _, _ := putBlockData(ctx, t, j, data3)
	data4 := []byte{13, 14, 15, 16}
	bID4, _, _ := putBlockData(ctx, t, j, data4)

	// Put a revision marker
	rev = MetadataRevision(11)
	err = j.markMDRevision(ctx, rev)
	require.NoError(t, err)

	err = j.ignoreBlocksAndMDRevMarkers(ctx, []kbfsblock.ID{bID2, bID3})
	require.NoError(t, err)

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, false)
	bcache := NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	// Flush and make sure we only flush the non-ignored blocks.
	last, err := j.j.readLatestOrdinal()
	require.NoError(t, err)
	entries, gotRev, err := j.getNextEntriesToFlush(ctx, last+1,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, MetadataRevisionUninitialized, gotRev)
	require.Equal(t, 6, entries.length())
	require.Len(t, entries.puts.blockStates, 2)
	require.Len(t, entries.adds.blockStates, 0)
	require.Len(t, entries.other, 4)
	require.Equal(t, bID1, entries.puts.blockStates[0].blockPtr.ID)
	require.Equal(t, bID4, entries.puts.blockStates[1].blockPtr.ID)
	err = flushBlockEntries(ctx, j.log, blockServer,
		bcache, reporter, tlfID, CanonicalTlfName("fake TLF"),
		entries)
	require.NoError(t, err)
	err = j.removeFlushedEntries(ctx, entries, tlfID, reporter)
	require.NoError(t, err)
	err = j.checkInSyncForTest()
	require.NoError(t, err)
}

func TestBlockJournalSaveUntilMDFlush(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	// Put a few blocks
	data1 := []byte{1, 2, 3, 4}
	bID1, _, _ := putBlockData(ctx, t, j, data1)
	data2 := []byte{5, 6, 7, 8}
	bID2, _, _ := putBlockData(ctx, t, j, data2)

	// Put a revision marker
	rev := MetadataRevision(10)
	err := j.markMDRevision(ctx, rev)
	require.NoError(t, err)

	data3 := []byte{9, 10, 11, 12}
	bID3, _, _ := putBlockData(ctx, t, j, data3)
	data4 := []byte{13, 14, 15, 16}
	bID4, _, _ := putBlockData(ctx, t, j, data4)

	// Put a revision marker
	rev = MetadataRevision(11)
	err = j.markMDRevision(ctx, rev)
	require.NoError(t, err)

	err = j.saveBlocksUntilNextMDFlush()
	require.NoError(t, err)
	savedBlocks := []kbfsblock.ID{bID1, bID2, bID3, bID4}

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, false)
	bcache := NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	// Flush all the entries, but they should still remain accessible.
	flushAll := func() {
		last, err := j.j.readLatestOrdinal()
		require.NoError(t, err)
		entries, _, err := j.getNextEntriesToFlush(ctx, last+1,
			maxJournalBlockFlushBatchSize)
		require.NoError(t, err)
		err = flushBlockEntries(ctx, j.log, blockServer,
			bcache, reporter, tlfID, CanonicalTlfName("fake TLF"),
			entries)
		require.NoError(t, err)
		err = j.removeFlushedEntries(ctx, entries, tlfID, reporter)
		require.NoError(t, err)
	}
	flushAll()

	// The blocks can still be fetched from the journal.
	for _, bid := range savedBlocks {
		ok, err := j.hasData(bid)
		require.NoError(t, err)
		require.True(t, ok)
	}

	// No more blocks to flush though.
	end, err := j.end()
	require.NoError(t, err)
	entries, gotRev, err := j.getNextEntriesToFlush(ctx, end,
		maxJournalBlockFlushBatchSize)
	require.NoError(t, err)
	require.Equal(t, 0, entries.length())
	require.Equal(t, MetadataRevisionUninitialized, gotRev)

	// Add a few more blocks and save those too.
	data5 := []byte{17, 18, 19, 20}
	bID5, _, _ := putBlockData(ctx, t, j, data5)
	data6 := []byte{21, 22, 23, 24}
	bID6, _, _ := putBlockData(ctx, t, j, data6)
	savedBlocks = append(savedBlocks, bID5, bID6)
	flushAll()

	// Make sure all the blocks still exist, including both the old
	// and the new ones.
	for _, bid := range savedBlocks {
		ok, err := j.hasData(bid)
		require.NoError(t, err)
		require.True(t, ok)
	}

	{
		// Make sure the saved block journal persists after a restart.
		jRestarted, err := makeBlockJournal(ctx, j.codec, j.dir, j.log)
		require.NoError(t, err)
		require.NotNil(t, jRestarted.saveUntilMDFlush)
	}

	// Now remove all the data, one at a time.  Remember there are two
	// revision markers that also need removal.
	lastToRemove := journalOrdinal(0)
	for i := 0; i < len(savedBlocks)-1+2; i++ {
		lastToRemove, err = j.onMDFlush(ctx, 1, lastToRemove)
		require.NoError(t, err)
		require.NotZero(t, lastToRemove, "Iter %d", i)
		require.NotNil(t, j.saveUntilMDFlush)
	}
	lastToRemove, err = j.onMDFlush(ctx, 1, lastToRemove)
	require.NoError(t, err)
	require.Zero(t, lastToRemove)
	require.Nil(t, j.saveUntilMDFlush)

	ok, err := j.isUnflushed(bID1)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = j.isUnflushed(bID2)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = j.isUnflushed(bID3)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = j.isUnflushed(bID4)
	require.NoError(t, err)
	require.False(t, ok)

	testBlockJournalGCd(t, j)
}

func TestBlockJournalUnflushedBytes(t *testing.T) {
	ctx, cancel, tempdir, log, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	requireSize := func(expectedSize int) {
		require.Equal(t, int64(expectedSize), j.getUnflushedBytes())
		var info aggregateInfo
		err := kbfscodec.DeserializeFromFile(
			j.codec, aggregateInfoPath(j.dir), &info)
		if !ioutil.IsNotExist(err) {
			require.NoError(t, err)
		}
		require.Equal(t, int64(expectedSize), info.UnflushedBytes)
	}

	// Prime the cache.
	requireSize(0)

	data1 := []byte{1, 2, 3, 4}
	bID1, bCtx1, _ := putBlockData(ctx, t, j, data1)

	requireSize(len(data1))

	data2 := []byte{1, 2, 3, 4, 5}
	bID2, bCtx2, _ := putBlockData(ctx, t, j, data2)

	expectedSize := len(data1) + len(data2)
	requireSize(expectedSize)

	// Adding, archive, or removing references shouldn't change
	// anything.

	bCtx1b := addBlockRef(ctx, t, j, bID1)
	requireSize(expectedSize)

	data3 := []byte{1, 2, 3}
	bID3, err := kbfsblock.MakePermanentID(data3)
	require.NoError(t, err)
	_ = addBlockRef(ctx, t, j, bID3)
	require.NoError(t, err)

	err = j.archiveReferences(
		ctx, kbfsblock.ContextMap{bID2: {bCtx2}})
	require.NoError(t, err)
	requireSize(expectedSize)

	liveCounts, err := j.removeReferences(
		ctx, kbfsblock.ContextMap{bID1: {bCtx1, bCtx1b}})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID1: 0}, liveCounts)
	requireSize(expectedSize)

	liveCounts, err = j.removeReferences(
		ctx, kbfsblock.ContextMap{bID2: {bCtx2}})
	require.NoError(t, err)
	require.Equal(t, map[kbfsblock.ID]int{bID2: 0}, liveCounts)
	requireSize(expectedSize)

	blockServer := NewBlockServerMemory(log)
	tlfID := tlf.FakeID(1, false)
	bcache := NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)
	flushOne := func() {
		flushBlockJournalOne(
			ctx, t, j, blockServer, bcache, reporter, tlfID)
	}

	// Flush the first put.
	flushOne()
	expectedSize = len(data2)
	requireSize(expectedSize)

	// Flush the second put.
	flushOne()
	requireSize(0)

	// Flush the first add ref.
	flushOne()
	requireSize(0)

	// Flush the second add ref, but push the block to the server
	// first.

	uid1 := keybase1.MakeTestUID(1)
	bCtx3 := kbfsblock.MakeFirstContext(uid1)
	serverHalf3, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	err = blockServer.Put(
		context.Background(), tlfID, bID3, bCtx3, data3, serverHalf3)
	require.NoError(t, err)

	flushOne()
	requireSize(0)

	// Flush the add archive.
	flushOne()
	requireSize(0)

	// Flush the first remove.
	flushOne()
	requireSize(0)

	// Flush the second remove.
	flushOne()
	requireSize(0)
}

func TestBlockJournalUnflushedBytesIgnore(t *testing.T) {
	ctx, cancel, tempdir, _, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, ctx, cancel, tempdir, j)

	requireSize := func(expectedSize int) {
		require.Equal(t, int64(expectedSize), j.getUnflushedBytes())
	}

	// Prime the cache.
	requireSize(0)

	data1 := []byte{1, 2, 3, 4}
	bID1, _, _ := putBlockData(ctx, t, j, data1)

	requireSize(len(data1))

	data2 := []byte{1, 2, 3, 4, 5}
	_, _, _ = putBlockData(ctx, t, j, data2)

	requireSize(len(data1) + len(data2))

	err := j.ignoreBlocksAndMDRevMarkers(ctx, []kbfsblock.ID{bID1})
	require.NoError(t, err)

	requireSize(len(data2))
}
