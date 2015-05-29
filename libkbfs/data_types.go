package libkbfs

import (
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

const (
	// DirIDLen is the number of bytes in a top-level folder ID
	DirIDLen = 16
	// DirIDSuffix is the last byte of a private top-level folder ID
	DirIDSuffix = 0x16
	// PubDirIDSuffix is the last byte of a public top-level folder ID
	PubDirIDSuffix = 0x17
)

// DirID is a top-level folder ID
type DirID [DirIDLen]byte

// String implements the fmt.Stringer interface for DirID
func (d DirID) String() string {
	return hex.EncodeToString(d[:])
}

// IsPublic returns true if this DirID is for a public top-level folder
func (d DirID) IsPublic() bool {
	return d[DirIDLen-1] == PubDirIDSuffix
}

// ReaderSep is the string that separates readers from writers in a
// DirHandle string representation.
var ReaderSep = "#"

// PublicName is the reserved name of a public top-level folder.
var PublicName = "public"

// All section references below are to https://keybase.io/blog/crypto
// (version 1.3).

// A VerifyingKey is a public key that can be used to verify a
// signature created by the corresponding private signing key. In
// particular, VerifyingKeys are used to authenticate home and public
// TLFs. (See 4.2, 4.3.)
//
// These are also sometimes known as sibkeys.
type VerifyingKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto and KBPKI.
	//
	// Even though we currently use NaclSignatures, we use a KID
	// here (which encodes the key type) as we may end up storing
	// other kinds of signatures.
	KID libkb.KID
}

// IsNil returns true if the VerifyingKey is nil.
func (k VerifyingKey) IsNil() bool {
	return len(k.KID) == 0
}

// DeepCopy makes a copy of the VerifyingKey.
func (k VerifyingKey) DeepCopy() VerifyingKey {
	return VerifyingKey{k.KID[:]}
}

// String imlpements the fmt.Stringer interface for VerifyingKey.
func (k VerifyingKey) String() string {
	return k.KID.String()
}

// SigVer denotes a signature version.
type SigVer int

const (
	// SigED25519 is the signature type for ED25519
	SigED25519 SigVer = 1
)

// IsNil returns true if this SigVer is nil.
func (v SigVer) IsNil() bool {
	return int(v) == 0
}

// SignatureInfo contains all the info needed to verify a signature
// for a message.
type SignatureInfo struct {
	Version      SigVer
	Signature    []byte
	VerifyingKey VerifyingKey
}

// IsNil returns true if this SignatureInfo is nil.
func (s SignatureInfo) IsNil() bool {
	return s.Version.IsNil() && len(s.Signature) == 0 && s.VerifyingKey.IsNil()
}

// DeepCopy makes a comlete copy of this SignatureInfo.
func (s SignatureInfo) DeepCopy() SignatureInfo {
	signature := make([]byte, len(s.Signature))
	copy(signature[:], s.Signature[:])
	return SignatureInfo{s.Version, signature, s.VerifyingKey.DeepCopy()}
}

// String implements the fmt.Stringer interface for SignatureInfo.
func (s SignatureInfo) String() string {
	return fmt.Sprintf("SignatureInfo{Version: %d, Signature: %s, "+
		"VerifyingKey: %s}", s.Version, hex.EncodeToString(s.Signature[:]),
		&s.VerifyingKey)
}

// A TLFPrivateKey (m_f) is the private half of the permanent
// keypair associated with a TLF. (See 4.1.1, 5.3.)
type TLFPrivateKey struct {
}

// DeepCopy makes a complete copy of the TLFPrivateKey
func (tpk TLFPrivateKey) DeepCopy() TLFPrivateKey {
	return tpk
}

// A TLFPublicKey (M_f) is the public half of the permanent keypair
// associated with a TLF. It is included in the site-wide private-data
// Merkle tree. (See 4.1.1, 5.3.)
type TLFPublicKey struct {
}

