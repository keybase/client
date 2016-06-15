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
	"strconv"
	"sync"
)

// bserverTlfJournal stores an ordered list of BlockServer mutating
// operations for a single TLF, along with associated block data, in
// flat files in a directory on disk.
//
// The directory layout looks like:
//
// dir/journal/EARLIEST
// dir/journal/LATEST
// dir/journal/0...000
// dir/journal/0...001
// dir/journal/0...fff
// dir/blocks/0100/0...01/data
// dir/blocks/0100/0...01/key_server_half
// ...
// dir/blocks/01ff/f...ff/data
// dir/blocks/01ff/f...ff/key_server_half
//
// Each file in dir/journal is named with an ordinal and contains the
// mutating operation and arguments for a single operation, except for
// block data. The files EARLIEST and LATEST point to the earliest and
// latest valid ordinal, respectively.
//
// The block data is stored separately in dir/blocks. Each block has
// its own subdirectory with its ID as a name.  The block
// subdirectories are splayed over (# of possible hash types) * 256
// subdirectories -- one byte for the hash type (currently only one)
// plus the first byte of the hash data -- using the first four
// characters of the name to keep the number of directories in dir
// itself to a manageable number, similar to git. Each block directory
// has data, which is the raw block data that should hash to the block
// ID, and key_server_half, which contains the raw data for the
// associated key server half.
//
// TODO: Do all high-level operations atomically on the file-system
// level.
//
// TODO: Make IO ops cancellable.
//
// TODO: Add a mode which doesn't assume that this is the only storage
// for TLF data, i.e. that doesn't remove files when the (known)
// refcount drops to zero, etc.
type bserverTlfJournal struct {
	codec  Codec
	crypto cryptoPure
	dir    string

	// Protects any IO operations in dir or any of its children,
	// as well as refs and isShutdown.
	//
	// TODO: Consider using https://github.com/pkg/singlefile
	// instead.
	lock       sync.RWMutex
	refs       map[BlockID]blockRefMap
	isShutdown bool
}

// makeBserverTlfJournal returns a new bserverTlfJournal for the given
// directory. Any existing journal entries are read.
func makeBserverTlfJournal(codec Codec, crypto cryptoPure, dir string) (
	*bserverTlfJournal, error) {
	bserver := &bserverTlfJournal{
		codec:  codec,
		crypto: crypto,
		dir:    dir,
	}

	// Locking here is not strictly necessary, but do it anyway
	// for consistency.
	bserver.lock.Lock()
	defer bserver.lock.Unlock()
	refs, err := bserver.readJournalLocked()
	if err != nil {
		return nil, err
	}

	bserver.refs = refs
	return bserver, nil
}

// journalOrdinal is the ordinal used for naming journal entries.
//
// TODO: Incorporate metadata revision numbers.
type journalOrdinal uint64

func makeJournalOrdinal(s string) (journalOrdinal, error) {
	if len(s) != 16 {
		return 0, fmt.Errorf("invalid journal ordinal %q", s)
	}
	u, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return 0, err
	}
	return journalOrdinal(u), nil
}

func (o journalOrdinal) String() string {
	return fmt.Sprintf("%016x", uint64(o))
}

// The functions below are for building various paths for the journal.

func (s *bserverTlfJournal) journalPath() string {
	return filepath.Join(s.dir, "journal")
}

func (s *bserverTlfJournal) earliestPath() string {
	return filepath.Join(s.journalPath(), "EARLIEST")
}

func (s *bserverTlfJournal) latestPath() string {
	return filepath.Join(s.journalPath(), "LATEST")
}

func (s *bserverTlfJournal) journalEntryPath(o journalOrdinal) string {
	return filepath.Join(s.journalPath(), o.String())
}

func (s *bserverTlfJournal) blocksPath() string {
	return filepath.Join(s.dir, "blocks")
}

func (s *bserverTlfJournal) blockPath(id BlockID) string {
	idStr := id.String()
	return filepath.Join(s.blocksPath(), idStr[:4], idStr[4:])
}

func (s *bserverTlfJournal) blockDataPath(id BlockID) string {
	return filepath.Join(s.blockPath(id), "data")
}

func (s *bserverTlfJournal) keyServerHalfPath(id BlockID) string {
	return filepath.Join(s.blockPath(id), "key_server_half")
}

// The functions below are for getting and setting the earliest and
// latest ordinals.

func (s *bserverTlfJournal) readOrdinalLocked(path string) (
	journalOrdinal, error) {
	buf, err := ioutil.ReadFile(path)
	if err != nil {
		return 0, err
	}
	return makeJournalOrdinal(string(buf))
}

