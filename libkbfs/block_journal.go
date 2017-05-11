// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"math"
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
// dir/gc_block_journal/EARLIEST
// dir/gc_block_journal/LATEST
// dir/gc_block_journal/...
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

	log      traceLogger
	deferLog traceLogger

	// j is the main journal.
	j *diskJournal

	// saveUntilMDFlush, when non-nil, prevents garbage collection
	// of blocks. When removed, all the referenced blocks are
	// garbage-collected.
	//
	// TODO: We only really need to save a list of IDs, and not a
	// full journal.
	deferredGC *diskJournal

	// s stores all the block data. s should always reflect the
	// state you get by replaying all the entries in j.
	s *blockDiskStore

	aggregateInfo blockAggregateInfo
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
	// This is an MD rev marker that represents a local squash.  TODO:
	// combine this with Ignore using a more generic flags or state
	// field, once we can change the journal format.
	IsLocalSquash bool `codec:",omitempty"`
	// This is legacy and only present for backwards compatibility.
	// It can be removed as soon as we are sure there are no more
	// journal entries in the wild with this set.
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

func blockJournalDir(dir string) string {
	return filepath.Join(dir, "block_journal")
}

func blockJournalStoreDir(dir string) string {
	return filepath.Join(dir, "blocks")
}

func deferredGCBlockJournalDir(dir string) string {
	return filepath.Join(dir, "gc_block_journal")
}

// makeBlockJournal returns a new blockJournal for the given
// directory. Any existing journal entries are read.
func makeBlockJournal(
	ctx context.Context, codec kbfscodec.Codec, dir string,
	log logger.Logger) (*blockJournal, error) {
	journalPath := blockJournalDir(dir)
	deferLog := log.CloneWithAddedDepth(1)
	j, err := makeDiskJournal(
		codec, journalPath, reflect.TypeOf(blockJournalEntry{}))
	if err != nil {
		return nil, err
	}

	gcJournalPath := deferredGCBlockJournalDir(dir)
	gcj, err := makeDiskJournal(
		codec, gcJournalPath, reflect.TypeOf(blockJournalEntry{}))
	if err != nil {
		return nil, err
	}

	storeDir := blockJournalStoreDir(dir)
	s := makeBlockDiskStore(codec, storeDir)
	journal := &blockJournal{
		codec:      codec,
		dir:        dir,
		log:        traceLogger{log},
		deferLog:   traceLogger{deferLog},
		j:          j,
		deferredGC: gcj,
		s:          s,
	}

	// Get initial aggregate info.
	err = kbfscodec.DeserializeFromFile(
		codec, aggregateInfoPath(dir), &journal.aggregateInfo)
	if !ioutil.IsNotExist(err) && err != nil {
		return nil, err
	}

	return journal, nil
}

func (j *blockJournal) blockJournalFiles() []string {
	return []string{
		blockJournalDir(j.dir), deferredGCBlockJournalDir(j.dir),
		blockJournalStoreDir(j.dir), aggregateInfoPath(j.dir),
	}
}

// The functions below are for reading and writing aggregate info.

