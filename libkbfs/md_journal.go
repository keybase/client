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

	"github.com/keybase/client/go/protocol/keybase1"
)

// ImmutableBareRootMetadata is a thin wrapper around a
// BareRootMetadata that takes ownership of it and does not ever
// modify it again. Thus, its MdID can be calculated and
// stored along with a local timestamp. ImmutableBareRootMetadata
// objects can be assumed to never alias a (modifiable) BareRootMetadata.
//
// Note that crypto.MakeMdID() on an ImmutableBareRootMetadata will
// compute the wrong result, since anonymous fields of interface type
// are not encoded inline by the codec. Use
// crypto.MakeMDID(ibrmd.BareRootMetadata) instead.
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

// mdJournal stores a single ordered list of metadata IDs for a (TLF,
// user, device) tuple, along with the associated metadata objects, in
// flat files on disk.
//
// The directory layout looks like:
//
// dir/md_journal/EARLIEST
// dir/md_journal/LATEST
// dir/md_journal/0...001
// dir/md_journal/0...002
// dir/md_journal/0...fff
// dir/mds/0100/0...01/data
// ...
// dir/mds/01ff/f...ff/data
//
// There's a single journal subdirectory; the journal ordinals are
// just MetadataRevisions, and the journal entries are just MdIDs.
//
// The Metadata objects are stored separately in dir/mds. Each MD has
// its own subdirectory with its ID truncated to 17 bytes (34
// characters) as a name. The MD subdirectories are splayed over (# of
// possible hash types) * 256 subdirectories -- one byte for the hash
// type (currently only one) plus the first byte of the hash data --
// using the first four characters of the name to keep the number of
// directories in dir itself to a manageable number, similar to git.
// Each block directory has data, which is the raw MD data that should
// hash to the MD ID. Future versions of the journal might add more
// files to this directory; if any code is written to move MDs around,
// it should be careful to preserve any unknown files in an MD
// directory.
//
// The maximum number of characters added to the root dir by an MD
// journal is 45:
//
//   /mds/01ff/f...(30 characters total)...ff/data
//
// This covers even the temporary files created in convertToBranch,
// which create paths like
//
//   /md_journal123456789/0...(16 characters total)...001
//
// which have only 37 characters.
//
// mdJournal is not goroutine-safe, so any code that uses it must
// guarantee that only one goroutine at a time calls its functions.
type mdJournal struct {
	// key is assumed to be the VerifyingKey of a device owned by
	// uid, and both uid and key are assumed constant for the
	// lifetime of this object.
	uid keybase1.UID
	key VerifyingKey

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

func makeMDJournal(uid keybase1.UID, key VerifyingKey, codec Codec,
	crypto cryptoPure, dir string, log logger.Logger) (*mdJournal, error) {
	if uid == keybase1.UID("") {
		return nil, errors.New("Empty user")
	}
	if key == (VerifyingKey{}) {
		return nil, errors.New("Empty verifying key")
	}

	journalDir := filepath.Join(dir, "md_journal")

	deferLog := log.CloneWithAddedDepth(1)
	journal := mdJournal{
		uid:      uid,
		key:      key,
		codec:    codec,
		crypto:   crypto,
		dir:      dir,
		log:      log,
		deferLog: deferLog,
		j:        makeMdIDJournal(codec, journalDir),
	}

	earliest, err := journal.getEarliest(false)
	if err != nil {
		return nil, err
	}

	latest, err := journal.getLatest(false)
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
	// Truncate to 34 characters, which corresponds to 16 random
	// bytes (since the first byte is a hash type) or 128 random
	// bits, which means that the expected number of MDs generated
	// before getting a path collision is 2^64 (see
	// https://en.wikipedia.org/wiki/Birthday_problem#Cast_as_a_collision_problem
	// ). The full ID can be recovered just by hashing the data
	// again with the same hash type.
	idStr := id.String()
	return filepath.Join(j.mdsPath(), idStr[:4], idStr[4:34])
}

func (j mdJournal) mdDataPath(id MdID) string {
	return filepath.Join(j.mdPath(id), "data")
}

// getMD verifies the MD data and the writer signature (but not the
// key) for the given ID and returns it. It also returns the
// last-modified timestamp of the file. verifyBranchID should be false
// only when called from makeMDJournal, i.e. when figuring out what to
// set j.branchID in the first place.
func (j mdJournal) getMD(id MdID, verifyBranchID bool) (
	BareRootMetadata, time.Time, error) {
	// Read data.

	data, err := ioutil.ReadFile(j.mdDataPath(id))
	if err != nil {
		return nil, time.Time{}, err
	}

	// TODO: Read version info.
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

	err = rmd.IsLastModifiedBy(j.uid, j.key)
	if err != nil {
		return nil, time.Time{}, err
	}

	// MDv3 TODO: pass key bundles when needed
	err = rmd.IsValidAndSigned(j.codec, j.crypto, nil)
	if err != nil {
		return nil, time.Time{}, err
	}

	if verifyBranchID && rmd.BID() != j.branchID {
		return nil, time.Time{}, fmt.Errorf(
			"Branch ID mismatch: expected %s, got %s",
			j.branchID, rmd.BID())
	}

	fi, err := os.Stat(j.mdPath(id))
	if err != nil {
		return nil, time.Time{}, err
	}

	return &rmd, fi.ModTime(), nil
}

// putMD stores the given metadata under its ID, if it's not already
// stored.
func (j mdJournal) putMD(rmd BareRootMetadata) (MdID, error) {
	// MDv3 TODO: pass key bundles when needed
	err := rmd.IsValidAndSigned(j.codec, j.crypto, nil)
	if err != nil {
		return MdID{}, err
	}

	err = rmd.IsLastModifiedBy(j.uid, j.key)
	if err != nil {
		return MdID{}, err
	}

	id, err := j.crypto.MakeMdID(rmd)
	if err != nil {
		return MdID{}, err
	}

	_, _, err = j.getMD(id, true)
	if os.IsNotExist(err) {
		// Continue on.
	} else if err != nil {
		return MdID{}, err
	} else {
		// Entry exists, so nothing else to do.
		return MdID{}, nil
	}

	buf, err := j.codec.Encode(rmd)
	if err != nil {
		return MdID{}, err
	}

	err = os.MkdirAll(j.mdPath(id), 0700)
	if err != nil {
		return MdID{}, err
	}

	// TODO: Write version info.

	err = ioutil.WriteFile(j.mdDataPath(id), buf, 0600)
	if err != nil {
		return MdID{}, err
	}

	return id, nil
}

// removeMD removes the metadata (which must exist) with the given ID.
func (j *mdJournal) removeMD(id MdID) error {
	path := j.mdPath(id)
	err := os.RemoveAll(path)
	if err != nil {
		return err
	}

	// Remove the parent (splayed) directory (which should exist)
	// if it's empty.
	err = os.Remove(filepath.Dir(path))
	if isExist(err) {
		err = nil
	}
	return err
}

func (j mdJournal) getEarliest(verifyBranchID bool) (
	ImmutableBareRootMetadata, error) {
	entry, exists, err := j.j.getEarliestEntry()
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	if !exists {
		return ImmutableBareRootMetadata{}, nil
	}
	earliestID := entry.ID
	earliest, ts, err := j.getMD(earliestID, verifyBranchID)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	return MakeImmutableBareRootMetadata(earliest, earliestID, ts), nil
}

func (j mdJournal) getLatest(verifyBranchID bool) (
	ImmutableBareRootMetadata, error) {
	entry, exists, err := j.j.getLatestEntry()
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	if !exists {
		return ImmutableBareRootMetadata{}, nil
	}
	latestID := entry.ID
	latest, ts, err := j.getMD(latestID, verifyBranchID)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	return MakeImmutableBareRootMetadata(latest, latestID, ts), nil
}

func (j mdJournal) checkGetParams(extra ExtraMetadata) (
	ImmutableBareRootMetadata, error) {
	head, err := j.getLatest(true)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	if head != (ImmutableBareRootMetadata{}) {
		ok, err := isReader(j.uid, head.BareRootMetadata, extra)
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
	ctx context.Context, signer cryptoSigner,
	tlfID TlfID, mdcache MDCache) (bid BranchID, err error) {
	if j.branchID != NullBranchID {
		return NullBranchID, fmt.Errorf(
			"convertToBranch called with BID=%s", j.branchID)
	}

	earliestRevision, err := j.j.readEarliestRevision()
	if err != nil {
		return NullBranchID, err
	}

	latestRevision, err := j.j.readLatestRevision()
	if err != nil {
		return NullBranchID, err
	}

	j.log.CDebugf(
		ctx, "rewriting MDs %s to %s", earliestRevision, latestRevision)

	_, allEntries, err := j.j.getEntryRange(
		earliestRevision, latestRevision)
	if err != nil {
		return NullBranchID, err
	}

	bid, err = j.crypto.MakeRandomBranchID()
	if err != nil {
		return NullBranchID, err
	}

	j.log.CDebugf(ctx, "New branch ID=%s", bid)

	journalTempDir, err := ioutil.TempDir(j.dir, "md_journal")
	if err != nil {
		return NullBranchID, err
	}
	j.log.CDebugf(ctx, "Using temp dir %s for rewriting", journalTempDir)

	mdsToRemove := make([]MdID, 0, len(allEntries))
	defer func() {
		j.log.CDebugf(ctx, "Removing temp dir %s and %d old MDs",
			journalTempDir, len(mdsToRemove))
		removeErr := os.RemoveAll(journalTempDir)
		if removeErr != nil {
			j.log.CWarningf(ctx,
				"Error when removing temp dir %s: %v",
				journalTempDir, removeErr)
		}
		// Garbage-collect the unnecessary MD entries.  TODO: we'll
		// eventually need a sweeper to clean up entries left behind
		// if we crash here.
		for _, id := range mdsToRemove {
			removeErr := j.removeMD(id)
			if removeErr != nil {
				j.log.CWarningf(ctx, "Error when removing old MD %s: %v",
					id, removeErr)
			}
		}
	}()

	tempJournal := makeMdIDJournal(j.codec, journalTempDir)

	var prevID MdID

	for i, entry := range allEntries {
		ibrmd, _, err := j.getMD(entry.ID, true)
		if err != nil {
			return NullBranchID, err
		}
		brmd, ok := ibrmd.(MutableBareRootMetadata)
		if !ok {
			return NullBranchID, MutableBareRootMetadataNoImplError{}
		}
		brmd.SetUnmerged()
		brmd.SetBranchID(bid)

		// Delete the old "merged" version from the cache.
		mdcache.Delete(tlfID, ibrmd.RevisionNumber(), NullBranchID)

		// Re-sign the writer metadata.
		buf, err := brmd.GetSerializedWriterMetadata(j.codec)
		if err != nil {
			return NullBranchID, err
		}

		sigInfo, err := signer.Sign(ctx, buf)
		if err != nil {
			return NullBranchID, err
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
		newID, err := j.putMD(brmd)
		if err != nil {
			return NullBranchID, err
		}
		mdsToRemove = append(mdsToRemove, newID)

		// TODO: Try and preserve unknown fields from the old
		// journal.
		err = tempJournal.append(
			brmd.RevisionNumber(), mdIDJournalEntry{ID: newID})
		if err != nil {
			return NullBranchID, err
		}

		prevID = newID

		j.log.CDebugf(ctx, "Changing ID for rev=%s from %s to %s",
			brmd.RevisionNumber(), entry.ID, newID)
	}

	// TODO: Do the below atomically on the filesystem
	// level. Specifically, make "md_journal" always be a symlink,
	// and then perform the swap by atomically changing the
	// symlink to point to the new journal directory.

	oldJournalTempDir := journalTempDir + ".old"
	dir, err := j.j.move(oldJournalTempDir)
	if err != nil {
		return NullBranchID, err
	}

	j.log.CDebugf(ctx, "Moved old journal from %s to %s",
		dir, oldJournalTempDir)

	newJournalOldDir, err := tempJournal.move(dir)
	if err != nil {
		return NullBranchID, err
	}

	j.log.CDebugf(ctx, "Moved new journal from %s to %s",
		newJournalOldDir, dir)

	// Make the defer block above remove oldJournalTempDir.
	journalTempDir = oldJournalTempDir

	mdsToRemove = nil
	for _, entry := range allEntries {
		mdsToRemove = append(mdsToRemove, entry.ID)
	}

	j.j = tempJournal
	j.branchID = bid

	return bid, nil
}

// getNextEntryToFlush returns the info for the next journal entry to
// flush, if it exists, and its revision is less than end. If there is
// no next journal entry to flush, the returned MdID will be zero, and
// the returned *RootMetadataSigned will be nil.
func (j mdJournal) getNextEntryToFlush(
	ctx context.Context, end MetadataRevision, signer cryptoSigner) (
	MdID, *RootMetadataSigned, error) {
	rmd, err := j.getEarliest(true)
	if err != nil {
		return MdID{}, nil, err
	}
	if rmd == (ImmutableBareRootMetadata{}) || rmd.RevisionNumber() >= end {
		return MdID{}, nil, nil
	}

	mbrmd, ok := rmd.BareRootMetadata.(MutableBareRootMetadata)
	if !ok {
		return MdID{}, nil, MutableBareRootMetadataNoImplError{}
	}

	rmds := RootMetadataSigned{MD: mbrmd}
	err = signMD(ctx, j.codec, signer, &rmds)
	if err != nil {
		return MdID{}, nil, err
	}

	return rmd.mdID, &rmds, nil
}

func (j *mdJournal) removeFlushedEntry(
	ctx context.Context, mdID MdID, rmds *RootMetadataSigned) error {
	rmd, err := j.getEarliest(true)
	if err != nil {
		return err
	}
	if rmd == (ImmutableBareRootMetadata{}) {
		return errors.New("mdJournal unexpectedly empty")
	}

	if mdID != rmd.mdID {
		return fmt.Errorf("Expected mdID %s, got %s", mdID, rmd.mdID)
	}

	eq, err := CodecEqual(j.codec, rmd.BareRootMetadata, rmds.MD)
	if err != nil {
		return err
	}
	if !eq {
		return errors.New(
			"Given RootMetadataSigned doesn't match earliest")
	}

	empty, err := j.j.removeEarliest()
	if err != nil {
		return err
	}

	// Since the journal is now empty, set lastMdID.
	if empty {
		j.log.CDebugf(ctx,
			"Journal is now empty; saving last MdID=%s", mdID)
		j.lastMdID = mdID
	}

	// Garbage-collect the old entry.  TODO: we'll eventually need a
	// sweeper to clean up entries left behind if we crash here.
	return j.removeMD(mdID)
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

func (j mdJournal) end() (MetadataRevision, error) {
	return j.j.end()
}

func (j mdJournal) getBranchID() BranchID {
	return j.branchID
}

func (j mdJournal) getHead(extra ExtraMetadata) (
	ImmutableBareRootMetadata, error) {
	return j.checkGetParams(extra)
}

func (j mdJournal) getRange(
	extra ExtraMetadata, start, stop MetadataRevision) (
	[]ImmutableBareRootMetadata, error) {
	_, err := j.checkGetParams(extra)
	if err != nil {
		return nil, err
	}

	realStart, entries, err := j.j.getEntryRange(start, stop)
	if err != nil {
		return nil, err
	}
	var rmds []ImmutableBareRootMetadata
	for i, entry := range entries {
		expectedRevision := realStart + MetadataRevision(i)
		rmd, ts, err := j.getMD(entry.ID, true)
		if err != nil {
			return nil, err
		}
		if expectedRevision != rmd.RevisionNumber() {
			panic(fmt.Errorf("expected revision %v, got %v",
				expectedRevision, rmd.RevisionNumber()))
		}
		irmd := MakeImmutableBareRootMetadata(rmd, entry.ID, ts)
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
// modifying it as needed. In particular, there are four cases:
//
// Merged
// ------
// rmd is merged. If the journal is empty, then rmd becomes the
// initial entry. Otherwise, if the journal has been converted to a
// branch, then an MDJournalConflictError error is returned, and the
// caller is expected to set the unmerged bit and retry (see case
// Unmerged-1). Otherwise, either rmd must be the successor to the
// journal's head, in which case it is appended, or it must have the
// same revision number as the journal's head, in which case it
// replaces the journal's head. (This is necessary since if a journal
// put is cancelled and an error is returned, it still happens, and so
// we want the retried put (if any) to not conflict with it.)
//
// Unmerged-1
// ----------
// rmd is unmerged and has a null branch ID. This happens when case
// Merged returns with MDJournalConflictError. In this case, the rmd's
// branch ID is set to the journal's branch ID and its prevRoot is set
// to the last known journal root. It doesn't matter if the journal is
// completely drained, since the branch ID and last known root is
// remembered in memory. However, since this cache isn't persisted to
// disk, we need case Unmerged-3. Similarly to case Merged, this case
// then also does append-or-replace.
//
// Unmerged-2
// ----------
// rmd is unmerged and has a non-null branch ID, and the journal was
// non-empty at some time during this process's lifetime. Similarly to
// case Merged, if the journal is empty, then rmd becomes the initial
// entry, and otherwise, this case does append-or-replace.
//
// Unmerged-3
// ----------
// rmd is unmerged and has a non-null branch ID, and the journal has
// always been empty during this process's lifetime. The branch ID is
// assumed to be correct, i.e. retrieved from the remote MDServer, and
// rmd becomes the initial entry.
func (j *mdJournal) put(
	ctx context.Context, signer cryptoSigner,
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

	head, err := j.getLatest(true)
	if err != nil {
		return MdID{}, err
	}

	mStatus := rmd.MergedStatus()

	// Make modifications for the Unmerged cases.
	if mStatus == Unmerged {
		var lastMdID MdID
		if head == (ImmutableBareRootMetadata{}) {
			lastMdID = j.lastMdID
		} else {
			lastMdID = head.mdID
		}

		if rmd.BID() == NullBranchID && j.branchID == NullBranchID {
			return MdID{}, errors.New(
				"Unmerged put with rmd.BID() == j.branchID == NullBranchID")
		}

		if head == (ImmutableBareRootMetadata{}) &&
			j.branchID == NullBranchID {
			// Case Unmerged-3.
			j.branchID = rmd.BID()
			// Revert branch ID if we encounter an error.
			defer func() {
				if err != nil {
					j.branchID = NullBranchID
				}
			}()
		} else if rmd.BID() == NullBranchID {
			// Case Unmerged-1.
			j.log.CDebugf(
				ctx, "Changing branch ID to %s and prev root to %s for MD for TLF=%s with rev=%s",
				j.branchID, lastMdID, rmd.TlfID(), rmd.Revision())
			rmd.SetBranchID(j.branchID)
			rmd.SetPrevRoot(lastMdID)
		} else {
			// Using de Morgan's laws, this branch is
			// taken when both rmd.BID() is non-null, and
			// either head is non-empty or j.branchID is
			// non-empty. So this is most of case
			// Unmerged-2, and there's nothing to do.
			//
			// The remaining part of case Unmerged-2,
			// where rmd.BID() is non-null, head is empty,
			// and j.branchID is empty, is an error case,
			// handled below.
		}
	}

	// The below is code common to all the cases.

	if (mStatus == Merged) != (rmd.BID() == NullBranchID) {
		return MdID{}, fmt.Errorf(
			"mStatus=%s doesn't match bid=%s", mStatus, rmd.BID())
	}

	// If we're trying to push a merged MD onto a branch, return a
	// conflict error so the caller can retry with an unmerged MD.
	if mStatus == Merged && j.branchID != NullBranchID {
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
			j.codec, j.uid, head.BareRootMetadata, rmd.bareMd)
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
		j.uid, rmd.ReadOnly())
	if err != nil {
		return MdID{}, err
	}

	id, err := j.putMD(brmd)
	if err != nil {
		return MdID{}, err
	}

	if head != (ImmutableBareRootMetadata{}) &&
		rmd.Revision() == head.RevisionNumber() {

		j.log.CDebugf(
			ctx, "Replacing head MD for TLF=%s with rev=%s bid=%s",
			rmd.TlfID(), rmd.Revision(), rmd.BID())
		// TODO: Try and preserve unknown fields from the old
		// journal.
		err = j.j.replaceHead(mdIDJournalEntry{ID: id})
		if err != nil {
			return MdID{}, err
		}
	} else {
		err = j.j.append(
			brmd.RevisionNumber(), mdIDJournalEntry{ID: id})
		if err != nil {
			return MdID{}, err
		}
	}

	// Since the journal is now non-empty, clear lastMdID.
	j.lastMdID = MdID{}

	return id, nil
}

func (j *mdJournal) clear(
	ctx context.Context, bid BranchID, extra ExtraMetadata) (err error) {
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

	if j.branchID != bid {
		// Nothing to do.
		j.log.CDebugf(ctx, "Ignoring clear for branch %s while on branch %s",
			bid, j.branchID)
		return nil
	}

	head, err := j.getHead(extra)
	if err != nil {
		return err
	}

	if head == (ImmutableBareRootMetadata{}) {
		// The journal has been flushed but not cleared yet.
		j.branchID = NullBranchID
		return nil
	}

	if head.BID() != j.branchID {
		return fmt.Errorf("Head branch ID %s doesn't match journal "+
			"branch ID %s while clearing", head.BID(), j.branchID)
	}

	earliestRevision, err := j.j.readEarliestRevision()
	if err != nil {
		return err
	}

	latestRevision, err := j.j.readLatestRevision()
	if err != nil {
		return err
	}

	_, allEntries, err := j.j.getEntryRange(
		earliestRevision, latestRevision)
	if err != nil {
		return err
	}

	j.branchID = NullBranchID

	// No need to set lastMdID in this case.

	err = j.j.clear()
	if err != nil {
		return nil
	}

	// Garbage-collect the old branch entries.  TODO: we'll eventually
	// need a sweeper to clean up entries left behind if we crash
	// here.
	for _, entry := range allEntries {
		err := j.removeMD(entry.ID)
		if err != nil {
			return err
		}
	}
	return nil
}
