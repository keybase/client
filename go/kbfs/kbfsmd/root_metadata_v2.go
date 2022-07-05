// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

// WriterMetadataV2 stores the metadata for a TLF that is
// only editable by users with writer permissions.
//
// NOTE: Don't add new fields to this type! Instead, add them to
// WriterMetadataExtraV2. This is because we want old clients to
// preserve unknown fields, and we're unable to do that for
// WriterMetadata directly because it's embedded in RootMetadata.
type WriterMetadataV2 struct {
	// Serialized, possibly encrypted, version of the PrivateMetadata
	SerializedPrivateMetadata []byte `codec:"data"`
	// The last KB user with writer permissions to this TLF
	// who modified this WriterMetadata
	LastModifyingWriter keybase1.UID
	// For public and single-team TLFs (since those don't have any
	// keys at all).
	Writers []keybase1.UserOrTeamID `codec:",omitempty"`
	// For private TLFs. Writer key generations for this metadata. The
	// most recent one is last in the array. Must be same length as
	// RootMetadata.RKeys.
	WKeys TLFWriterKeyGenerationsV2 `codec:",omitempty"`
	// The directory ID, signed over to make verification easier
	ID tlf.ID
	// The branch ID, currently only set if this is in unmerged per-device history.
	BID BranchID
	// Flags
	WFlags WriterFlags
	// Estimated disk usage at this revision
	DiskUsage uint64
	// Estimated MD disk usage at this revision (for testing only --
	// real v2 MDs in the wild won't ever have this set).
	MDDiskUsage uint64 `codec:",omitempty"`

	// The total number of bytes in new data blocks
	RefBytes uint64
	// The total number of bytes in unreferenced blocks
	UnrefBytes uint64
	// The total number of bytes in new MD blocks (for testing only --
	// real v2 MDs in the wild won't ever have this set).
	MDRefBytes uint64 `codec:",omitempty"`

	// TODO: Remove omitempty and omitemptycheckstruct once we use
	// a version of go-codec that supports omitemptyrecursive.
	Extra WriterMetadataExtraV2 `codec:"x,omitemptyrecursive,omitempty,omitemptycheckstruct"`
}

// ToWriterMetadataV3 converts the WriterMetadataV2 to a
// WriterMetadataV3.
func (wmdV2 *WriterMetadataV2) ToWriterMetadataV3() WriterMetadataV3 {
	var wmdV3 WriterMetadataV3
	wmdV3.Writers = make([]keybase1.UserOrTeamID, len(wmdV2.Writers))
	copy(wmdV3.Writers, wmdV2.Writers)

	wmdV3.UnresolvedWriters = make([]keybase1.SocialAssertion, len(wmdV2.Extra.UnresolvedWriters))
	copy(wmdV3.UnresolvedWriters, wmdV2.Extra.UnresolvedWriters)

	wmdV3.ID = wmdV2.ID
	wmdV3.BID = wmdV2.BID
	wmdV3.WFlags = wmdV2.WFlags
	wmdV3.DiskUsage = wmdV2.DiskUsage
	wmdV3.MDDiskUsage = wmdV2.MDDiskUsage
	wmdV3.RefBytes = wmdV2.RefBytes
	wmdV3.UnrefBytes = wmdV2.UnrefBytes
	wmdV3.MDRefBytes = wmdV2.MDRefBytes

	if wmdV2.ID.Type() == tlf.Public {
		wmdV3.LatestKeyGen = PublicKeyGen
	} else {
		wmdV3.LatestKeyGen = wmdV2.WKeys.LatestKeyGeneration()
	}
	return wmdV3
}

// WriterMetadataExtraV2 stores more fields for WriterMetadataV2. (See
// WriterMetadataV2 comments as to why this type is needed.)
type WriterMetadataExtraV2 struct {
	UnresolvedWriters []keybase1.SocialAssertion `codec:"uw,omitempty"`
	codec.UnknownFieldSetHandler
}

// RootMetadataV2 is the MD that is signed by the reader or
// writer. Unlike RootMetadata, it contains exactly the serializable
// metadata.
type RootMetadataV2 struct {
	// The metadata that is only editable by the writer.
	//
	// TODO: If we ever get a chance to update RootMetadata
	// without having to be backwards-compatible, WriterMetadata
	// should be unembedded; see comments to WriterMetadata as for
	// why.
	WriterMetadataV2

	// The signature for the writer metadata, to prove
	// that it's only been changed by writers.
	WriterMetadataSigInfo kbfscrypto.SignatureInfo

	// The last KB user who modified this RootMetadata
	LastModifyingUser keybase1.UID
	// Flags
	Flags MetadataFlags
	// The revision number
	Revision Revision
	// Pointer to the previous root block ID
	PrevRoot ID
	// For private TLFs. Reader key generations for this metadata. The
	// most recent one is last in the array. Must be same length as
	// WriterMetadata.WKeys. If there are no readers, each generation
	// is empty.
	RKeys TLFReaderKeyGenerationsV2 `codec:",omitempty"`
	// For private TLFs. Any unresolved social assertions for readers.
	UnresolvedReaders []keybase1.SocialAssertion `codec:"ur,omitempty"`

	// ConflictInfo is set if there's a conflict for the given folder's
	// handle after a social assertion resolution.
	ConflictInfo *tlf.HandleExtension `codec:"ci,omitempty"`

	// FinalizedInfo is set if there are no more valid writer keys capable
	// of writing to the given folder.
	FinalizedInfo *tlf.HandleExtension `codec:"fi,omitempty"`

	codec.UnknownFieldSetHandler
}

