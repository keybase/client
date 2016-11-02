// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"reflect"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// blockJournal stores a single ordered list of block operations for a
// single TLF, along with the associated block data, in flat files in
// a directory on disk.
//
// The directory layout looks like:
//
// dir/block_journal/EARLIEST
// dir/block_journal/LATEST
// dir/block_journal/0...000
// dir/block_journal/0...001
// dir/block_journal/0...fff
// dir/blocks/0100/0...01/data
// dir/blocks/0100/0...01/key_server_half
// ...
// dir/blocks/01ff/f...ff/data
// dir/blocks/01ff/f...ff/key_server_half
//
// Each entry in the journal in dir/block_journal contains the
// mutating operation and arguments for a single operation, except for
// block data. (See diskJournal comments for more details about the
// journal.)
//
// The block data is stored separately in dir/blocks. Each block has
// its own subdirectory with its ID truncated to 17 bytes (34
// characters) as a name. The block subdirectories are splayed over (#
// of possible hash types) * 256 subdirectories -- one byte for the
// hash type (currently only one) plus the first byte of the hash data
// -- using the first four characters of the name to keep the number
// of directories in dir itself to a manageable number, similar to
// git. Each block directory has data, which is the raw block data
// that should hash to the block ID, and key_server_half, which
// contains the raw data for the associated key server half. Future
// versions of the journal might add more files to this directory; if
// any code is written to move blocks around, it should be careful to
// preserve any unknown files in a block directory.
//
// The maximum number of characters added to the root dir by a block
// journal is 59:
//
//   /blocks/01ff/f...(30 characters total)...ff/key_server_half
//
// blockJournal is not goroutine-safe, so any code that uses it must
// guarantee that only one goroutine at a time calls its functions.
type blockJournal struct {
	codec  kbfscodec.Codec
	crypto cryptoPure
	dir    string

	log      logger.Logger
	deferLog logger.Logger

	j    diskJournal
	refs map[BlockID]blockRefMap

	// Tracks the total size of on-disk blocks that will be flushed to
	// the server (i.e., does not count reference adds).  It is only
	// accurate for users of this journal that properly flush entries;
	// in particular, calls to `removeReferences` with
	// removeUnreferencedBlocks set to true can cause this count to
	// deviate from the actual disk usage of the journal.
	unflushedBytes int64
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
	Contexts map[BlockID][]BlockContext `codec:",omitempty"`
	// Only used for mdRevMarkerOps.
	Revision MetadataRevision `codec:",omitempty"`
	// Ignore this entry while flushing if this is true.
	Ignore bool `codec:",omitempty"`

	codec.UnknownFieldSetHandler
}

// Get the single context stored in this entry. Only applicable to
// blockPutOp and addRefOp.
func (e blockJournalEntry) getSingleContext() (
	BlockID, BlockContext, error) {
	switch e.Op {
	case blockPutOp, addRefOp:
		if len(e.Contexts) != 1 {
			return BlockID{}, BlockContext{}, fmt.Errorf(
				"Op %s doesn't have exactly one context: %v",
				e.Op, e.Contexts)
		}
		for id, idContexts := range e.Contexts {
			if len(idContexts) != 1 {
				return BlockID{}, BlockContext{}, fmt.Errorf(
					"Op %s doesn't have exactly one context for id=%s: %v",
					e.Op, id, idContexts)
			}
			return id, idContexts[0], nil
		}
	}

	return BlockID{}, BlockContext{}, fmt.Errorf(
		"getSingleContext() erroneously called on op %s", e.Op)
}

// makeBlockJournal returns a new blockJournal for the given
// directory. Any existing journal entries are read.
func makeBlockJournal(
	ctx context.Context, codec kbfscodec.Codec, crypto cryptoPure,
	dir string, log logger.Logger) (*blockJournal, error) {
	journalPath := filepath.Join(dir, "block_journal")
	deferLog := log.CloneWithAddedDepth(1)
	j := makeDiskJournal(
		codec, journalPath, reflect.TypeOf(blockJournalEntry{}))
	journal := &blockJournal{
		codec:    codec,
		crypto:   crypto,
		dir:      dir,
		log:      log,
		deferLog: deferLog,
		j:        j,
	}

	refs, unflushedBytes, err := journal.readJournal(ctx)
	if err != nil {
		return nil, err
	}

	journal.refs = refs
	journal.unflushedBytes = unflushedBytes
	return journal, nil
}

// The functions below are for building various non-journal paths.

func (j *blockJournal) blocksPath() string {
	return filepath.Join(j.dir, "blocks")
}

