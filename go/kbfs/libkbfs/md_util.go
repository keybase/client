// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type mdRange struct {
	start kbfsmd.Revision
	end   kbfsmd.Revision
}

func makeRekeyReadErrorHelper(
	err error, kmd KeyMetadata, resolvedHandle *TlfHandle,
	uid keybase1.UID, username kbname.NormalizedUsername) error {
	if resolvedHandle.Type() == tlf.Public {
		panic("makeRekeyReadError called on public folder")
	}
	// If the user is not a legitimate reader of the folder, this is a
	// normal read access error.
	if !resolvedHandle.IsReader(uid) {
		return NewReadAccessError(resolvedHandle, username, resolvedHandle.GetCanonicalPath())
	}

	// Otherwise, this folder needs to be rekeyed for this device.
	tlfName := resolvedHandle.GetCanonicalName()
	hasKeys, hasKeyErr := kmd.HasKeyForUser(uid)
	if (hasKeyErr == nil) && hasKeys {
		return NeedSelfRekeyError{tlfName, err}
	}
	return NeedOtherRekeyError{tlfName, err}
}

func makeRekeyReadError(
	ctx context.Context, err error, kbpki KBPKI, kmd KeyMetadata,
	uid keybase1.UID, username kbname.NormalizedUsername) error {
	h := kmd.GetTlfHandle()
	resolvedHandle, resolveErr := h.ResolveAgain(ctx, kbpki, nil)
	if resolveErr != nil {
		// Ignore error and pretend h is already fully
		// resolved.
		resolvedHandle = h
	}
	return makeRekeyReadErrorHelper(err, kmd, resolvedHandle, uid, username)
}

// Helper which returns nil if the md block is uninitialized or readable by
// the current user. Otherwise an appropriate read access error is returned.
func isReadableOrError(
	ctx context.Context, kbpki KBPKI, md ReadOnlyRootMetadata) error {
	if !md.IsInitialized() || md.IsReadable() {
		return nil
	}
	// this should only be the case if we're a new device not yet
	// added to the set of reader/writer keys.
	session, err := kbpki.GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	err = errors.Errorf("%s is not readable by %s (uid:%s)", md.TlfID(),
		session.Name, session.UID)
	return makeRekeyReadError(ctx, err, kbpki, md,
		session.UID, session.Name)
}

func getMDRange(ctx context.Context, config Config, id tlf.ID, bid kbfsmd.BranchID,
	start kbfsmd.Revision, end kbfsmd.Revision, mStatus kbfsmd.MergeStatus,
	lockBeforeGet *keybase1.LockID) (rmds []ImmutableRootMetadata, err error) {
	// The range is invalid.  Don't treat as an error though; it just
	// indicates that we don't yet know about any revisions.
	if start < kbfsmd.RevisionInitial || end < kbfsmd.RevisionInitial {
		return nil, nil
	}

	mdcache := config.MDCache()
	var toDownload []mdRange

	// Fetch one at a time, and figure out what ranges to fetch as you
	// go.
	minSlot := int(end-start) + 1
	maxSlot := -1
	for i := start; i <= end; i++ {
		irmd, err := mdcache.Get(id, i, bid)
		if err != nil {
			if len(toDownload) == 0 ||
				toDownload[len(toDownload)-1].end != i-1 {
				toDownload = append(toDownload, mdRange{i, i})
			}
			toDownload[len(toDownload)-1].end = i
			irmd = ImmutableRootMetadata{}
		} else {
			slot := len(rmds)
			if slot < minSlot {
				minSlot = slot
			}
			if slot > maxSlot {
				maxSlot = slot
			}
		}
		rmds = append(rmds, irmd)
	}

	// Try to fetch the rest from the server.  TODO: parallelize me.
	for _, r := range toDownload {
		var fetchedRmds []ImmutableRootMetadata
		switch mStatus {
		case kbfsmd.Merged:
			fetchedRmds, err = config.MDOps().GetRange(
				ctx, id, r.start, r.end, lockBeforeGet)
		case kbfsmd.Unmerged:
			fetchedRmds, err = config.MDOps().GetUnmergedRange(
				ctx, id, bid, r.start, r.end)
		default:
			panic(fmt.Sprintf("Unknown merged type: %s", mStatus))
		}
		if err != nil {
			return nil, err
		}

		for _, rmd := range fetchedRmds {
			slot := int(rmd.Revision() - start)
			if slot < minSlot {
				minSlot = slot
			}
			if slot > maxSlot {
				maxSlot = slot
			}

			rmds[slot] = rmd

			// We don't cache the MD here, since it's already done in
			// `MDOpsStandard` for MDs that come from a remote server.
			// MDs that come from the local journal don't get cached
			// as part of a get, to avoid races as in KBFS-2224.
		}
	}

	if minSlot > maxSlot {
		return nil, nil
	}

	rmds = rmds[minSlot : maxSlot+1]
	// check to make sure there are no holes
	for i, rmd := range rmds {
		if rmd == (ImmutableRootMetadata{}) {
			return nil, fmt.Errorf("No %s MD found for revision %d",
				mStatus, int(start)+minSlot+i)
		}
	}

	return rmds, nil
}

