// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

// PrivateMetadata contains the portion of metadata that's secret for private
// directories
type PrivateMetadata struct {
	// directory entry for the root directory block
	Dir DirEntry

	// m_f as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	TLFPrivateKey TLFPrivateKey
	// The block changes done as part of the update that created this MD
	Changes BlockChanges

	codec.UnknownFieldSetHandler

	// When the above Changes field gets unembedded into its own
	// block, we may want to temporarily keep around the old
	// BlockChanges for easy reference.
	cachedChanges BlockChanges
}

func (p PrivateMetadata) checkValid() error {
	for i, op := range p.Changes.Ops {
		err := op.checkValid()
		if err != nil {
			return fmt.Errorf("op[%d]=%v invalid: %v", i, op, err)
		}
	}
	return nil
}

// A RootMetadata is a BareRootMetadata but with a deserialized
// PrivateMetadata. However, note that it is possible that the
// PrivateMetadata has to be left serialized due to not having the
// right keys.
type RootMetadata struct {
	BareRootMetadata

	// The plaintext, deserialized PrivateMetadata
	//
	// TODO: This should really be a pointer so that it's more
	// clear when the data has been successfully deserialized.
	data PrivateMetadata

	// The TLF handle for this MD. May be nil if this object was
	// deserialized (more common on the server side).
	tlfHandle *TlfHandle
}

// Data returns the private metadata of this RootMetadata.
func (md *RootMetadata) Data() *PrivateMetadata {
	return &md.data
}

// IsReadable returns true if the private metadata can be read.
func (md *RootMetadata) IsReadable() bool {
	return md.ID.IsPublic() || md.data.Dir.IsInitialized()
}

func (md *RootMetadata) clearLastRevision() {
	md.ClearBlockChanges()
	// remove the copied flag (if any.)
	md.Flags &= ^MetadataFlagWriterMetadataCopied
}

func (md *RootMetadata) deepCopy(codec Codec, copyHandle bool) (*RootMetadata, error) {
	var newMd RootMetadata
	if err := md.deepCopyInPlace(codec, copyHandle, &newMd); err != nil {
		return nil, err
	}
	return &newMd, nil
}

func (md *RootMetadata) deepCopyInPlace(codec Codec, copyHandle bool,
	newMd *RootMetadata) error {
	if err := CodecUpdate(codec, newMd, md); err != nil {
		return err
	}
	if err := CodecUpdate(codec, &newMd.data, md.data); err != nil {
		return err
	}

	if copyHandle {
		newMd.tlfHandle = md.tlfHandle.deepCopy()
	}

	// No need to copy mdID.

	return nil
}

// MakeSuccessor returns a complete copy of this RootMetadata (but
// with cleared block change lists and cleared serialized metadata),
// with the revision incremented and a correct backpointer.
func (md *RootMetadata) MakeSuccessor(
	config Config, mdID MdID, isWriter bool) (*RootMetadata, error) {
	if mdID == (MdID{}) {
		return nil, errors.New("Empty MdID in MakeSuccessor")
	}
	if md.IsFinal() {
		return nil, MetadataIsFinalError{}
	}
	newMd, err := md.deepCopy(config.Codec(), true)
	if err != nil {
		return nil, err
	}

	if md.IsReadable() && isWriter {
		newMd.clearLastRevision()
		// clear the serialized data.
		newMd.SerializedPrivateMetadata = nil
	} else {
		// if we can't read it it means we're simply setting the rekey bit
		// and copying the previous data.
		newMd.Flags |= MetadataFlagRekey
		newMd.Flags |= MetadataFlagWriterMetadataCopied
	}

	newMd.PrevRoot = mdID
	// bump revision
	if md.Revision < MetadataRevisionInitial {
		return nil, errors.New("MD with invalid revision")
	}
	newMd.Revision = md.Revision + 1
	return newMd, nil
}

// AddNewKeys makes a new key generation for this RootMetadata using the
// given TLFKeyBundles.
func (md *RootMetadata) AddNewKeys(
	wkb TLFWriterKeyBundle, rkb TLFReaderKeyBundle) error {
	if md.ID.IsPublic() {
		return InvalidPublicTLFOperation{md.ID, "AddNewKeys"}
	}
	md.WKeys = append(md.WKeys, wkb)
	md.RKeys = append(md.RKeys, rkb)
	return nil
}

