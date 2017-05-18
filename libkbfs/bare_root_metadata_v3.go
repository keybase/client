// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"runtime"

	goerrors "github.com/go-errors/errors"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
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

	// For public and single-team TLFs (since those don't have any
	// keys at all).
	Writers []keybase1.UserOrTeamID `codec:",omitempty"`
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
	// Estimated MD disk usage at this revision
	MDDiskUsage uint64 `codec:",omitempty"`
	// The total number of bytes in new data blocks
	RefBytes uint64
	// The total number of bytes in unreferenced blocks
	UnrefBytes uint64
	// The total number of bytes in new MD blocks
	MDRefBytes uint64 `codec:",omitempty"`

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
	Revision kbfsmd.Revision
	// Pointer to the previous root block ID
	PrevRoot kbfsmd.ID

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

// TODO: Use pkg/errors instead.
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

func (extra *ExtraMetadataV3) updateNew(wkbNew, rkbNew bool) {
	extra.wkbNew = extra.wkbNew || wkbNew
	extra.rkbNew = extra.rkbNew || rkbNew
}

// DeepCopy implements the ExtraMetadata interface for ExtraMetadataV3.
func (extra ExtraMetadataV3) DeepCopy(codec kbfscodec.Codec) (
	ExtraMetadata, error) {
	wkb, err := extra.wkb.DeepCopy(codec)
	if err != nil {
		return nil, err
	}
	rkb, err := extra.rkb.DeepCopy(codec)
	if err != nil {
		return nil, err
	}
	return NewExtraMetadataV3(wkb, rkb, extra.wkbNew, extra.rkbNew), nil
}

// MakeSuccessorCopy implements the ExtraMetadata interface for ExtraMetadataV3.
func (extra ExtraMetadataV3) MakeSuccessorCopy(codec kbfscodec.Codec) (
	ExtraMetadata, error) {
	wkb, err := extra.wkb.DeepCopy(codec)
	if err != nil {
		return nil, err
	}
	rkb, err := extra.rkb.DeepCopy(codec)
	if err != nil {
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
// object with revision kbfsmd.RevisionInitial, and the given TLF ID
// and handle. Note that if the given ID/handle are private, rekeying
// must be done separately.
func MakeInitialBareRootMetadataV3(tlfID tlf.ID, h tlf.Handle) (
	*BareRootMetadataV3, error) {
	if tlfID.Type() != h.Type() {
		return nil, errors.New("TlfID and TlfHandle disagree on TLF type")
	}

	var writers []keybase1.UserOrTeamID
	if tlfID.Type() != tlf.Private {
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

	return &BareRootMetadataV3{
		WriterMetadata: WriterMetadataV3{
			Writers:           writers,
			ID:                tlfID,
			UnresolvedWriters: unresolvedWriters,
		},
		Revision:          kbfsmd.RevisionInitial,
		UnresolvedReaders: unresolvedReaders,
	}, nil
}

// TlfID implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) TlfID() tlf.ID {
	return md.WriterMetadata.ID
}

// KeyGenerationsToUpdate implements the BareRootMetadata interface
// for BareRootMetadataV3.
func (md *BareRootMetadataV3) KeyGenerationsToUpdate() (KeyGen, KeyGen) {
	latest := md.LatestKeyGeneration()
	if latest < FirstValidKeyGen {
		return 0, 0
	}
	// We only keep track of the latest key generation in extra.
	return latest, latest + 1
}

// LatestKeyGeneration implements the BareRootMetadata interface for
// BareRootMetadataV3.
func (md *BareRootMetadataV3) LatestKeyGeneration() KeyGen {
	if md.TlfID().Type() == tlf.Public {
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

func (md *BareRootMetadataV3) checkNonPrivateExtra(extra ExtraMetadata) error {
	if md.TlfID().Type() == tlf.Private {
		return errors.New("checkNonPrivateExtra called on private TLF")
	}

	if extra != nil {
		return errors.Errorf("Expected nil, got %T", extra)
	}

	return nil
}

func (md *BareRootMetadataV3) getTLFKeyBundles(extra ExtraMetadata) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "getTLFKeyBundles", md.Version(),
		}
	}

	if extra == nil {
		return nil, nil, makeMissingKeyBundlesError()
	}

	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return nil, nil, errors.Errorf(
			"Expected *ExtraMetadataV3, got %T", extra)
	}

	return &extraV3.wkb, &extraV3.rkb, nil
}

