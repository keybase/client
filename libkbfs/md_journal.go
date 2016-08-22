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
	"time"

	"github.com/keybase/client/go/logger"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
)

// ImmutableBareRootMetadata is a thin wrapper around a
// BareRootMetadata that takes ownership of it and does not ever
// modify it again. Thus, its MdID can be calculated and
// stored along with a local timestamp. ImmutableBareRootMetadata
// objects can be assumed to never alias a (modifiable) BareRootMetadata.
//
// TODO: Move this to bare_root_metadata.go if it's used in more
// places.
type ImmutableBareRootMetadata struct {
	BareRootMetadata
	mdID           MdID
	localTimestamp time.Time
}

// MakeImmutableBareRootMetadata makes a new ImmutableBareRootMetadata
// from the given BareRootMetadata and its corresponding MdID.
func MakeImmutableBareRootMetadata(
	rmd BareRootMetadata, mdID MdID,
	localTimestamp time.Time) ImmutableBareRootMetadata {
	if mdID == (MdID{}) {
		panic("zero mdID passed to MakeImmutableBareRootMetadata")
	}
	return ImmutableBareRootMetadata{rmd, mdID, localTimestamp}
}

// mdJournal stores a single ordered list of metadata IDs for
// a single TLF, along with the associated metadata objects, in flat
// files on disk.
//
// The directory layout looks like:
//
// dir/md_journal/EARLIEST
// dir/md_journal/LATEST
// dir/md_journal/0...001
// dir/md_journal/0...002
// dir/md_journal/0...fff
// dir/mds/0100/0...01
// ...
// dir/mds/01ff/f...ff
//
// There's a single journal subdirectory; the journal ordinals are
// just MetadataRevisions, and the journal entries are just MdIDs.
//
// The Metadata objects are stored separately in dir/mds. Each block
// has its own subdirectory with its ID as a name. The MD
// subdirectories are splayed over (# of possible hash types) * 256
// subdirectories -- one byte for the hash type (currently only one)
// plus the first byte of the hash data -- using the first four
// characters of the name to keep the number of directories in dir
// itself to a manageable number, similar to git.
//
// mdJournal is not goroutine-safe, so any code that uses it must
// guarantee that only one goroutine at a time calls its functions.
type mdJournal struct {
	codec  Codec
	crypto cryptoPure
	dir    string

	log      logger.Logger
	deferLog logger.Logger

	j mdIDJournal

	// This doesn't need to be persisted, even if the journal
	// becomes empty, since on a restart the branch ID is
	// retrieved from the server (via GetUnmergedForTLF).
	branchID BranchID

	// Set only when the journal becomes empty due to
	// flushing. This doesn't need to be persisted for the same
	// reason as branchID.
	lastMdID MdID
}

func makeMDJournal(currentUID keybase1.UID, currentVerifyingKey VerifyingKey,
	codec Codec, crypto cryptoPure, dir string,
	log logger.Logger) (*mdJournal, error) {
	journalDir := filepath.Join(dir, "md_journal")

	deferLog := log.CloneWithAddedDepth(1)
	journal := mdJournal{
		codec:    codec,
		crypto:   crypto,
		dir:      dir,
		log:      log,
		deferLog: deferLog,
		j:        makeMdIDJournal(codec, journalDir),
	}

	earliest, err := journal.getEarliest(currentUID, currentVerifyingKey)
	if err != nil {
		return nil, err
	}

	latest, err := journal.getLatest(currentUID, currentVerifyingKey)
	if err != nil {
		return nil, err
	}

	if (earliest == ImmutableBareRootMetadata{}) !=
		(latest == ImmutableBareRootMetadata{}) {
		return nil, fmt.Errorf("has earliest=%t != has latest=%t",
			earliest != ImmutableBareRootMetadata{},
			latest != ImmutableBareRootMetadata{})
	}

	if earliest != (ImmutableBareRootMetadata{}) {
		if earliest.BID() != latest.BID() {
			return nil, fmt.Errorf(
				"earliest.BID=%s != latest.BID=%s",
				earliest.BID(), latest.BID())
		}
		journal.branchID = earliest.BID()
	}

	return &journal, nil
}

// The functions below are for building various paths.

func (j mdJournal) mdsPath() string {
	return filepath.Join(j.dir, "mds")
}

func (j mdJournal) mdPath(id MdID) string {
	idStr := id.String()
	return filepath.Join(j.mdsPath(), idStr[:4], idStr[4:])
}