// Ideally, this would be a JSON file, but we'd need a JSON
// encoder/decoder that supports unknown fields.
type blockAggregateInfo struct {
	// StoredBytes counts the number of bytes of block data stored
	// on disk.
	StoredBytes int64
	// StoredFiles counts an upper bound for the number of files
	// of block data stored on disk.
	StoredFiles int64
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

// saturateAdd adds the given delta to the int64 at x; if the result
// would be over MaxInt64, *x is instead set to MaxInt64, and if the
// result would be negative, *x is instead set to 0. If *x is already
// negative, *x is first set to 0 before doing the addition.
func saturateAdd(x *int64, delta int64) {
	if *x < 0 {
		*x = 0
	}

	if delta > 0 && *x > (math.MaxInt64-delta) {
		*x = math.MaxInt64
	} else if delta < 0 && *x+delta < 0 {
		*x = 0
	} else {
		*x += delta
	}
}

func (j *blockJournal) changeCounts(
	deltaStoredBytes, deltaStoredFiles, deltaUnflushedBytes int64) error {
	saturateAdd(&j.aggregateInfo.StoredBytes, deltaStoredBytes)
	saturateAdd(&j.aggregateInfo.StoredFiles, deltaStoredFiles)
	saturateAdd(&j.aggregateInfo.UnflushedBytes, deltaUnflushedBytes)
	return kbfscodec.SerializeToFile(
		j.codec, j.aggregateInfo, aggregateInfoPath(j.dir))
}

func (j *blockJournal) accumulateBlock(bytes, files int64) error {
	if bytes < 0 {
		panic("bytes unexpectedly negative")
	}
	if files < 0 {
		panic("files unexpectedly negative")
	}
	return j.changeCounts(bytes, files, bytes)
}

func (j *blockJournal) flushBlock(bytes int64) error {
	if bytes < 0 {
		panic("bytes unexpectedly negative")
	}
	return j.changeCounts(0, 0, -bytes)
}

func (j *blockJournal) unstoreBlocks(bytes, files int64) error {
	if bytes < 0 {
		panic("bytes unexpectedly negative")
	}
	if files < 0 {
		panic("files unexpectedly negative")
	}
	return j.changeCounts(-bytes, -files, 0)
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

	return ordinal, nil
}

func (j *blockJournal) length() uint64 {
	return j.j.length()
}

func (j *blockJournal) next() (journalOrdinal, error) {
	last, err := j.j.readLatestOrdinal()
	if ioutil.IsNotExist(err) {
		return firstValidJournalOrdinal, nil
	} else if err != nil {
		return 0, err
	}
	return last + 1, nil
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
	removedBytes, removedFiles int64, err error) {
	bytesToRemove, err := j.s.getDataSize(id)
	if err != nil {
		return 0, 0, err
	}

	err = j.s.remove(id)
	if err != nil {
		return 0, 0, err
	}

	var filesToRemove int64
	if bytesToRemove > 0 {
		filesToRemove = filesPerBlockMax
	}

	return bytesToRemove, filesToRemove, nil
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

func (j *blockJournal) getDataSize(id kbfsblock.ID) (int64, error) {
	return j.s.getDataSize(id)
}

func (j *blockJournal) getStoredBytes() int64 {
	return j.aggregateInfo.StoredBytes
}

func (j *blockJournal) getUnflushedBytes() int64 {
	return j.aggregateInfo.UnflushedBytes
}

func (j *blockJournal) getStoredFiles() int64 {
	return j.aggregateInfo.StoredFiles
}

// putData puts the given block data. If err is non-nil, putData will
// always be false.
func (j *blockJournal) putData(
	ctx context.Context, id kbfsblock.ID, context kbfsblock.Context,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf) (
	putData bool, err error) {
	j.log.CDebugf(ctx, "Putting %d bytes of data for block %s with context %v",
		len(buf), id, context)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Put for block %s with context %v failed with %+v",
				id, context, err)
		}
	}()

	next, err := j.next()
	if err != nil {
		return false, err
	}

	putData, err = j.s.put(id, context, buf, serverHalf, next.String())
	if err != nil {
		return false, err
	}

	if putData {
		var putFiles int64 = filesPerBlockMax
		err = j.accumulateBlock(int64(len(buf)), putFiles)
		if err != nil {
			return false, err
		}
	}

	_, err = j.appendJournalEntry(ctx, blockJournalEntry{
		Op:       blockPutOp,
		Contexts: kbfsblock.ContextMap{id: {context}},
	})
	if err != nil {
		return false, err
	}

	return putData, nil
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

	next, err := j.next()
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

	next, err := j.next()
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
		IsLocalSquash: isPendingLocalSquash,
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

func (be blockEntriesToFlush) revIsLocalSquash(rev MetadataRevision) bool {
	for _, entry := range be.other {
		if !entry.Ignore && entry.Op == mdRevMarkerOp && entry.Revision == rev {
			return entry.IsLocalSquash || entry.Unignorable
		}
	}
	return false
}

func (be blockEntriesToFlush) markFlushingBlockIDs(ids map[kbfsblock.ID]bool) {
	for _, bs := range be.puts.blockStates {
		ids[bs.blockPtr.ID] = true
	}
}

func (be blockEntriesToFlush) clearFlushingBlockIDs(ids map[kbfsblock.ID]bool) {
	for _, bs := range be.puts.blockStates {
		delete(ids, bs.blockPtr.ID)
	}
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

func flushBlockEntries(ctx context.Context, log, deferLog traceLogger,
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
		log, deferLog, tlfID, tlfName, *entries.puts)
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
		log, deferLog, tlfID, tlfName, *entries.adds)
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
	flushedBytes int64, err error) {
	earliestOrdinal, err := j.j.readEarliestOrdinal()
	if err != nil {
		return 0, err
	}

	if ordinal != earliestOrdinal {
		return 0, errors.Errorf("Expected ordinal %d, got %d",
			ordinal, earliestOrdinal)
	}

	// Store the block byte count if we've finished a Put.
	if entry.Op == blockPutOp && !entry.Ignore {
		id, _, err := entry.getSingleContext()
		if err != nil {
			return 0, err
		}

		err = j.s.markFlushed(id)
		if err != nil {
			return 0, err
		}

		flushedBytes, err = j.s.getDataSize(id)
		if err != nil {
			return 0, err
		}

		err = j.flushBlock(flushedBytes)
		if err != nil {
			return 0, err
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
			return 0, err
		}
		// Postpone garbage collection until the next MD flush.
		if liveCount == 0 {
			_, err := j.deferredGC.appendJournalEntry(nil, entry)
			if err != nil {
				return 0, err
			}
		}
	}

	_, err = j.j.removeEarliest()
	if err != nil {
		return 0, err
	}

	return flushedBytes, nil
}

