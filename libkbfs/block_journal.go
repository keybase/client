// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"path/filepath"
	"reflect"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// blockJournal stores a single ordered list of block operations for a
// single TLF, along with the associated block data, in flat files in
// a directory on disk.
//
// The directory layout looks like:
//
// dir/block_aggregate_info
// dir/block_journal/EARLIEST
// dir/block_journal/LATEST
// dir/block_journal/0...000
// dir/block_journal/0...001
// dir/block_journal/0...fff
// dir/blocks/...
// dir/saved_block_journal/EARLIEST
// dir/saved_block_journal/LATEST
// dir/saved_block_journal/...
//
// block_aggregate_info holds aggregate info about the block journal;
// currently it just holds the count of stored and unflushed bytes.
//
// Each entry in the journal in dir/block_journal contains the
// mutating operation and arguments for a single operation, except for
// block data. (See diskJournal comments for more details about the
// journal.)
//
// The block data is stored separately in dir/blocks. See
// blockDiskStore comments for more details.
//
// The maximum number of characters added to the root dir by a block
// journal is 51:
//
//   /blocks/(max 44 characters)
//
// blockJournal is not goroutine-safe, so any code that uses it must
// guarantee that only one goroutine at a time calls its functions.
type blockJournal struct {
	codec kbfscodec.Codec
	dir   string

	log      logger.Logger
	deferLog logger.Logger

	// j is the main journal.
	j diskJournal

	// saveUntilMDFlush, when non-nil, prevents garbage collection
	// of blocks. When removed, all the referenced blocks are
	// garbage-collected.
	//
	// TODO: We only really need to save a list of IDs, and not a
	// full journal.
	saveUntilMDFlush *diskJournal

	// s stores all the block data. s should always reflect the
	// state you get by replaying all the entries in j.
	s *blockDiskStore

	aggregateInfo aggregateInfo
}

type blockOpType int

const (
	blockPutOp    blockOpType = 1
	addRefOp      blockOpType = 2
	removeRefsOp  blockOpType = 3
	archiveRefsOp blockOpType = 4
	mdRevMarkerOp blockOpType = 5
)

func (t blockOpType) String() string {
	switch t {
	case blockPutOp:
		return "blockPut"
	case addRefOp:
		return "addReference"
	case removeRefsOp:
		return "removeReferences"
	case archiveRefsOp:
		return "archiveReferences"
	case mdRevMarkerOp:
		return "mdRevisionMarker"
	default:
		return fmt.Sprintf("blockOpType(%d)", t)
	}
}

// A blockJournalEntry is just the name of the operation and the
// associated block ID and contexts. Fields are exported only for
// serialization.
type blockJournalEntry struct {
	// Must be one of the four ops above.
	Op blockOpType
	// Must have exactly one entry with one context for blockPutOp and
	// addRefOp.  Used for all ops except for mdRevMarkerOp.
	Contexts kbfsblock.ContextMap `codec:",omitempty"`
	// Only used for mdRevMarkerOps.
	Revision MetadataRevision `codec:",omitempty"`
	// Ignore this entry while flushing if this is true.
	Ignore bool `codec:",omitempty"`
	// Do not ever mark this as ignorable.  If this is true, Ignore
	// should never be true.  TODO: combine this with Ignore using a
	// more generic flags or state field, once we can change the
	// journal format.
	Unignorable bool `codec:",omitempty"`

	codec.UnknownFieldSetHandler
}

// Get the single context stored in this entry. Only applicable to
// blockPutOp and addRefOp.
func (e blockJournalEntry) getSingleContext() (
	kbfsblock.ID, kbfsblock.Context, error) {
	switch e.Op {
	case blockPutOp, addRefOp:
		if len(e.Contexts) != 1 {
			return kbfsblock.ID{}, kbfsblock.Context{}, errors.Errorf(
				"Op %s doesn't have exactly one context: %v",
				e.Op, e.Contexts)
		}
		for id, idContexts := range e.Contexts {
			if len(idContexts) != 1 {
				return kbfsblock.ID{}, kbfsblock.Context{}, errors.Errorf(
					"Op %s doesn't have exactly one context for id=%s: %v",
					e.Op, id, idContexts)
			}
			return id, idContexts[0], nil
		}
	}

	return kbfsblock.ID{}, kbfsblock.Context{}, errors.Errorf(
		"getSingleContext() erroneously called on op %s", e.Op)
}

