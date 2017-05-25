// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// MetadataFlags bitfield.
type MetadataFlags byte

// Possible flags set in the MetadataFlags bitfield.
const (
	MetadataFlagRekey MetadataFlags = 1 << iota
	MetadataFlagWriterMetadataCopied
	MetadataFlagFinal
)

// WriterFlags bitfield.
type WriterFlags byte

// Possible flags set in the WriterFlags bitfield.
const (
	MetadataFlagUnmerged WriterFlags = 1 << iota
)

// PrivateMetadata contains the portion of metadata that's secret for private
// directories
type PrivateMetadata struct {
	// directory entry for the root directory block
	Dir DirEntry

	// m_f as described in § 4.1.1 of https://keybase.io/docs/crypto/kbfs.
	TLFPrivateKey kbfscrypto.TLFPrivateKey
	// The block changes done as part of the update that created this MD
	Changes BlockChanges

	// The last revision up to and including which garbage collection
	// was performed on this TLF.
	LastGCRevision kbfsmd.Revision `codec:"lgc"`

	codec.UnknownFieldSetHandler

	// When the above Changes field gets unembedded into its own
	// block, we may want to temporarily keep around the old
	// BlockChanges for easy reference.
	cachedChanges BlockChanges
}

// DumpPrivateMetadata returns a detailed dump of the given
// PrivateMetadata's contents.
func DumpPrivateMetadata(
	codec kbfscodec.Codec, pmd PrivateMetadata) (string, error) {
	serializedPMD, err := codec.Encode(pmd)
	if err != nil {
		return "", err
	}

	s := fmt.Sprintf("Size: %d bytes\n", len(serializedPMD))
	s += dumpConfig().Sdump(pmd)
	return s, nil
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

// ChangesBlockInfo returns the block info for any unembedded changes.
func (p PrivateMetadata) ChangesBlockInfo() BlockInfo {
	return p.cachedChanges.Info
}

// ExtraMetadata is a per-version blob of extra metadata which may
// exist outside of the given metadata block, e.g. key bundles for
// post-v2 metadata.
type ExtraMetadata interface {
	MetadataVersion() MetadataVer
	DeepCopy(kbfscodec.Codec) (ExtraMetadata, error)
	MakeSuccessorCopy(kbfscodec.Codec) (ExtraMetadata, error)
}

// DumpExtraMetadata returns a detailed dump of the given
// ExtraMetadata's contents.
func DumpExtraMetadata(
	codec kbfscodec.Codec, extra ExtraMetadata) (string, error) {
	var s string
	switch extra := extra.(type) {
	case *ExtraMetadataV3:
		serializedWKB, err := codec.Encode(extra.GetWriterKeyBundle())
		if err != nil {
			return "", err
		}
		serializedRKB, err := codec.Encode(extra.GetReaderKeyBundle())
		if err != nil {
			return "", err
		}
		s = fmt.Sprintf("WKB size: %d\nRKB size: %d\n",
			len(serializedWKB), len(serializedRKB))
	}

	s += dumpConfig().Sdump(extra)
	return s, nil
}

// A RootMetadata is a BareRootMetadata but with a deserialized
// PrivateMetadata. However, note that it is possible that the
// PrivateMetadata has to be left serialized due to not having the
// right keys.
type RootMetadata struct {
	bareMd MutableBareRootMetadata

	// ExtraMetadata currently contains key bundles for post-v2
	// metadata.
	extra ExtraMetadata

	// The plaintext, deserialized PrivateMetadata
	//
	// TODO: This should really be a pointer so that it's more
	// clear when the data has been successfully deserialized.
	data PrivateMetadata

	// The TLF handle for this MD. May be nil if this object was
	// deserialized (more common on the server side).
	tlfHandle *TlfHandle
}

var _ KeyMetadata = (*RootMetadata)(nil)

// makeRootMetadata makes a RootMetadata object from the given
// parameters.
func makeRootMetadata(bareMd MutableBareRootMetadata,
	extra ExtraMetadata, handle *TlfHandle) *RootMetadata {
	if bareMd == nil {
		panic("nil MutableBareRootMetadata")
	}
	// extra can be nil.
	if handle == nil {
		panic("nil handle")
	}
	return &RootMetadata{
		bareMd:    bareMd,
		extra:     extra,
		tlfHandle: handle,
	}
}

// makeInitialRootMetadata creates a new RootMetadata with the given
// MetadataVer, revision RevisionInitial, and the given TLF ID
// and handle. Note that if the given ID/handle are private, rekeying
// must be done separately.
func makeInitialRootMetadata(
	ver MetadataVer, tlfID tlf.ID, h *TlfHandle) (*RootMetadata, error) {
	bh, err := h.ToBareHandle()
	if err != nil {
		return nil, err
	}

	bareMD, err := MakeInitialBareRootMetadata(ver, tlfID, bh)
	if err != nil {
		return nil, err
	}
	// Need to keep the TLF handle around long enough to rekey the
	// metadata for the first time.
	return makeRootMetadata(bareMD, nil, h), nil
}

// Data returns the private metadata of this RootMetadata.
func (md *RootMetadata) Data() *PrivateMetadata {
	return &md.data
}

// Extra returns the extra metadata of this RootMetadata.
func (md *RootMetadata) Extra() ExtraMetadata {
	return md.extra
}

// IsReadable returns true if the private metadata can be read.
func (md *RootMetadata) IsReadable() bool {
	return md.TlfID().Type() == tlf.Public || md.data.Dir.IsInitialized()
}

func (md *RootMetadata) clearLastRevision() {
	md.ClearBlockChanges()
	// remove the copied flag (if any.)
	md.clearWriterMetadataCopiedBit()
}

func (md *RootMetadata) deepCopy(codec kbfscodec.Codec) (*RootMetadata, error) {
	brmdCopy, err := md.bareMd.DeepCopy(codec)
	if err != nil {
		return nil, err
	}

	var extraCopy ExtraMetadata
	if md.extra != nil {
		extraCopy, err = md.extra.DeepCopy(codec)
		if err != nil {
			return nil, err
		}
	}

	handleCopy := md.tlfHandle.deepCopy()

	rmd := makeRootMetadata(brmdCopy, extraCopy, handleCopy)

	err = kbfscodec.Update(codec, &rmd.data, md.data)
	if err != nil {
		return nil, err
	}
	err = kbfscodec.Update(
		codec, &rmd.data.cachedChanges, md.data.cachedChanges)
	if err != nil {
		return nil, err
	}

	return rmd, nil
}

// MakeSuccessor returns a complete copy of this RootMetadata (but
// with cleared block change lists and cleared serialized metadata),
// with the revision incremented and a correct backpointer.
func (md *RootMetadata) MakeSuccessor(
	ctx context.Context, latestMDVer MetadataVer, codec kbfscodec.Codec,
	crypto cryptoPure, keyManager KeyManager, merkleGetter merkleSeqNoGetter,
	mdID kbfsmd.ID, isWriter bool) (*RootMetadata, error) {
	if mdID == (kbfsmd.ID{}) {
		return nil, errors.New("Empty MdID in MakeSuccessor")
	}
	if md.IsFinal() {
		return nil, MetadataIsFinalError{}
	}

	isReadableAndWriter := md.IsReadable() && isWriter

	brmdCopy, extraCopy, err := md.bareMd.MakeSuccessorCopy(
		codec, crypto, md.extra, latestMDVer,
		func() ([]kbfscrypto.TLFCryptKey, error) {
			return keyManager.GetTLFCryptKeyOfAllGenerations(ctx, md)
		}, isReadableAndWriter)
	if err != nil {
		return nil, err
	}

	handleCopy := md.tlfHandle.deepCopy()

	newMd := makeRootMetadata(brmdCopy, extraCopy, handleCopy)
	if err := kbfscodec.Update(codec, &newMd.data, md.data); err != nil {
		return nil, err
	}

	if isReadableAndWriter {
		newMd.clearLastRevision()
		// clear the serialized data.
		newMd.SetSerializedPrivateMetadata(nil)
	} else {
		// if we can't read it it means we're simply setting the rekey bit
		// and copying the previous data.
		newMd.SetRekeyBit()
		newMd.SetWriterMetadataCopiedBit()
	}

	newMd.SetPrevRoot(mdID)
	// bump revision
	if md.Revision() < kbfsmd.RevisionInitial {
		return nil, errors.New("MD with invalid revision")
	}
	newMd.SetRevision(md.Revision() + 1)

	merkleSeqNo, err := merkleGetter.GetCurrentMerkleSeqNo(ctx)
	if err != nil {
		return nil, err
	}
	newMd.SetMerkleSeqNo(merkleSeqNo)

	return newMd, nil
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
func (md *RootMetadata) MakeBareTlfHandle() (tlf.Handle, error) {
	if md.tlfHandle != nil {
		panic(errors.New("MakeBareTlfHandle called when md.tlfHandle exists"))
	}

	return md.bareMd.MakeBareTlfHandle(md.extra)
}

// IsInitialized returns whether or not this RootMetadata has been initialized
func (md *RootMetadata) IsInitialized() bool {
	keyGen := md.LatestKeyGeneration()
	if md.TlfID().Type() == tlf.Public {
		return keyGen == PublicKeyGen
	}
	// The data is only initialized once we have at least one set of keys
	return keyGen >= FirstValidKeyGen
}

// AddRefBlock adds the newly-referenced block to the add block change list.
func (md *RootMetadata) AddRefBlock(info BlockInfo) {
	md.AddRefBytes(uint64(info.EncodedSize))
	md.AddDiskUsage(uint64(info.EncodedSize))
	md.data.Changes.AddRefBlock(info.BlockPointer)
}

// AddUnrefBlock adds the newly-unreferenced block to the add block change list.
func (md *RootMetadata) AddUnrefBlock(info BlockInfo) {
	if info.EncodedSize > 0 {
		md.AddUnrefBytes(uint64(info.EncodedSize))
		md.SetDiskUsage(md.DiskUsage() - uint64(info.EncodedSize))
		md.data.Changes.AddUnrefBlock(info.BlockPointer)
	}
}

// AddUpdate adds the newly-updated block to the add block change list.
func (md *RootMetadata) AddUpdate(oldInfo BlockInfo, newInfo BlockInfo) {
	md.AddUnrefBytes(uint64(oldInfo.EncodedSize))
	md.AddRefBytes(uint64(newInfo.EncodedSize))
	md.AddDiskUsage(uint64(newInfo.EncodedSize))
	md.SetDiskUsage(md.DiskUsage() - uint64(oldInfo.EncodedSize))
	md.data.Changes.AddUpdate(oldInfo.BlockPointer, newInfo.BlockPointer)
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
	md.SetRefBytes(0)
	md.SetUnrefBytes(0)
	md.SetMDRefBytes(0)
	md.data.Changes.sizeEstimate = 0
	md.data.Changes.Info = BlockInfo{}
	md.data.Changes.Ops = nil
}

// SetLastGCRevision sets the last revision up to and including which
// garbage collection was performed on this TLF.
func (md *RootMetadata) SetLastGCRevision(rev kbfsmd.Revision) {
	md.data.LastGCRevision = rev
}

// updateFromTlfHandle updates the current RootMetadata's fields to
// reflect the given handle, which must be the result of running the
// current handle with ResolveAgain().
func (md *RootMetadata) updateFromTlfHandle(newHandle *TlfHandle) error {
	// TODO: Strengthen check, e.g. make sure every writer/reader
	// in the old handle is also a writer/reader of the new
	// handle.
	if md.TlfID().Type() != newHandle.Type() {
		return fmt.Errorf(
			"Trying to update type=%s rmd with type=%s handle",
			md.TlfID().Type(), newHandle.Type())
	}

	if newHandle.Type() == tlf.Private {
		md.SetUnresolvedReaders(newHandle.UnresolvedReaders())
	} else {
		md.SetWriters(newHandle.ResolvedWriters())
	}

	md.SetUnresolvedWriters(newHandle.UnresolvedWriters())
	md.SetConflictInfo(newHandle.ConflictInfo())
	md.SetFinalizedInfo(newHandle.FinalizedInfo())

	bareHandle, err := md.bareMd.MakeBareTlfHandle(md.extra)
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

// loadCachedBlockChanges swaps any cached block changes so that
// future local accesses to this MD (from the cache) can directly
// access the ops without needing to re-embed the block changes.
func (md *RootMetadata) loadCachedBlockChanges(
	ctx context.Context, bps *blockPutState, log logger.Logger) {
	if md.data.Changes.Ops != nil {
		return
	}

	if len(md.data.cachedChanges.Ops) == 0 {
		panic("MD with no ops passed to loadCachedBlockChanges")
	}

	md.data.Changes, md.data.cachedChanges =
		md.data.cachedChanges, md.data.Changes

	// We always add the ref blocks to the first operation in the MD
	// update.  Most MD updates will only have one op anyway, and for
	// those that have more (like conflict resolution), it is
	// arbitrary which one lists them as references, so putting them
	// in the first op is the easiest thing to do.
	md.data.Changes.Ops[0].
		AddRefBlock(md.data.cachedChanges.Info.BlockPointer)
	// Find the block and ref any children, if any.
	if bps == nil {
		panic("Must provide blocks when changes are unembedded")
	}

	// Prepare a map of all FileBlocks for easy access by fileData
	// below.
	fileBlocks := make(map[BlockPointer]*FileBlock)
	for _, bs := range bps.blockStates {
		if fblock, ok := bs.block.(*FileBlock); ok {
			fileBlocks[bs.blockPtr] = fblock
		}
	}

	// uid, crypto and bsplitter aren't used for simply getting the
	// indirect pointers, so set them to nil.
	var uid keybase1.UID
	file := path{
		FolderBranch{md.TlfID(), MasterBranch},
		[]pathNode{{
			md.data.cachedChanges.Info.BlockPointer,
			fmt.Sprintf("<MD with revision %d>", md.Revision()),
		}},
	}
	fd := newFileData(file, uid, nil, nil, md.ReadOnly(),
		func(_ context.Context, _ KeyMetadata, ptr BlockPointer,
			_ path, _ blockReqType) (*FileBlock, bool, error) {
			fblock, ok := fileBlocks[ptr]
			if !ok {
				return nil, false, fmt.Errorf(
					"No unembedded block change pointer %v in bps", ptr)
			}
			return fblock, false, nil
		},
		func(ptr BlockPointer, block Block) error {
			return nil
		}, log)

	infos, err := fd.getIndirectFileBlockInfos(ctx)
	if err != nil {
		panic(fmt.Sprintf(
			"Couldn't find all unembedded change blocks for %v: %v",
			md.data.cachedChanges.Info.BlockPointer, err))
	}

	for _, info := range infos {
		md.data.Changes.Ops[0].AddRefBlock(info.BlockPointer)
	}
}

// GetTLFCryptKeyParams wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) GetTLFCryptKeyParams(
	keyGen KeyGen, user keybase1.UID, key kbfscrypto.CryptPublicKey) (
	kbfscrypto.TLFEphemeralPublicKey, EncryptedTLFCryptKeyClientHalf,
	TLFCryptKeyServerHalfID, bool, error) {
	return md.bareMd.GetTLFCryptKeyParams(keyGen, user, key, md.extra)
}

// KeyGenerationsToUpdate wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) KeyGenerationsToUpdate() (KeyGen, KeyGen) {
	return md.bareMd.KeyGenerationsToUpdate()
}

// LatestKeyGeneration wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) LatestKeyGeneration() KeyGen {
	return md.bareMd.LatestKeyGeneration()
}