// IsWriter implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsWriter(
	user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey, extra ExtraMetadata) bool {
	if md.TlfID().Type() != tlf.Private {
		err := md.checkNonPrivateExtra(extra)
		if err != nil {
			panic(err)
		}

		for _, w := range md.WriterMetadata.Writers {
			// TODO(KBFS-2185): If a team TLF, check that the user is
			// a writer in that team.
			if w == user.AsUserOrTeam() {
				return true
			}
		}
		return false
	}
	wkb, _, err := md.getTLFKeyBundles(extra)
	if err != nil {
		panic(err)
	}
	return wkb.IsWriter(user, deviceKey)
}

// IsReader implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsReader(
	user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey, extra ExtraMetadata) bool {
	switch md.TlfID().Type() {
	case tlf.Public:
		err := md.checkNonPrivateExtra(extra)
		if err != nil {
			panic(err)
		}
		return true
	case tlf.Private:
		_, rkb, err := md.getTLFKeyBundles(extra)
		if err != nil {
			panic(err)
		}
		return rkb.IsReader(user, deviceKey)
	case tlf.SingleTeam:
		err := md.checkNonPrivateExtra(extra)
		if err != nil {
			panic(err)
		}
		return false
	default:
		panic(fmt.Sprintf("Unknown TLF type: %s", md.TlfID().Type()))
	}
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
	codec kbfscodec.Codec, crypto cryptoPure,
	extra ExtraMetadata, _ MetadataVer,
	_ func() ([]kbfscrypto.TLFCryptKey, error), isReadableAndWriter bool) (
	MutableBareRootMetadata, ExtraMetadata, error) {
	var extraCopy ExtraMetadata
	if extra != nil {
		var err error
		extraCopy, err = extra.MakeSuccessorCopy(codec)
		if err != nil {
			return nil, nil, err
		}
	}
	mdCopy, err := md.DeepCopy(codec)
	if err != nil {
		return nil, nil, err
	}
	// TODO: If there is ever a BareRootMetadataV4 this will need to perform the conversion.
	return mdCopy, extraCopy, nil
}

// CheckValidSuccessor implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) CheckValidSuccessor(
	currID kbfsmd.ID, nextMd BareRootMetadata) error {
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
		return errors.Errorf("Unexpected branch ID on successor: %s vs. %s",
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
	// Add an exception for the case where MDRefBytes is equal, since
	// it probably indicates an older client just copied the previous
	// MDRefBytes value as an unknown field.
	if nextMd.MDDiskUsage() != expectedMDUsage &&
		md.MDRefBytes() != nextMd.MDRefBytes() {
		return MDDiskUsageMismatch{
			expectedDiskUsage: expectedMDUsage,
			actualDiskUsage:   nextMd.MDDiskUsage(),
		}
	}

	// TODO: Check that the successor (bare) TLF handle is the
	// same or more resolved.

	return nil
}

// CheckValidSuccessorForServer implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) CheckValidSuccessorForServer(
	currID kbfsmd.ID, nextMd BareRootMetadata) error {
	err := md.CheckValidSuccessor(currID, nextMd)
	switch err := err.(type) {
	case nil:
		break

	case MDRevisionMismatch:
		return kbfsmd.ServerErrorConflictRevision{
			Expected: err.curr + 1,
			Actual:   err.rev,
		}

	case MDPrevRootMismatch:
		return kbfsmd.ServerErrorConflictPrevRoot{
			Expected: err.expectedPrevRoot,
			Actual:   err.prevRoot,
		}

	case MDDiskUsageMismatch:
		return kbfsmd.ServerErrorConflictDiskUsage{
			Expected: err.expectedDiskUsage,
			Actual:   err.actualDiskUsage,
		}

	default:
		return kbfsmd.ServerError{Err: err}
	}

	return nil
}

