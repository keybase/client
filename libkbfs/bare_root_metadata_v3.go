// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"runtime"

	goerrors "github.com/go-errors/errors"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
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
	ID tlf.ID
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
	ConflictInfo *tlf.HandleExtension `codec:"ci,omitempty"`
	// FinalizedInfo is set if there are no more valid writer keys capable
	// of writing to the given folder.
	FinalizedInfo *tlf.HandleExtension `codec:"fi,omitempty"`

	codec.UnknownFieldSetHandler
}

type missingKeyBundlesError struct {
	stack []uintptr
}

func (e missingKeyBundlesError) Error() string {
	s := "Missing key bundles: \n"
	for _, pc := range e.stack {
		f := goerrors.NewStackFrame(pc)
		s += f.String()
	}
	return s
}

func makeMissingKeyBundlesError() missingKeyBundlesError {
	stack := make([]uintptr, 20)
	n := runtime.Callers(2, stack)
	return missingKeyBundlesError{stack[:n]}
}

// ExtraMetadataV3 contains references to key bundles stored outside of metadata
// blocks.  This only ever exists in memory and is never serialized itself.
type ExtraMetadataV3 struct {
	wkb TLFWriterKeyBundleV3
	rkb TLFReaderKeyBundleV3
	// Set if wkb is new and should be sent to the server on an MD
	// put.
	wkbNew bool
	// Set if rkb is new and should be sent to the server on an MD
	// put.
	rkbNew bool
}

// NewExtraMetadataV3 creates a new ExtraMetadataV3 given a pair of key bundles
func NewExtraMetadataV3(
	wkb TLFWriterKeyBundleV3, rkb TLFReaderKeyBundleV3,
	wkbNew, rkbNew bool) *ExtraMetadataV3 {
	return &ExtraMetadataV3{wkb, rkb, wkbNew, rkbNew}
}

// MetadataVersion implements the ExtraMetadata interface for ExtraMetadataV3.
func (extra ExtraMetadataV3) MetadataVersion() MetadataVer {
	return SegregatedKeyBundlesVer
}

// DeepCopy implements the ExtraMetadata interface for ExtraMetadataV3.
func (extra ExtraMetadataV3) DeepCopy(codec kbfscodec.Codec) (
	ExtraMetadata, error) {
	wkb, rkb := TLFWriterKeyBundleV3{}, TLFReaderKeyBundleV3{}
	if err := kbfscodec.Update(codec, &rkb, extra.rkb); err != nil {
		return nil, err
	}
	if err := kbfscodec.Update(codec, &wkb, extra.wkb); err != nil {
		return nil, err
	}
	return NewExtraMetadataV3(wkb, rkb, false, false), nil
}

// GetWriterKeyBundle returns the contained writer key bundle.
func (extra ExtraMetadataV3) GetWriterKeyBundle() TLFWriterKeyBundleV3 {
	return extra.wkb
}

// GetReaderKeyBundle returns the contained reader key bundle.
func (extra ExtraMetadataV3) GetReaderKeyBundle() TLFReaderKeyBundleV3 {
	return extra.rkb
}

