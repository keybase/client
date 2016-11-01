// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"golang.org/x/net/context"
)

// WriterMetadataV3 stores the metadata for a TLF that is
// only editable by users with writer permissions.
type WriterMetadataV3 struct {
	// Serialized, possibly encrypted, version of the PrivateMetadata
	SerializedPrivateMetadata []byte `codec:"data"`

	// The last KB user with writer permissions to this TLF
	// who modified this WriterMetadata
	LastModifyingWriter keybase1.UID `codec:"lmw"`

	// For public TLFs (since those don't have any keys at all).
	Writers []keybase1.UID `codec:",omitempty"`
	// Writers identified by unresolved social assertions.
	UnresolvedWriters []keybase1.SocialAssertion `codec:"uw,omitempty"`
	// Pointer to the writer key bundle for private TLFs.
	WKeyBundleID TLFWriterKeyBundleID `codec:"wkid,omitempty"`
	// Latest key generation.
	LatestKeyGen KeyGen `codec:"lkg"`

	// The directory ID, signed over to make verification easier
	ID TlfID
	// The branch ID, currently only set if this is in unmerged per-device history.
	BID BranchID
	// Flags
	WFlags WriterFlags

	// Estimated disk usage at this revision
	DiskUsage uint64
	// The total number of bytes in new blocks
	RefBytes uint64
	// The total number of bytes in unreferenced blocks
	UnrefBytes uint64

	codec.UnknownFieldSetHandler
}

// BareRootMetadataV3 is the MD that is signed by the reader or
// writer. Unlike RootMetadata, it contains exactly the serializable
// metadata.
type BareRootMetadataV3 struct {
	// The metadata that is only editable by the writer.
	WriterMetadata WriterMetadataV3 `codec:"wmd"`

	// The last KB user who modified this BareRootMetadata
	LastModifyingUser keybase1.UID
	// Flags
	Flags MetadataFlags
	// The revision number
	Revision MetadataRevision
	// Pointer to the previous root block ID
	PrevRoot MdID

	// For private TLFs. Any unresolved social assertions for readers.
	UnresolvedReaders []keybase1.SocialAssertion `codec:"ur,omitempty"`
	// Pointer to the reader key bundle for private TLFs.
	RKeyBundleID TLFReaderKeyBundleID `codec:"rkid,omitempty"`

	// ConflictInfo is set if there's a conflict for the given folder's
	// handle after a social assertion resolution.
	ConflictInfo *TlfHandleExtension `codec:"ci,omitempty"`
	// FinalizedInfo is set if there are no more valid writer keys capable
	// of writing to the given folder.
	FinalizedInfo *TlfHandleExtension `codec:"fi,omitempty"`

	codec.UnknownFieldSetHandler
}

// ExtraMetadataV3 contains references to key bundles stored outside of metadata
// blocks.  This only ever exists in memory and is never serialized itself.
type ExtraMetadataV3 struct {
	wkb *TLFWriterKeyBundleV3
	rkb *TLFReaderKeyBundleV3
}

// NewExtraMetadataV3 creates a new ExtraMetadataV3 given a pair of key bundles
func NewExtraMetadataV3(wkb *TLFWriterKeyBundleV3, rkb *TLFReaderKeyBundleV3) (
	*ExtraMetadataV3, error) {
	if wkb == nil || rkb == nil {
		return nil, errors.New("Nil key bundle passed")
	}
	return &ExtraMetadataV3{wkb: wkb, rkb: rkb}, nil
}

// MetadataVersion implements the ExtraMetadata interface for ExtraMetadataV3.
func (extra ExtraMetadataV3) MetadataVersion() MetadataVer {
	return SegregatedKeyBundlesVer
}

// DeepCopy implements the ExtraMetadata interface for ExtraMetadataV3.
func (extra ExtraMetadataV3) DeepCopy(codec kbfscodec.Codec) (
	ExtraMetadata, error) {
	wkb, rkb := TLFWriterKeyBundleV3{}, TLFReaderKeyBundleV3{}
	if extra.rkb == nil || extra.wkb == nil {
		return nil, errors.New("Missing key bundles")
	}
	if err := kbfscodec.Update(codec, &rkb, *extra.rkb); err != nil {
		return nil, err
	}
	if err := kbfscodec.Update(codec, &wkb, *extra.wkb); err != nil {
		return nil, err
	}
	return &ExtraMetadataV3{wkb: &wkb, rkb: &rkb}, nil
}

