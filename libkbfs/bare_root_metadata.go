// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol"
	"github.com/keybase/go-codec/codec"
)

// WriterMetadataV2 stores the metadata for a TLF that is
// only editable by users with writer permissions.
//
// NOTE: Don't add new fields to this type! Instead, add them to
// WriterMetadataExtra. This is because we want old clients to
// preserve unknown fields, and we're unable to do that for
// WriterMetadata directly because it's embedded in BareRootMetadata.
type WriterMetadataV2 struct {
	// Serialized, possibly encrypted, version of the PrivateMetadata
	SerializedPrivateMetadata []byte `codec:"data"`
	// The last KB user with writer permissions to this TLF
	// who modified this WriterMetadata
	LastModifyingWriter keybase1.UID
	// For public TLFs (since those don't have any keys at all).
	Writers []keybase1.UID `codec:",omitempty"`
	// For private TLFs. Writer key generations for this metadata. The
	// most recent one is last in the array. Must be same length as
	// BareRootMetadata.RKeys.
	WKeys TLFWriterKeyGenerations `codec:",omitempty"`
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

	Extra WriterMetadataExtra `codec:"x,omitempty,omitemptycheckstruct"`
}

// WriterMetadataExtra stores more fields for WriterMetadata. (See
// WriterMetadata comments as to why this type is needed.)
type WriterMetadataExtra struct {
	UnresolvedWriters []keybase1.SocialAssertion `codec:"uw,omitempty"`
	codec.UnknownFieldSetHandler
}

// BareRootMetadataV2 is the MD that is signed by the reader or
// writer. Unlike RootMetadata, it contains exactly the serializable
// metadata.
type BareRootMetadataV2 struct {
	// The metadata that is only editable by the writer.
	//
	// TODO: If we ever get a chance to update BareRootMetadata
	// without having to be backwards-compatible, WriterMetadata
	// should be unembedded; see comments to WriterMetadata as for
	// why.
	WriterMetadataV2

	// The signature for the writer metadata, to prove
	// that it's only been changed by writers.
	WriterMetadataSigInfo SignatureInfo

	// The last KB user who modified this BareRootMetadata
	LastModifyingUser keybase1.UID
	// Flags
	Flags MetadataFlags
	// The revision number
	Revision MetadataRevision
	// Pointer to the previous root block ID
	PrevRoot MdID
	// For private TLFs. Reader key generations for this metadata. The
	// most recent one is last in the array. Must be same length as
	// WriterMetadata.WKeys. If there are no readers, each generation
	// is empty.
	RKeys TLFReaderKeyGenerations `codec:",omitempty"`
	// For private TLFs. Any unresolved social assertions for readers.
	UnresolvedReaders []keybase1.SocialAssertion `codec:"ur,omitempty"`

	// ConflictInfo is set if there's a conflict for the given folder's
	// handle after a social assertion resolution.
	ConflictInfo *TlfHandleExtension `codec:"ci,omitempty"`

	// FinalizedInfo is set if there are no more valid writer keys capable
	// of writing to the given folder.
	FinalizedInfo *TlfHandleExtension `codec:"fi,omitempty"`

	codec.UnknownFieldSetHandler
}

// TlfID implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) TlfID() TlfID {
	return md.ID
}

// LatestKeyGeneration implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) LatestKeyGeneration() KeyGen {
	if md.ID.IsPublic() {
		return PublicKeyGen
	}
	return md.WKeys.LatestKeyGeneration()
}

