// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"golang.org/x/sync/errgroup"

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

// getSingleMD returns an MD that is required to exist.
func getSingleMD(ctx context.Context, config Config, id TlfID, bid BranchID,
	rev MetadataRevision, mStatus MergeStatus) (
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

	var uid keybase1.UID
	// Check the readability of each MD.  Because rekeys can append a
	// MD revision with the new key, older revisions might not be
	// readable until the newer revision, containing the key for this
	// device, is processed.
	for i, rmd := range mergedRmds {
		if err := isReadableOrError(ctx, config, rmd.ReadOnly()); err != nil {
			// The right secret key for the given rmd's
			// key generation may only be present in the
			// most recent rmd.
			latestRmd := mergedRmds[len(mergedRmds)-1]

			if uid == keybase1.UID("") {
				_, uid, err = config.KBPKI().GetCurrentUserInfo(ctx)
				if err != nil {
					return nil, err
				}
			}

			pmd, err := decryptMDPrivateData(
				ctx, config.Codec(), config.Crypto(),
				config.BlockCache(), config.BlockOps(),
				config.KeyManager(), uid,
				rmd.GetSerializedPrivateMetadata(),
				rmd, latestRmd)
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

	if brmd.TlfID().IsPublic() || !brmd.IsWriterMetadataCopiedSet() {
		// Record the last writer to modify this writer metadata
		brmd.SetLastModifyingWriter(me)

		if brmd.TlfID().IsPublic() {
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
	ptr BlockPointer, tlfID TlfID, rmdWithKeys KeyMetadata) (
	*FileBlock, error) {
	// We don't have a convenient way to fetch the block from here via
	// folderBlockOps, so just go directly via the
	// BlockCache/BlockOps.  No locking around the blocks is needed
	// since these change blocks are read-only.
	block, err := bcache.Get(ptr)
	if err != nil {
		block = NewFileBlock()
		if err := bops.Get(ctx, rmdWithKeys, ptr, block); err != nil {
			return nil, err
		}
		if err := bcache.Put(
			ptr, tlfID, block, TransientEntry); err != nil {
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
	bcache BlockCache, bops BlockOps, tlfID TlfID, pmd *PrivateMetadata,
	rmdWithKeys KeyMetadata) error {
	info := pmd.Changes.Info
	if info.BlockPointer == zeroPtr {
		return nil
	}

	// Fetch the top-level block.
	fblock, err := getFileBlockForMD(
		ctx, bcache, bops, info.BlockPointer, tlfID, rmdWithKeys)
	if err != nil {
		return err
	}

	buf := fblock.Contents
	if fblock.IsInd {
		numFetchers := len(fblock.IPtrs)
		if numFetchers > maxParallelBlockGets {
			numFetchers = maxParallelBlockGets
		}

		type iptrAndBlock struct {
			ptr   IndirectFilePtr
			block *FileBlock
		}

		// Fetch all the child blocks in parallel.
		iptrsToFetch := make(chan IndirectFilePtr, len(fblock.IPtrs))
		indirectBlocks := make(chan iptrAndBlock, len(fblock.IPtrs))
		eg, groupCtx := errgroup.WithContext(ctx)
		fetchFn := func() error {
			for iptr := range iptrsToFetch {
				select {
				case <-groupCtx.Done():
					return groupCtx.Err()
				default:
				}

				fblock, err := getFileBlockForMD(groupCtx, bcache, bops,
					iptr.BlockPointer, tlfID, rmdWithKeys)
				if err != nil {
					return err
				}

				indirectBlocks <- iptrAndBlock{iptr, fblock}
			}
			return nil
		}
		for i := 0; i < numFetchers; i++ {
			eg.Go(fetchFn)
		}
		for _, iptr := range fblock.IPtrs {
			iptrsToFetch <- iptr
		}
		close(iptrsToFetch)
		if err := eg.Wait(); err != nil {
			return err
		}
		close(indirectBlocks)

		// Reconstruct the buffer by appending bytes in order of offset.
		blocks := make(map[int64]*FileBlock)
		for iab := range indirectBlocks {
			blocks[iab.ptr.Off] = iab.block
		}
		lastOff := fblock.IPtrs[len(fblock.IPtrs)-1].Off
		buf = make([]byte, lastOff+int64(len(blocks[lastOff].Contents)))
		for _, iptr := range fblock.IPtrs {
			block := blocks[iptr.Off]
			blockSize := int64(len(block.Contents))
			copy(buf[iptr.Off:iptr.Off+blockSize], block.Contents)
		}
	}

	err = codec.Decode(buf, &pmd.Changes)
	if err != nil {
		return err
	}
	// The changes block pointers are implicit ref blocks.
	pmd.Changes.Ops[0].AddRefBlock(info.BlockPointer)
	for _, iptr := range fblock.IPtrs {
		pmd.Changes.Ops[0].AddRefBlock(iptr.BlockPointer)
	}
	pmd.cachedChanges.Info = info
	return nil
}

func decryptMDPrivateData(ctx context.Context, codec kbfscodec.Codec,
	crypto Crypto, bcache BlockCache, bops BlockOps,
	keyGetter mdDecryptionKeyGetter, uid keybase1.UID,
	serializedPrivateMetadata []byte,
	rmdToDecrypt, rmdWithKeys KeyMetadata) (PrivateMetadata, error) {
	handle := rmdToDecrypt.GetTlfHandle()

	var pmd PrivateMetadata
	if handle.IsPublic() {
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
		ctx, codec, bcache, bops, rmdWithKeys.TlfID(),
		&pmd, rmdWithKeys)
	if err != nil {
		return PrivateMetadata{}, err
	}

	return pmd, nil
}