// getSingleMD returns an MD that is required to exist.
func getSingleMD(ctx context.Context, config Config, id tlf.ID, bid kbfsmd.BranchID,
	rev kbfsmd.Revision, mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (
	ImmutableRootMetadata, error) {
	rmds, err := getMDRange(
		ctx, config, id, bid, rev, rev, mStatus, lockBeforeGet)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if len(rmds) != 1 {
		return ImmutableRootMetadata{},
			fmt.Errorf("Single expected revision %d not found", rev)
	}
	return rmds[0], nil
}

// MakeCopyWithDecryptedPrivateData makes a copy of the given IRMD,
// decrypting it with the given IRMD with keys.
func MakeCopyWithDecryptedPrivateData(
	ctx context.Context, config Config,
	irmdToDecrypt, irmdWithKeys ImmutableRootMetadata, uid keybase1.UID) (
	rmdDecrypted ImmutableRootMetadata, err error) {
	pmd, err := decryptMDPrivateData(
		ctx, config.Codec(), config.Crypto(),
		config.BlockCache(), config.BlockOps(),
		config.KeyManager(), config.KBPKI(), config.Mode(), uid,
		irmdToDecrypt.GetSerializedPrivateMetadata(),
		irmdToDecrypt, irmdWithKeys, config.MakeLogger(""))
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	rmdCopy, err := irmdToDecrypt.deepCopy(config.Codec())
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmdCopy.data = pmd
	return MakeImmutableRootMetadata(rmdCopy,
		irmdToDecrypt.LastModifyingWriterVerifyingKey(),
		irmdToDecrypt.MdID(),
		irmdToDecrypt.LocalTimestamp(),
		irmdToDecrypt.putToServer), nil
}

func getMergedMDUpdatesWithEnd(ctx context.Context, config Config, id tlf.ID,
	startRev kbfsmd.Revision, endRev kbfsmd.Revision,
	lockBeforeGet *keybase1.LockID) (
	mergedRmds []ImmutableRootMetadata, err error) {
	// We don't yet know about any revisions yet, so there's no range
	// to get.
	if startRev < kbfsmd.RevisionInitial {
		return nil, nil
	}

	start := startRev
	for {
		end := start + maxMDsAtATime - 1 // range is inclusive
		if endRev != kbfsmd.RevisionUninitialized && end > endRev {
			end = endRev
		}
		if end < start {
			break
		}
		rmds, err := getMDRange(ctx, config, id, kbfsmd.NullBranchID,
			start, end, kbfsmd.Merged, lockBeforeGet)
		if err != nil {
			return nil, err
		}

		if len(mergedRmds) > 0 && len(rmds) > 0 {
			// Make sure the first new one is a valid successor of the
			// last one.
			lastRmd := mergedRmds[len(mergedRmds)-1]
			err = lastRmd.CheckValidSuccessor(
				lastRmd.mdID, rmds[0].ReadOnlyRootMetadata)
			if err != nil {
				return nil, err
			}
		}

		mergedRmds = append(mergedRmds, rmds...)

		// TODO: limit the number of MDs we're allowed to hold in
		// memory at any one time?
		if len(rmds) < maxMDsAtATime {
			break
		}
		start = end + 1
	}

	var uid keybase1.UID
	// Check the readability of each MD.  Because rekeys can append a
	// MD revision with the new key, older revisions might not be
	// readable until the newer revision, containing the key for this
	// device, is processed.
	for i, rmd := range mergedRmds {
		if err := isReadableOrError(ctx, config.KBPKI(), rmd.ReadOnly()); err != nil {
			// The right secret key for the given rmd's
			// key generation may only be present in the
			// most recent rmd.
			latestRmd := mergedRmds[len(mergedRmds)-1]

			if uid == keybase1.UID("") {
				session, err := config.KBPKI().GetCurrentSession(ctx)
				if err != nil {
					return nil, err
				}
				uid = session.UID
			}

			irmdCopy, err := MakeCopyWithDecryptedPrivateData(
				ctx, config, rmd, latestRmd, uid)
			if err != nil {
				return nil, err
			}
			// Overwrite the cached copy with the new copy.  Unlike in
			// `getMDRange`, it's safe to put this into the cache
			// blindly, since updates coming from our local journal
			// would always be readable, and thus not subject to this
			// rewrite.
			if err := config.MDCache().Put(irmdCopy); err != nil {
				return nil, err
			}
			mergedRmds[i] = irmdCopy
		}
	}
	return mergedRmds, nil
}

// getMergedMDUpdates returns a slice of all the merged MDs for a TLF,
// starting from the given startRev.  The returned MDs are the same
// instances that are stored in the MD cache, so they should be
// modified with care.
//
// TODO: Accept a parameter to express that we want copies of the MDs
// instead of the cached versions.
func getMergedMDUpdates(ctx context.Context, config Config, id tlf.ID,
	startRev kbfsmd.Revision, lockBeforeGet *keybase1.LockID) (
	mergedRmds []ImmutableRootMetadata, err error) {
	return getMergedMDUpdatesWithEnd(
		ctx, config, id, startRev, kbfsmd.RevisionUninitialized, lockBeforeGet)
}

// getUnmergedMDUpdates returns a slice of the unmerged MDs for a TLF
// and unmerged branch, between the merge point for that branch and
// startRev (inclusive).  The returned MDs are the same instances that
// are stored in the MD cache, so they should be modified with care.
// If bid is kbfsmd.NullBranchID, it returns an empty MD list.
//
// TODO: Accept a parameter to express that we want copies of the MDs
// instead of the cached versions.
func getUnmergedMDUpdates(ctx context.Context, config Config, id tlf.ID,
	bid kbfsmd.BranchID, startRev kbfsmd.Revision) (
	currHead kbfsmd.Revision, unmergedRmds []ImmutableRootMetadata,
	err error) {
	if bid == kbfsmd.NullBranchID {
		// We're not really unmerged, so there's nothing to do.
		// TODO: require the caller to avoid making this call if the
		// bid isn't set (and change the mdserver behavior in that
		// case as well).
		return startRev, nil, nil
	}

	// We don't yet know about any revisions yet, so there's no range
	// to get.
	if startRev < kbfsmd.RevisionInitial {
		return kbfsmd.RevisionUninitialized, nil, nil
	}

	// walk backwards until we find one that is merged
	currHead = startRev
	for {
		// first look up all unmerged MD revisions older than my current head
		startRev := currHead - maxMDsAtATime + 1 // (kbfsmd.Revision is signed)
		if startRev < kbfsmd.RevisionInitial {
			startRev = kbfsmd.RevisionInitial
		}

		rmds, err := getMDRange(ctx, config, id, bid, startRev, currHead,
			kbfsmd.Unmerged, nil)
		if err != nil {
			return kbfsmd.RevisionUninitialized, nil, err
		}

		if len(unmergedRmds) > 0 && len(rmds) > 0 {
			// Make sure the first old one is a valid successor of the
			// last new one.
			lastRmd := rmds[len(rmds)-1]
			err = lastRmd.CheckValidSuccessor(
				lastRmd.mdID, unmergedRmds[0].ReadOnlyRootMetadata)
			if err != nil {
				return kbfsmd.RevisionUninitialized, nil, err
			}
		}

		numNew := len(rmds)
		// prepend to keep the ordering correct
		unmergedRmds = append(rmds, unmergedRmds...)

		// on the next iteration, start apply the previous root
		if numNew > 0 {
			currHead = rmds[0].Revision() - 1
		}
		if currHead < kbfsmd.RevisionInitial {
			return kbfsmd.RevisionUninitialized, nil,
				errors.New("ran out of MD updates to unstage")
		}
		// TODO: limit the number of MDs we're allowed to hold in
		// memory at any one time?
		if numNew < maxMDsAtATime {
			break
		}
	}
	return currHead, unmergedRmds, nil
}

// GetMDRevisionByTime returns the revision number of the earliest
// merged MD of `handle` with a server timestamp greater or equal to
// `serverTime`.
func GetMDRevisionByTime(
	ctx context.Context, config Config, handle *TlfHandle,
	serverTime time.Time) (kbfsmd.Revision, error) {
	id := handle.tlfID
	if id == tlf.NullID {
		return kbfsmd.RevisionUninitialized, errors.Errorf(
			"No ID set in handle %s", handle.GetCanonicalPath())
	}

	md, err := config.MDOps().GetForTLFByTime(ctx, id, serverTime)
	if err != nil {
		return kbfsmd.RevisionUninitialized, err
	}

	return md.Revision(), nil
}

// encryptMDPrivateData encrypts the private data of the given
// RootMetadata and makes other modifications to prepare it for
// signing (see signMD below). After this function is called, the
// MetadataID of the RootMetadata's BareRootMetadata can be computed.
func encryptMDPrivateData(
	ctx context.Context, codec kbfscodec.Codec, crypto cryptoPure,
	signer kbfscrypto.Signer, ekg encryptionKeyGetter, me keybase1.UID,
	rmd *RootMetadata) error {
	err := rmd.data.checkValid()
	if err != nil {
		return err
	}

	brmd := rmd.bareMd
	privateData := rmd.data

	if brmd.TypeForKeying() == tlf.PublicKeying ||
		!brmd.IsWriterMetadataCopiedSet() {
		// Record the last writer to modify this writer metadata
		brmd.SetLastModifyingWriter(me)

		if brmd.TypeForKeying() == tlf.PublicKeying {
			// Encode the private metadata
			encodedPrivateMetadata, err := codec.Encode(privateData)
			if err != nil {
				return err
			}
			brmd.SetSerializedPrivateMetadata(encodedPrivateMetadata)
		} else if !brmd.IsWriterMetadataCopiedSet() {
			// Encrypt and encode the private metadata
			k, err := ekg.GetTLFCryptKeyForEncryption(ctx, rmd)
			if err != nil {
				return err
			}
			encryptedPrivateMetadata, err := crypto.EncryptPrivateMetadata(privateData, k)
			if err != nil {
				return err
			}
			encodedEncryptedPrivateMetadata, err := codec.Encode(encryptedPrivateMetadata)
			if err != nil {
				return err
			}
			brmd.SetSerializedPrivateMetadata(encodedEncryptedPrivateMetadata)
		}

		// Sign the writer metadata internally. This has to be
		// done here, instead of in signMD, since the
		// MetadataID may depend on it.
		err := brmd.SignWriterMetadataInternally(ctx, codec, signer)
		if err != nil {
			return err
		}
	}

	// Record the last user to modify this metadata
	brmd.SetLastModifyingUser(me)

	return nil
}

func getFileBlockForMD(ctx context.Context, bcache BlockCacheSimple, bops BlockOps,
	ptr BlockPointer, tlfID tlf.ID, rmdWithKeys KeyMetadata) (
	*FileBlock, error) {
	// We don't have a convenient way to fetch the block from here via
	// folderBlockOps, so just go directly via the
	// BlockCache/BlockOps.  No locking around the blocks is needed
	// since these change blocks are read-only.
	block, err := bcache.Get(ptr)
	if err != nil {
		block = NewFileBlock()
		if err := bops.Get(ctx, rmdWithKeys, ptr, block, TransientEntry); err != nil {
			return nil, err
		}
	}

	fblock, ok := block.(*FileBlock)
	if !ok {
		return nil, NotFileBlockError{ptr, MasterBranch, path{}}
	}
	return fblock, nil
}

func reembedBlockChanges(ctx context.Context, codec kbfscodec.Codec,
	bcache BlockCacheSimple, bops BlockOps, mode InitMode, tlfID tlf.ID,
	pmd *PrivateMetadata, rmdWithKeys KeyMetadata, log logger.Logger) error {
	info := pmd.Changes.Info
	if info.BlockPointer == zeroPtr {
		return nil
	}

	if !mode.BlockManagementEnabled() {
		// Leave the block changes unembedded -- they aren't needed in
		// minimal mode since there's no node cache, and thus there
		// are no Nodes that needs to be updated due to BlockChange
		// pointers in those blocks.
		log.CDebugf(ctx, "Skipping block change reembedding in mode: %s",
			mode.Type())
		return nil
	}

	// Treat the unembedded block change like a file so we can reuse
	// the file reading code.
	file := path{FolderBranch{tlfID, MasterBranch},
		[]pathNode{{
			info.BlockPointer, fmt.Sprintf("<MD with block change pointer %s>",
				info.BlockPointer)}}}
	getter := func(ctx context.Context, kmd KeyMetadata, ptr BlockPointer,
		p path, rtype blockReqType) (*FileBlock, bool, error) {
		block, err := getFileBlockForMD(ctx, bcache, bops, ptr, tlfID, kmd)
		if err != nil {
			return nil, false, err
		}
		return block, false, nil
	}
	cacher := func(_ context.Context, ptr BlockPointer, block Block) error {
		return nil
	}
	// Reading doesn't use crypto or the block splitter, so for now
	// just pass in nil.  Also, reading doesn't depend on the UID, so
	// it's ok to be empty.
	var id keybase1.UserOrTeamID
	fd := newFileData(file, id, nil, nil, rmdWithKeys, getter, cacher, log)

	buf, err := fd.getBytes(ctx, 0, -1)
	if err != nil {
		return err
	}

	var unembeddedChanges BlockChanges
	err = codec.Decode(buf, &unembeddedChanges)
	if err != nil {
		return err
	}

	// We rely on at most one of Info or Ops being non-empty in
	// crChains.addOps.
	if unembeddedChanges.Info.IsInitialized() {
		return errors.New("Unembedded BlockChangesInfo unexpectedly has an initialized Info")
	}

	// The changes block pointers are implicit ref blocks.
	unembeddedChanges.Ops[0].AddRefBlock(info.BlockPointer)
	iptrs, err := fd.getIndirectFileBlockInfos(ctx)
	if err != nil {
		return err
	}
	for _, iptr := range iptrs {
		unembeddedChanges.Ops[0].AddRefBlock(iptr.BlockPointer)
	}

	pmd.Changes = unembeddedChanges
	pmd.cachedChanges.Info = info
	return nil
}

// decryptMDPrivateData does not use uid if the handle is a public one.
func decryptMDPrivateData(ctx context.Context, codec kbfscodec.Codec,
	crypto Crypto, bcache BlockCache, bops BlockOps,
	keyGetter mdDecryptionKeyGetter, teamChecker kbfsmd.TeamMembershipChecker,
	mode InitMode, uid keybase1.UID, serializedPrivateMetadata []byte,
	rmdToDecrypt, rmdWithKeys KeyMetadata, log logger.Logger) (
	PrivateMetadata, error) {
	handle := rmdToDecrypt.GetTlfHandle()

	var pmd PrivateMetadata
	if handle.TypeForKeying() == tlf.PublicKeying {
		if err := codec.Decode(serializedPrivateMetadata,
			&pmd); err != nil {
			return PrivateMetadata{}, err
		}
	} else {
		// decrypt the root data for non-public directories
		var encryptedPrivateMetadata kbfscrypto.EncryptedPrivateMetadata
		if err := codec.Decode(serializedPrivateMetadata,
			&encryptedPrivateMetadata); err != nil {
			return PrivateMetadata{}, err
		}

		k, err := keyGetter.GetTLFCryptKeyForMDDecryption(ctx,
			rmdToDecrypt, rmdWithKeys)

		if err != nil {
			log.CDebugf(ctx, "Couldn't get crypt key for %s (%s): %+v",
				handle.GetCanonicalPath(), rmdToDecrypt.TlfID(), err)
			isReader, readerErr := isReaderFromHandle(
				ctx, handle, teamChecker, uid)
			if readerErr != nil {
				return PrivateMetadata{}, readerErr
			}
			_, isSelfRekeyError := err.(NeedSelfRekeyError)
			_, isOtherRekeyError := err.(NeedOtherRekeyError)
			if isReader && (isOtherRekeyError || isSelfRekeyError) {
				// Rekey errors are expected if this client is a
				// valid folder participant but doesn't have the
				// shared crypt key.
			} else {
				return PrivateMetadata{}, err
			}
		} else {
			pmd, err = crypto.DecryptPrivateMetadata(
				encryptedPrivateMetadata, k)
			if err != nil {
				return PrivateMetadata{}, err
			}
		}
	}

	// Re-embed the block changes if it's needed.
	err := reembedBlockChanges(
		ctx, codec, bcache, bops, mode, rmdWithKeys.TlfID(),
		&pmd, rmdWithKeys, log)
	if err != nil {
		return PrivateMetadata{}, err
	}

	return pmd, nil
}
