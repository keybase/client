// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
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
// dir/wkbv3/0100...01
// ...
// dir/wkbv3/0100...ff
// dir/rkbv3/0100...01
// ...
// dir/rkbv3/0100...ff
//
// Each branch has its own subdirectory with a journal; the journal
// ordinals are just Revisions, and the journal entries are
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
//
// Writer (reader) key bundles for V3 metadata objects are stored
// separately in dir/wkbv3 (dir/rkbv3). The number of bundles is
// small, so no need to splay them.
type mdServerTlfStorage struct {
	tlfID          tlf.ID
	codec          kbfscodec.Codec
	clock          Clock
	teamMemChecker kbfsmd.TeamMembershipChecker
	mdVer          kbfsmd.MetadataVer
	dir            string

	// Protects any IO operations in dir or any of its children,
	// as well as branchJournals and its contents.
	lock           sync.RWMutex
	branchJournals map[kbfsmd.BranchID]mdIDJournal
}

func makeMDServerTlfStorage(tlfID tlf.ID, codec kbfscodec.Codec,
	clock Clock, teamMemChecker kbfsmd.TeamMembershipChecker,
	mdVer kbfsmd.MetadataVer, dir string) *mdServerTlfStorage {
	journal := &mdServerTlfStorage{
		tlfID:          tlfID,
		codec:          codec,
		clock:          clock,
		teamMemChecker: teamMemChecker,
		mdVer:          mdVer,
		dir:            dir,
		branchJournals: make(map[kbfsmd.BranchID]mdIDJournal),
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

func (s *mdServerTlfStorage) writerKeyBundleV3Path(
	id kbfsmd.TLFWriterKeyBundleID) string {
	return filepath.Join(s.dir, "wkbv3", id.String())
}

func (s *mdServerTlfStorage) readerKeyBundleV3Path(
	id kbfsmd.TLFReaderKeyBundleID) string {
	return filepath.Join(s.dir, "rkbv3", id.String())
}

func (s *mdServerTlfStorage) mdPath(id kbfsmd.ID) string {
	idStr := id.String()
	return filepath.Join(s.mdsPath(), idStr[:4], idStr[4:])
}

// serializedRMDS is the structure stored in mdPath(id).
type serializedRMDS struct {
	EncodedRMDS []byte
	Timestamp   time.Time
	Version     kbfsmd.MetadataVer
}

// getMDReadLocked verifies the MD data (but not the signature) for
// the given ID and returns it.
//
// TODO: Verify signature?
func (s *mdServerTlfStorage) getMDReadLocked(id kbfsmd.ID) (
	*RootMetadataSigned, error) {
	// Read file.

	var srmds serializedRMDS
	err := kbfscodec.DeserializeFromFile(s.codec, s.mdPath(id), &srmds)
	if err != nil {
		return nil, err
	}

	rmds, err := DecodeRootMetadataSigned(
		s.codec, s.tlfID, srmds.Version, s.mdVer, srmds.EncodedRMDS,
		srmds.Timestamp)
	if err != nil {
		return nil, err
	}

	// Check integrity.

	mdID, err := kbfsmd.MakeID(s.codec, rmds.MD)
	if err != nil {
		return nil, err
	}

	if id != mdID {
		return nil, errors.Errorf(
			"Metadata ID mismatch: expected %s, got %s",
			id, mdID)
	}

	return rmds, nil
}

func (s *mdServerTlfStorage) putMDLocked(
	rmds *RootMetadataSigned) (kbfsmd.ID, error) {
	id, err := kbfsmd.MakeID(s.codec, rmds.MD)
	if err != nil {
		return kbfsmd.ID{}, err
	}

	_, err = s.getMDReadLocked(id)
	switch {
	case ioutil.IsNotExist(err):
		// Continue on.
	case err != nil:
		return kbfsmd.ID{}, err
	default:
		// Entry exists, so nothing else to do.
		return id, nil
	}

	encodedRMDS, err := kbfsmd.EncodeRootMetadataSigned(s.codec, &rmds.RootMetadataSigned)
	if err != nil {
		return kbfsmd.ID{}, err
	}

	srmds := serializedRMDS{
		EncodedRMDS: encodedRMDS,
		// Pretend the timestamp went over RPC, so we get the same
		// resolution level as a real server.
		Timestamp: keybase1.FromTime(keybase1.ToTime(s.clock.Now())),
		Version:   rmds.MD.Version(),
	}

	err = kbfscodec.SerializeToFileIfNotExist(s.codec, srmds, s.mdPath(id))
	if err != nil {
		return kbfsmd.ID{}, err
	}

	return id, nil
}

func (s *mdServerTlfStorage) getOrCreateBranchJournalLocked(
	bid kbfsmd.BranchID) (mdIDJournal, error) {
	j, ok := s.branchJournals[bid]
	if ok {
		return j, nil
	}

	dir := filepath.Join(s.branchJournalsPath(), bid.String())
	err := ioutil.MkdirAll(dir, 0700)
	if err != nil {
		return mdIDJournal{}, err
	}

	j, err = makeMdIDJournal(s.codec, dir)
	if err != nil {
		return mdIDJournal{}, err
	}
	s.branchJournals[bid] = j
	return j, nil
}

func (s *mdServerTlfStorage) getHeadForTLFReadLocked(bid kbfsmd.BranchID) (
	rmds *RootMetadataSigned, err error) {
	j, err := s.getOrCreateBranchJournalLocked(bid)
	if err != nil {
		return nil, err
	}
	entry, exists, err := j.getLatestEntry()
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, nil
	}
	return s.getMDReadLocked(entry.ID)
}

func (s *mdServerTlfStorage) checkGetParamsReadLocked(
	ctx context.Context, currentUID keybase1.UID, bid kbfsmd.BranchID) error {
	mergedMasterHead, err := s.getHeadForTLFReadLocked(kbfsmd.NullBranchID)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	if mergedMasterHead != nil {
		extra, err := getExtraMetadata(
			s.getKeyBundlesReadLocked, mergedMasterHead.MD)
		if err != nil {
			return kbfsmd.ServerError{Err: err}
		}
		ok, err := isReader(
			ctx, s.teamMemChecker, currentUID, mergedMasterHead.MD, extra)
		if err != nil {
			return kbfsmd.ServerError{Err: err}
		}
		if !ok {
			return kbfsmd.ServerErrorUnauthorized{}
		}
	}

	return nil
}

func (s *mdServerTlfStorage) getRangeReadLocked(
	ctx context.Context, currentUID keybase1.UID, bid kbfsmd.BranchID,
	start, stop kbfsmd.Revision) (
	[]*RootMetadataSigned, error) {
	err := s.checkGetParamsReadLocked(ctx, currentUID, bid)
	if err != nil {
		return nil, err
	}

	j, ok := s.branchJournals[bid]
	if !ok {
		return nil, nil
	}

	realStart, entries, err := j.getEntryRange(start, stop)
	if err != nil {
		return nil, err
	}
	var rmdses []*RootMetadataSigned
	for i, entry := range entries {
		expectedRevision := realStart + kbfsmd.Revision(i)
		rmds, err := s.getMDReadLocked(entry.ID)
		if err != nil {
			return nil, kbfsmd.ServerError{Err: err}
		}
		if expectedRevision != rmds.MD.RevisionNumber() {
			panic(errors.Errorf("expected revision %v, got %v",
				expectedRevision, rmds.MD.RevisionNumber()))
		}
		rmdses = append(rmdses, rmds)
	}

	return rmdses, nil
}

func (s *mdServerTlfStorage) putExtraMetadataLocked(rmds *RootMetadataSigned,
	extra kbfsmd.ExtraMetadata) error {
	if extra == nil {
		return nil
	}

	extraV3, ok := extra.(*kbfsmd.ExtraMetadataV3)
	if !ok {
		return errors.New("Invalid extra metadata")
	}

	if extraV3.IsWriterKeyBundleNew() {
		wkbID := rmds.MD.GetTLFWriterKeyBundleID()
		if wkbID == (kbfsmd.TLFWriterKeyBundleID{}) {
			panic("writer key bundle ID is empty")
		}
		err := kbfscodec.SerializeToFileIfNotExist(
			s.codec, extraV3.GetWriterKeyBundle(), s.writerKeyBundleV3Path(wkbID))
		if err != nil {
			return err
		}
	}

	if extraV3.IsReaderKeyBundleNew() {
		rkbID := rmds.MD.GetTLFReaderKeyBundleID()
		if rkbID == (kbfsmd.TLFReaderKeyBundleID{}) {
			panic("reader key bundle ID is empty")
		}
		err := kbfscodec.SerializeToFileIfNotExist(
			s.codec, extraV3.GetReaderKeyBundle(), s.readerKeyBundleV3Path(rkbID))
		if err != nil {
			return err
		}
	}
	return nil
}

type errMDServerTlfStorageShutdown struct{}

func (e errMDServerTlfStorageShutdown) Error() string {
	return "mdServerTlfStorage is shutdown"
}

func (s *mdServerTlfStorage) checkShutdownReadLocked() error {
	if s.branchJournals == nil {
		return errors.WithStack(errMDServerTlfStorageShutdown{})
	}
	return nil
}

// All functions below are public functions.

func (s *mdServerTlfStorage) journalLength(bid kbfsmd.BranchID) (uint64, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	err := s.checkShutdownReadLocked()
	if err != nil {
		return 0, err
	}

	j, ok := s.branchJournals[bid]
	if !ok {
		return 0, nil
	}

	return j.length(), nil
}

func (s *mdServerTlfStorage) getForTLF(
	ctx context.Context, currentUID keybase1.UID, bid kbfsmd.BranchID) (
	*RootMetadataSigned, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	err := s.checkShutdownReadLocked()
	if err != nil {
		return nil, err
	}

	err = s.checkGetParamsReadLocked(ctx, currentUID, bid)
	if err != nil {
		return nil, err
	}

	rmds, err := s.getHeadForTLFReadLocked(bid)
	if err != nil {
		return nil, kbfsmd.ServerError{Err: err}
	}
	return rmds, nil
}

func (s *mdServerTlfStorage) getRange(
	ctx context.Context, currentUID keybase1.UID, bid kbfsmd.BranchID,
	start, stop kbfsmd.Revision) (
	[]*RootMetadataSigned, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	err := s.checkShutdownReadLocked()
	if err != nil {
		return nil, err
	}

	return s.getRangeReadLocked(ctx, currentUID, bid, start, stop)
}

func (s *mdServerTlfStorage) put(ctx context.Context,
	currentUID keybase1.UID, currentVerifyingKey kbfscrypto.VerifyingKey,
	rmds *RootMetadataSigned, extra kbfsmd.ExtraMetadata) (
	recordBranchID bool, err error) {
	s.lock.Lock()
	defer s.lock.Unlock()
	err = s.checkShutdownReadLocked()
	if err != nil {
		return false, err
	}

	err = rmds.IsValidAndSigned(
		ctx, s.codec, s.teamMemChecker, extra,
		keybase1.OfflineAvailability_NONE)
	if err != nil {
		return false, kbfsmd.ServerErrorBadRequest{Reason: err.Error()}
	}

	err = rmds.IsLastModifiedBy(currentUID, currentVerifyingKey)
	if err != nil {
		return false, kbfsmd.ServerErrorBadRequest{Reason: err.Error()}
	}

	// Check permissions

	mergedMasterHead, err := s.getHeadForTLFReadLocked(kbfsmd.NullBranchID)
	if err != nil {
		return false, kbfsmd.ServerError{Err: err}
	}

	// TODO: Figure out nil case.
	if mergedMasterHead != nil {
		prevExtra, err := getExtraMetadata(
			s.getKeyBundlesReadLocked, mergedMasterHead.MD)
		if err != nil {
			return false, kbfsmd.ServerError{Err: err}
		}
		ok, err := isWriterOrValidRekey(
			ctx, s.teamMemChecker, s.codec, currentUID, currentVerifyingKey,
			mergedMasterHead.MD, rmds.MD,
			prevExtra, extra)
		if err != nil {
			return false, kbfsmd.ServerError{Err: err}
		}
		if !ok {
			return false, kbfsmd.ServerErrorUnauthorized{}
		}
	}

	bid := rmds.MD.BID()
	mStatus := rmds.MD.MergedStatus()

	head, err := s.getHeadForTLFReadLocked(bid)
	if err != nil {
		return false, kbfsmd.ServerError{Err: err}
	}

	if mStatus == kbfsmd.Unmerged && head == nil {
		// currHead for unmerged history might be on the main branch
		prevRev := rmds.MD.RevisionNumber() - 1
		rmdses, err := s.getRangeReadLocked(
			ctx, currentUID, kbfsmd.NullBranchID, prevRev, prevRev)
		if err != nil {
			return false, kbfsmd.ServerError{Err: err}
		}
		if len(rmdses) != 1 {
			return false, kbfsmd.ServerError{
				Err: errors.Errorf("Expected 1 MD block got %d", len(rmdses)),
			}
		}
		head = rmdses[0]
		recordBranchID = true
	}

	// Consistency checks
	if head != nil {
		headID, err := kbfsmd.MakeID(s.codec, head.MD)
		if err != nil {
			return false, kbfsmd.ServerError{Err: err}
		}

		err = head.MD.CheckValidSuccessorForServer(headID, rmds.MD)
		if err != nil {
			return false, err
		}
	}

	id, err := s.putMDLocked(rmds)
	if err != nil {
		return false, kbfsmd.ServerError{Err: err}
	}

	err = s.putExtraMetadataLocked(rmds, extra)
	if err != nil {
		return false, kbfsmd.ServerError{Err: err}
	}

	j, err := s.getOrCreateBranchJournalLocked(bid)
	if err != nil {
		return false, err
	}

	err = j.append(rmds.MD.RevisionNumber(), mdIDJournalEntry{ID: id})
	if err != nil {
		return false, kbfsmd.ServerError{Err: err}
	}

	return recordBranchID, nil
}

func (s *mdServerTlfStorage) getKeyBundlesReadLocked(tlfID tlf.ID,
	wkbID kbfsmd.TLFWriterKeyBundleID, rkbID kbfsmd.TLFReaderKeyBundleID) (
	*kbfsmd.TLFWriterKeyBundleV3, *kbfsmd.TLFReaderKeyBundleV3, error) {
	err := s.checkShutdownReadLocked()
	if err != nil {
		return nil, nil, err
	}

	var wkb *kbfsmd.TLFWriterKeyBundleV3
	if wkbID != (kbfsmd.TLFWriterKeyBundleID{}) {
		foundWKB, err := kbfsmd.DeserializeTLFWriterKeyBundleV3(
			s.codec, s.writerKeyBundleV3Path(wkbID))
		if err != nil {
			return nil, nil, err
		}

		err = kbfsmd.CheckWKBID(s.codec, wkbID, foundWKB)
		if err != nil {
			return nil, nil, err
		}
		wkb = &foundWKB
	}

	var rkb *kbfsmd.TLFReaderKeyBundleV3
	if rkbID != (kbfsmd.TLFReaderKeyBundleID{}) {
		foundRKB, err := kbfsmd.DeserializeTLFReaderKeyBundleV3(
			s.codec, s.readerKeyBundleV3Path(rkbID))
		if err != nil {
			return nil, nil, err
		}

		err = kbfsmd.CheckRKBID(s.codec, rkbID, foundRKB)
		if err != nil {
			return nil, nil, err
		}
		rkb = &foundRKB
	}

	return wkb, rkb, nil
}

func (s *mdServerTlfStorage) getKeyBundles(tlfID tlf.ID,
	wkbID kbfsmd.TLFWriterKeyBundleID, rkbID kbfsmd.TLFReaderKeyBundleID) (
	*kbfsmd.TLFWriterKeyBundleV3, *kbfsmd.TLFReaderKeyBundleV3, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.getKeyBundlesReadLocked(tlfID, wkbID, rkbID)

}

func (s *mdServerTlfStorage) shutdown() {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.branchJournals = nil
}