func (md *BareRootMetadataV2) haveOnlyUserRKeysChanged(
	codec Codec, prevMD *BareRootMetadataV2, user keybase1.UID) (bool, error) {
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
				keysEqual, err := CodecEqual(codec, keys, prevKeys)
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

// IsValidRekeyRequest implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsValidRekeyRequest(
	codec Codec, prevBareMd BareRootMetadata, user keybase1.UID) (
	bool, error) {
	if !md.IsWriterMetadataCopiedSet() {
		// Not a copy.
		return false, nil
	}
	prevMd, ok := prevBareMd.(*BareRootMetadataV2)
	if !ok {
		// Not the same type so not a copy.
		return false, nil
	}
	writerEqual, err := CodecEqual(
		codec, md.WriterMetadataV2, prevMd.WriterMetadataV2)
	if err != nil {
		return false, err
	}
	if !writerEqual {
		// Copy mismatch.
		return false, nil
	}
	writerSigInfoEqual, err := CodecEqual(codec,
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

// MergedStatus implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) MergedStatus() MergeStatus {
	if md.WFlags&MetadataFlagUnmerged != 0 {
		return Unmerged
	}
	return Merged
}

// IsRekeySet implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsRekeySet() bool {
	return md.Flags&MetadataFlagRekey != 0
}

// IsWriterMetadataCopiedSet implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsWriterMetadataCopiedSet() bool {
	return md.Flags&MetadataFlagWriterMetadataCopied != 0
}

// IsFinal implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsFinal() bool {
	return md.Flags&MetadataFlagFinal != 0
}

// IsWriter implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsWriter(
	user keybase1.UID, deviceKID keybase1.KID) bool {
	if md.ID.IsPublic() {
		for _, w := range md.Writers {
			if w == user {
				return true
			}
		}
		return false
	}
	return md.WKeys.IsWriter(user, deviceKID)
}

// IsReader implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsReader(
	user keybase1.UID, deviceKID keybase1.KID) bool {
	if md.ID.IsPublic() {
		return true
	}
	return md.RKeys.IsReader(user, deviceKID)
}

// Update implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) Update(id TlfID, h BareTlfHandle) error {
	if id.IsPublic() != h.IsPublic() {
		return errors.New("TlfID and TlfHandle disagree on public status")
	}

	var writers []keybase1.UID
	var wKeys TLFWriterKeyGenerations
	var rKeys TLFReaderKeyGenerations
	if id.IsPublic() {
		writers = make([]keybase1.UID, len(h.Writers))
		copy(writers, h.Writers)
	} else {
		wKeys = make(TLFWriterKeyGenerations, 0, 1)
		rKeys = make(TLFReaderKeyGenerations, 0, 1)
	}
	md.WriterMetadataV2 = WriterMetadataV2{
		Writers: writers,
		WKeys:   wKeys,
		ID:      id,
	}
	if len(h.UnresolvedWriters) > 0 {
		md.Extra.UnresolvedWriters = make([]keybase1.SocialAssertion, len(h.UnresolvedWriters))
		copy(md.Extra.UnresolvedWriters, h.UnresolvedWriters)
	}

	md.Revision = MetadataRevisionInitial
	md.RKeys = rKeys
	if len(h.UnresolvedReaders) > 0 {
		md.UnresolvedReaders = make([]keybase1.SocialAssertion, len(h.UnresolvedReaders))
		copy(md.UnresolvedReaders, h.UnresolvedReaders)
	}
	return nil
}

// DeepCopy implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) DeepCopy(codec Codec) (BareRootMetadata, error) {
	var newMd BareRootMetadataV2
	if err := CodecUpdate(codec, &newMd, md); err != nil {
		return nil, err
	}
	return &newMd, nil
}

