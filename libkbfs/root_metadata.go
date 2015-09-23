package libkbfs

import (
	"sort"
	"strconv"

	keybase1 "github.com/keybase/client/protocol/go"
)

// PrivateMetadata contains the portion of metadata that's secret for private
// directories
type PrivateMetadata struct {
	// directory entry for the root directory block
	Dir DirEntry
	// the last KB user who wrote this metadata
	LastWriter keybase1.UID

	// m_f as described in 4.1.1 of https://keybase.io/blog/crypto
	// .
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
	return pm.Dir == other.Dir && pm.LastWriter == other.LastWriter &&
		pm.TLFPrivateKey == other.TLFPrivateKey &&
		pm.Changes.Equals(other.Changes)
}

// MetadataFlags bitmask.
type MetadataFlags byte

// Possible flags set in the MetdataFlags bitmask.
const (
	MetadataFlagRekey MetadataFlags = 1 << iota
	MetadataFlagUnmerged
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

// RootMetadata is the MD that is signed by the writer.
type RootMetadata struct {
	// Serialized, possibly encrypted, version of the PrivateMetadata
	SerializedPrivateMetadata []byte `codec:"data"`
	// For public TLFs (since those don't have any keys at all).
	Writers []keybase1.UID
	// For private TLFs. Key generations for this metadata. The
	// most recent one is last in the array.
	Keys []DirKeyBundle
	// Pointer to the previous root block ID
	PrevRoot MdID
	// The directory ID, signed over to make verification easier
	ID TlfID
	// The revision number
	Revision MetadataRevision
	// Flags
	Flags MetadataFlags
	// Estimated disk usage at this revision
	DiskUsage uint64

	// The total number of bytes in new blocks
	RefBytes uint64
	// The total number of bytes in unreferenced blocks
	UnrefBytes uint64

	// The plaintext, deserialized PrivateMetadata
	data PrivateMetadata
	// A cached copy of the directory handle calculated for this MD.
	cachedTlfHandle *TlfHandle
	// The cached ID for this MD structure (hash)
	mdID MdID
}

// GetKeyGeneration returns the current key generation for the current block.
func (md *RootMetadata) GetKeyGeneration() KeyGen {
	return KeyGen(len(md.Keys))
}

// MergedStatus returns the status of this update -- has it been
// merged into the main folder or not?
func (md *RootMetadata) MergedStatus() MergeStatus {
	if md.Flags&MetadataFlagUnmerged != 0 {
		return Unmerged
	}
	return Merged
}

// IsRekeySet returns true if the rekey bit is set.
func (md *RootMetadata) IsRekeySet() bool {
	return md.Flags&MetadataFlagRekey != 0
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
	keyGen := md.GetKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return md.Keys[keyGen-1].IsWriter(user, deviceKID)
}

// IsReader returns whether or not the user+device is an authorized reader.
func (md *RootMetadata) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	if md.ID.IsPublic() {
		return true
	}
	keyGen := md.GetKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return md.Keys[keyGen-1].IsReader(user, deviceKID)
}

// NewRootMetadata constructs a new RootMetadata object with the given
// handle and ID.
func NewRootMetadata(d *TlfHandle, id TlfID) *RootMetadata {
	var writers []keybase1.UID
	if id.IsPublic() {
		writers = make([]keybase1.UID, 0, 1)
	}
	var keys []DirKeyBundle
	if id.IsPublic() {
		keys = make([]DirKeyBundle, 0, 1)
	}
	md := RootMetadata{
		Writers: writers,
		Keys:    keys,
		ID:      id,
		data:    PrivateMetadata{},
		// need to keep the dir handle around long
		// enough to rekey the metadata for the first
		// time
		cachedTlfHandle: d,
		Revision:        MetadataRevisionInitial,
	}
	return &md
}

// Data returns the private metadata of this RootMetadata.
func (md RootMetadata) Data() *PrivateMetadata {
	return &md.data
}

// DeepCopy returns a complete copy of this RootMetadata (but with
// cleared block change lists and cleared serialized metadata).
func (md RootMetadata) DeepCopy() RootMetadata {
	newMd := md
	// no need to copy the serialized metadata, if it exists
	newMd.Writers = make([]keybase1.UID, len(md.Writers))
	copy(newMd.Writers, md.Writers)
	newMd.Keys = make([]DirKeyBundle, len(md.Keys))
	for i, k := range md.Keys {
		newMd.Keys[i] = k.DeepCopy()
	}
	newMd.ClearBlockChanges()
	newMd.ClearMetadataID()
	// no need to deep copy the full data since we just cleared the
	// block changes.
	newMd.data.TLFPrivateKey = md.data.TLFPrivateKey.DeepCopy()
	return newMd
}

