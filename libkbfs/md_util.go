// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"golang.org/x/net/context"
)

type mdRange struct {
	start MetadataRevision
	end   MetadataRevision
}

func makeRekeyReadErrorHelper(
	kmd KeyMetadata, resolvedHandle *TlfHandle, keyGen KeyGen,
	uid keybase1.UID, username libkb.NormalizedUsername) error {
	if resolvedHandle.IsPublic() {
		panic("makeRekeyReadError called on public folder")
	}
	// If the user is not a legitimate reader of the folder, this is a
	// normal read access error.
	if !resolvedHandle.IsReader(uid) {
		return NewReadAccessError(resolvedHandle, username)
	}

	// Otherwise, this folder needs to be rekeyed for this device.
	tlfName := resolvedHandle.GetCanonicalName()
	if hasKeys := kmd.HasKeyForUser(keyGen, uid); hasKeys {
		return NeedSelfRekeyError{tlfName}
	}
	return NeedOtherRekeyError{tlfName}
}

func makeRekeyReadError(
	ctx context.Context, config Config, kmd KeyMetadata, keyGen KeyGen,
	uid keybase1.UID, username libkb.NormalizedUsername) error {
	h := kmd.GetTlfHandle()
	resolvedHandle, err := h.ResolveAgain(ctx, config.KBPKI())
	if err != nil {
		// Ignore error and pretend h is already fully
		// resolved.
		resolvedHandle = h
	}
	return makeRekeyReadErrorHelper(
		kmd, resolvedHandle, keyGen, uid, username)
}

// Helper which returns nil if the md block is uninitialized or readable by
// the current user. Otherwise an appropriate read access error is returned.
func isReadableOrError(
	ctx context.Context, config Config, md ReadOnlyRootMetadata) error {
	if !md.IsInitialized() || md.IsReadable() {
		return nil
	}
	// this should only be the case if we're a new device not yet
	// added to the set of reader/writer keys.
	username, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}
	return makeRekeyReadError(
		ctx, config, md, md.LatestKeyGeneration(), uid, username)
}