func (s *bserverTlfJournal) writeOrdinalLocked(
	path string, o journalOrdinal) error {
	return ioutil.WriteFile(path, []byte(o.String()), 0600)
}

func (s *bserverTlfJournal) readEarliestOrdinalLocked() (
	journalOrdinal, error) {
	return s.readOrdinalLocked(s.earliestPath())
}

func (s *bserverTlfJournal) writeEarliestOrdinalLocked(o journalOrdinal) error {
	return s.writeOrdinalLocked(s.earliestPath(), o)
}

func (s *bserverTlfJournal) readLatestOrdinalLocked() (journalOrdinal, error) {
	return s.readOrdinalLocked(s.latestPath())
}

func (s *bserverTlfJournal) writeLatestOrdinalLocked(o journalOrdinal) error {
	return s.writeOrdinalLocked(s.latestPath(), o)
}

type bserverOpName string

const (
	blockPutOp    bserverOpName = "blockPut"
	addRefOp      bserverOpName = "addReference"
	removeRefsOp  bserverOpName = "removeReferences"
	archiveRefsOp bserverOpName = "archiveReferences"
)

// A bserverJournalEntry is just the name of the operation and the
// associated block ID and contexts. Fields are exported only for
// serialization.
type bserverJournalEntry struct {
	// Must be one of the four ops above.
	Op bserverOpName
	ID BlockID
	// Must have exactly one entry for blockPutOp and addRefOp.
	Contexts []BlockContext
}

// The functions below are for reading and writing journal entries.

func (s *bserverTlfJournal) readJournalEntryLocked(o journalOrdinal) (
	bserverJournalEntry, error) {
	p := s.journalEntryPath(o)
	buf, err := ioutil.ReadFile(p)
	if err != nil {
		return bserverJournalEntry{}, err
	}

	var e bserverJournalEntry
	err = s.codec.Decode(buf, &e)
	if err != nil {
		return bserverJournalEntry{}, err
	}

	return e, nil
}

// readJournalLocked reads the journal and returns a map of all the
// block references in the journal.
func (s *bserverTlfJournal) readJournalLocked() (
	map[BlockID]blockRefMap, error) {
	refs := make(map[BlockID]blockRefMap)

	first, err := s.readEarliestOrdinalLocked()
	if os.IsNotExist(err) {
		return refs, nil
	} else if err != nil {
		return nil, err
	}
	last, err := s.readLatestOrdinalLocked()
	if err != nil {
		return nil, err
	}

	for i := first; i <= last; i++ {
		e, err := s.readJournalEntryLocked(i)
		if err != nil {
			return nil, err
		}

		blockRefs := refs[e.ID]
		if blockRefs == nil {
			blockRefs = make(blockRefMap)
			refs[e.ID] = blockRefs
		}

		switch e.Op {
		case blockPutOp, addRefOp:
			if len(e.Contexts) != 1 {
				return nil, fmt.Errorf(
					"Op %s for id=%s doesn't have exactly one context: %v",
					e.Op, e.ID, e.Contexts)
			}

			blockRefs.put(e.Contexts[0], liveBlockRef)

		case removeRefsOp:
			for _, context := range e.Contexts {
				delete(blockRefs, context.GetRefNonce())
			}

		case archiveRefsOp:
			for _, context := range e.Contexts {
				blockRefs.put(context, archivedBlockRef)
			}

		default:
			return nil, fmt.Errorf("Unknown op %s", e.Op)
		}
	}
	return refs, nil
}

func (s *bserverTlfJournal) writeJournalEntryLocked(
	o journalOrdinal, e bserverJournalEntry) error {
	err := os.MkdirAll(s.journalPath(), 0700)
	if err != nil {
		return err
	}

	p := s.journalEntryPath(o)

	buf, err := s.codec.Encode(e)
	if err != nil {
		return err
	}

	return ioutil.WriteFile(p, buf, 0600)
}

func (s *bserverTlfJournal) appendJournalEntryLocked(
	op bserverOpName, id BlockID, contexts []BlockContext) error {
	// TODO: Consider caching the latest ordinal in memory instead
	// of reading it from disk every time.
	var next journalOrdinal
	o, err := s.readLatestOrdinalLocked()
	if os.IsNotExist(err) {
		next = 0
	} else if err != nil {
		return err
	} else {
		next = o + 1
		if next == 0 {
			// Rollover is almost certainly a bug.
			return fmt.Errorf("Ordinal rollover for (%s, %s, %v)",
				op, id, contexts)
		}
	}

	err = s.writeJournalEntryLocked(next, bserverJournalEntry{
		Op:       op,
		ID:       id,
		Contexts: contexts,
	})
	if err != nil {
		return err
	}

	_, err = s.readEarliestOrdinalLocked()
	if os.IsNotExist(err) {
		s.writeEarliestOrdinalLocked(next)
	} else if err != nil {
		return err
	}
	return s.writeLatestOrdinalLocked(next)
}