// MakeInitialRootMetadataV2 creates a new RootMetadataV2
// object with revision RevisionInitial, and the given TLF ID
// and handle. Note that if the given ID/handle are private, rekeying
// must be done separately.
func MakeInitialRootMetadataV2(tlfID tlf.ID, h tlf.Handle) (
	*RootMetadataV2, error) {
	if tlfID.Type() != h.Type() {
		return nil, errors.New("TlfID and TlfHandle disagree on TLF type")
	}

	var writers []keybase1.UserOrTeamID
	var wKeys TLFWriterKeyGenerationsV2
	var rKeys TLFReaderKeyGenerationsV2
	if tlfID.Type() == tlf.Private {
		wKeys = make(TLFWriterKeyGenerationsV2, 0, 1)
		rKeys = make(TLFReaderKeyGenerationsV2, 0, 1)
	} else {
		writers = make([]keybase1.UserOrTeamID, len(h.Writers))
		copy(writers, h.Writers)
	}

	var unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion
	if len(h.UnresolvedWriters) > 0 {
		unresolvedWriters = make(
			[]keybase1.SocialAssertion, len(h.UnresolvedWriters))
		copy(unresolvedWriters, h.UnresolvedWriters)
	}

	if len(h.UnresolvedReaders) > 0 {
		unresolvedReaders = make(
			[]keybase1.SocialAssertion, len(h.UnresolvedReaders))
		copy(unresolvedReaders, h.UnresolvedReaders)
	}

	return &RootMetadataV2{
		WriterMetadataV2: WriterMetadataV2{
			Writers: writers,
			WKeys:   wKeys,
			ID:      tlfID,
			Extra: WriterMetadataExtraV2{
				UnresolvedWriters: unresolvedWriters,
			},
		},
		Revision:          RevisionInitial,
		RKeys:             rKeys,
		UnresolvedReaders: unresolvedReaders,
		// Normally an MD wouldn't start out with extensions, but this
		// is useful for tests.
		ConflictInfo:  h.ConflictInfo,
		FinalizedInfo: h.FinalizedInfo,
	}, nil
}

// TlfID implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) TlfID() tlf.ID {
	return md.ID
}

// TypeForKeying implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) TypeForKeying() tlf.KeyingType {
	return md.TlfID().Type().ToKeyingType()
}

// KeyGenerationsToUpdate implements the RootMetadata interface
// for RootMetadataV2.
func (md *RootMetadataV2) KeyGenerationsToUpdate() (KeyGen, KeyGen) {
	latest := md.LatestKeyGeneration()
	if latest < FirstValidKeyGen {
		return 0, 0
	}
	// We keep track of all known key generations.
	return FirstValidKeyGen, latest + 1
}

// LatestKeyGeneration implements the RootMetadata interface for
// RootMetadataV2.
func (md *RootMetadataV2) LatestKeyGeneration() KeyGen {
	if md.ID.Type() == tlf.Public {
		return PublicKeyGen
	}
	return md.WKeys.LatestKeyGeneration()
}

func (md *RootMetadataV2) haveOnlyUserRKeysChanged(
	codec kbfscodec.Codec, prevMD *RootMetadataV2,
	user keybase1.UID) (bool, error) {
	// Require the same number of generations
	if len(md.RKeys) != len(prevMD.RKeys) {
		return false, nil
	}
	for i, gen := range md.RKeys {
		prevMDGen := prevMD.RKeys[i]
		if len(gen.RKeys) != len(prevMDGen.RKeys) {
			return false, nil
		}
		for u, keys := range gen.RKeys {
			if u != user {
				prevKeys := prevMDGen.RKeys[u]
				keysEqual, err :=
					kbfscodec.Equal(codec, keys, prevKeys)
				if err != nil {
					return false, err
				}
				if !keysEqual {
					return false, nil
				}
			}
		}
	}
	return true, nil
}

// IsValidRekeyRequest implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsValidRekeyRequest(
	codec kbfscodec.Codec, prevBareMd RootMetadata,
	user keybase1.UID, _, _ ExtraMetadata) (bool, error) {
	if !md.IsWriterMetadataCopiedSet() {
		// Not a copy.
		return false, nil
	}
	prevMd, ok := prevBareMd.(*RootMetadataV2)
	if !ok {
		// Not the same type so not a copy.
		return false, nil
	}
	writerEqual, err := kbfscodec.Equal(
		codec, md.WriterMetadataV2, prevMd.WriterMetadataV2)
	if err != nil {
		return false, err
	}
	if !writerEqual {
		// Copy mismatch.
		return false, nil
	}
	writerSigInfoEqual, err := kbfscodec.Equal(codec,
		md.WriterMetadataSigInfo, prevMd.WriterMetadataSigInfo)
	if err != nil {
		return false, err
	}
	if !writerSigInfoEqual {
		// Signature/public key mismatch.
		return false, nil
	}
	onlyUserRKeysChanged, err := md.haveOnlyUserRKeysChanged(
		codec, prevMd, user)
	if err != nil {
		return false, err
	}
	if !onlyUserRKeysChanged {
		// Keys outside of this user's reader key set have changed.
		return false, nil
	}
	return true, nil
}

// MergedStatus implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) MergedStatus() MergeStatus {
	if md.WFlags&MetadataFlagUnmerged != 0 {
		return Unmerged
	}
	return Merged
}

// IsRekeySet implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsRekeySet() bool {
	return md.Flags&MetadataFlagRekey != 0
}

// IsWriterMetadataCopiedSet implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsWriterMetadataCopiedSet() bool {
	return md.Flags&MetadataFlagWriterMetadataCopied != 0
}

// IsFinal implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsFinal() bool {
	return md.Flags&MetadataFlagFinal != 0
}

// IsWriter implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsWriter(
	_ context.Context, user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey,
	_ kbfscrypto.VerifyingKey, _ TeamMembershipChecker, _ ExtraMetadata,
	_ keybase1.OfflineAvailability) (bool, error) {
	if md.ID.Type() != tlf.Private {
		for _, w := range md.Writers {
			if w == user.AsUserOrTeam() {
				return true, nil
			}
		}
		return false, nil
	}
	return md.WKeys.IsWriter(user, deviceKey), nil
}