// DeepCopy makes a complete copy of the TLFPublicKey
func (tpk TLFPublicKey) DeepCopy() TLFPublicKey {
	return tpk
}

// TLFEphemeralPrivateKey (m_e) is used (with a CryptPublicKey) to
// encrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for non-public
// directories. (See 4.1.1.)
type TLFEphemeralPrivateKey struct {
}

// CryptPublicKey (M_u^i) is used (with a TLFEphemeralPrivateKey) to
// encrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for non-public
// directories. (See 4.1.1.)  These are also sometimes known as
// subkeys.
type CryptPublicKey struct {
	KID libkb.KID
}

// TLFEphemeralPublicKey (M_e) is used along with a crypt private key
// to decrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for
// non-public directories. (See 4.1.1.)
type TLFEphemeralPublicKey struct {
}

// DeepCopy makes a complete copy of a TLFEphemeralPublicKey.
func (tepk TLFEphemeralPublicKey) DeepCopy() TLFEphemeralPublicKey {
	return tepk
}

// TLFCryptKeyServerHalf (s_u^{f,0,i}) is the masked, server-side half
// of a TLFCryptKey, which can be recovered only with both
// halves. (See 4.1.1.)
type TLFCryptKeyServerHalf struct {
}

// TLFCryptKeyClientHalf (t_u^{f,0,i}) is the masked, client-side half
// of a TLFCryptKey, which can be recovered only with both
// halves. (See 4.1.1.)
type TLFCryptKeyClientHalf struct {
}

// TLFCryptKey (s^{f,0}) is used to encrypt/decrypt the private
// portion of TLF metadata. It is also used to mask
// BlockCryptKeys. (See 4.1.1, 4.1.2.)
type TLFCryptKey struct {
}

// BlockCryptKeyServerHalf is a masked version of a BlockCryptKey,
// which can be recovered only with the TLFCryptKey used to mask the
// server half. (Note: this will be changed to match 4.1.2).
type BlockCryptKeyServerHalf struct {
}

// BlockCryptKey is used to encrypt/decrypt block data. (See 4.1.2.)
type BlockCryptKey struct {
}

// MacPublicKey (along with a private key) is used to compute and
// verify MACs. (See 4.1.3.)
type MacPublicKey struct {
}

// MAC is a buffer representing the MAC of some data.
type MAC []byte

// BlockID is the type of hash key for each data block
type BlockID libkb.NodeHashShort

// NullBlockID is an empty block ID.
var NullBlockID = BlockID{0}

// MdID is the type of hash key for each metadata block
type MdID libkb.NodeHashShort

// NullMdID is an empty MdID
var NullMdID = MdID{0}

// NullDirID is an empty DirID
var NullDirID = DirID{0}

// KeyVer is the type of a key version for a top-level folder.
type KeyVer int

// Ver is the type of a data version marshalled by KBFS.
type Ver int

// BlockPointer is the ID and BlockContext representing a block in KBFS.
type BlockPointer struct {
	ID     BlockID
	KeyVer KeyVer // which version of the DirKeyBundle to use
	Ver    Ver    // which version of the KBFS data structures is pointed to
	Writer keybase1.UID
	// When non-zero, the size of the (possibly encrypted) data
	// contained in the block. When non-zero, always at least the
	// size of the plaintext data contained in the block.
	QuotaSize uint32
}

// GetKeyVer implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetKeyVer() KeyVer {
	return p.KeyVer
}

// GetVer implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetVer() Ver {
	return p.Ver
}

// GetWriter implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetWriter() keybase1.UID {
	return p.Writer
}

// GetQuotaSize implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetQuotaSize() uint32 {
	return p.QuotaSize
}

// IsInitialized returns whether or not this BlockPointer has non-nil data.
func (p BlockPointer) IsInitialized() bool {
	return p.ID != NullBlockID
}

