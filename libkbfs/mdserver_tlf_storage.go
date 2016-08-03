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
	"sync"

	keybase1 "github.com/keybase/client/go/protocol"
)

// mdServerTlfStorage stores an ordered list of metadata IDs for each
// branch of a single TLF, along with the associated metadata objects,
// in flat files on disk.
//
// The directory layout looks like:
//
// dir/md_branch_journals/00..00/EARLIEST
// dir/md_branch_journals/00..00/LATEST
// dir/md_branch_journals/00..00/0...001
// dir/md_branch_journals/00..00/0...002
// dir/md_branch_journals/00..00/0...fff
// dir/md_branch_journals/5f..3d/EARLIEST
// dir/md_branch_journals/5f..3d/LATEST
// dir/md_branch_journals/5f..3d/0...0ff
// dir/md_branch_journals/5f..3d/0...100
// dir/md_branch_journals/5f..3d/0...fff
// dir/mds/0100/0...01
// ...
// dir/mds/01ff/f...ff
//
// Each branch has its own subdirectory with a journal; the journal
// ordinals are just MetadataRevisions, and the journal entries are
// just MdIDs. (Branches are usually temporary, so no need to splay
// them.)
//
// The Metadata objects are stored separately in dir/mds. Each block
// has its own subdirectory with its ID as a name. The MD
// subdirectories are splayed over (# of possible hash types) * 256
// subdirectories -- one byte for the hash type (currently only one)
// plus the first byte of the hash data -- using the first four
// characters of the name to keep the number of directories in dir
// itself to a manageable number, similar to git.
type mdServerTlfStorage struct {
	codec  Codec
	crypto cryptoPure
	dir    string

	// Protects any IO operations in dir or any of its children,
	// as well as branchJournals and its contents.
	lock           sync.RWMutex
	branchJournals map[BranchID]mdIDJournal
}

func makeMDServerTlfStorage(
	codec Codec, crypto cryptoPure, dir string) *mdServerTlfStorage {
	journal := &mdServerTlfStorage{
		codec:          codec,
		crypto:         crypto,
		dir:            dir,
		branchJournals: make(map[BranchID]mdIDJournal),
	}
	return journal
}

// The functions below are for building various paths.

func (s *mdServerTlfStorage) branchJournalsPath() string {
	return filepath.Join(s.dir, "md_branch_journals")
}

func (s *mdServerTlfStorage) mdsPath() string {
	return filepath.Join(s.dir, "mds")
}

func (s *mdServerTlfStorage) mdPath(id MdID) string {
	idStr := id.String()
	return filepath.Join(s.mdsPath(), idStr[:4], idStr[4:])
}

// getDataLocked verifies the MD data (but not the signature) for the
// given ID and returns it.
//
// TODO: Verify signature?
func (s *mdServerTlfStorage) getMDReadLocked(id MdID) (
	*RootMetadataSigned, error) {
	// Read file.

	path := s.mdPath(id)
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var rmds RootMetadataSigned
	err = s.codec.Decode(data, &rmds)
	if err != nil {
		return nil, err
	}

	// Check integrity.

	mdID, err := s.crypto.MakeMdID(&rmds.MD)
	if err != nil {
		return nil, err
	}

	if id != mdID {
		return nil, fmt.Errorf(
			"Metadata ID mismatch: expected %s, got %s", id, mdID)
	}

	fileInfo, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	rmds.untrustedServerTimestamp = fileInfo.ModTime()

	return &rmds, nil
}

func (s *mdServerTlfStorage) putMDLocked(rmds *RootMetadataSigned) (MdID, error) {
	id, err := s.crypto.MakeMdID(&rmds.MD)
	if err != nil {
		return MdID{}, err
	}

	_, err = s.getMDReadLocked(id)
	if os.IsNotExist(err) {
		// Continue on.
	} else if err != nil {
		return MdID{}, err
	} else {
		// Entry exists, so nothing else to do.
		return id, nil
	}

	path := s.mdPath(id)

	err = os.MkdirAll(filepath.Dir(path), 0700)
	if err != nil {
		return MdID{}, err
	}

	buf, err := s.codec.Encode(rmds)
	if err != nil {
		return MdID{}, err
	}

	err = ioutil.WriteFile(path, buf, 0600)
	if err != nil {
		return MdID{}, err
	}

	return id, nil
}

func (s *mdServerTlfStorage) getOrCreateBranchJournalLocked(
	bid BranchID) (mdIDJournal, error) {
	j, ok := s.branchJournals[bid]
	if ok {
		return j, nil
	}

	dir := filepath.Join(s.branchJournalsPath(), bid.String())
	err := os.MkdirAll(dir, 0700)
	if err != nil {
		return mdIDJournal{}, err
	}

	j = makeMdIDJournal(s.codec, dir)
	s.branchJournals[bid] = j
	return j, nil
}

func (s *mdServerTlfStorage) getHeadForTLFReadLocked(bid BranchID) (
	rmds *RootMetadataSigned, err error) {
	j, ok := s.branchJournals[bid]
	if !ok {
		return nil, nil
	}
	headID, err := j.getLatest()
	if err != nil {
		return nil, err
	}
	if headID == (MdID{}) {
		return nil, nil
	}
	return s.getMDReadLocked(headID)
}