// MakeInitialBareRootMetadataV3 creates a new BareRootMetadataV3
// object with revision MetadataRevisionInitial, and the given TLF ID
// and handle. Note that if the given ID/handle are private, rekeying
// must be done separately.
func MakeInitialBareRootMetadataV3(tlfID tlf.ID, h tlf.Handle) (
	*BareRootMetadataV3, error) {
	if tlfID.IsPublic() != h.IsPublic() {
		return nil, errors.New(
			"TlfID and TlfHandle disagree on public status")
	}

	var writers []keybase1.UID
	if tlfID.IsPublic() {
		writers = make([]keybase1.UID, len(h.Writers))
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
func (md *BareRootMetadataV3) TlfID() tlf.ID {
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
	if len(rkb.Keys) != len(prevRkb.Keys) {
		return false, nil
	}
	for u, keys := range rkb.Keys {
		if u != user {
			prevKeys := prevRkb.Keys[u]
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
		codec, prevMd, user, prevExtraV3.rkb, extraV3.rkb)
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

func (md *BareRootMetadataV3) checkPublicExtra(extra ExtraMetadata) error {
	if !md.TlfID().IsPublic() {
		return errors.New("checkPublicExtra called on non-public TLF")
	}

	if extra != nil {
		return fmt.Errorf("Expected nil, got %T", extra)
	}

	return nil
}

func (md *BareRootMetadataV3) getTLFKeyBundles(extra ExtraMetadata) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, error) {
	if md.TlfID().IsPublic() {
		return nil, nil, InvalidPublicTLFOperation{
			md.TlfID(), "getTLFKeyBundles", md.Version(),
		}
	}

	if extra == nil {
		return nil, nil, makeMissingKeyBundlesError()
	}

	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return nil, nil, fmt.Errorf(
			"Expected *ExtraMetadataV3, got %T", extra)
	}

	return &extraV3.wkb, &extraV3.rkb, nil
}

// IsWriter implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsWriter(
	user keybase1.UID, deviceKID keybase1.KID, extra ExtraMetadata) bool {
	if md.TlfID().IsPublic() {
		err := md.checkPublicExtra(extra)
		if err != nil {
			panic(err)
		}

		for _, w := range md.WriterMetadata.Writers {
			if w == user {
				return true
			}
		}
		return false
	}
	wkb, _, err := md.getTLFKeyBundles(extra)
	if err != nil {
		panic(err)
	}
	return wkb.IsWriter(user, deviceKID)
}

// IsReader implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsReader(
	user keybase1.UID, deviceKID keybase1.KID, extra ExtraMetadata) bool {
	if md.TlfID().IsPublic() {
		err := md.checkPublicExtra(extra)
		if err != nil {
			panic(err)
		}
		return true
	}
	_, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		panic(err)
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
	ctx context.Context, config Config, kmd KeyMetadata,
	extra ExtraMetadata, isReadableAndWriter bool) (
	MutableBareRootMetadata, ExtraMetadata, error) {
	var extraCopy ExtraMetadata
	if extra != nil {
		var err error
		extraCopy, err = extra.DeepCopy(config.Codec())
		if err != nil {
			return nil, nil, err
		}
	}
	mdCopy, err := md.DeepCopy(config.Codec())
	if err != nil {
		return nil, nil, err
	}
	// TODO: If there is ever a BareRootMetadataV4 this will need to perform the conversion.
	return mdCopy, extraCopy, nil
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
	tlf.Handle, error) {
	var writers, readers []keybase1.UID
	if md.TlfID().IsPublic() {
		err := md.checkPublicExtra(extra)
		if err != nil {
			return tlf.Handle{}, err
		}

		writers = md.WriterMetadata.Writers
		readers = []keybase1.UID{keybase1.PublicUID}
	} else {
		wkb, rkb, err := md.getTLFKeyBundles(extra)
		if err != nil {
			return tlf.Handle{}, err
		}
		writers = make([]keybase1.UID, 0, len(wkb.Keys))
		readers = make([]keybase1.UID, 0, len(rkb.Keys))
		for w := range wkb.Keys {
			writers = append(writers, w)
		}
		for r := range rkb.Keys {
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

	return tlf.MakeHandle(
		writers, readers,
		md.WriterMetadata.UnresolvedWriters, md.UnresolvedReaders,
		md.TlfHandleExtensions())
}

// TlfHandleExtensions implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) TlfHandleExtensions() (
	extensions []tlf.HandleExtension) {
	if md.ConflictInfo != nil {
		extensions = append(extensions, *md.ConflictInfo)
	}
	if md.FinalizedInfo != nil {
		extensions = append(extensions, *md.FinalizedInfo)
	}
	return extensions
}

// PromoteReader implements the BareRootMetadata interface for
// BareRootMetadataV3.
func (md *BareRootMetadataV3) PromoteReader(
	uid keybase1.UID, extra ExtraMetadata) error {
	if md.TlfID().IsPublic() {
		return InvalidPublicTLFOperation{md.TlfID(), "PromoteReader", md.Version()}
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return err
	}
	dkim, ok := rkb.Keys[uid]
	if !ok {
		return fmt.Errorf("Could not find %s in rkb", uid)
	}
	// TODO: This is incorrect, since dkim contains offsets info
	// rkb.TLFEphemeralPublicKeys, which don't directly translate
	// to offsets into wkb.TLFEphemeralPublicKeys.
	//
	// Also, doing this may leave some entries in
	// rkb.TLFEphemeralPublicKeys unreferenced, so they should be
	// removed.
	//
	// See KBFS-1719.
	//
	// Currently, this bug is hidden by another bug where reader
	// promotion incorrectly triggers a new key generation: see
	// KBFS-1744.
	wkb.Keys[uid] = dkim
	delete(rkb.Keys, uid)
	return nil
}

// RevokeRemovedDevices implements the BareRootMetadata interface for
// BareRootMetadataV3.
func (md *BareRootMetadataV3) RevokeRemovedDevices(
	wKeys, rKeys UserDevicePublicKeys, extra ExtraMetadata) (
	ServerHalfRemovalInfo, error) {
	if md.TlfID().IsPublic() {
		return nil, InvalidPublicTLFOperation{
			md.TlfID(), "RevokeRemovedDevices", md.Version()}
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return nil, err
	}

	wRemovalInfo := wkb.Keys.removeDevicesNotIn(wKeys)
	rRemovalInfo := rkb.Keys.removeDevicesNotIn(rKeys)
	return wRemovalInfo.mergeUsers(rRemovalInfo)
}

// GetDeviceKIDs implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetDeviceKIDs(
	keyGen KeyGen, user keybase1.UID, extra ExtraMetadata) ([]keybase1.KID, error) {
	if md.TlfID().IsPublic() {
		return nil, InvalidPublicTLFOperation{
			md.TlfID(), "GetDeviceKIDs", md.Version()}
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return nil, err
	}
	dkim := wkb.Keys[user]
	if len(dkim) == 0 {
		dkim = rkb.Keys[user]
		if len(dkim) == 0 {
			return nil, nil
		}
	}

	kids := make([]keybase1.KID, 0, len(dkim))
	for key := range dkim {
		kids = append(kids, key.KID())
	}

	return kids, nil
}

