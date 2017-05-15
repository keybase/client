// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"path/filepath"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
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
	tlf.Handle, error) {
	return ibrmd.BareRootMetadata.MakeBareTlfHandle(ibrmd.extra)
}

// mdJournal stores a single ordered list of metadata IDs for a (TLF,
// user, device) tuple, along with the associated metadata objects, in
// flat files on disk in a directory. The directory may be shared with
// other things, but it is assumed that any subdirectories created by
// mdJournal is not used by anything else.
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
	tlfID  tlf.ID
	mdVer  MetadataVer
	dir    string

	log      logger.Logger
	deferLog logger.Logger

	j mdIDJournal

	// branchID is the BranchID that every MD in the journal is set
	// to, except for when it is PendingLocalSquashBranchID, in which
	// case the journal is a bunch of MDs with a null branchID
	// followed by a bunch of MDs with bid =
	// PendingLocalSquashBranchID.
	//
	// branchID doesn't need to be persisted, even if the journal
	// becomes empty, since on a restart the branch ID is retrieved
	// from the server (via GetUnmergedForTLF).
	branchID BranchID

	// Set only when the journal becomes empty due to
	// flushing. This doesn't need to be persisted for the same
	// reason as branchID.
	lastMdID MdID
}

func makeMDJournalWithIDJournal(
	ctx context.Context, uid keybase1.UID, key kbfscrypto.VerifyingKey,
	codec kbfscodec.Codec, crypto cryptoPure, clock Clock, tlfID tlf.ID,
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
		return nil, errors.Errorf("has earliest=%t != has latest=%t",
			earliest != nil,
			latest != ImmutableBareRootMetadata{})
	}

	if earliest != nil {
		if earliest.BID() != latest.BID() &&
			!(earliest.BID() == NullBranchID &&
				latest.BID() == PendingLocalSquashBranchID) {
			return nil, errors.Errorf(
				"earliest.BID=%s != latest.BID=%s",
				earliest.BID(), latest.BID())
		}
		log.CDebugf(ctx, "Initializing with branch ID %s", latest.BID())
		journal.branchID = latest.BID()
	}

	return &journal, nil
}

func mdJournalPath(dir string) string {
	return filepath.Join(dir, "md_journal")
}

func makeMDJournal(
	ctx context.Context, uid keybase1.UID, key kbfscrypto.VerifyingKey,
	codec kbfscodec.Codec, crypto cryptoPure, clock Clock, tlfID tlf.ID,
	mdVer MetadataVer, dir string,
	log logger.Logger) (*mdJournal, error) {
	journalDir := mdJournalPath(dir)
	idJournal, err := makeMdIDJournal(codec, journalDir)
	if err != nil {
		return nil, err
	}
	return makeMDJournalWithIDJournal(
		ctx, uid, key, codec, crypto, clock, tlfID, mdVer, dir,
		idJournal, log)
}

// The functions below are for building various paths.

func (j mdJournal) mdsPath() string {
	return filepath.Join(j.dir, "mds")
}

func (j mdJournal) writerKeyBundlesV3Path() string {
	return filepath.Join(j.dir, "wkbv3")
}

func (j mdJournal) readerKeyBundlesV3Path() string {
	return filepath.Join(j.dir, "rkbv3")
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
	return filepath.Join(j.writerKeyBundlesV3Path(), idStr[:34])
}

func (j mdJournal) readerKeyBundleV3Path(id TLFReaderKeyBundleID) string {
	idStr := id.String()
	return filepath.Join(j.readerKeyBundlesV3Path(), idStr[:34])
}

func (j mdJournal) mdJournalDirs() []string {
	return []string{
		mdJournalPath(j.dir), j.mdsPath(),
		j.writerKeyBundlesV3Path(), j.readerKeyBundlesV3Path(),
	}
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
	var info mdInfo
	err := ioutil.DeserializeFromJSONFile(j.mdInfoPath(id), &info)
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
	return ioutil.SerializeToJSONFile(info, j.mdInfoPath(id))
}