func (j *blockJournal) blockPath(id BlockID) string {
	// Truncate to 34 characters, which corresponds to 16 random
	// bytes (since the first byte is a hash type) or 128 random
	// bits, which means that the expected number of blocks
	// generated before getting a path collision is 2^64 (see
	// https://en.wikipedia.org/wiki/Birthday_problem#Cast_as_a_collision_problem
	// ). The full ID can be recovered just by hashing the data
	// again with the same hash type.
	idStr := id.String()
	return filepath.Join(j.blocksPath(), idStr[:4], idStr[4:34])
}

func (j *blockJournal) blockDataPath(id BlockID) string {
	return filepath.Join(j.blockPath(id), "data")
}

func (j *blockJournal) keyServerHalfPath(id BlockID) string {
	return filepath.Join(j.blockPath(id), "key_server_half")
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

// readJournal reads the journal and returns a map of all the block
// references in the journal and the total number of bytes that need
// flushing.
func (j *blockJournal) readJournal(ctx context.Context) (
	map[BlockID]blockRefMap, int64, error) {
	refs := make(map[BlockID]blockRefMap)

	first, err := j.j.readEarliestOrdinal()
	if os.IsNotExist(err) {
		return refs, 0, nil
	} else if err != nil {
		return nil, 0, err
	}
	last, err := j.j.readLatestOrdinal()
	if err != nil {
		return nil, 0, err
	}

	j.log.CDebugf(ctx, "Reading journal entries %d to %d", first, last)

	var unflushedBytes int64
	for i := first; i <= last; i++ {
		e, err := j.readJournalEntry(i)
		if err != nil {
			return nil, 0, err
		}

		// Handle single ops separately.
		switch e.Op {
		case blockPutOp, addRefOp:
			id, context, err := e.getSingleContext()
			if err != nil {
				return nil, 0, err
			}

			blockRefs := refs[id]
			if blockRefs == nil {
				blockRefs = make(blockRefMap)
				refs[id] = blockRefs
			}

			err = blockRefs.put(context, liveBlockRef, i)
			if err != nil {
				return nil, 0, err
			}

			// Only puts count as bytes, on the assumption that the
			// refs won't have to upload any new bytes.  (This might
			// be wrong if all references to a block were deleted
			// since the addref entry was appended.)
			if e.Op == blockPutOp && !e.Ignore {
				b, err := j.getDataSize(id)
				// Ignore ENOENT errors, since users like
				// BlockServerDisk can remove block data without
				// deleting the corresponding addRef.
				if err != nil && !os.IsNotExist(err) {
					return nil, 0, err
				}
				unflushedBytes += b
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
					err := blockRefs.remove(context, nil)
					if err != nil {
						return nil, 0, err
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
						context, archivedBlockRef, i)
					if err != nil {
						return nil, 0, err
					}
				}

			case mdRevMarkerOp:
				// Ignore MD revision markers.
				continue

			default:
				return nil, 0, fmt.Errorf("Unknown op %s", e.Op)
			}
		}
	}
	j.log.CDebugf(ctx, "Found %d block bytes in the journal", unflushedBytes)
	return refs, unflushedBytes, nil
}

func (j *blockJournal) appendJournalEntry(entry blockJournalEntry) (
	journalOrdinal, error) {
	return j.j.appendJournalEntry(nil, entry)
}

func (j *blockJournal) length() (uint64, error) {
	return j.j.length()
}

func (j *blockJournal) end() (journalOrdinal, error) {
	last, err := j.j.readLatestOrdinal()
	if os.IsNotExist(err) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	return last + 1, nil
}

func (j *blockJournal) getRefEntry(
	id BlockID, refNonce BlockRefNonce) (blockRefEntry, error) {
	refs := j.refs[id]
	if refs == nil {
		return blockRefEntry{}, blockNonExistentError{id}
	}

	e, ok := refs[refNonce]
	if !ok {
		return blockRefEntry{}, blockNonExistentError{id}
	}

	return e, nil
}

func (j *blockJournal) putRefEntry(
	id BlockID, refEntry blockRefEntry, ordinal journalOrdinal) error {
	existingRefEntry, err := j.getRefEntry(
		id, refEntry.context.GetRefNonce())
	var exists bool
	switch err.(type) {
	case blockNonExistentError:
		exists = false
	case nil:
		exists = true
	default:
		return err
	}

	if exists {
		err = existingRefEntry.checkContext(refEntry.context)
		if err != nil {
			return err
		}
	}

	if j.refs[id] == nil {
		j.refs[id] = make(blockRefMap)
	}

	return j.refs[id].put(refEntry.context, refEntry.status, ordinal)
}

