// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
)

// ImmutableBareRootMetadata is a thin wrapper around a
// BareRootMetadata and an ExtraMetadata that takes ownership of it
// and does not ever modify it again. Thus, its MdID can be calculated
// and stored along with a local timestamp. ImmutableBareRootMetadata
// objects can be assumed to never alias a (modifiable)
// BareRootMetadata.
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
	extra          ExtraMetadata
	mdID           MdID
	localTimestamp time.Time
}

// MakeImmutableBareRootMetadata makes a new ImmutableBareRootMetadata
// from the given BareRootMetadata and its corresponding MdID.
func MakeImmutableBareRootMetadata(
	rmd BareRootMetadata, extra ExtraMetadata, mdID MdID,
	localTimestamp time.Time) ImmutableBareRootMetadata {
	if mdID == (MdID{}) {
		panic("zero mdID passed to MakeImmutableBareRootMetadata")
	}
	return ImmutableBareRootMetadata{rmd, extra, mdID, localTimestamp}
}

// MakeBareTlfHandleWithExtra makes a BareTlfHandle for this
// ImmutableBareRootMetadata. Should be used only by servers and MDOps.
func (ibrmd ImmutableBareRootMetadata) MakeBareTlfHandleWithExtra() (
	BareTlfHandle, error) {
	return ibrmd.BareRootMetadata.MakeBareTlfHandle(ibrmd.extra)
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
// dir/mds/0100/0...01/info.json
// ...
// dir/mds/01ff/f...ff/data
// dir/mds/01ff/f...ff/info.json
// dir/wkbv3/0100...01
// ...
// dir/wkbv3/0100...ff
// dir/rkbv3/0100...01
// ...
// dir/rkbv3/0100...ff
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
// hash to the MD ID, and info.json, which contains the version and
// timestamp info for that MD. Future versions of the journal might
// add more files to this directory; if any code is written to move
// MDs around, it should be careful to preserve any unknown files in
// an MD directory.
//
// Writer (reader) key bundles for V3 metadata objects are stored
// separately in dir/wkbv3 (dir/rkbv3). The number of bundles is
// small, so no need to splay them.
//
// TODO: Garbage-collect unreferenced key bundles.
//
// The maximum number of characters added to the root dir by an MD
// journal is 50:
//
//   /mds/01ff/f...(30 characters total)...ff/info.json
//
// This covers even the temporary files created in convertToBranch and
// resolveAndClear, which create paths like
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
	key kbfscrypto.VerifyingKey

	codec  kbfscodec.Codec
	crypto cryptoPure
	clock  Clock
	tlfID  TlfID
	mdVer  MetadataVer
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

func makeMDJournalWithIDJournal(
	uid keybase1.UID, key kbfscrypto.VerifyingKey, codec kbfscodec.Codec,
	crypto cryptoPure, clock Clock, tlfID TlfID,
	mdVer MetadataVer, dir string, idJournal mdIDJournal,
	log logger.Logger) (*mdJournal, error) {
	if uid == keybase1.UID("") {
		return nil, errors.New("Empty user")
	}
	if key == (kbfscrypto.VerifyingKey{}) {
		return nil, errors.New("Empty verifying key")
	}

	deferLog := log.CloneWithAddedDepth(1)
	journal := mdJournal{
		uid:      uid,
		key:      key,
		codec:    codec,
		crypto:   crypto,
		clock:    clock,
		tlfID:    tlfID,
		mdVer:    mdVer,
		dir:      dir,
		log:      log,
		deferLog: deferLog,
		j:        idJournal,
	}

	_, earliest, _, _, err := journal.getEarliestWithExtra(false)
	if err != nil {
		return nil, err
	}

	latest, err := journal.getLatest(false)
	if err != nil {
		return nil, err
	}

	if (earliest == nil) != (latest == ImmutableBareRootMetadata{}) {
		return nil, fmt.Errorf("has earliest=%t != has latest=%t",
			earliest != nil,
			latest != ImmutableBareRootMetadata{})
	}

	if earliest != nil {
		if earliest.BID() != latest.BID() {
			return nil, fmt.Errorf(
				"earliest.BID=%s != latest.BID=%s",
				earliest.BID(), latest.BID())
		}
		log.CDebugf(nil, "Initializing with branch ID %s", earliest.BID())
		journal.branchID = earliest.BID()
	}

	return &journal, nil
}

func makeMDJournal(
	uid keybase1.UID, key kbfscrypto.VerifyingKey, codec kbfscodec.Codec,
	crypto cryptoPure, clock Clock, tlfID TlfID,
	mdVer MetadataVer, dir string,
	log logger.Logger) (*mdJournal, error) {
	journalDir := filepath.Join(dir, "md_journal")
	return makeMDJournalWithIDJournal(
		uid, key, codec, crypto, clock, tlfID, mdVer, dir,
		makeMdIDJournal(codec, journalDir), log)
}

// The functions below are for building various paths.

func (j mdJournal) mdsPath() string {
	return filepath.Join(j.dir, "mds")
}

// The final components of the paths below are truncated to 34
// characters, which corresponds to 16 random bytes (since the first
// byte is a hash type) or 128 random bits, which means that the
// expected number of MDs generated before getting a path collision is
// 2^64 (see
// https://en.wikipedia.org/wiki/Birthday_problem#Cast_as_a_collision_problem
// ). The full ID can be recovered just by hashing the data again with
// the same hash type.

func (j mdJournal) writerKeyBundleV3Path(id TLFWriterKeyBundleID) string {
	idStr := id.String()
	return filepath.Join(j.dir, "wkbv3", idStr[:34])
}

func (j mdJournal) readerKeyBundleV3Path(id TLFReaderKeyBundleID) string {
	idStr := id.String()
	return filepath.Join(j.dir, "rkbv3", idStr[:34])
}

func (j mdJournal) mdPath(id MdID) string {
	idStr := id.String()
	return filepath.Join(j.mdsPath(), idStr[:4], idStr[4:34])
}

func (j mdJournal) mdDataPath(id MdID) string {
	return filepath.Join(j.mdPath(id), "data")
}

func (j mdJournal) mdInfoPath(id MdID) string {
	return filepath.Join(j.mdPath(id), "info.json")
}

// mdInfo is the structure stored in mdInfoPath(id).
//
// TODO: Handle unknown fields? We'd have to build a handler for this,
// since the Go JSON library doesn't support it natively.
type mdInfo struct {
	Timestamp time.Time
	Version   MetadataVer
}

func (j mdJournal) getMDInfo(id MdID) (time.Time, MetadataVer, error) {
	infoJSON, err := ioutil.ReadFile(j.mdInfoPath(id))
	if err != nil {
		return time.Time{}, MetadataVer(-1), err
	}

	var info mdInfo
	err = json.Unmarshal(infoJSON, &info)
	if err != nil {
		return time.Time{}, MetadataVer(-1), err
	}

	return info.Timestamp, info.Version, nil
}

// putMDInfo assumes that the parent directory of j.mdInfoPath(id)
// (which is j.mdPath(id)) has already been created.
func (j mdJournal) putMDInfo(
	id MdID, timestamp time.Time, version MetadataVer) error {
	info := mdInfo{timestamp, version}
	infoJSON, err := json.Marshal(info)
	if err != nil {
		return err
	}

	return ioutil.WriteFile(j.mdInfoPath(id), infoJSON, 0600)
}

// getExtraMetadata gets the extra metadata corresponding to the given
// IDs, if any, after checking them.
func (j mdJournal) getExtraMetadata(
	wkbID TLFWriterKeyBundleID, rkbID TLFReaderKeyBundleID) (
	ExtraMetadata, error) {
	if (wkbID == TLFWriterKeyBundleID{}) !=
		(rkbID == TLFReaderKeyBundleID{}) {
		return nil, fmt.Errorf(
			"wkbID is empty (%t) != rkbID is empty (%t)",
			wkbID == TLFWriterKeyBundleID{},
			rkbID == TLFReaderKeyBundleID{})
	}

	if wkbID == (TLFWriterKeyBundleID{}) {
		return nil, nil
	}

	var wkb TLFWriterKeyBundleV3
	err := kbfscodec.DeserializeFromFile(
		j.codec, j.writerKeyBundleV3Path(wkbID), &wkb)
	if err != nil {
		return nil, err
	}

	var rkb TLFReaderKeyBundleV3
	err = kbfscodec.DeserializeFromFile(
		j.codec, j.readerKeyBundleV3Path(rkbID), &rkb)
	if err != nil {
		return nil, err
	}

	err = checkKeyBundlesV3(j.crypto, wkbID, rkbID, &wkb, &rkb)
	if err != nil {
		return nil, err
	}

	return &ExtraMetadataV3{wkb: &wkb, rkb: &rkb}, nil
}

func (j mdJournal) putExtraMetadata(
	rmd BareRootMetadata, extra ExtraMetadata) error {
	if extra == nil {
		return nil
	}

	wkbID := rmd.GetTLFWriterKeyBundleID()
	if wkbID == (TLFWriterKeyBundleID{}) {
		panic("writer key bundle ID is empty")
	}

	rkbID := rmd.GetTLFReaderKeyBundleID()
	if rkbID == (TLFReaderKeyBundleID{}) {
		panic("reader key bundle ID is empty")
	}

	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return errors.New("Invalid extra metadata")
	}

	err := checkKeyBundlesV3(
		j.crypto, wkbID, rkbID, extraV3.wkb, extraV3.rkb)
	if err != nil {
		return err
	}

	err = kbfscodec.SerializeToFile(
		j.codec, extraV3.wkb, j.writerKeyBundleV3Path(wkbID))
	if err != nil {
		return err
	}

	err = kbfscodec.SerializeToFile(
		j.codec, extraV3.rkb, j.readerKeyBundleV3Path(rkbID))
	if err != nil {
		return err
	}

	return nil
}

