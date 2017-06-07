// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
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
	uid keybase1.UID, username libkb.NormalizedUsername) error {
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
	uid keybase1.UID, username libkb.NormalizedUsername) error {
	h := kmd.GetTlfHandle()
	resolvedHandle, resolveErr := h.ResolveAgain(ctx, kbpki)
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

func getMDRange(ctx context.Context, config Config, id tlf.ID, bid BranchID,
	start kbfsmd.Revision, end kbfsmd.Revision, mStatus MergeStatus) (
	rmds []ImmutableRootMetadata, err error) {
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
		case Merged:
			fetchedRmds, err = config.MDOps().GetRange(
				ctx, id, r.start, r.end)
		case Unmerged:
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

			if err := mdcache.Put(rmd); err != nil {
				config.MakeLogger("").CDebugf(ctx, "Error putting md "+
					"%d into the cache: %v", rmd.Revision(), err)
			}
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
func getSingleMD(ctx context.Context, config Config, id tlf.ID, bid BranchID,
	rev kbfsmd.Revision, mStatus MergeStatus) (
	ImmutableRootMetadata, error) {
	rmds, err := getMDRange(ctx, config, id, bid, rev, rev, mStatus)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if len(rmds) != 1 {
		return ImmutableRootMetadata{},
			fmt.Errorf("Single expected revision %d not found", rev)
	}
	return rmds[0], nil
}

// getMergedMDUpdates returns a slice of all the merged MDs for a TLF,
// starting from the given startRev.  The returned MDs are the same
// instances that are stored in the MD cache, so they should be
// modified with care.
//
// TODO: Accept a parameter to express that we want copies of the MDs
// instead of the cached versions.
func getMergedMDUpdates(ctx context.Context, config Config, id tlf.ID,
	startRev kbfsmd.Revision) (mergedRmds []ImmutableRootMetadata, err error) {
	// We don't yet know about any revisions yet, so there's no range
	// to get.
	if startRev < kbfsmd.RevisionInitial {
		return nil, nil
	}

	start := startRev
	for {
		end := start + maxMDsAtATime - 1 // range is inclusive
		rmds, err := getMDRange(ctx, config, id, NullBranchID, start, end,
			Merged)
		if err != nil {
			return nil, err
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

			pmd, err := decryptMDPrivateData(
				ctx, config.Codec(), config.Crypto(),
				config.BlockCache(), config.BlockOps(),
				config.KeyManager(), config.Mode(), uid,
				rmd.GetSerializedPrivateMetadata(),
				rmd, latestRmd, config.MakeLogger(""))
			if err != nil {
				return nil, err
			}

			rmdCopy, err := rmd.deepCopy(config.Codec())
			if err != nil {
				return nil, err
			}
			rmdCopy.data = pmd

			// Overwrite the cached copy with the new copy
			irmdCopy := MakeImmutableRootMetadata(rmdCopy,
				rmd.LastModifyingWriterVerifyingKey(), rmd.MdID(),
				rmd.LocalTimestamp())
			if err := config.MDCache().Put(irmdCopy); err != nil {
				return nil, err
			}
			mergedRmds[i] = irmdCopy
		}
	}
	return mergedRmds, nil
}

// getUnmergedMDUpdates returns a slice of the unmerged MDs for a TLF
// and unmerged branch, between the merge point for that branch and
// startRev (inclusive).  The returned MDs are the same instances that
// are stored in the MD cache, so they should be modified with care.
// If bid is NullBranchID, it returns an empty MD list.
//
// TODO: Accept a parameter to express that we want copies of the MDs
// instead of the cached versions.
func getUnmergedMDUpdates(ctx context.Context, config Config, id tlf.ID,
	bid BranchID, startRev kbfsmd.Revision) (
	currHead kbfsmd.Revision, unmergedRmds []ImmutableRootMetadata,
	err error) {
	if bid == NullBranchID {
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
			Unmerged)
		if err != nil {
			return kbfsmd.RevisionUninitialized, nil, err
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

	if brmd.TlfID().Type() == tlf.Public || !brmd.IsWriterMetadataCopiedSet() {
		// Record the last writer to modify this writer metadata
		brmd.SetLastModifyingWriter(me)

		if brmd.TlfID().Type() == tlf.Public {
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

func getFileBlockForMD(ctx context.Context, bcache BlockCache, bops BlockOps,
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
	bcache BlockCache, bops BlockOps, mode InitMode, tlfID tlf.ID,
	pmd *PrivateMetadata, rmdWithKeys KeyMetadata, log logger.Logger) error {
	info := pmd.Changes.Info
	if info.BlockPointer == zeroPtr {
		return nil
	}

	if mode != InitDefault {
		// Leave the block changes unembedded -- they aren't needed in
		// non-default mode since there's no node cache, and thus
		// there are no Nodes that needs to be updated due to
		// BlockChange pointers in those blocks.
		log.CDebugf(ctx, "Skipping block change reembedding in mode: %s", mode)
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
	cacher := func(ptr BlockPointer, block Block) error {
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

	err = codec.Decode(buf, &pmd.Changes)
	if err != nil {
		return err
	}

	// The changes block pointers are implicit ref blocks.
	pmd.Changes.Ops[0].AddRefBlock(info.BlockPointer)
	iptrs, err := fd.getIndirectFileBlockInfos(ctx)
	if err != nil {
		return err
	}
	for _, iptr := range iptrs {
		pmd.Changes.Ops[0].AddRefBlock(iptr.BlockPointer)
	}

	pmd.cachedChanges.Info = info
	return nil
}

// decryptMDPrivateData does not use uid if the handle is a public one.
func decryptMDPrivateData(ctx context.Context, codec kbfscodec.Codec,
	crypto Crypto, bcache BlockCache, bops BlockOps,
	keyGetter mdDecryptionKeyGetter, mode InitMode, uid keybase1.UID,
	serializedPrivateMetadata []byte,
	rmdToDecrypt, rmdWithKeys KeyMetadata, log logger.Logger) (
	PrivateMetadata, error) {
	handle := rmdToDecrypt.GetTlfHandle()

	var pmd PrivateMetadata
	if handle.Type() == tlf.Public {
		if err := codec.Decode(serializedPrivateMetadata,
			&pmd); err != nil {
			return PrivateMetadata{}, err
		}
	} else {
		// decrypt the root data for non-public directories
		var encryptedPrivateMetadata EncryptedPrivateMetadata
		if err := codec.Decode(serializedPrivateMetadata,
			&encryptedPrivateMetadata); err != nil {
			return PrivateMetadata{}, err
		}

		k, err := keyGetter.GetTLFCryptKeyForMDDecryption(ctx,
			rmdToDecrypt, rmdWithKeys)

		if err != nil {
			isReader := handle.IsReader(uid)
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
