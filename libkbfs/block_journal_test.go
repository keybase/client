// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type blockJournalEntryFuture struct {
	blockJournalEntry
	extra
}

func (ef blockJournalEntryFuture) toCurrent() blockJournalEntry {
	return ef.blockJournalEntry
}

func (ef blockJournalEntryFuture) toCurrentStruct() currentStruct {
	return ef.toCurrent()
}

func makeFakeBlockJournalEntryFuture(t *testing.T) blockJournalEntryFuture {
	ef := blockJournalEntryFuture{
		blockJournalEntry{
			blockPutOp,
			map[BlockID][]BlockContext{
				fakeBlockID(1): {
					makeFakeBlockContext(t),
					makeFakeBlockContext(t),
					makeFakeBlockContext(t),
				},
			},
			MetadataRevisionInitial,
			false,
			codec.UnknownFieldSetHandler{},
		},
		makeExtraOrBust("blockJournalEntry", t),
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
	ctx context.Context, tempdir string, j *blockJournal) {
	ctx = context.Background()
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	log := logger.NewTestLogger(t)

	tempdir, err := ioutil.TempDir(os.TempDir(), "block_journal")
	require.NoError(t, err)

	// Clean up the tempdir if the rest of the setup fails.
	setupSucceeded := false
	defer func() {
		if !setupSucceeded {
			err := os.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	j, err = makeBlockJournal(ctx, codec, crypto, tempdir, log)
	require.NoError(t, err)
	require.Equal(t, 0, getBlockJournalLength(t, j))

	setupSucceeded = true
	return ctx, tempdir, j
}

func teardownBlockJournalTest(t *testing.T, tempdir string, j *blockJournal) {
	ctx := context.Background()
	err := j.checkInSync(ctx)
	assert.NoError(t, err)

	err = os.RemoveAll(tempdir)
	assert.NoError(t, err)
}

func putBlockData(
	ctx context.Context, t *testing.T, j *blockJournal, data []byte) (
	BlockID, BlockContext, kbfscrypto.BlockCryptKeyServerHalf) {
	oldLength := getBlockJournalLength(t, j)

	bID, err := j.crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	bCtx := BlockContext{uid1, "", ZeroBlockRefNonce}
	serverHalf, err := j.crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	err = j.putData(ctx, bID, bCtx, data, serverHalf)
	require.NoError(t, err)

	require.Equal(t, oldLength+1, getBlockJournalLength(t, j))

	return bID, bCtx, serverHalf
}

func addBlockRef(
	ctx context.Context, t *testing.T, j *blockJournal,
	bID BlockID) BlockContext {
	oldLength := getBlockJournalLength(t, j)

	nonce, err := j.crypto.MakeBlockRefNonce()
	require.NoError(t, err)

	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = j.addReference(ctx, bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, oldLength+1, getBlockJournalLength(t, j))
	return bCtx2
}

func getAndCheckBlockData(ctx context.Context, t *testing.T, j *blockJournal,
	bID BlockID, bCtx BlockContext, expectedData []byte,
	expectedServerHalf kbfscrypto.BlockCryptKeyServerHalf) {
	data, serverHalf, err := j.getDataWithContext(bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, expectedData, data)
	require.Equal(t, expectedServerHalf, serverHalf)
}

func TestBlockJournalBasic(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

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
	err := j.checkInSync(ctx)
	require.NoError(t, err)
	j, err = makeBlockJournal(ctx, j.codec, j.crypto, tempdir, j.log)
	require.NoError(t, err)

	require.Equal(t, 2, getBlockJournalLength(t, j))

	// Make sure we get the same block for both refs.

	getAndCheckBlockData(ctx, t, j, bID, bCtx, data, serverHalf)
	getAndCheckBlockData(ctx, t, j, bID, bCtx2, data, serverHalf)
}

func TestBlockJournalAddReference(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

	data := []byte{1, 2, 3, 4}
	bID, err := j.crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	// Add a reference, which should succeed.
	bCtx := addBlockRef(ctx, t, j, bID)

	// Of course, the block get should still fail.
	_, _, err = j.getDataWithContext(bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)
}

func TestBlockJournalRemoveReferences(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add a reference.
	bCtx2 := addBlockRef(ctx, t, j, bID)

	// Remove references.
	liveCounts, err := j.removeReferences(
		ctx, map[BlockID][]BlockContext{bID: {bCtx, bCtx2}})
	require.NoError(t, err)
	require.Equal(t, map[BlockID]int{bID: 0}, liveCounts)
	require.Equal(t, 3, getBlockJournalLength(t, j))

	// Make sure the block data is inaccessible.
	_, _, err = j.getDataWithContext(bID, bCtx)
	require.Equal(t, blockNonExistentError{bID}, err)

	// But the actual data should remain (for flushing).
	buf, half, err := j.getData(bID)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, half)
}

func TestBlockJournalArchiveReferences(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

	// Put the block.
	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add a reference.
	bCtx2 := addBlockRef(ctx, t, j, bID)

	// Archive references.
	err := j.archiveReferences(
		ctx, map[BlockID][]BlockContext{bID: {bCtx, bCtx2}})
	require.NoError(t, err)
	require.Equal(t, 3, getBlockJournalLength(t, j))

	// Get block should still succeed.
	getAndCheckBlockData(ctx, t, j, bID, bCtx, data, serverHalf)
}

func TestBlockJournalArchiveNonExistentReference(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

	uid1 := keybase1.MakeTestUID(1)

	bCtx := BlockContext{uid1, "", ZeroBlockRefNonce}

	data := []byte{1, 2, 3, 4}
	bID, err := j.crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	// Archive references.
	err = j.archiveReferences(
		ctx, map[BlockID][]BlockContext{bID: {bCtx}})
	require.NoError(t, err)
}

func testBlockJournalGCd(t *testing.T, j *blockJournal) {
	filepath.Walk(j.j.dir, func(path string, _ os.FileInfo, _ error) error {
		// We should only find the root directory here.
		require.Equal(t, path, j.j.dir)
		return nil
	})
	filepath.Walk(j.blocksPath(),
		func(path string, info os.FileInfo, _ error) error {
			// We should only find the blocks directory here.
			require.Equal(t, path, j.blocksPath())
			return nil
		})
}

func TestBlockJournalFlush(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add some references.

	bCtx2 := addBlockRef(ctx, t, j, bID)
	bCtx3 := addBlockRef(ctx, t, j, bID)

	// Archive one of the references.

	err := j.archiveReferences(
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx3},
		})
	require.NoError(t, err)

	blockServer := NewBlockServerMemory(newTestBlockServerLocalConfig(t))

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
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx, bCtx2, bCtx3},
		})
	require.NoError(t, err)
	require.Equal(t, map[BlockID]int{}, liveCounts)

	flush()

	// Check they're all gone.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)

	length, err := j.length()
	require.NoError(t, err)
	require.Zero(t, length)
	require.Zero(t, j.unflushedBytes)

	// Make sure the ordinals and blocks are flushed.
	testBlockJournalGCd(t, j)
}