func (j *blockJournal) removeFlushedEntries(ctx context.Context,
	entries blockEntriesToFlush, tlfID tlf.ID, reporter Reporter) (
	totalFlushedBytes int64, err error) {
	// Remove them all!
	for i, entry := range entries.all {
		flushedBytes, err := j.removeFlushedEntry(
			ctx, entries.first+journalOrdinal(i), entry)
		if err != nil {
			return 0, err
		}
		totalFlushedBytes += flushedBytes

		reporter.NotifySyncStatus(ctx, &keybase1.FSPathSyncStatus{
			PublicTopLevelFolder: tlfID.IsPublic(),
			// Path: TODO,
			// SyncingBytes: TODO,
			// SyncingOps: TODO,
			SyncedBytes: flushedBytes,
		})
	}

	// The block journal might be empty, but deferredGC might
	// still be non-empty, so we have to wait for that to be empty
	// before nuking the whole journal (see clearDeferredGCRange).

	return totalFlushedBytes, nil
}

func (j *blockJournal) ignoreBlocksAndMDRevMarkersInJournal(ctx context.Context,
	idsToIgnore map[kbfsblock.ID]bool, rev MetadataRevision,
	dj *diskJournal) (totalIgnoredBytes int64, err error) {
	first, err := dj.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	last, err := dj.readLatestOrdinal()
	if err != nil {
		return 0, err
	}

	isMainJournal := dj.dir == j.j.dir

	// Iterate backwards since the blocks to ignore are likely to be
	// at the end of the journal.
	ignored := 0
	ignoredRev := false
	// i is unsigned, so make sure to handle overflow when `first` is
	// 0 by checking that it's less than `last`.  TODO: handle
	// first==0 and last==maxuint?
	for i := last; i >= first && i <= last; i-- {
		entry, err := dj.readJournalEntry(i)
		if err != nil {
			return 0, err
		}
		e := entry.(blockJournalEntry)

		switch e.Op {
		case blockPutOp, addRefOp:
			id, _, err := e.getSingleContext()
			if err != nil {
				return 0, err
			}

			if !idsToIgnore[id] {
				continue
			}
			ignored++

			e.Ignore = true
			err = dj.writeJournalEntry(i, e)
			if err != nil {
				return 0, err
			}

			if e.Op == blockPutOp && isMainJournal {
				// Treat ignored put ops as flushed
				// for the purposes of accounting.
				ignoredBytes, err := j.s.getDataSize(id)
				if err != nil {
					return 0, err
				}

				err = j.flushBlock(ignoredBytes)
				if err != nil {
					return 0, err
				}

				totalIgnoredBytes += ignoredBytes
			}

		case mdRevMarkerOp:
			if ignoredRev {
				continue
			}

			e.Ignore = true
			err = dj.writeJournalEntry(i, e)
			if err != nil {
				return 0, err
			}

			// We must ignore all the way up to the MD marker that
			// matches the revision of the squash, otherwise we may
			// put the new squash MD before all the blocks have been
			// put.
			if e.Revision == rev {
				ignoredRev = true
			}
		}

		// If we've ignored all of the block IDs in `idsToIgnore`, and
		// the earliest md marker we care about, we can avoid
		// iterating through the rest of the journal.
		if len(idsToIgnore) == ignored && ignoredRev {
			break
		}
	}

	return totalIgnoredBytes, nil
}

func (j *blockJournal) ignoreBlocksAndMDRevMarkers(ctx context.Context,
	blocksToIgnore []kbfsblock.ID, rev MetadataRevision) (
	totalIgnoredBytes int64, err error) {
	idsToIgnore := make(map[kbfsblock.ID]bool)
	for _, id := range blocksToIgnore {
		idsToIgnore[id] = true
	}

	return j.ignoreBlocksAndMDRevMarkersInJournal(
		ctx, idsToIgnore, rev, j.j)
}