// IsReader implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsReader(
	_ context.Context, user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey,
	_ TeamMembershipChecker, _ ExtraMetadata,
	_ keybase1.OfflineAvailability) (bool, error) {
	switch md.ID.Type() {
	case tlf.Public:
		return true, nil
	case tlf.Private:
		return md.RKeys.IsReader(user, deviceKey), nil
	case tlf.SingleTeam:
		// There are no read-only users of single-team TLFs.
		return false, nil
	default:
		panic(fmt.Sprintf("Unexpected TLF type: %s", md.ID.Type()))
	}
}

func (md *RootMetadataV2) deepCopy(
	codec kbfscodec.Codec) (*RootMetadataV2, error) {
	var newMd RootMetadataV2
	if err := kbfscodec.Update(codec, &newMd, md); err != nil {
		return nil, err
	}
	return &newMd, nil
}

// DeepCopy implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) DeepCopy(
	codec kbfscodec.Codec) (MutableRootMetadata, error) {
	return md.deepCopy(codec)
}

// MakeSuccessorCopy implements the ImmutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) MakeSuccessorCopy(
	codec kbfscodec.Codec, extra ExtraMetadata, latestMDVer MetadataVer,
	tlfCryptKeyGetter func() ([]kbfscrypto.TLFCryptKey, error),
	isReadableAndWriter bool) (
	MutableRootMetadata, ExtraMetadata, error) {

	if !isReadableAndWriter || (latestMDVer < SegregatedKeyBundlesVer) {
		// Continue with the current version.  If we're just a reader,
		// or can't decrypt the MD, we have to continue with v2
		// because we can't just copy a v2 signature into a v3 MD
		// blindly.
		mdCopy, err := md.makeSuccessorCopyV2(
			codec, isReadableAndWriter)
		if err != nil {
			return nil, nil, err
		}
		return mdCopy, nil, nil
	}

	// Upconvert to the new version.
	return md.makeSuccessorCopyV3(codec, tlfCryptKeyGetter)
}

func (md *RootMetadataV2) makeSuccessorCopyV2(
	codec kbfscodec.Codec, isReadableAndWriter bool) (
	*RootMetadataV2, error) {
	mdCopy, err := md.deepCopy(codec)
	if err != nil {
		return nil, err
	}
	if isReadableAndWriter {
		mdCopy.WriterMetadataSigInfo = kbfscrypto.SignatureInfo{}
	}
	return mdCopy, nil
}

func (md *RootMetadataV2) makeSuccessorCopyV3(
	codec kbfscodec.Codec,
	tlfCryptKeyGetter func() ([]kbfscrypto.TLFCryptKey, error)) (
	*RootMetadataV3, ExtraMetadata, error) {
	mdV3 := &RootMetadataV3{}

	// Fill out the writer metadata.
	mdV3.WriterMetadata = md.WriterMetadataV2.ToWriterMetadataV3()

	// Have this as ExtraMetadata so we return an untyped nil
	// instead of a typed nil.
	var extraCopy ExtraMetadata
	if md.LatestKeyGeneration() != PublicKeyGen && md.WKeys != nil {
		// Fill out the writer key bundle.
		wkbV2, wkbV3, err := md.WKeys.ToTLFWriterKeyBundleV3(
			codec, tlfCryptKeyGetter)
		if err != nil {
			return nil, nil, err
		}

		mdV3.WriterMetadata.WKeyBundleID, err =
			MakeTLFWriterKeyBundleID(codec, wkbV3)
		if err != nil {
			return nil, nil, err
		}

		// Fill out the reader key bundle.  wkbV2 is passed
		// because in V2 metadata ephemeral public keys for
		// readers were sometimes in the writer key bundles.
		rkbV3, err := md.RKeys.ToTLFReaderKeyBundleV3(codec, wkbV2)
		if err != nil {
			return nil, nil, err
		}
		mdV3.RKeyBundleID, err =
			MakeTLFReaderKeyBundleID(codec, rkbV3)
		if err != nil {
			return nil, nil, err
		}

		extraCopy = NewExtraMetadataV3(wkbV3, rkbV3, true, true)
	}

	mdV3.LastModifyingUser = md.LastModifyingUser
	mdV3.Flags = md.Flags
	mdV3.Revision = md.Revision // Incremented by the caller.
	// PrevRoot is set by the caller.
	mdV3.UnresolvedReaders = make([]keybase1.SocialAssertion, len(md.UnresolvedReaders))
	copy(mdV3.UnresolvedReaders, md.UnresolvedReaders)

	if md.ConflictInfo != nil {
		ci := *md.ConflictInfo
		mdV3.ConflictInfo = &ci
	}

	// Metadata with finalized info is never succeeded.
	if md.FinalizedInfo != nil {
		// Shouldn't be possible.
		return nil, nil, errors.New("Non-nil finalized info")
	}

	return mdV3, extraCopy, nil
}

// CheckValidSuccessor implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) CheckValidSuccessor(
	currID ID, nextMd RootMetadata) error {
	// (1) Verify current metadata is non-final.
	if md.IsFinal() {
		return MetadataIsFinalError{}
	}

	// (2) Check TLF ID.
	if nextMd.TlfID() != md.ID {
		return MDTlfIDMismatch{
			CurrID: md.ID,
			NextID: nextMd.TlfID(),
		}
	}

	// (3) Check revision.
	if nextMd.RevisionNumber() != md.RevisionNumber()+1 {
		return MDRevisionMismatch{
			Rev:  nextMd.RevisionNumber(),
			Curr: md.RevisionNumber(),
		}
	}

	// (4) Check PrevRoot pointer.
	expectedPrevRoot := currID
	if nextMd.IsFinal() {
		expectedPrevRoot = md.GetPrevRoot()
	}
	if nextMd.GetPrevRoot() != expectedPrevRoot {
		return MDPrevRootMismatch{
			prevRoot:         nextMd.GetPrevRoot(),
			expectedPrevRoot: expectedPrevRoot,
		}
	}

	// (5) Check branch ID.
	if md.MergedStatus() == nextMd.MergedStatus() && md.BID() != nextMd.BID() {
		return fmt.Errorf("Unexpected branch ID on successor: %s vs. %s",
			md.BID(), nextMd.BID())
	} else if md.MergedStatus() == Unmerged && nextMd.MergedStatus() == Merged {
		return errors.New("merged MD can't follow unmerged MD")
	}

	// (6) Check disk usage.
	expectedUsage := md.DiskUsage()
	if !nextMd.IsWriterMetadataCopiedSet() {
		expectedUsage += nextMd.RefBytes() - nextMd.UnrefBytes()
	}
	if nextMd.DiskUsage() != expectedUsage {
		return MDDiskUsageMismatch{
			expectedDiskUsage: expectedUsage,
			actualDiskUsage:   nextMd.DiskUsage(),
		}
	}
	expectedMDUsage := md.MDDiskUsage()
	if !nextMd.IsWriterMetadataCopiedSet() {
		expectedMDUsage += nextMd.MDRefBytes()
	}
	if nextMd.MDDiskUsage() != expectedMDUsage {
		return MDDiskUsageMismatch{
			expectedDiskUsage: expectedMDUsage,
			actualDiskUsage:   nextMd.MDDiskUsage(),
		}
	}

	// TODO: Check that the successor (bare) TLF handle is the
	// same or more resolved.

	return nil
}