// HasKeyForUser implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) HasKeyForUser(
	keyGen KeyGen, user keybase1.UID, extra ExtraMetadata) bool {
	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		panic(err)
	}
	return (len(wkb.Keys[user]) > 0) || (len(rkb.Keys[user]) > 0)
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
	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return kbfscrypto.TLFEphemeralPublicKey{},
			EncryptedTLFCryptKeyClientHalf{},
			TLFCryptKeyServerHalfID{}, false, err
	}
	isWriter := true
	dkim := wkb.Keys[user]
	if dkim == nil {
		dkim = rkb.Keys[user]
		if dkim == nil {
			return kbfscrypto.TLFEphemeralPublicKey{},
				EncryptedTLFCryptKeyClientHalf{},
				TLFCryptKeyServerHalfID{}, false, nil
		}
		isWriter = false
	}
	info, ok := dkim[key]
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
		publicKeys = rkb.TLFEphemeralPublicKeys
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

func checkWKBID(crypto cryptoPure,
	wkbID TLFWriterKeyBundleID, wkb TLFWriterKeyBundleV3) error {
	computedWKBID, err := crypto.MakeTLFWriterKeyBundleID(wkb)
	if err != nil {
		return err
	}

	if wkbID != computedWKBID {
		return fmt.Errorf("Expected WKB ID %s, got %s",
			wkbID, computedWKBID)
	}

	return nil
}

