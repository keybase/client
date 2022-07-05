// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
)

// RootMetadataSigned is the top-level MD object stored in MD server
type RootMetadataSigned struct {
	// SigInfo is the signature over the root metadata by the
	// last modifying user's private signing key.
	SigInfo kbfscrypto.SignatureInfo
	// WriterSigInfo is the signature over the writer metadata by
	// the last modifying writer's private signing key.
	WriterSigInfo kbfscrypto.SignatureInfo
	// all the metadata
	MD RootMetadata
}

func checkWriterSig(rmds *RootMetadataSigned) error {
	if mdv2, ok := rmds.MD.(*RootMetadataV2); ok {
		if !mdv2.WriterMetadataSigInfo.Equals(rmds.WriterSigInfo) {
			return fmt.Errorf(
				"Expected writer sig info %v, got %v",
				mdv2.WriterMetadataSigInfo, rmds.WriterSigInfo)
		}
	}
	return nil
}

// makeRootMetadataSigned makes a RootMetadataSigned object from the
// given info. If md stores the writer signature info internally, it
// must match the given one.
func makeRootMetadataSigned(sigInfo, writerSigInfo kbfscrypto.SignatureInfo,
	md RootMetadata) (*RootMetadataSigned, error) {
	rmds := &RootMetadataSigned{
		MD:            md,
		SigInfo:       sigInfo,
		WriterSigInfo: writerSigInfo,
	}
	err := checkWriterSig(rmds)
	if err != nil {
		return nil, err
	}
	return rmds, nil
}

// SignRootMetadata signs the given RootMetadata and returns a
// *RootMetadataSigned object. rootMetadataSigner and
// writerMetadataSigner should be the same, except in tests.
func SignRootMetadata(
	ctx context.Context, codec kbfscodec.Codec,
	rootMetadataSigner, writerMetadataSigner kbfscrypto.Signer,
	brmd RootMetadata) (*RootMetadataSigned, error) {
	// encode the root metadata
	buf, err := codec.Encode(brmd)
	if err != nil {
		return nil, err
	}

	var sigInfo, writerSigInfo kbfscrypto.SignatureInfo
	if mdv2, ok := brmd.(*RootMetadataV2); ok {
		// sign the root metadata
		sigInfo, err = rootMetadataSigner.Sign(ctx, buf)
		if err != nil {
			return nil, err
		}
		// Assume that writerMetadataSigner has already signed
		// mdv2 internally. If not, makeRootMetadataSigned
		// will catch it.
		writerSigInfo = mdv2.WriterMetadataSigInfo
	} else {
		// sign the root metadata -- use the KBFS signing prefix.
		sigInfo, err = rootMetadataSigner.SignForKBFS(ctx, buf)
		if err != nil {
			return nil, err
		}
		buf, err = brmd.GetSerializedWriterMetadata(codec)
		if err != nil {
			return nil, err
		}
		// sign the writer metadata
		writerSigInfo, err = writerMetadataSigner.SignForKBFS(ctx, buf)
		if err != nil {
			return nil, err
		}
	}
	return makeRootMetadataSigned(sigInfo, writerSigInfo, brmd)
}

// GetWriterMetadataSigInfo returns the signature of the writer
// metadata.
func (rmds *RootMetadataSigned) GetWriterMetadataSigInfo() kbfscrypto.SignatureInfo {
	return rmds.WriterSigInfo
}

// Version returns the metadata version of this MD block, depending on
// which features it uses.
func (rmds *RootMetadataSigned) Version() MetadataVer {
	return rmds.MD.Version()
}

// MakeFinalCopy returns a complete copy of this RootMetadataSigned
// with the revision incremented and the final bit set.
func (rmds *RootMetadataSigned) MakeFinalCopy(
	codec kbfscodec.Codec, finalizedInfo *tlf.HandleExtension) (*RootMetadataSigned, error) {
	if finalizedInfo.Type != tlf.HandleExtensionFinalized {
		return nil, fmt.Errorf(
			"Extension %s does not have finalized type",
			finalizedInfo)
	}
	if rmds.MD.IsFinal() {
		return nil, MetadataIsFinalError{}
	}
	newMd, err := rmds.MD.DeepCopy(codec)
	if err != nil {
		return nil, err
	}
	// Set the final flag.
	newMd.SetFinalBit()
	// Set the copied bit, so that clients don't take the ops and byte
	// counts in it seriously.
	newMd.SetWriterMetadataCopiedBit()
	// Increment revision but keep the PrevRoot --
	// We want the client to be able to verify the signature by masking out the final
	// bit, decrementing the revision, and nulling out the finalized extension info.
	// This way it can easily tell a server didn't modify anything unexpected when
	// creating the final metadata block. Note that PrevRoot isn't being updated. This
	// is to make verification easier for the client as otherwise it'd need to request
	// the head revision - 1.
	newMd.SetRevision(rmds.MD.RevisionNumber() + 1)
	newMd.SetFinalizedInfo(finalizedInfo)
	return makeRootMetadataSigned(
		rmds.SigInfo.DeepCopy(), rmds.WriterSigInfo.DeepCopy(),
		newMd)
}

