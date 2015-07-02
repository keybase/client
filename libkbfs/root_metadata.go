package libkbfs

import (
	"sort"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
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
}

// Equals returns true if the given PrivateMetadata is equal to this
// PrivateMetadata.
func (pm PrivateMetadata) Equals(other PrivateMetadata) bool {
	return pm.Dir == other.Dir && pm.LastWriter == other.LastWriter &&
		pm.TLFPrivateKey == other.TLFPrivateKey &&
		pm.Changes.Equals(other.Changes)
}

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
	ID DirID
	// The revision number
	Revision uint64

	// The total number of bytes in new blocks
	RefBytes uint64
	// The total number of bytes in unreferenced blocks
	UnrefBytes uint64

	// The plaintext, deserialized PrivateMetadata
	data PrivateMetadata
	// A cached copy of the directory handle calculated for this MD.
	cachedDirHandle *DirHandle
	// The cached ID for this MD structure (hash)
	mdID MdID
}

// GetKeyGeneration returns the current key generation for the current block.
func (md *RootMetadata) GetKeyGeneration() int {
	return len(rmd.Keys)
}

// NewRootMetadata constructs a new RootMetadata object with the given
// handle and ID.
func NewRootMetadata(d *DirHandle, id DirID) *RootMetadata {
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
		cachedDirHandle: d,
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
		return nil, InvalidKeyGenerationError{*md.GetDirHandle(), keyGen}
	}
	i := int(keyGen - FirstValidKeyGen)
	if i >= len(md.Keys) {
		return nil, NewKeyGenerationError{*md.GetDirHandle(), keyGen}
	}
	return &md.Keys[i], nil
}

// GetEncryptedTLFCryptKeyClientHalfData returns the encrypted buffer
// of the given user's client key half for this top-level folder.
func (md RootMetadata) GetEncryptedTLFCryptKeyClientHalfData(
	keyGen KeyGen, user keybase1.UID, currentCryptPublicKey CryptPublicKey) (
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf, ok bool, err error) {
	dkb, err := md.getDirKeyBundle(keyGen)
	if err != nil {
		return
	}

	key := currentCryptPublicKey.KID.ToMapKey()
	if u, ok1 := dkb.WKeys[user]; ok1 {
		encryptedClientHalf, ok = u[key]
	} else if u, ok1 = dkb.RKeys[user]; ok1 {
		encryptedClientHalf, ok = u[key]
	}
	return
}

// GetTLFEphemeralPublicKey returns the ephemeral public key for this
// top-level folder.
func (md RootMetadata) GetTLFEphemeralPublicKey(
	keyGen KeyGen) (TLFEphemeralPublicKey, error) {
	dkb, err := md.getDirKeyBundle(keyGen)
	if err != nil {
		return TLFEphemeralPublicKey{}, err
	}
	return dkb.TLFEphemeralPublicKey, nil
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

// GetDirHandle computes and returns the DirHandle for this
// RootMetadata, caching it in the process.
func (md *RootMetadata) GetDirHandle() *DirHandle {
	if md.cachedDirHandle != nil {
		return md.cachedDirHandle
	}

	h := &DirHandle{}
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
	md.cachedDirHandle = h
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
	if md.mdID != NullMdID {
		return md.mdID, nil
	}

	// Make sure that the serialized metadata is set, otherwise we
	// won't get the right MdID
	if md.SerializedPrivateMetadata == nil {
		return NullMdID, MDMissingDataError{md.ID}
	}

	buf, err := config.Codec().Encode(md)
	if err != nil {
		return NullMdID, err
	}
	h, err := config.Crypto().Hash(buf)
	if err != nil {
		return NullMdID, err
	}
	nhs, ok := h.(libkb.NodeHashShort)
	if !ok {
		return NullMdID, &BadCryptoMDError{md.ID}
	}
	md.mdID = MdID(nhs)
	return md.mdID, nil
}

// ClearMetadataID forgets the cached version of the RootMetadata's MdID
func (md *RootMetadata) ClearMetadataID() {
	md.mdID = NullMdID
}

// AddRefBlock adds the newly-referenced block to the add block change list.
func (md *RootMetadata) AddRefBlock(info BlockInfo) {
	md.RefBytes += uint64(info.EncodedSize)
	md.data.Changes.AddRefBlock(stripBP(info.BlockPointer))
}

// AddUnrefBlock adds the newly-unreferenced block to the add block change list.
func (md *RootMetadata) AddUnrefBlock(info BlockInfo) {
	if info.EncodedSize > 0 {
		md.UnrefBytes += uint64(info.EncodedSize)
		md.data.Changes.AddUnrefBlock(stripBP(info.BlockPointer))
	}
}

// AddUpdate adds the newly-updated block to the add block change list.
func (md *RootMetadata) AddUpdate(oldInfo BlockInfo, newInfo BlockInfo) {
	if oldInfo.EncodedSize > 0 {
		md.UnrefBytes += uint64(oldInfo.EncodedSize)
		md.RefBytes += uint64(newInfo.EncodedSize)
		md.data.Changes.AddUpdate(stripBP(oldInfo.BlockPointer),
			stripBP(newInfo.BlockPointer))
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
	md.data.Changes.latestOp = nil
	md.data.Changes.Ops = nil
}

// RootMetadataSigned is the top-level MD object stored in MD server
type RootMetadataSigned struct {
	// signature over the root metadata by the private signing key
	// (for "home" folders and public folders)
	SigInfo SignatureInfo `codec:",omitempty"`
	// pairwise MAC of the last writer with all readers and writers
	// (for private shares)
	Macs map[keybase1.UID][]byte `codec:",omitempty"`
	// all the metadata
	MD RootMetadata
}

// IsInitialized returns whether or not this RootMetadataSigned object
// has been finalized by some writer.
func (rmds *RootMetadataSigned) IsInitialized() bool {
	// The data is only if there is some sort of signature
	return !rmds.SigInfo.IsNil() || len(rmds.Macs) > 0
}