// TlfID wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) TlfID() tlf.ID {
	return md.bareMd.TlfID()
}

// LastModifyingWriter wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) LastModifyingWriter() keybase1.UID {
	return md.bareMd.LastModifyingWriter()
}

// LastModifyingUser wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) LastModifyingUser() keybase1.UID {
	return md.bareMd.GetLastModifyingUser()
}

// RefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) RefBytes() uint64 {
	return md.bareMd.RefBytes()
}

// UnrefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) UnrefBytes() uint64 {
	return md.bareMd.UnrefBytes()
}

// MDRefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) MDRefBytes() uint64 {
	return md.bareMd.MDRefBytes()
}

// DiskUsage wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) DiskUsage() uint64 {
	return md.bareMd.DiskUsage()
}

// MDDiskUsage wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) MDDiskUsage() uint64 {
	return md.bareMd.MDDiskUsage()
}

// SetRefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetRefBytes(refBytes uint64) {
	md.bareMd.SetRefBytes(refBytes)
}

// SetUnrefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetUnrefBytes(unrefBytes uint64) {
	md.bareMd.SetUnrefBytes(unrefBytes)
}

// SetMDRefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetMDRefBytes(mdRefBytes uint64) {
	md.bareMd.SetMDRefBytes(mdRefBytes)
}