// GetWriterKeyBundle returns the contained writer key bundle.
func (extra ExtraMetadataV3) GetWriterKeyBundle() *TLFWriterKeyBundleV3 {
	return extra.wkb
}

// GetReaderKeyBundle returns the contained reader key bundle.
func (extra ExtraMetadataV3) GetReaderKeyBundle() *TLFReaderKeyBundleV3 {
	return extra.rkb
}

// Copy implements the ExtraMetadata interface for ExtraMetadataV3.
func (extra ExtraMetadataV3) Copy(includeWkb, includeRkb bool) ExtraMetadata {
	extraCopy := &ExtraMetadataV3{}
	if includeWkb {
		extraCopy.wkb = extra.wkb
	}
	if includeRkb {
		extraCopy.rkb = extra.rkb
	}
	return extraCopy
}

// Helper function to extract key bundles for the ExtraMetadata interface.
func getKeyBundlesV3(extra ExtraMetadata) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, bool) {
	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return nil, nil, false
	}
	if extraV3.wkb == nil || extraV3.rkb == nil {
		return nil, nil, false
	}
	return extraV3.wkb, extraV3.rkb, true
}

// Helper function to extract key bundles for the ExtraMetadata interface.
func getAnyKeyBundlesV3(extra ExtraMetadata) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3) {
	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return nil, nil
	}
	return extraV3.wkb, extraV3.rkb
}

// MakeInitialBareRootMetadataV3 creates a new BareRootMetadataV3
// object with revision MetadataRevisionInitial, and the given TlfID
// and BareTlfHandle. Note that if the given ID/handle are private,
// rekeying must be done separately.
func MakeInitialBareRootMetadataV3(tlfID TlfID, h BareTlfHandle) (
	*BareRootMetadataV3, error) {
	if tlfID.IsPublic() != h.IsPublic() {
		return nil, errors.New(
			"TlfID and TlfHandle disagree on public status")
	}

	var writers []keybase1.UID
	if tlfID.IsPublic() {
		writers = make([]keybase1.UID, len(h.Writers))
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

	return &BareRootMetadataV3{
		WriterMetadata: WriterMetadataV3{
			Writers:           writers,
			ID:                tlfID,
			UnresolvedWriters: unresolvedWriters,
		},
		Revision:          MetadataRevisionInitial,
		UnresolvedReaders: unresolvedReaders,
	}, nil
}

// TlfID implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) TlfID() TlfID {
	return md.WriterMetadata.ID
}

// LatestKeyGeneration implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) LatestKeyGeneration() KeyGen {
	if md.TlfID().IsPublic() {
		return PublicKeyGen
	}
	return md.WriterMetadata.LatestKeyGen
}

func (md *BareRootMetadataV3) haveOnlyUserRKeysChanged(
	codec kbfscodec.Codec, prevMD *BareRootMetadataV3,
	user keybase1.UID, prevRkb, rkb TLFReaderKeyBundleV3) (bool, error) {
	if len(rkb.RKeys) != len(prevRkb.RKeys) {
		return false, nil
	}
	for u, keys := range rkb.RKeys {
		if u != user {
			prevKeys := prevRkb.RKeys[u]
			keysEqual, err := kbfscodec.Equal(codec, keys, prevKeys)
			if err != nil {
				return false, err
			}
			if !keysEqual {
				return false, nil
			}
		}
	}
	return true, nil
}

// IsValidRekeyRequest implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsValidRekeyRequest(
	codec kbfscodec.Codec, prevBareMd BareRootMetadata,
	user keybase1.UID, prevExtra, extra ExtraMetadata) (
	bool, error) {
	if !md.IsWriterMetadataCopiedSet() {
		// Not a copy.
		return false, nil
	}
	prevMd, ok := prevBareMd.(*BareRootMetadataV3)
	if !ok {
		// Not the same type so not a copy.
		return false, nil
	}
	prevExtraV3, ok := prevExtra.(*ExtraMetadataV3)
	if !ok {
		return false, errors.New("Invalid previous extra metadata")
	}
	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return false, errors.New("Invalid extra metadata")
	}
	writerEqual, err := kbfscodec.Equal(
		codec, md.WriterMetadata, prevMd.WriterMetadata)
	if err != nil {
		return false, err
	}
	if !writerEqual {
		// Copy mismatch.
		return false, nil
	}
	onlyUserRKeysChanged, err := md.haveOnlyUserRKeysChanged(
		codec, prevMd, user, *prevExtraV3.rkb, *extraV3.rkb)
	if err != nil {
		return false, err
	}
	if !onlyUserRKeysChanged {
		// Keys outside of this user's reader key set have changed.
		return false, nil
	}
	return true, nil
}