// CheckValidSuccessor implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) CheckValidSuccessor(
	currID MdID, nextMd BareRootMetadata) error {
	// (1) Verify current metadata is non-final.
	if md.IsFinal() {
		return MetadataIsFinalError{}
	}

	// (2) Check TLF ID.
	if nextMd.TlfID() != md.ID {
		return MDTlfIDMismatch{
			currID: md.ID,
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

// CheckValidSuccessorForServer implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) CheckValidSuccessorForServer(
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

// MakeBareTlfHandle implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) MakeBareTlfHandle() (BareTlfHandle, error) {
	var writers, readers []keybase1.UID
	if md.ID.IsPublic() {
		writers = md.Writers
		readers = []keybase1.UID{keybase1.PublicUID}
	} else {
		if len(md.WKeys) == 0 {
			return BareTlfHandle{}, errors.New("No writer key generations; need rekey?")
		}

		if len(md.RKeys) == 0 {
			return BareTlfHandle{}, errors.New("No reader key generations; need rekey?")
		}

		wkb := md.WKeys[len(md.WKeys)-1]
		rkb := md.RKeys[len(md.RKeys)-1]
		writers = make([]keybase1.UID, 0, len(wkb.WKeys))
		readers = make([]keybase1.UID, 0, len(rkb.RKeys))
		for w := range wkb.WKeys {
			writers = append(writers, w)
		}
		for r := range rkb.RKeys {
			// TODO: Return an error instead if r is
			// PublicUID. Maybe return an error if r is in
			// WKeys also. Or do all this in
			// MakeBareTlfHandle.
			if _, ok := wkb.WKeys[r]; !ok &&
				r != keybase1.PublicUID {
				readers = append(readers, r)
			}
		}
	}

	return MakeBareTlfHandle(
		writers, readers,
		md.Extra.UnresolvedWriters, md.UnresolvedReaders,
		md.TlfHandleExtensions())
}

// TlfHandleExtensions implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) TlfHandleExtensions() (
	extensions []TlfHandleExtension) {
	if md.ConflictInfo != nil {
		extensions = append(extensions, *md.ConflictInfo)
	}
	if md.FinalizedInfo != nil {
		extensions = append(extensions, *md.FinalizedInfo)
	}
	return extensions
}

// GetTLFKeyBundles implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetTLFKeyBundles(keyGen KeyGen) (
	*TLFWriterKeyBundle, *TLFReaderKeyBundle, error) {
	if md.ID.IsPublic() {
		return nil, nil, InvalidPublicTLFOperation{md.ID, "GetTLFKeyBundles"}
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

// GetDeviceKIDs implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetDeviceKIDs(
	keyGen KeyGen, user keybase1.UID) ([]keybase1.KID, error) {
	wkb, rkb, err := md.GetTLFKeyBundles(keyGen)
	if err != nil {
		return nil, err
	}

	dkim := wkb.WKeys[user]
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

// HasKeyForUser implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) HasKeyForUser(
	keyGen KeyGen, user keybase1.UID) bool {
	wkb, rkb, err := md.GetTLFKeyBundles(keyGen)
	if err != nil {
		return false
	}

	return (len(wkb.WKeys[user]) > 0) || (len(rkb.RKeys[user]) > 0)
}

// GetTLFCryptKeyParams implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetTLFCryptKeyParams(
	keyGen KeyGen, user keybase1.UID, key CryptPublicKey) (
	TLFEphemeralPublicKey, EncryptedTLFCryptKeyClientHalf,
	TLFCryptKeyServerHalfID, bool, error) {
	wkb, rkb, err := md.GetTLFKeyBundles(keyGen)
	if err != nil {
		return TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false, err
	}

	dkim := wkb.WKeys[user]
	if dkim == nil {
		dkim = rkb.RKeys[user]
		if dkim == nil {
			return TLFEphemeralPublicKey{},
				EncryptedTLFCryptKeyClientHalf{},
				TLFCryptKeyServerHalfID{}, false, nil
		}
	}
	info, ok := dkim[key.kid]
	if !ok {
		return TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false, nil
	}

	var index int
	var publicKeys TLFEphemeralPublicKeys
	var keyType string
	if info.EPubKeyIndex >= 0 {
		index = info.EPubKeyIndex
		publicKeys = wkb.TLFEphemeralPublicKeys
		keyType = "writer"
	} else {
		index = -1 - info.EPubKeyIndex
		publicKeys = rkb.TLFReaderEphemeralPublicKeys
		keyType = "reader"
	}
	keyCount := len(publicKeys)
	if index >= keyCount {
		return TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false,
			fmt.Errorf("Invalid %s key index %d >= %d",
				keyType, index, keyCount)
	}
	return publicKeys[index], info.ClientHalf, info.ServerHalfID, true, nil
}