// SetDiskUsage wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetDiskUsage(diskUsage uint64) {
	md.bareMd.SetDiskUsage(diskUsage)
}

// SetMDDiskUsage wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetMDDiskUsage(mdDiskUsage uint64) {
	md.bareMd.SetMDDiskUsage(mdDiskUsage)
}

// AddRefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) AddRefBytes(refBytes uint64) {
	md.bareMd.AddRefBytes(refBytes)
}

// AddUnrefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) AddUnrefBytes(unrefBytes uint64) {
	md.bareMd.AddUnrefBytes(unrefBytes)
}

// AddMDRefBytes wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) AddMDRefBytes(mdRefBytes uint64) {
	md.bareMd.AddMDRefBytes(mdRefBytes)
}

// AddDiskUsage wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) AddDiskUsage(diskUsage uint64) {
	md.bareMd.AddDiskUsage(diskUsage)
}

// AddMDDiskUsage wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) AddMDDiskUsage(mdDiskUsage uint64) {
	md.bareMd.AddMDDiskUsage(mdDiskUsage)
}

// IsWriterMetadataCopiedSet wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) IsWriterMetadataCopiedSet() bool {
	return md.bareMd.IsWriterMetadataCopiedSet()
}

// IsRekeySet wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) IsRekeySet() bool {
	return md.bareMd.IsRekeySet()
}