// getExtraMetadata gets the extra metadata corresponding to the given
// IDs, if any, after checking them.
func (j mdJournal) getExtraMetadata(
	wkbID TLFWriterKeyBundleID, rkbID TLFReaderKeyBundleID,
	wkbNew, rkbNew bool) (ExtraMetadata, error) {
	if (wkbID == TLFWriterKeyBundleID{}) !=
		(rkbID == TLFReaderKeyBundleID{}) {
		return nil, errors.Errorf(
			"wkbID is empty (%t) != rkbID is empty (%t)",
			wkbID == TLFWriterKeyBundleID{},
			rkbID == TLFReaderKeyBundleID{})
	}

	if wkbID == (TLFWriterKeyBundleID{}) {
		return nil, nil
	}

	wkb, err := DeserializeTLFWriterKeyBundleV3(
		j.codec, j.writerKeyBundleV3Path(wkbID))
	if err != nil {
		return nil, err
	}

	err = checkWKBID(j.crypto, wkbID, wkb)
	if err != nil {
		return nil, err
	}

	rkb, err := DeserializeTLFReaderKeyBundleV3(
		j.codec, j.readerKeyBundleV3Path(rkbID))
	if err != nil {
		return nil, err
	}

	err = checkRKBID(j.crypto, rkbID, rkb)
	if err != nil {
		return nil, err
	}

	return NewExtraMetadataV3(wkb, rkb, wkbNew, rkbNew), nil
}

func (j mdJournal) putExtraMetadata(rmd BareRootMetadata, extra ExtraMetadata) (
	wkbNew, rkbNew bool, err error) {
	wkbID := rmd.GetTLFWriterKeyBundleID()
	rkbID := rmd.GetTLFReaderKeyBundleID()

	if extra == nil {
		if wkbID != (TLFWriterKeyBundleID{}) {
			panic(errors.Errorf("unexpected non-nil wkbID %s", wkbID))
		}
		if rkbID != (TLFReaderKeyBundleID{}) {
			panic(errors.Errorf("unexpected non-nil rkbID %s", rkbID))
		}
		return false, false, nil
	}

	if wkbID == (TLFWriterKeyBundleID{}) {
		panic("writer key bundle ID is empty")
	}

	if rkbID == (TLFReaderKeyBundleID{}) {
		panic("reader key bundle ID is empty")
	}

	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return false, false, errors.New("Invalid extra metadata")
	}

	// TODO: We lose extraV3.wkbNew and extraV3.rkbNew here. Store
	// it as part of the mdInfo, so we don't needlessly send it
	// while flushing.

	err = checkWKBID(j.crypto, wkbID, extraV3.wkb)
	if err != nil {
		return false, false, err
	}

	err = checkRKBID(j.crypto, rkbID, extraV3.rkb)
	if err != nil {
		return false, false, err
	}

	err = kbfscodec.SerializeToFileIfNotExist(
		j.codec, extraV3.wkb, j.writerKeyBundleV3Path(wkbID))
	if err != nil {
		return false, false, err
	}

	err = kbfscodec.SerializeToFileIfNotExist(
		j.codec, extraV3.rkb, j.readerKeyBundleV3Path(rkbID))
	if err != nil {
		return false, false, err
	}

	return extraV3.wkbNew, extraV3.rkbNew, nil
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
func (j mdJournal) getMDAndExtra(entry mdIDJournalEntry, verifyBranchID bool) (
	MutableBareRootMetadata, ExtraMetadata, time.Time, error) {
	// Read info.

	timestamp, version, err := j.getMDInfo(entry.ID)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	// Read data.

	p := j.mdDataPath(entry.ID)
	data, err := ioutil.ReadFile(p)
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

	if mdID != entry.ID {
		return nil, nil, time.Time{}, errors.Errorf(
			"Metadata ID mismatch: expected %s, got %s",
			entry.ID, mdID)
	}

	err = rmd.IsLastModifiedBy(j.uid, j.key)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	extra, err := j.getExtraMetadata(
		rmd.GetTLFWriterKeyBundleID(), rmd.GetTLFReaderKeyBundleID(),
		entry.WKBNew, entry.RKBNew)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	err = rmd.IsValidAndSigned(j.codec, j.crypto, extra)
	if err != nil {
		return nil, nil, time.Time{}, err
	}

	if verifyBranchID && rmd.BID() != j.branchID &&
		!(rmd.BID() == NullBranchID && j.branchID == PendingLocalSquashBranchID) {
		return nil, nil, time.Time{}, errors.Errorf(
			"Branch ID mismatch: expected %s, got %s",
			j.branchID, rmd.BID())
	}

	return rmd, extra, timestamp, nil
}