func (md RootMetadata) getDirKeyBundle(keyGen KeyGen) (*DirKeyBundle, error) {
	if md.ID.IsPublic() {
		return nil, InvalidPublicTLFOperation{md.ID, "getDirKeyBundle"}
	}

	if keyGen < FirstValidKeyGen {
		return nil, InvalidKeyGenerationError{md.GetTlfHandle(), keyGen}
	}
	i := int(keyGen - FirstValidKeyGen)
	if i >= len(md.Keys) {
		return nil, NewKeyGenerationError{md.GetTlfHandle(), keyGen}
	}
	return &md.Keys[i], nil
}

// GetTLFCryptKeyInfo returns the TLFCryptKeyInfo entry for the given user
// and device at the given key generation.
func (md RootMetadata) GetTLFCryptKeyInfo(keyGen KeyGen, user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (
	info TLFCryptKeyInfo, ok bool, err error) {
	dkb, err := md.getDirKeyBundle(keyGen)
	if err != nil {
		return
	}

	key := currentCryptPublicKey.KID
	if u, ok1 := dkb.WKeys[user]; ok1 {
		info, ok = u[key]
	} else if u, ok1 = dkb.RKeys[user]; ok1 {
		info, ok = u[key]
	}
	return
}

// GetTLFEphemeralPublicKey returns the ephemeral public key for this
// top-level folder.
func (md RootMetadata) GetTLFEphemeralPublicKey(
	keyGen KeyGen, user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (TLFEphemeralPublicKey, error) {
	dkb, err := md.getDirKeyBundle(keyGen)
	if err != nil {
		return TLFEphemeralPublicKey{}, err
	}

	key := currentCryptPublicKey.KID
	var info TLFCryptKeyInfo
	var ok bool
	if u, ok1 := dkb.WKeys[user]; ok1 {
		info, ok = u[key]
	} else if u, ok1 = dkb.RKeys[user]; ok1 {
		info, ok = u[key]
	}
	if !ok || info.EPubKeyIndex >= len(dkb.TLFEphemeralPublicKeys) {
		return TLFEphemeralPublicKey{},
			TLFEphemeralPublicKeyNotFoundError{md.ID, keyGen, user, key}
	}

	return dkb.TLFEphemeralPublicKeys[info.EPubKeyIndex], nil
}

// LatestKeyGeneration returns the newest key generation for this RootMetadata.
func (md RootMetadata) LatestKeyGeneration() KeyGen {
	if md.ID.IsPublic() {
		return PublicKeyGen
	}
	if len(md.Keys) == 0 {
		// Return an invalid value.
		return KeyGen(0)
	}
	return FirstValidKeyGen + KeyGen(len(md.Keys)-1)
}

// AddNewKeys makes a new key generation for this RootMetadata using the
// given DirKeyBundle.
func (md *RootMetadata) AddNewKeys(keys DirKeyBundle) error {
	if md.ID.IsPublic() {
		return InvalidPublicTLFOperation{md.ID, "AddNewKeys"}
	}
	md.Keys = append(md.Keys, keys)
	return nil
}

// SetKeys overwrites the given key generation for this RootMetadata
// using the given DirKeyBundle.
func (md *RootMetadata) SetKeys(keyGen KeyGen, keys DirKeyBundle) error {
	if md.ID.IsPublic() {
		return InvalidPublicTLFOperation{md.ID, "SetKeys"}
	}
	i := int(keyGen - FirstValidKeyGen)
	if i >= len(md.Keys) {
		return NewKeyGenerationError{md.GetTlfHandle(), keyGen}
	}
	md.Keys[i] = keys
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
		dkb := &md.Keys[len(md.Keys)-1]
		for w := range dkb.WKeys {
			h.Writers = append(h.Writers, w)
		}
		for r := range dkb.RKeys {
			// TODO: Return an error instead if r is
			// PublicUID. Maybe return an error if r is in
			// WKeys also.
			if _, ok := dkb.WKeys[r]; !ok &&
				r != keybase1.PublicUID {
				h.Readers = append(h.Readers, r)
			}
		}
	}
	sort.Sort(uidList(h.Writers))
	sort.Sort(uidList(h.Readers))
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
	md.data.Changes.Ops = nil
}

// RootMetadataSigned is the top-level MD object stored in MD server
type RootMetadataSigned struct {
	// signature over the root metadata by the private signing key
	SigInfo SignatureInfo `codec:",omitempty"`
	// all the metadata
	MD RootMetadata
}

// IsInitialized returns whether or not this RootMetadataSigned object
// has been finalized by some writer.
func (rmds *RootMetadataSigned) IsInitialized() bool {
	// The data is initialized only if there is a signature.
	return !rmds.SigInfo.IsNil()
}