// IsUnmergedSet wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) IsUnmergedSet() bool {
	return md.bareMd.IsUnmergedSet()
}

// Revision wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) Revision() kbfsmd.Revision {
	return md.bareMd.RevisionNumber()
}

// MerkleSeqNo wraps the respective method of the underlying
// BareRootMetadata for convenience.
func (md *RootMetadata) MerkleSeqNo() MerkleSeqNo {
	return md.bareMd.MerkleSeqNo()
}

// MergedStatus wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) MergedStatus() MergeStatus {
	return md.bareMd.MergedStatus()
}

// BID wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) BID() BranchID {
	return md.bareMd.BID()
}

// PrevRoot wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) PrevRoot() kbfsmd.ID {
	return md.bareMd.GetPrevRoot()
}

// Version returns the underlying BareRootMetadata version.
func (md *RootMetadata) Version() MetadataVer {
	return md.bareMd.Version()
}

func (md *RootMetadata) clearRekeyBit() {
	md.bareMd.ClearRekeyBit()
}

func (md *RootMetadata) clearWriterMetadataCopiedBit() {
	md.bareMd.ClearWriterMetadataCopiedBit()
}

// SetUnmerged wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetUnmerged() {
	md.bareMd.SetUnmerged()
}

// SetBranchID wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetBranchID(bid BranchID) {
	md.bareMd.SetBranchID(bid)
}

