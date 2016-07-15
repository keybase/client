// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// MDOpsStandard provides plaintext RootMetadata objects to upper
// layers, and processes RootMetadataSigned objects (encrypted and
// signed) suitable for passing to/from the MDServer backend.
type MDOpsStandard struct {
	config Config
	log    logger.Logger
}

// NewMDOpsStandard returns a new MDOpsStandard
func NewMDOpsStandard(config Config) *MDOpsStandard {
	return &MDOpsStandard{config, config.MakeLogger("")}
}

// convertVerifyingKeyError gives a better error when the TLF was
// signed by a key that is no longer associated with the last writer.
func (md *MDOpsStandard) convertVerifyingKeyError(ctx context.Context,
	rmds *RootMetadataSigned, handle *TlfHandle, err error) error {
	if _, ok := err.(KeyNotFoundError); !ok {
		return err
	}

	tlf := handle.GetCanonicalPath()
	writer, nameErr := md.config.KBPKI().GetNormalizedUsername(ctx,
		rmds.MD.LastModifyingWriter)
	if nameErr != nil {
		writer = libkb.NormalizedUsername("uid: " +
			rmds.MD.LastModifyingWriter.String())
	}
	md.log.CDebugf(ctx, "Unverifiable update for TLF %s", rmds.MD.ID)
	return UnverifiableTlfUpdateError{tlf, writer, err}
}

func (md *MDOpsStandard) verifyWriterKey(
	ctx context.Context, rmds *RootMetadataSigned, handle *TlfHandle) error {
	if !rmds.MD.IsWriterMetadataCopiedSet() {
		var err error
		if handle.IsFinal() {
			err = md.config.KBPKI().HasUnverifiedVerifyingKey(ctx,
				rmds.MD.LastModifyingWriter,
				rmds.MD.WriterMetadataSigInfo.VerifyingKey)
		} else {
			err = md.config.KBPKI().HasVerifyingKey(ctx,
				rmds.MD.LastModifyingWriter,
				rmds.MD.WriterMetadataSigInfo.VerifyingKey,
				rmds.untrustedServerTimestamp)
		}
		if err != nil {
			return md.convertVerifyingKeyError(ctx, rmds, handle, err)
		}
		return nil

	}

	// The server timestamp on rmds does not reflect when the
	// writer MD was actually signed, since it was copied from a
	// previous revision.  Search backwards for the most recent
	// uncopied writer MD to get the right timestamp.
	prevHead := rmds.MD.Revision - 1
	for {
		startRev := prevHead - maxMDsAtATime + 1
		if startRev < MetadataRevisionInitial {
			startRev = MetadataRevisionInitial
		}

		// Recursively call into MDOps.  Note that in the case where
		// we were already fetching a range of MDs, this could do
		// extra work by downloading the same MDs twice (for those
		// that aren't yet in the cache).  That should be so rare that
		// it's not worth optimizing.
		prevMDs, err := getMDRange(ctx, md.config, rmds.MD.ID, rmds.MD.BID,
			startRev, prevHead, rmds.MD.MergedStatus())
		if err != nil {
			return err
		}

		for i := len(prevMDs) - 1; i >= 0; i-- {
			if !prevMDs[i].IsWriterMetadataCopiedSet() {
				ok, err := CodecEqual(md.config.Codec(),
					rmds.MD.WriterMetadataSigInfo,
					prevMDs[i].WriterMetadataSigInfo)
				if err != nil {
					return err
				}
				if !ok {
					return fmt.Errorf("Previous uncopied writer MD sig info "+
						"for revision %d of folder %s doesn't match copied "+
						"revision %d", prevMDs[i].Revision, rmds.MD.ID,
						rmds.MD.Revision)
				}
				// The fact the fact that we were able to process this
				// MD correctly means that we already verified its key
				// at the correct timestamp, so we're good.
				return nil
			}
		}

		// No more MDs left to process.
		if len(prevMDs) < maxMDsAtATime {
			return fmt.Errorf("Couldn't find uncopied MD previous to "+
				"revision %d of folder %s for checking the writer "+
				"timestamp", rmds.MD.Revision, rmds.MD.ID)
		}
		prevHead = prevMDs[0].Revision - 1
	}
}