// MergedStatus implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) MergedStatus() MergeStatus {
	if md.WriterMetadata.WFlags&MetadataFlagUnmerged != 0 {
		return Unmerged
	}
	return Merged
}

// IsRekeySet implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsRekeySet() bool {
	return md.Flags&MetadataFlagRekey != 0
}

// IsWriterMetadataCopiedSet implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsWriterMetadataCopiedSet() bool {
	return md.Flags&MetadataFlagWriterMetadataCopied != 0
}

// IsFinal implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsFinal() bool {
	return md.Flags&MetadataFlagFinal != 0
}

// IsWriter implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsWriter(
	user keybase1.UID, deviceKID keybase1.KID, extra ExtraMetadata) bool {
	if md.TlfID().IsPublic() {
		for _, w := range md.WriterMetadata.Writers {
			if w == user {
				return true
			}
		}
		return false
	}
	wkb, _, ok := getKeyBundlesV3(extra)
	if !ok {
		return false
	}
	return wkb.IsWriter(user, deviceKID)
}

// IsReader implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsReader(
	user keybase1.UID, deviceKID keybase1.KID, extra ExtraMetadata) bool {
	if md.TlfID().IsPublic() {
		return true
	}
	_, rkb, ok := getKeyBundlesV3(extra)
	if !ok {
		return false
	}
	return rkb.IsReader(user, deviceKID)
}

// DeepCopy implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) DeepCopy(
	codec kbfscodec.Codec) (MutableBareRootMetadata, error) {
	var newMd BareRootMetadataV3
	if err := kbfscodec.Update(codec, &newMd, md); err != nil {
		return nil, err
	}
	return &newMd, nil
}

// MakeSuccessorCopy implements the ImmutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) MakeSuccessorCopy(
	codec kbfscodec.Codec, isReadableAndWriter bool) (
	MutableBareRootMetadata, error) {
	// TODO: If there is ever a BareRootMetadataV4 this will need to perform the conversion.
	return md.DeepCopy(codec)
}

// CheckValidSuccessor implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) CheckValidSuccessor(
	currID MdID, nextMd BareRootMetadata) error {
	// (1) Verify current metadata is non-final.
	if md.IsFinal() {
		return MetadataIsFinalError{}
	}

	// (2) Check TLF ID.
	if nextMd.TlfID() != md.TlfID() {
		return MDTlfIDMismatch{
			currID: md.TlfID(),
			nextID: nextMd.TlfID(),
		}
	}

	// (3) Check revision.
	if nextMd.RevisionNumber() != md.RevisionNumber()+1 {
		return MDRevisionMismatch{
			rev:  nextMd.RevisionNumber(),
			curr: md.RevisionNumber(),
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
		return errors.New("Merged MD can't follow unmerged MD.")
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

	// TODO: Check that the successor (bare) TLF handle is the
	// same or more resolved.

	return nil
}

// CheckValidSuccessorForServer implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) CheckValidSuccessorForServer(
	currID MdID, nextMd BareRootMetadata) error {
	err := md.CheckValidSuccessor(currID, nextMd)
	switch err := err.(type) {
	case nil:
		break

	case MDRevisionMismatch:
		return MDServerErrorConflictRevision{
			Expected: err.curr + 1,
			Actual:   err.rev,
		}

	case MDPrevRootMismatch:
		return MDServerErrorConflictPrevRoot{
			Expected: err.expectedPrevRoot,
			Actual:   err.prevRoot,
		}

	case MDDiskUsageMismatch:
		return MDServerErrorConflictDiskUsage{
			Expected: err.expectedDiskUsage,
			Actual:   err.actualDiskUsage,
		}

	default:
		return MDServerError{Err: err}
	}

	return nil
}

// MakeBareTlfHandle implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) MakeBareTlfHandle(extra ExtraMetadata) (
	BareTlfHandle, error) {
	var writers, readers []keybase1.UID
	if md.TlfID().IsPublic() {
		writers = md.WriterMetadata.Writers
		readers = []keybase1.UID{keybase1.PublicUID}
	} else {
		wkb, rkb, ok := getKeyBundlesV3(extra)
		if !ok {
			return BareTlfHandle{}, errors.New("Missing key bundles")
		}
		writers = make([]keybase1.UID, 0, len(wkb.Keys))
		readers = make([]keybase1.UID, 0, len(rkb.RKeys))
		for w := range wkb.Keys {
			writers = append(writers, w)
		}
		for r := range rkb.RKeys {
			// TODO: Return an error instead if r is
			// PublicUID. Maybe return an error if r is in
			// WKeys also. Or do all this in
			// MakeBareTlfHandle.
			if _, ok := wkb.Keys[r]; !ok &&
				r != keybase1.PublicUID {
				readers = append(readers, r)
			}
		}
	}

	return MakeBareTlfHandle(
		writers, readers,
		md.WriterMetadata.UnresolvedWriters, md.UnresolvedReaders,
		md.TlfHandleExtensions())
}