// SetPrevRoot wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetPrevRoot(mdID kbfsmd.ID) {
	md.bareMd.SetPrevRoot(mdID)
}

// GetSerializedPrivateMetadata wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) GetSerializedPrivateMetadata() []byte {
	return md.bareMd.GetSerializedPrivateMetadata()
}

// GetSerializedWriterMetadata wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) GetSerializedWriterMetadata(
	codec kbfscodec.Codec) ([]byte, error) {
	return md.bareMd.GetSerializedWriterMetadata(codec)
}

// IsFinal wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) IsFinal() bool {
	return md.bareMd.IsFinal()
}

// SetSerializedPrivateMetadata wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetSerializedPrivateMetadata(spmd []byte) {
	md.bareMd.SetSerializedPrivateMetadata(spmd)
}

// SetRekeyBit wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetRekeyBit() {
	md.bareMd.SetRekeyBit()
}

// SetFinalBit wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetFinalBit() {
	md.bareMd.SetFinalBit()
}

// SetWriterMetadataCopiedBit wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetWriterMetadataCopiedBit() {
	md.bareMd.SetWriterMetadataCopiedBit()
}

// SetRevision wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetRevision(revision kbfsmd.Revision) {
	md.bareMd.SetRevision(revision)
}

// SetMerkleSeqNo wraps the respective method of the underlying
// BareRootMetadata for convenience.
func (md *RootMetadata) SetMerkleSeqNo(seqNo MerkleSeqNo) {
	md.bareMd.SetMerkleSeqNo(seqNo)
}

// SetWriters wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetWriters(writers []keybase1.UserOrTeamID) {
	md.bareMd.SetWriters(writers)
}

// SetUnresolvedReaders wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetUnresolvedReaders(readers []keybase1.SocialAssertion) {
	md.bareMd.SetUnresolvedReaders(readers)
}

// SetUnresolvedWriters wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetUnresolvedWriters(writers []keybase1.SocialAssertion) {
	md.bareMd.SetUnresolvedWriters(writers)
}

// SetConflictInfo wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetConflictInfo(ci *tlf.HandleExtension) {
	md.bareMd.SetConflictInfo(ci)
}

// SetFinalizedInfo wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetFinalizedInfo(fi *tlf.HandleExtension) {
	md.bareMd.SetFinalizedInfo(fi)
}

// SetLastModifyingWriter wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetLastModifyingWriter(user keybase1.UID) {
	md.bareMd.SetLastModifyingWriter(user)
}

// SetLastModifyingUser wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetLastModifyingUser(user keybase1.UID) {
	md.bareMd.SetLastModifyingUser(user)
}

// SetTlfID wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) SetTlfID(tlf tlf.ID) {
	md.bareMd.SetTlfID(tlf)
}

// HasKeyForUser wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) HasKeyForUser(user keybase1.UID) (
	bool, error) {
	writers, readers, err := md.bareMd.GetUserDevicePublicKeys(md.extra)
	if err != nil {
		return false, err
	}
	return len(writers[user]) > 0 || len(readers[user]) > 0, nil
}

// fakeInitialRekey wraps the FakeInitialRekey test function for
// convenience.
func (md *RootMetadata) fakeInitialRekey() {
	bh, err := md.tlfHandle.ToBareHandle()
	if err != nil {
		panic(err)
	}
	md.extra = FakeInitialRekey(md.bareMd, bh, kbfscrypto.TLFPublicKey{})
}

// GetBareRootMetadata returns an interface to the underlying serializeable metadata.
func (md *RootMetadata) GetBareRootMetadata() BareRootMetadata {
	return md.bareMd
}

// AddKeyGeneration adds a new key generation to this revision of metadata.
func (md *RootMetadata) AddKeyGeneration(codec kbfscodec.Codec,
	crypto cryptoPure, wKeys, rKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	pubKey kbfscrypto.TLFPublicKey,
	privKey kbfscrypto.TLFPrivateKey,
	currCryptKey, nextCryptKey kbfscrypto.TLFCryptKey) (
	serverHalves UserDeviceKeyServerHalves, err error) {
	nextExtra, serverHalves, err := md.bareMd.AddKeyGeneration(
		codec, crypto, md.extra, wKeys, rKeys, ePubKey, ePrivKey,
		pubKey, currCryptKey, nextCryptKey)
	if err != nil {
		return nil, err
	}
	md.extra = nextExtra
	md.data.TLFPrivateKey = privKey
	return serverHalves, nil
}