func savedBlockJournalDir(dir string) string {
	return filepath.Join(dir, "saved_block_journal")
}

// makeBlockJournal returns a new blockJournal for the given
// directory. Any existing journal entries are read.
func makeBlockJournal(
	ctx context.Context, codec kbfscodec.Codec, dir string,
	log logger.Logger) (*blockJournal, error) {
	journalPath := filepath.Join(dir, "block_journal")
	deferLog := log.CloneWithAddedDepth(1)
	j := makeDiskJournal(
		codec, journalPath, reflect.TypeOf(blockJournalEntry{}))

	storeDir := filepath.Join(dir, "blocks")
	s := makeBlockDiskStore(codec, storeDir)
	journal := &blockJournal{
		codec:    codec,
		dir:      dir,
		log:      log,
		deferLog: deferLog,
		j:        j,
		s:        s,
	}

	// If a saved block journal exists, we need to remove its entries
	// on the next successful MD flush.
	savedJournalDir := savedBlockJournalDir(dir)
	fi, err := ioutil.Stat(savedJournalDir)
	if err == nil {
		if !fi.IsDir() {
			return nil,
				errors.Errorf("%s exists, but is not a dir", savedJournalDir)
		}
		log.CDebugf(ctx, "A saved block journal exists at %s", savedJournalDir)
		sj := makeDiskJournal(
			codec, savedJournalDir, reflect.TypeOf(blockJournalEntry{}))
		journal.saveUntilMDFlush = &sj
	}

	// Get initial aggregate info.
	err = kbfscodec.DeserializeFromFile(
		codec, aggregateInfoPath(dir), &journal.aggregateInfo)
	if !ioutil.IsNotExist(err) && err != nil {
		return nil, err
	}

	return journal, nil
}

// The functions below are for reading and writing aggregate info.

// Ideally, this would be a JSON file, but we'd need a JSON
// encoder/decoder that supports unknown fields.
type aggregateInfo struct {
	// StoredBytes counts the number of bytes of block data stored
	// on disk.
	StoredBytes int64
	// UnflushedBytes counts the number of bytes of block data
	// that is intended to be flushed to the server, but hasn't
	// been yet. This should be always less than or equal to
	// StoredBytes.
	UnflushedBytes int64

	codec.UnknownFieldSetHandler
}

func aggregateInfoPath(dir string) string {
	return filepath.Join(dir, "block_aggregate_info")
}

func (j *blockJournal) changeBytes(
	deltaStoredBytes, deltaUnflushedBytes int64) error {
	j.aggregateInfo.StoredBytes += deltaStoredBytes
	j.aggregateInfo.UnflushedBytes += deltaUnflushedBytes
	return kbfscodec.SerializeToFile(
		j.codec, j.aggregateInfo, aggregateInfoPath(j.dir))
}

func (j *blockJournal) accumulateBytes(n int64) error {
	if n < 0 {
		panic("n unexpectedly negative")
	}
	return j.changeBytes(n, n)
}

func (j *blockJournal) flushBytes(n int64) error {
	if n < 0 {
		panic("n unexpectedly negative")
	}
	return j.changeBytes(0, -n)
}

func (j *blockJournal) unstoreBytes(n int64) error {
	if n < 0 {
		panic("n unexpectedly negative")
	}
	return j.changeBytes(-n, 0)
}

// The functions below are for reading and writing journal entries.

func (j *blockJournal) readJournalEntry(ordinal journalOrdinal) (
	blockJournalEntry, error) {
	entry, err := j.j.readJournalEntry(ordinal)
	if err != nil {
		return blockJournalEntry{}, err
	}

	return entry.(blockJournalEntry), nil
}

func (j *blockJournal) appendJournalEntry(
	ctx context.Context, entry blockJournalEntry) (
	journalOrdinal, error) {
	ordinal, err := j.j.appendJournalEntry(nil, entry)
	if err != nil {
		return 0, err
	}

	if j.saveUntilMDFlush != nil {
		_, err := j.saveUntilMDFlush.appendJournalEntry(nil, entry)
		if err != nil {
			// TODO: Should we remove it from the main journal and
			// fail the whole append?
			j.log.CWarningf(ctx, "Appending to the saved list failed: %+v", err)
		}
	}

	return ordinal, nil
}