// putMD stores the given metadata under its ID, if it's not already
// stored. The extra metadata is put separately, since sometimes,
// (e.g., when converting to a branch) we don't need to put it.
func (j mdJournal) putMD(rmd BareRootMetadata) (MdID, error) {
	// TODO: Make crypto and RMD wrap errors.

	err := rmd.IsLastModifiedBy(j.uid, j.key)
	if err != nil {
		return MdID{}, err
	}

	id, err := j.crypto.MakeMdID(rmd)
	if err != nil {
		return MdID{}, err
	}

	_, err = ioutil.Stat(j.mdDataPath(id))
	if ioutil.IsNotExist(err) {
		// Continue on.
	} else if err != nil {
		return MdID{}, err
	} else {
		// Entry exists, so nothing else to do.
		return id, nil
	}

	err = kbfscodec.SerializeToFileIfNotExist(
		j.codec, rmd, j.mdDataPath(id))
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
	err := ioutil.RemoveAll(path)
	if err != nil {
		return err
	}

	// Remove the parent (splayed) directory (which should exist)
	// if it's empty.
	err = ioutil.Remove(filepath.Dir(path))
	if ioutil.IsExist(err) {
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
	earliest, extra, timestamp, err :=
		j.getMDAndExtra(entry, verifyBranchID)
	if err != nil {
		return MdID{}, nil, nil, time.Time{}, err
	}
	return entry.ID, earliest, extra, timestamp, nil
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
	latest, extra, timestamp, err :=
		j.getMDAndExtra(entry, verifyBranchID)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	return MakeImmutableBareRootMetadata(
		latest, extra, entry.ID, timestamp), nil
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
	ctx context.Context, bid BranchID, signer kbfscrypto.Signer,
	codec kbfscodec.Codec, tlfID tlf.ID, mdcache MDCache) (err error) {
	if j.branchID != NullBranchID {
		return errors.Errorf(
			"convertToBranch called with j.branchID=%s", j.branchID)
	}
	if bid == NullBranchID {
		return errors.Errorf(
			"convertToBranch called with null branchID")
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

	_, allEntries, err := j.j.getEntryRange(
		earliestRevision, latestRevision)
	if err != nil {
		return err
	}

	j.log.CDebugf(ctx, "New branch ID=%s", bid)

	journalTempDir, err := ioutil.TempDir(j.dir, "md_journal")
	if err != nil {
		return err
	}
	j.log.CDebugf(ctx, "Using temp dir %s for rewriting", journalTempDir)

	mdsToRemove := make([]MdID, 0, len(allEntries))
	defer func() {
		// If we crash here and leave behind the tempdir, it
		// won't be cleaned up automatically when the journal
		// is completely drained, but it'll be cleaned up when
		// the parent journal (i.e., tlfJournal) is completely
		// drained. As for the entries, they'll be cleaned up
		// the next time the journal is completely drained.

		j.log.CDebugf(ctx, "Removing temp dir %s and %d old MDs",
			journalTempDir, len(mdsToRemove))
		removeErr := ioutil.RemoveAll(journalTempDir)
		if removeErr != nil {
			j.log.CWarningf(ctx,
				"Error when removing temp dir %s: %+v",
				journalTempDir, removeErr)
		}
		// Garbage-collect the unnecessary MD entries.
		for _, id := range mdsToRemove {
			removeErr := j.removeMD(id)
			if removeErr != nil {
				j.log.CWarningf(ctx, "Error when removing old MD %s: %+v",
					id, removeErr)
			}
		}
	}()

	tempJournal, err := makeMdIDJournal(j.codec, journalTempDir)
	if err != nil {
		return err
	}

	var prevID MdID

	isPendingLocalSquash := bid == PendingLocalSquashBranchID
	for _, entry := range allEntries {
		brmd, _, ts, err := j.getMDAndExtra(entry, true)
		if err != nil {
			return err
		}

		if entry.IsLocalSquash && isPendingLocalSquash {
			// If this is a local squash, don't convert it.  We don't
			// want to squash anything more into it.
			j.log.CDebugf(ctx, "Preserving local squash %s", entry.ID)
			err = tempJournal.append(brmd.RevisionNumber(), entry)
			if err != nil {
				return err
			}
			continue
		}

		brmd.SetUnmerged()
		brmd.SetBranchID(bid)

		// Re-sign the writer metadata internally, since we
		// changed it.
		err = brmd.SignWriterMetadataInternally(ctx, j.codec, signer)
		if err != nil {
			j.log.CDebugf(ctx, "Early exit %d %+v", brmd.RevisionNumber(), err)
			return err
		}

		// Set the prev root for everything after the first MD we
		// modify, which happens to be indicated by mdsToRemove being
		// non-empty.
		if len(mdsToRemove) > 0 {
			j.log.CDebugf(ctx, "Old prev root of rev=%s is %s",
				brmd.RevisionNumber(), brmd.GetPrevRoot())
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
			return err
		}
		mdsToRemove = append(mdsToRemove, newID)

		// Preserve unknown fields from the old journal.
		newEntry := entry
		newEntry.ID = newID
		newEntry.IsLocalSquash = false
		err = tempJournal.append(brmd.RevisionNumber(), newEntry)
		if err != nil {
			return err
		}

		prevID = newID

		// If possible, replace the old RMD in the cache.  If it's not
		// already in the cache, don't bother adding it, as that will
		// just evict something incorrectly.  If it's been replaced by
		// the REAL commit from the master branch due to a race, don't
		// clobber that real commit. TODO: Don't replace the MD until
		// we know for sure that the branch conversion succeeds
		// (however, the Replace doesn't affect correctness since the
		// original commit will be read from disk instead of the cache
		// in the event of a conversion failure).
		oldIrmd, err := mdcache.Get(
			tlfID, brmd.RevisionNumber(), NullBranchID)
		if err == nil && entry.ID == oldIrmd.mdID {
			newRmd, err := oldIrmd.deepCopy(codec)
			if err != nil {
				return err
			}
			newRmd.bareMd = brmd
			// Everything else is the same.
			err = mdcache.Replace(
				MakeImmutableRootMetadata(newRmd,
					oldIrmd.LastModifyingWriterVerifyingKey(),
					newID, ts),
				NullBranchID)
			if err != nil {
				return err
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
		return err
	}

	j.log.CDebugf(ctx, "Moved old journal from %s to %s",
		dir, oldJournalTempDir)

	newJournalOldDir, err := tempJournal.move(dir)
	if err != nil {
		return err
	}

	j.log.CDebugf(ctx, "Moved new journal from %s to %s",
		newJournalOldDir, dir)

	// Make the defer block above remove oldJournalTempDir.
	journalTempDir = oldJournalTempDir

	mdsToRemove = make([]MdID, 0, len(allEntries))
	for _, entry := range allEntries {
		if entry.IsLocalSquash && isPendingLocalSquash {
			continue
		}
		mdsToRemove = append(mdsToRemove, entry.ID)
	}

	j.j = tempJournal
	j.branchID = bid

	return nil
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
	ctx context.Context, mdID MdID, rmds *RootMetadataSigned) (
	clearedMDJournal bool, err error) {
	rmdID, rmd, _, _, err := j.getEarliestWithExtra(true)
	if err != nil {
		return false, err
	}
	if rmd == nil {
		return false, errors.New("mdJournal unexpectedly empty")
	}

	if mdID != rmdID {
		return false, errors.Errorf("Expected mdID %s, got %s", mdID, rmdID)
	}

	eq, err := kbfscodec.Equal(j.codec, rmd, rmds.MD)
	if err != nil {
		return false, err
	}
	if !eq {
		return false, errors.New(
			"Given RootMetadataSigned doesn't match earliest")
	}

	empty, err := j.j.removeEarliest()
	if err != nil {
		return false, err
	}

	// Since the journal is now empty, set lastMdID and nuke all
	// MD-related directories.
	if empty {
		j.log.CDebugf(ctx,
			"MD journal is now empty; saving last MdID=%s", mdID)
		j.lastMdID = mdID

		// The disk journal has already been cleared, so we
		// can nuke the directories without having to worry
		// about putting the journal in a weird state if we
		// crash in the middle. The various directories will
		// be recreated as needed.
		for _, dir := range j.mdJournalDirs() {
			j.log.CDebugf(ctx, "Removing all files in %s", dir)
			err := ioutil.RemoveAll(dir)
			if err != nil {
				return false, err
			}
		}

		return true, nil
	}

	// Garbage-collect the old entry. If we crash here and
	// leave behind an entry, it'll be cleaned up the next
	// time the journal is completely drained.
	err = j.removeMD(mdID)
	if err != nil {
		return false, err
	}

	return false, nil
}

func getMdID(ctx context.Context, mdserver MDServer, crypto cryptoPure,
	tlfID tlf.ID, bid BranchID, mStatus MergeStatus,
	revision MetadataRevision) (MdID, error) {
	rmdses, err := mdserver.GetRange(
		ctx, tlfID, bid, mStatus, revision, revision)
	if err != nil {
		return MdID{}, err
	} else if len(rmdses) == 0 {
		return MdID{}, nil
	} else if len(rmdses) > 1 {
		return MdID{}, errors.Errorf(
			"Got more than one object when trying to get rev=%d for branch %s of TLF %s",
			revision, bid, tlfID)
	}

	return crypto.MakeMdID(rmdses[0].MD)
}

// clearHelper removes all the journal entries starting from
// earliestBranchRevision and deletes the corresponding MD
// updates. All MDs from earliestBranchRevision onwards must have
// branch equal to the given one, which must not be NullBranchID. This
// means that, if bid != PendingLocalSquashBranchID,
// earliestBranchRevision must equal the earliest revision, and if bid
// == PendingLocalSquashBranchID, earliestBranchRevision must equal
// one past the last local squash revision. If the branch is a pending
// local squash, it preserves the MD updates corresponding to the
// prefix of existing local squashes, so they can be re-used in the
// newly-resolved journal.
func (j *mdJournal) clearHelper(ctx context.Context, bid BranchID,
	earliestBranchRevision MetadataRevision) (err error) {
	j.log.CDebugf(ctx, "Clearing journal for branch %s", bid)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Clearing journal for branch %s failed with %+v",
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

	head, err := j.getHead(bid)
	if err != nil {
		return err
	}

	if head == (ImmutableBareRootMetadata{}) {
		// The journal has been flushed but not cleared yet.
		j.branchID = NullBranchID
		return nil
	}

	if head.BID() != j.branchID {
		return errors.Errorf("Head branch ID %s doesn't match journal "+
			"branch ID %s while clearing", head.BID(), j.branchID)
	}

	latestRevision, err := j.j.readLatestRevision()
	if err != nil {
		return err
	}

	_, allEntries, err := j.j.getEntryRange(
		earliestBranchRevision, latestRevision)
	if err != nil {
		return err
	}

	err = j.j.clearFrom(earliestBranchRevision)
	if err != nil {
		return err
	}

	j.branchID = NullBranchID

	// No need to set lastMdID in this case.

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

// All functions below are public functions.

func (j mdJournal) readEarliestRevision() (MetadataRevision, error) {
	return j.j.readEarliestRevision()
}

func (j mdJournal) readLatestRevision() (MetadataRevision, error) {
	return j.j.readLatestRevision()
}

func (j mdJournal) length() uint64 {
	return j.j.length()
}

func (j mdJournal) atLeastNNonLocalSquashes(
	numNonLocalSquashes uint64) (bool, error) {
	size := j.length()
	if size < numNonLocalSquashes {
		return false, nil
	}

	latestRev, err := j.readLatestRevision()
	if err != nil {
		return false, err
	}

	// Since the IsLocalSquash entries are guaranteed to be a prefix
	// of the journal, we can just look up an entry that's back
	// `numNonLocalSquashes` entries ago, and see if it's a local
	// squash or not.
	entry, err := j.j.readJournalEntry(
		latestRev - MetadataRevision(numNonLocalSquashes) + 1)
	if err != nil {
		return false, err
	}

	return !entry.IsLocalSquash, nil
}

func (j mdJournal) end() (MetadataRevision, error) {
	return j.j.end()
}

func (j mdJournal) getBranchID() BranchID {
	return j.branchID
}

func (j mdJournal) getHead(bid BranchID) (ImmutableBareRootMetadata, error) {
	head, err := j.checkGetParams()
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}
	if head == (ImmutableBareRootMetadata{}) {
		return ImmutableBareRootMetadata{}, nil
	}

	getLocalSquashHead := bid == NullBranchID &&
		j.branchID == PendingLocalSquashBranchID
	if !getLocalSquashHead {
		if head.BID() != bid {
			return ImmutableBareRootMetadata{}, nil
		}
		return head, nil
	}

	// Look backwards in the journal for the first entry with
	// IsLocalSquash set to true.
	earliestRev, err := j.readEarliestRevision()
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	latestRev, err := j.readLatestRevision()
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	for rev := latestRev; rev >= earliestRev; rev-- {
		entry, err := j.j.readJournalEntry(rev)
		if err != nil {
			return ImmutableBareRootMetadata{}, err
		}
		if entry.IsLocalSquash {
			latest, extra, timestamp, err :=
				j.getMDAndExtra(entry, false)
			if err != nil {
				return ImmutableBareRootMetadata{}, err
			}
			return MakeImmutableBareRootMetadata(
				latest, extra, entry.ID, timestamp), nil
		}
	}
	return ImmutableBareRootMetadata{}, nil
}

func (j mdJournal) getRange(bid BranchID, start, stop MetadataRevision) (
	[]ImmutableBareRootMetadata, error) {
	head, err := j.checkGetParams()
	if err != nil {
		return nil, err
	} else if head == (ImmutableBareRootMetadata{}) {
		return nil, nil
	}

	// If we are on a pending local squash branch, the caller can ask
	// for "merged" entries that make up a prefix of the journal.
	getLocalSquashPrefix := bid == NullBranchID &&
		j.branchID == PendingLocalSquashBranchID
	if head.BID() != bid && !getLocalSquashPrefix {
		return nil, nil
	}

	realStart, entries, err := j.j.getEntryRange(start, stop)
	if err != nil {
		return nil, err
	}
	var ibrmds []ImmutableBareRootMetadata
	for i, entry := range entries {
		if getLocalSquashPrefix && !entry.IsLocalSquash {
			// We only need the prefix up to the first non-local-squash.
			break
		} else if entry.IsLocalSquash && bid == PendingLocalSquashBranchID {
			// Ignore the local squash prefix of this journal.
			continue
		}

		expectedRevision := realStart + MetadataRevision(i)
		brmd, extra, ts, err := j.getMDAndExtra(entry, true)
		if err != nil {
			return nil, err
		}

		if expectedRevision != brmd.RevisionNumber() {
			panic(errors.Errorf("expected revision %v, got %v",
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
	ekg encryptionKeyGetter, bsplit BlockSplitter, rmd *RootMetadata,
	isLocalSquash bool) (
	mdID MdID, err error) {
	j.log.CDebugf(ctx, "Putting MD for TLF=%s with rev=%s bid=%s",
		rmd.TlfID(), rmd.Revision(), rmd.BID())
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Put MD for TLF=%s with rev=%s bid=%s failed with %+v",
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
		return MdID{}, errors.Errorf(
			"mStatus=%s doesn't match bid=%s", mStatus, rmd.BID())
	}

	// If we're trying to push a merged MD onto a branch, return a
	// conflict error so the caller can retry with an unmerged MD.
	if mStatus == Merged && j.branchID != NullBranchID {
		return MdID{}, MDJournalConflictError{}
	}

	if rmd.BID() != j.branchID {
		return MdID{}, errors.Errorf(
			"Branch ID mismatch: expected %s, got %s",
			j.branchID, rmd.BID())
	}

	if isLocalSquash && rmd.BID() != NullBranchID {
		return MdID{}, errors.Errorf("A local squash must have a null branch ID,"+
			" but this one has bid=%s", rmd.BID())
	}

	// Check permissions and consistency with head, if it exists.
	if head != (ImmutableBareRootMetadata{}) {
		ok, err := isWriterOrValidRekey(
			j.codec, j.uid, head.BareRootMetadata, rmd.bareMd,
			head.extra, rmd.extra)
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

		// Local squashes should only be preceded by another local
		// squash in the journal.
		if isLocalSquash {
			entry, exists, err := j.j.getLatestEntry()
			if err != nil {
				return MdID{}, err
			}
			if exists && !entry.IsLocalSquash {
				return MdID{}, errors.Errorf("Local squash is not preceded "+
					"by a local squash (head=%s)", entry.ID)
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

	err = rmd.bareMd.IsValidAndSigned(j.codec, j.crypto, rmd.extra)
	if err != nil {
		return MdID{}, err
	}

	id, err := j.putMD(rmd.bareMd)
	if err != nil {
		return MdID{}, err
	}

	wkbNew, rkbNew, err := j.putExtraMetadata(rmd.bareMd, rmd.extra)
	if err != nil {
		return MdID{}, err
	}

	newEntry := mdIDJournalEntry{
		ID:            id,
		IsLocalSquash: isLocalSquash,
		WKBNew:        wkbNew,
		RKBNew:        rkbNew,
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
		err = j.j.replaceHead(newEntry)
		if err != nil {
			return MdID{}, err
		}
	} else {
		err = j.j.append(rmd.Revision(), newEntry)
		if err != nil {
			return MdID{}, err
		}
	}

	// Since the journal is now non-empty, clear lastMdID.
	j.lastMdID = MdID{}

	return id, nil
}

// clear removes all the journal entries, and deletes the
// corresponding MD updates.  If the branch is a pending local squash,
// it preserves the MD updates corresponding to the prefix of existing
// local squashes, so they can be re-used in the newly-resolved
// journal.
func (j *mdJournal) clear(ctx context.Context, bid BranchID) error {
	earliestBranchRevision, err := j.j.readEarliestRevision()
	if err != nil {
		return err
	}

	if earliestBranchRevision != MetadataRevisionUninitialized &&
		bid == PendingLocalSquashBranchID {
		latestRevision, err := j.j.readLatestRevision()
		if err != nil {
			return err
		}

		for ; earliestBranchRevision <= latestRevision; earliestBranchRevision++ {
			entry, err := j.j.readJournalEntry(earliestBranchRevision)
			if err != nil {
				return err
			}
			if !entry.IsLocalSquash {
				break
			}
		}
	}

	return j.clearHelper(ctx, bid, earliestBranchRevision)
}

func (j *mdJournal) resolveAndClear(
	ctx context.Context, signer kbfscrypto.Signer, ekg encryptionKeyGetter,
	bsplit BlockSplitter, mdcache MDCache, bid BranchID, rmd *RootMetadata) (
	mdID MdID, err error) {
	j.log.CDebugf(ctx, "Resolve and clear, branch %s, resolve rev %d",
		bid, rmd.Revision())
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Resolving journal for branch %s failed with %+v",
				bid, err)
		}
	}()

	// The resolution must not have a branch ID.
	if rmd.BID() != NullBranchID {
		return MdID{}, errors.Errorf("Resolution MD has branch ID: %s", rmd.BID())
	}

	// The branch ID must match our current state.
	if bid == NullBranchID {
		return MdID{}, errors.New("Cannot resolve master branch")
	}
	if j.branchID != bid {
		return MdID{}, errors.Errorf("Resolve and clear for branch %s "+
			"while on branch %s", bid, j.branchID)
	}

	earliestBranchRevision, err := j.j.readEarliestRevision()
	if err != nil {
		return MdID{}, err
	}

	latestRevision, err := j.j.readLatestRevision()
	if err != nil {
		return MdID{}, err
	}

	// First make a new journal to hold the block.

	// Give this new journal a new ID journal.
	idJournalTempDir, err := ioutil.TempDir(j.dir, "md_journal")
	if err != nil {
		return MdID{}, err
	}

	// TODO: If we crash without removing the temp dir, it should
	// be cleaned up whenever the entire journal goes empty.

	j.log.CDebugf(ctx, "Using temp dir %s for new IDs", idJournalTempDir)
	otherIDJournal, err := makeMdIDJournal(j.codec, idJournalTempDir)
	if err != nil {
		return MdID{}, err
	}
	defer func() {
		j.log.CDebugf(ctx, "Removing temp dir %s", idJournalTempDir)
		removeErr := ioutil.RemoveAll(idJournalTempDir)
		if removeErr != nil {
			j.log.CWarningf(ctx,
				"Error when removing temp dir %s: %+v",
				idJournalTempDir, removeErr)
		}
	}()

	otherJournal, err := makeMDJournalWithIDJournal(
		ctx, j.uid, j.key, j.codec, j.crypto, j.clock, j.tlfID, j.mdVer, j.dir,
		otherIDJournal, j.log)
	if err != nil {
		return MdID{}, err
	}

	// Put the local squashes back into the new journal, since they
	// weren't part of the resolve.
	if bid == PendingLocalSquashBranchID {
		for ; earliestBranchRevision <= latestRevision; earliestBranchRevision++ {
			entry, err := j.j.readJournalEntry(earliestBranchRevision)
			if err != nil {
				return MdID{}, err
			}
			if !entry.IsLocalSquash {
				break
			}
			j.log.CDebugf(ctx, "Preserving entry %s", entry.ID)
			otherIDJournal.append(earliestBranchRevision, entry)
		}
	}

	mdID, err = otherJournal.put(ctx, signer, ekg, bsplit, rmd, true)
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

	// Transform the other journal into the old journal and clear
	// it out.
	*j, *otherJournal = *otherJournal, *j
	err = otherJournal.clearHelper(ctx, bid, earliestBranchRevision)
	if err != nil {
		return MdID{}, err
	}

	// Make the defer above remove the old temp dir.
	idJournalTempDir = oldIDJournalTempDir

	// Delete all of the branch MDs from the md cache.
	for rev := earliestBranchRevision; rev <= latestRevision; rev++ {
		mdcache.Delete(j.tlfID, rev, bid)
	}

	return mdID, nil
}

// markLatestAsLocalSquash marks the head revision as a local squash,
// without the need to go through resolveAndClear.  It's assumed that
// the caller already guaranteed that there is no more than 1
// non-local-squash at the end of the journal.
func (j *mdJournal) markLatestAsLocalSquash(ctx context.Context) error {
	if j.branchID != NullBranchID {
		return errors.Errorf("Can't mark latest as local squash when on a "+
			"branch (bid=%s)", j.branchID)
	}

	entry, exists, err := j.j.getLatestEntry()
	if err != nil {
		return err
	}
	if !exists || entry.IsLocalSquash {
		return nil
	}

	entry.IsLocalSquash = true
	return j.j.replaceHead(entry)
}