// getMDAndExtra verifies the MD data, the writer signature (but not
// the key), and the extra metadata for the given ID and returns
// them. It also returns the last-modified timestamp of the
// file. verifyBranchID should be false only when called from
// makeMDJournal, i.e. when figuring out what to set j.branchID in the
// first place.
//
// It returns a MutableBareRootMetadata so that it can be put in a
// RootMetadataSigned object.
func (j mdJournal) getMDAndExtra(id MdID, verifyBranchID bool) (
	MutableBareRootMetadata, ExtraMetadata, time.Time, error) {
	// Read info.

	timestamp, version, err := j.getMDInfo(id)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	// Read data.

	data, err := ioutil.ReadFile(j.mdDataPath(id))
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	rmd, err := DecodeRootMetadata(
		j.codec, j.tlfID, version, j.mdVer, data)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	// Check integrity.

	mdID, err := j.crypto.MakeMdID(rmd)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	if mdID != id {
		return nil, nil, time.Time{}, fmt.Errorf(
			"Metadata ID mismatch: expected %s, got %s", id, mdID)
	}

	err = rmd.IsLastModifiedBy(j.uid, j.key)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	extra, err := j.getExtraMetadata(
		rmd.GetTLFWriterKeyBundleID(), rmd.GetTLFReaderKeyBundleID())
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	err = rmd.IsValidAndSigned(j.codec, j.crypto, extra)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	if verifyBranchID && rmd.BID() != j.branchID {
		return nil, nil, time.Time{}, fmt.Errorf(
			"Branch ID mismatch: expected %s, got %s",
			j.branchID, rmd.BID())
	}

	return rmd, extra, timestamp, nil
}