func (md *MDOpsStandard) processMetadata(
	ctx context.Context, handle *TlfHandle, rmds *RootMetadataSigned) (
	ImmutableRootMetadata, error) {
	// A blank sig means this is a brand new MD object, and
	// there's nothing to do.
	if !rmds.IsInitialized() {
		return ImmutableRootMetadata{}, errors.New(
			"Missing RootMetadata signature")
	}

	// Otherwise, verify signatures and deserialize private data.

	// Make sure the last writer is really a valid writer
	writer := rmds.MD.LastModifyingWriter
	if !handle.IsWriter(writer) {
		return ImmutableRootMetadata{}, MDMismatchError{
			handle.GetCanonicalPath(),
			fmt.Errorf("Writer MD (id=%s) was written by a non-writer %s",
				rmds.MD.ID, writer)}
	}

	// Make sure the last user to change the blob is really a valid reader
	user := rmds.MD.LastModifyingUser
	if !handle.IsReader(user) {
		return ImmutableRootMetadata{}, MDMismatchError{
			handle.GetCanonicalPath(),
			fmt.Errorf("MD (id=%s) was changed by a non-reader %s",
				rmds.MD.ID, user),
		}
	}

	if err := md.verifyWriterKey(ctx, rmds, handle); err != nil {
		return ImmutableRootMetadata{}, err
	}

	codec := md.config.Codec()
	crypto := md.config.Crypto()

	err := rmds.MD.VerifyWriterMetadata(codec, crypto)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if handle.IsFinal() {
		err = md.config.KBPKI().HasUnverifiedVerifyingKey(ctx, user,
			rmds.SigInfo.VerifyingKey)
	} else {
		err = md.config.KBPKI().HasVerifyingKey(ctx, user,
			rmds.SigInfo.VerifyingKey, rmds.untrustedServerTimestamp)
	}
	if err != nil {
		return ImmutableRootMetadata{}, md.convertVerifyingKeyError(ctx, rmds, handle, err)
	}

	err = rmds.VerifyRootMetadata(codec, crypto)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	rmd := RootMetadata{
		BareRootMetadata: rmds.MD,
		tlfHandle:        handle,
	}

	// Try to decrypt using the keys available in this md.  If that
	// doesn't work, a future MD may contain more keys and will be
	// tried later.
	err = decryptMDPrivateData(
		ctx, md.config, &rmd, rmd.ReadOnly())
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	mdID, err := md.config.Crypto().MakeMdID(&rmd.BareRootMetadata)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	return MakeImmutableRootMetadata(&rmd, mdID), nil
}

func (md *MDOpsStandard) getForHandle(ctx context.Context, handle *TlfHandle,
	mStatus MergeStatus) (TlfID, ImmutableRootMetadata, error) {
	mdserv := md.config.MDServer()
	bh, err := handle.ToBareHandle()
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	id, rmds, err := mdserv.GetForHandle(ctx, bh, mStatus)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	if rmds == nil {
		if mStatus == Unmerged {
			// The caller ignores the id argument for
			// mStatus == Unmerged.
			return TlfID{}, ImmutableRootMetadata{}, nil
		}
		return id, ImmutableRootMetadata{}, nil
	}

	bareMdHandle, err := rmds.MD.MakeBareTlfHandle()
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	mdHandle, err := MakeTlfHandle(ctx, bareMdHandle, md.config.KBPKI())
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	handleResolvesToMdHandle, partialResolvedHandle, err :=
		handle.ResolvesTo(
			ctx, md.config.Codec(), md.config.KBPKI(), *mdHandle)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	// TODO: If handle has conflict info, mdHandle should, too.
	mdHandleResolvesToHandle, partialResolvedMdHandle, err :=
		mdHandle.ResolvesTo(
			ctx, md.config.Codec(), md.config.KBPKI(), *handle)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	handlePath := handle.GetCanonicalPath()
	mdHandlePath := mdHandle.GetCanonicalPath()
	if !handleResolvesToMdHandle && !mdHandleResolvesToHandle {
		return TlfID{}, ImmutableRootMetadata{}, MDMismatchError{
			handle.GetCanonicalPath(),
			fmt.Errorf(
				"MD (id=%s) contained unexpected handle path %s (%s -> %s) (%s -> %s)",
				rmds.MD.ID, mdHandlePath,
				handle.GetCanonicalPath(),
				partialResolvedHandle.GetCanonicalPath(),
				mdHandle.GetCanonicalPath(),
				partialResolvedMdHandle.GetCanonicalPath()),
		}
	}

	if handlePath != mdHandlePath {
		md.log.CDebugf(ctx, "handle for %s resolved to %s",
			handlePath, mdHandlePath)
	}

	// TODO: For now, use the mdHandle that came with rmds for
	// consistency. In the future, we'd want to eventually notify
	// the upper layers of the new name, either directly, or
	// through a rekey.
	rmd, err := md.processMetadata(ctx, mdHandle, rmds)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	return id, rmd, nil
}

// GetForHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForHandle(ctx context.Context, handle *TlfHandle) (
	TlfID, ImmutableRootMetadata, error) {
	return md.getForHandle(ctx, handle, Merged)
}

// GetUnmergedForHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedForHandle(ctx context.Context, handle *TlfHandle) (
	ImmutableRootMetadata, error) {
	_, rmd, err := md.getForHandle(ctx, handle, Unmerged)
	return rmd, err
}

func (md *MDOpsStandard) processMetadataWithID(ctx context.Context,
	id TlfID, bid BranchID, handle *TlfHandle, rmds *RootMetadataSigned) (
	ImmutableRootMetadata, error) {
	// Make sure the signed-over ID matches
	if id != rmds.MD.ID {
		return ImmutableRootMetadata{}, MDMismatchError{
			id.String(),
			fmt.Errorf("MD contained unexpected folder id %s, expected %s",
				rmds.MD.ID.String(), id.String()),
		}
	}
	// Make sure the signed-over branch ID matches
	if bid != rmds.MD.BID {
		return ImmutableRootMetadata{}, MDMismatchError{
			id.String(),
			fmt.Errorf("MD contained unexpected branch id %s, expected %s, "+
				"folder id %s", rmds.MD.BID.String(), bid.String(), id.String()),
		}
	}

	return md.processMetadata(ctx, handle, rmds)
}

func (md *MDOpsStandard) getForTLF(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus) (ImmutableRootMetadata, error) {
	rmds, err := md.config.MDServer().GetForTLF(ctx, id, bid, mStatus)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if rmds == nil {
		// Possible if mStatus is Unmerged
		return ImmutableRootMetadata{}, nil
	}
	bareHandle, err := rmds.MD.MakeBareTlfHandle()
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	handle, err := MakeTlfHandle(ctx, bareHandle, md.config.KBPKI())
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmd, err := md.processMetadataWithID(ctx, id, bid, handle, rmds)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return rmd, nil
}

// GetForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForTLF(ctx context.Context, id TlfID) (
	ImmutableRootMetadata, error) {
	return md.getForTLF(ctx, id, NullBranchID, Merged)
}

// GetUnmergedForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedForTLF(
	ctx context.Context, id TlfID, bid BranchID) (
	ImmutableRootMetadata, error) {
	return md.getForTLF(ctx, id, bid, Unmerged)
}

func (md *MDOpsStandard) processRange(ctx context.Context, id TlfID,
	bid BranchID, rmdses []*RootMetadataSigned) (
	[]ImmutableRootMetadata, error) {
	if rmdses == nil {
		return nil, nil
	}

	// Verify that the given MD objects form a valid sequence.
	var prevIRMD ImmutableRootMetadata
	irmds := make([]ImmutableRootMetadata, 0, len(rmdses))
	for _, r := range rmdses {
		bareHandle, err := r.MD.MakeBareTlfHandle()
		if err != nil {
			return nil, err
		}
		handle, err := MakeTlfHandle(ctx, bareHandle, md.config.KBPKI())
		if err != nil {
			return nil, err
		}

		if prevIRMD != (ImmutableRootMetadata{}) {
			// Ideally, we'd call
			// ReadOnlyRootMetadata.CheckValidSuccessor()
			// instead. However, we only convert r.MD to
			// an ImmutableRootMetadata in
			// processMetadataWithID below, and we want to
			// do this check before then.
			err = prevIRMD.BareRootMetadata.CheckValidSuccessor(
				prevIRMD.mdID, &r.MD)
			if err != nil {
				return nil, MDMismatchError{
					handle.GetCanonicalPath(),
					err,
				}
			}
		}

		irmd, err := md.processMetadataWithID(ctx, id, bid, handle, r)
		if err != nil {
			return nil, err
		}
		prevIRMD = irmd
		irmds = append(irmds, irmd)
	}

	// TODO: in the case where lastRoot == MdID{}, should we verify
	// that the starting PrevRoot points back to something that's
	// actually a valid part of this history?  If the MD signature is
	// indeed valid, this probably isn't a huge deal, but it may let
	// the server rollback or truncate unmerged history...

	return irmds, nil
}