// MakeBareTlfHandle implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) MakeBareTlfHandle(extra ExtraMetadata) (
	tlf.Handle, error) {
	var writers, readers []keybase1.UserOrTeamID
	if md.TlfID().Type() == tlf.Private {
		wkb, rkb, err := md.getTLFKeyBundles(extra)
		if err != nil {
			return tlf.Handle{}, err
		}
		writers = make([]keybase1.UserOrTeamID, 0, len(wkb.Keys))
		readers = make([]keybase1.UserOrTeamID, 0, len(rkb.Keys))
		for w := range wkb.Keys {
			writers = append(writers, w.AsUserOrTeam())
		}
		for r := range rkb.Keys {
			// TODO: Return an error instead if r is
			// PublicUID. Maybe return an error if r is in
			// WKeys also. Or do all this in
			// MakeBareTlfHandle.
			if _, ok := wkb.Keys[r]; !ok &&
				r != keybase1.PublicUID {
				readers = append(readers, r.AsUserOrTeam())
			}
		}
	} else {
		err := md.checkNonPrivateExtra(extra)
		if err != nil {
			return tlf.Handle{}, err
		}

		writers = md.WriterMetadata.Writers
		if md.TlfID().Type() == tlf.Public {
			readers = []keybase1.UserOrTeamID{keybase1.PublicUID.AsUserOrTeam()}
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

// PromoteReaders implements the BareRootMetadata interface for
// BareRootMetadataV3.
func (md *BareRootMetadataV3) PromoteReaders(
	readersToPromote map[keybase1.UID]bool, extra ExtraMetadata) error {
	if md.TlfID().Type() != tlf.Private {
		return InvalidNonPrivateTLFOperation{md.TlfID(), "PromoteReaders", md.Version()}
	}

	if len(readersToPromote) == 0 {
		return nil
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return err
	}

	for reader := range readersToPromote {
		dkim, ok := rkb.Keys[reader]
		if !ok {
			return errors.Errorf("Could not find %s in rkb", reader)
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
		wkb.Keys[reader] = dkim
		delete(rkb.Keys, reader)
	}
	return nil
}

// RevokeRemovedDevices implements the BareRootMetadata interface for
// BareRootMetadataV3.
func (md *BareRootMetadataV3) RevokeRemovedDevices(
	updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
	extra ExtraMetadata) (ServerHalfRemovalInfo, error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "RevokeRemovedDevices", md.Version()}
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return nil, err
	}

	wRemovalInfo := wkb.Keys.removeDevicesNotIn(updatedWriterKeys)
	rRemovalInfo := rkb.Keys.removeDevicesNotIn(updatedReaderKeys)
	return wRemovalInfo.mergeUsers(rRemovalInfo)
}

// GetUserDevicePublicKeys implements the BareRootMetadata interface
// for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetUserDevicePublicKeys(extra ExtraMetadata) (
	writerDeviceKeys, readerDeviceKeys UserDevicePublicKeys, err error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "GetUserDevicePublicKeys", md.Version()}
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return nil, nil, err
	}

	return wkb.Keys.toPublicKeys(), rkb.Keys.toPublicKeys(), nil
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
			errors.Errorf("Invalid %s key index %d >= %d",
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
		return errors.Errorf("Expected WKB ID %s, got %s",
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
		return errors.Errorf("Expected RKB ID %s, got %s",
			rkbID, computedRKBID)
	}

	return nil
}