func checkRKBID(crypto cryptoPure,
	rkbID TLFReaderKeyBundleID, rkb TLFReaderKeyBundleV3) error {
	computedRKBID, err := crypto.MakeTLFReaderKeyBundleID(rkb)
	if err != nil {
		return err
	}

	if rkbID != computedRKBID {
		return fmt.Errorf("Expected RKB ID %s, got %s",
			rkbID, computedRKBID)
	}

	return nil
}

// IsValidAndSigned implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsValidAndSigned(
	codec kbfscodec.Codec, crypto cryptoPure, extra ExtraMetadata) error {
	if md.TlfID().IsPublic() {
		err := md.checkPublicExtra(extra)
		if err != nil {
			return err
		}
	} else {
		wkb, rkb, err := md.getTLFKeyBundles(extra)
		if err != nil {
			return err
		}

		err = checkWKBID(crypto, md.GetTLFWriterKeyBundleID(), *wkb)
		if err != nil {
			return err
		}

		err = checkRKBID(crypto, md.GetTLFReaderKeyBundleID(), *rkb)
		if err != nil {
			return err
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

func (md *BareRootMetadataV3) addKeyGenerationHelper(codec kbfscodec.Codec,
	crypto cryptoPure, prevExtra ExtraMetadata,
	currCryptKey, nextCryptKey kbfscrypto.TLFCryptKey,
	pubKey kbfscrypto.TLFPublicKey,
	wUDKIM, rUDKIM UserDeviceKeyInfoMap,
	wPublicKeys, rPublicKeys []kbfscrypto.TLFEphemeralPublicKey) (
	ExtraMetadata, error) {
	if md.TlfID().IsPublic() {
		return nil, InvalidPublicTLFOperation{
			md.TlfID(), "addKeyGenerationHelper", md.Version()}
	}
	if nextCryptKey == (kbfscrypto.TLFCryptKey{}) {
		return nil, errors.New("Zero next crypt key")
	}
	latestKeyGen := md.LatestKeyGeneration()
	var encryptedHistoricKeys EncryptedTLFCryptKeys
	if currCryptKey == (kbfscrypto.TLFCryptKey{}) {
		if latestKeyGen >= FirstValidKeyGen {
			return nil, fmt.Errorf(
				"Zero current crypt key with latest key generation %d",
				latestKeyGen)
		}
	} else {
		if latestKeyGen < FirstValidKeyGen {
			return nil, errors.New(
				"Non-zero current crypt key with no existing key generations")
		}
		var historicKeys []kbfscrypto.TLFCryptKey
		if latestKeyGen > FirstValidKeyGen {
			prevExtraV3, ok := prevExtra.(*ExtraMetadataV3)
			if !ok {
				return nil, errors.New("Invalid prev extra metadata")
			}
			var err error
			historicKeys, err = crypto.DecryptTLFCryptKeys(
				prevExtraV3.wkb.EncryptedHistoricTLFCryptKeys,
				currCryptKey)
			if err != nil {
				return nil, err
			}
			expectedHistoricKeyCount :=
				int(md.LatestKeyGeneration() - FirstValidKeyGen)
			if len(historicKeys) != expectedHistoricKeyCount {
				return nil, fmt.Errorf(
					"Expected %d historic keys, got %d",
					expectedHistoricKeyCount,
					len(historicKeys))
			}
		}
		historicKeys = append(historicKeys, currCryptKey)
		var err error
		encryptedHistoricKeys, err = crypto.EncryptTLFCryptKeys(
			historicKeys, nextCryptKey)
		if err != nil {
			return nil, err
		}
	}

	wUDKIMV3, err := udkimToV3(codec, wUDKIM)
	if err != nil {
		return nil, err
	}

	rUDKIMV3, err := udkimToV3(codec, rUDKIM)
	if err != nil {
		return nil, err
	}

	newWriterKeys := TLFWriterKeyBundleV3{
		Keys:                          wUDKIMV3,
		TLFPublicKey:                  pubKey,
		EncryptedHistoricTLFCryptKeys: encryptedHistoricKeys,
		TLFEphemeralPublicKeys:        wPublicKeys,
	}
	newReaderKeys := TLFReaderKeyBundleV3{
		Keys: rUDKIMV3,
		TLFEphemeralPublicKeys: rPublicKeys,
	}
	md.WriterMetadata.LatestKeyGen++
	return NewExtraMetadataV3(newWriterKeys, newReaderKeys, true, true), nil
}

func (md *BareRootMetadataV3) addKeyGenerationForTest(codec kbfscodec.Codec,
	crypto cryptoPure, prevExtra ExtraMetadata,
	currCryptKey, nextCryptKey kbfscrypto.TLFCryptKey,
	pubKey kbfscrypto.TLFPublicKey,
	wUDKIM, rUDKIM UserDeviceKeyInfoMap) ExtraMetadata {
	for _, dkim := range wUDKIM {
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
	for _, dkim := range rUDKIM {
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

	// TODO: Size this to the max EPubKeyIndex for writers.
	wPublicKeys := make([]kbfscrypto.TLFEphemeralPublicKey, 1)
	// TODO: Size this to the max EPubKeyIndex for readers.
	rPublicKeys := make([]kbfscrypto.TLFEphemeralPublicKey, 1)
	extra, err := md.addKeyGenerationHelper(
		codec, crypto, prevExtra, currCryptKey, nextCryptKey,
		pubKey, wUDKIM, rUDKIM, wPublicKeys, rPublicKeys)
	if err != nil {
		panic(err)
	}
	err = md.FinalizeRekey(crypto, extra)
	if err != nil {
		panic(err)
	}
	return extra
}

// AddKeyGeneration implements the MutableBareRootMetadata interface
// for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddKeyGeneration(codec kbfscodec.Codec,
	crypto cryptoPure, prevExtra ExtraMetadata,
	currCryptKey, nextCryptKey kbfscrypto.TLFCryptKey,
	pubKey kbfscrypto.TLFPublicKey) (ExtraMetadata, error) {
	wUDKIM := make(UserDeviceKeyInfoMap)
	rUDKIM := make(UserDeviceKeyInfoMap)
	extra, err := md.addKeyGenerationHelper(codec, crypto, prevExtra,
		currCryptKey, nextCryptKey, pubKey, wUDKIM, rUDKIM, nil, nil)
	if err != nil {
		return nil, err
	}
	return extra, nil
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
func (md *BareRootMetadataV3) SetConflictInfo(ci *tlf.HandleExtension) {
	md.ConflictInfo = ci
}

// SetFinalizedInfo implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetFinalizedInfo(fi *tlf.HandleExtension) {
	md.FinalizedInfo = fi
}

// SetWriters implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetWriters(writers []keybase1.UID) {
	md.WriterMetadata.Writers = writers
}

// SetTlfID implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetTlfID(tlf tlf.ID) {
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

// GetCurrentTLFPublicKey implements the BareRootMetadata interface
// for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetCurrentTLFPublicKey(
	extra ExtraMetadata) (kbfscrypto.TLFPublicKey, error) {
	wkb, _, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return kbfscrypto.TLFPublicKey{}, err
	}
	return wkb.TLFPublicKey, nil
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

// GetUserDeviceKeyInfoMaps implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetUserDeviceKeyInfoMaps(
	codec kbfscodec.Codec, keyGen KeyGen, extra ExtraMetadata) (
	readers, writers UserDeviceKeyInfoMap, err error) {
	if md.TlfID().IsPublic() {
		return nil, nil, InvalidPublicTLFOperation{md.TlfID(), "GetTLFKeyBundles", md.Version()}
	}
	if keyGen != md.LatestKeyGeneration() {
		return nil, nil, TLFCryptKeyNotPerDeviceEncrypted{md.TlfID(), keyGen}
	}
	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return nil, nil, err
	}

	rUDKIM, err := rkb.Keys.toUDKIM(codec)
	if err != nil {
		return nil, nil, err
	}

	wUDKIM, err := wkb.Keys.toUDKIM(codec)
	if err != nil {
		return nil, nil, err
	}

	return rUDKIM, wUDKIM, nil
}