// CheckValidSuccessorForServer implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) CheckValidSuccessorForServer(
	currID ID, nextMd RootMetadata) error {
	err := md.CheckValidSuccessor(currID, nextMd)
	switch err := err.(type) {
	case nil:
		break

	case MDRevisionMismatch:
		return ServerErrorConflictRevision{
			Expected: err.Curr + 1,
			Actual:   err.Rev,
		}

	case MDPrevRootMismatch:
		return ServerErrorConflictPrevRoot{
			Expected: err.expectedPrevRoot,
			Actual:   err.prevRoot,
		}

	case MDDiskUsageMismatch:
		return ServerErrorConflictDiskUsage{
			Expected: err.expectedDiskUsage,
			Actual:   err.actualDiskUsage,
		}

	default:
		return ServerError{Err: err}
	}

	return nil
}

// MakeBareTlfHandle implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) MakeBareTlfHandle(_ ExtraMetadata) (
	tlf.Handle, error) {
	var writers, readers []keybase1.UserOrTeamID
	if md.ID.Type() == tlf.Private {
		if len(md.WKeys) == 0 {
			return tlf.Handle{}, errors.New("No writer key generations; need rekey?")
		}

		if len(md.RKeys) == 0 {
			return tlf.Handle{}, errors.New("No reader key generations; need rekey?")
		}

		wkb := md.WKeys[len(md.WKeys)-1]
		rkb := md.RKeys[len(md.RKeys)-1]
		writers = make([]keybase1.UserOrTeamID, 0, len(wkb.WKeys))
		readers = make([]keybase1.UserOrTeamID, 0, len(rkb.RKeys))
		for w := range wkb.WKeys {
			writers = append(writers, w.AsUserOrTeam())
		}
		for r := range rkb.RKeys {
			// TODO: Return an error instead if r is
			// PublicUID. Maybe return an error if r is in
			// WKeys also. Or do all this in
			// MakeBareTlfHandle.
			if _, ok := wkb.WKeys[r]; !ok &&
				r != keybase1.PublicUID {
				readers = append(readers, r.AsUserOrTeam())
			}
		}
	} else {
		writers = md.Writers
		if md.ID.Type() == tlf.Public {
			readers = []keybase1.UserOrTeamID{keybase1.PublicUID.AsUserOrTeam()}
		}
	}

	return tlf.MakeHandle(
		writers, readers,
		md.Extra.UnresolvedWriters, md.UnresolvedReaders,
		md.TlfHandleExtensions())
}

// TlfHandleExtensions implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) TlfHandleExtensions() (
	extensions []tlf.HandleExtension) {
	if md.ConflictInfo != nil {
		extensions = append(extensions, *md.ConflictInfo)
	}
	if md.FinalizedInfo != nil {
		extensions = append(extensions, *md.FinalizedInfo)
	}
	return extensions
}

// PromoteReaders implements the RootMetadata interface for
// RootMetadataV2.
func (md *RootMetadataV2) PromoteReaders(
	readersToPromote map[keybase1.UID]bool,
	_ ExtraMetadata) error {
	if md.TlfID().Type() != tlf.Private {
		return InvalidNonPrivateTLFOperation{md.TlfID(), "PromoteReaders", md.Version()}
	}

	for i, rkb := range md.RKeys {
		for reader := range readersToPromote {
			dkim, ok := rkb.RKeys[reader]
			if !ok {
				return fmt.Errorf("Could not find %s in key gen %d",
					reader, FirstValidKeyGen+KeyGen(i))
			}
			// TODO: This may be incorrect, since dkim may
			// contain negative EPubKey indices, and the
			// upconversion code assumes that writers will
			// only contain non-negative EPubKey indices.
			//
			// See KBFS-1719.
			md.WKeys[i].WKeys[reader] = dkim
			delete(rkb.RKeys, reader)
		}
	}

	return nil
}

// RevokeRemovedDevices implements the RootMetadata interface for
// RootMetadataV2.
func (md *RootMetadataV2) RevokeRemovedDevices(
	updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
	_ ExtraMetadata) (ServerHalfRemovalInfo, error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "RevokeRemovedDevices", md.Version()}
	}

	var wRemovalInfo ServerHalfRemovalInfo
	for _, wkb := range md.WKeys {
		removalInfo := wkb.WKeys.RemoveDevicesNotIn(updatedWriterKeys)
		if wRemovalInfo == nil {
			wRemovalInfo = removalInfo
		} else {
			err := wRemovalInfo.AddGeneration(removalInfo)
			if err != nil {
				return nil, err
			}
		}
	}

	var rRemovalInfo ServerHalfRemovalInfo
	for _, rkb := range md.RKeys {
		removalInfo := rkb.RKeys.RemoveDevicesNotIn(updatedReaderKeys)
		if rRemovalInfo == nil {
			rRemovalInfo = removalInfo
		} else {
			err := rRemovalInfo.AddGeneration(removalInfo)
			if err != nil {
				return nil, err
			}
		}
	}

	return wRemovalInfo.MergeUsers(rRemovalInfo)
}