// GetTlfHandle returns the TlfHandle for this RootMetadata.
func (md *RootMetadata) GetTlfHandle() *TlfHandle {
	if md.tlfHandle == nil {
		panic(fmt.Sprintf("RootMetadata %v with no handle", md))
	}

	return md.tlfHandle
}

// MakeBareTlfHandle makes a BareTlfHandle for this
// RootMetadata. Should be used only by servers and MDOps.
func (md *RootMetadata) MakeBareTlfHandle() (BareTlfHandle, error) {
	if md.tlfHandle != nil {
		panic(errors.New("MakeBareTlfHandle called when md.tlfHandle exists"))
	}

	return md.BareRootMetadata.MakeBareTlfHandle()
}

// IsInitialized returns whether or not this RootMetadata has been initialized
func (md *RootMetadata) IsInitialized() bool {
	keyGen := md.LatestKeyGeneration()
	if md.ID.IsPublic() {
		return keyGen == PublicKeyGen
	}
	// The data is only initialized once we have at least one set of keys
	return keyGen >= FirstValidKeyGen
}

// AddRefBlock adds the newly-referenced block to the add block change list.
func (md *RootMetadata) AddRefBlock(info BlockInfo) {
	md.RefBytes += uint64(info.EncodedSize)
	md.DiskUsage += uint64(info.EncodedSize)
	md.data.Changes.AddRefBlock(info.BlockPointer)
}

// AddUnrefBlock adds the newly-unreferenced block to the add block change list.
func (md *RootMetadata) AddUnrefBlock(info BlockInfo) {
	if info.EncodedSize > 0 {
		md.UnrefBytes += uint64(info.EncodedSize)
		md.DiskUsage -= uint64(info.EncodedSize)
		md.data.Changes.AddUnrefBlock(info.BlockPointer)
	}
}

// AddUpdate adds the newly-updated block to the add block change list.
func (md *RootMetadata) AddUpdate(oldInfo BlockInfo, newInfo BlockInfo) {
	if oldInfo.EncodedSize > 0 {
		md.UnrefBytes += uint64(oldInfo.EncodedSize)
		md.RefBytes += uint64(newInfo.EncodedSize)
		md.DiskUsage += uint64(newInfo.EncodedSize)
		md.DiskUsage -= uint64(oldInfo.EncodedSize)
		md.data.Changes.AddUpdate(oldInfo.BlockPointer, newInfo.BlockPointer)
	}
}

// AddOp starts a new operation for this MD update.  Subsequent
// AddRefBlock, AddUnrefBlock, and AddUpdate calls will be applied to
// this operation.
func (md *RootMetadata) AddOp(o op) {
	md.data.Changes.AddOp(o)
}

// ClearBlockChanges resets the block change lists to empty for this
// RootMetadata.
func (md *RootMetadata) ClearBlockChanges() {
	md.RefBytes = 0
	md.UnrefBytes = 0
	md.data.Changes.sizeEstimate = 0
	md.data.Changes.Info = BlockInfo{}
	md.data.Changes.Ops = nil
}

// Helper which returns nil if the md block is uninitialized or readable by
// the current user. Otherwise an appropriate read access error is returned.
func (md *RootMetadata) isReadableOrError(ctx context.Context, config Config) error {
	if !md.IsInitialized() || md.IsReadable() {
		return nil
	}
	// this should only be the case if we're a new device not yet
	// added to the set of reader/writer keys.
	username, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}
	h := md.GetTlfHandle()
	resolvedHandle, err := h.ResolveAgain(ctx, config.KBPKI())
	if err != nil {
		return err
	}
	return md.makeRekeyReadError(resolvedHandle, md.LatestKeyGeneration(),
		uid, username)
}

func (md *RootMetadata) makeRekeyReadError(
	resolvedHandle *TlfHandle, keyGen KeyGen,
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
	if keys, _ := md.GetTLFCryptPublicKeys(keyGen, uid); len(keys) > 0 {
		return NeedSelfRekeyError{tlfName}
	}
	return NeedOtherRekeyError{tlfName}
}