// TlfHandleExtensions implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) TlfHandleExtensions() (
	extensions []TlfHandleExtension) {
	if md.ConflictInfo != nil {
		extensions = append(extensions, *md.ConflictInfo)
	}
	if md.FinalizedInfo != nil {
		extensions = append(extensions, *md.FinalizedInfo)
	}
	return extensions
}

// GetTLFKeyBundles implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetTLFKeyBundles(_ KeyGen) (
	*TLFWriterKeyBundleV2, *TLFReaderKeyBundleV2, error) {
	if md.TlfID().IsPublic() {
		return nil, nil, InvalidPublicTLFOperation{md.TlfID(), "GetTLFKeyBundles"}
	}
	// v3 metadata contains no key bundles.
	return nil, nil, errors.New("Not implemented")
}

// GetDeviceKIDs implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetDeviceKIDs(
	keyGen KeyGen, user keybase1.UID, extra ExtraMetadata) ([]keybase1.KID, error) {
	wkb, rkb, ok := getKeyBundlesV3(extra)
	if !ok {
		return nil, errors.New("Missing key bundles")
	}
	dkim := wkb.Keys[user]
	if len(dkim) == 0 {
		dkim = rkb.RKeys[user]
		if len(dkim) == 0 {
			return nil, nil
		}
	}

	kids := make([]keybase1.KID, 0, len(dkim))
	for kid := range dkim {
		kids = append(kids, kid)
	}

	return kids, nil
}

// HasKeyForUser implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) HasKeyForUser(
	keyGen KeyGen, user keybase1.UID, extra ExtraMetadata) bool {
	wkb, rkb, ok := getKeyBundlesV3(extra)
	if !ok {
		return false
	}
	return (len(wkb.Keys[user]) > 0) || (len(rkb.RKeys[user]) > 0)
}

// GetTLFCryptKeyParams implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetTLFCryptKeyParams(
	keyGen KeyGen, user keybase1.UID,
	key kbfscrypto.CryptPublicKey, extra ExtraMetadata) (
	kbfscrypto.TLFEphemeralPublicKey, EncryptedTLFCryptKeyClientHalf,
	TLFCryptKeyServerHalfID, bool, error) {
	if keyGen != md.LatestKeyGeneration() {
		return kbfscrypto.TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false,
			TLFCryptKeyNotPerDeviceEncrypted{md.TlfID(), keyGen}
	}
	wkb, rkb, ok := getKeyBundlesV3(extra)
	if !ok {
		return kbfscrypto.TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false,
			errors.New("Missing key bundles")
	}
	isWriter := true
	dkim := wkb.Keys[user]
	if dkim == nil {
		dkim = rkb.RKeys[user]
		if dkim == nil {
			return kbfscrypto.TLFEphemeralPublicKey{},
				EncryptedTLFCryptKeyClientHalf{},
				TLFCryptKeyServerHalfID{}, false, nil
		}
		isWriter = false
	}
	info, ok := dkim[key.KID()]
	if !ok {
		return kbfscrypto.TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false, nil
	}

	var publicKeys kbfscrypto.TLFEphemeralPublicKeys
	var keyType string
	if isWriter {
		publicKeys = wkb.TLFEphemeralPublicKeys
		keyType = "writer"
	} else {
		publicKeys = rkb.TLFReaderEphemeralPublicKeys
		keyType = "reader"
	}
	keyCount := len(publicKeys)
	index := info.EPubKeyIndex
	if index >= keyCount {
		return kbfscrypto.TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false,
			fmt.Errorf("Invalid %s key index %d >= %d",
				keyType, index, keyCount)
	}
	return publicKeys[index], info.ClientHalf, info.ServerHalfID, true, nil
}