func (md *RootMetadata) promoteReaders(
	readersToPromote map[keybase1.UID]bool) error {
	return md.bareMd.PromoteReaders(readersToPromote, md.extra)
}

func (md *RootMetadata) revokeRemovedDevices(
	wKeys, rKeys UserDevicePublicKeys) (
	ServerHalfRemovalInfo, error) {
	return md.bareMd.RevokeRemovedDevices(wKeys, rKeys, md.extra)
}

func (md *RootMetadata) updateKeyBundles(crypto cryptoPure,
	wKeys, rKeys UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKeys []kbfscrypto.TLFCryptKey) (
	[]UserDeviceKeyServerHalves, error) {
	return md.bareMd.UpdateKeyBundles(crypto, md.extra,
		wKeys, rKeys, ePubKey, ePrivKey, tlfCryptKeys)
}

func (md *RootMetadata) finalizeRekey(crypto cryptoPure) error {
	return md.bareMd.FinalizeRekey(crypto, md.extra)
}

func (md *RootMetadata) getUserDevicePublicKeys() (
	writers, readers UserDevicePublicKeys, err error) {
	return md.bareMd.GetUserDevicePublicKeys(md.extra)
}

// GetTLFWriterKeyBundleID returns the ID of the externally-stored
// writer key bundle, or the zero value if this object stores it
// internally.
func (md *RootMetadata) GetTLFWriterKeyBundleID() TLFWriterKeyBundleID {
	return md.bareMd.GetTLFWriterKeyBundleID()
}

// GetTLFReaderKeyBundleID returns the ID of the externally-stored
// reader key bundle, or the zero value if this object stores it
// internally.
func (md *RootMetadata) GetTLFReaderKeyBundleID() TLFReaderKeyBundleID {
	return md.bareMd.GetTLFReaderKeyBundleID()
}

// StoresHistoricTLFCryptKeys implements the KeyMetadata interface for RootMetadata.
func (md *RootMetadata) StoresHistoricTLFCryptKeys() bool {
	return md.bareMd.StoresHistoricTLFCryptKeys()
}

// GetHistoricTLFCryptKey implements the KeyMetadata interface for RootMetadata.
func (md *RootMetadata) GetHistoricTLFCryptKey(
	crypto cryptoPure, keyGen KeyGen,
	currentKey kbfscrypto.TLFCryptKey) (kbfscrypto.TLFCryptKey, error) {
	return md.bareMd.GetHistoricTLFCryptKey(
		crypto, keyGen, currentKey, md.extra)
}

// IsWriter checks that the given user is a valid writer of the TLF
// right now.  Implements the KeyMetadata interface for RootMetadata.
func (md *RootMetadata) IsWriter(
	ctx context.Context, checker TeamMembershipChecker, uid keybase1.UID) (
	bool, error) {
	h := md.GetTlfHandle()
	if h.Type() != tlf.SingleTeam {
		return h.IsWriter(uid), nil
	}

	// Team membership needs to be checked with the service.  For a
	// SingleTeam TLF, there is always only a single writer in the
	// handle.
	tid, err := h.FirstResolvedWriter().AsTeam()
	if err != nil {
		return false, err
	}
	return checker.IsTeamWriter(ctx, tid, uid)
}

// IsReader checks that the given user is a valid reader of the TLF
// right now.
func (md *RootMetadata) IsReader(
	ctx context.Context, checker TeamMembershipChecker, uid keybase1.UID) (
	bool, error) {
	h := md.GetTlfHandle()
	if h.Type() != tlf.SingleTeam {
		return h.IsReader(uid), nil
	}

	// Team membership needs to be checked with the service.  For a
	// SingleTeam TLF, there is always only a single writer in the
	// handle.
	tid, err := h.FirstResolvedWriter().AsTeam()
	if err != nil {
		return false, err
	}
	return checker.IsTeamReader(ctx, tid, uid)
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
	currID kbfsmd.ID, nextMd ReadOnlyRootMetadata) error {
	return md.bareMd.CheckValidSuccessor(currID, nextMd.bareMd)
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
	mdID                   kbfsmd.ID
	lastWriterVerifyingKey kbfscrypto.VerifyingKey
	// localTimestamp represents the time at which the MD update was
	// applied at the server, adjusted for the local clock.  So for
	// example, it can be used to show how long ago a particular
	// update happened (e.g., "5 hours ago").  Note that the update
	// time supplied by the server is technically untrusted (i.e., not
	// signed by a writer of the TLF, only provided by the server).
	// If this ImmutableRootMetadata was generated locally and still
	// persists in the journal or in the cache, localTimestamp comes
	// directly from the local clock.
	localTimestamp time.Time
}

