// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"strconv"

	"github.com/keybase/client/go/protocol"
	"github.com/keybase/go-codec/codec"
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
// WriterMetadata directly because it's embedded in BareRootMetadata.
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

// BareRootMetadata is the MD that is signed by the reader or
// writer. Unlike RootMetadata, it contains exactly the serializable
// metadata.
type BareRootMetadata struct {
	// The metadata that is only editable by the writer.
	//
	// TODO: If we ever get a chance to update BareRootMetadata
	// without having to be backwards-compatible, WriterMetadata
	// should be unembedded; see comments to WriterMetadata as for
	// why.
	WriterMetadata

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

func (md *BareRootMetadata) haveOnlyUserRKeysChanged(
	codec Codec, prevMD *BareRootMetadata, user keybase1.UID) (bool, error) {
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
func (md *BareRootMetadata) IsValidRekeyRequest(
	codec Codec, prevMd *BareRootMetadata, user keybase1.UID) (bool, error) {
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
func (md *BareRootMetadata) MergedStatus() MergeStatus {
	if md.WFlags&MetadataFlagUnmerged != 0 {
		return Unmerged
	}
	return Merged
}

// IsRekeySet returns true if the rekey bit is set.
func (md *BareRootMetadata) IsRekeySet() bool {
	return md.Flags&MetadataFlagRekey != 0
}

// IsWriterMetadataCopiedSet returns true if the bit is set indicating
// the writer metadata was copied.
func (md *BareRootMetadata) IsWriterMetadataCopiedSet() bool {
	return md.Flags&MetadataFlagWriterMetadataCopied != 0
}

// IsFinal returns true if this is the last metadata block for a given
// folder.  This is only expected to be set for folder resets.
func (md *BareRootMetadata) IsFinal() bool {
	return md.Flags&MetadataFlagFinal != 0
}

// IsWriter returns whether or not the user+device is an authorized writer.
func (md *BareRootMetadata) IsWriter(
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

// IsReader returns whether or not the user+device is an authorized reader.
func (md *BareRootMetadata) IsReader(
	user keybase1.UID, deviceKID keybase1.KID) bool {
	if md.ID.IsPublic() {
		return true
	}
	return md.RKeys.IsReader(user, deviceKID)
}

// updateNewBareRootMetadata initializes the given freshly-created
// BareRootMetadata object with the given TlfID and
// BareTlfHandle. Note that if the given ID/handle are private,
// rekeying must be done separately.
func updateNewBareRootMetadata(
	rmd *BareRootMetadata, id TlfID, h BareTlfHandle) error {
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

func (md *BareRootMetadata) deepCopy(codec Codec) (*BareRootMetadata, error) {
	var newMd BareRootMetadata
	if err := md.deepCopyInPlace(codec, &newMd); err != nil {
		return nil, err
	}
	return &newMd, nil
}

func (md *BareRootMetadata) deepCopyInPlace(codec Codec, newMd *BareRootMetadata) error {
	if err := CodecUpdate(codec, newMd, md); err != nil {
		return err
	}
	return nil
}

// CheckValidSuccessor makes sure the given BareRootMetadata is a valid
// successor to the current one, and returns an error otherwise.
func (md *BareRootMetadata) CheckValidSuccessor(
	currID MdID, nextMd *BareRootMetadata) error {
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
	expectedPrevRoot := currID
	if nextMd.IsFinal() {
		expectedPrevRoot = md.PrevRoot
	}
	if nextMd.PrevRoot != expectedPrevRoot {
		return MDPrevRootMismatch{
			prevRoot:         nextMd.PrevRoot,
			expectedPrevRoot: expectedPrevRoot,
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

// LatestKeyGeneration returns the newest key generation for this BareRootMetadata.
func (md *BareRootMetadata) LatestKeyGeneration() KeyGen {
	if md.ID.IsPublic() {
		return PublicKeyGen
	}
	return md.WKeys.LatestKeyGeneration()
}

// CheckValidSuccessorForServer is like CheckValidSuccessor but with
// server-specific error messages.
func (md *BareRootMetadata) CheckValidSuccessorForServer(
	currID MdID, nextMd *BareRootMetadata) error {
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

func (md *BareRootMetadata) makeBareTlfHandle() (BareTlfHandle, error) {
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
// BareRootMetadata. Should be used only by servers and MDOps.
func (md *BareRootMetadata) MakeBareTlfHandle() (BareTlfHandle, error) {
	return md.makeBareTlfHandle()
}

// writerKID returns the KID of the writer.
func (md *BareRootMetadata) writerKID() keybase1.KID {
	return md.WriterMetadataSigInfo.VerifyingKey.KID()
}

// VerifyWriterMetadata verifies md's WriterMetadata against md's
// WriterMetadataSigInfo, assuming the verifying key there is valid.
func (md *BareRootMetadata) VerifyWriterMetadata(
	codec Codec, crypto Crypto) error {
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

// TlfHandleExtensions returns a list of handle extensions associated with the TLf.
func (md *BareRootMetadata) TlfHandleExtensions() (
	extensions []TlfHandleExtension) {
	if md.ConflictInfo != nil {
		extensions = append(extensions, *md.ConflictInfo)
	}
	if md.FinalizedInfo != nil {
		extensions = append(extensions, *md.FinalizedInfo)
	}
	return extensions
}