func (md *MDOpsStandard) getRange(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus, start, stop MetadataRevision) (
	[]ImmutableRootMetadata, error) {
	rmds, err := md.config.MDServer().GetRange(
		ctx, id, bid, mStatus, start, stop)
	if err != nil {
		return nil, err
	}
	rmd, err := md.processRange(ctx, id, bid, rmds)
	if err != nil {
		return nil, err
	}
	return rmd, nil
}

// GetRange implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) ([]ImmutableRootMetadata, error) {
	return md.getRange(ctx, id, NullBranchID, Merged, start, stop)
}

// GetUnmergedRange implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedRange(ctx context.Context, id TlfID,
	bid BranchID, start, stop MetadataRevision) ([]ImmutableRootMetadata, error) {
	return md.getRange(ctx, id, bid, Unmerged, start, stop)
}

func (md *MDOpsStandard) readyMD(ctx context.Context, rmd *RootMetadata) (
	rms *RootMetadataSigned, err error) {
	_, me, err := md.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, err
	}

	codec := md.config.Codec()
	crypto := md.config.Crypto()

	if rmd.ID.IsPublic() || !rmd.IsWriterMetadataCopiedSet() {
		// Record the last writer to modify this writer metadata
		rmd.LastModifyingWriter = me

		if rmd.ID.IsPublic() {
			// Encode the private metadata
			encodedPrivateMetadata, err := codec.Encode(rmd.data)
			if err != nil {
				return nil, err
			}
			rmd.SerializedPrivateMetadata = encodedPrivateMetadata
		} else if !rmd.IsWriterMetadataCopiedSet() {
			// Encrypt and encode the private metadata
			k, err := md.config.KeyManager().GetTLFCryptKeyForEncryption(
				ctx, rmd.ReadOnly())
			if err != nil {
				return nil, err
			}
			encryptedPrivateMetadata, err := crypto.EncryptPrivateMetadata(&rmd.data, k)
			if err != nil {
				return nil, err
			}
			encodedEncryptedPrivateMetadata, err := codec.Encode(encryptedPrivateMetadata)
			if err != nil {
				return nil, err
			}
			rmd.SerializedPrivateMetadata = encodedEncryptedPrivateMetadata
		}

		// Sign the writer metadata
		buf, err := codec.Encode(rmd.WriterMetadata)
		if err != nil {
			return nil, err
		}

		sigInfo, err := crypto.Sign(ctx, buf)
		if err != nil {
			return nil, err
		}
		rmd.WriterMetadataSigInfo = sigInfo
	}

	// Record the last user to modify this metadata
	rmd.LastModifyingUser = me

	// encode the root metadata and sign it
	buf, err := codec.Encode(rmd)
	if err != nil {
		return nil, err
	}

	rmds := &RootMetadataSigned{}
	err = codec.Decode(buf, &rmds.MD)
	if err != nil {
		return nil, err
	}

	// Sign normally using the local device private key
	sigInfo, err := crypto.Sign(ctx, buf)
	if err != nil {
		return nil, err
	}
	rmds.SigInfo = sigInfo

	return rmds, nil
}

func (md *MDOpsStandard) put(ctx context.Context, rmd *RootMetadata) error {
	err := rmd.data.checkValid()
	if err != nil {
		return err
	}

	rmds, err := md.readyMD(ctx, rmd)
	if err != nil {
		return err
	}
	err = md.config.MDServer().Put(ctx, rmds)
	if err != nil {
		return err
	}
	return nil
}

// Put implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Put(ctx context.Context, rmd *RootMetadata) error {
	if rmd.MergedStatus() == Unmerged {
		return UnexpectedUnmergedPutError{}
	}
	return md.put(ctx, rmd)
}

// PutUnmerged implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PutUnmerged(ctx context.Context, rmd *RootMetadata, bid BranchID) error {
	rmd.WFlags |= MetadataFlagUnmerged
	rmd.BID = bid
	return md.put(ctx, rmd)
}

// GetLatestHandleForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetLatestHandleForTLF(ctx context.Context, id TlfID) (
	BareTlfHandle, error) {
	// TODO: Verify this mapping using a Merkle tree.
	return md.config.MDServer().GetLatestHandleForTLF(ctx, id)
}