// IsValidAndSigned implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) IsValidAndSigned(
	codec kbfscodec.Codec, crypto cryptoPure, extra ExtraMetadata) error {
	if md.TlfID().Type() == tlf.Public {
		err := md.checkNonPrivateExtra(extra)
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
		if md.Revision < kbfsmd.RevisionInitial+1 {
			return errors.Errorf("Invalid final revision %d", md.Revision)
		}

		if md.Revision == (kbfsmd.RevisionInitial + 1) {
			if md.PrevRoot != (kbfsmd.ID{}) {
				return errors.Errorf("Invalid PrevRoot %s for initial final revision", md.PrevRoot)
			}
		} else {
			if md.PrevRoot == (kbfsmd.ID{}) {
				return errors.New("No PrevRoot for non-initial final revision")
			}
		}
	} else {
		if md.Revision < kbfsmd.RevisionInitial {
			return errors.Errorf("Invalid revision %d", md.Revision)
		}

		if md.Revision == kbfsmd.RevisionInitial {
			if md.PrevRoot != (kbfsmd.ID{}) {
				return errors.Errorf("Invalid PrevRoot %s for initial revision", md.PrevRoot)
			}
		} else {
			if md.PrevRoot == (kbfsmd.ID{}) {
				return errors.New("No PrevRoot for non-initial revision")
			}
		}
	}

	if len(md.WriterMetadata.SerializedPrivateMetadata) == 0 {
		return errors.New("No private metadata")
	}

	if (md.MergedStatus() == Merged) != (md.BID() == NullBranchID) {
		return errors.Errorf("Branch ID %s doesn't match merged status %s",
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
		return errors.Errorf("Invalid modifying writer %s", writer)
	}

	// Make sure the last modifier is valid.
	user := md.LastModifyingUser
	if !handle.IsReader(user.AsUserOrTeam()) {
		return errors.Errorf("Invalid modifying user %s", user)
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
			return errors.Errorf("Last writer %s != %s", writer, uid)
		}
	}

	// Verify the user and device are the last modifier.
	user := md.GetLastModifyingUser()
	if user != uid {
		return errors.Errorf("Last modifier %s != %s", user, uid)
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

// MDRefBytes implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) MDRefBytes() uint64 {
	return md.WriterMetadata.MDRefBytes
}

// DiskUsage implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) DiskUsage() uint64 {
	return md.WriterMetadata.DiskUsage
}

// MDDiskUsage implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) MDDiskUsage() uint64 {
	return md.WriterMetadata.MDDiskUsage
}

// SetRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetRefBytes(refBytes uint64) {
	md.WriterMetadata.RefBytes = refBytes
}

// SetUnrefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetUnrefBytes(unrefBytes uint64) {
	md.WriterMetadata.UnrefBytes = unrefBytes
}

// SetMDRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetMDRefBytes(mdRefBytes uint64) {
	md.WriterMetadata.MDRefBytes = mdRefBytes
}

// SetDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetDiskUsage(diskUsage uint64) {
	md.WriterMetadata.DiskUsage = diskUsage
}

// SetMDDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) SetMDDiskUsage(mdDiskUsage uint64) {
	md.WriterMetadata.MDDiskUsage = mdDiskUsage
}

// AddRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddRefBytes(refBytes uint64) {
	md.WriterMetadata.RefBytes += refBytes
}

// AddUnrefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddUnrefBytes(unrefBytes uint64) {
	md.WriterMetadata.UnrefBytes += unrefBytes
}

// AddMDRefBytes implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddMDRefBytes(mdRefBytes uint64) {
	md.WriterMetadata.MDRefBytes += mdRefBytes
}

// AddDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddDiskUsage(diskUsage uint64) {
	md.WriterMetadata.DiskUsage += diskUsage
}

// AddMDDiskUsage implements the MutableBareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddMDDiskUsage(mdDiskUsage uint64) {
	md.WriterMetadata.MDDiskUsage += mdDiskUsage
}

// RevisionNumber implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) RevisionNumber() kbfsmd.Revision {
	return md.Revision
}

