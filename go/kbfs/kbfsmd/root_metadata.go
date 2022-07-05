// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"context"
	"fmt"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

// RootMetadata is a read-only interface to the bare serializeable MD that
// is signed by the reader or writer.
type RootMetadata interface {
	// TlfID returns the ID of the TLF this RootMetadata is for.
	TlfID() tlf.ID
	// TypeForKeying returns the keying type for this RootMetadata.
	TypeForKeying() tlf.KeyingType
	// KeyGenerationsToUpdate returns a range that has to be
	// updated when rekeying. start is included, but end is not
	// included. This range can be empty (i.e., start >= end), in
	// which case there's nothing to update, i.e. the TLF is
	// public, or there aren't any existing key generations.
	KeyGenerationsToUpdate() (start KeyGen, end KeyGen)
	// LatestKeyGeneration returns the most recent key generation in this
	// RootMetadata, or PublicKeyGen if this TLF is public.
	LatestKeyGeneration() KeyGen
	// IsValidRekeyRequest returns true if the current block is a simple rekey wrt
	// the passed block.
	IsValidRekeyRequest(codec kbfscodec.Codec, prevMd RootMetadata,
		user keybase1.UID, prevExtra, extra ExtraMetadata) (bool, error)
	// MergedStatus returns the status of this update -- has it been
	// merged into the main folder or not?
	MergedStatus() MergeStatus
	// IsRekeySet returns true if the rekey bit is set.
	IsRekeySet() bool
	// IsWriterMetadataCopiedSet returns true if the bit is set indicating
	// the writer metadata was copied.
	IsWriterMetadataCopiedSet() bool
	// IsFinal returns true if this is the last metadata block for a given
	// folder.  This is only expected to be set for folder resets.
	IsFinal() bool
	// IsWriter returns whether or not the user+device is an authorized writer.
	IsWriter(ctx context.Context, user keybase1.UID,
		cryptKey kbfscrypto.CryptPublicKey,
		verifyingKey kbfscrypto.VerifyingKey,
		teamMemChecker TeamMembershipChecker, extra ExtraMetadata,
		offline keybase1.OfflineAvailability) (bool, error)
	// IsReader returns whether or not the user+device is an authorized reader.
	IsReader(ctx context.Context, user keybase1.UID,
		cryptKey kbfscrypto.CryptPublicKey,
		teamMemChecker TeamMembershipChecker, extra ExtraMetadata,
		offline keybase1.OfflineAvailability) (bool, error)
	// DeepCopy returns a deep copy of the underlying data structure.
	DeepCopy(codec kbfscodec.Codec) (MutableRootMetadata, error)
	// MakeSuccessorCopy returns a newly constructed successor
	// copy to this metadata revision.  It differs from DeepCopy
	// in that it can perform an up conversion to a new metadata
	// version. tlfCryptKeyGetter should be a function that
	// returns a list of TLFCryptKeys for all key generations in
	// ascending order.
	MakeSuccessorCopy(codec kbfscodec.Codec,
		extra ExtraMetadata, latestMDVer MetadataVer,
		tlfCryptKeyGetter func() ([]kbfscrypto.TLFCryptKey, error),
		isReadableAndWriter bool) (mdCopy MutableRootMetadata,
		extraCopy ExtraMetadata, err error)
	// CheckValidSuccessor makes sure the given RootMetadata is a valid
	// successor to the current one, and returns an error otherwise.
	CheckValidSuccessor(currID ID, nextMd RootMetadata) error
	// CheckValidSuccessorForServer is like CheckValidSuccessor but with
	// server-specific error messages.
	CheckValidSuccessorForServer(currID ID, nextMd RootMetadata) error
	// MakeBareTlfHandle makes a tlf.Handle for this
	// RootMetadata. Should be used only by servers and MDOps.
	MakeBareTlfHandle(extra ExtraMetadata) (tlf.Handle, error)
	// TlfHandleExtensions returns a list of handle extensions associated with the TLf.
	TlfHandleExtensions() (extensions []tlf.HandleExtension)
	// GetDevicePublicKeys returns the kbfscrypto.CryptPublicKeys
	// for all known users and devices. Returns an error if the
	// TLF is public.
	GetUserDevicePublicKeys(extra ExtraMetadata) (
		writers, readers UserDevicePublicKeys, err error)
	// GetTLFCryptKeyParams returns all the necessary info to construct
	// the TLF crypt key for the given key generation, user, and device
	// (identified by its crypt public key), or false if not found. This
	// returns an error if the TLF is public.
	GetTLFCryptKeyParams(keyGen KeyGen, user keybase1.UID,
		key kbfscrypto.CryptPublicKey, extra ExtraMetadata) (
		kbfscrypto.TLFEphemeralPublicKey,
		kbfscrypto.EncryptedTLFCryptKeyClientHalf,
		kbfscrypto.TLFCryptKeyServerHalfID, bool, error)
	// IsValidAndSigned verifies the RootMetadata, checks the
	// writer signature, and returns an error if a problem was
	// found. This should be the first thing checked on a BRMD
	// retrieved from an untrusted source, and then the signing
	// user and key should be validated, either by comparing to
	// the current device key (using IsLastModifiedBy), or by
	// checking with KBPKI.
	IsValidAndSigned(ctx context.Context, codec kbfscodec.Codec,
		teamMemChecker TeamMembershipChecker,
		extra ExtraMetadata, writerVerifyingKey kbfscrypto.VerifyingKey,
		offline keybase1.OfflineAvailability) error
	// IsLastModifiedBy verifies that the RootMetadata is
	// written by the given user and device (identified by the
	// device verifying key), and returns an error if not.
	IsLastModifiedBy(uid keybase1.UID, key kbfscrypto.VerifyingKey) error
	// LastModifyingWriter return the UID of the last user to modify the writer metadata.
	LastModifyingWriter() keybase1.UID
	// LastModifyingUser return the UID of the last user to modify the any of the metadata.
	GetLastModifyingUser() keybase1.UID
	// RefBytes returns the number of newly referenced bytes of data blocks introduced by this revision of metadata.
	RefBytes() uint64
	// UnrefBytes returns the number of newly unreferenced bytes introduced by this revision of metadata.
	UnrefBytes() uint64
	// MDRefBytes returns the number of newly referenced bytes of MD blocks introduced by this revision of metadata.
	MDRefBytes() uint64
	// DiskUsage returns the estimated disk usage for the folder as of this revision of metadata.
	DiskUsage() uint64
	// MDDiskUsage returns the estimated MD disk usage for the folder as of this revision of metadata.
	MDDiskUsage() uint64
	// RevisionNumber returns the revision number associated with this metadata structure.
	RevisionNumber() Revision
	// BID returns the per-device branch ID associated with this metadata revision.
	BID() BranchID
	// GetPrevRoot returns the hash of the previous metadata revision.
	GetPrevRoot() ID
	// IsUnmergedSet returns true if the unmerged bit is set.
	IsUnmergedSet() bool
	// GetSerializedPrivateMetadata returns the serialized private metadata as a byte slice.
	GetSerializedPrivateMetadata() []byte
	// GetSerializedWriterMetadata serializes the underlying writer metadata and returns the result.
	GetSerializedWriterMetadata(codec kbfscodec.Codec) ([]byte, error)
	// Version returns the metadata version.
	Version() MetadataVer
	// GetCurrentTLFPublicKey returns the TLF public key for the
	// current key generation.
	GetCurrentTLFPublicKey(ExtraMetadata) (kbfscrypto.TLFPublicKey, error)
	// GetUnresolvedParticipants returns any unresolved readers
	// and writers present in this revision of metadata. The
	// returned array should be safe to modify by the caller.
	GetUnresolvedParticipants() []keybase1.SocialAssertion
	// GetTLFWriterKeyBundleID returns the ID of the externally-stored writer key bundle, or the zero value if
	// this object stores it internally.
	GetTLFWriterKeyBundleID() TLFWriterKeyBundleID
	// GetTLFReaderKeyBundleID returns the ID of the externally-stored reader key bundle, or the zero value if
	// this object stores it internally.
	GetTLFReaderKeyBundleID() TLFReaderKeyBundleID
	// StoresHistoricTLFCryptKeys returns whether or not history keys are symmetrically encrypted; if not, they're
	// encrypted per-device.
	StoresHistoricTLFCryptKeys() bool
	// GetHistoricTLFCryptKey attempts to symmetrically decrypt the key at the given
	// generation using the current generation's TLFCryptKey.
	GetHistoricTLFCryptKey(codec kbfscodec.Codec, keyGen KeyGen,
		currentKey kbfscrypto.TLFCryptKey, extra ExtraMetadata) (
		kbfscrypto.TLFCryptKey, error)
}

