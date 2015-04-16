package libkbfs

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
)

const (
	DIRID_LEN       = 16
	DIRID_SUFFIX    = 0x16
	PUBDIRID_SUFFIX = 0x17
)

type DirId [DIRID_LEN]byte

func (d DirId) String() string {
	return hex.EncodeToString(d[:])
}

func GetPublicUid() libkb.UID {
	out := libkb.UID{0}
	out[libkb.UID_LEN-1] = PUBDIRID_SUFFIX
	return out
}

func (d DirId) IsPublic() bool {
	return d[DIRID_LEN-1] == PUBDIRID_SUFFIX
}

var ReaderSep string = "#"
var PublicUid libkb.UID = GetPublicUid()
var PublicName string = "public"

// TODO: how to identify devices
type DeviceId int
type HMAC []byte

// TODO: Use libkb.GenericKey instead
type Key struct {
	Key     []byte
	Version uint32
	Type    uint32
}

var NullKey Key = Key{}

func NewKeyVersioned(v uint32, t uint32) Key {
	return Key{make([]byte, 1, 1), v, t}
}

func NewKey() Key {
	return NewKeyVersioned(0, 0)
}

// type of hash key for each data block
type BlockId libkb.NodeHashShort

// type of hash key for each metadata block
type MDId libkb.NodeHashShort

var NullMDId MDId = MDId{0}

func RandBlockId() BlockId {
	var id BlockId
	// TODO: deal with errors?
	rand.Read(id[:])
	return id
}

type BlockPointer struct {
	Id     BlockId
	KeyId  int // which version of the DirKeys to use
	Ver    int // which version of the KBFS data structures is pointed to
	Writer libkb.UID
	// When non-zero, the size of the (possibly encrypted) data
	// contained in the block. When non-zero, always at least the
	// size of the plaintext data contained in the block.
	QuotaSize uint32
}

func (p BlockPointer) GetKeyId() int {
	return p.KeyId
}

func (p BlockPointer) GetVer() int {
	return p.Ver
}

func (p BlockPointer) GetWriter() libkb.UID {
	return p.Writer
}

func (p BlockPointer) GetQuotaSize() uint32 {
	return p.QuotaSize
}

type UIDList []libkb.UID

func (u UIDList) Len() int {
	return len(u)
}

func (u UIDList) Less(i, j int) bool {
	return bytes.Compare(u[i][:], u[j][:]) < 0
}

func (u UIDList) Swap(i, j int) {
	tmp := u[i]
	u[i] = u[j]
	u[j] = tmp
}

// DirHandle uniquely identifies top-level directories by readers and writers
type DirHandle struct {
	Readers     UIDList `codec:"r,omitempty"`
	Writers     UIDList `codec:"w,omitempty"`
	cachedName  string
	cachedBytes []byte
	clearCache  bool
}

func NewDirHandle() *DirHandle {
	return &DirHandle{
		Readers: make(UIDList, 0, 1),
		Writers: make(UIDList, 0, 1),
	}
}

func (d *DirHandle) IsPublic() bool {
	return len(d.Readers) == 1 && d.Readers[0] == PublicUid
}

func (d *DirHandle) IsPrivateShare() bool {
	return !d.IsPublic() && len(d.Writers) > 1
}

func (d *DirHandle) HasPublic() bool {
	return len(d.Readers) == 0
}

func (d *DirHandle) findUserInList(user libkb.UID, users UIDList) bool {
	// TODO: this could be more efficient with a cached map/set
	for _, u := range users {
		if u == user {
			return true
		}
	}
	return false
}

func (d *DirHandle) IsWriter(user libkb.UID) bool {
	return d.findUserInList(user, d.Writers)
}

func (d *DirHandle) IsReader(user libkb.UID) bool {
	return d.IsPublic() || d.findUserInList(user, d.Readers) || d.IsWriter(user)
}