// MakeImmutableRootMetadata makes a new ImmutableRootMetadata from
// the given RMD and its corresponding MdID.
func MakeImmutableRootMetadata(
	rmd *RootMetadata, writerVerifyingKey kbfscrypto.VerifyingKey,
	mdID kbfsmd.ID, localTimestamp time.Time) ImmutableRootMetadata {
	if writerVerifyingKey == (kbfscrypto.VerifyingKey{}) {
		panic("zero writerVerifyingKey passed to MakeImmutableRootMetadata")
	}
	if mdID == (kbfsmd.ID{}) {
		panic("zero mdID passed to MakeImmutableRootMetadata")
	}
	if localTimestamp.IsZero() {
		panic("zero localTimestamp passed to MakeImmutableRootMetadata")
	}
	if bareMDV2, ok := rmd.bareMd.(*BareRootMetadataV2); ok {
		writerSig := bareMDV2.WriterMetadataSigInfo
		if writerSig.IsNil() {
			panic("MDV2 with nil writer signature")
		}
		if writerSig.VerifyingKey != writerVerifyingKey {
			panic(fmt.Sprintf("key mismatch: sig has %s, expected %s",
				writerSig.VerifyingKey, writerVerifyingKey))
		}
	}
	return ImmutableRootMetadata{
		rmd.ReadOnly(), mdID, writerVerifyingKey, localTimestamp}
}

// MdID returns the pre-computed MdID of the contained RootMetadata
// object.
func (irmd ImmutableRootMetadata) MdID() kbfsmd.ID {
	return irmd.mdID
}

// LocalTimestamp returns the timestamp associated with this
// RootMetadata object.
func (irmd ImmutableRootMetadata) LocalTimestamp() time.Time {
	return irmd.localTimestamp
}

// LastModifyingWriterVerifyingKey returns the VerifyingKey used by the last
// writer of this MD.
func (irmd ImmutableRootMetadata) LastModifyingWriterVerifyingKey() kbfscrypto.VerifyingKey {
	return irmd.lastWriterVerifyingKey
}

// RootMetadataSigned is the top-level MD object stored in MD server
//
// TODO: Have separate types for:
//
// - The in-memory client representation (needs untrustedServerTimestamp);
// - the type sent over RPC;
// - the type stored in the journal;
// - and the type stored in the MD server.
type RootMetadataSigned struct {
	// SigInfo is the signature over the root metadata by the
	// last modifying user's private signing key.
	SigInfo kbfscrypto.SignatureInfo
	// WriterSigInfo is the signature over the writer metadata by
	// the last modifying writer's private signing key.
	WriterSigInfo kbfscrypto.SignatureInfo
	// all the metadata
	MD BareRootMetadata
	// When does the server say this MD update was received?  (This is
	// not necessarily trustworthy, just for informational purposes.)
	untrustedServerTimestamp time.Time
}