// IsValidAndSigned verifies the RootMetadataSigned, checks the root
// signature, and returns an error if a problem was found.  This
// should be the first thing checked on an RMDS retrieved from an
// untrusted source, and then the signing users and keys should be
// validated, either by comparing to the current device key (using
// IsLastModifiedBy), or by checking with KBPKI.
func (rmds *RootMetadataSigned) IsValidAndSigned(
	ctx context.Context, codec kbfscodec.Codec,
	teamMemChecker TeamMembershipChecker, extra ExtraMetadata,
	offline keybase1.OfflineAvailability) error {
	// Optimization -- if the RootMetadata signature is nil, it
	// will fail verification.
	if rmds.SigInfo.IsNil() {
		return errors.New("Missing RootMetadata signature")
	}
	// Optimization -- if the WriterMetadata signature is nil, it
	// will fail verification.
	if rmds.WriterSigInfo.IsNil() {
		return errors.New("Missing WriterMetadata signature")
	}

	err := rmds.MD.IsValidAndSigned(
		ctx, codec, teamMemChecker, extra, rmds.WriterSigInfo.VerifyingKey,
		offline)
	if err != nil {
		return err
	}

	md := rmds.MD
	if rmds.MD.IsFinal() {
		mdCopy, err := md.DeepCopy(codec)
		if err != nil {
			return err
		}
		mutableMdCopy, ok := mdCopy.(MutableRootMetadata)
		if !ok {
			return MutableRootMetadataNoImplError{}
		}
		// Mask out finalized additions.  These are the only
		// things allowed to change in the finalized metadata
		// block.
		mutableMdCopy.ClearFinalBit()
		mutableMdCopy.ClearWriterMetadataCopiedBit()
		mutableMdCopy.SetRevision(md.RevisionNumber() - 1)
		mutableMdCopy.SetFinalizedInfo(nil)
		md = mutableMdCopy
	}
	// Re-marshal the whole RootMetadata. This is not avoidable
	// without support from ugorji/codec.
	buf, err := codec.Encode(md)
	if err != nil {
		return err
	}

	err = kbfscrypto.Verify(buf, rmds.SigInfo)
	if err != nil {
		return fmt.Errorf("Could not verify root metadata: %v", err)
	}

	buf, err = md.GetSerializedWriterMetadata(codec)
	if err != nil {
		return err
	}

	err = kbfscrypto.Verify(buf, rmds.WriterSigInfo)
	if err != nil {
		return fmt.Errorf("Could not verify writer metadata: %v", err)
	}

	return nil
}

// IsLastModifiedBy verifies that the RootMetadataSigned is written by
// the given user and device (identified by the device verifying key),
// and returns an error if not.
func (rmds *RootMetadataSigned) IsLastModifiedBy(
	uid keybase1.UID, key kbfscrypto.VerifyingKey) error {
	err := rmds.MD.IsLastModifiedBy(uid, key)
	if err != nil {
		return err
	}

	if rmds.SigInfo.VerifyingKey != key {
		return fmt.Errorf("Last modifier verifying key %v != %v",
			rmds.SigInfo.VerifyingKey, key)
	}

	writer := rmds.MD.LastModifyingWriter()
	if !rmds.MD.IsWriterMetadataCopiedSet() {
		if writer != uid {
			return fmt.Errorf("Last writer %s != %s", writer, uid)
		}
		if rmds.WriterSigInfo.VerifyingKey != key {
			return fmt.Errorf(
				"Last writer verifying key %v != %v",
				rmds.WriterSigInfo.VerifyingKey, key)
		}
	}

	return nil
}

// EncodeRootMetadataSigned serializes a metadata block. This should
// be used instead of directly calling codec.Encode(), as it handles
// some version-specific quirks.
func EncodeRootMetadataSigned(
	codec kbfscodec.Codec, rmds *RootMetadataSigned) ([]byte, error) {
	err := checkWriterSig(rmds)
	if err != nil {
		return nil, err
	}
	rmdsCopy := *rmds
	if rmdsCopy.Version() < SegregatedKeyBundlesVer {
		// For v2, the writer signature is in rmds.MD, so
		// remove the one in rmds.
		rmdsCopy.WriterSigInfo = kbfscrypto.SignatureInfo{}
	}
	return codec.Encode(rmdsCopy)
}

// DecodeRootMetadataSigned deserializes a metadata block into the
// specified versioned structure.
func DecodeRootMetadataSigned(
	codec kbfscodec.Codec, tlf tlf.ID, ver, max MetadataVer, buf []byte) (
	*RootMetadataSigned, error) {
	rmd, err := makeMutableRootMetadataForDecode(codec, tlf, ver, max, buf)
	if err != nil {
		return nil, err
	}
	rmds := RootMetadataSigned{
		MD: rmd,
	}
	if err := codec.Decode(buf, &rmds); err != nil {
		return nil, err
	}
	if ver < SegregatedKeyBundlesVer {
		// For v2, the writer signature is in rmds.MD, so copy
		// it out.
		if !rmds.WriterSigInfo.IsNil() {
			return nil, fmt.Errorf(
				"Decoded RootMetadataSigned with version "+
					"%d unexpectedly has non-nil "+
					"writer signature %s",
				ver, rmds.WriterSigInfo)
		}
		mdv2 := rmds.MD.(*RootMetadataV2)
		rmds.WriterSigInfo = mdv2.WriterMetadataSigInfo
	}
	return &rmds, nil
}