func (j *blockJournal) length() (uint64, error) {
	return j.j.length()
}

func (j *blockJournal) end() (journalOrdinal, error) {
	last, err := j.j.readLatestOrdinal()
	if ioutil.IsNotExist(err) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	return last + 1, nil
}

func (j *blockJournal) hasData(id kbfsblock.ID) (bool, error) {
	return j.s.hasData(id)
}

func (j *blockJournal) isUnflushed(id kbfsblock.ID) (bool, error) {
	return j.s.isUnflushed(id)
}

func (j *blockJournal) remove(ctx context.Context, id kbfsblock.ID) (
	removedBytes int64, err error) {
	bytesToRemove, err := j.s.getDataSize(id)
	if err != nil {
		return 0, err
	}

	// TODO: we'll eventually need a sweeper to clean up entries
	// left behind if we crash here.
	err = j.s.remove(id)
	if err != nil {
		return 0, err
	}

	err = j.unstoreBytes(bytesToRemove)
	if err != nil {
		return 0, err
	}

	return bytesToRemove, nil
}

// All functions below are public functions.

func (j *blockJournal) getDataWithContext(id kbfsblock.ID, context kbfsblock.Context) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	return j.s.getDataWithContext(id, context)
}

func (j *blockJournal) getData(id kbfsblock.ID) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	return j.s.getData(id)
}

func (j *blockJournal) getStoredBytes() int64 {
	return j.aggregateInfo.StoredBytes
}

func (j *blockJournal) getUnflushedBytes() int64 {
	return j.aggregateInfo.UnflushedBytes
}

func (j *blockJournal) putData(
	ctx context.Context, id kbfsblock.ID, context kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	j.log.CDebugf(ctx, "Putting %d bytes of data for block %s with context %v",
		len(buf), id, context)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Put for block %s with context %v failed with %+v",
				id, context, err)
		}
	}()

	next, err := j.end()
	if err != nil {
		return err
	}

	putData, err := j.s.put(id, context, buf, serverHalf, next.String())
	if err != nil {
		return err
	}

	if putData {
		err = j.accumulateBytes(int64(len(buf)))
		if err != nil {
			return err
		}
	}

	_, err = j.appendJournalEntry(ctx, blockJournalEntry{
		Op:       blockPutOp,
		Contexts: kbfsblock.ContextMap{id: {context}},
	})
	if err != nil {
		return err
	}

	return nil
}

func (j *blockJournal) addReference(
	ctx context.Context, id kbfsblock.ID, context kbfsblock.Context) (
	err error) {
	j.log.CDebugf(ctx, "Adding reference for block %s with context %v",
		id, context)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Adding reference for block %s with context %v failed with %+v",
				id, context, err)
		}
	}()

	next, err := j.end()
	if err != nil {
		return err
	}

	err = j.s.addReference(id, context, next.String())
	if err != nil {
		return err
	}

	_, err = j.appendJournalEntry(ctx, blockJournalEntry{
		Op:       addRefOp,
		Contexts: kbfsblock.ContextMap{id: {context}},
	})
	if err != nil {
		return err
	}

	return nil
}

func (j *blockJournal) archiveReferences(
	ctx context.Context, contexts kbfsblock.ContextMap) (err error) {
	j.log.CDebugf(ctx, "Archiving references for %v", contexts)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Archiving references for %+v,", contexts, err)
		}
	}()

	next, err := j.end()
	if err != nil {
		return err
	}

	err = j.s.archiveReferences(contexts, next.String())
	if err != nil {
		return err
	}

	_, err = j.appendJournalEntry(ctx, blockJournalEntry{
		Op:       archiveRefsOp,
		Contexts: contexts,
	})
	if err != nil {
		return err
	}

	return nil
}