// getTLFKeyBundles returns the bundles for a given key generation.
// Note that it is legal a writer or a reader to have no keys in their
// bundle, if they only have a Keybase username with no device keys
// yet.
func (md *RootMetadataV2) getTLFKeyBundles(keyGen KeyGen) (
	*TLFWriterKeyBundleV2, *TLFReaderKeyBundleV2, error) {
	if md.ID.Type() != tlf.Private {
		return nil, nil, InvalidNonPrivateTLFOperation{md.ID, "getTLFKeyBundles", md.Version()}
	}

	if keyGen < FirstValidKeyGen {
		return nil, nil, InvalidKeyGenerationError{md.ID, keyGen}
	}
	i := int(keyGen - FirstValidKeyGen)
	if i >= len(md.WKeys) || i >= len(md.RKeys) {
		return nil, nil, NewKeyGenerationError{md.ID, keyGen}
	}
	return &md.WKeys[i], &md.RKeys[i], nil
}

// GetUserDevicePublicKeys implements the RootMetadata interface
// for RootMetadataV2.
func (md *RootMetadataV2) GetUserDevicePublicKeys(_ ExtraMetadata) (
	writerDeviceKeys, readerDeviceKeys UserDevicePublicKeys, err error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "GetUserDevicePublicKeys", md.Version()}
	}

	if len(md.WKeys) == 0 || len(md.RKeys) == 0 {
		return nil, nil, errors.New(
			"GetUserDevicePublicKeys called with no key generations (V2)")
	}

	wUDKIM := md.WKeys[len(md.WKeys)-1]
	rUDKIM := md.RKeys[len(md.RKeys)-1]

	return wUDKIM.WKeys.ToPublicKeys(), rUDKIM.RKeys.ToPublicKeys(), nil
}

// GetTLFCryptKeyParams implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetTLFCryptKeyParams(
	keyGen KeyGen, user keybase1.UID, key kbfscrypto.CryptPublicKey,
	_ ExtraMetadata) (
	kbfscrypto.TLFEphemeralPublicKey, kbfscrypto.EncryptedTLFCryptKeyClientHalf,
	kbfscrypto.TLFCryptKeyServerHalfID, bool, error) {
	wkb, rkb, err := md.getTLFKeyBundles(keyGen)
	if err != nil {
		return kbfscrypto.TLFEphemeralPublicKey{},
			kbfscrypto.EncryptedTLFCryptKeyClientHalf{},
			kbfscrypto.TLFCryptKeyServerHalfID{}, false, err
	}

	dkim := wkb.WKeys[user]
	if dkim == nil {
		dkim = rkb.RKeys[user]
		if dkim == nil {
			return kbfscrypto.TLFEphemeralPublicKey{},
				kbfscrypto.EncryptedTLFCryptKeyClientHalf{},
				kbfscrypto.TLFCryptKeyServerHalfID{}, false, nil
		}
	}
	info, ok := dkim[key.KID()]
	if !ok {
		return kbfscrypto.TLFEphemeralPublicKey{},
			kbfscrypto.EncryptedTLFCryptKeyClientHalf{},
			kbfscrypto.TLFCryptKeyServerHalfID{}, false, nil
	}

	_, _, ePubKey, err := GetEphemeralPublicKeyInfoV2(info, *wkb, *rkb)
	if err != nil {
		return kbfscrypto.TLFEphemeralPublicKey{},
			kbfscrypto.EncryptedTLFCryptKeyClientHalf{},
			kbfscrypto.TLFCryptKeyServerHalfID{}, false, err
	}

	return ePubKey, info.ClientHalf, info.ServerHalfID, true, nil
}

// IsValidAndSigned implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsValidAndSigned(
	_ context.Context, codec kbfscodec.Codec,
	_ TeamMembershipChecker, extra ExtraMetadata,
	_ kbfscrypto.VerifyingKey, _ keybase1.OfflineAvailability) error {
	// Optimization -- if the WriterMetadata signature is nil, it
	// will fail verification.
	if md.WriterMetadataSigInfo.IsNil() {
		return errors.New("Missing WriterMetadata signature")
	}

	if md.IsFinal() {
		if md.Revision < RevisionInitial+1 {
			return fmt.Errorf("Invalid final revision %d", md.Revision)
		}

		if md.Revision == (RevisionInitial + 1) {
			if md.PrevRoot != (ID{}) {
				return fmt.Errorf("Invalid PrevRoot %s for initial final revision", md.PrevRoot)
			}
		} else {
			if md.PrevRoot == (ID{}) {
				return errors.New("No PrevRoot for non-initial final revision")
			}
		}
	} else {
		if md.Revision < RevisionInitial {
			return fmt.Errorf("Invalid revision %d", md.Revision)
		}

		if md.Revision == RevisionInitial {
			if md.PrevRoot != (ID{}) {
				return fmt.Errorf("Invalid PrevRoot %s for initial revision", md.PrevRoot)
			}
		} else {
			if md.PrevRoot == (ID{}) {
				return errors.New("No PrevRoot for non-initial revision")
			}
		}
	}

	if len(md.SerializedPrivateMetadata) == 0 {
		return errors.New("No private metadata")
	}

	if (md.MergedStatus() == Merged) != (md.BID() == NullBranchID) {
		return fmt.Errorf("Branch ID %s doesn't match merged status %s",
			md.BID(), md.MergedStatus())
	}

	handle, err := md.MakeBareTlfHandle(extra)
	if err != nil {
		return err
	}

	// Make sure the last writer is valid.  TODO(KBFS-2185): for a
	// team TLF, check that the writer is part of the team.
	writer := md.LastModifyingWriter()
	if !handle.IsWriter(writer.AsUserOrTeam()) {
		return fmt.Errorf("Invalid modifying writer %s", writer)
	}

	// Make sure the last modifier is valid.
	user := md.LastModifyingUser
	if !handle.IsReader(user.AsUserOrTeam()) {
		return fmt.Errorf("Invalid modifying user %s", user)
	}

	// Verify signature. We have to re-marshal the WriterMetadata,
	// since it's embedded.
	buf, err := codec.Encode(md.WriterMetadataV2)
	if err != nil {
		return err
	}

	err = kbfscrypto.Verify(buf, md.WriterMetadataSigInfo)
	if err != nil {
		return fmt.Errorf("Could not verify writer metadata: %v", err)
	}

	return nil
}