// IsValidAndSigned implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsValidAndSigned(
	codec Codec, crypto cryptoPure) error {
	// Optimization -- if the WriterMetadata signature is nil, it
	// will fail verification.
	if md.WriterMetadataSigInfo.IsNil() {
		return errors.New("Missing WriterMetadata signature")
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

	if len(md.SerializedPrivateMetadata) == 0 {
		return errors.New("No private metadata")
	}

	if (md.MergedStatus() == Merged) != (md.BID() == NullBranchID) {
		return fmt.Errorf("Branch ID %s doesn't match merged status %s",
			md.BID(), md.MergedStatus())
	}

	handle, err := md.MakeBareTlfHandle()
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

	// Verify signature. We have to re-marshal the WriterMetadata,
	// since it's embedded.
	buf, err := codec.Encode(md.WriterMetadataV2)
	if err != nil {
		return err
	}

	err = crypto.Verify(buf, md.WriterMetadataSigInfo)
	if err != nil {
		return fmt.Errorf("Could not verify writer metadata: %v", err)
	}

	return nil
}

// IsLastModifiedBy implements the BareRootMetadata interface for
// BareRootMetadataV2.
func (md *BareRootMetadataV2) IsLastModifiedBy(
	uid keybase1.UID, key VerifyingKey) error {
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

// LastModifyingWriter implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) LastModifyingWriter() keybase1.UID {
	return md.WriterMetadataV2.LastModifyingWriter
}

// LastModifyingWriterKID implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) LastModifyingWriterKID() keybase1.KID {
	return md.WriterMetadataSigInfo.VerifyingKey.KID()
}

// GetLastModifyingUser implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetLastModifyingUser() keybase1.UID {
	return md.LastModifyingUser
}

// RefBytes implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) RefBytes() uint64 {
	return md.WriterMetadataV2.RefBytes
}

// UnrefBytes implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) UnrefBytes() uint64 {
	return md.WriterMetadataV2.UnrefBytes
}

// DiskUsage implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) DiskUsage() uint64 {
	return md.WriterMetadataV2.DiskUsage
}

// SetRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetRefBytes(refBytes uint64) {
	md.WriterMetadataV2.RefBytes = refBytes
}

// SetUnrefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetUnrefBytes(unrefBytes uint64) {
	md.WriterMetadataV2.UnrefBytes = unrefBytes
}

// SetDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetDiskUsage(diskUsage uint64) {
	md.WriterMetadataV2.DiskUsage = diskUsage
}

// AddRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) AddRefBytes(refBytes uint64) {
	md.WriterMetadataV2.RefBytes += refBytes
}

// AddUnrefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) AddUnrefBytes(unrefBytes uint64) {
	md.WriterMetadataV2.UnrefBytes += unrefBytes
}

// AddDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) AddDiskUsage(diskUsage uint64) {
	md.WriterMetadataV2.DiskUsage += diskUsage
}

// RevisionNumber implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) RevisionNumber() MetadataRevision {
	return md.Revision
}

// BID implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) BID() BranchID {
	return md.WriterMetadataV2.BID
}

// GetPrevRoot implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetPrevRoot() MdID {
	return md.PrevRoot
}

// ClearRekeyBit implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) ClearRekeyBit() {
	md.Flags &= ^MetadataFlagRekey
}

// ClearWriterMetadataCopiedBit implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) ClearWriterMetadataCopiedBit() {
	md.Flags &= ^MetadataFlagWriterMetadataCopied
}

// IsUnmergedSet implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) IsUnmergedSet() bool {
	return (md.WriterMetadataV2.WFlags & MetadataFlagUnmerged) != 0
}

// SetUnmerged implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetUnmerged() {
	md.WriterMetadataV2.WFlags |= MetadataFlagUnmerged
}

// SetBranchID implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetBranchID(bid BranchID) {
	md.WriterMetadataV2.BID = bid
}

// SetPrevRoot implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetPrevRoot(mdID MdID) {
	md.PrevRoot = mdID
}

// GetSerializedPrivateMetadata implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetSerializedPrivateMetadata() []byte {
	return md.SerializedPrivateMetadata
}

// SetSerializedPrivateMetadata implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetSerializedPrivateMetadata(spmd []byte) {
	md.SerializedPrivateMetadata = spmd
}