func (j *blockJournal) getDataSize(id BlockID) (int64, error) {
	fi, err := os.Stat(j.blockDataPath(id))
	if err != nil {
		return 0, err
	}
	return fi.Size(), nil
}

func (j *blockJournal) getData(id BlockID) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	data, err := ioutil.ReadFile(j.blockDataPath(id))
	if os.IsNotExist(err) {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			blockNonExistentError{id}
	} else if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	keyServerHalfPath := j.keyServerHalfPath(id)
	buf, err := ioutil.ReadFile(keyServerHalfPath)
	if os.IsNotExist(err) {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			blockNonExistentError{id}
	} else if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	// Check integrity.

	dataID, err := j.crypto.MakePermanentBlockID(data)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	if id != dataID {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, fmt.Errorf(
			"Block ID mismatch: expected %s, got %s", id, dataID)
	}

	var serverHalf kbfscrypto.BlockCryptKeyServerHalf
	err = serverHalf.UnmarshalBinary(buf)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	return data, serverHalf, nil
}

// All functions below are public functions.

func (j *blockJournal) hasRef(id BlockID) bool {
	return j.refs[id] != nil
}

func (j *blockJournal) hasNonArchivedRef(id BlockID) bool {
	refs := j.refs[id]
	return (refs != nil) && refs.hasNonArchivedRef()
}

func (j *blockJournal) hasContext(id BlockID, context BlockContext) bool {
	refs := j.refs[id]
	return (refs != nil) && (refs.checkExists(context) == nil)
}

func (j *blockJournal) getDataWithContext(
	id BlockID, context BlockContext) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	refEntry, err := j.getRefEntry(id, context.GetRefNonce())
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	err = refEntry.checkContext(context)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	return j.getData(id)
}

func (j *blockJournal) getAll() (
	map[BlockID]map[BlockRefNonce]blockRefLocalStatus, error) {
	res := make(map[BlockID]map[BlockRefNonce]blockRefLocalStatus)
	for id, refs := range j.refs {
		res[id] = refs.getStatuses()
	}
	return res, nil
}

func (j *blockJournal) putData(
	ctx context.Context, id BlockID, context BlockContext, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	j.log.CDebugf(ctx, "Putting %d bytes of data for block %s with context %v",
		len(buf), id, context)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Put for block %s with context %v failed with %v",
				id, context, err)
		}
	}()

	err = validateBlockServerPut(j.crypto, id, context, buf)
	if err != nil {
		return err
	}

	// Check the data and retrieve the server half, if they exist.
	_, existingServerHalf, err := j.getDataWithContext(id, context)
	var exists bool
	switch err.(type) {
	case blockNonExistentError:
		exists = false
	case nil:
		exists = true
	default:
		return err
	}

	if exists {
		// If the entry already exists, everything should be
		// the same, except for possibly additional
		// references.

		// We checked that both buf and the existing data hash
		// to id, so no need to check that they're both equal.

		if existingServerHalf != serverHalf {
			return fmt.Errorf(
				"key server half mismatch: expected %s, got %s",
				existingServerHalf, serverHalf)
		}
	}

	err = os.MkdirAll(j.blockPath(id), 0700)
	if err != nil {
		return err
	}

	err = ioutil.WriteFile(j.blockDataPath(id), buf, 0600)
	if err != nil {
		return err
	}
	j.unflushedBytes += int64(len(buf))

	// TODO: Add integrity-checking for key server half?

	data, err := serverHalf.MarshalBinary()
	if err != nil {
		return err
	}
	err = ioutil.WriteFile(
		j.keyServerHalfPath(id), data, 0600)
	if err != nil {
		return err
	}

	ordinal, err := j.appendJournalEntry(blockJournalEntry{
		Op:       blockPutOp,
		Contexts: map[BlockID][]BlockContext{id: {context}},
	})
	if err != nil {
		return err
	}

	return j.putRefEntry(id, blockRefEntry{
		status:  liveBlockRef,
		context: context,
	}, ordinal)
}

func (j *blockJournal) addReference(
	ctx context.Context, id BlockID, context BlockContext) (
	err error) {
	j.log.CDebugf(ctx, "Adding reference for block %s with context %v",
		id, context)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Adding reference for block %s with context %v failed with %v",
				id, context, err)
		}
	}()

	ordinal, err := j.appendJournalEntry(blockJournalEntry{
		Op:       addRefOp,
		Contexts: map[BlockID][]BlockContext{id: {context}},
	})
	if err != nil {
		return err
	}

	return j.putRefEntry(id, blockRefEntry{
		status:  liveBlockRef,
		context: context,
	}, ordinal)
}