// BID implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) BID() BranchID {
	return md.WriterMetadata.BID
}

// GetPrevRoot implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetPrevRoot() kbfsmd.ID {
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
func (md *BareRootMetadataV3) SetPrevRoot(mdID kbfsmd.ID) {
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
func (md *BareRootMetadataV3) SetRevision(revision kbfsmd.Revision) {
	md.Revision = revision
}

func (md *BareRootMetadataV3) updateKeyBundles(crypto cryptoPure,
	extra ExtraMetadata,
	updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (UserDeviceKeyServerHalves, error) {
	if md.TlfID().Type() != tlf.Private {
		return nil, InvalidNonPrivateTLFOperation{
			md.TlfID(), "updateKeyBundles", md.Version()}
	}

	wkb, rkb, err := md.getTLFKeyBundles(extra)
	if err != nil {
		return nil, err
	}

	// No need to explicitly handle the reader rekey case.

	var newWriterIndex int
	if len(updatedWriterKeys) > 0 {
		newWriterIndex = len(wkb.TLFEphemeralPublicKeys)
	}
	wServerHalves, err := wkb.Keys.fillInUserInfos(
		crypto, newWriterIndex, updatedWriterKeys,
		ePrivKey, tlfCryptKey)
	if err != nil {
		return nil, err
	}
	// If we didn't fill in any new writer infos, don't add a new
	// writer ephemeral key.
	if len(wServerHalves) > 0 {
		wkb.TLFEphemeralPublicKeys =
			append(wkb.TLFEphemeralPublicKeys, ePubKey)
	}

	var newReaderIndex int
	if len(updatedReaderKeys) > 0 {
		newReaderIndex = len(rkb.TLFEphemeralPublicKeys)
	}
	rServerHalves, err := rkb.Keys.fillInUserInfos(
		crypto, newReaderIndex, updatedReaderKeys,
		ePrivKey, tlfCryptKey)
	if err != nil {
		return nil, err
	}
	// If we didn't fill in any new reader infos, don't add a new
	// reader ephemeral key.
	if len(rServerHalves) > 0 {
		rkb.TLFEphemeralPublicKeys =
			append(rkb.TLFEphemeralPublicKeys, ePubKey)
	}

	return wServerHalves.mergeUsers(rServerHalves)
}

// AddKeyGeneration implements the MutableBareRootMetadata interface
// for BareRootMetadataV3.
func (md *BareRootMetadataV3) AddKeyGeneration(codec kbfscodec.Codec,
	crypto cryptoPure, currExtra ExtraMetadata,
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
			"updatedWriterKeys unexpectedly empty")
	}

	if nextCryptKey == (kbfscrypto.TLFCryptKey{}) {
		return nil, nil, errors.New("Zero next crypt key")
	}

	latestKeyGen := md.LatestKeyGeneration()
	var encryptedHistoricKeys EncryptedTLFCryptKeys
	if currCryptKey == (kbfscrypto.TLFCryptKey{}) {
		if latestKeyGen >= FirstValidKeyGen {
			return nil, nil, errors.Errorf(
				"Zero current crypt key with latest key generation %d",
				latestKeyGen)
		}
	} else {
		currExtraV3, ok := currExtra.(*ExtraMetadataV3)
		if !ok {
			return nil, nil, errors.New("Invalid curr extra metadata")
		}

		existingWriterKeys := currExtraV3.wkb.Keys.toPublicKeys()
		if !existingWriterKeys.Equals(updatedWriterKeys) {
			return nil, nil, fmt.Errorf(
				"existingWriterKeys=%+v != updatedWriterKeys=%+v",
				existingWriterKeys, updatedWriterKeys)
		}

		existingReaderKeys := currExtraV3.rkb.Keys.toPublicKeys()
		if !existingReaderKeys.Equals(updatedReaderKeys) {
			return nil, nil, fmt.Errorf(
				"existingReaderKeys=%+v != updatedReaderKeys=%+v",
				existingReaderKeys, updatedReaderKeys)
		}

		if latestKeyGen < FirstValidKeyGen {
			return nil, nil, errors.New(
				"Non-zero current crypt key with no existing key generations")
		}
		var historicKeys []kbfscrypto.TLFCryptKey
		if latestKeyGen > FirstValidKeyGen {
			var err error
			historicKeys, err = crypto.DecryptTLFCryptKeys(
				currExtraV3.wkb.EncryptedHistoricTLFCryptKeys,
				currCryptKey)
			if err != nil {
				return nil, nil, err
			}
			expectedHistoricKeyCount :=
				int(md.LatestKeyGeneration() - FirstValidKeyGen)
			if len(historicKeys) != expectedHistoricKeyCount {
				return nil, nil, errors.Errorf(
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
			return nil, nil, err
		}
	}

	newWriterKeys := TLFWriterKeyBundleV3{
		Keys:                          make(UserDeviceKeyInfoMapV3),
		TLFPublicKey:                  pubKey,
		EncryptedHistoricTLFCryptKeys: encryptedHistoricKeys,
	}
	newReaderKeys := TLFReaderKeyBundleV3{
		Keys: make(UserDeviceKeyInfoMapV3),
	}
	md.WriterMetadata.LatestKeyGen++
	nextExtra = NewExtraMetadataV3(newWriterKeys, newReaderKeys, true, true)

	serverHalves, err = md.updateKeyBundles(crypto, nextExtra,
		updatedWriterKeys, updatedReaderKeys,
		ePubKey, ePrivKey, nextCryptKey)
	if err != nil {
		return nil, nil, err
	}

	return nextExtra, serverHalves, nil
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
func (md *BareRootMetadataV3) SetWriters(writers []keybase1.UserOrTeamID) {
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

// GetUnresolvedParticipants implements the BareRootMetadata interface for BareRootMetadataV3.
func (md *BareRootMetadataV3) GetUnresolvedParticipants() []keybase1.SocialAssertion {
	writers := md.WriterMetadata.UnresolvedWriters
	readers := md.UnresolvedReaders
	users := make([]keybase1.SocialAssertion, 0, len(writers)+len(readers))
	users = append(users, writers...)
	users = append(users, readers...)
	return users
}

// UpdateKeyBundles implements the MutableBareRootMetadata interface
// for BareRootMetadataV3.
func (md *BareRootMetadataV3) UpdateKeyBundles(crypto cryptoPure,
	extra ExtraMetadata,
	updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKeys []kbfscrypto.TLFCryptKey) (
	[]UserDeviceKeyServerHalves, error) {
	if len(tlfCryptKeys) != 1 {
		return nil, fmt.Errorf(
			"(MDv3) Expected 1 TLF crypt key, got %d",
			len(tlfCryptKeys))
	}

	serverHalves, err := md.updateKeyBundles(crypto, extra,
		updatedWriterKeys, updatedReaderKeys,
		ePubKey, ePrivKey, tlfCryptKeys[0])
	if err != nil {
		return nil, err
	}

	return []UserDeviceKeyServerHalves{serverHalves}, nil
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

	extraV3.updateNew(newWKBID != oldWKBID, newRKBID != oldRKBID)

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
		return kbfscrypto.TLFCryptKey{}, errors.Errorf(
			"Invalid key generation %d", keyGen)
	}
	oldKeys, err := crypto.DecryptTLFCryptKeys(
		extraV3.wkb.EncryptedHistoricTLFCryptKeys, currentKey)
	if err != nil {
		return kbfscrypto.TLFCryptKey{}, err
	}
	index := int(keyGen - FirstValidKeyGen)
	if index >= len(oldKeys) || index < 0 {
		return kbfscrypto.TLFCryptKey{}, errors.Errorf(
			"Index %d out of range (max: %d)", index, len(oldKeys))
	}
	return oldKeys[index], nil
}