// MutableRootMetadata is a mutable interface to the bare serializeable MD that is signed by the reader or writer.
type MutableRootMetadata interface {
	RootMetadata

	// SetRefBytes sets the number of newly referenced bytes of data blocks introduced by this revision of metadata.
	SetRefBytes(refBytes uint64)
	// SetUnrefBytes sets the number of newly unreferenced bytes introduced by this revision of metadata.
	SetUnrefBytes(unrefBytes uint64)
	// SetMDRefBytes sets the number of newly referenced bytes of MD blocks introduced by this revision of metadata.
	SetMDRefBytes(mdRefBytes uint64)
	// SetDiskUsage sets the estimated disk usage for the folder as of this revision of metadata.
	SetDiskUsage(diskUsage uint64)
	// SetMDDiskUsage sets the estimated MD disk usage for the folder as of this revision of metadata.
	SetMDDiskUsage(mdDiskUsage uint64)
	// AddRefBytes increments the number of newly referenced bytes of data blocks introduced by this revision of metadata.
	AddRefBytes(refBytes uint64)
	// AddUnrefBytes increments the number of newly unreferenced bytes introduced by this revision of metadata.
	AddUnrefBytes(unrefBytes uint64)
	// AddMDRefBytes increments the number of newly referenced bytes of MD blocks introduced by this revision of metadata.
	AddMDRefBytes(mdRefBytes uint64)
	// AddDiskUsage increments the estimated disk usage for the folder as of this revision of metadata.
	AddDiskUsage(diskUsage uint64)
	// AddMDDiskUsage increments the estimated MD disk usage for the folder as of this revision of metadata.
	AddMDDiskUsage(mdDiskUsage uint64)
	// ClearRekeyBit unsets any set rekey bit.
	ClearRekeyBit()
	// ClearWriterMetadataCopiedBit unsets any set writer metadata copied bit.
	ClearWriterMetadataCopiedBit()
	// ClearFinalBit unsets any final bit.
	ClearFinalBit()
	// SetUnmerged sets the unmerged bit.
	SetUnmerged()
	// SetBranchID sets the branch ID for this metadata revision.
	SetBranchID(bid BranchID)
	// SetPrevRoot sets the hash of the previous metadata revision.
	SetPrevRoot(mdID ID)
	// SetSerializedPrivateMetadata sets the serialized private metadata.
	SetSerializedPrivateMetadata(spmd []byte)
	// SignWriterMetadataInternally signs the writer metadata, for
	// versions that store this signature inside the metadata.
	SignWriterMetadataInternally(ctx context.Context,
		codec kbfscodec.Codec, signer kbfscrypto.Signer) error
	// SetLastModifyingWriter sets the UID of the last user to modify the writer metadata.
	SetLastModifyingWriter(user keybase1.UID)
	// SetLastModifyingUser sets the UID of the last user to modify any of the metadata.
	SetLastModifyingUser(user keybase1.UID)
	// SetRekeyBit sets the rekey bit.
	SetRekeyBit()
	// SetFinalBit sets the finalized bit.
	SetFinalBit()
	// SetWriterMetadataCopiedBit set the writer metadata copied bit.
	SetWriterMetadataCopiedBit()
	// SetRevision sets the revision number of the underlying metadata.
	SetRevision(revision Revision)
	// SetUnresolvedReaders sets the list of unresolved readers associated with this folder.
	SetUnresolvedReaders(readers []keybase1.SocialAssertion)
	// SetUnresolvedWriters sets the list of unresolved writers associated with this folder.
	SetUnresolvedWriters(writers []keybase1.SocialAssertion)
	// SetConflictInfo sets any conflict info associated with this metadata revision.
	SetConflictInfo(ci *tlf.HandleExtension)
	// SetFinalizedInfo sets any finalized info associated with this metadata revision.
	SetFinalizedInfo(fi *tlf.HandleExtension)
	// SetWriters sets the list of writers associated with this folder.
	SetWriters(writers []keybase1.UserOrTeamID)
	// ClearForV4Migration clears out data not needed for an upgrade
	// to an implicit-team-backed TLF.  Note that `SetWriters` should
	// also be called separately to set the new team ID as a writer.
	ClearForV4Migration()
	// SetTlfID sets the ID of the underlying folder in the metadata structure.
	SetTlfID(tlf tlf.ID)

	// AddKeyGeneration adds a new key generation to this revision
	// of metadata. If StoresHistoricTLFCryptKeys is false, then
	// currCryptKey must be zero. Otherwise, currCryptKey must be
	// zero if there are no existing key generations, and non-zero
	// for otherwise.
	//
	// AddKeyGeneration must only be called on metadata for
	// private TLFs.
	//
	// Note that the TLFPrivateKey corresponding to privKey must
	// also be stored in PrivateMetadata.
	AddKeyGeneration(codec kbfscodec.Codec, currExtra ExtraMetadata,
		updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
		ePubKey kbfscrypto.TLFEphemeralPublicKey,
		ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
		pubKey kbfscrypto.TLFPublicKey,
		currCryptKey, nextCryptKey kbfscrypto.TLFCryptKey) (
		nextExtra ExtraMetadata,
		serverHalves UserDeviceKeyServerHalves, err error)

	// SetLatestKeyGenerationForTeamTLF sets the latest key generation
	// number of a team TLF.  It is not valid to call this for
	// anything but a team TLF.
	SetLatestKeyGenerationForTeamTLF(keyGen KeyGen)

	// UpdateKeyBundles ensures that every device for every writer
	// and reader in the provided lists has complete TLF crypt key
	// info, and uses the new ephemeral key pair to generate the
	// info if it doesn't yet exist. tlfCryptKeys must contain an
	// entry for each key generation in KeyGenerationsToUpdate(),
	// in ascending order.
	//
	// updatedWriterKeys and updatedReaderKeys usually contains
	// the full maps of writers to per-device crypt public keys,
	// but for reader rekey, updatedWriterKeys will be empty and
	// updatedReaderKeys will contain only a single entry.
	//
	// UpdateKeyBundles must only be called on metadata for
	// private TLFs.
	//
	// An array of server halves to push to the server are
	// returned, with each entry corresponding to each key
	// generation in KeyGenerationsToUpdate(), in ascending order.
	UpdateKeyBundles(codec kbfscodec.Codec, extra ExtraMetadata,
		updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
		ePubKey kbfscrypto.TLFEphemeralPublicKey,
		ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
		tlfCryptKeys []kbfscrypto.TLFCryptKey) (
		[]UserDeviceKeyServerHalves, error)

	// PromoteReaders converts the given set of users (which may
	// be empty) from readers to writers.
	PromoteReaders(readersToPromote map[keybase1.UID]bool,
		extra ExtraMetadata) error

	// RevokeRemovedDevices removes key info for any device not in
	// the given maps, and returns a corresponding map of server
	// halves to delete from the server.
	//
	// Note: the returned server halves may not be for all key
	// generations, e.g. for MDv3 it's only for the latest key
	// generation.
	RevokeRemovedDevices(
		updatedWriterKeys, updatedReaderKeys UserDevicePublicKeys,
		extra ExtraMetadata) (ServerHalfRemovalInfo, error)

	// FinalizeRekey must be called called after all rekeying work
	// has been performed on the underlying metadata.
	FinalizeRekey(codec kbfscodec.Codec, extra ExtraMetadata) error
}