// getMD verifies the MD data and the writer signature (but not the
// key) for the given ID and returns it. It also returns the
// last-modified timestamp of the file.
func (j mdJournal) getMD(currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey, id MdID) (
	BareRootMetadata, time.Time, error) {
	// Read file.

	path := j.mdPath(id)
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, time.Time{}, err
	}

	// TODO: the file needs to encode the version
	var rmd BareRootMetadataV2
	err = j.codec.Decode(data, &rmd)
	if err != nil {
		return nil, time.Time{}, err
	}

	// Check integrity.

	// TODO: MakeMdID serializes rmd -- use data instead.
	mdID, err := j.crypto.MakeMdID(&rmd)
	if err != nil {
		return nil, time.Time{}, err
	}

	if mdID != id {
		return nil, time.Time{}, fmt.Errorf(
			"Metadata ID mismatch: expected %s, got %s", id, mdID)
	}

	err = rmd.IsLastModifiedBy(currentUID, currentVerifyingKey)
	if err != nil {
		return nil, time.Time{}, err
	}

	err = rmd.IsValidAndSigned(j.codec, j.crypto)
	if err != nil {
		return nil, time.Time{}, err
	}

	if rmd.BID() != j.branchID {
		return nil, time.Time{}, fmt.Errorf(
			"Branch ID mismatch: expected %s, got %s",
			j.branchID, rmd.BID())
	}

	fi, err := os.Stat(path)
	if err != nil {
		return nil, time.Time{}, err
	}

	return &rmd, fi.ModTime(), nil
}

// putMD stores the given metadata under its ID, if it's not already
// stored.
func (j mdJournal) putMD(
	currentUID keybase1.UID, currentVerifyingKey VerifyingKey,
	rmd BareRootMetadata) (MdID, error) {
	err := rmd.IsValidAndSigned(j.codec, j.crypto)
	if err != nil {
		return MdID{}, err
	}

	err = rmd.IsLastModifiedBy(currentUID, currentVerifyingKey)
	if err != nil {
		return MdID{}, err
	}

	id, err := j.crypto.MakeMdID(rmd)
	if err != nil {
		return MdID{}, err
	}

	_, _, err = j.getMD(currentUID, currentVerifyingKey, id)
	if os.IsNotExist(err) {
		// Continue on.
	} else if err != nil {
		return MdID{}, err
	} else {
		// Entry exists, so nothing else to do.
		return MdID{}, nil
	}

	path := j.mdPath(id)

	err = os.MkdirAll(filepath.Dir(path), 0700)
	if err != nil {
		return MdID{}, err
	}

	buf, err := j.codec.Encode(rmd)
	if err != nil {
		return MdID{}, err
	}

	err = ioutil.WriteFile(path, buf, 0600)
	if err != nil {
		return MdID{}, err
	}

	return id, nil
}

func (j mdJournal) getEarliest(currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey) (ImmutableBareRootMetadata, error) {
	earliestID, err := j.j.getEarliest()
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	if earliestID == (MdID{}) {
		return ImmutableBareRootMetadata{}, nil
	}
	earliest, ts, err := j.getMD(
		currentUID, currentVerifyingKey, earliestID)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	return MakeImmutableBareRootMetadata(earliest, earliestID, ts), nil
}

func (j mdJournal) getLatest(currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey) (ImmutableBareRootMetadata, error) {
	latestID, err := j.j.getLatest()
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	if latestID == (MdID{}) {
		return ImmutableBareRootMetadata{}, nil
	}
	latest, ts, err := j.getMD(
		currentUID, currentVerifyingKey, latestID)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	return MakeImmutableBareRootMetadata(latest, latestID, ts), nil
}

func (j mdJournal) checkGetParams(currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey) (ImmutableBareRootMetadata, error) {
	head, err := j.getLatest(currentUID, currentVerifyingKey)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	if head != (ImmutableBareRootMetadata{}) {
		ok, err := isReader(currentUID, head.BareRootMetadata)
		if err != nil {
			return ImmutableBareRootMetadata{}, err
		}
		if !ok {
			// TODO: Use a non-server error.
			return ImmutableBareRootMetadata{},
				MDServerErrorUnauthorized{}
		}
	}

	return head, nil
}