// removeReferences fixes up the in-memory reference map to delete the
// given references.  If removeUnreferencedBlocks is true, it will
// also delete the corresponding blocks from the disk.  However, in
// that case, j.unflushedBytes will no longer be accurate and
// shouldn't be relied upon.
func (j *blockJournal) removeReferences(
	ctx context.Context, contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	j.log.CDebugf(ctx, "Removing references for %v", contexts)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Removing references for %v", contexts, err)
		}
	}()

	liveCounts = make(map[BlockID]int)

	for id, idContexts := range contexts {
		refs := j.refs[id]
		if refs == nil {
			// This block is already gone; no error.
			continue
		}

		for _, context := range idContexts {
			err := refs.remove(context, nil)
			if err != nil {
				return nil, err
			}
		}

		count := len(refs)
		if count == 0 {
			delete(j.refs, id)
		}
		liveCounts[id] = count
	}

	_, err = j.appendJournalEntry(blockJournalEntry{
		Op:       removeRefsOp,
		Contexts: contexts,
	})
	if err != nil {
		return nil, err
	}

	return liveCounts, nil
}

// removeBlockData removes any existing block data for the given
// ID. If there is no data, nil is returned; this can happen when we
// have only non-put references to a block in the journal.
func (j *blockJournal) removeBlockData(id BlockID) error {
	if j.hasRef(id) {
		return fmt.Errorf(
			"Trying to remove data for referenced block %s", id)
	}
	path := j.blockPath(id)

	err := os.RemoveAll(path)
	if err != nil {
		return err
	}

	// Remove the parent (splayed) directory if it exists and is
	// empty.
	err = os.Remove(filepath.Dir(path))
	if os.IsNotExist(err) || isExist(err) {
		err = nil
	}
	return err
}

