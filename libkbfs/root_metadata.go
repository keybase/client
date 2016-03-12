package libkbfs

import (
	"bytes"
	"reflect"
	"sort"
	"strconv"
	"time"

	keybase1 "github.com/keybase/client/go/protocol"
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
	// When the above Changes field gets unembedded into its own
	// block, we may want to temporarily keep around the old
	// BlockChanges for easy reference.
	cachedChanges BlockChanges
}

// Equals returns true if the given PrivateMetadata is equal to this
// PrivateMetadata.
func (pm PrivateMetadata) Equals(other PrivateMetadata) bool {
	return pm.Dir == other.Dir &&
		pm.TLFPrivateKey == other.TLFPrivateKey &&
		pm.Changes.Equals(other.Changes)
}

// MetadataFlags bitfield.
type MetadataFlags byte

// Possible flags set in the MetadataFlags bitfield.
const (
	MetadataFlagRekey MetadataFlags = 1 << iota
	MetadataFlagWriterMetadataCopied
)

// WriterFlags bitfield.
type WriterFlags byte

// Possible flags set in the MetadataFlags bitfield.
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
}

// Equals compares two sets of WriterMetadata and returns true if they match.
func (wm WriterMetadata) Equals(rhs WriterMetadata) bool {
	if wm.ID != rhs.ID {
		return false
	}
	if wm.BID != rhs.BID {
		return false
	}
	if wm.LastModifyingWriter != rhs.LastModifyingWriter {
		return false
	}
	if wm.WFlags != rhs.WFlags {
		return false
	}
	if wm.DiskUsage != rhs.DiskUsage {
		return false
	}
	if wm.RefBytes != rhs.RefBytes {
		return false
	}
	if wm.UnrefBytes != rhs.UnrefBytes {
		return false
	}
	if !bytes.Equal(wm.SerializedPrivateMetadata, rhs.SerializedPrivateMetadata) {
		return false
	}
	if len(wm.Writers) != len(rhs.Writers) {
		return false
	}
	for i, w := range wm.Writers {
		if rhs.Writers[i] != w {
			return false
		}
	}
	return wm.WKeys.DeepEqual(rhs.WKeys)
}

// RootMetadata is the MD that is signed by the reader or writer.
type RootMetadata struct {
	// The metadata that is only editable by the writer
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
	// The client's timestamp on when the MD update was created.
	UpdateTime int64 `codec:"ut"` // in unix nanoseconds

	// The plaintext, deserialized PrivateMetadata
	data PrivateMetadata
	// A cached copy of the directory handle calculated for this MD.
	cachedTlfHandle *TlfHandle
	// The cached ID for this MD structure (hash)
	mdID MdID
	// unverified is set if the MD update was signed by a key that is
	// not associated with the relevant user, and we intentionally
	// skipped failing MD verification.  The user in question could be
	// either the LastModifyingUser or the LastModifyingWriter.
	unverified bool
}

func (md RootMetadata) haveOnlyUserRKeysChanged(prevMD RootMetadata, user keybase1.UID) bool {
	// Require the same number of generations
	if len(md.RKeys) != len(prevMD.RKeys) {
		return false
	}
	for i, gen := range md.RKeys {
		prevMDGen := prevMD.RKeys[i]
		if len(gen.RKeys) != len(prevMDGen.RKeys) {
			return false
		}
		for u, keys := range gen.RKeys {
			if u != user {
				prevKeys := prevMDGen.RKeys[u]
				if !reflect.DeepEqual(keys, prevKeys) {
					return false
				}
			}
		}
	}
	return true
}