// GetSerializedWriterMetadata implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetSerializedWriterMetadata(codec Codec) ([]byte, error) {
	return codec.Encode(md.WriterMetadataV2)
}

// GetWriterMetadataSigInfo implements the BareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) GetWriterMetadataSigInfo() SignatureInfo {
	return md.WriterMetadataSigInfo
}

// SetWriterMetadataSigInfo implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetWriterMetadataSigInfo(sigInfo SignatureInfo) {
	md.WriterMetadataSigInfo = sigInfo
}

// SetLastModifyingWriter implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetLastModifyingWriter(user keybase1.UID) {
	md.WriterMetadataV2.LastModifyingWriter = user
}

// SetLastModifyingUser implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetLastModifyingUser(user keybase1.UID) {
	md.LastModifyingUser = user
}

// SetRekeyBit implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetRekeyBit() {
	md.Flags |= MetadataFlagRekey
}

// SetFinalBit implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetFinalBit() {
	md.Flags |= MetadataFlagFinal
}

// SetWriterMetadataCopiedBit implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetWriterMetadataCopiedBit() {
	md.Flags |= MetadataFlagWriterMetadataCopied
}

// SetRevision implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetRevision(revision MetadataRevision) {
	md.Revision = revision
}

// AddNewKeys implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) AddNewKeys(
	wkb TLFWriterKeyBundle, rkb TLFReaderKeyBundle) {
	md.WKeys = append(md.WKeys, wkb)
	md.RKeys = append(md.RKeys, rkb)
}

// SetUnresolvedReaders implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetUnresolvedReaders(readers []keybase1.SocialAssertion) {
	md.UnresolvedReaders = readers
}

// SetUnresolvedWriters implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetUnresolvedWriters(writers []keybase1.SocialAssertion) {
	md.Extra.UnresolvedWriters = writers
}

// SetConflictInfo implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetConflictInfo(ci *TlfHandleExtension) {
	md.ConflictInfo = ci
}

// SetFinalizedInfo implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetFinalizedInfo(fi *TlfHandleExtension) {
	md.FinalizedInfo = fi
}

// SetWriters implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetWriters(writers []keybase1.UID) {
	md.Writers = writers
}

// SetTlfID implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) SetTlfID(tlf TlfID) {
	md.ID = tlf
}

// ClearFinalBit implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) ClearFinalBit() {
	md.Flags &= ^MetadataFlagFinal
}

// Version implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) Version() MetadataVer {
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

// FakeInitialRekey implements the MutableBareRootMetadata interface for BareRootMetadataV2.
func (md *BareRootMetadataV2) FakeInitialRekey(h BareTlfHandle) {
	if md.ID.IsPublic() {
		panic("Called FakeInitialRekey on public TLF")
	}
	wkb := TLFWriterKeyBundle{
		WKeys: make(UserDeviceKeyInfoMap),
	}
	for _, w := range h.Writers {
		k := MakeFakeCryptPublicKeyOrBust(string(w))
		wkb.WKeys[w] = DeviceKeyInfoMap{
			k.kid: TLFCryptKeyInfo{},
		}
	}
	md.WKeys = TLFWriterKeyGenerations{wkb}

	rkb := TLFReaderKeyBundle{
		RKeys: make(UserDeviceKeyInfoMap),
	}
	for _, r := range h.Readers {
		k := MakeFakeCryptPublicKeyOrBust(string(r))
		rkb.RKeys[r] = DeviceKeyInfoMap{
			k.kid: TLFCryptKeyInfo{},
		}
	}
	md.RKeys = TLFReaderKeyGenerations{rkb}
}

// BareRootMetadataSignedV2 is the MD that is signed by the reader or
// writer including the signature info. Unlike RootMetadataSigned,
// it contains exactly the serializable metadata and signature info.
type BareRootMetadataSignedV2 struct {
	// signature over the root metadata by the private signing key
	SigInfo SignatureInfo `codec:",omitempty"`
	// all the metadata
	MD BareRootMetadataV2
}