func (j *blockJournal) archiveReferences(
	ctx context.Context, contexts map[BlockID][]BlockContext) (err error) {
	j.log.CDebugf(ctx, "Archiving references for %v", contexts)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Archiving references for %v,", contexts, err)
		}
	}()

	ordinal, err := j.appendJournalEntry(blockJournalEntry{
		Op:       archiveRefsOp,
		Contexts: contexts,
	})
	if err != nil {
		return err
	}

	for id, idContexts := range contexts {
		for _, context := range idContexts {
			refNonce := context.GetRefNonce()
			refEntry, err := j.getRefEntry(id, refNonce)
			switch err.(type) {
			case blockNonExistentError:
				refEntry = blockRefEntry{
					status:  archivedBlockRef,
					context: context,
				}

			case nil:
				err = refEntry.checkContext(context)
				if err != nil {
					return err
				}
				refEntry.status = archivedBlockRef

			default:
				return err
			}

			err = j.putRefEntry(id, refEntry, ordinal)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (j *blockJournal) markMDRevision(ctx context.Context,
	rev MetadataRevision) (err error) {
	j.log.CDebugf(ctx, "Marking MD revision %d in the block journal", rev)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx, "Marking MD revision %d error: %v",
				rev, err)
		}
	}()

	_, err = j.appendJournalEntry(blockJournalEntry{
		Op:       mdRevMarkerOp,
		Revision: rev,
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
	if os.IsNotExist(err) {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized, nil
	} else if err != nil {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
	}

	if first >= end {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized,
			fmt.Errorf("Trying to flush past the "+
				"start of the journal (first=%d, end=%d)", first, end)
	}

	realEnd, err := j.end()
	if realEnd == 0 {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized,
			fmt.Errorf("There was an earliest "+
				"ordinal %d, but no latest ordinal", first)
	} else if err != nil {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
	}

	if end > realEnd {
		return blockEntriesToFlush{}, MetadataRevisionUninitialized,
			fmt.Errorf("Trying to flush past the "+
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

			data, serverHalf, err = j.getData(id)
			if err != nil {
				return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
			}

			entries.puts.addNewBlock(
				BlockPointer{ID: id, BlockContext: bctx},
				nil, /* only used by folderBranchOps */
				ReadyBlockData{data, serverHalf}, nil)

		case addRefOp:
			id, bctx, err := entry.getSingleContext()
			if err != nil {
				return blockEntriesToFlush{}, MetadataRevisionUninitialized, err
			}

			entries.adds.addNewBlock(
				BlockPointer{ID: id, BlockContext: bctx},
				nil, /* only used by folderBranchOps */
				ReadyBlockData{}, nil)

		case mdRevMarkerOp:
			if entry.Revision < maxMDRevToFlush {
				return blockEntriesToFlush{}, MetadataRevisionUninitialized,
					fmt.Errorf("Max MD revision decreased in block journal "+
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
		return fmt.Errorf("Unknown op %s", entry.Op)
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
				"Recoverable block error encountered on puts: %v, ptrs=%v",
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
				"Recoverable block error encountered on addRefs: %v, ptrs=%v",
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
	// Fix up the block byte count if we've finished a Put.
	if entry.Op == blockPutOp && !entry.Ignore {
		id, _, err := entry.getSingleContext()
		if err != nil {
			return 0, err
		}
		flushedBytes, err = j.getDataSize(id)
		if err != nil {
			return 0, err
		}

		if flushedBytes > j.unflushedBytes {
			return 0, fmt.Errorf("Block %v is bigger than our current count "+
				"of journal block bytes (%d > %d)", id,
				flushedBytes, j.unflushedBytes)
		}
		j.unflushedBytes -= flushedBytes
	}

	earliestOrdinal, err := j.j.readEarliestOrdinal()
	if err != nil {
		return 0, err
	}

	if ordinal != earliestOrdinal {
		return 0, fmt.Errorf("Expected ordinal %d, got %d",
			ordinal, earliestOrdinal)
	}

	_, err = j.j.removeEarliest()
	if err != nil {
		return 0, err
	}

	// Remove any of the entry's refs that hasn't been modified by
	// a subsequent block op (i.e., that has earliestOrdinal as a
	// tag).
	for id, idContexts := range entry.Contexts {
		refs := j.refs[id]
		if len(refs) == 0 {
			continue
		}
		for _, context := range idContexts {
			err := refs.remove(context, earliestOrdinal)
			if err != nil {
				return 0, err
			}
			if len(refs) == 0 {
				delete(j.refs, id)

				// Garbage-collect the old entry.  TODO: we'll
				// eventually need a sweeper to clean up entries left
				// behind if we crash here.
				err = j.removeBlockData(id)
				if err != nil {
					return 0, err
				}
				break
			}
		}
	}

	return flushedBytes, nil
}

func (j *blockJournal) removeFlushedEntries(ctx context.Context,
	entries blockEntriesToFlush, tlfID tlf.ID, reporter Reporter) error {
	// Remove them all!
	for i, entry := range entries.all {
		flushedBytes, err := j.removeFlushedEntry(
			ctx, entries.first+journalOrdinal(i), entry)
		if err != nil {
			return err
		}

		reporter.NotifySyncStatus(ctx, &keybase1.FSPathSyncStatus{
			PublicTopLevelFolder: tlfID.IsPublic(),
			// Path: TODO,
			// SyncingBytes: TODO,
			// SyncingOps: TODO,
			SyncedBytes: flushedBytes,
		})
	}
	return nil
}

func (j *blockJournal) ignoreBlocksAndMDRevMarkers(ctx context.Context,
	blocksToIgnore []BlockID) error {
	first, err := j.j.readEarliestOrdinal()
	if os.IsNotExist(err) {
		return nil
	} else if err != nil {
		return err
	}
	last, err := j.j.readLatestOrdinal()
	if err != nil {
		return err
	}

	idsToIgnore := make(map[BlockID]bool)
	for _, id := range blocksToIgnore {
		idsToIgnore[id] = true
	}

	for i := first; i <= last; i++ {
		e, err := j.readJournalEntry(i)
		if err != nil {
			return err
		}

		switch e.Op {
		case blockPutOp, addRefOp:
			id, _, err := e.getSingleContext()
			if err != nil {
				return err
			}

			if !idsToIgnore[id] {
				continue
			}

			e.Ignore = true
			err = j.j.writeJournalEntry(i, e)
			if err != nil {
				return nil
			}

			if e.Op == blockPutOp {
				b, err := j.getDataSize(id)
				// Ignore ENOENT errors, since users like
				// BlockServerDisk can remove block data without
				// deleting the corresponding addRef.
				if err != nil {
					return err
				}
				j.unflushedBytes -= b
			}

		case mdRevMarkerOp:
			e.Ignore = true
			err = j.j.writeJournalEntry(i, e)
			if err != nil {
				return nil
			}
		}
	}

	return nil
}

func (j *blockJournal) checkInSync(ctx context.Context) error {
	refs, _, err := j.readJournal(ctx)
	if err != nil {
		return err
	}
	if !reflect.DeepEqual(refs, j.refs) {
		return fmt.Errorf("refs = %v != j.refs = %v", refs, j.refs)
	}
	return nil
}