func checkWriterSig(rmds *RootMetadataSigned) error {
	if mdv2, ok := rmds.MD.(*BareRootMetadataV2); ok {
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
	md BareRootMetadata,
	untrustedServerTimestamp time.Time) (*RootMetadataSigned, error) {
	rmds := &RootMetadataSigned{
		MD:                       md,
		SigInfo:                  sigInfo,
		WriterSigInfo:            writerSigInfo,
		untrustedServerTimestamp: untrustedServerTimestamp,
	}
	err := checkWriterSig(rmds)
	if err != nil {
		return nil, err
	}
	return rmds, nil
}

// SignBareRootMetadata signs the given BareRootMetadata and returns a
// *RootMetadataSigned object. rootMetadataSigner and
// writerMetadataSigner should be the same, except in tests.
func SignBareRootMetadata(
	ctx context.Context, codec kbfscodec.Codec,
	rootMetadataSigner, writerMetadataSigner kbfscrypto.Signer,
	brmd BareRootMetadata, untrustedServerTimestamp time.Time) (
	*RootMetadataSigned, error) {
	// encode the root metadata
	buf, err := codec.Encode(brmd)
	if err != nil {
		return nil, err
	}

	var sigInfo, writerSigInfo kbfscrypto.SignatureInfo
	if mdv2, ok := brmd.(*BareRootMetadataV2); ok {
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
	return makeRootMetadataSigned(
		sigInfo, writerSigInfo, brmd, untrustedServerTimestamp)
}

// GetWriterMetadataSigInfo returns the signature of the writer
// metadata.
func (rmds *RootMetadataSigned) GetWriterMetadataSigInfo() kbfscrypto.SignatureInfo {
	return rmds.WriterSigInfo
}

// MerkleHash computes a hash of this RootMetadataSigned object for inclusion
// into the KBFS Merkle tree.
func (rmds *RootMetadataSigned) MerkleHash(crypto cryptoPure) (MerkleHash, error) {
	return crypto.MakeMerkleHash(rmds)
}

// Version returns the metadata version of this MD block, depending on
// which features it uses.
func (rmds *RootMetadataSigned) Version() MetadataVer {
	return rmds.MD.Version()
}

// MakeFinalCopy returns a complete copy of this RootMetadataSigned
// with the revision incremented and the final bit set.
func (rmds *RootMetadataSigned) MakeFinalCopy(
	codec kbfscodec.Codec, now time.Time,
	finalizedInfo *tlf.HandleExtension) (*RootMetadataSigned, error) {
	if finalizedInfo.Type != tlf.HandleExtensionFinalized {
		return nil, fmt.Errorf(
			"Extension %s does not have finalized type",
			finalizedInfo)
	}
	if rmds.MD.IsFinal() {
		return nil, MetadataIsFinalError{}
	}
	newBareMd, err := rmds.MD.DeepCopy(codec)
	if err != nil {
		return nil, err
	}
	// Set the final flag.
	newBareMd.SetFinalBit()
	// Set the copied bit, so that clients don't take the ops and byte
	// counts in it seriously.
	newBareMd.SetWriterMetadataCopiedBit()
	// Increment revision but keep the PrevRoot --
	// We want the client to be able to verify the signature by masking out the final
	// bit, decrementing the revision, and nulling out the finalized extension info.
	// This way it can easily tell a server didn't modify anything unexpected when
	// creating the final metadata block. Note that PrevRoot isn't being updated. This
	// is to make verification easier for the client as otherwise it'd need to request
	// the head revision - 1.
	newBareMd.SetRevision(rmds.MD.RevisionNumber() + 1)
	newBareMd.SetFinalizedInfo(finalizedInfo)
	return makeRootMetadataSigned(
		rmds.SigInfo.DeepCopy(), rmds.WriterSigInfo.DeepCopy(),
		newBareMd, now)
}

// IsValidAndSigned verifies the RootMetadataSigned, checks the root
// signature, and returns an error if a problem was found.  This
// should be the first thing checked on an RMDS retrieved from an
// untrusted source, and then the signing users and keys should be
// validated, either by comparing to the current device key (using
// IsLastModifiedBy), or by checking with KBPKI.
func (rmds *RootMetadataSigned) IsValidAndSigned(
	codec kbfscodec.Codec, crypto cryptoPure, extra ExtraMetadata) error {
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

	err := rmds.MD.IsValidAndSigned(codec, crypto, extra)
	if err != nil {
		return err
	}

	md := rmds.MD
	if rmds.MD.IsFinal() {
		mdCopy, err := md.DeepCopy(codec)
		if err != nil {
			return err
		}
		mutableMdCopy, ok := mdCopy.(MutableBareRootMetadata)
		if !ok {
			return MutableBareRootMetadataNoImplError{}
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

// DecodeRootMetadata deserializes a metadata block into the specified
// versioned structure.
func DecodeRootMetadata(codec kbfscodec.Codec, tlf tlf.ID,
	ver, max MetadataVer, buf []byte) (
	MutableBareRootMetadata, error) {
	if ver < FirstValidMetadataVer {
		return nil, InvalidMetadataVersionError{tlf, ver}
	} else if ver > max {
		return nil, NewMetadataVersionError{tlf, ver}
	}
	if ver > SegregatedKeyBundlesVer {
		// Shouldn't be possible at the moment.
		panic("Invalid metadata version")
	}
	if ver < SegregatedKeyBundlesVer {
		var brmd BareRootMetadataV2
		if err := codec.Decode(buf, &brmd); err != nil {
			return nil, err
		}
		return &brmd, nil
	}
	var brmd BareRootMetadataV3
	if err := codec.Decode(buf, &brmd); err != nil {
		return nil, err
	}
	return &brmd, nil
}

// DecodeRootMetadataSigned deserializes a metadata block into the
// specified versioned structure.
func DecodeRootMetadataSigned(
	codec kbfscodec.Codec, tlf tlf.ID, ver, max MetadataVer, buf []byte,
	untrustedServerTimestamp time.Time) (
	*RootMetadataSigned, error) {
	if ver < FirstValidMetadataVer {
		return nil, InvalidMetadataVersionError{tlf, ver}
	} else if ver > max {
		return nil, NewMetadataVersionError{tlf, ver}
	}
	if ver > SegregatedKeyBundlesVer {
		// Shouldn't be possible at the moment.
		panic("Invalid metadata version")
	}
	var rmds RootMetadataSigned
	if ver < SegregatedKeyBundlesVer {
		rmds.MD = &BareRootMetadataV2{}
	} else {
		rmds.MD = &BareRootMetadataV3{}
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
		mdv2 := rmds.MD.(*BareRootMetadataV2)
		rmds.WriterSigInfo = mdv2.WriterMetadataSigInfo
	}
	rmds.untrustedServerTimestamp = untrustedServerTimestamp
	return &rmds, nil
}
