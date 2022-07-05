// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type mdRange struct {
	start kbfsmd.Revision
	end   kbfsmd.Revision
}

func makeRekeyReadErrorHelper(
	err error, kmd libkey.KeyMetadata, resolvedHandle *tlfhandle.Handle,
	uid keybase1.UID, username kbname.NormalizedUsername) error {
	if resolvedHandle.Type() == tlf.Public {
		panic("makeRekeyReadError called on public folder")
	}
	// If the user is not a legitimate reader of the folder, this is a
	// normal read access error.
	if !resolvedHandle.IsReader(uid) {
		return tlfhandle.NewReadAccessError(
			resolvedHandle, username, resolvedHandle.GetCanonicalPath())
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
	ctx context.Context, err error, kbpki KBPKI,
	syncGetter syncedTlfGetterSetter, kmd libkey.KeyMetadata,
	uid keybase1.UID, username kbname.NormalizedUsername) error {
	h := kmd.GetTlfHandle()
	resolvedHandle, resolveErr := h.ResolveAgain(ctx, kbpki, nil, syncGetter)
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
	ctx context.Context, kbpki KBPKI, syncGetter syncedTlfGetterSetter,
	md ReadOnlyRootMetadata) error {
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
	return makeRekeyReadError(
		ctx, err, kbpki, syncGetter, md, session.UID, session.Name)
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

// GetSingleMD returns an MD that is required to exist.
func GetSingleMD(
	ctx context.Context, config Config, id tlf.ID, bid kbfsmd.BranchID,
	rev kbfsmd.Revision, mStatus kbfsmd.MergeStatus,
	lockBeforeGet *keybase1.LockID) (ImmutableRootMetadata, error) {
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
		config.KeyManager(), config.KBPKI(), config, config.Mode(), uid,
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
		if err := isReadableOrError(ctx, config.KBPKI(), config, rmd.ReadOnly()); err != nil {
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
	ctx context.Context, config Config, handle *tlfhandle.Handle,
	serverTime time.Time) (kbfsmd.Revision, error) {
	id := handle.TlfID()
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

func getFileBlockForMD(
	ctx context.Context, bcache data.BlockCacheSimple, bops BlockOps,
	ptr data.BlockPointer, tlfID tlf.ID, rmdWithKeys libkey.KeyMetadata) (
	*data.FileBlock, error) {
	// We don't have a convenient way to fetch the block from here via
	// folderBlockOps, so just go directly via the
	// BlockCache/BlockOps.  No locking around the blocks is needed
	// since these change blocks are read-only.
	block, err := bcache.Get(ptr)
	if err != nil {
		block = data.NewFileBlock()
		// TODO: eventually we should plumb the correct branch name
		// here, but that would impact a huge number of functions that
		// fetch MD.  For now, the worst thing that can happen is that
		// MD blocks for historical MD revisions sneak their way into
		// the sync cache.
		branch := data.MasterBranch
		if err := bops.Get(
			ctx, rmdWithKeys, ptr, block, data.TransientEntry,
			branch); err != nil {
			return nil, err
		}
	}

	fblock, ok := block.(*data.FileBlock)
	if !ok {
		return nil, NotFileBlockError{ptr, data.MasterBranch, data.Path{}}
	}
	return fblock, nil
}

func reembedBlockChanges(ctx context.Context, codec kbfscodec.Codec,
	bcache data.BlockCacheSimple, bops BlockOps, mode InitMode, tlfID tlf.ID,
	pmd *PrivateMetadata, rmdWithKeys libkey.KeyMetadata,
	log logger.Logger) error {
	info := pmd.Changes.Info
	if info.BlockPointer == data.ZeroPtr {
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
	file := data.Path{
		FolderBranch: data.FolderBranch{
			Tlf:    tlfID,
			Branch: data.MasterBranch,
		},
		Path: []data.PathNode{{
			BlockPointer: info.BlockPointer,
			Name: data.NewPathPartString(
				fmt.Sprintf("<MD with block change pointer %s>",
					info.BlockPointer), nil),
		}},
	}
	getter := func(ctx context.Context, kmd libkey.KeyMetadata, ptr data.BlockPointer,
		p data.Path, rtype data.BlockReqType) (*data.FileBlock, bool, error) {
		block, err := getFileBlockForMD(ctx, bcache, bops, ptr, tlfID, kmd)
		if err != nil {
			return nil, false, err
		}
		return block, false, nil
	}
	cacher := func(_ context.Context, ptr data.BlockPointer, block data.Block) error {
		return nil
	}
	// Reading doesn't use crypto or the block splitter, so for now
	// just pass in nil.  Also, reading doesn't depend on the UID, so
	// it's ok to be empty.
	var id keybase1.UserOrTeamID
	fd := data.NewFileData(
		file, id, nil, rmdWithKeys, getter, cacher, log,
		libkb.NewVDebugLog(log) /* one-off, short-lived, unconfigured vlog */)

	buf, err := fd.GetBytes(ctx, 0, -1)
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
	iptrs, err := fd.GetIndirectFileBlockInfos(ctx)
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

func reembedBlockChangesIntoCopyIfNeeded(
	ctx context.Context, codec kbfscodec.Codec,
	bcache data.BlockCacheSimple, bops BlockOps, mode InitMode,
	rmd ImmutableRootMetadata, log logger.Logger) (
	ImmutableRootMetadata, error) {
	if rmd.data.Changes.Ops != nil {
		return rmd, nil
	}

	// This might be necessary if the MD was retrieved from the
	// cache in between putting it to the server (with unembedded
	// block changes), and re-loading the block changes back into
	// the MD and re-inserting into the cache.
	log.CDebugf(ctx,
		"Reembedding block changes for revision %d", rmd.Revision())
	rmdCopy, err := rmd.deepCopy(codec)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	err = reembedBlockChanges(
		ctx, codec, bcache, bops, mode, rmd.TlfID(),
		&rmdCopy.data, rmd, log)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return MakeImmutableRootMetadata(
		rmdCopy, rmd.lastWriterVerifyingKey, rmd.mdID,
		rmd.localTimestamp, rmd.putToServer), nil
}

func getMDObfuscationSecret(
	ctx context.Context, keyGetter mdDecryptionKeyGetter,
	kmd libkey.KeyMetadata) (data.NodeObfuscatorSecret, error) {
	if kmd.TlfID().Type() == tlf.Public {
		return nil, nil
	}
	key, err := keyGetter.GetFirstTLFCryptKey(ctx, kmd)
	if err != nil {
		return nil, err
	}
	secret, err := key.DeriveSecret(obfuscatorDerivationString)
	if err != nil {
		return nil, err
	}
	return data.NodeObfuscatorSecret(secret), nil
}

func makeMDObfuscatorFromSecret(
	secret data.NodeObfuscatorSecret, mode InitMode) data.Obfuscator {
	if !mode.DoLogObfuscation() {
		return nil
	}

	if secret == nil {
		return nil
	}
	return data.NewNodeObfuscator(secret)
}

// decryptMDPrivateData does not use uid if the handle is a public one.
func decryptMDPrivateData(ctx context.Context, codec kbfscodec.Codec,
	crypto Crypto, bcache data.BlockCache, bops BlockOps,
	keyGetter mdDecryptionKeyGetter, teamChecker kbfsmd.TeamMembershipChecker,
	osg idutil.OfflineStatusGetter, mode InitMode, uid keybase1.UID,
	serializedPrivateMetadata []byte, rmdToDecrypt, rmdWithKeys libkey.KeyMetadata,
	log logger.Logger) (PrivateMetadata, error) {
	handle := rmdToDecrypt.GetTlfHandle()

	var pmd PrivateMetadata
	keyedForDevice := true
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
				ctx, handle, teamChecker, osg, uid)
			if readerErr != nil {
				return PrivateMetadata{}, readerErr
			}
			_, isSelfRekeyError := err.(NeedSelfRekeyError)
			_, isOtherRekeyError := err.(NeedOtherRekeyError)
			if isReader && (isOtherRekeyError || isSelfRekeyError) {
				// Rekey errors are expected if this client is a
				// valid folder participant but doesn't have the
				// shared crypt key.
				keyedForDevice = false
			} else {
				return PrivateMetadata{}, err
			}
		} else {
			pmd, err = crypto.DecryptPrivateMetadata(
				encryptedPrivateMetadata, k)
			if err != nil {
				log.CDebugf(
					ctx, "Failed to decrypt MD for id=%s, keygen=%d",
					rmdToDecrypt.TlfID(), rmdToDecrypt.LatestKeyGeneration())
				return PrivateMetadata{}, err
			}
		}
	}

	// Re-embed the block changes if it's needed.
	err := reembedBlockChanges(
		ctx, codec, bcache, bops, mode, rmdWithKeys.TlfID(),
		&pmd, rmdWithKeys, log)
	if err != nil {
		log.CDebugf(
			ctx, "Failed to re-embed block changes for id=%s, keygen=%d, info pointer=%v",
			rmdToDecrypt.TlfID(), rmdToDecrypt.LatestKeyGeneration(),
			pmd.Changes.Info)
		return PrivateMetadata{}, err
	}

	var obfuscator data.Obfuscator
	if keyedForDevice {
		secret, err := getMDObfuscationSecret(ctx, keyGetter, rmdWithKeys)
		if err != nil {
			return PrivateMetadata{}, err
		}
		obfuscator = makeMDObfuscatorFromSecret(secret, mode)
	}
	for _, op := range pmd.Changes.Ops {
		// Add a temporary path with an obfuscator.  When we
		// deserialize the ops from the raw byte buffer of the MD
		// object, they don't have proper `data.Path`s set in them yet
		// -- that's an unexported field. The path is required for
		// obfuscation, so here we're just making sure that they all
		// have one. In places where a perfectly-accurate path is
		// required (like in conflict resolution), the code there will
		// need to add a proper path. Note that here the level of the
		// obfuscator might be wrong, and so might result in
		// inconsistent suffixes for obfuscated names that conflict.
		if !op.getFinalPath().IsValid() {
			op.setFinalPath(data.Path{Path: []data.PathNode{{
				BlockPointer: data.ZeroPtr,
				Name:         data.NewPathPartString("", obfuscator),
			}}})
		}
	}

	return pmd, nil
}

func getOpsSafe(config Config, id tlf.ID) (*folderBranchOps, error) {
	kbfsOps := config.KBFSOps()
	kbfsOpsStandard, ok := kbfsOps.(*KBFSOpsStandard)
	if !ok {
		return nil, errors.New("Not KBFSOpsStandard")
	}

	return kbfsOpsStandard.getOpsNoAdd(context.TODO(), data.FolderBranch{
		Tlf:    id,
		Branch: data.MasterBranch,
	}), nil
}

func getOps(config Config, id tlf.ID) *folderBranchOps {
	ops, err := getOpsSafe(config, id)
	if err != nil {
		panic(err)
	}
	return ops
}

// ChangeType indicates what kind of change is being referenced.
type ChangeType int

const (
	// ChangeTypeWrite is a change to a file (could be a create or a
	// write to an existing file).
	ChangeTypeWrite ChangeType = iota
	// ChangeTypeRename is a rename of an existing file or directory.
	ChangeTypeRename
	// ChangeTypeDelete is a delete of an existing file or directory.
	ChangeTypeDelete
)

func (ct ChangeType) String() string {
	switch ct {
	case ChangeTypeWrite:
		return "write"
	case ChangeTypeRename:
		return "rename"
	case ChangeTypeDelete:
		return "delete"
	default:
		return "unknown"
	}
}

// ChangeItem describes a single change to a file or directory between
// revisions.
type ChangeItem struct {
	Type            ChangeType
	CurrPath        data.Path // Full path to the node created/renamed/deleted
	UnrefsForDelete []data.BlockPointer
	IsNew           bool
	OldPtr          data.BlockPointer
}

func (ci *ChangeItem) addUnrefs(chains *crChains, op op) error {
	// Find the original block pointers for each unref.
	unrefs := op.Unrefs()
	ci.UnrefsForDelete = make([]data.BlockPointer, len(unrefs))
	for i, unref := range unrefs {
		ptr, err := chains.originalFromMostRecentOrSame(unref)
		if err != nil {
			return err
		}
		ci.UnrefsForDelete[i] = ptr
	}
	return nil
}

func (ci ChangeItem) String() string {
	return fmt.Sprintf(
		"{type: %s, currPath: %s}", ci.Type, ci.CurrPath.CanonicalPathString())
}

// GetChangesBetweenRevisions returns a list of all the changes
// between the two given revisions (after `oldRev`, up to and
// including `newRev`). Also returns the sum of all the newly ref'd
// block sizes (in bytes), as a crude estimate of how big this change
// set is.
func GetChangesBetweenRevisions(
	ctx context.Context, config Config, id tlf.ID,
	oldRev, newRev kbfsmd.Revision) (
	changes []*ChangeItem, refSize uint64, err error) {
	if newRev <= oldRev {
		return nil, 0, errors.Errorf(
			"Can't get changes between %d and %d", oldRev, newRev)
	}

	rmds, err := getMDRange(
		ctx, config, id, kbfsmd.NullBranchID, oldRev+1, newRev,
		kbfsmd.Merged, nil)
	if err != nil {
		return nil, 0, err
	}

	fbo, err := getOpsSafe(config, id)
	if err != nil {
		return nil, 0, err
	}

	chains, err := newCRChainsForIRMDs(
		ctx, config.Codec(), config, rmds, &fbo.blocks, true)
	if err != nil {
		return nil, 0, err
	}
	err = fbo.blocks.populateChainPaths(
		ctx, config.MakeLogger(""), chains, true)
	if err != nil {
		return nil, 0, err
	}

	// The crChains creation process splits up a rename op into
	// a delete and a create.  Turn them back into a rename.
	opsCount := 0
	for _, rmd := range rmds {
		opsCount += len(rmd.data.Changes.Ops)
	}
	ops := make([]op, opsCount)
	soFar := 0
	for _, rmd := range rmds {
		for i, op := range rmd.data.Changes.Ops {
			ops[soFar+i] = op.deepCopy()
		}
		soFar += len(rmd.data.Changes.Ops)
		refSize += rmd.RefBytes()
	}
	err = chains.revertRenames(ops)
	if err != nil {
		return nil, 0, err
	}

	// Create the change items for each chain.  Use the following
	// simplifications:
	// * Creates become writes, and use the full path to the created file/dir.
	// * Deletes use the original blockpointer from the start of the chain
	//   for the deleted file's path.
	items := make(map[string][]*ChangeItem)
	numItems := 0
	for _, chain := range chains.byMostRecent {
		for _, op := range chain.ops {
			newItem := true
			item := &ChangeItem{
				CurrPath: op.getFinalPath(),
			}
			switch realOp := op.(type) {
			case *createOp:
				item.Type = ChangeTypeWrite
				// Don't force there to be a pointer for the new node,
				// since it could be a symlink.
				item.CurrPath = item.CurrPath.ChildPathNoPtr(
					realOp.obfuscatedNewName(), fbo.makeObfuscator())

				// If the write was processed first, re-use that item.
				itemSlice, ok := items[item.CurrPath.CanonicalPathString()]
				if ok {
					for _, existingItem := range itemSlice {
						if existingItem.Type == ChangeTypeWrite {
							newItem = false
							item = existingItem
						}
					}
				}
				item.IsNew = true
			case *syncOp:
				// If the create was processed first, reuse that item.
				itemSlice, ok := items[item.CurrPath.CanonicalPathString()]
				if ok {
					for _, existingItem := range itemSlice {
						if existingItem.Type == ChangeTypeWrite {
							newItem = false
							item = existingItem
							item.CurrPath.Path[len(item.CurrPath.Path)-1].
								BlockPointer = chain.mostRecent
							break
						}
					}
				}
				item.Type = ChangeTypeWrite
				item.OldPtr = chain.original
			case *renameOp:
				item.Type = ChangeTypeRename
				err := item.addUnrefs(chains, op)
				if err != nil {
					return nil, 0, err
				}
				// Don't force there to be a pointer for the node,
				// since it could be a symlink.
				item.CurrPath = item.CurrPath.ChildPathNoPtr(
					realOp.obfuscatedNewName(), fbo.makeObfuscator())
			case *rmOp:
				item.Type = ChangeTypeDelete
				// Find the original block pointers for each unref.
				err := item.addUnrefs(chains, op)
				if err != nil {
					return nil, 0, err
				}
				unrefs := op.Unrefs()
				if len(unrefs) > 0 {
					unref := unrefs[0]
					ptr, err := chains.originalFromMostRecentOrSame(unref)
					if err != nil {
						return nil, 0, err
					}
					item.CurrPath = item.CurrPath.ChildPath(
						realOp.obfuscatedOldName(), ptr, fbo.makeObfuscator())
				}
			}

			if newItem {
				pString := item.CurrPath.CanonicalPathString()
				items[pString] = append(items[pString], item)
				numItems++

				// Add in an update for every directory whose blockpointer
				// was updated.
				currPath := item.CurrPath
				for currPath.HasValidParent() {
					currPath = *currPath.ParentPath()
					pString := currPath.CanonicalPathString()
					itemSlice, ok := items[pString]
					needsUpdate := true
					if ok {
						for _, existingItem := range itemSlice {
							if existingItem.Type == ChangeTypeWrite {
								needsUpdate = false
								break
							}
						}
					}
					if !needsUpdate {
						break
					}
					oldPtr, err := chains.originalFromMostRecentOrSame(
						currPath.TailPointer())
					if err != nil {
						return nil, 0, err
					}
					item := &ChangeItem{
						Type:     ChangeTypeWrite,
						CurrPath: currPath,
						OldPtr:   oldPtr,
					}
					items[pString] = append(items[pString], item)
				}
			}
		}
	}

	changes = make([]*ChangeItem, 0, numItems)
	for _, itemSlice := range items {
		changes = append(changes, itemSlice...)
	}

	// Renames should always go at the end, since if there's a pointer
	// change for the renamed thing (e.g., because it was a directory
	// that changed or a file that was written), we need to process
	// that pointer change before the rename.
	sort.SliceStable(changes, func(i, j int) bool {
		if changes[i].Type != ChangeTypeRename &&
			changes[j].Type == ChangeTypeRename {
			return true
		}
		return false
	})

	return changes, refSize, nil
}