// DirHandle uniquely identifies top-level directories by readers and
// writers.  It is go-routine-safe.
type DirHandle struct {
	Readers     []keybase1.UID `codec:"r,omitempty"`
	Writers     []keybase1.UID `codec:"w,omitempty"`
	cachedName  string
	cachedBytes []byte
	cacheMutex  sync.Mutex // control access to the "cached" values
}

// NewDirHandle constructs a new, blank DirHandle.
func NewDirHandle() *DirHandle {
	return &DirHandle{
		Readers: make([]keybase1.UID, 0, 1),
		Writers: make([]keybase1.UID, 0, 1),
	}
}

func resolveUser(ctx context.Context, config Config, name string,
	errCh chan<- error, results chan<- keybase1.UID) {
	// TODO ResolveAssertion should take ctx
	user, err := config.KBPKI().ResolveAssertion(name)
	if err != nil {
		errCh <- err
		return
	}
	uid := user.GetUID()
	results <- uid
}

type uidList []keybase1.UID

func (u uidList) Len() int {
	return len(u)
}

func (u uidList) Less(i, j int) bool {
	return u[i].Less(u[j])
}

func (u uidList) Swap(i, j int) {
	tmp := u[i]
	u[i] = u[j]
	u[j] = tmp
}

func sortUIDS(m map[keybase1.UID]struct{}) []keybase1.UID {
	var s []keybase1.UID
	for uid := range m {
		s = append(s, uid)
	}
	sort.Sort(uidList(s))
	return s
}

// ParseDirHandle parses a DirHandle from an encoded string. See
// ToString for the opposite direction.
func ParseDirHandle(ctx context.Context, config Config, name string) (
	*DirHandle, error) {
	splitNames := strings.SplitN(name, ReaderSep, 3)
	if len(splitNames) > 2 {
		return nil, &BadPathError{name}
	}
	writerNames := strings.Split(splitNames[0], ",")
	var readerNames []string
	if len(splitNames) > 1 {
		readerNames = strings.Split(splitNames[1], ",")
	}

	// parallelize the resolutions for each user
	errCh := make(chan error, 1)
	wc := make(chan keybase1.UID, len(writerNames))
	rc := make(chan keybase1.UID, len(readerNames))
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	for _, user := range writerNames {
		go resolveUser(ctx, config, user, errCh, wc)
	}
	for _, user := range readerNames {
		go resolveUser(ctx, config, user, errCh, rc)
	}

	usedWNames := make(map[keybase1.UID]struct{}, len(writerNames))
	usedRNames := make(map[keybase1.UID]struct{}, len(readerNames))
	for i := 0; i < len(writerNames)+len(readerNames); i++ {
		select {
		case err := <-errCh:
			return nil, err
		case uid := <-wc:
			usedWNames[uid] = struct{}{}
		case uid := <-rc:
			usedRNames[uid] = struct{}{}
		}
	}

	for uid := range usedWNames {
		delete(usedRNames, uid)
	}

	d := &DirHandle{
		Writers: sortUIDS(usedWNames),
		Readers: sortUIDS(usedRNames),
	}
	return d, nil
}

// IsPublic returns whether or not this DirHandle represents a public
// top-level folder.
func (d *DirHandle) IsPublic() bool {
	return len(d.Readers) == 1 && d.Readers[0].Equal(keybase1.PublicUID)
}

// IsPrivateShare returns whether or not this DirHandle represents a
// private share (some non-public directory with more than one writer).
func (d *DirHandle) IsPrivateShare() bool {
	return !d.IsPublic() && len(d.Writers) > 1
}

// HasPublic represents whether this top-level folder should have a
// corresponding public top-level folder.
func (d *DirHandle) HasPublic() bool {
	return len(d.Readers) == 0
}

func (d *DirHandle) findUserInList(user keybase1.UID,
	users []keybase1.UID) bool {
	// TODO: this could be more efficient with a cached map/set
	for _, u := range users {
		if u == user {
			return true
		}
	}
	return false
}