// IsValidAndSigned implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsValidAndSigned(
	codec kbfscodec.Codec, crypto cryptoPure, extra ExtraMetadata) error {
	if !md.TlfID().IsPublic() {
		_, _, ok := getKeyBundlesV3(extra)
		if !ok {
			return errors.New("Missing key bundles")
		}
	}

	if md.IsFinal() {
		if md.Revision < MetadataRevisionInitial+1 {
			return fmt.Errorf("Invalid final revision %d", md.Revision)
		}

		if md.Revision == (MetadataRevisionInitial + 1) {
			if md.PrevRoot != (MdID{}) {
				return fmt.Errorf("Invalid PrevRoot %s for initial final revision", md.PrevRoot)
			}
		} else {
			if md.PrevRoot == (MdID{}) {
				return errors.New("No PrevRoot for non-initial final revision")
			}
		}
	} else {
		if md.Revision < MetadataRevisionInitial {
			return fmt.Errorf("Invalid revision %d", md.Revision)
		}

		if md.Revision == MetadataRevisionInitial {
			if md.PrevRoot != (MdID{}) {
				return fmt.Errorf("Invalid PrevRoot %s for initial revision", md.PrevRoot)
			}
		} else {
			if md.PrevRoot == (MdID{}) {
				return errors.New("No PrevRoot for non-initial revision")
			}
		}
	}

	if len(md.WriterMetadata.SerializedPrivateMetadata) == 0 {
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

	// Make sure the last writer is valid.
	writer := md.LastModifyingWriter()
	if !handle.IsWriter(writer) {
		return fmt.Errorf("Invalid modifying writer %s", writer)
	}

	// Make sure the last modifier is valid.
	user := md.LastModifyingUser
	if !handle.IsReader(user) {
		return fmt.Errorf("Invalid modifying user %s", user)
	}

	return nil
}

// IsLastModifiedBy implements the BareRootMetadata interface for
// BareRootMetadataV3.
func (md *BareRootMetadataV3) IsLastModifiedBy(
	uid keybase1.UID, key kbfscrypto.VerifyingKey) error {
	// Verify the user and device are the writer.
	writer := md.LastModifyingWriter()
	if !md.IsWriterMetadataCopiedSet() {
		if writer != uid {
			return fmt.Errorf("Last writer %s != %s", writer, uid)
		}
	}

	// Verify the user and device are the last modifier.
	user := md.GetLastModifyingUser()
	if user != uid {
		return fmt.Errorf("Last modifier %s != %s", user, uid)
	}

	return nil
}

// LastModifyingWriter implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) LastModifyingWriter() keybase1.UID {
	return md.WriterMetadata.LastModifyingWriter
}

// GetLastModifyingUser implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetLastModifyingUser() keybase1.UID {
	return md.LastModifyingUser
}

// RefBytes implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) RefBytes() uint64 {
	return md.WriterMetadata.RefBytes
}

// UnrefBytes implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) UnrefBytes() uint64 {
	return md.WriterMetadata.UnrefBytes
}

// DiskUsage implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) DiskUsage() uint64 {
	return md.WriterMetadata.DiskUsage
}

// SetRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetRefBytes(refBytes uint64) {
	md.WriterMetadata.RefBytes = refBytes
}

// SetUnrefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetUnrefBytes(unrefBytes uint64) {
	md.WriterMetadata.UnrefBytes = unrefBytes
}

// SetDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetDiskUsage(diskUsage uint64) {
	md.WriterMetadata.DiskUsage = diskUsage
}

// AddRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddRefBytes(refBytes uint64) {
	md.WriterMetadata.RefBytes += refBytes
}

// AddUnrefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddUnrefBytes(unrefBytes uint64) {
	md.WriterMetadata.UnrefBytes += unrefBytes
}

// AddDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddDiskUsage(diskUsage uint64) {
	md.WriterMetadata.DiskUsage += diskUsage
}

// RevisionNumber implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) RevisionNumber() MetadataRevision {
	return md.Revision
}

// BID implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) BID() BranchID {
	return md.WriterMetadata.BID
}

// GetPrevRoot implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetPrevRoot() MdID {
	return md.PrevRoot
}

// ClearRekeyBit implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) ClearRekeyBit() {
	md.Flags &= ^MetadataFlagRekey
}

// ClearWriterMetadataCopiedBit implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) ClearWriterMetadataCopiedBit() {
	md.Flags &= ^MetadataFlagWriterMetadataCopied
}