// updateFromTlfHandle updates the current RootMetadata's fields to
// reflect the given handle, which must be the result of running the
// current handle with ResolveAgain().
func (md *RootMetadata) updateFromTlfHandle(newHandle *TlfHandle) error {
	// TODO: Strengthen check, e.g. make sure every writer/reader
	// in the old handle is also a writer/reader of the new
	// handle.
	if md.ID.IsPublic() != newHandle.IsPublic() {
		return fmt.Errorf(
			"Trying to update public=%t rmd with public=%t handle",
			md.ID.IsPublic(), newHandle.IsPublic())
	}

	if newHandle.IsPublic() {
		md.Writers = newHandle.ResolvedWriters()
	} else {
		md.UnresolvedReaders = newHandle.UnresolvedReaders()
	}

	md.Extra.UnresolvedWriters = newHandle.UnresolvedWriters()
	md.ConflictInfo = newHandle.ConflictInfo()
	md.FinalizedInfo = newHandle.FinalizedInfo()

	bareHandle, err := md.makeBareTlfHandle()
	if err != nil {
		return err
	}

	newBareHandle, err := newHandle.ToBareHandle()
	if err != nil {
		return err
	}
	if !reflect.DeepEqual(bareHandle, newBareHandle) {
		return fmt.Errorf(
			"bareHandle=%+v != newBareHandle=%+v",
			bareHandle, newBareHandle)
	}

	md.tlfHandle = newHandle
	return nil
}

// swapCachedBlockChanges swaps any cached block changes so that
// future local accesses to this MD (from the cache) can directly
// access the ops without needing to re-embed the block changes.
func (md *RootMetadata) swapCachedBlockChanges() {
	if md.data.Changes.Ops == nil {
		md.data.Changes, md.data.cachedChanges =
			md.data.cachedChanges, md.data.Changes
		md.data.Changes.Ops[0].
			AddRefBlock(md.data.cachedChanges.Info.BlockPointer)
	}
}

// A ReadOnlyRootMetadata is a thin wrapper around a
// *RootMetadata. Functions that take a ReadOnlyRootMetadata parameter
// must not modify it, and therefore code that passes a
// ReadOnlyRootMetadata to a function can assume that it is not
// modified by that function. However, callers that convert a
// *RootMetadata to a ReadOnlyRootMetadata may still modify the
// underlying RootMetadata through the original pointer, so care must
// be taken if a function stores a ReadOnlyRootMetadata object past
// the end of the function, or when a function takes both a
// *RootMetadata and a ReadOnlyRootMetadata (see
// decryptMDPrivateData).
type ReadOnlyRootMetadata struct {
	*RootMetadata
}

// CheckValidSuccessor makes sure the given ReadOnlyRootMetadata is a
// valid successor to the current one, and returns an error otherwise.
func (md ReadOnlyRootMetadata) CheckValidSuccessor(
	currID MdID, nextMd ReadOnlyRootMetadata) error {
	return md.BareRootMetadata.CheckValidSuccessor(
		currID, &nextMd.BareRootMetadata)
}

// ReadOnly makes a ReadOnlyRootMetadata from the current
// *RootMetadata.
func (md *RootMetadata) ReadOnly() ReadOnlyRootMetadata {
	return ReadOnlyRootMetadata{md}
}

// ImmutableRootMetadata is a thin wrapper around a
// ReadOnlyRootMetadata that takes ownership of it and does not ever
// modify it again. Thus, its MdID can be calculated and
// stored. Unlike ReadOnlyRootMetadata, ImmutableRootMetadata objects
// can be assumed to never alias a (modifiable) *RootMetadata.
type ImmutableRootMetadata struct {
	ReadOnlyRootMetadata
	mdID MdID
}

// MakeImmutableRootMetadata makes a new ImmutableRootMetadata from
// the given RMD and its corresponding MdID.
func MakeImmutableRootMetadata(
	rmd *RootMetadata, mdID MdID) ImmutableRootMetadata {
	if mdID == (MdID{}) {
		panic("zero mdID passed to MakeImmutableRootMetadata")
	}
	return ImmutableRootMetadata{rmd.ReadOnly(), mdID}
}

// RootMetadataSigned is the top-level MD object stored in MD server
type RootMetadataSigned struct {
	// signature over the root metadata by the private signing key
	SigInfo SignatureInfo `codec:",omitempty"`
	// all the metadata
	MD BareRootMetadata
	// When does the server say this MD update was received?  (This is
	// not necessarily trustworthy, just for informational purposes.)
	untrustedServerTimestamp time.Time
}