func (s *bserverTlfJournal) journalLength() (uint64, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	first, err := s.readEarliestOrdinalLocked()
	if os.IsNotExist(err) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	last, err := s.readLatestOrdinalLocked()
	if err != nil {
		return 0, err
	}
	return uint64(last - first + 1), nil
}

func (s *bserverTlfJournal) getRefEntryLocked(
	id BlockID, refNonce BlockRefNonce) (blockRefEntry, error) {
	refs := s.refs[id]
	if refs == nil {
		return blockRefEntry{}, BServerErrorBlockNonExistent{}
	}

	e, ok := refs[refNonce]
	if !ok {
		return blockRefEntry{}, BServerErrorBlockNonExistent{}
	}

	return e, nil
}

var errBserverTlfJournalShutdown = errors.New("bserverTlfJournal is shutdown")

// getDataLocked verifies the block data for the given ID and context
// and returns it.
func (s *bserverTlfJournal) getDataLocked(id BlockID, context BlockContext) (
	[]byte, BlockCryptKeyServerHalf, error) {
	if s.isShutdown {
		return nil, BlockCryptKeyServerHalf{},
			errBserverTlfJournalShutdown
	}

	// Check arguments.

	refEntry, err := s.getRefEntryLocked(id, context.GetRefNonce())
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	err = refEntry.checkContext(context)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	// Read files.

	data, err := ioutil.ReadFile(s.blockDataPath(id))
	if os.IsNotExist(err) {
		return nil, BlockCryptKeyServerHalf{},
			BServerErrorBlockNonExistent{}
	} else if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	keyServerHalfPath := s.keyServerHalfPath(id)
	buf, err := ioutil.ReadFile(keyServerHalfPath)
	if os.IsNotExist(err) {
		return nil, BlockCryptKeyServerHalf{},
			BServerErrorBlockNonExistent{}
	} else if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	// Check integrity.

	dataID, err := s.crypto.MakePermanentBlockID(data)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	if id != dataID {
		return nil, BlockCryptKeyServerHalf{}, fmt.Errorf(
			"Block ID mismatch: expected %s, got %s", id, dataID)
	}

	var serverHalf BlockCryptKeyServerHalf
	err = serverHalf.UnmarshalBinary(buf)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	return data, serverHalf, nil
}

func (s *bserverTlfJournal) putRefEntryLocked(
	id BlockID, refEntry blockRefEntry) error {
	existingRefEntry, err := s.getRefEntryLocked(
		id, refEntry.Context.GetRefNonce())
	var exists bool
	switch err.(type) {
	case BServerErrorBlockNonExistent:
		exists = false
	case nil:
		exists = true
	default:
		return err
	}

	if exists {
		err = existingRefEntry.checkContext(refEntry.Context)
		if err != nil {
			return err
		}
	}

	if s.refs[id] == nil {
		s.refs[id] = make(blockRefMap)
	}

	s.refs[id].put(refEntry.Context, refEntry.Status)
	return nil
}

// All functions below are public functions.

func (s *bserverTlfJournal) getData(id BlockID, context BlockContext) (
	[]byte, BlockCryptKeyServerHalf, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.getDataLocked(id, context)
}

func (s *bserverTlfJournal) getAll() (
	map[BlockID]map[BlockRefNonce]blockRefLocalStatus, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	if s.isShutdown {
		return nil, errBserverTlfJournalShutdown
	}

	res := make(map[BlockID]map[BlockRefNonce]blockRefLocalStatus)

	for id, refs := range s.refs {
		if len(refs) == 0 {
			continue
		}

		res[id] = make(map[BlockRefNonce]blockRefLocalStatus)
		for ref, refEntry := range refs {
			res[id][ref] = refEntry.Status
		}
	}

	return res, nil
}