// IsWriter returns whether or not the given user is a writer for the
// top-level folder represented by this DirHandle.
func (d *DirHandle) IsWriter(user keybase1.UID) bool {
	return d.findUserInList(user, d.Writers)
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this DirHandle.
func (d *DirHandle) IsReader(user keybase1.UID) bool {
	return d.IsPublic() || d.findUserInList(user, d.Readers) || d.IsWriter(user)
}

func resolveUids(config Config, uids []keybase1.UID) string {
	names := make([]string, 0, len(uids))
	// TODO: parallelize?
	for _, uid := range uids {
		if uid.Equal(keybase1.PublicUID) {
			names = append(names, PublicName)
		} else if user, err := config.KBPKI().GetUser(uid); err == nil {
			names = append(names, user.GetName())
		} else {
			config.Reporter().Report(RptE, &WrapError{err})
			names = append(names, fmt.Sprintf("uid:%s", uid))
		}
	}

	sort.Strings(names)
	return strings.Join(names, ",")
}

// ToString returns a string representation of this DirHandle
func (d *DirHandle) ToString(config Config) string {
	d.cacheMutex.Lock()
	defer d.cacheMutex.Unlock()
	if d.cachedName != "" {
		// TODO: we should expire this cache periodically
		return d.cachedName
	}

	// resolve every uid to a name
	d.cachedName = resolveUids(config, d.Writers)

	// assume only additional readers are listed
	if len(d.Readers) > 0 {
		d.cachedName += ReaderSep + resolveUids(config, d.Readers)
	}

	// TODO: don't cache if there were errors?
	return d.cachedName
}

// ToBytes marshals this DirHandle.
func (d *DirHandle) ToBytes(config Config) (out []byte) {
	d.cacheMutex.Lock()
	defer d.cacheMutex.Unlock()
	if len(d.cachedBytes) > 0 {
		return d.cachedBytes
	}

	var err error
	if out, err = config.Codec().Encode(d); err != nil {
		d.cachedBytes = out
	}
	return
}

// PathNode is a single node along an KBFS path, pointing to the top
// block for that node of the path.
type PathNode struct {
	BlockPointer
	Name string
}

// Path represents the full KBFS path to a particular location, so
// that a flush can traverse backwards and fix up ids along the way.
type Path struct {
	TopDir DirID
	Path   []PathNode
}

// TailName returns the name of the final node in the Path.
func (p Path) TailName() string {
	return p.Path[len(p.Path)-1].Name
}

// TailPointer returns the BlockPointer of the final node in the Path.
func (p Path) TailPointer() BlockPointer {
	return p.Path[len(p.Path)-1].BlockPointer
}

// String implements the fmt.Stringer interface for Path.
func (p Path) String() string {
	names := make([]string, 0, len(p.Path))
	for _, node := range p.Path {
		names = append(names, node.Name)
	}
	return strings.Join(names, "/")
}

// ParentPath returns a new Path representing the parent subdirectory
// of this Path.  Should not be called with a path of length 1.
func (p Path) ParentPath() *Path {
	return &Path{TopDir: p.TopDir, Path: p.Path[:len(p.Path)-1]}
}

// ChildPathNoPtr returns a new Path with the addition of a new entry
// with the given name.  That final PathNode will have no BlockPointer.
func (p Path) ChildPathNoPtr(name string) *Path {
	child := &Path{
		TopDir: p.TopDir,
		Path:   make([]PathNode, len(p.Path), len(p.Path)+1),
	}
	copy(child.Path, p.Path)
	child.Path = append(child.Path, PathNode{Name: name})
	return child
}

// HasPublic returns whether or not this is a top-level folder that
// should have a "public" subdirectory.
func (p Path) HasPublic() bool {
	// This directory has a corresponding public subdirectory if the
	// path has only one node and the top-level directory is not
	// already public TODO: Ideally, we'd also check if there are no
	// explicit readers, but for now we expect the caller to check
	// that.
	return len(p.Path) == 1 && !p.TopDir.IsPublic()
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

// DirKeyBundle is a bundle of all the keys for a directory
type DirKeyBundle struct {
	// Symmetric secret key, encrypted for each writer's device
	// (identified by the KID of the corresponding device CryptPublicKey).
	WKeys map[keybase1.UID]map[libkb.KIDMapKey][]byte
	// Symmetric secret key, encrypted for each reader's device
	// (identified by the KID of the corresponding device CryptPublicKey).
	RKeys map[keybase1.UID]map[libkb.KIDMapKey][]byte

	// M_f as described in 4.1.1 of https://keybase.io/blog/crypto
	// .
	TLFPublicKey TLFPublicKey `codec:"pubKey"`

	// M_e as described in 4.1.1 of https://keybase.io/blog/crypto
	// .
	//
	// TODO: Prepend M_e to all entries of WKeys and RKeys above
	// instead, so that we have the freedom to pick different
	// ephemeral keys.
	TLFEphemeralPublicKey TLFEphemeralPublicKey `codec:"ePubKey"`
}

// DeepCopy returns a complete copy of this DirKeyBundle.
func (dkb DirKeyBundle) DeepCopy() DirKeyBundle {
	newDkb := dkb
	newDkb.WKeys = make(map[keybase1.UID]map[libkb.KIDMapKey][]byte)
	for u, m := range dkb.WKeys {
		newDkb.WKeys[u] = make(map[libkb.KIDMapKey][]byte)
		for k, b := range m {
			newDkb.WKeys[u][k] = b
		}
	}
	newDkb.RKeys = make(map[keybase1.UID]map[libkb.KIDMapKey][]byte)
	for u, m := range dkb.RKeys {
		newDkb.RKeys[u] = make(map[libkb.KIDMapKey][]byte)
		for k, b := range m {
			newDkb.RKeys[u][k] = b
		}
	}
	newDkb.TLFPublicKey = dkb.TLFPublicKey.DeepCopy()
	newDkb.TLFEphemeralPublicKey = dkb.TLFEphemeralPublicKey.DeepCopy()
	return newDkb
}

// RootMetadata is the MD that is signed by the writer.
type RootMetadata struct {
	// Serialized, possibly encrypted, version of the PrivateMetadata
	SerializedPrivateMetadata []byte `codec:"data"`
	// Key versions for this metadata.  The most recent one is last in
	// the array.
	Keys []DirKeyBundle
	// Pointer to the previous root block ID
	PrevRoot MdID
	// The directory ID, signed over to make verification easier
	ID DirID

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

// BlockChangeNode tracks the blocks that have changed at a particular
// path in a folder's namespace, and includes pointers to the
// BlockChangeNode of the children of this path
type BlockChangeNode struct {
	Blocks   []BlockPointer              `codec:"b,omitempty"`
	Children map[string]*BlockChangeNode `codec:"c,omitempty"`
}

// NewBlockChangeNode constructs a new, empty BlockChangeNode.
func NewBlockChangeNode() *BlockChangeNode {
	return &BlockChangeNode{
		nil,
		make(map[string]*BlockChangeNode),
	}
}

// AddBlock recursively adds the specified block to this
// BlockChangeNode, under the right path.
func (bcn *BlockChangeNode) AddBlock(path Path, index int, ptr BlockPointer) {
	if index == len(path.Path)-1 {
		bcn.Blocks = append(bcn.Blocks, ptr)
	} else {
		name := path.Path[index+1].Name
		child, ok := bcn.Children[name]
		if !ok {
			child = NewBlockChangeNode()
			bcn.Children[name] = child
		}
		child.AddBlock(path, index+1, ptr)
	}
}

// BlockChanges tracks the set of blocks that changed in a commit.
// Could either be used referenced or dereferenced blocks.  Might
// consist of just a BlockPointer if the list is too big to embed in
// the MD structure directly.
type BlockChanges struct {
	// If this is set, the actual changes are stored in a block (where
	// the block contains a serialized version of BlockChanges)
	Pointer BlockPointer `codec:",omitempty"`
	// The top node of the block change tree
	Changes *BlockChangeNode `codec:",omitempty"`
	// Estimate the number of bytes that this set of changes will take to encode
	sizeEstimate uint64
}

// AddBlock adds the specified block to this BlockChanges and updates
// the size estimate.
func (bc *BlockChanges) AddBlock(path Path, ptr BlockPointer) {
	bc.Changes.AddBlock(path, 0, ptr)
	// estimate size of BlockPointer as 2 UIDs and 3 64-bit ints
	// XXX: use unsafe.SizeOf here instead?  It's not crucial that
	// it's right.
	bc.sizeEstimate += uint64(len(path.String()) +
		libkb.NODE_HASH_LEN_SHORT + keybase1.UID_LEN + 3*8)
}

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
	// The blocks that were added during the update that created this MD
	RefBlocks BlockChanges
	// The blocks that were unref'd during the update that created this MD
	UnrefBlocks BlockChanges
}

// NewRootMetadata constructs a new RootMetadata object with the given
// handle and ID.
func NewRootMetadata(d *DirHandle, id DirID) *RootMetadata {
	md := RootMetadata{
		Keys: make([]DirKeyBundle, 0, 1),
		ID:   id,
		data: PrivateMetadata{
			RefBlocks: BlockChanges{
				Changes: NewBlockChangeNode(),
			},
			UnrefBlocks: BlockChanges{
				Changes: NewBlockChangeNode(),
			},
		},
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

// GetEncryptedTLFCryptKeyClientHalfData returns the encrypted buffer
// of the given user's client key half for this top-level folder.
func (md RootMetadata) GetEncryptedTLFCryptKeyClientHalfData(
	keyVer KeyVer, user keybase1.UID, currentCryptPublicKey CryptPublicKey) (
	buf []byte, ok bool) {
	key := currentCryptPublicKey.KID.ToMapKey()
	if u, ok1 := md.Keys[keyVer].WKeys[user]; ok1 {
		buf, ok = u[key]
	} else if u, ok1 = md.Keys[keyVer].RKeys[user]; ok1 {
		buf, ok = u[key]
	}
	return
}

// GetTLFEphemeralPublicKey returns the ephemeral public key for this
// top-level folder.
func (md RootMetadata) GetTLFEphemeralPublicKey(
	keyVer KeyVer) TLFEphemeralPublicKey {
	return md.Keys[keyVer].TLFEphemeralPublicKey
}

// LatestKeyVersion returns the newest key version for this RootMetadata.
func (md RootMetadata) LatestKeyVersion() KeyVer {
	return KeyVer(len(md.Keys) - 1)
}

// AddNewKeys makes a new key version for this RootMetadata using the
// given DirKeyBundle.
func (md *RootMetadata) AddNewKeys(keys DirKeyBundle) {
	md.Keys = append(md.Keys, keys)
}

// GetDirHandle computes and returns the DirHandle for this
// RootMetadata, caching it in the process.
func (md *RootMetadata) GetDirHandle() *DirHandle {
	if md.cachedDirHandle != nil {
		return md.cachedDirHandle
	}

	h := &DirHandle{}
	keyID := md.LatestKeyVersion()
	for w := range md.Keys[keyID].WKeys {
		h.Writers = append(h.Writers, w)
	}
	if md.ID.IsPublic() {
		h.Readers = append(h.Readers, keybase1.PublicUID)
	} else {
		for r := range md.Keys[keyID].RKeys {
			if _, ok := md.Keys[keyID].WKeys[r]; !ok &&
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
	// The data is only initialized once we have at least one set of keys
	return md.LatestKeyVersion() >= 0
}

// MetadataID computes and caches the MdID for this RootMetadata
func (md *RootMetadata) MetadataID(config Config) (MdID, error) {
	if md.mdID != NullMdID {
		return md.mdID, nil
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

// AddRefBlock adds the specified block to the add block change list.
func (md *RootMetadata) AddRefBlock(path Path, ptr BlockPointer) {
	md.RefBytes += uint64(ptr.QuotaSize)
	md.data.RefBlocks.AddBlock(path, ptr)
}

// AddUnrefBlock adds the specified block to the add block change list
// (if it is a block of non-zero size).
func (md *RootMetadata) AddUnrefBlock(path Path, ptr BlockPointer) {
	if ptr.QuotaSize > 0 {
		md.UnrefBytes += uint64(ptr.QuotaSize)
		md.data.UnrefBlocks.AddBlock(path, ptr)
	}
}

// ClearBlockChanges resets the block change lists to empty for this
// RootMetadata.
func (md *RootMetadata) ClearBlockChanges() {
	md.RefBytes = 0
	md.UnrefBytes = 0
	md.data.RefBlocks.sizeEstimate = 0
	md.data.UnrefBlocks.sizeEstimate = 0
	md.data.RefBlocks.Changes = NewBlockChangeNode()
	md.data.UnrefBlocks.Changes = NewBlockChangeNode()
}

// EntryType is the type of a directory entry.
type EntryType int

const (
	// File is a regular file.
	File EntryType = iota
	// Exec is an executable file.
	Exec = iota
	// Dir is a directory.
	Dir = iota
	// Sym is a symbolic link.
	Sym = iota
)

// String implements the fmt.Stringer interface for EntryType
func (et EntryType) String() string {
	switch et {
	case File:
		return "FILE"
	case Exec:
		return "EXEC"
	case Dir:
		return "DIR"
	case Sym:
		return "SYM"
	}
	return "<invalid EntryType>"
}

// DirEntry is the MD for each child in a directory
type DirEntry struct {
	BlockPointer
	Type    EntryType
	Size    uint64
	SymPath string `codec:",omitempty"` // must be within the same root dir
	Mtime   int64
	Ctime   int64
}

// IsInitialized returns true if this DirEntry has been initialized.
func (de *DirEntry) IsInitialized() bool {
	return de.BlockPointer.IsInitialized()
}

// IndirectDirPtr pairs an indirect dir block with the start of that
// block's range of directory entries (inclusive)
type IndirectDirPtr struct {
	// TODO: Make sure that the block is not dirty when the QuotaSize
	// field is non-zero.
	BlockPointer
	Off string
}

// IndirectFilePtr pairs an indirect file block with the start of that
// block's range of bytes (inclusive)
type IndirectFilePtr struct {
	// When the QuotaSize field is non-zero, the block must not be dirty.
	BlockPointer
	Off int64
}

// CommonBlock holds block data that is common for both subdirectories
// and files.
type CommonBlock struct {
	// is this block so big it requires indirect pointers?
	IsInd bool
	// these two fields needed to randomize the hash key for unencrypted files
	Path    string `codec:",omitempty"`
	BlockNo uint32 `codec:",omitempty"`
	// XXX: just used for randomization until we have encryption
	Seed int64
}

// DirBlock is the contents of a directory
type DirBlock struct {
	CommonBlock
	// if not indirect, a map of path name to directory entry
	Children map[string]DirEntry `codec:",omitempty"`
	// if indirect, contains the indirect pointers to the next level of blocks
	IPtrs   []IndirectDirPtr `codec:",omitempty"`
	Padding []byte
}

// NewDirBlock creates a new, empty DirBlock.
func NewDirBlock() Block {
	return &DirBlock{
		Children: make(map[string]DirEntry),
	}
}

// FileBlock is the contents of a file
type FileBlock struct {
	CommonBlock
	// if not indirect, the full contents of this block
	Contents []byte `codec:",omitempty"`
	// if indirect, contains the indirect pointers to the next level of blocks
	IPtrs   []IndirectFilePtr `codec:",omitempty"`
	Padding []byte
}

// NewFileBlock creates a new, empty FileBlock.
func NewFileBlock() Block {
	return &FileBlock{
		Contents: make([]byte, 0, 0),
	}
}