// IsLastModifiedBy implements the RootMetadata interface for
// RootMetadataV2.
func (md *RootMetadataV2) IsLastModifiedBy(
	uid keybase1.UID, key kbfscrypto.VerifyingKey) error {
	// Verify the user and device are the writer.
	writer := md.LastModifyingWriter()
	if !md.IsWriterMetadataCopiedSet() {
		if writer != uid {
			return fmt.Errorf("Last writer %s != %s", writer, uid)
		}
		if md.WriterMetadataSigInfo.VerifyingKey != key {
			return fmt.Errorf(
				"Last writer verifying key %v != %v",
				md.WriterMetadataSigInfo.VerifyingKey, key)
		}
	}

	// Verify the user and device are the last modifier.
	user := md.GetLastModifyingUser()
	if user != uid {
		return fmt.Errorf("Last modifier %s != %s", user, uid)
	}

	return nil
}

// LastModifyingWriter implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) LastModifyingWriter() keybase1.UID {
	return md.WriterMetadataV2.LastModifyingWriter
}

// GetLastModifyingUser implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetLastModifyingUser() keybase1.UID {
	return md.LastModifyingUser
}

// RefBytes implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) RefBytes() uint64 {
	return md.WriterMetadataV2.RefBytes
}

// UnrefBytes implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) UnrefBytes() uint64 {
	return md.WriterMetadataV2.UnrefBytes
}

// MDRefBytes implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) MDRefBytes() uint64 {
	return md.WriterMetadataV2.MDRefBytes
}

// DiskUsage implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) DiskUsage() uint64 {
	return md.WriterMetadataV2.DiskUsage
}

// MDDiskUsage implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) MDDiskUsage() uint64 {
	return md.WriterMetadataV2.MDDiskUsage
}

// SetRefBytes implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetRefBytes(refBytes uint64) {
	md.WriterMetadataV2.RefBytes = refBytes
}

// SetUnrefBytes implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetUnrefBytes(unrefBytes uint64) {
	md.WriterMetadataV2.UnrefBytes = unrefBytes
}

// SetMDRefBytes implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetMDRefBytes(mdRefBytes uint64) {
	md.WriterMetadataV2.MDRefBytes = mdRefBytes
}

// SetDiskUsage implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetDiskUsage(diskUsage uint64) {
	md.WriterMetadataV2.DiskUsage = diskUsage
}

// SetMDDiskUsage implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetMDDiskUsage(mdDiskUsage uint64) {
	md.WriterMetadataV2.MDDiskUsage = mdDiskUsage
}

// AddRefBytes implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) AddRefBytes(refBytes uint64) {
	md.WriterMetadataV2.RefBytes += refBytes
}

// AddUnrefBytes implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) AddUnrefBytes(unrefBytes uint64) {
	md.WriterMetadataV2.UnrefBytes += unrefBytes
}

// AddMDRefBytes implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) AddMDRefBytes(mdRefBytes uint64) {
	md.WriterMetadataV2.MDRefBytes += mdRefBytes
}

// AddDiskUsage implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) AddDiskUsage(diskUsage uint64) {
	md.WriterMetadataV2.DiskUsage += diskUsage
}

// AddMDDiskUsage implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) AddMDDiskUsage(mdDiskUsage uint64) {
	md.WriterMetadataV2.MDDiskUsage += mdDiskUsage
}

// RevisionNumber implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) RevisionNumber() Revision {
	return md.Revision
}

// BID implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) BID() BranchID {
	return md.WriterMetadataV2.BID
}

// GetPrevRoot implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetPrevRoot() ID {
	return md.PrevRoot
}

// ClearRekeyBit implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) ClearRekeyBit() {
	md.Flags &= ^MetadataFlagRekey
}

// ClearWriterMetadataCopiedBit implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) ClearWriterMetadataCopiedBit() {
	md.Flags &= ^MetadataFlagWriterMetadataCopied
}

// IsUnmergedSet implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) IsUnmergedSet() bool {
	return (md.WriterMetadataV2.WFlags & MetadataFlagUnmerged) != 0
}

// SetUnmerged implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetUnmerged() {
	md.WriterMetadataV2.WFlags |= MetadataFlagUnmerged
}

// SetBranchID implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetBranchID(bid BranchID) {
	md.WriterMetadataV2.BID = bid
}

// SetPrevRoot implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetPrevRoot(mdID ID) {
	md.PrevRoot = mdID
}

// GetSerializedPrivateMetadata implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetSerializedPrivateMetadata() []byte {
	return md.SerializedPrivateMetadata
}

// SetSerializedPrivateMetadata implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetSerializedPrivateMetadata(spmd []byte) {
	md.SerializedPrivateMetadata = spmd
}

// GetSerializedWriterMetadata implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetSerializedWriterMetadata(
	codec kbfscodec.Codec) ([]byte, error) {
	return codec.Encode(md.WriterMetadataV2)
}

// SignWriterMetadataInternally implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SignWriterMetadataInternally(
	ctx context.Context, codec kbfscodec.Codec,
	signer kbfscrypto.Signer) error {
	buf, err := codec.Encode(md.WriterMetadataV2)
	if err != nil {
		return err
	}

	sigInfo, err := signer.Sign(ctx, buf)
	if err != nil {
		return err
	}
	md.WriterMetadataSigInfo = sigInfo
	return nil
}