// IsUnmergedSet implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsUnmergedSet() bool {
	return (md.WriterMetadata.WFlags & MetadataFlagUnmerged) != 0
}

// SetUnmerged implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetUnmerged() {
	md.WriterMetadata.WFlags |= MetadataFlagUnmerged
}

// SetBranchID implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetBranchID(bid BranchID) {
	md.WriterMetadata.BID = bid
}

// SetPrevRoot implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetPrevRoot(mdID MdID) {
	md.PrevRoot = mdID
}

// GetSerializedPrivateMetadata implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetSerializedPrivateMetadata() []byte {
	return md.WriterMetadata.SerializedPrivateMetadata
}

// SetSerializedPrivateMetadata implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetSerializedPrivateMetadata(spmd []byte) {
	md.WriterMetadata.SerializedPrivateMetadata = spmd
}

// GetSerializedWriterMetadata implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetSerializedWriterMetadata(
	codec kbfscodec.Codec) ([]byte, error) {
	return codec.Encode(md.WriterMetadata)
}

// SignWriterMetadataInternally implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV3) SignWriterMetadataInternally(
	ctx context.Context, codec kbfscodec.Codec,
	signer kbfscrypto.Signer) error {
	// Nothing to do.
	//
	// TODO: Set a flag, and a way to check it so that we can
	// verify that this is called before sending to the server.
	return nil
}

// SetLastModifyingWriter implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetLastModifyingWriter(user keybase1.UID) {
	md.WriterMetadata.LastModifyingWriter = user
}

// SetLastModifyingUser implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetLastModifyingUser(user keybase1.UID) {
	md.LastModifyingUser = user
}

// SetRekeyBit implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetRekeyBit() {
	md.Flags |= MetadataFlagRekey
}

// SetFinalBit implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetFinalBit() {
	md.Flags |= MetadataFlagFinal
}

// SetWriterMetadataCopiedBit implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetWriterMetadataCopiedBit() {
	md.Flags |= MetadataFlagWriterMetadataCopied
}

// SetRevision implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetRevision(revision MetadataRevision) {
	md.Revision = revision
}

// AddNewKeysForTesting implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddNewKeysForTesting(crypto cryptoPure,
	wDkim, rDkim UserDeviceKeyInfoMap,
	pubKey kbfscrypto.TLFPublicKey) (extra ExtraMetadata, err error) {
	if md.TlfID().IsPublic() {
		panic("Called AddNewKeysForTesting on public TLF")
	}
	if md.WriterMetadata.LatestKeyGen >= FirstValidKeyGen {
		// TODO: Relax this if needed (but would have to
		// retrieve the previous pubkeys below).
		panic("Cannot add more than one key generation")
	}
	for _, dkim := range wDkim {
		for _, info := range dkim {
			if info.EPubKeyIndex < 0 {
				panic("negative EPubKeyIndex for writer (v3)")
			}
			// TODO: Allow more if needed.
			if info.EPubKeyIndex > 0 {
				panic("EPubKeyIndex for writer > 1 (v3)")
			}
		}
	}
	for _, dkim := range rDkim {
		for _, info := range dkim {
			if info.EPubKeyIndex < 0 {
				panic("negative EPubKeyIndex for reader (v3)")
			}
			// TODO: Allow more if needed.
			if info.EPubKeyIndex > 0 {
				panic("EPubKeyIndex for reader > 1 (v3)")
			}
		}
	}

	wkb := &TLFWriterKeyBundleV3{
		Keys: wDkim,
		// TODO: Retrieve the previous pubkeys and prepend
		// them.
		TLFPublicKeys: []kbfscrypto.TLFPublicKey{pubKey},
		// TODO: Size this to the max EPubKeyIndex for writers.
		TLFEphemeralPublicKeys: make([]kbfscrypto.TLFEphemeralPublicKey, 1),
	}
	rkb := &TLFReaderKeyBundleV3{
		TLFReaderKeyBundleV2: TLFReaderKeyBundleV2{
			RKeys: rDkim,
			// TODO: Size this to the max EPubKeyIndex for readers.
			TLFReaderEphemeralPublicKeys: make([]kbfscrypto.TLFEphemeralPublicKey, 1),
		},
	}
	md.WriterMetadata.LatestKeyGen++
	extra = &ExtraMetadataV3{
		wkb: wkb,
		rkb: rkb,
	}
	err = md.FinalizeRekey(crypto, kbfscrypto.TLFCryptKey{},
		kbfscrypto.TLFCryptKey{}, extra)
	if err != nil {
		return nil, err
	}
	return extra, nil
}