func (j *mdJournal) convertToBranch(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey, signer cryptoSigner) (err error) {
	if j.branchID != NullBranchID {
		return fmt.Errorf(
			"convertToBranch called with BID=%s", j.branchID)
	}

	earliestRevision, err := j.j.readEarliestRevision()
	if err != nil {
		return err
	}

	latestRevision, err := j.j.readLatestRevision()
	if err != nil {
		return err
	}

	j.log.CDebugf(
		ctx, "rewriting MDs %s to %s", earliestRevision, latestRevision)

	_, allMdIDs, err := j.j.getRange(earliestRevision, latestRevision)
	if err != nil {
		return err
	}

	bid, err := j.crypto.MakeRandomBranchID()
	if err != nil {
		return err
	}

	j.log.CDebugf(ctx, "New branch ID=%s", bid)

	journalTempDirName, err := ioutil.TempDir(j.dir, "md_journal")
	if err != nil {
		return err
	}
	journalTempDir := filepath.Join(j.dir, journalTempDirName)
	j.log.CDebugf(ctx, "Using temp dir %s for rewriting", journalTempDir)
	defer func() {
		if err != nil {
			j.log.CDebugf(ctx, "Removing temp dir %s", journalTempDir)
			removeErr := os.RemoveAll(journalTempDir)
			if removeErr != nil {
				j.log.CWarningf(ctx,
					"Error when removing temp dir %s: %v", journalTempDir, removeErr)
			}
		}
	}()

	tempJournal := makeMdIDJournal(j.codec, journalTempDir)

	var prevID MdID

	for i, id := range allMdIDs {
		ibrmd, _, err := j.getMD(currentUID, currentVerifyingKey, id)
		if err != nil {
			return err
		}
		brmd, ok := ibrmd.(MutableBareRootMetadata)
		if !ok {
			return MutableBareRootMetadataNoImplError{}
		}
		brmd.SetUnmerged()
		brmd.SetBranchID(bid)

		// Re-sign the writer metadata.
		buf, err := brmd.GetSerializedWriterMetadata(j.codec)
		if err != nil {
			return err
		}

		sigInfo, err := signer.Sign(ctx, buf)
		if err != nil {
			return err
		}
		brmd.SetWriterMetadataSigInfo(sigInfo)

		j.log.CDebugf(ctx, "Old prev root of rev=%s is %s",
			brmd.RevisionNumber(), brmd.GetPrevRoot())

		if i > 0 {
			j.log.CDebugf(ctx, "Changing prev root of rev=%s to %s",
				brmd.RevisionNumber(), prevID)
			brmd.SetPrevRoot(prevID)
		}

		// TODO: this rewrites the file, and so the modification time
		// no longer tracks when exactly the original operation is
		// done, so future ImmutableBareMetadatas for this MD will
		// have a slightly wrong localTimestamp.  Instead, we might
		// want to pass in the timestamp and do an explicit
		// os.Chtimes() on the file after writing it.
		newID, err := j.putMD(currentUID, currentVerifyingKey, brmd)
		if err != nil {
			return err
		}

		err = tempJournal.append(brmd.RevisionNumber(), newID)
		if err != nil {
			return err
		}

		prevID = newID

		j.log.CDebugf(ctx, "Changing ID for rev=%s from %s to %s",
			brmd.RevisionNumber(), id, newID)
	}

	// TODO: Do the below atomically on the filesystem
	// level. Specifically, make "md_journal" always be a symlink,
	// and then perform the swap by atomically changing the
	// symlink to point to the new journal directory.

	oldDir, err := j.j.move(journalTempDir + ".old")
	if err != nil {
		return err
	}

	_, err = tempJournal.move(oldDir)
	if err != nil {
		return err
	}

	j.j = tempJournal
	j.branchID = bid

	return err
}

func (j mdJournal) pushEarliestToServer(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey, signer cryptoSigner,
	mdserver MDServer) (ImmutableBareRootMetadata, error) {
	rmd, err := j.getEarliest(currentUID, currentVerifyingKey)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	if rmd == (ImmutableBareRootMetadata{}) {
		return ImmutableBareRootMetadata{}, nil
	}

	j.log.CDebugf(ctx, "Flushing MD for TLF=%s with id=%s, rev=%s, bid=%s",
		rmd.TlfID(), rmd.mdID, rmd.RevisionNumber(), rmd.BID)

	mbrmd, ok := rmd.BareRootMetadata.(MutableBareRootMetadata)
	if !ok {
		return ImmutableBareRootMetadata{}, MutableBareRootMetadataNoImplError{}
	}

	rmds := RootMetadataSigned{MD: mbrmd}
	err = signMD(ctx, j.codec, signer, &rmds)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	err = mdserver.Put(ctx, &rmds)
	if err != nil {
		// Still return the RMD so that it can be consulted.
		return rmd, err
	}

	return rmd, nil
}