func (s *bserverTlfJournal) putData(
	id BlockID, context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	err := validateBlockServerPut(s.crypto, id, context, buf)
	if err != nil {
		return err
	}

	s.lock.Lock()
	defer s.lock.Unlock()

	if s.isShutdown {
		return errBserverTlfJournalShutdown
	}

	_, existingServerHalf, err := s.getDataLocked(id, context)
	var exists bool
	switch err.(type) {
	case BServerErrorBlockNonExistent:
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

		// We checked that both buf and existingData hash to
		// id, so no need to check that they're both equal.

		if existingServerHalf != serverHalf {
			return fmt.Errorf(
				"key server half mismatch: expected %s, got %s",
				existingServerHalf, serverHalf)
		}
	}

	err = os.MkdirAll(s.blockPath(id), 0700)
	if err != nil {
		return err
	}

	err = ioutil.WriteFile(s.blockDataPath(id), buf, 0600)
	if err != nil {
		return err
	}

	// TODO: Add integrity-checking for key server half?

	err = ioutil.WriteFile(
		s.keyServerHalfPath(id), serverHalf.data[:], 0600)
	if err != nil {
		return err
	}

	err = s.putRefEntryLocked(id, blockRefEntry{
		Status:  liveBlockRef,
		Context: context,
	})
	if err != nil {
		return err
	}

	return s.appendJournalEntryLocked(
		blockPutOp, id, []BlockContext{context})
}

func (s *bserverTlfJournal) addReference(id BlockID, context BlockContext) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	if s.isShutdown {
		return errBserverTlfJournalShutdown
	}

	refs := s.refs[id]
	if refs == nil {
		return BServerErrorBlockNonExistent{fmt.Sprintf("Block ID %s "+
			"doesn't exist and cannot be referenced.", id)}
	}

	// Only add it if there's a non-archived reference.
	hasNonArchivedRef := false
	for _, refEntry := range refs {
		if refEntry.Status == liveBlockRef {
			hasNonArchivedRef = true
			break
		}
	}

	if !hasNonArchivedRef {
		return BServerErrorBlockArchived{fmt.Sprintf("Block ID %s has "+
			"been archived and cannot be referenced.", id)}
	}

	// TODO: Figure out if we should allow adding a reference even
	// if all the existing references are archived, or if we have
	// no references at all. Also figure out what to do with an
	// addReference without a preceding Put.

	err := s.putRefEntryLocked(id, blockRefEntry{
		Status:  liveBlockRef,
		Context: context,
	})
	if err != nil {
		return err
	}

	return s.appendJournalEntryLocked(
		addRefOp, id, []BlockContext{context})
}

func (s *bserverTlfJournal) removeReferences(
	id BlockID, contexts []BlockContext) (int, error) {
	s.lock.Lock()
	defer s.lock.Unlock()

	if s.isShutdown {
		return 0, errBserverTlfJournalShutdown
	}

	refs := s.refs[id]
	if refs == nil {
		// This block is already gone; no error.
		return 0, nil
	}

	for _, context := range contexts {
		refNonce := context.GetRefNonce()
		// If this check fails, this ref is already gone,
		// which is not an error.
		if refEntry, ok := refs[refNonce]; ok {
			err := refEntry.checkContext(context)
			if err != nil {
				return 0, err
			}

			delete(refs, refNonce)
		}
	}

	count := len(refs)
	if count == 0 {
		err := os.RemoveAll(s.blockPath(id))
		if err != nil {
			return 0, err
		}
	}

	// TODO: Figure out what to do with live count when we have a
	// real block server backend.

	err := s.appendJournalEntryLocked(removeRefsOp, id, contexts)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *bserverTlfJournal) archiveReferences(
	id BlockID, contexts []BlockContext) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	if s.isShutdown {
		return errBserverTlfJournalShutdown
	}

	for _, context := range contexts {
		refNonce := context.GetRefNonce()
		refEntry, err := s.getRefEntryLocked(id, refNonce)
		switch err.(type) {
		case BServerErrorBlockNonExistent:
			return BServerErrorBlockNonExistent{
				fmt.Sprintf(
					"Block ID %s (ref %s) doesn't "+
						"exist and cannot be archived.",
					id, refNonce),
			}
		case nil:
			break

		default:
			return err
		}

		err = refEntry.checkContext(context)
		if err != nil {
			return err
		}

		refEntry.Status = archivedBlockRef
		err = s.putRefEntryLocked(id, refEntry)
		if err != nil {
			return err
		}
	}

	return s.appendJournalEntryLocked(archiveRefsOp, id, contexts)
}

func (s *bserverTlfJournal) shutdown() {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.isShutdown = true

	// Double-check the on-disk journal with the in-memory one.
	refs, err := s.readJournalLocked()
	if err != nil {
		panic(err)
	}

	if !reflect.DeepEqual(refs, s.refs) {
		panic(fmt.Sprintf("refs = %v != s.refs = %v", refs, s.refs))
	}
}