// NewKeyGeneration implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) NewKeyGeneration(pubKey kbfscrypto.TLFPublicKey) (
	extra ExtraMetadata) {
	newWriterKeys := &TLFWriterKeyBundleV3{
		Keys: make(UserDeviceKeyInfoMap),
	}
	newReaderKeys := &TLFReaderKeyBundleV3{
		TLFReaderKeyBundleV2: TLFReaderKeyBundleV2{
			RKeys: make(UserDeviceKeyInfoMap),
		},
	}
	newWriterKeys.TLFPublicKeys = []kbfscrypto.TLFPublicKey{pubKey}
	md.WriterMetadata.LatestKeyGen++
	return &ExtraMetadataV3{
		rkb: newReaderKeys,
		wkb: newWriterKeys,
	}
}

// SetUnresolvedReaders implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetUnresolvedReaders(readers []keybase1.SocialAssertion) {
	md.UnresolvedReaders = readers
}

// SetUnresolvedWriters implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetUnresolvedWriters(writers []keybase1.SocialAssertion) {
	md.WriterMetadata.UnresolvedWriters = writers
}

// SetConflictInfo implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetConflictInfo(ci *TlfHandleExtension) {
	md.ConflictInfo = ci
}

// SetFinalizedInfo implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetFinalizedInfo(fi *TlfHandleExtension) {
	md.FinalizedInfo = fi
}

// SetWriters implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetWriters(writers []keybase1.UID) {
	md.WriterMetadata.Writers = writers
}

// SetTlfID implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetTlfID(tlf TlfID) {
	md.WriterMetadata.ID = tlf
}

// ClearFinalBit implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) ClearFinalBit() {
	md.Flags &= ^MetadataFlagFinal
}

// Version implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) Version() MetadataVer {
	return SegregatedKeyBundlesVer
}

// GetTLFPublicKey implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetTLFPublicKey(
	keyGen KeyGen, extra ExtraMetadata) (kbfscrypto.TLFPublicKey, bool) {
	if keyGen > md.LatestKeyGeneration() {
		return kbfscrypto.TLFPublicKey{}, false
	}
	wkb, _, ok := getKeyBundlesV3(extra)
	if !ok {
		return kbfscrypto.TLFPublicKey{}, false
	}
	return wkb.TLFPublicKeys[keyGen], true
}

// AreKeyGenerationsEqual implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AreKeyGenerationsEqual(
	codec kbfscodec.Codec, other BareRootMetadata) (bool, error) {
	md3, ok := other.(*BareRootMetadataV3)
	if !ok {
		// MDv3 TODO: handle comparisons across versions
		return false, nil
	}
	rekey := md3.RKeyBundleID != md.RKeyBundleID ||
		md3.WriterMetadata.WKeyBundleID != md.WriterMetadata.WKeyBundleID
	return rekey, nil
}

// GetUnresolvedParticipants implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetUnresolvedParticipants() (readers, writers []keybase1.SocialAssertion) {
	return md.UnresolvedReaders, md.WriterMetadata.UnresolvedWriters
}

// GetUserDeviceKeyInfoMaps implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetUserDeviceKeyInfoMaps(keyGen KeyGen, extra ExtraMetadata) (
	readers, writers UserDeviceKeyInfoMap, err error) {
	if md.TlfID().IsPublic() {
		return nil, nil, InvalidPublicTLFOperation{md.TlfID(), "GetTLFKeyBundles"}
	}
	if keyGen != md.LatestKeyGeneration() {
		return nil, nil, TLFCryptKeyNotPerDeviceEncrypted{md.TlfID(), keyGen}
	}
	wkb, rkb, ok := getKeyBundlesV3(extra)
	if !ok {
		return nil, nil, errors.New("Key bundles missing")
	}
	return rkb.RKeys, wkb.Keys, nil
}