// removeReferences removes references for the given contexts from
// their respective IDs.
func (j *blockJournal) removeReferences(
	ctx context.Context, contexts kbfsblock.ContextMap) (
	liveCounts map[kbfsblock.ID]int, err error) {
	j.log.CDebugf(ctx, "Removing references for %v", contexts)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Removing references for %+v", contexts, err)
		}
	}()

	// Add the journal entry first, so that if we crash before
	// removing the refs, we have at worst un-GCed blocks.

	_, err = j.appendJournalEntry(ctx, blockJournalEntry{
		Op:       removeRefsOp,
		Contexts: contexts,
	})
	if err != nil {
		return nil, err
	}

	liveCounts = make(map[kbfsblock.ID]int)
	for id, idContexts := range contexts {
		// Remove the references unconditionally here (i.e.,
		// with an empty tag), since j.s should reflect the
		// most recent state.
		liveCount, err := j.s.removeReferences(id, idContexts, "")
		if err != nil {
			return nil, err
		}

		liveCounts[id] = liveCount
	}

	return liveCounts, nil
}

func (j *blockJournal) markMDRevision(ctx context.Context,
	rev MetadataRevision, isPendingLocalSquash bool) (err error) {
	j.log.CDebugf(ctx, "Marking MD revision %d in the block journal", rev)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx, "Marking MD revision %d error: %+v",
				rev, err)
		}
	}()

	_, err = j.appendJournalEntry(ctx, blockJournalEntry{
		Op:       mdRevMarkerOp,
		Revision: rev,
		// If this MD represents a pending local squash, it should
		// never be ignored since the revision it refers to can't be
		// squashed again.
		Unignorable: isPendingLocalSquash,
	})
	if err != nil {
		return err
	}
	return nil
}

// blockEntriesToFlush is an internal data structure for blockJournal;
// its fields shouldn't be accessed outside this file.
type blockEntriesToFlush struct {
	all   []blockJournalEntry
	first journalOrdinal

	puts  *blockPutState
	adds  *blockPutState
	other []blockJournalEntry
}

func (be blockEntriesToFlush) length() int {
	return len(be.all)
}

func (be blockEntriesToFlush) flushNeeded() bool {
	return be.length() > 0
}

// Only entries with ordinals less than the given ordinal (assumed to
// be <= latest ordinal + 1) are returned.  Also returns the maximum
// MD revision that can be merged after the returned entries are
// successfully flushed; if no entries are returned (i.e., the block
// journal is empty) then any MD revision may be flushed even when
// MetadataRevisionUninitialized is returned.
func (j *blockJournal) getNextEntriesToFlush(
	ctx context.Context, end journalOrdinal, maxToFlush int) (
	entries blockEntriesToFlush, maxMDRevToFlush MetadataRevision, err error) {
	first, err := j.j.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized, nil
	} else if err != nil {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
	}

	if first >= end {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized,
			errors.Errorf("Trying to flush past the "+
				"start of the journal (first=%d, end=%d)", first, end)
	}

	realEnd, err := j.end()
	if realEnd == 0 {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized,
			errors.Errorf("There was an earliest "+
				"ordinal %d, but no latest ordinal", first)
	} else if err != nil {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
	}

	if end > realEnd {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized,
			errors.Errorf("Trying to flush past the "+
				"end of the journal (realEnd=%d, end=%d)", realEnd, end)
	}

	entries.puts = newBlockPutState(int(end - first))
	entries.adds = newBlockPutState(int(end - first))
	maxMDRevToFlush = MetadataRevisionUninitialized

	loopEnd := end
	if first+journalOrdinal(maxToFlush) < end {
		loopEnd = first + journalOrdinal(maxToFlush)
	}

	for ordinal := first; ordinal < loopEnd; ordinal++ {
		entry, err := j.readJournalEntry(ordinal)
		if err != nil {
			return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
		}

		if entry.Ignore {
			if loopEnd < end {
				loopEnd++
			}
			entries.other = append(entries.other, entry)
			entries.all = append(entries.all, entry)
			continue
		}

		var data []byte
		var serverHalf kbfscrypto.BlockCryptKeyServerHalf

		switch entry.Op {
		case blockPutOp:
			id, bctx, err := entry.getSingleContext()
			if err != nil {
				return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
			}

			data, serverHalf, err = j.s.getData(id)
			if err != nil {
				return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
			}

			entries.puts.addNewBlock(
				BlockPointer{ID: id, Context: bctx},
				nil, /* only used by folderBranchOps */
				ReadyBlockData{data, serverHalf}, nil)

		case addRefOp:
			id, bctx, err := entry.getSingleContext()
			if err != nil {
				return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
			}

			entries.adds.addNewBlock(
				BlockPointer{ID: id, Context: bctx},
				nil, /* only used by folderBranchOps */
				ReadyBlockData{}, nil)

		case mdRevMarkerOp:
			if entry.Revision < maxMDRevToFlush {
				return blockEntriesToFlush{}, MetadataRevisionUninitialized,
					errors.Errorf("Max MD revision decreased in block journal "+
						"from %d to %d", entry.Revision, maxMDRevToFlush)
			}
			maxMDRevToFlush = entry.Revision
			entries.other = append(entries.other, entry)

		default:
			entries.other = append(entries.other, entry)
		}

		entries.all = append(entries.all, entry)
	}
	entries.first = first
	return entries, maxMDRevToFlush, nil
}