// putMD stores the given metadata under its ID, if it's not already
// stored. The extra metadata is put separately, since sometimes,
// (e.g., when converting to a branch) we don't need to put it.
func (j mdJournal) putMD(rmd BareRootMetadata) (MdID, error) {
	err := rmd.IsLastModifiedBy(j.uid, j.key)
	if err != nil {
		return MdID{}, err
	}

	id, err := j.crypto.MakeMdID(rmd)
	if err != nil {
		return MdID{}, err
	}

	_, _, _, err = j.getMDAndExtra(id, true)
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

	err = ioutil.WriteFile(j.mdDataPath(id), buf, 0600)
	if err != nil {
		return MdID{}, err
	}

	err = j.putMDInfo(id, j.clock.Now(), rmd.Version())
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

// getEarliestWithExtra returns a MutableBareRootMetadata so that it
// can be put in a RootMetadataSigned object.
func (j mdJournal) getEarliestWithExtra(verifyBranchID bool) (
	MdID, MutableBareRootMetadata, ExtraMetadata, time.Time, error) {
	entry, exists, err := j.j.getEarliestEntry()
	if err != nil {
		return MdID{}, nil, nil, time.Time{}, err
	}
	if !exists {
		return MdID{}, nil, nil, time.Time{}, nil
	}
	earliestID := entry.ID
	earliest, extra, timestamp, err :=
		j.getMDAndExtra(earliestID, verifyBranchID)
	if err != nil {
		return MdID{}, nil, nil, time.Time{}, err
	}
	return earliestID, earliest, extra, timestamp, nil
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
	latest, extra, timestamp, err := j.getMDAndExtra(
		latestID, verifyBranchID)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	return MakeImmutableBareRootMetadata(
		latest, extra, latestID, timestamp), nil
}

func (j mdJournal) checkGetParams() (ImmutableBareRootMetadata, error) {
	head, err := j.getLatest(true)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	if head == (ImmutableBareRootMetadata{}) {
		return ImmutableBareRootMetadata{}, nil
	}

	ok, err := isReader(j.uid, head.BareRootMetadata, head.extra)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	if !ok {
		// TODO: Use a non-server error.
		return ImmutableBareRootMetadata{}, MDServerErrorUnauthorized{}
	}

	return head, nil
}

func (j *mdJournal) convertToBranch(
	ctx context.Context, signer kbfscrypto.Signer, codec kbfscodec.Codec,
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
		brmd, _, ts, err := j.getMDAndExtra(entry.ID, true)
		if err != nil {
			return NullBranchID, err
		}
		brmd.SetUnmerged()
		brmd.SetBranchID(bid)

		// Re-sign the writer metadata internally, since we
		// changed it.
		err = brmd.SignWriterMetadataInternally(ctx, j.codec, signer)
		if err != nil {
			return NullBranchID, err
		}

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

		// Preserve unknown fields from the old journal.
		newEntry := entry
		newEntry.ID = newID
		err = tempJournal.append(brmd.RevisionNumber(), newEntry)
		if err != nil {
			return NullBranchID, err
		}

		prevID = newID

		// If possible, replace the old RMD in the cache.  If it's not
		// already in the cache, don't bother adding it, as that will
		// just evict something incorrectly.  TODO: Don't replace the
		// MD until we know for sure that the branch conversion
		// succeeds.
		oldIrmd, err := mdcache.Get(
			tlfID, brmd.RevisionNumber(), NullBranchID)
		if err == nil {
			newRmd, err := oldIrmd.deepCopy(codec)
			if err != nil {
				return NullBranchID, err
			}
			newRmd.bareMd = brmd
			// Everything else is the same.
			err = mdcache.Replace(
				MakeImmutableRootMetadata(newRmd,
					oldIrmd.LastModifyingWriterVerifyingKey(),
					newID, ts),
				NullBranchID)
			if err != nil {
				return NullBranchID, err
			}
		}

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
	ctx context.Context, end MetadataRevision, signer kbfscrypto.Signer) (
	MdID, *RootMetadataSigned, ExtraMetadata, error) {
	mdID, rmd, extra, timestamp, err := j.getEarliestWithExtra(true)
	if err != nil {
		return MdID{}, nil, nil, err
	}
	if rmd == nil || rmd.RevisionNumber() >= end {
		return MdID{}, nil, nil, nil
	}

	rmds, err := SignBareRootMetadata(
		ctx, j.codec, signer, signer, rmd, timestamp)
	if err != nil {
		return MdID{}, nil, nil, err
	}

	return mdID, rmds, extra, nil
}

func (j *mdJournal) removeFlushedEntry(
	ctx context.Context, mdID MdID, rmds *RootMetadataSigned) error {
	rmdID, rmd, _, _, err := j.getEarliestWithExtra(true)
	if err != nil {
		return err
	}
	if rmd == nil {
		return errors.New("mdJournal unexpectedly empty")
	}

	if mdID != rmdID {
		return fmt.Errorf("Expected mdID %s, got %s", mdID, rmdID)
	}

	eq, err := kbfscodec.Equal(j.codec, rmd, rmds.MD)
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

func (j mdJournal) getHead() (ImmutableBareRootMetadata, error) {
	return j.checkGetParams()
}

func (j mdJournal) getRange(start, stop MetadataRevision) (
	[]ImmutableBareRootMetadata, error) {
	_, err := j.checkGetParams()
	if err != nil {
		return nil, err
	}

	realStart, entries, err := j.j.getEntryRange(start, stop)
	if err != nil {
		return nil, err
	}
	var ibrmds []ImmutableBareRootMetadata
	for i, entry := range entries {
		expectedRevision := realStart + MetadataRevision(i)
		brmd, extra, ts, err := j.getMDAndExtra(entry.ID, true)
		if err != nil {
			return nil, err
		}
		if expectedRevision != brmd.RevisionNumber() {
			panic(fmt.Errorf("expected revision %v, got %v",
				expectedRevision, brmd.RevisionNumber()))
		}
		ibrmd := MakeImmutableBareRootMetadata(
			brmd, extra, entry.ID, ts)
		ibrmds = append(ibrmds, ibrmd)
	}

	return ibrmds, nil
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
	ctx context.Context, signer kbfscrypto.Signer,
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

	extra := rmd.extra
	if extra == nil {
		// TODO: This could fail if the key bundle isn't part
		// of the journal. Always mandate that the extra field
		// be plumbed through with a RootMetadata, and keep
		// around a flag as to whether it should be sent up to
		// the remote MDServer.
		var err error
		extra, err = j.getExtraMetadata(
			rmd.bareMd.GetTLFWriterKeyBundleID(),
			rmd.bareMd.GetTLFReaderKeyBundleID())
		if err != nil {
			return MdID{}, err
		}
	}

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
			j.codec, j.uid, head.BareRootMetadata, rmd.bareMd,
			head.extra, extra)
		if err != nil {
			return MdID{}, err
		}
		if !ok {
			// TODO: Use a non-server error.
			return MdID{}, MDServerErrorUnauthorized{}
		}

		// Consistency checks
		if rmd.Revision() != head.RevisionNumber() {
			err = head.CheckValidSuccessorForServer(
				head.mdID, rmd.bareMd)
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

	err = encryptMDPrivateData(
		ctx, j.codec, j.crypto, signer, ekg, j.uid, rmd)
	if err != nil {
		return MdID{}, err
	}

	err = rmd.bareMd.IsValidAndSigned(j.codec, j.crypto, extra)
	if err != nil {
		return MdID{}, err
	}

	id, err := j.putMD(rmd.bareMd)
	if err != nil {
		return MdID{}, err
	}

	err = j.putExtraMetadata(rmd.bareMd, extra)
	if err != nil {
		return MdID{}, err
	}

	if head != (ImmutableBareRootMetadata{}) &&
		rmd.Revision() == head.RevisionNumber() {

		j.log.CDebugf(
			ctx, "Replacing head MD for TLF=%s with rev=%s bid=%s",
			rmd.TlfID(), rmd.Revision(), rmd.BID())
		// Don't try and preserve unknown fields from the old
		// head here -- the new head is in general a different
		// MD, so the unknown fields from the old head won't
		// make sense.
		err = j.j.replaceHead(mdIDJournalEntry{ID: id})
		if err != nil {
			return MdID{}, err
		}
	} else {
		err = j.j.append(rmd.Revision(), mdIDJournalEntry{ID: id})
		if err != nil {
			return MdID{}, err
		}
	}

	// Since the journal is now non-empty, clear lastMdID.
	j.lastMdID = MdID{}

	return id, nil
}

func (j *mdJournal) clear(
	ctx context.Context, bid BranchID) (err error) {
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

	head, err := j.getHead()
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

func (j *mdJournal) resolveAndClear(
	ctx context.Context, signer kbfscrypto.Signer, ekg encryptionKeyGetter,
	bsplit BlockSplitter, bid BranchID, rmd *RootMetadata) (
	mdID MdID, err error) {
	j.log.CDebugf(ctx, "Resolve and clear, branch %s, resolve rev %d",
		bid, rmd.Revision())
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Resolving journal for branch %s failed with %v",
				bid, err)
		}
	}()

	// The resolution must not have a branch ID.
	if rmd.BID() != NullBranchID {
		return MdID{}, fmt.Errorf("Resolution MD has branch ID: %s", rmd.BID())
	}

	// The branch ID must match our current state.
	if bid == NullBranchID {
		return MdID{}, errors.New("Cannot resolve master branch")
	}
	if j.branchID != bid {
		return MdID{}, fmt.Errorf("Resolve and clear for branch %s "+
			"while on branch %s", bid, j.branchID)
	}

	// First make a new journal to hold the block.

	// Give this new journal a new ID journal.
	idJournalTempDir, err := ioutil.TempDir(j.dir, "md_journal")
	if err != nil {
		return MdID{}, err
	}
	j.log.CDebugf(ctx, "Using temp dir %s for new IDs", idJournalTempDir)
	otherIDJournal := makeMdIDJournal(j.codec, idJournalTempDir)
	defer func() {
		j.log.CDebugf(ctx, "Removing temp dir %s", idJournalTempDir)
		removeErr := os.RemoveAll(idJournalTempDir)
		if removeErr != nil {
			j.log.CWarningf(ctx,
				"Error when removing temp dir %s: %v",
				idJournalTempDir, removeErr)
		}
	}()

	otherJournal, err := makeMDJournalWithIDJournal(
		j.uid, j.key, j.codec, j.crypto, j.clock, j.tlfID, j.mdVer, j.dir,
		otherIDJournal, j.log)
	if err != nil {
		return MdID{}, err
	}

	//otherJournal.branchID = NullBranchID
	mdID, err = otherJournal.put(ctx, signer, ekg, bsplit, rmd)
	if err != nil {
		return MdID{}, err
	}

	// Transform this journal into the new one.

	// TODO: Do the below atomically on the filesystem
	// level. Specifically, make "md_journal" always be a symlink,
	// and then perform the swap by atomically changing the
	// symlink to point to the new journal directory.

	oldIDJournalTempDir := idJournalTempDir + ".old"
	dir, err := j.j.move(oldIDJournalTempDir)
	if err != nil {
		return MdID{}, err
	}

	j.log.CDebugf(ctx, "Moved old journal from %s to %s",
		dir, oldIDJournalTempDir)

	otherIDJournalOldDir, err := otherJournal.j.move(dir)
	if err != nil {
		return MdID{}, err
	}

	// Set new journal to one with the new revision.
	j.log.CDebugf(ctx, "Moved new journal from %s to %s",
		otherIDJournalOldDir, dir)
	*j, *otherJournal = *otherJournal, *j

	// Transform the other journal into the old journal, so we can
	// clear it out.
	err = otherJournal.clear(ctx, bid)
	if err != nil {
		return MdID{}, err
	}

	// Make the defer above remove the old temp dir.
	idJournalTempDir = oldIDJournalTempDir

	return mdID, nil
}