// fillInDevices ensures that every device for every writer and reader
// in the provided lists has complete TLF crypt key info, and uses the
// new ephemeral key pair to generate the info if it doesn't yet
// exist.
func (md *BareRootMetadataV3) fillInDevices(crypto Crypto,
	wkb *TLFWriterKeyBundleV3, rkb *TLFReaderKeyBundleV3,
	wKeys map[keybase1.UID][]kbfscrypto.CryptPublicKey,
	rKeys map[keybase1.UID][]kbfscrypto.CryptPublicKey,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (
	serverKeyMap, error) {
	var newReaderIndex, newWriterIndex int
	if len(rKeys) > 0 {
		rkb.TLFReaderEphemeralPublicKeys =
			append(rkb.TLFReaderEphemeralPublicKeys, ePubKey)
		newReaderIndex = len(rkb.TLFReaderEphemeralPublicKeys) - 1
	}
	if len(wKeys) > 0 {
		wkb.TLFEphemeralPublicKeys =
			append(wkb.TLFEphemeralPublicKeys, ePubKey)
		newWriterIndex = len(wkb.TLFEphemeralPublicKeys) - 1
	}

	// now fill in the secret keys as needed
	newServerKeys := serverKeyMap{}
	err := fillInDevicesAndServerMap(crypto, newWriterIndex, wKeys, wkb.Keys,
		ePubKey, ePrivKey, tlfCryptKey, newServerKeys)
	if err != nil {
		return nil, err
	}
	err = fillInDevicesAndServerMap(crypto, newReaderIndex, rKeys, rkb.RKeys,
		ePubKey, ePrivKey, tlfCryptKey, newServerKeys)
	if err != nil {
		return nil, err
	}
	return newServerKeys, nil
}

// GetTLFWriterKeyBundleID implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetTLFWriterKeyBundleID() TLFWriterKeyBundleID {
	return md.WriterMetadata.WKeyBundleID
}

// GetTLFReaderKeyBundleID implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetTLFReaderKeyBundleID() TLFReaderKeyBundleID {
	return md.RKeyBundleID
}

// FinalizeRekey implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) FinalizeRekey(
	crypto cryptoPure, prevKey, currKey kbfscrypto.TLFCryptKey,
	extra ExtraMetadata) error {
	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return errors.New("Invalid extra metadata")
	}
	if md.LatestKeyGeneration() < KeyGen(FirstValidKeyGen) {
		return fmt.Errorf("Invalid key generation %d", md.LatestKeyGeneration())
	}
	if (prevKey != kbfscrypto.TLFCryptKey{}) {
		numKeys := int(md.LatestKeyGeneration() - KeyGen(FirstValidKeyGen))
		if numKeys == 0 {
			return errors.New("Previous key non-nil for first key generation")
		}
		var oldKeys []kbfscrypto.TLFCryptKey
		var err error
		if numKeys > 1 {
			oldKeys, err = crypto.DecryptTLFCryptKeys(
				extraV3.wkb.EncryptedHistoricTLFCryptKeys, prevKey)
			if err != nil {
				return err
			}
		}
		oldKeys = append(oldKeys, prevKey)
		encOldKeys, err := crypto.EncryptTLFCryptKeys(oldKeys, currKey)
		if err != nil {
			return err
		}
		extraV3.wkb.EncryptedHistoricTLFCryptKeys = encOldKeys
	}
	var err error
	md.WriterMetadata.WKeyBundleID, err = crypto.MakeTLFWriterKeyBundleID(extraV3.wkb)
	if err != nil {
		return err
	}
	md.RKeyBundleID, err = crypto.MakeTLFReaderKeyBundleID(extraV3.rkb)
	return err
}

// StoresHistoricTLFCryptKeys implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) StoresHistoricTLFCryptKeys() bool {
	return true
}

// GetHistoricTLFCryptKey implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetHistoricTLFCryptKey(crypto cryptoPure,
	keyGen KeyGen, currentKey kbfscrypto.TLFCryptKey, extra ExtraMetadata) (
	kbfscrypto.TLFCryptKey, error) {
	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return kbfscrypto.TLFCryptKey{}, errors.New(
			"Invalid extra metadata")
	}
	if keyGen < KeyGen(FirstValidKeyGen) || keyGen >= md.LatestKeyGeneration() {
		return kbfscrypto.TLFCryptKey{}, fmt.Errorf(
			"Invalid key generation %d", keyGen)
	}
	oldKeys, err := crypto.DecryptTLFCryptKeys(
		extraV3.wkb.EncryptedHistoricTLFCryptKeys, currentKey)
	if err != nil {
		return kbfscrypto.TLFCryptKey{}, err
	}
	index := int(keyGen - KeyGen(FirstValidKeyGen))
	if index >= len(oldKeys) || index < 0 {
		return kbfscrypto.TLFCryptKey{}, fmt.Errorf(
			"Index %d out of range (max: %d)", index, len(oldKeys))
	}
	return oldKeys[index], nil
}