// SetLastModifyingWriter implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetLastModifyingWriter(user keybase1.UID) {
	md.WriterMetadataV2.LastModifyingWriter = user
}

// SetLastModifyingUser implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetLastModifyingUser(user keybase1.UID) {
	md.LastModifyingUser = user
}

// SetRekeyBit implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetRekeyBit() {
	md.Flags |= MetadataFlagRekey
}

// SetFinalBit implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetFinalBit() {
	md.Flags |= MetadataFlagFinal
}

// SetWriterMetadataCopiedBit implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetWriterMetadataCopiedBit() {
	md.Flags |= MetadataFlagWriterMetadataCopied
}

// SetRevision implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetRevision(revision Revision) {
	md.Revision = revision
}

// SetUnresolvedReaders implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetUnresolvedReaders(readers []keybase1.SocialAssertion) {
	md.UnresolvedReaders = readers
}

// SetUnresolvedWriters implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetUnresolvedWriters(writers []keybase1.SocialAssertion) {
	md.Extra.UnresolvedWriters = writers
}

// SetConflictInfo implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetConflictInfo(ci *tlf.HandleExtension) {
	md.ConflictInfo = ci
}

// SetFinalizedInfo implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetFinalizedInfo(fi *tlf.HandleExtension) {
	md.FinalizedInfo = fi
}

// SetWriters implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetWriters(writers []keybase1.UserOrTeamID) {
	md.Writers = writers
}

// ClearForV4Migration implements the MutableRootMetadata interface
// for RootMetadataV2.
func (md *RootMetadataV2) ClearForV4Migration() {
	md.WKeys = nil
	md.RKeys = nil
	md.Extra.UnresolvedWriters = nil
	md.UnresolvedReaders = nil
}

// SetTlfID implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetTlfID(tlf tlf.ID) {
	md.ID = tlf
}

// ClearFinalBit implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) ClearFinalBit() {
	md.Flags &= ^MetadataFlagFinal
}

// Version implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) Version() MetadataVer {
	// Only folders with unresolved assertions or conflict info get the
	// new version.
	if len(md.Extra.UnresolvedWriters) > 0 || len(md.UnresolvedReaders) > 0 ||
		md.ConflictInfo != nil ||
		md.FinalizedInfo != nil {
		return InitialExtraMetadataVer
	}
	// Let other types of MD objects use the older version since they
	// are still compatible with older clients.
	return PreExtraMetadataVer
}

// GetCurrentTLFPublicKey implements the RootMetadata interface
// for RootMetadataV2.
func (md *RootMetadataV2) GetCurrentTLFPublicKey(
	_ ExtraMetadata) (kbfscrypto.TLFPublicKey, error) {
	if len(md.WKeys) == 0 {
		return kbfscrypto.TLFPublicKey{}, errors.New(
			"No key generations in GetCurrentTLFPublicKey")
	}
	return md.WKeys[len(md.WKeys)-1].TLFPublicKey, nil
}

// GetUnresolvedParticipants implements the RootMetadata interface
// for RootMetadataV2.
func (md *RootMetadataV2) GetUnresolvedParticipants() []keybase1.SocialAssertion {
	writers := md.WriterMetadataV2.Extra.UnresolvedWriters
	readers := md.UnresolvedReaders
	users := make([]keybase1.SocialAssertion, 0, len(writers)+len(readers))
	users = append(users, writers...)
	users = append(users, readers...)
	return users
}

func (md *RootMetadataV2) updateKeyGenerationForReaderRekey(
	codec kbfscodec.Codec, keyGen KeyGen,
	updatedReaderKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (UserDeviceKeyServerHalves, error) {
	if len(updatedReaderKeys) != 1 {
		return nil, fmt.Errorf("Expected updatedReaderKeys to have only one entry, got %d",
			len(updatedReaderKeys))
	}

	_, rkb, err := md.getTLFKeyBundles(keyGen)
	if err != nil {
		return nil, err
	}

	// This is VERY ugly, but we need it in order to avoid
	// having to version the metadata. The index will be
	// strictly negative for reader ephemeral public keys.
	newIndex := -len(rkb.TLFReaderEphemeralPublicKeys) - 1

	rServerHalves, err := rkb.RKeys.FillInUserInfos(
		newIndex, updatedReaderKeys, ePrivKey, tlfCryptKey)
	if err != nil {
		return nil, err
	}

	// If we didn't fill in any new user infos, don't add a new
	// ephemeral key.
	if len(rServerHalves) > 0 {
		rkb.TLFReaderEphemeralPublicKeys = append(
			rkb.TLFReaderEphemeralPublicKeys, ePubKey)
	}

	return rServerHalves, nil
}

func (md *RootMetadataV2) updateKeyGeneration(
	keyGen KeyGen,
	updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (UserDeviceKeyServerHalves, error) {
	if len(updatedWriterKeys) == 0 {
		return nil, errors.New(
			"updatedWriterKeys unexpectedly non-empty")
	}

	wkb, rkb, err := md.getTLFKeyBundles(keyGen)
	if err != nil {
		return nil, err
	}

	newIndex := len(wkb.TLFEphemeralPublicKeys)

	wServerHalves, err := wkb.WKeys.FillInUserInfos(
		newIndex, updatedWriterKeys, ePrivKey, tlfCryptKey)
	if err != nil {
		return nil, err
	}

	rServerHalves, err := rkb.RKeys.FillInUserInfos(
		newIndex, updatedReaderKeys, ePrivKey, tlfCryptKey)
	if err != nil {
		return nil, err
	}

	serverHalves, err := wServerHalves.MergeUsers(rServerHalves)
	if err != nil {
		return nil, err
	}

	// If we didn't fill in any new user infos, don't add a new
	// ephemeral key.
	if len(serverHalves) > 0 {
		wkb.TLFEphemeralPublicKeys =
			append(wkb.TLFEphemeralPublicKeys, ePubKey)
	}

	return serverHalves, nil
}

// AddKeyGeneration implements the MutableRootMetadata interface
// for RootMetadataV2.
func (md *RootMetadataV2) AddKeyGeneration(
	codec kbfscodec.Codec, extra ExtraMetadata,
	updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	pubKey kbfscrypto.TLFPublicKey,
	currCryptKey, nextCryptKey kbfscrypto.TLFCryptKey) (
	nextExtra ExtraMetadata,
	serverHalves UserDeviceKeyServerHalves, err error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "AddKeyGeneration", md.Version()}
	}

	if len(updatedWriterKeys) == 0 {
		return nil, nil, errors.New(
			"updatedWriterKeys unexpectedly non-empty")
	}

	if currCryptKey != (kbfscrypto.TLFCryptKey{}) {
		return nil, nil, errors.New("currCryptKey unexpectedly non-zero")
	}

	if len(md.WKeys) != len(md.RKeys) {
		return nil, nil, fmt.Errorf(
			"Have %d writer key gens, but %d reader key gens",
			len(md.WKeys), len(md.RKeys))
	}

	if len(md.WKeys) > 0 {
		existingWriterKeys :=
			md.WKeys[len(md.WKeys)-1].WKeys.ToPublicKeys()
		if !existingWriterKeys.Equals(updatedWriterKeys) {
			return nil, nil, fmt.Errorf(
				"existingWriterKeys=%+v != updatedWriterKeys=%+v",
				existingWriterKeys, updatedWriterKeys)
		}

		existingReaderKeys :=
			md.RKeys[len(md.RKeys)-1].RKeys.ToPublicKeys()
		if !existingReaderKeys.Equals(updatedReaderKeys) {
			return nil, nil, fmt.Errorf(
				"existingReaderKeys=%+v != updatedReaderKeys=%+v",
				existingReaderKeys, updatedReaderKeys)
		}
	}

	newWriterKeys := TLFWriterKeyBundleV2{
		WKeys:        make(UserDeviceKeyInfoMapV2),
		TLFPublicKey: pubKey,
	}
	md.WKeys = append(md.WKeys, newWriterKeys)

	newReaderKeys := TLFReaderKeyBundleV2{
		RKeys: make(UserDeviceKeyInfoMapV2),
	}
	md.RKeys = append(md.RKeys, newReaderKeys)

	serverHalves, err = md.updateKeyGeneration(
		md.LatestKeyGeneration(), updatedWriterKeys,
		updatedReaderKeys, ePubKey, ePrivKey, nextCryptKey)
	if err != nil {
		return nil, nil, err
	}

	return nil, serverHalves, nil
}