func TestBlockJournalFlushInterleaved(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := putBlockData(ctx, t, j, data)

	// Add some references.

	bCtx2 := addBlockRef(ctx, t, j, bID)
	bCtx3 := addBlockRef(ctx, t, j, bID)

	// Flush the block put. (Interleave flushes to test
	// checkInSync in intermediate states.)

	blockServer := NewBlockServerMemory(newTestBlockServerLocalConfig(t))

	tlfID := tlf.FakeID(1, false)

	bcache := NewBlockCacheStandard(0, 0)
	reporter := NewReporterSimple(nil, 0)

	flushOne := func() {
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
		err = j.checkInSync(ctx)
		require.NoError(t, err)
	}

	flushOne()

	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Remove some references.

	liveCounts, err := j.removeReferences(
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx, bCtx2},
		})
	require.NoError(t, err)
	require.Equal(t, map[BlockID]int{bID: 1}, liveCounts)

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
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx3},
		})
	require.NoError(t, err)

	// Flush the reference removals.

	flushOne()

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Remove the archived references.

	liveCounts, err = j.removeReferences(
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx3},
		})
	require.NoError(t, err)
	require.Equal(t, map[BlockID]int{bID: 0}, liveCounts)

	// Flush the reference archival.

	flushOne()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flush the last removal.

	flushOne()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)

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
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	putBlockData(ctx, t, j, data)

	// Put a revision marker
	rev := MetadataRevision(10)
	err := j.markMDRevision(ctx, rev)
	require.NoError(t, err)

	blockServer := NewBlockServerMemory(newTestBlockServerLocalConfig(t))
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
	err = j.checkInSync(ctx)
	require.NoError(t, err)
}

func TestBlockJournalIgnoreBlocks(t *testing.T) {
	ctx, tempdir, j := setupBlockJournalTest(t)
	defer teardownBlockJournalTest(t, tempdir, j)

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

	err = j.ignoreBlocksAndMDRevMarkers(ctx, []BlockID{bID2, bID3})
	require.NoError(t, err)

	blockServer := NewBlockServerMemory(newTestBlockServerLocalConfig(t))
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
	err = j.checkInSync(ctx)
	require.NoError(t, err)
}