// TODO: Wrap errors coming from RootMetadata.

// MakeInitialRootMetadata creates a new MutableRootMetadata
// instance of the given MetadataVer with revision
// RevisionInitial, and the given TLF ID and handle. Note that
// if the given ID/handle are private, rekeying must be done
// separately.
func MakeInitialRootMetadata(
	ver MetadataVer, tlfID tlf.ID, h tlf.Handle) (
	MutableRootMetadata, error) {
	if ver < FirstValidMetadataVer {
		return nil, InvalidMetadataVersionError{tlfID, ver}
	}
	if ver > ImplicitTeamsVer {
		// Shouldn't be possible at the moment.
		panic("Invalid metadata version")
	}
	if ver < ImplicitTeamsVer && tlfID.Type() != tlf.SingleTeam &&
		h.TypeForKeying() == tlf.TeamKeying {
		return nil, NewMetadataVersionError{tlfID, ImplicitTeamsVer}
	}

	if ver < SegregatedKeyBundlesVer {
		return MakeInitialRootMetadataV2(tlfID, h)
	}

	// V3 and V4 MDs are data-compatible.
	return MakeInitialRootMetadataV3(tlfID, h)
}

func makeMutableRootMetadataForDecode(codec kbfscodec.Codec, tlf tlf.ID,
	ver, max MetadataVer, buf []byte) (MutableRootMetadata, error) {
	if ver < FirstValidMetadataVer {
		return nil, InvalidMetadataVersionError{TlfID: tlf, MetadataVer: ver}
	} else if ver > max {
		return nil, NewMetadataVersionError{tlf, ver}
	}
	if ver > ImplicitTeamsVer {
		// Shouldn't be possible at the moment.
		panic("Invalid metadata version")
	}
	if ver < SegregatedKeyBundlesVer {
		return &RootMetadataV2{}, nil
	}
	return &RootMetadataV3{}, nil
}