// getDeferredRange gets the earliest and latest revision of the
// deferred GC journal.  If the returned length is 0, there's no need
// for further GC.
func (j *blockJournal) getDeferredGCRange() (
	len int, earliest, latest journalOrdinal, err error) {
	earliest, err = j.deferredGC.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return 0, 0, 0, nil
	} else if err != nil {
		return 0, 0, 0, err
	}

	latest, err = j.deferredGC.readLatestOrdinal()
	if ioutil.IsNotExist(err) {
		return 0, 0, 0, nil
	} else if err != nil {
		return 0, 0, 0, err
	}

	return int(latest - earliest + 1), earliest, latest, nil
}

// doGC collects any unreferenced blocks from flushed
// entries. earliest and latest should be from a call to
// getDeferredGCRange, and clearDeferredGCRange should be called after
// this function. This function only reads the deferred GC journal at
// the given range and reads/writes the block store, so callers may
// use that to relax any synchronization requirements.
func (j *blockJournal) doGC(ctx context.Context,
	earliest, latest journalOrdinal) (
	removedBytes, removedFiles int64, err error) {
	// Safe to check the earliest ordinal, even if the caller is using
	// relaxed synchronization, since this is the only function that
	// removes items from the deferred journal.
	first, err := j.deferredGC.readEarliestOrdinal()
	if err != nil {
		return 0, 0, err
	}
	if first != earliest {
		return 0, 0, errors.Errorf("Expected deferred earliest %d, "+
			"but actual earliest is %d", earliest, first)
	}

	// Delete the block data for anything in the GC journal.
	j.log.CDebugf(ctx, "Garbage-collecting blocks for entries [%d, %d]",
		earliest, latest)
	for i := earliest; i <= latest; i++ {
		e, err := j.deferredGC.readJournalEntry(i)
		if err != nil {
			return 0, 0, err
		}

		entry, ok := e.(blockJournalEntry)
		if !ok {
			return 0, 0, errors.New("Unexpected block journal entry type to GC")
		}

		for id := range entry.Contexts {
			// TODO: once we support references, this needs to be made
			// goroutine-safe.
			hasRef, err := j.s.hasAnyRef(id)
			if err != nil {
				return 0, 0, err
			}
			if !hasRef {
				// Garbage-collect the old entry.
				idRemovedBytes, idRemovedFiles, err :=
					j.remove(ctx, id)
				if err != nil {
					return 0, 0, err
				}
				removedBytes += idRemovedBytes
				removedFiles += idRemovedFiles
			}
		}
	}

	return removedBytes, removedFiles, nil
}

// clearDeferredGCRange removes the given range from the deferred
// journal. If the journal goes completely empty, it then nukes the
// journal directories.
func (j *blockJournal) clearDeferredGCRange(
	ctx context.Context, removedBytes, removedFiles int64,
	earliest, latest journalOrdinal) (
	clearedJournal bool, aggregateInfo blockAggregateInfo,
	err error) {
	for i := earliest; i <= latest; i++ {
		_, err := j.deferredGC.removeEarliest()
		if err != nil {
			return false, blockAggregateInfo{}, err
		}
	}

	// If we crash before calling this, the journal bytes/files
	// counts will be inaccurate. But this will be resolved when
	// the journal goes empty in the clause above.
	j.unstoreBlocks(removedBytes, removedFiles)

	aggregateInfo = j.aggregateInfo

	if j.j.empty() && j.deferredGC.empty() {
		j.log.CDebugf(ctx, "Block journal is now empty")

		j.aggregateInfo = blockAggregateInfo{}

		err = j.s.clear()
		if err != nil {
			return false, blockAggregateInfo{}, err
		}

		for _, dir := range j.blockJournalFiles() {
			j.log.CDebugf(ctx, "Removing all files in %s", dir)
			err := ioutil.RemoveAll(dir)
			if err != nil {
				return false, blockAggregateInfo{}, err
			}
		}

		clearedJournal = true
	}

	return clearedJournal, aggregateInfo, nil
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

func (j *blockJournal) markLatestRevMarkerAsLocalSquash() error {
	first, err := j.j.readEarliestOrdinal()
	if ioutil.IsNotExist(err) {
		return nil
	} else if err != nil {
		return err
	}
	last, err := j.j.readLatestOrdinal()
	if err != nil {
		return err
	}

	// Iterate backwards to find the latest md marker.
	for i := last; i >= first && i <= last; i-- {
		entry, err := j.j.readJournalEntry(i)
		if err != nil {
			return err
		}
		e := entry.(blockJournalEntry)
		if e.Ignore || e.Op != mdRevMarkerOp {
			continue
		}

		e.IsLocalSquash = true
		return j.j.writeJournalEntry(i, e)
	}

	return errors.Errorf("Couldn't find an md rev marker between %d and %d",
		first, last)
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