// IsValidRekeyRequest returns true if the current block is a simple rekey wrt
// the passed block.
func (md RootMetadata) IsValidRekeyRequest(config Config, prevMd RootMetadata, user keybase1.UID) bool {
	if md.IsWriterMetadataCopiedSet() &&
		md.WriterMetadata.Equals(prevMd.WriterMetadata) &&
		md.haveOnlyUserRKeysChanged(prevMd, user) {
		return true
	}
	return false
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

// NewRootMetadata constructs a new RootMetadata object with the given
// handle and ID.
func NewRootMetadata(d *TlfHandle, id TlfID) *RootMetadata {
	var writers []keybase1.UID
	var wKeys TLFWriterKeyGenerations
	var rKeys TLFReaderKeyGenerations
	if id.IsPublic() {
		writers = make([]keybase1.UID, 0, 1)
	} else {
		wKeys = make(TLFWriterKeyGenerations, 0, 1)
		rKeys = make(TLFReaderKeyGenerations, 0, 1)
	}
	md := RootMetadata{
		WriterMetadata: WriterMetadata{
			Writers: writers,
			WKeys:   wKeys,
			ID:      id,
			BID:     BranchID{},
		},
		Revision: MetadataRevisionInitial,
		RKeys:    rKeys,
		data:     PrivateMetadata{},
		// need to keep the dir handle around long
		// enough to rekey the metadata for the first
		// time
		cachedTlfHandle: d,
	}
	return &md
}

// Data returns the private metadata of this RootMetadata.
func (md RootMetadata) Data() *PrivateMetadata {
	return &md.data
}

// IsReadable returns true if the private metadata can be read.
func (md RootMetadata) IsReadable() bool {
	return md.ID.IsPublic() || md.data.Dir.IsInitialized()
}

// increment makes this MD the immediate follower of the given
// currMD.  It assumes md was deep-copied from currMD.
func (md *RootMetadata) increment(config Config, currMD *RootMetadata) error {
	var err error
	md.PrevRoot, err = currMD.MetadataID(config)
	if err != nil {
		return err
	}
	// bump revision
	if md.Revision < MetadataRevisionInitial {
		md.Revision = MetadataRevisionInitial
	} else {
		md.Revision = currMD.Revision + 1
	}
	return nil
}

// MakeSuccessor returns a complete copy of this RootMetadata (but
// with cleared block change lists and cleared serialized metadata),
// with the revision incremented and a correct backpointer.
func (md RootMetadata) MakeSuccessor(config Config, isWriter bool) (RootMetadata, error) {
	newMd := md
	// no need to copy the serialized metadata, if it exists
	newMd.Writers = make([]keybase1.UID, len(md.Writers))
	copy(newMd.Writers, md.Writers)
	newMd.WKeys = md.WKeys.DeepCopy()
	newMd.RKeys = md.RKeys.DeepCopy()
	newMd.UpdateTime = config.Clock().Now().UnixNano()
	if md.IsReadable() && isWriter {
		newMd.ClearBlockChanges()
		// no need to deep copy the full data since we just cleared the
		// block changes.
		newMd.data.TLFPrivateKey = md.data.TLFPrivateKey
		// clear the serialized data.
		newMd.SerializedPrivateMetadata = nil
		// remove the copied flag (if any.)
		newMd.Flags &= ^MetadataFlagWriterMetadataCopied
	} else {
		// if we can't read it it means we're simply setting the rekey bit
		// and copying the previous data.
		newMd.Flags |= MetadataFlagRekey
		newMd.Flags |= MetadataFlagWriterMetadataCopied
	}
	newMd.ClearMetadataID()
	if err := newMd.increment(config, &md); err != nil {
		return RootMetadata{}, err
	}
	return newMd, nil
}

// TODO get rid of this once we're fully dependent on reader and writer metadata separately
func (md RootMetadata) getTLFKeyBundle(keyGen KeyGen) (*TLFKeyBundle, error) {
	if md.ID.IsPublic() {
		return nil, InvalidPublicTLFOperation{md.ID, "getTLFKeyBundle"}
	}

	if keyGen < FirstValidKeyGen {
		return nil, InvalidKeyGenerationError{md.GetTlfHandle(), keyGen}
	}
	i := int(keyGen - FirstValidKeyGen)
	if i >= len(md.WKeys) || i >= len(md.RKeys) {
		return nil, NewKeyGenerationError{md.GetTlfHandle(), keyGen}
	}
	return &TLFKeyBundle{
		md.WKeys[i],
		md.RKeys[i],
	}, nil
}

// GetTLFCryptKeyInfo returns the TLFCryptKeyInfo entry for the given user
// and device at the given key generation.
func (md RootMetadata) GetTLFCryptKeyInfo(keyGen KeyGen, user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (
	info TLFCryptKeyInfo, ok bool, err error) {
	tkb, err := md.getTLFKeyBundle(keyGen)
	if err != nil {
		return
	}

	return tkb.GetTLFCryptKeyInfo(user, currentCryptPublicKey)
}

// GetTLFCryptPublicKeys returns the public crypt keys for the given user
// at the given key generation.
func (md RootMetadata) GetTLFCryptPublicKeys(keyGen KeyGen, user keybase1.UID) (
	[]keybase1.KID, bool) {
	tkb, err := md.getTLFKeyBundle(keyGen)
	if err != nil {
		return nil, false
	}

	return tkb.GetTLFCryptPublicKeys(user)
}

// GetTLFEphemeralPublicKey returns the ephemeral public key used for
// the TLFCryptKeyInfo for the given user and device.
func (md RootMetadata) GetTLFEphemeralPublicKey(
	keyGen KeyGen, user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (TLFEphemeralPublicKey, error) {
	tkb, err := md.getTLFKeyBundle(keyGen)
	if err != nil {
		return TLFEphemeralPublicKey{}, err
	}

	return tkb.GetTLFEphemeralPublicKey(user, currentCryptPublicKey)
}

// LatestKeyGeneration returns the newest key generation for this RootMetadata.
func (md RootMetadata) LatestKeyGeneration() KeyGen {
	if md.ID.IsPublic() {
		return PublicKeyGen
	}
	return md.WKeys.LatestKeyGeneration()
}

// AddNewKeys makes a new key generation for this RootMetadata using the
// given TLFKeyBundle.
func (md *RootMetadata) AddNewKeys(keys TLFKeyBundle) error {
	if md.ID.IsPublic() {
		return InvalidPublicTLFOperation{md.ID, "AddNewKeys"}
	}
	md.WKeys = append(md.WKeys, keys.TLFWriterKeyBundle)
	md.RKeys = append(md.RKeys, keys.TLFReaderKeyBundle)
	return nil
}

// GetTlfHandle computes and returns the TlfHandle for this
// RootMetadata, caching it in the process.
func (md *RootMetadata) GetTlfHandle() *TlfHandle {
	if md.cachedTlfHandle != nil {
		return md.cachedTlfHandle
	}

	h := &TlfHandle{}
	if md.ID.IsPublic() {
		h.Readers = []keybase1.UID{keybase1.PublicUID}
		h.Writers = make([]keybase1.UID, len(md.Writers))
		copy(h.Writers, md.Writers)
	} else {
		wtkb := md.WKeys[len(md.WKeys)-1]
		rtkb := md.RKeys[len(md.RKeys)-1]
		h.Writers = make([]keybase1.UID, 0, len(wtkb.WKeys))
		h.Readers = make([]keybase1.UID, 0, len(rtkb.RKeys))
		for w := range wtkb.WKeys {
			h.Writers = append(h.Writers, w)
		}
		for r := range rtkb.RKeys {
			// TODO: Return an error instead if r is
			// PublicUID. Maybe return an error if r is in
			// WKeys also.
			if _, ok := wtkb.WKeys[r]; !ok &&
				r != keybase1.PublicUID {
				h.Readers = append(h.Readers, r)
			}
		}
	}
	sort.Sort(UIDList(h.Writers))
	sort.Sort(UIDList(h.Readers))
	md.cachedTlfHandle = h
	return h
}

// IsInitialized returns whether or not this RootMetadata has been initialized
func (md RootMetadata) IsInitialized() bool {
	keyGen := md.LatestKeyGeneration()
	if md.ID.IsPublic() {
		return keyGen == PublicKeyGen
	}
	// The data is only initialized once we have at least one set of keys
	return keyGen >= FirstValidKeyGen
}

// MetadataID computes and caches the MdID for this RootMetadata
func (md *RootMetadata) MetadataID(config Config) (MdID, error) {
	if md.mdID != (MdID{}) {
		return md.mdID, nil
	}

	mdID, err := config.Crypto().MakeMdID(md)
	if err != nil {
		return MdID{}, err
	}
	md.mdID = mdID
	return mdID, nil
}

// ClearMetadataID forgets the cached version of the RootMetadata's MdID
func (md *RootMetadata) ClearMetadataID() {
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
	return makeRekeyReadError(ctx, config, md, md.LatestKeyGeneration(),
		uid, username)
}

// writerKID returns the KID of the writer.
func (md RootMetadata) writerKID() keybase1.KID {
	return md.WriterMetadataSigInfo.VerifyingKey.KID()
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

// MerkleHash computes a hash of this RootMetadataSigned object for inclusion
// into the KBFS Merkle tree.
func (rmds *RootMetadataSigned) MerkleHash(config Config) (MerkleHash, error) {
	return config.Crypto().MakeMerkleHash(rmds)
}