// DecodeRootMetadata deserializes a metadata block into the specified
// versioned structure.
func DecodeRootMetadata(codec kbfscodec.Codec, tlfID tlf.ID,
	ver, max MetadataVer, buf []byte) (MutableRootMetadata, error) {
	rmd, err := makeMutableRootMetadataForDecode(codec, tlfID, ver, max, buf)
	if err != nil {
		return nil, err
	}
	if err := codec.Decode(buf, rmd); err != nil {
		return nil, err
	}
	if ver < ImplicitTeamsVer && tlfID.Type() != tlf.SingleTeam &&
		rmd.TypeForKeying() == tlf.TeamKeying {
		return nil, errors.Errorf(
			"Can't make an implicit teams TLF with version %s", ver)
	}
	return rmd, nil
}

// DumpConfig returns the *spew.ConfigState used by DumpRootMetadata
// and related functions.
func DumpConfig() *spew.ConfigState {
	c := spew.NewDefaultConfig()
	c.Indent = "  "
	c.DisablePointerAddresses = true
	c.DisableCapacities = true
	c.SortKeys = true
	return c
}

// DumpRootMetadata returns a detailed dump of the given
// RootMetadata's contents.
func DumpRootMetadata(
	codec kbfscodec.Codec, rmd RootMetadata) (string, error) {
	serializedRMD, err := codec.Encode(rmd)
	if err != nil {
		return "", err
	}

	// Make a copy so we can zero out SerializedPrivateMetadata.
	rmdCopy, err := rmd.DeepCopy(codec)
	if err != nil {
		return "", err
	}

	rmdCopy.SetSerializedPrivateMetadata(nil)
	s := fmt.Sprintf("MD revision: %s\n"+
		"MD size: %d bytes\n"+
		"Private MD size: %d bytes\n"+
		"MD version: %s\n\n",
		rmd.RevisionNumber(),
		len(serializedRMD),
		len(rmd.GetSerializedPrivateMetadata()),
		rmd.Version())
	s += DumpConfig().Sdump(rmdCopy)
	return s, nil
}