func getMdID(ctx context.Context, mdserver MDServer, crypto cryptoPure,
	tlfID TlfID, bid BranchID, mStatus MergeStatus,
	revision MetadataRevision) (MdID, error) {
	rmdses, err := mdserver.GetRange(
		ctx, tlfID, bid, mStatus, revision, revision)
	if err != nil {
		return MdID{}, err
	} else if len(rmdses) == 0 {
		return MdID{}, nil
	} else if len(rmdses) > 1 {
		return MdID{}, fmt.Errorf(
			"Got more than one object when trying to get rev=%d for branch %s of TLF %s",
			revision, bid, tlfID)
	}

	return crypto.MakeMdID(rmdses[0].MD)
}

// All functions below are public functions.

func (j mdJournal) readEarliestRevision() (MetadataRevision, error) {
	return j.j.readEarliestRevision()
}

func (j mdJournal) readLatestRevision() (MetadataRevision, error) {
	return j.j.readLatestRevision()
}

func (j mdJournal) length() (uint64, error) {
	return j.j.length()
}

func (j mdJournal) getHead(
	currentUID keybase1.UID, currentVerifyingKey VerifyingKey) (
	ImmutableBareRootMetadata, error) {
	return j.checkGetParams(currentUID, currentVerifyingKey)
}

func (j mdJournal) getRange(
	currentUID keybase1.UID, currentVerifyingKey VerifyingKey,
	start, stop MetadataRevision) (
	[]ImmutableBareRootMetadata, error) {
	_, err := j.checkGetParams(currentUID, currentVerifyingKey)
	if err != nil {
		return nil, err
	}

	realStart, mdIDs, err := j.j.getRange(start, stop)
	if err != nil {
		return nil, err
	}
	var rmds []ImmutableBareRootMetadata
	for i, mdID := range mdIDs {
		expectedRevision := realStart + MetadataRevision(i)
		rmd, ts, err := j.getMD(currentUID, currentVerifyingKey, mdID)
		if err != nil {
			return nil, err
		}
		if expectedRevision != rmd.RevisionNumber() {
			panic(fmt.Errorf("expected revision %v, got %v",
				expectedRevision, rmd.RevisionNumber()))
		}
		irmd := MakeImmutableBareRootMetadata(rmd, mdID, ts)
		rmds = append(rmds, irmd)
	}

	return rmds, nil
}

// MDJournalConflictError is an error that is returned when a put
// detects a rewritten journal.
type MDJournalConflictError struct{}

func (e MDJournalConflictError) Error() string {
	return "MD journal conflict error"
}

// put verifies and stores the given RootMetadata in the journal,
// modifying it as needed. In particular, if this is an unmerged
// RootMetadata but the branch ID isn't set, it will be set to the
// journal's branch ID, which is assumed to be non-zero. As a special
// case, if the revision of the given RootMetadata matches that of the
// head, the given RootMetadata will replace the head.
func (j *mdJournal) put(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey, signer cryptoSigner,
	ekg encryptionKeyGetter, bsplit BlockSplitter, rmd *RootMetadata) (
	mdID MdID, err error) {
	j.log.CDebugf(ctx, "Putting MD for TLF=%s with rev=%s bid=%s",
		rmd.TlfID(), rmd.Revision(), rmd.BID())
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Put MD for TLF=%s with rev=%s bid=%s failed with %v",
				rmd.TlfID(), rmd.Revision(), rmd.BID(), err)
		}
	}()

	head, err := j.getLatest(currentUID, currentVerifyingKey)
	if err != nil {
		return MdID{}, err
	}

	var lastMdID MdID
	var lastBranchID BranchID
	if head == (ImmutableBareRootMetadata{}) {
		lastMdID = j.lastMdID
		lastBranchID = j.branchID
	} else {
		lastMdID = head.mdID
		lastBranchID = head.BID()
	}

	mStatus := rmd.MergedStatus()

	if (mStatus == Unmerged) && (rmd.BID() == NullBranchID) {
		j.log.CDebugf(
			ctx, "Changing branch ID to %s and prev root to %s for MD for TLF=%s with rev=%s",
			lastBranchID, lastMdID, rmd.TlfID(), rmd.Revision(), rmd.BID())
		rmd.SetBranchID(lastBranchID)
		rmd.SetPrevRoot(lastMdID)
	}

	if (mStatus == Merged) != (rmd.BID() == NullBranchID) {
		return MdID{}, errors.New("Invalid branch ID")
	}

	// If we're trying to push a merged MD onto a branch, return a
	// conflict error so the caller can retry with an unmerged MD.
	if mStatus == Merged && lastBranchID != NullBranchID {
		return MdID{}, MDJournalConflictError{}
	}

	if rmd.BID() != j.branchID {
		return MdID{}, fmt.Errorf(
			"Branch ID mismatch: expected %s, got %s",
			j.branchID, rmd.BID())
	}

	// Check permissions and consistency with head, if it exists.
	if head != (ImmutableBareRootMetadata{}) {
		ok, err := isWriterOrValidRekey(
			j.codec, currentUID, head.BareRootMetadata, rmd.bareMd)
		if err != nil {
			return MdID{}, err
		}
		if !ok {
			// TODO: Use a non-server error.
			return MdID{}, MDServerErrorUnauthorized{}
		}

		// Consistency checks
		if rmd.Revision() != head.RevisionNumber() {
			err = head.CheckValidSuccessorForServer(head.mdID, rmd.bareMd)
			if err != nil {
				return MdID{}, err
			}
		}
	}

	// Ensure that the block changes are properly unembedded.
	if rmd.data.Changes.Info.BlockPointer == zeroPtr &&
		!bsplit.ShouldEmbedBlockChanges(&rmd.data.Changes) {
		return MdID{},
			errors.New("MD has embedded block changes, but shouldn't")
	}

	brmd, err := encryptMDPrivateData(
		ctx, j.codec, j.crypto, signer, ekg,
		currentUID, rmd.ReadOnly())
	if err != nil {
		return MdID{}, err
	}

	id, err := j.putMD(currentUID, currentVerifyingKey, brmd)
	if err != nil {
		return MdID{}, err
	}

	if head != (ImmutableBareRootMetadata{}) &&
		rmd.Revision() == head.RevisionNumber() {
		j.log.CDebugf(
			ctx, "Replacing head MD for TLF=%s with rev=%s bid=%s",
			rmd.TlfID(), rmd.Revision(), rmd.BID())
		err = j.j.replaceHead(id)
		if err != nil {
			return MdID{}, err
		}
	} else {
		err = j.j.append(brmd.RevisionNumber(), id)
		if err != nil {
			return MdID{}, err
		}
	}

	// Since the journal is now non-empty, clear lastMdID.
	j.lastMdID = MdID{}

	return id, nil
}