// flushNonBPSBlockJournalEntry flushes journal entries that can't be
// parallelized via a blockPutState.
func flushNonBPSBlockJournalEntry(
	ctx context.Context, log logger.Logger,
	bserver BlockServer, tlfID tlf.ID, entry blockJournalEntry) error {
	log.CDebugf(ctx, "Flushing other block op %v", entry)

	switch entry.Op {
	case removeRefsOp:
		_, err := bserver.RemoveBlockReferences(
			ctx, tlfID, entry.Contexts)
		if err != nil {
			return err
		}

	case archiveRefsOp:
		err := bserver.ArchiveBlockReferences(
			ctx, tlfID, entry.Contexts)
		if err != nil {
			return err
		}

	case blockPutOp:
		if !entry.Ignore {
			return errors.New("Trying to flush unignored blockPut as other")
		}
		// Otherwise nothing to do.

	case mdRevMarkerOp:
		// Nothing to do.

	default:
		return errors.Errorf("Unknown op %s", entry.Op)
	}

	return nil
}

func flushBlockEntries(ctx context.Context, log logger.Logger,
	bserver BlockServer, bcache BlockCache, reporter Reporter, tlfID tlf.ID,
	tlfName CanonicalTlfName, entries blockEntriesToFlush) error {
	if !entries.flushNeeded() {
		// Avoid logging anything when there's nothing to flush.
		return nil
	}

	// Do all the put state stuff first, in parallel.  We need to do
	// the puts strictly before the addRefs, since the latter might
	// reference the former.
	log.CDebugf(ctx, "Putting %d blocks", len(entries.puts.blockStates))
	blocksToRemove, err := doBlockPuts(ctx, bserver, bcache, reporter,
		log, tlfID, tlfName, *entries.puts)
	if err != nil {
		if isRecoverableBlockError(err) {
			log.CWarningf(ctx,
				"Recoverable block error encountered on puts: %+v, ptrs=%v",
				err, blocksToRemove)
		}
		return err
	}

	// Next, do the addrefs.
	log.CDebugf(ctx, "Adding %d block references",
		len(entries.adds.blockStates))
	blocksToRemove, err = doBlockPuts(ctx, bserver, bcache, reporter,
		log, tlfID, tlfName, *entries.adds)
	if err != nil {
		if isRecoverableBlockError(err) {
			log.CWarningf(ctx,
				"Recoverable block error encountered on addRefs: %+v, ptrs=%v",
				err, blocksToRemove)
		}
		return err
	}

	// Now do all the other, non-put/addref entries.  TODO:
	// parallelize these as well.
	for _, entry := range entries.other {
		err := flushNonBPSBlockJournalEntry(ctx, log, bserver, tlfID, entry)
		if err != nil {
			return err
		}
	}

	return nil
}