// IsInitialized returns whether or not this RootMetadataSigned object
// has been finalized by some writer.
func (rmds *RootMetadataSigned) IsInitialized() bool {
	// The data is initialized only if there is a signature.
	return !rmds.SigInfo.IsNil()
}

// VerifyRootMetadata verifies rmd's MD against rmd's SigInfo,
// assuming the verifying key there is valid.
func (rmds *RootMetadataSigned) VerifyRootMetadata(
	codec Codec, crypto cryptoPure) error {
	md := &rmds.MD
	if rmds.MD.IsFinal() {
		// Since we're just working with the immediate fields
		// of RootMetadata, we can get away with a shallow
		// copy here.
		mdCopy := rmds.MD

		// Mask out finalized additions.  These are the only
		// things allowed to change in the finalized metadata
		// block.
		mdCopy.Flags &= ^MetadataFlagFinal
		mdCopy.Revision--
		mdCopy.FinalizedInfo = nil
		md = &mdCopy
	}
	// Re-marshal the whole RootMetadata. This is not avoidable
	// without support from ugorji/codec.
	buf, err := codec.Encode(md)
	if err != nil {
		return err
	}

	err = crypto.Verify(buf, rmds.SigInfo)
	if err != nil {
		return err
	}

	return nil
}

// MerkleHash computes a hash of this RootMetadataSigned object for inclusion
// into the KBFS Merkle tree.
func (rmds *RootMetadataSigned) MerkleHash(config Config) (MerkleHash, error) {
	return config.Crypto().MakeMerkleHash(rmds)
}

// Version returns the metadata version of this MD block, depending on
// which features it uses.
func (rmds *RootMetadataSigned) Version() MetadataVer {
	// Only folders with unresolved assertions orconflict info get the
	// new version.
	if len(rmds.MD.Extra.UnresolvedWriters) > 0 ||
		len(rmds.MD.UnresolvedReaders) > 0 ||
		rmds.MD.ConflictInfo != nil ||
		rmds.MD.FinalizedInfo != nil {
		return InitialExtraMetadataVer
	}
	// Let other types of MD objects use the older version since they
	// are still compatible with older clients.
	return PreExtraMetadataVer
}

// MakeFinalCopy returns a complete copy of this RootMetadataSigned (but with
// cleared serialized metadata), with the revision incremented and the final bit set.
func (rmds *RootMetadataSigned) MakeFinalCopy(config Config) (
	*RootMetadataSigned, error) {
	if rmds.MD.IsFinal() {
		return nil, MetadataIsFinalError{}
	}
	var newRmds RootMetadataSigned
	err := rmds.MD.deepCopyInPlace(config.Codec(), &newRmds.MD)
	if err != nil {
		return nil, err
	}
	// Copy the signature.
	newRmds.SigInfo = rmds.SigInfo.deepCopy()
	// Set the final flag.
	newRmds.MD.Flags |= MetadataFlagFinal
	// Increment revision but keep the PrevRoot --
	// We want the client to be able to verify the signature by masking out the final
	// bit, decrementing the revision, and nulling out the finalized extension info.
	// This way it can easily tell a server didn't modify anything unexpected when
	// creating the final metadata block. Note that PrevRoot isn't being updated. This
	// is to make verification easier for the client as otherwise it'd need to request
	// the head revision - 1.
	newRmds.MD.Revision = rmds.MD.Revision + 1
	return &newRmds, nil
}

// IsValidAndSigned verifies the RootMetadataSigned given the current
// user and device, checks the writer signature, and returns an error
// if a problem was found.
func (rmds *RootMetadataSigned) IsValidAndSigned(
	codec Codec, crypto cryptoPure,
	currentUID keybase1.UID, currentVerifyingKey VerifyingKey) error {
	err := rmds.MD.IsValidAndSigned(
		codec, crypto, currentUID, currentVerifyingKey)
	if err != nil {
		return err
	}

	if rmds.SigInfo.VerifyingKey != currentVerifyingKey {
		return errors.New("Last modifier verifying key and current verifying key mismatch")
	}

	err = rmds.VerifyRootMetadata(codec, crypto)
	if err != nil {
		return fmt.Errorf("Could not verify root metadata: %v", err)
	}

	return nil
}