// flushOne sends the earliest MD in the journal to the given MDServer
// if one exists, and then removes it. Returns whether there was an MD
// that was put.
func (j *mdJournal) flushOne(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey, signer cryptoSigner,
	mdserver MDServer) (flushed bool, err error) {
	j.log.CDebugf(ctx, "Flushing one MD to server")
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx, "Flush failed with %v", err)
		}
	}()

	rmd, pushErr := j.pushEarliestToServer(
		ctx, currentUID, currentVerifyingKey, signer, mdserver)
	if isRevisionConflict(pushErr) {
		mdID, err := getMdID(
			ctx, mdserver, j.crypto, rmd.TlfID(), rmd.BID(),
			rmd.MergedStatus(), rmd.RevisionNumber())
		if err != nil {
			j.log.CWarningf(ctx,
				"getMdID failed for TLF %s, BID %s, and revision %d: %v",
				rmd.TlfID(), rmd.BID(), rmd.RevisionNumber(), err)
		} else if mdID == rmd.mdID {
			if rmd.mdID == (MdID{}) {
				panic("nil earliestID and revision conflict error returned by pushEarliestToServer")
			}
			// We must have already flushed this MD, so continue.
			pushErr = nil
		} else if rmd.MergedStatus() == Merged {
			j.log.CDebugf(ctx, "Conflict detected %v", pushErr)

			err := j.convertToBranch(
				ctx, currentUID, currentVerifyingKey, signer)
			if err != nil {
				return false, err
			}

			rmd, pushErr = j.pushEarliestToServer(
				ctx, currentUID, currentVerifyingKey,
				signer, mdserver)
		}
	}
	if pushErr != nil {
		return false, pushErr
	}
	if rmd.mdID == (MdID{}) {
		return false, nil
	}

	empty, err := j.j.removeEarliest()
	if err != nil {
		return false, err
	}

	// Since the journal is now empty, set lastMdID.
	if empty {
		j.log.CDebugf(ctx,
			"Journal is now empty; saving last MdID=%s", rmd.mdID)
		j.lastMdID = rmd.mdID
	}

	return true, nil
}

func (j *mdJournal) clear(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey, bid BranchID) (err error) {
	j.log.CDebugf(ctx, "Clearing journal for branch %s", bid)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Clearing journal for branch %s failed with %v",
				bid, err)
		}
	}()

	if bid == NullBranchID {
		return errors.New("Cannot clear master branch")
	}

	head, err := j.getHead(currentUID, currentVerifyingKey)
	if err != nil {
		return err
	}

	if head == (ImmutableBareRootMetadata{}) || head.BID() != bid {
		// Nothing to do.
		return nil
	}

	j.branchID = NullBranchID

	// No need to set lastMdID in this case.

	return j.j.clear()
}