func (j *blockJournal) removeFlushedEntry(ctx context.Context,
	ordinal journalOrdinal, entry blockJournalEntry) (
	removedBytes, flushedBytes int64, err error) {
	earliestOrdinal, err := j.j.readEarliestOrdinal()
	if err != nil {
		return 0, 0, err
	}

	if ordinal != earliestOrdinal {
		return 0, 0, errors.Errorf("Expected ordinal %d, got %d",
			ordinal, earliestOrdinal)
	}

	_, err = j.j.removeEarliest()
	if err != nil {
		return 0, 0, err
	}

	// Store the block byte count if we've finished a Put.
	if entry.Op == blockPutOp && !entry.Ignore {
		id, _, err := entry.getSingleContext()
		if err != nil {
			return 0, 0, err
		}

		err = j.s.markFlushed(id)
		if err != nil {
			return 0, 0, err
		}

		flushedBytes, err = j.s.getDataSize(id)
		if err != nil {
			return 0, 0, err
		}

		err = j.flushBytes(flushedBytes)
		if err != nil {
			return 0, 0, err
		}
	}

	// Remove any of the entry's refs that hasn't been modified by
	// a subsequent block op (i.e., that has earliestOrdinal as a
	// tag). Has no effect for removeRefsOp (since those are
	// already removed) or mdRevMarkerOp (which has no
	// references).
	for id, idContexts := range entry.Contexts {
		liveCount, err := j.s.removeReferences(
			id, idContexts, earliestOrdinal.String())
		if err != nil {
			return 0, 0, err
		}
		// If j.saveUntilMDFlush is non-nil, then postpone
		// garbage collection until it becomes nil.
		if j.saveUntilMDFlush == nil && liveCount == 0 {
			// Garbage-collect the old entry if we are not
			// saving blocks until the next MD flush.
			idRemovedBytes, err := j.remove(ctx, id)
			if err != nil {
				return 0, 0, err
			}
			removedBytes += idRemovedBytes
		}
	}

	return removedBytes, flushedBytes, nil
}

func (j *blockJournal) removeFlushedEntries(ctx context.Context,
	entries blockEntriesToFlush, tlfID tlf.ID, reporter Reporter) (
	removedBytes int64, err error) {
	// Remove them all!
	for i, entry := range entries.all {
		entryRemovedBytes, flushedBytes, err := j.removeFlushedEntry(
			ctx, entries.first+journalOrdinal(i), entry)
		if err != nil {
			return 0, err
		}

		removedBytes += entryRemovedBytes
		reporter.NotifySyncStatus(ctx, &keybase1.FSPathSyncStatus{
			PublicTopLevelFolder: tlfID.IsPublic(),
			// Path: TODO,
			// SyncingBytes: TODO,
			// SyncingOps: TODO,
			SyncedBytes: flushedBytes,
		})
	}
	return removedBytes, nil
}

