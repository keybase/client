// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"sync"
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

// MetadataRevision is the type for the revision number.
// This is currently int64 since that's the type of Avro's long.
type MetadataRevision int64

// String converts a MetadataRevision to its string form.
func (mr MetadataRevision) String() string {
	return strconv.FormatInt(mr.Number(), 10)
}

// Number casts a MetadataRevision to it's primitive type.
func (mr MetadataRevision) Number() int64 {
	return int64(mr)
}

const (
	// MetadataRevisionUninitialized indicates that a top-level folder has
	// not yet been initialized.
	MetadataRevisionUninitialized = MetadataRevision(0)
	// MetadataRevisionInitial is always the first revision for an
	// initialized top-level folder.
	MetadataRevisionInitial = MetadataRevision(1)
)

// WriterMetadata stores the metadata for a TLF that is
// only editable by users with writer permissions.
//
// NOTE: Don't add new fields to this type! Instead, add them to
// WriterMetadataExtra. This is because we want old clients to
// preserve unknown fields, and we're unable to do that for
// WriterMetadata directly because it's embedded in RootMetadata.
type WriterMetadata struct {
	// Serialized, possibly encrypted, version of the PrivateMetadata
	SerializedPrivateMetadata []byte `codec:"data"`
	// The last KB user with writer permissions to this TLF
	// who modified this WriterMetadata
	LastModifyingWriter keybase1.UID
	// For public TLFs (since those don't have any keys at all).
	Writers []keybase1.UID `codec:",omitempty"`
	// For private TLFs. Writer key generations for this metadata. The
	// most recent one is last in the array. Must be same length as
	// RootMetadata.RKeys.
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

// RootMetadata is the MD that is signed by the reader or writer.
type RootMetadata struct {
	// The metadata that is only editable by the writer.
	//
	// TODO: If we ever get a chance to update RootMetadata
	// without having to be backwards-compatible, WriterMetadata
	// should be unembedded; see comments to WriterMetadata as for
	// why.
	WriterMetadata

	// The signature for the writer metadata, to prove
	// that it's only been changed by writers.
	WriterMetadataSigInfo SignatureInfo

	// The last KB user who modified this RootMetadata
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

	// The plaintext, deserialized PrivateMetadata
	data PrivateMetadata

	// The TLF handle for this MD. May be nil if this object was
	// deserialized (more common on the server side).
	tlfHandle *TlfHandle

	// The cached ID for this MD structure (hash)
	mdIDLock sync.RWMutex
	mdID     MdID
}

func (md *RootMetadata) haveOnlyUserRKeysChanged(codec Codec, prevMD *RootMetadata, user keybase1.UID) (bool, error) {
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

// IsValidRekeyRequest returns true if the current block is a simple rekey wrt
// the passed block.
func (md *RootMetadata) IsValidRekeyRequest(codec Codec, prevMd *RootMetadata, user keybase1.UID) (bool, error) {
	if !md.IsWriterMetadataCopiedSet() {
		// Not a copy.
		return false, nil
	}
	writerEqual, err := CodecEqual(
		codec, md.WriterMetadata, prevMd.WriterMetadata)
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

// MergedStatus returns the status of this update -- has it been
// merged into the main folder or not?
func (md *RootMetadata) MergedStatus() MergeStatus {
	if md.WFlags&MetadataFlagUnmerged != 0 {
		return Unmerged
	}
	return Merged
}

// IsRekeySet returns true if the rekey bit is set.
func (md *RootMetadata) IsRekeySet() bool {
	return md.Flags&MetadataFlagRekey != 0
}

// IsWriterMetadataCopiedSet returns true if the bit is set indicating the writer metadata
// was copied.
func (md *RootMetadata) IsWriterMetadataCopiedSet() bool {
	return md.Flags&MetadataFlagWriterMetadataCopied != 0
}

// IsFinal returns true if this is the last metadata block for a given folder.  This is
// only expected to be set for folder resets.
func (md *RootMetadata) IsFinal() bool {
	return md.Flags&MetadataFlagFinal != 0
}

// IsWriter returns whether or not the user+device is an authorized writer.
func (md *RootMetadata) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
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

// IsReader returns whether or not the user+device is an authorized reader.
func (md *RootMetadata) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	if md.ID.IsPublic() {
		return true
	}
	return md.RKeys.IsReader(user, deviceKID)
}

// updateNewRootMetadata initializes the given freshly-created
// RootMetadata object with the given TlfID and TlfHandle. Note that
// if the given ID/handle are private, rekeying must be done
// separately.
func updateNewRootMetadata(rmd *RootMetadata, id TlfID, h BareTlfHandle) error {
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
	rmd.WriterMetadata = WriterMetadata{
		Writers: writers,
		WKeys:   wKeys,
		ID:      id,
	}
	if len(h.UnresolvedWriters) > 0 {
		rmd.Extra.UnresolvedWriters = make([]keybase1.SocialAssertion, len(h.UnresolvedWriters))
		copy(rmd.Extra.UnresolvedWriters, h.UnresolvedWriters)
	}

	rmd.Revision = MetadataRevisionInitial
	rmd.RKeys = rKeys
	if len(h.UnresolvedReaders) > 0 {
		rmd.UnresolvedReaders = make([]keybase1.SocialAssertion, len(h.UnresolvedReaders))
		copy(rmd.UnresolvedReaders, h.UnresolvedReaders)
	}
	return nil
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

// DeepCopyForServerTest returns a complete copy of this RootMetadata
// for testing, except for tlfHandle. Non-test code should use
// MakeSuccessor() instead.
func (md *RootMetadata) DeepCopyForServerTest(
	codec Codec) (*RootMetadata, error) {
	return md.deepCopy(codec, false)
}

// MakeSuccessor returns a complete copy of this RootMetadata (but
// with cleared block change lists and cleared serialized metadata),
// with the revision incremented and a correct backpointer.
func (md *RootMetadata) MakeSuccessor(config Config, isWriter bool) (*RootMetadata, error) {
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

	newMd.PrevRoot, err = md.MetadataID(config.Crypto())
	if err != nil {
		return nil, err
	}
	// bump revision
	if md.Revision < MetadataRevisionInitial {
		return nil, errors.New("MD with invalid revision")
	}
	newMd.Revision = md.Revision + 1
	return newMd, nil
}

// CheckValidSuccessor makes sure the given RootMetadata is a valid
// successor to the current one, and returns an error otherwise.
func (md *RootMetadata) CheckValidSuccessor(
	crypto cryptoPure, nextMd *RootMetadata) error {
	// (1) Verify current metadata is non-final.
	if md.IsFinal() {
		return MetadataIsFinalError{}
	}

	// (2) Check TLF ID.
	if nextMd.ID != md.ID {
		return MDTlfIDMismatch{
			currID: md.ID,
			nextID: nextMd.ID,
		}
	}

	// (2) Check revision.
	if nextMd.Revision != md.Revision+1 {
		return MDRevisionMismatch{
			rev:  nextMd.Revision,
			curr: md.Revision,
		}
	}

	// (3) Check PrevRoot pointer.
	currRoot, err := md.MetadataID(crypto)
	if err != nil {
		return err
	}
	if nextMd.PrevRoot != currRoot {
		return MDPrevRootMismatch{
			prevRoot: nextMd.PrevRoot,
			currRoot: currRoot,
		}
	}

	expectedUsage := md.DiskUsage
	if !nextMd.IsWriterMetadataCopiedSet() {
		expectedUsage += nextMd.RefBytes - nextMd.UnrefBytes
	}
	if nextMd.DiskUsage != expectedUsage {
		return MDDiskUsageMismatch{
			expectedDiskUsage: expectedUsage,
			actualDiskUsage:   nextMd.DiskUsage,
		}
	}

	// TODO: Check that the successor (bare) TLF handle is the
	// same or more resolved.

	return nil
}

// CheckValidSuccessorForServer is like CheckValidSuccessor but with
// server-specific error messages.
func (md *RootMetadata) CheckValidSuccessorForServer(
	crypto cryptoPure, nextMd *RootMetadata) error {
	err := md.CheckValidSuccessor(crypto, nextMd)
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
			Expected: err.currRoot,
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

func (md *RootMetadata) getTLFKeyBundles(keyGen KeyGen) (*TLFWriterKeyBundle, *TLFReaderKeyBundle, error) {
	if md.ID.IsPublic() {
		return nil, nil, InvalidPublicTLFOperation{md.ID, "getTLFKeyBundle"}
	}

	if keyGen < FirstValidKeyGen {
		return nil, nil, InvalidKeyGenerationError{md.GetTlfHandle(), keyGen}
	}
	i := int(keyGen - FirstValidKeyGen)
	if i >= len(md.WKeys) || i >= len(md.RKeys) {
		return nil, nil, NewKeyGenerationError{md.GetTlfHandle(), keyGen}
	}
	return &md.WKeys[i], &md.RKeys[i], nil
}

// GetTLFCryptKeyInfo returns the TLFCryptKeyInfo entry for the given user
// and device at the given key generation.
func (md *RootMetadata) GetTLFCryptKeyInfo(keyGen KeyGen, user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (
	info TLFCryptKeyInfo, ok bool, err error) {
	wkb, rkb, err := md.getTLFKeyBundles(keyGen)
	if err != nil {
		return TLFCryptKeyInfo{}, false, err
	}

	key := currentCryptPublicKey.kid
	if u, ok1 := wkb.WKeys[user]; ok1 {
		info, ok := u[key]
		return info, ok, nil
	} else if u, ok1 = rkb.RKeys[user]; ok1 {
		info, ok := u[key]
		return info, ok, nil
	}
	return TLFCryptKeyInfo{}, false, nil
}

// GetTLFCryptPublicKeys returns the public crypt keys for the given user
// at the given key generation.
func (md *RootMetadata) GetTLFCryptPublicKeys(keyGen KeyGen, user keybase1.UID) (
	[]keybase1.KID, bool) {
	wkb, rkb, err := md.getTLFKeyBundles(keyGen)
	if err != nil {
		return nil, false
	}

	if u, ok1 := wkb.WKeys[user]; ok1 {
		return u.GetKIDs(), true
	} else if u, ok1 = rkb.RKeys[user]; ok1 {
		return u.GetKIDs(), true
	}
	return nil, false
}

// GetTLFEphemeralPublicKey returns the ephemeral public key used for
// the TLFCryptKeyInfo for the given user and device.
func (md *RootMetadata) GetTLFEphemeralPublicKey(
	keyGen KeyGen, user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (TLFEphemeralPublicKey, error) {
	wkb, rkb, err := md.getTLFKeyBundles(keyGen)
	if err != nil {
		return TLFEphemeralPublicKey{}, err
	}

	info, ok, err := md.GetTLFCryptKeyInfo(
		keyGen, user, currentCryptPublicKey)
	if err != nil {
		return TLFEphemeralPublicKey{}, err
	}
	if !ok {
		return TLFEphemeralPublicKey{},
			TLFEphemeralPublicKeyNotFoundError{
				user, currentCryptPublicKey.kid}
	}

	if info.EPubKeyIndex < 0 {
		return rkb.TLFReaderEphemeralPublicKeys[-1-info.EPubKeyIndex], nil
	}
	return wkb.TLFEphemeralPublicKeys[info.EPubKeyIndex], nil
}

// LatestKeyGeneration returns the newest key generation for this RootMetadata.
func (md *RootMetadata) LatestKeyGeneration() KeyGen {
	if md.ID.IsPublic() {
		return PublicKeyGen
	}
	return md.WKeys.LatestKeyGeneration()
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

func (md *RootMetadata) makeBareTlfHandle() (BareTlfHandle, error) {
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

// MakeBareTlfHandle makes a BareTlfHandle for this
// RootMetadata. Should be used only by servers and MDOps.
func (md *RootMetadata) MakeBareTlfHandle() (BareTlfHandle, error) {
	if md.tlfHandle != nil {
		panic(errors.New("MakeBareTlfHandle called when md.tlfHandle exists"))
	}

	return md.makeBareTlfHandle()
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

// MetadataID computes and caches the MdID for this RootMetadata
func (md *RootMetadata) MetadataID(crypto cryptoPure) (MdID, error) {
	mdID := func() MdID {
		md.mdIDLock.RLock()
		defer md.mdIDLock.RUnlock()
		return md.mdID
	}()
	if mdID != (MdID{}) {
		return mdID, nil
	}

	mdID, err := crypto.MakeMdID(md)
	if err != nil {
		return MdID{}, err
	}

	md.mdIDLock.Lock()
	defer md.mdIDLock.Unlock()
	md.mdID = mdID
	return mdID, nil
}

// clearMetadataID forgets the cached version of the RootMetadata's MdID
func (md *RootMetadata) clearCachedMetadataIDForTest() {
	md.mdIDLock.Lock()
	defer md.mdIDLock.Unlock()
	md.mdID = MdID{}
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
	return makeRekeyReadError(md, resolvedHandle, md.LatestKeyGeneration(),
		uid, username)
}

// writerKID returns the KID of the writer.
func (md *RootMetadata) writerKID() keybase1.KID {
	return md.WriterMetadataSigInfo.VerifyingKey.KID()
}

// VerifyWriterMetadata verifies md's WriterMetadata against md's
// WriterMetadataSigInfo, assuming the verifying key there is valid.
func (md *RootMetadata) VerifyWriterMetadata(codec Codec, crypto Crypto) error {
	// We have to re-marshal the WriterMetadata, since it's
	// embedded.
	buf, err := codec.Encode(md.WriterMetadata)
	if err != nil {
		return err
	}

	err = crypto.Verify(buf, md.WriterMetadataSigInfo)
	if err != nil {
		return err
	}

	return nil
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

// TlfHandleExtensions returns a list of handle extensions associated with the TLf.
func (md *RootMetadata) TlfHandleExtensions() (extensions []TlfHandleExtension) {
	if md.ConflictInfo != nil {
		extensions = append(extensions, *md.ConflictInfo)
	}
	if md.FinalizedInfo != nil {
		extensions = append(extensions, *md.FinalizedInfo)
	}
	return extensions
}

// RootMetadataSigned is the top-level MD object stored in MD server
type RootMetadataSigned struct {
	// signature over the root metadata by the private signing key
	SigInfo SignatureInfo `codec:",omitempty"`
	// all the metadata
	MD RootMetadata
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
func (rmds *RootMetadataSigned) VerifyRootMetadata(codec Codec, crypto Crypto) error {
	md := &rmds.MD
	if rmds.MD.IsFinal() {
		var err error
		md, err = rmds.MD.deepCopy(codec, false)
		if err != nil {
			return err
		}
		// Mask out finalized additions.  These are the only things allowed
		// to change in the finalized metadata block.
		md.Flags &= ^MetadataFlagFinal
		md.Revision--
		md.FinalizedInfo = nil
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
	err := rmds.MD.deepCopyInPlace(config.Codec(), false, &newRmds.MD)
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

func makeRekeyReadError(
	md *RootMetadata, resolvedHandle *TlfHandle, keyGen KeyGen,
	uid keybase1.UID, username libkb.NormalizedUsername) error {
	// If the user is not a legitimate reader of the folder, this is a
	// normal read access error.
	if resolvedHandle.IsPublic() {
		panic("makeRekeyReadError called on public folder")
	}
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