func getMDRange(ctx context.Context, config Config, id TlfID, bid BranchID,
	start MetadataRevision, end MetadataRevision, mStatus MergeStatus) (
	rmds []ImmutableRootMetadata, err error) {
	// The range is invalid.  Don't treat as an error though; it just
	// indicates that we don't yet know about any revisions.
	if start < MetadataRevisionInitial || end < MetadataRevisionInitial {
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

// getMergedMDUpdates returns a slice of all the merged MDs for a TLF,
// starting from the given startRev.  The returned MDs are the same
// instances that are stored in the MD cache, so they should be
// modified with care.
//
// TODO: Accept a parameter to express that we want copies of the MDs
// instead of the cached versions.
func getMergedMDUpdates(ctx context.Context, config Config, id TlfID,
	startRev MetadataRevision) (mergedRmds []ImmutableRootMetadata, err error) {
	// We don't yet know about any revisions yet, so there's no range
	// to get.
	if startRev < MetadataRevisionInitial {
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

	// Check the readability of each MD.  Because rekeys can append a
	// MD revision with the new key, older revisions might not be
	// readable until the newer revision, containing the key for this
	// device, is processed.
	for i, rmd := range mergedRmds {
		if err := isReadableOrError(ctx, config, rmd.ReadOnly()); err != nil {
			// The right secret key for the given rmd's
			// key generation may only be present in the
			// most recent rmd.
			rmdCopy, err := rmd.deepCopy(config.Codec(), true)
			if err != nil {
				return nil, err
			}
			latestRmd := mergedRmds[len(mergedRmds)-1]
			if err := decryptMDPrivateData(ctx, config,
				rmdCopy, latestRmd.ReadOnly()); err != nil {
				return nil, err
			}
			// Overwrite the cached copy with the new copy
			irmdCopy := MakeImmutableRootMetadata(rmdCopy, rmd.mdID,
				rmd.localTimestamp)
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
//
// TODO: Accept a parameter to express that we want copies of the MDs
// instead of the cached versions.
func getUnmergedMDUpdates(ctx context.Context, config Config, id TlfID,
	bid BranchID, startRev MetadataRevision) (
	currHead MetadataRevision, unmergedRmds []ImmutableRootMetadata, err error) {
	// We don't yet know about any revisions yet, so there's no range
	// to get.
	if startRev < MetadataRevisionInitial {
		return MetadataRevisionUninitialized, nil, nil
	}

	// walk backwards until we find one that is merged
	currHead = startRev
	for {
		// first look up all unmerged MD revisions older than my current head
		startRev := currHead - maxMDsAtATime + 1 // (MetadataRevision is signed)
		if startRev < MetadataRevisionInitial {
			startRev = MetadataRevisionInitial
		}

		rmds, err := getMDRange(ctx, config, id, bid, startRev, currHead,
			Unmerged)
		if err != nil {
			return MetadataRevisionUninitialized, nil, err
		}

		numNew := len(rmds)
		// prepend to keep the ordering correct
		unmergedRmds = append(rmds, unmergedRmds...)

		// on the next iteration, start apply the previous root
		if numNew > 0 {
			currHead = rmds[0].Revision() - 1
		}
		if currHead < MetadataRevisionInitial {
			return MetadataRevisionUninitialized, nil,
				errors.New("Ran out of MD updates to unstage!")
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
// signing (see signMD below). The returned BareRootMetadata is a
// shallow copy of the given RootMetadata, so it shouldn't be modified
// directly. After this function is called, the MetadataID of the
// returned BareRootMetadata can be computed.
func encryptMDPrivateData(
	ctx context.Context, codec Codec, crypto cryptoPure,
	signer cryptoSigner, ekg encryptionKeyGetter, me keybase1.UID,
	rmd ReadOnlyRootMetadata) (BareRootMetadata, error) {
	err := rmd.data.checkValid()
	if err != nil {
		return nil, err
	}

	brmd := rmd.bareMd
	privateData := &rmd.data

	if brmd.TlfID().IsPublic() || !brmd.IsWriterMetadataCopiedSet() {
		// Record the last writer to modify this writer metadata
		brmd.SetLastModifyingWriter(me)

		if brmd.TlfID().IsPublic() {
			// Encode the private metadata
			encodedPrivateMetadata, err := codec.Encode(privateData)
			if err != nil {
				return nil, err
			}
			brmd.SetSerializedPrivateMetadata(encodedPrivateMetadata)
		} else if !brmd.IsWriterMetadataCopiedSet() {
			// Encrypt and encode the private metadata
			k, err := ekg.GetTLFCryptKeyForEncryption(ctx, rmd)
			if err != nil {
				return nil, err
			}
			encryptedPrivateMetadata, err := crypto.EncryptPrivateMetadata(privateData, k)
			if err != nil {
				return nil, err
			}
			encodedEncryptedPrivateMetadata, err := codec.Encode(encryptedPrivateMetadata)
			if err != nil {
				return nil, err
			}
			brmd.SetSerializedPrivateMetadata(encodedEncryptedPrivateMetadata)
		}

		// Sign the writer metadata. This has to be done here,
		// instead of in signMD, since the MetadataID depends
		// on it.
		buf, err := brmd.GetSerializedWriterMetadata(codec)
		if err != nil {
			return nil, err
		}

		sigInfo, err := signer.Sign(ctx, buf)
		if err != nil {
			return nil, err
		}
		brmd.SetWriterMetadataSigInfo(sigInfo)
	}

	// Record the last user to modify this metadata
	brmd.SetLastModifyingUser(me)

	return brmd, nil
}

func signMD(
	ctx context.Context, codec Codec, signer cryptoSigner,
	rmds *RootMetadataSigned) error {
	// encode the root metadata and sign it
	buf, err := codec.Encode(rmds.MD)
	if err != nil {
		return err
	}

	// Sign normally using the local device private key
	sigInfo, err := signer.Sign(ctx, buf)
	if err != nil {
		return err
	}
	rmds.SigInfo = sigInfo

	return nil
}

func decryptMDPrivateData(ctx context.Context, config Config,
	rmdToDecrypt *RootMetadata, rmdWithKeys KeyMetadata) error {
	handle := rmdToDecrypt.GetTlfHandle()
	crypto := config.Crypto()
	codec := config.Codec()

	if handle.IsPublic() {
		if err := codec.Decode(rmdToDecrypt.GetSerializedPrivateMetadata(),
			&rmdToDecrypt.data); err != nil {
			return err
		}
	} else {
		// decrypt the root data for non-public directories
		var encryptedPrivateMetadata EncryptedPrivateMetadata
		if err := codec.Decode(rmdToDecrypt.GetSerializedPrivateMetadata(),
			&encryptedPrivateMetadata); err != nil {
			return err
		}

		k, err := config.KeyManager().GetTLFCryptKeyForMDDecryption(ctx,
			rmdToDecrypt.ReadOnly(), rmdWithKeys)

		privateMetadata := &PrivateMetadata{}
		if err != nil {
			// Get current UID.
			_, uid, uidErr := config.KBPKI().GetCurrentUserInfo(ctx)
			if uidErr != nil {
				return uidErr
			}
			isReader := handle.IsReader(uid)
			_, isSelfRekeyError := err.(NeedSelfRekeyError)
			_, isOtherRekeyError := err.(NeedOtherRekeyError)
			if isReader && (isOtherRekeyError || isSelfRekeyError) {
				// Rekey errors are expected if this client is a
				// valid folder participant but doesn't have the
				// shared crypt key.
			} else {
				return err
			}
		} else {
			privateMetadata, err =
				crypto.DecryptPrivateMetadata(encryptedPrivateMetadata, k)
			if err != nil {
				return err
			}
		}
		rmdToDecrypt.data = *privateMetadata
	}

	// Re-embed the block changes if it's needed.
	if info := rmdToDecrypt.data.Changes.Info; info.BlockPointer != zeroPtr {
		// We don't have a convenient way to fetch the block from here
		// via folderBlockOps, so just go directly via the
		// BlockCache/BlockOps.  No locking around the blocks is
		// needed since these change blocks are read-only.
		block, err := config.BlockCache().Get(info.BlockPointer)
		if err != nil {
			block = NewFileBlock()
			if err := config.BlockOps().Get(ctx, rmdWithKeys,
				info.BlockPointer, block); err != nil {
				return err
			}
			if err := config.BlockCache().Put(info.BlockPointer,
				rmdToDecrypt.TlfID(), block, TransientEntry); err != nil {
				return err
			}
		}

		fblock, ok := block.(*FileBlock)
		if !ok {
			return NotFileBlockError{info.BlockPointer, MasterBranch, path{}}
		}

		err = config.Codec().Decode(fblock.Contents, &rmdToDecrypt.data.Changes)
		if err != nil {
			return err
		}
		// The changes block pointer is an implicit ref block
		rmdToDecrypt.data.Changes.Ops[0].AddRefBlock(info.BlockPointer)
		rmdToDecrypt.data.cachedChanges.Info = info
	}

	return nil
}