// UpdateKeyGeneration implements the MutableBareRootMetadata interface
// for BareRootMetadataV3.
func (md *BareRootMetadataV3) UpdateKeyGeneration(crypto cryptoPure,
	keyGen KeyGen, extra ExtraMetadata, wKeys, rKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (UserDeviceKeyServerHalves, error) {
	if md.TlfID().IsPublic() {
		return nil, InvalidPublicTLFOperation{
			md.TlfID(), "UpdateKeyGeneration", md.Version()}
	}

	if keyGen != md.LatestKeyGeneration() {
		return nil, TLFCryptKeyNotPerDeviceEncrypted{md.TlfID(), keyGen}
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return UserDeviceKeyServerHalves{}, err
	}

	// No need to explicitly handle the reader rekey case.

	var newReaderIndex, newWriterIndex int
	if len(rKeys) > 0 {
		newReaderIndex = len(rkb.TLFEphemeralPublicKeys)
	}
	if len(wKeys) > 0 {
		newWriterIndex = len(wkb.TLFEphemeralPublicKeys)
	}

	wServerHalves, err := wkb.Keys.fillInUserInfos(
		crypto, newWriterIndex, wKeys, ePrivKey, tlfCryptKey)
	if err != nil {
		return nil, err
	}
	if len(wServerHalves) > 0 {
		wkb.TLFEphemeralPublicKeys =
			append(wkb.TLFEphemeralPublicKeys, ePubKey)
	}

	rServerHalves, err := rkb.Keys.fillInUserInfos(
		crypto, newReaderIndex, rKeys, ePrivKey, tlfCryptKey)
	if err != nil {
		return nil, err
	}
	if len(rServerHalves) > 0 {
		rkb.TLFEphemeralPublicKeys =
			append(rkb.TLFEphemeralPublicKeys, ePubKey)
	}

	return wServerHalves.mergeUsers(rServerHalves)
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
	crypto cryptoPure, extra ExtraMetadata) error {
	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return errors.New("Invalid extra metadata")
	}
	oldWKBID := md.WriterMetadata.WKeyBundleID
	oldRKBID := md.RKeyBundleID

	newWKBID, err := crypto.MakeTLFWriterKeyBundleID(extraV3.wkb)
	if err != nil {
		return err
	}
	newRKBID, err := crypto.MakeTLFReaderKeyBundleID(extraV3.rkb)
	if err != nil {
		return err
	}

	md.WriterMetadata.WKeyBundleID = newWKBID
	md.RKeyBundleID = newRKBID

	// TODO: This should be or'ing with the existing parameters to
	// handle the upconvert-then-rekey case. Also add a test for
	// this.
	extraV3.wkbNew = newWKBID != oldWKBID
	extraV3.rkbNew = newRKBID != oldRKBID

	return nil
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
	if keyGen < FirstValidKeyGen || keyGen >= md.LatestKeyGeneration() {
		return kbfscrypto.TLFCryptKey{}, fmt.Errorf(
			"Invalid key generation %d", keyGen)
	}
	oldKeys, err := crypto.DecryptTLFCryptKeys(
		extraV3.wkb.EncryptedHistoricTLFCryptKeys, currentKey)
	if err != nil {
		return kbfscrypto.TLFCryptKey{}, err
	}
	index := int(keyGen - FirstValidKeyGen)
	if index >= len(oldKeys) || index < 0 {
		return kbfscrypto.TLFCryptKey{}, fmt.Errorf(
			"Index %d out of range (max: %d)", index, len(oldKeys))
	}
	return oldKeys[index], nil
}
