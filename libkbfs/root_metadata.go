// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
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

type verboseOp struct {
	op
	indent string
}

func (o verboseOp) String() string {
	return o.op.StringWithRefs(o.indent)
}

// DumpPrivateMetadata returns a detailed dump of the given
// PrivateMetadata's contents.
func DumpPrivateMetadata(
	codec kbfscodec.Codec, serializedPMDLength int, pmd PrivateMetadata) (string, error) {
	s := fmt.Sprintf("Size: %d bytes\n", serializedPMDLength)

	eq, err := kbfscodec.Equal(codec, pmd, PrivateMetadata{})
	if err != nil {
		return "", err
	}

	if eq {
		s += "<Undecryptable>\n"
	} else {
		c := kbfsmd.DumpConfig()
		// Hardcode the indent level, which depends on the
		// position of the Ops list.
		indent := strings.Repeat(c.Indent, 4)

		var pmdCopy PrivateMetadata
		kbfscodec.Update(codec, &pmdCopy, pmd)
		ops := pmdCopy.Changes.Ops
		for i, op := range ops {
			ops[i] = verboseOp{op, indent}
		}

		s += c.Sdump(pmdCopy)
	}
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

// A RootMetadata is a BareRootMetadata but with a deserialized
// PrivateMetadata. However, note that it is possible that the
// PrivateMetadata has to be left serialized due to not having the
// right keys.
type RootMetadata struct {
	bareMd kbfsmd.MutableRootMetadata

	// ExtraMetadata currently contains key bundles for post-v2
	// metadata.
	extra kbfsmd.ExtraMetadata

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
func makeRootMetadata(bareMd kbfsmd.MutableRootMetadata,
	extra kbfsmd.ExtraMetadata, handle *TlfHandle) *RootMetadata {
	if bareMd == nil {
		panic("nil kbfsmd.MutableRootMetadata")
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
	ver kbfsmd.MetadataVer, tlfID tlf.ID, h *TlfHandle) (*RootMetadata, error) {
	bh, err := h.ToBareHandle()
	if err != nil {
		return nil, err
	}

	bareMD, err := kbfsmd.MakeInitialRootMetadata(ver, tlfID, bh)
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

// GetRootDirEntry implements the KeyMetadataWithRootDirEntry
// interface for RootMetadata.
func (md *RootMetadata) GetRootDirEntry() DirEntry {
	return md.data.Dir
}

// Extra returns the extra metadata of this RootMetadata.
func (md *RootMetadata) Extra() kbfsmd.ExtraMetadata {
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

	var extraCopy kbfsmd.ExtraMetadata
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
	ctx context.Context, latestMDVer kbfsmd.MetadataVer, codec kbfscodec.Codec,
	keyManager KeyManager, merkleGetter merkleRootGetter,
	teamKeyer teamKeysGetter, mdID kbfsmd.ID, isWriter bool) (
	*RootMetadata, error) {
	if mdID == (kbfsmd.ID{}) {
		return nil, errors.New("Empty MdID in MakeSuccessor")
	}
	if md.IsFinal() {
		return nil, kbfsmd.MetadataIsFinalError{}
	}

	isReadableAndWriter := md.IsReadable() && isWriter

	brmdCopy, extraCopy, err := md.bareMd.MakeSuccessorCopy(
		codec, md.extra, latestMDVer,
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
		if newMd.TypeForKeying() == tlf.TeamKeying {
			tid, err := handleCopy.FirstResolvedWriter().AsTeam()
			if err != nil {
				return nil, err
			}
			_, keyGen, err := teamKeyer.GetTeamTLFCryptKeys(
				ctx, tid, kbfsmd.UnspecifiedKeyGen)
			if err != nil {
				return nil, err
			}
			newMd.bareMd.SetLatestKeyGenerationForTeamTLF(keyGen)
		}
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

	merkleRoot, _, err := merkleGetter.GetCurrentMerkleRoot(ctx)
	if err != nil {
		return nil, err
	}
	newMd.SetMerkleRoot(merkleRoot)

	return newMd, nil
}

// MakeSuccessorWithNewHandle does the same thing as MakeSuccessor,
// plus it changes the handle.  (The caller is responsible for
// ensuring that the handle change is valid.)
func (md *RootMetadata) MakeSuccessorWithNewHandle(
	ctx context.Context, newHandle *TlfHandle, latestMDVer kbfsmd.MetadataVer,
	codec kbfscodec.Codec, keyManager KeyManager, merkleGetter merkleRootGetter,
	teamKeyer teamKeysGetter, mdID kbfsmd.ID, isWriter bool) (
	*RootMetadata, error) {
	mdCopy, err := md.deepCopy(codec)
	if err != nil {
		return nil, err
	}

	mdCopy.extra = nil
	mdCopy.tlfHandle = newHandle.deepCopy()
	mdCopy.SetWriters(newHandle.ResolvedWriters())
	// Readers are not tracked explicitly in the MD, but their key
	// bundles are cleared out with the `ClearForV4Migration()` call
	// below.
	mdCopy.SetUnresolvedWriters(newHandle.UnresolvedWriters())
	mdCopy.SetUnresolvedReaders(newHandle.UnresolvedReaders())
	mdCopy.bareMd.ClearForV4Migration()

	return mdCopy.MakeSuccessor(
		ctx, latestMDVer, codec, keyManager, merkleGetter, teamKeyer, mdID,
		isWriter)
}

// GetTlfHandle returns the TlfHandle for this RootMetadata.
func (md *RootMetadata) GetTlfHandle() *TlfHandle {
	if md.tlfHandle == nil {
		panic(fmt.Sprintf("RootMetadata %v with no handle", md))
	}

	return md.tlfHandle
}

// TypeForKeying returns the keying type for the RootMetadata.
func (md *RootMetadata) TypeForKeying() tlf.KeyingType {
	return md.bareMd.TypeForKeying()
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
	if md.TypeForKeying() == tlf.PublicKeying {
		return keyGen == kbfsmd.PublicKeyGen
	}
	// The data is only initialized once we have at least one set of keys
	return keyGen >= kbfsmd.FirstValidKeyGen
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
	valid := true
	newBareHandle, err := newHandle.ToBareHandle()
	if err != nil {
		return err
	}
	switch md.TypeForKeying() {
	case tlf.PrivateKeying:
		// Private-keyed TLFs can move to team keying, but not to
		// public keying.
		valid = newBareHandle.TypeForKeying() != tlf.PublicKeying
	case tlf.PublicKeying:
		// Public-keyed TLFs can move to team keying, but not to
		// private keying.
		valid = newBareHandle.TypeForKeying() != tlf.PrivateKeying
	case tlf.TeamKeying:
		// Team-keyed TLFs must always remain team-keyed.
		valid = newBareHandle.TypeForKeying() == tlf.TeamKeying
	default:
		return fmt.Errorf("Unexpected keying type %s", md.TypeForKeying())
	}
	if !valid {
		return fmt.Errorf(
			"Trying to update rmd with id type=%s, keying type=%s with "+
				"handle of type=%s, keying type=%s",
			md.TlfID().Type(), md.TypeForKeying(),
			newHandle.Type(), newBareHandle.TypeForKeying())
	}

	if newBareHandle.TypeForKeying() == tlf.PrivateKeying {
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
	ctx context.Context, bps blockPutState, log logger.Logger) {
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
	for _, ptr := range bps.ptrs() {
		if block, err := bps.getBlock(ctx, ptr); err == nil {
			if fblock, ok := block.(*FileBlock); ok {
				fileBlocks[ptr] = fblock
			}
		}
	}

	// uid, crypto and bsplitter aren't used for simply getting the
	// indirect pointers, so set them to nil.
	var id keybase1.UserOrTeamID
	file := path{
		FolderBranch{md.TlfID(), MasterBranch},
		[]pathNode{{
			md.data.cachedChanges.Info.BlockPointer,
			fmt.Sprintf("<MD with revision %d>", md.Revision()),
		}},
	}
	fd := newFileData(file, id, nil, nil, md.ReadOnly(),
		func(_ context.Context, _ KeyMetadata, ptr BlockPointer,
			_ path, _ blockReqType) (*FileBlock, bool, error) {
			fblock, ok := fileBlocks[ptr]
			if !ok {
				return nil, false, fmt.Errorf(
					"No unembedded block change pointer %v in bps", ptr)
			}
			return fblock, false, nil
		},
		func(_ context.Context, ptr BlockPointer, block Block) error {
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
	keyGen kbfsmd.KeyGen, user keybase1.UID, key kbfscrypto.CryptPublicKey) (
	kbfscrypto.TLFEphemeralPublicKey, kbfscrypto.EncryptedTLFCryptKeyClientHalf,
	kbfscrypto.TLFCryptKeyServerHalfID, bool, error) {
	return md.bareMd.GetTLFCryptKeyParams(keyGen, user, key, md.extra)
}

// KeyGenerationsToUpdate wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) KeyGenerationsToUpdate() (kbfsmd.KeyGen, kbfsmd.KeyGen) {
	return md.bareMd.KeyGenerationsToUpdate()
}

// LatestKeyGeneration wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) LatestKeyGeneration() kbfsmd.KeyGen {
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

// MerkleRoot wraps the respective method of the underlying
// BareRootMetadata for convenience.
func (md *RootMetadata) MerkleRoot() keybase1.MerkleRootV2 {
	return md.bareMd.MerkleRoot()
}

// MergedStatus wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) MergedStatus() kbfsmd.MergeStatus {
	return md.bareMd.MergedStatus()
}

// BID wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) BID() kbfsmd.BranchID {
	return md.bareMd.BID()
}

// PrevRoot wraps the respective method of the underlying BareRootMetadata for convenience.
func (md *RootMetadata) PrevRoot() kbfsmd.ID {
	return md.bareMd.GetPrevRoot()
}

// Version returns the underlying BareRootMetadata version.
func (md *RootMetadata) Version() kbfsmd.MetadataVer {
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
func (md *RootMetadata) SetBranchID(bid kbfsmd.BranchID) {
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

// SetMerkleRoot wraps the respective method of the underlying
// BareRootMetadata for convenience.
func (md *RootMetadata) SetMerkleRoot(root keybase1.MerkleRootV2) {
	md.bareMd.SetMerkleRoot(root)
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
	md.extra = kbfsmd.FakeInitialRekey(md.bareMd, bh, kbfscrypto.TLFPublicKey{})
}

// GetBareRootMetadata returns an interface to the underlying serializeable metadata.
func (md *RootMetadata) GetBareRootMetadata() kbfsmd.RootMetadata {
	return md.bareMd
}

// AddKeyGeneration adds a new key generation to this revision of metadata.
func (md *RootMetadata) AddKeyGeneration(codec kbfscodec.Codec,
	wKeys, rKeys kbfsmd.UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	pubKey kbfscrypto.TLFPublicKey,
	privKey kbfscrypto.TLFPrivateKey,
	currCryptKey, nextCryptKey kbfscrypto.TLFCryptKey) (
	serverHalves kbfsmd.UserDeviceKeyServerHalves, err error) {
	nextExtra, serverHalves, err := md.bareMd.AddKeyGeneration(
		codec, md.extra, wKeys, rKeys, ePubKey, ePrivKey,
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
	wKeys, rKeys kbfsmd.UserDevicePublicKeys) (
	kbfsmd.ServerHalfRemovalInfo, error) {
	return md.bareMd.RevokeRemovedDevices(wKeys, rKeys, md.extra)
}

func (md *RootMetadata) updateKeyBundles(
	codec kbfscodec.Codec, wKeys, rKeys kbfsmd.UserDevicePublicKeys,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKeys []kbfscrypto.TLFCryptKey) (
	[]kbfsmd.UserDeviceKeyServerHalves, error) {
	return md.bareMd.UpdateKeyBundles(codec, md.extra,
		wKeys, rKeys, ePubKey, ePrivKey, tlfCryptKeys)
}

func (md *RootMetadata) finalizeRekey(codec kbfscodec.Codec) error {
	return md.bareMd.FinalizeRekey(codec, md.extra)
}

func (md *RootMetadata) getUserDevicePublicKeys() (
	writers, readers kbfsmd.UserDevicePublicKeys, err error) {
	return md.bareMd.GetUserDevicePublicKeys(md.extra)
}

// GetTLFWriterKeyBundleID returns the ID of the externally-stored
// writer key bundle, or the zero value if this object stores it
// internally.
func (md *RootMetadata) GetTLFWriterKeyBundleID() kbfsmd.TLFWriterKeyBundleID {
	return md.bareMd.GetTLFWriterKeyBundleID()
}

// GetTLFReaderKeyBundleID returns the ID of the externally-stored
// reader key bundle, or the zero value if this object stores it
// internally.
func (md *RootMetadata) GetTLFReaderKeyBundleID() kbfsmd.TLFReaderKeyBundleID {
	return md.bareMd.GetTLFReaderKeyBundleID()
}

// StoresHistoricTLFCryptKeys implements the KeyMetadata interface for RootMetadata.
func (md *RootMetadata) StoresHistoricTLFCryptKeys() bool {
	return md.bareMd.StoresHistoricTLFCryptKeys()
}

// GetHistoricTLFCryptKey implements the KeyMetadata interface for RootMetadata.
func (md *RootMetadata) GetHistoricTLFCryptKey(
	codec kbfscodec.Codec, keyGen kbfsmd.KeyGen,
	currentKey kbfscrypto.TLFCryptKey) (kbfscrypto.TLFCryptKey, error) {
	return md.bareMd.GetHistoricTLFCryptKey(
		codec, keyGen, currentKey, md.extra)
}

// IsWriter checks that the given user is a valid writer of the TLF
// right now.  Implements the KeyMetadata interface for RootMetadata.
func (md *RootMetadata) IsWriter(
	ctx context.Context, checker kbfsmd.TeamMembershipChecker,
	uid keybase1.UID, verifyingKey kbfscrypto.VerifyingKey) (
	bool, error) {
	h := md.GetTlfHandle()
	return isWriterFromHandle(ctx, h, checker, uid, verifyingKey)
}

// IsReader checks that the given user is a valid reader of the TLF
// right now.
func (md *RootMetadata) IsReader(
	ctx context.Context, checker kbfsmd.TeamMembershipChecker,
	uid keybase1.UID) (bool, error) {
	h := md.GetTlfHandle()
	return isReaderFromHandle(ctx, h, checker, uid)
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
	// putToServer indicates whether this MD has been put successfully
	// to the remote server (e.g., it isn't just local to the
	// process's journal).
	putToServer bool
}

// MakeImmutableRootMetadata makes a new ImmutableRootMetadata from
// the given RMD and its corresponding MdID.
func MakeImmutableRootMetadata(
	rmd *RootMetadata, writerVerifyingKey kbfscrypto.VerifyingKey,
	mdID kbfsmd.ID, localTimestamp time.Time,
	putToServer bool) ImmutableRootMetadata {
	if writerVerifyingKey == (kbfscrypto.VerifyingKey{}) {
		panic("zero writerVerifyingKey passed to MakeImmutableRootMetadata")
	}
	if mdID == (kbfsmd.ID{}) {
		panic("zero mdID passed to MakeImmutableRootMetadata")
	}
	if localTimestamp.IsZero() {
		panic("zero localTimestamp passed to MakeImmutableRootMetadata")
	}
	if bareMDV2, ok := rmd.bareMd.(*kbfsmd.RootMetadataV2); ok {
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
		rmd.ReadOnly(), mdID, writerVerifyingKey, localTimestamp, putToServer}
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

// RootMetadataSigned is a wrapper around kbfsmd.RootMetadataSigned
// that adds an untrusted server timestamp.
type RootMetadataSigned struct {
	kbfsmd.RootMetadataSigned
	// When does the server say this MD update was received?  (This is
	// not necessarily trustworthy, just for informational purposes.)
	untrustedServerTimestamp time.Time
}

// makeRootMetadataSigned makes a RootMetadataSigned object from the
// given info. If md stores the writer signature info internally, it
// must match the given one.
func makeRootMetadataSigned(rmds *kbfsmd.RootMetadataSigned,
	untrustedServerTimestamp time.Time) *RootMetadataSigned {
	return &RootMetadataSigned{
		RootMetadataSigned:       *rmds,
		untrustedServerTimestamp: untrustedServerTimestamp,
	}
}

// SignBareRootMetadata signs the given BareRootMetadata and returns a
// *RootMetadataSigned object. rootMetadataSigner and
// writerMetadataSigner should be the same, except in tests.
func SignBareRootMetadata(
	ctx context.Context, codec kbfscodec.Codec,
	rootMetadataSigner, writerMetadataSigner kbfscrypto.Signer,
	md kbfsmd.RootMetadata, untrustedServerTimestamp time.Time) (
	*RootMetadataSigned, error) {
	rmds, err := kbfsmd.SignRootMetadata(ctx, codec, rootMetadataSigner, writerMetadataSigner, md)
	if err != nil {
		return nil, err
	}
	return makeRootMetadataSigned(rmds, untrustedServerTimestamp), nil
}

// MakeFinalCopy returns a complete copy of this RootMetadataSigned
// with the revision incremented and the final bit set.
func (rmds *RootMetadataSigned) MakeFinalCopy(
	codec kbfscodec.Codec, now time.Time,
	finalizedInfo *tlf.HandleExtension) (*RootMetadataSigned, error) {
	rmdsCopy, err := rmds.RootMetadataSigned.MakeFinalCopy(codec, finalizedInfo)
	if err != nil {
		return nil, err
	}
	return makeRootMetadataSigned(rmdsCopy, now), nil
}

// DecodeRootMetadataSigned deserializes a metadata block into the
// specified versioned structure.
func DecodeRootMetadataSigned(
	codec kbfscodec.Codec, tlf tlf.ID, ver, max kbfsmd.MetadataVer, buf []byte,
	untrustedServerTimestamp time.Time) (
	*RootMetadataSigned, error) {
	rmds, err := kbfsmd.DecodeRootMetadataSigned(codec, tlf, ver, max, buf)
	if err != nil {
		return nil, err
	}
	return makeRootMetadataSigned(rmds, untrustedServerTimestamp), nil
}