// SetLatestKeyGenerationForTeamTLF implements the
// MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) SetLatestKeyGenerationForTeamTLF(keyGen KeyGen) {
	panic("RootMetadataV2 doesn't support team TLFs")
}

// UpdateKeyBundles implements the MutableRootMetadata interface
// for RootMetadataV2.
func (md *RootMetadataV2) UpdateKeyBundles(codec kbfscodec.Codec,
	_ ExtraMetadata,
	updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKeys []kbfscrypto.TLFCryptKey) (
	[]UserDeviceKeyServerHalves, error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "UpdateKeyBundles", md.Version()}
	}

	expectedTLFCryptKeyCount := int(
		md.LatestKeyGeneration() - FirstValidKeyGen + 1)
	if len(tlfCryptKeys) != expectedTLFCryptKeyCount {
		return nil, fmt.Errorf(
			"(MDv2) Expected %d TLF crypt keys, got %d",
			expectedTLFCryptKeyCount, len(tlfCryptKeys))
	}

	serverHalves := make([]UserDeviceKeyServerHalves, len(tlfCryptKeys))
	if len(updatedWriterKeys) == 0 {
		// Reader rekey case.

		for keyGen := FirstValidKeyGen; keyGen <= md.LatestKeyGeneration(); keyGen++ {
			serverHalvesGen, err :=
				md.updateKeyGenerationForReaderRekey(codec,
					keyGen, updatedReaderKeys,
					ePubKey, ePrivKey,
					tlfCryptKeys[keyGen-FirstValidKeyGen])
			if err != nil {
				return nil, err
			}

			serverHalves[keyGen-FirstValidKeyGen] = serverHalvesGen
		}

		return serverHalves, nil
	}

	// Usual rekey case.

	for keyGen := FirstValidKeyGen; keyGen <= md.LatestKeyGeneration(); keyGen++ {
		serverHalvesGen, err := md.updateKeyGeneration(
			keyGen, updatedWriterKeys, updatedReaderKeys,
			ePubKey, ePrivKey,
			tlfCryptKeys[keyGen-FirstValidKeyGen])
		if err != nil {
			return nil, err
		}

		serverHalves[keyGen-FirstValidKeyGen] = serverHalvesGen
	}
	return serverHalves, nil

}

// GetTLFWriterKeyBundleID implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetTLFWriterKeyBundleID() TLFWriterKeyBundleID {
	// Since key bundles are stored internally, just return the zero value.
	return TLFWriterKeyBundleID{}
}

// GetTLFReaderKeyBundleID implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetTLFReaderKeyBundleID() TLFReaderKeyBundleID {
	// Since key bundles are stored internally, just return the zero value.
	return TLFReaderKeyBundleID{}
}

// FinalizeRekey implements the MutableRootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) FinalizeRekey(
	_ kbfscodec.Codec, _ ExtraMetadata) error {
	// Nothing to do.
	return nil
}

// StoresHistoricTLFCryptKeys implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) StoresHistoricTLFCryptKeys() bool {
	// MDv2 metadata contains only per device encrypted keys.
	return false
}

// GetHistoricTLFCryptKey implements the RootMetadata interface for RootMetadataV2.
func (md *RootMetadataV2) GetHistoricTLFCryptKey(
	_ kbfscodec.Codec, _ KeyGen, _ kbfscrypto.TLFCryptKey, _ ExtraMetadata) (
	kbfscrypto.TLFCryptKey, error) {
	return kbfscrypto.TLFCryptKey{}, errors.New(
		"TLF crypt key not symmetrically encrypted")
}