func (j *blockJournal) ignoreBlocksAndMDRevMarkersInJournal(ctx context.Context,
	idsToIgnore map[kbfsblock.ID]bool, dj diskJournal) error {
	first, err := dj.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return nil
	} else if err != nil {
		return err
	}
	last, err := dj.readLatestOrdinal()
	if err != nil {
		return err
	}

	isMainJournal := dj.dir == j.j.dir

	// Iterate backwards since the blocks to ignore are likely to be
	// at the end of the journal.
	ignored := 0
	// i is unsigned, so make sure to handle overflow when `first` is
	// 0 by checking that it's less than `last`.  TODO: handle
	// first==0 and last==maxuint?
	for i := last; i >= first && i <= last; i-- {
		entry, err := dj.readJournalEntry(i)
		if err != nil {
			return err
		}
		e := entry.(blockJournalEntry)

		switch e.Op {
		case blockPutOp, addRefOp:
			id, _, err := e.getSingleContext()
			if err != nil {
				return err
			}

			if !idsToIgnore[id] {
				continue
			}
			ignored++

			if e.Unignorable {
				return fmt.Errorf("Block op %s (op %s) is marked as "+
					"unignorable, which isn't allowed", id, e.Op)
			}

			e.Ignore = true
			err = dj.writeJournalEntry(i, e)
			if err != nil {
				return err
			}

			if e.Op == blockPutOp && isMainJournal {
				// Treat ignored put ops as flushed
				// for the purposes of accounting.
				ignoredBytes, err := j.s.getDataSize(id)
				if err != nil {
					return err
				}

				err = j.flushBytes(ignoredBytes)
				if err != nil {
					return err
				}
			}

			// If we've ignored all of the block IDs in `idsToIgnore`,
			// we can avoid iterating through the rest of the journal.
			if len(idsToIgnore) == ignored {
				return nil
			}

		case mdRevMarkerOp:
			if e.Unignorable {
				continue
			}

			e.Ignore = true
			err = dj.writeJournalEntry(i, e)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (j *blockJournal) ignoreBlocksAndMDRevMarkers(ctx context.Context,
	blocksToIgnore []kbfsblock.ID) error {
	idsToIgnore := make(map[kbfsblock.ID]bool)
	for _, id := range blocksToIgnore {
		idsToIgnore[id] = true
	}

	err := j.ignoreBlocksAndMDRevMarkersInJournal(ctx, idsToIgnore, j.j)
	if err != nil {
		return err
	}

	if j.saveUntilMDFlush == nil {
		return nil
	}

	return j.ignoreBlocksAndMDRevMarkersInJournal(
		ctx, idsToIgnore, *j.saveUntilMDFlush)
}

func (j *blockJournal) saveBlocksUntilNextMDFlush() error {
	if j.saveUntilMDFlush != nil {
		return nil
	}

	// Copy the current journal entries into a new journal.  After the
	// next MD flush, we can use the saved journal to delete the block
	// data for all the entries in the saved journal.
	first, err := j.j.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return nil
	} else if err != nil {
		return err
	}

	last, err := j.j.readLatestOrdinal()
	if ioutil.IsNotExist(err) {
		return nil
	} else if err != nil {
		return err
	}

	savedJournalDir := savedBlockJournalDir(j.dir)
	sj := makeDiskJournal(
		j.codec, savedJournalDir, reflect.TypeOf(blockJournalEntry{}))
	savedJournal := &sj

	for i := first; i <= last; i++ {
		e, err := j.readJournalEntry(i)
		if err != nil {
			return err
		}

		savedJournal.appendJournalEntry(nil, e)
	}

	j.saveUntilMDFlush = savedJournal
	return nil
}

// onMDFlush removes at most `maxToRemove` blocks from the
// `saveUntilMDFlush` journal if one exists.  If `lastToRemove` is
// zero, it flushes the complete `saveUntilMDFlush` if it has fewer
// than `maxToRemove` entries; if it doesn't flush the entire journal,
// it returns the ordinal of the current last entry.  If
// `lastToRemove` is non-zero, it only flushes up to the minimum of
// `lastToRemove` and the earliest entry + `maxToRemove`; if this
// flushes the entire saved journal or reaches a non-ignored marker
// for MD revision `flushedMDRev`, it returns 0, otherwise it returns
// `lastToRemove`.  It's intended that the caller should call this
// function repeatedly until it returns 0, releasing any locks in
// between calls so it doesn't block other operations for too long.
func (j *blockJournal) onMDFlush(ctx context.Context,
	maxToRemove uint64, flushedMDRev MetadataRevision,
	lastToRemove journalOrdinal) (
	nextLastToRemove journalOrdinal, removedBytes int64, err error) {
	if j.saveUntilMDFlush == nil {
		return 0, 0, nil
	}

	if maxToRemove == 0 {
		return 0, 0, errors.New("maxToRemove must be non-zero")
	}

	// Delete the block data for anything in the saved journal.
	first, err := j.saveUntilMDFlush.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return 0, 0, nil
	} else if err != nil {
		return 0, 0, err
	}

	last, err := j.saveUntilMDFlush.readLatestOrdinal()
	if ioutil.IsNotExist(err) {
		return 0, 0, nil
	} else if err != nil {
		return 0, 0, err
	}

	if lastToRemove != 0 {
		if last < lastToRemove {
			return 0, 0, errors.Errorf("Last removal requested is %d, but "+
				"last entry in journal is %d", lastToRemove, last)
		} else if first > lastToRemove {
			return 0, 0, errors.Errorf("Last removal requested is %d, but first "+
				"entry in journal is %d", lastToRemove, first)
		}

		last = lastToRemove
	}

	lastMin := last
	if max := journalOrdinal(maxToRemove); lastMin > first+max-1 {
		j.log.CDebugf(ctx, "Last removal requested is %d, but capping at %d",
			last, first+max-1)
		lastMin = first + max - 1
	}

	j.log.CDebugf(ctx, "Removing saved data for entries [%d, %d]",
		first, lastMin)
	for i := first; i <= lastMin; i++ {
		e, err := j.saveUntilMDFlush.readJournalEntry(i)
		if err != nil {
			return 0, 0, err
		}

		_, err = j.saveUntilMDFlush.removeEarliest()
		if err != nil {
			return 0, 0, err
		}

		entry, ok := e.(blockJournalEntry)
		if !ok {
			return 0, 0, errors.New("Unexpected block journal entry type in saved")
		}

		if entry.Op == mdRevMarkerOp && !entry.Ignore &&
			entry.Revision >= flushedMDRev && i != last {
			// We've reached the marker for the flushed revision, but
			// there are still more things to keep in the saved
			// journal, so return early without removing it.
			j.log.CDebugf(ctx, "Reached the marker for flushed revision %d "+
				"at ordinal %d", flushedMDRev, i)
			return 0, removedBytes, nil
		}

		for id := range entry.Contexts {
			hasRef, err := j.s.hasAnyRef(id)
			if err != nil {
				return 0, 0, err
			}
			if !hasRef {
				// Garbage-collect the old entry.
				idRemovedBytes, err := j.remove(ctx, id)
				if err != nil {
					return 0, 0, err
				}
				removedBytes += idRemovedBytes
			}
		}
	}

	if last > lastMin {
		// The saved journal isn't empty and we were asked to remove
		// more entries than we were able to; the caller must call us
		// again.
		return last, removedBytes, nil
	}

	j.log.CDebugf(ctx, "Removed last saved entry, removing saved journal")
	err = ioutil.RemoveAll(j.saveUntilMDFlush.dir)
	if err != nil {
		return 0, 0, err
	}

	j.saveUntilMDFlush = nil
	return 0, removedBytes, nil
}