func resolveUids(config Config, uids UIDList) string {
	names := make([]string, 0, len(uids))
	// TODO: parallelize?
	for _, uid := range uids {
		if uid == PublicUid {
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

func (d *DirHandle) ToString(config Config) string {
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

func (d *DirHandle) ToBytes(config Config) (out []byte) {
	if len(d.cachedBytes) > 0 {
		return d.cachedBytes
	}

	var err error
	if out, err = config.Codec().Encode(d); err != nil {
		d.cachedBytes = out
	}
	return
}

// PathName is a single node along an FS path
type PathNode struct {
	BlockPointer
	Name string
}

// Path shows the FS path to a particular location, so that a flush
// can traverse backwards and fix up ids along the way
type Path struct {
	TopDir DirId
	Path   []*PathNode
}

func (p *Path) TailName() string {
	return p.Path[len(p.Path)-1].Name
}

func (p *Path) TailPointer() *BlockPointer {
	if len(p.Path) > 0 {
		return &p.Path[len(p.Path)-1].BlockPointer
	} else {
		return &BlockPointer{}
	}
}

func (p *Path) ToString(config Config) string {
	out := "/"
	names := make([]string, 0, len(p.Path))
	for _, n := range p.Path {
		names = append(names, n.Name)
	}
	out += strings.Join(names, "/")
	return out
}

func (p *Path) ParentPath() *Path {
	return &Path{TopDir: p.TopDir, Path: p.Path[:len(p.Path)-1]}
}

func (p *Path) HasPublic() bool {
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
	Sig []byte `codec:",omitempty"`
	// pairwise MAC of the last writer with all readers and writers
	// (for private shares)
	Macs map[libkb.UID][]byte `codec:",omitempty"`
	// all the metadata
	MD RootMetadata
}

func NewRootMetadataSigned() *RootMetadataSigned {
	return &RootMetadataSigned{
		MD: RootMetadata{
			Keys: make([]DirKeys, 0, 0),
		},
	}
}

func (rmds *RootMetadataSigned) IsInitialized() bool {
	// The data is only if there is some sort of signature
	return rmds.Sig != nil || len(rmds.Macs) > 0
}

// DirKeys is a version of all the keys for this directory
type DirKeys struct {
	// symmetric secret key, encrypted for each writer's device
	WKeys map[libkb.UID]map[DeviceId][]byte
	// symmetric secret key, encrypted for each reader's device
	RKeys map[libkb.UID]map[DeviceId][]byte
	// public encryption key
	PubKey Key
}

// RootMetadata is the MD that is signed by the writer
type RootMetadata struct {
	// Serialized, possibly encrypted, version of the PrivateMetadata
	SerializedPrivateMetadata []byte `codec:"data"`
	// Key versions for this metadata.  The most recent one is last in
	// the array.
	Keys []DirKeys
	// Pointer to the previous root block ID
	PrevRoot MDId
	// The directory ID, signed over to make verification easier
	Id DirId

	// The total number of bytes in new blocks
	RefBytes uint64
	// The total number of bytes in unreferenced blocks
	UnrefBytes uint64

	// The plaintext, deserialized PrivateMetadata
	data PrivateMetadata
	// A cached copy of the directory handle calculated for this MD
	cachedDirHandle *DirHandle
	// The cached ID for this MD structure (hash)
	mdId MDId
}

// PrivateMetadata contains the portion of metadata that's secret for private
// directories
type PrivateMetadata struct {
	// directory entry for the root directory block
	Dir DirEntry
	// the last KB user who wrote this metadata
	LastWriter libkb.UID
	// The private encryption key for the current key ID, in case a
	// new device needs to be provisioned.  Once the folder is
	// rekeyed, this can be overwritten.
	PrivKey Key

	// TODO: Track the block pointers added and freed by the update
	// that created this metadata structure, to enable asynchronous
	// history truncation
}

func NewRootMetadata(d *DirHandle, id DirId) *RootMetadata {
	md := RootMetadata{
		Keys: make([]DirKeys, 0, 1),
		Id:   id,
	}
	// need to keep the dir handle around long enough to rekey the metadata for
	// the first time
	md.cachedDirHandle = d
	return &md
}

func (md *RootMetadata) Data() *PrivateMetadata {
	return &md.data
}

func (md *RootMetadata) GetEncryptedSecretKey(
	id int, user libkb.UID, dev DeviceId) (
	buf []byte, ok bool) {
	if len(md.Keys[id].WKeys) == 0 {
		// must be a public directory
		ok = true
	} else {
		if u, ok1 := md.Keys[id].WKeys[user]; ok1 {
			buf, ok = u[dev]
		} else if u, ok1 = md.Keys[id].RKeys[user]; ok1 {
			buf, ok = u[dev]
		}
	}
	return
}

func (md *RootMetadata) GetPubKey(id int) Key {
	return md.Keys[id].PubKey
}

func (md *RootMetadata) LatestKeyId() int {
	return len(md.Keys) - 1
}

func (md *RootMetadata) AddNewKeys(keys DirKeys) {
	md.Keys = append(md.Keys, keys)
}

func (md *RootMetadata) GetDirHandle() *DirHandle {
	if md.cachedDirHandle != nil {
		return md.cachedDirHandle
	}

	h := &DirHandle{}
	keyId := md.LatestKeyId()
	for w, _ := range md.Keys[keyId].WKeys {
		h.Writers = append(h.Writers, w)
	}
	if md.Id.IsPublic() {
		h.Readers = append(h.Readers, PublicUid)
	} else {
		for r, _ := range md.Keys[keyId].RKeys {
			if _, ok := md.Keys[keyId].WKeys[r]; !ok && r != PublicUid {
				h.Readers = append(h.Readers, r)
			}
		}
	}
	sort.Sort(h.Writers)
	sort.Sort(h.Readers)
	md.cachedDirHandle = h
	return h
}

func (md *RootMetadata) IsInitialized() bool {
	// The data is only initialized once we have at least one set of keys
	return md.LatestKeyId() >= 0
}

func (md *RootMetadata) MetadataId(config Config) (MDId, error) {
	if md.mdId != NullMDId {
		return md.mdId, nil
	}
	if buf, err := config.Codec().Encode(md); err != nil {
		return NullMDId, err
	} else if h, err := config.Crypto().Hash(buf); err != nil {
		return NullMDId, err
	} else if nhs, ok := h.(libkb.NodeHashShort); !ok {
		return NullMDId, &BadCryptoMDError{md.Id}
	} else {
		md.mdId = MDId(nhs)
		return md.mdId, nil
	}
}

func (md *RootMetadata) ClearMetadataId() {
	md.mdId = NullMDId
}

// DirEntry is the MD for each child in a directory
type DirEntry struct {
	BlockPointer
	Size    uint64
	IsSym   bool
	SymPath string `codec:",omitempty"` // must be within the same root dir
	IsDir   bool
	IsExec  bool
	Mtime   int64
	Ctime   int64
}

// IndirectDirPtr pairs an indirect dir block with the start of that
// block's range of directory entries (inclusive)
type IndirectDirPtr struct {
	// TODO: Make sure that the block is not dirty when the QuotaSize field is non-zero.
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
	Children map[string]*DirEntry `codec:",omitempty"`
	// if indirect, contains the indirect pointers to the next level of blocks
	IPtrs   []IndirectDirPtr `codec:",omitempty"`
	Padding []byte
}

func NewDirBlock() Block {
	return &DirBlock{
		Children: make(map[string]*DirEntry),
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

func NewFileBlock() Block {
	return &FileBlock{
		Contents: make([]byte, 0, 0),
	}
}