func (s *mdServerTlfStorage) checkGetParamsReadLocked(
	currentUID keybase1.UID, bid BranchID) error {
	mergedMasterHead, err := s.getHeadForTLFReadLocked(NullBranchID)
	if err != nil {
		return MDServerError{err}
	}

	if mergedMasterHead != nil {
		ok, err := isReader(currentUID, &mergedMasterHead.MD)
		if err != nil {
			return MDServerError{err}
		}
		if !ok {
			return MDServerErrorUnauthorized{}
		}
	}

	return nil
}

func (s *mdServerTlfStorage) getRangeReadLocked(
	currentUID keybase1.UID, bid BranchID, start, stop MetadataRevision) (
	[]*RootMetadataSigned, error) {
	err := s.checkGetParamsReadLocked(currentUID, bid)
	if err != nil {
		return nil, err
	}

	j, ok := s.branchJournals[bid]
	if !ok {
		return nil, nil
	}

	realStart, mdIDs, err := j.getRange(start, stop)
	if err != nil {
		return nil, err
	}
	var rmdses []*RootMetadataSigned
	for i, mdID := range mdIDs {
		expectedRevision := realStart + MetadataRevision(i)
		rmds, err := s.getMDReadLocked(mdID)
		if err != nil {
			return nil, MDServerError{err}
		}
		if expectedRevision != rmds.MD.Revision {
			panic(fmt.Errorf("expected revision %v, got %v",
				expectedRevision, rmds.MD.Revision))
		}
		rmdses = append(rmdses, rmds)
	}

	return rmdses, nil
}

func (s *mdServerTlfStorage) isShutdownReadLocked() bool {
	return s.branchJournals == nil
}

// All functions below are public functions.

var errMDServerTlfStorageShutdown = errors.New("mdServerTlfStorage is shutdown")

func (s *mdServerTlfStorage) journalLength(bid BranchID) (uint64, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	if s.isShutdownReadLocked() {
		return 0, errMDServerTlfStorageShutdown
	}

	j, ok := s.branchJournals[bid]
	if !ok {
		return 0, nil
	}

	return j.length()
}

func (s *mdServerTlfStorage) getForTLF(
	currentUID keybase1.UID, bid BranchID) (*RootMetadataSigned, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	if s.isShutdownReadLocked() {
		return nil, errMDServerTlfStorageShutdown
	}

	err := s.checkGetParamsReadLocked(currentUID, bid)
	if err != nil {
		return nil, err
	}

	rmds, err := s.getHeadForTLFReadLocked(bid)
	if err != nil {
		return nil, MDServerError{err}
	}
	return rmds, nil
}

func (s *mdServerTlfStorage) getRange(
	currentUID keybase1.UID, bid BranchID, start, stop MetadataRevision) (
	[]*RootMetadataSigned, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	if s.isShutdownReadLocked() {
		return nil, errMDServerTlfStorageShutdown
	}

	return s.getRangeReadLocked(currentUID, bid, start, stop)
}

func (s *mdServerTlfStorage) put(
	currentUID keybase1.UID, currentVerifyingKey VerifyingKey,
	rmds *RootMetadataSigned) (
	recordBranchID bool, err error) {
	s.lock.Lock()
	defer s.lock.Unlock()

	if s.isShutdownReadLocked() {
		return false, errMDServerTlfStorageShutdown
	}

	err = rmds.IsValidAndSigned(
		s.codec, s.crypto, currentUID, currentVerifyingKey)
	if err != nil {
		return false, MDServerErrorBadRequest{Reason: err.Error()}
	}

	// Check permissions

	mergedMasterHead, err := s.getHeadForTLFReadLocked(NullBranchID)
	if err != nil {
		return false, MDServerError{err}
	}

	// TODO: Figure out nil case.
	if mergedMasterHead != nil {
		ok, err := isWriterOrValidRekey(
			s.codec, currentUID, &mergedMasterHead.MD, &rmds.MD)
		if err != nil {
			return false, MDServerError{err}
		}
		if !ok {
			return false, MDServerErrorUnauthorized{}
		}
	}

	bid := rmds.MD.BID
	mStatus := rmds.MD.MergedStatus()

	head, err := s.getHeadForTLFReadLocked(bid)
	if err != nil {
		return false, MDServerError{err}
	}

	if mStatus == Unmerged && head == nil {
		// currHead for unmerged history might be on the main branch
		prevRev := rmds.MD.Revision - 1
		rmdses, err := s.getRangeReadLocked(
			currentUID, NullBranchID, prevRev, prevRev)
		if err != nil {
			return false, MDServerError{err}
		}
		if len(rmdses) != 1 {
			return false, MDServerError{
				Err: fmt.Errorf("Expected 1 MD block got %d", len(rmdses)),
			}
		}
		head = rmdses[0]
		recordBranchID = true
	}

	// Consistency checks
	if head != nil {
		headID, err := s.crypto.MakeMdID(&head.MD)
		if err != nil {
			return false, MDServerError{err}
		}

		err = head.MD.CheckValidSuccessorForServer(headID, &rmds.MD)
		if err != nil {
			return false, err
		}
	}

	id, err := s.putMDLocked(rmds)
	if err != nil {
		return false, MDServerError{err}
	}

	j, err := s.getOrCreateBranchJournalLocked(bid)
	if err != nil {
		return false, err
	}

	err = j.append(rmds.MD.Revision, id)
	if err != nil {
		return false, MDServerError{err}
	}

	return recordBranchID, nil
}

func (s *mdServerTlfStorage) shutdown() {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.branchJournals = nil
}