func (j *blockJournal) getAllRefsForTest() (map[kbfsblock.ID]blockRefMap, error) {
	refs := make(map[kbfsblock.ID]blockRefMap)

	first, err := j.j.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return refs, nil
	} else if err != nil {
		return nil, err
	}
	last, err := j.j.readLatestOrdinal()
	if err != nil {
		return nil, err
	}

	for i := first; i <= last; i++ {
		e, err := j.readJournalEntry(i)
		if err != nil {
			return nil, err
		}

		// Handle single ops separately.
		switch e.Op {
		case blockPutOp, addRefOp:
			id, context, err := e.getSingleContext()
			if err != nil {
				return nil, err
			}

			blockRefs := refs[id]
			if blockRefs == nil {
				blockRefs = make(blockRefMap)
				refs[id] = blockRefs
			}

			err = blockRefs.put(context, liveBlockRef, i.String())
			if err != nil {
				return nil, err
			}

			continue
		}

		for id, idContexts := range e.Contexts {
			blockRefs := refs[id]

			switch e.Op {
			case removeRefsOp:
				if blockRefs == nil {
					// All refs are already gone,
					// which is not an error.
					continue
				}

				for _, context := range idContexts {
					err := blockRefs.remove(context, "")
					if err != nil {
						return nil, err
					}
				}

				if len(blockRefs) == 0 {
					delete(refs, id)
				}

			case archiveRefsOp:
				if blockRefs == nil {
					blockRefs = make(blockRefMap)
					refs[id] = blockRefs
				}

				for _, context := range idContexts {
					err := blockRefs.put(
						context, archivedBlockRef, i.String())
					if err != nil {
						return nil, err
					}
				}

			case mdRevMarkerOp:
				// Ignore MD revision markers.
				continue

			default:
				return nil, errors.Errorf("Unknown op %s", e.Op)
			}
		}
	}
	return refs, nil
}

func (j *blockJournal) checkInSyncForTest() error {
	journalRefs, err := j.getAllRefsForTest()
	if err != nil {
		return err
	}

	storeRefs, err := j.s.getAllRefsForTest()
	if err != nil {
		return err
	}

	if !reflect.DeepEqual(journalRefs, storeRefs) {
		return errors.Errorf("journal refs = %+v != store refs = %+v",
			journalRefs, storeRefs)
	}
	return nil
}
