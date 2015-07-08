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
	KID keybase1.KID
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
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	PrivateKey [32]byte
}

// DeepCopy makes a complete copy of the TLFPrivateKey
func (k TLFPrivateKey) DeepCopy() TLFPrivateKey {
	return k
}

// A TLFPublicKey (M_f) is the public half of the permanent keypair
// associated with a TLF. It is included in the site-wide private-data
// Merkle tree. (See 4.1.1, 5.3.)
type TLFPublicKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	PublicKey [32]byte
}

// DeepCopy makes a complete copy of the TLFPublicKey
func (k TLFPublicKey) DeepCopy() TLFPublicKey {
	return k
}

// TLFEphemeralPrivateKey (m_e) is used (with a CryptPublicKey) to
// encrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for non-public
// directories. (See 4.1.1.)
type TLFEphemeralPrivateKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	PrivateKey libkb.NaclDHKeyPrivate
}

// CryptPublicKey (M_u^i) is used (with a TLFEphemeralPrivateKey) to
// encrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for non-public
// directories. (See 4.1.1.)  These are also sometimes known as
// subkeys.
type CryptPublicKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	//
	// Even though we currently use nacl/box, we use a KID here
	// (which encodes the key type) as we may end up storing other
	// kinds of keys.
	KID keybase1.KID
}

func (k CryptPublicKey) String() string {
	return k.KID.String()
}

// TLFEphemeralPublicKey (M_e) is used along with a crypt private key
// to decrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for
// non-public directories. (See 4.1.1.)
type TLFEphemeralPublicKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	PublicKey libkb.NaclDHKeyPublic
}

// DeepCopy makes a complete copy of a TLFEphemeralPublicKey.
func (k TLFEphemeralPublicKey) DeepCopy() TLFEphemeralPublicKey {
	return k
}

func (k TLFEphemeralPublicKey) String() string {
	return hex.EncodeToString(k.PublicKey[:])
}

// TLFCryptKeyServerHalf (s_u^{f,0,i}) is the masked, server-side half
// of a TLFCryptKey, which can be recovered only with both
// halves. (See 4.1.1.)
type TLFCryptKeyServerHalf struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	ServerHalf [32]byte
}

// TLFCryptKeyClientHalf (t_u^{f,0,i}) is the masked, client-side half
// of a TLFCryptKey, which can be recovered only with both
// halves. (See 4.1.1.)
type TLFCryptKeyClientHalf struct {
	// Exported only for serialization purposes. Should
	// only be used by implementations of Crypto.
	ClientHalf [32]byte
}

// EncryptionVer denotes a version for the encryption method.
type EncryptionVer int

const (
	// EncryptionSecretbox is the encryption version that uses
	// nacl/secretbox or nacl/box.
	EncryptionSecretbox EncryptionVer = 1
)

// encryptedData is encrypted data with a nonce and a version.
type encryptedData struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	Version       EncryptionVer
	EncryptedData []byte
	Nonce         []byte
}

// EncryptedTLFCryptKeyClientHalf is an encrypted
// TLFCryptKeyCLientHalf object.
type EncryptedTLFCryptKeyClientHalf encryptedData

// EncryptedPrivateMetadata is an encrypted PrivateMetadata object.
type EncryptedPrivateMetadata encryptedData

// EncryptedBlock is an encrypted Block.
type EncryptedBlock encryptedData

// DeepCopy returns a complete copy of this EncryptedTLFCryptKeyClientHalf.
func (ech EncryptedTLFCryptKeyClientHalf) DeepCopy() (echCopy EncryptedTLFCryptKeyClientHalf) {
	echCopy.Version = ech.Version
	echCopy.EncryptedData = make([]byte, len(ech.EncryptedData))
	copy(echCopy.EncryptedData, ech.EncryptedData)
	echCopy.Nonce = make([]byte, len(ech.Nonce))
	copy(echCopy.Nonce, ech.Nonce)
	return
}

// TLFCryptKey (s^{f,0}) is used to encrypt/decrypt the private
// portion of TLF metadata. It is also used to mask
// BlockCryptKeys. (See 4.1.1, 4.1.2.)
type TLFCryptKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	Key [32]byte
}

// PublicTLFCryptKey is the TLFCryptKey used for all public TLFs. That
// means that anyone with just the block key for a public TLF can
// decrypt that block. This is not the zero TLFCryptKey so that we can
// distinguish it from an (erroneously?) unset TLFCryptKey.
var PublicTLFCryptKey = TLFCryptKey{
	Key: [32]byte{
		0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
		0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
		0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
		0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
	},
}

// BlockCryptKeyServerHalf is a masked version of a BlockCryptKey,
// which can be recovered only with the TLFCryptKey used to mask the
// server half.
type BlockCryptKeyServerHalf struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	ServerHalf [32]byte
}

// BlockCryptKey is used to encrypt/decrypt block data. (See 4.1.2.)
type BlockCryptKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	Key [32]byte
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

// KeyGen is the type of a key generation for a top-level folder.
type KeyGen int

const (
	// PublicKeyGen is the value used for public TLFs. Note that
	// it is not considered a valid key generation.
	PublicKeyGen KeyGen = -1
	// FirstValidKeyGen is the first value that is considered a
	// valid key generation. Note that the nil value is not
	// considered valid.
	FirstValidKeyGen = 1
)

// DataVer is the type of a version for marshalled KBFS data
// structures.
type DataVer int

const (
	// FirstValidDataVer is the first value that is considered a
	// valid data version. Note that the nil value is not
	// considered valid.
	FirstValidDataVer = 1
)

// BlockRefNonce is a 64-bit unique sequence of bytes for identifying
// this reference of a block ID from other references to the same
// (duplicated) block.
type BlockRefNonce [8]byte

// zeroBlockRefNonce is a special BlockRefNonce used for the initial
// reference to a block.
var zeroBlockRefNonce = BlockRefNonce([8]byte{0, 0, 0, 0, 0, 0, 0, 0})

// BlockPointer contains the identifying information for a block in KBFS.
type BlockPointer struct {
	ID      BlockID
	KeyGen  KeyGen  // if valid, which generation of the DirKeyBundle to use.
	DataVer DataVer // if valid, which version of the KBFS data structures is pointed to
	Writer  keybase1.UID
	// When RefNonce is all 0s, this is the initial reference to a
	// particular block.  Using a constant refnonce for the initial
	// reference allows the server to identify and optimize for the
	// common case where there is only one reference for a block.  Two
	// initial references cannot happen simultaneously, because the
	// encrypted block contents (and thus the block ID) will be
	// randomized by the server-side block crypt key half.  All
	// subsequent references to the same block must have a random
	// RefNonce (it can't be a monotonically increasing number because
	// that would require coordination among clients).
	RefNonce BlockRefNonce `codec:"r,omitempty"`
}

// BlockInfo contains all information about a block in KBFS and its
// contents.
//
// TODO: Move everything but ID and RefNonce from BlockPointer into
// this type.
type BlockInfo struct {
	BlockPointer
	// When non-zero, the size of the encoded (and possibly
	// encrypted) data contained in the block. When non-zero,
	// always at least the size of the plaintext data contained in
	// the block.
	EncodedSize uint32
}

// GetWriter implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetWriter() keybase1.UID {
	return p.Writer
}

// GetRefNonce implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetRefNonce() BlockRefNonce {
	return p.RefNonce
}

// IsInitialized returns whether or not this BlockPointer has non-nil data.
func (p BlockPointer) IsInitialized() bool {
	return p.ID != NullBlockID
}

// ReadyBlockData is a block that has been encoded (and encrypted).
type ReadyBlockData struct {
	// These fields should not be used outside of BlockOps.Put().
	buf        []byte
	serverHalf BlockCryptKeyServerHalf
}

// GetEncodedSize returns the size of the encoded (and encrypted)
// block data.
func (r ReadyBlockData) GetEncodedSize() int {
	return len(r.buf)
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
		return nil, BadPathError{name}
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
			config.Reporter().Report(RptE, WrapError{err})
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

// BranchName is the name given to a KBFS branch, for a particular
// top-level folder.  Currently, the notion of a "branch" is
// client-side only, and can be used to specify which root to use for
// a top-level folder.  (For example, viewing a historical archive
// could use a different branch name.)
type BranchName string

const (
	// MasterBranch represents the mainline branch for a top-level
	// folder.  Set to the empty string so that the default will be
	// the master branch.
	MasterBranch BranchName = ""
)

// Path represents the full KBFS path to a particular location, so
// that a flush can traverse backwards and fix up ids along the way.
type Path struct {
	TopDir DirID
	Branch BranchName // master branch, by default
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
		Branch: p.Branch,
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

// DirKeyBundle is a bundle of all the keys for a directory
type DirKeyBundle struct {
	// Symmetric secret key, encrypted for each writer's device
	// (identified by the KID of the corresponding device CryptPublicKey).
	WKeys map[keybase1.UID]map[keybase1.KID]EncryptedTLFCryptKeyClientHalf
	// Symmetric secret key, encrypted for each reader's device
	// (identified by the KID of the corresponding device CryptPublicKey).
	RKeys map[keybase1.UID]map[keybase1.KID]EncryptedTLFCryptKeyClientHalf

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
	newDkb.WKeys = make(map[keybase1.UID]map[keybase1.KID]EncryptedTLFCryptKeyClientHalf)
	for u, m := range dkb.WKeys {
		newDkb.WKeys[u] = make(map[keybase1.KID]EncryptedTLFCryptKeyClientHalf)
		for k, b := range m {
			newDkb.WKeys[u][k] = b.DeepCopy()
		}
	}
	newDkb.RKeys = make(map[keybase1.UID]map[keybase1.KID]EncryptedTLFCryptKeyClientHalf)
	for u, m := range dkb.RKeys {
		newDkb.RKeys[u] = make(map[keybase1.KID]EncryptedTLFCryptKeyClientHalf)
		for k, b := range m {
			newDkb.RKeys[u][k] = b.DeepCopy()
		}
	}
	newDkb.TLFPublicKey = dkb.TLFPublicKey.DeepCopy()
	newDkb.TLFEphemeralPublicKey = dkb.TLFEphemeralPublicKey.DeepCopy()
	return newDkb
}

// BlockChanges tracks the set of blocks that changed in a commit, and
// the operations that made the changes.  It might consist of just a
// BlockPointer if the list is too big to embed in the MD structure
// directly.
//
// If this commit represents a conflict-resolution merge, which may
// comprise multiple individual operations, then there will be an
// ordered list of the changes for individual operations.  This lets
// the notification and conflict resolution strategies figure out the
// difference between a renamed file and a modified file, for example.
type BlockChanges struct {
	// If this is set, the actual changes are stored in a block (where
	// the block contains a serialized version of BlockChanges)
	Pointer BlockPointer `codec:"p,omitempty"`
	// An ordered list of operations completed in this update
	Ops []interface{} `codec:"o,omitempty"`
	// Estimate the number of bytes that this set of changes will take to encode
	sizeEstimate uint64
	// Most recent operation (currently being populated).  We keep
	// this here, instead of using the tails of Ops, because we need
	// it typed as an op and not an interface{}.
	latestOp op
}

// Equals returns true if the given BlockChanges is equal to this
// BlockChanges.  Currently does not check for equality at the
// operation level.
func (bc BlockChanges) Equals(other BlockChanges) bool {
	if bc.Pointer != other.Pointer || len(bc.Ops) != len(other.Ops) ||
		bc.sizeEstimate != other.sizeEstimate {
		return false
	}
	// TODO: check for op equality?
	return true
}

func (bc *BlockChanges) addBPSize() {
	// estimate size of BlockPointer as 2 UIDs and 3 64-bit ints
	// XXX: use unsafe.SizeOf here instead?  It's not crucial that
	// it's right.
	bc.sizeEstimate += uint64(libkb.NodeHashLenShort + keybase1.UID_LEN + 3*8)
}

// AddRefBlock adds the newly-referenced block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddRefBlock(ptr BlockPointer) {
	bc.latestOp.AddRefBlock(ptr)
	bc.addBPSize()
}

// AddUnrefBlock adds the newly unreferenced block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUnrefBlock(ptr BlockPointer) {
	bc.latestOp.AddUnrefBlock(ptr)
	bc.addBPSize()
}

// AddUpdate adds the newly updated block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	bc.latestOp.AddUpdate(oldPtr, newPtr)
	bc.addBPSize()
	bc.addBPSize()
}

// AddOp starts a new operation for this BlockChanges.  Subsequent
// Add* calls will populate this operation.
func (bc *BlockChanges) AddOp(o op) {
	bc.Ops = append(bc.Ops, o)
	bc.latestOp = o
	bc.sizeEstimate += o.SizeExceptUpdates()
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
	BlockInfo
	Type    EntryType
	Size    uint64
	SymPath string `codec:",omitempty"` // must be within the same root dir
	// Mtime is in unix nanoseconds
	Mtime int64
	// Ctime is in unix nanoseconds
	Ctime int64
}

// IsInitialized returns true if this DirEntry has been initialized.
func (de *DirEntry) IsInitialized() bool {
	return de.BlockPointer.IsInitialized()
}

// IndirectDirPtr pairs an indirect dir block with the start of that
// block's range of directory entries (inclusive)
type IndirectDirPtr struct {
	// TODO: Make sure that the block is not dirty when the EncodedSize
	// field is non-zero.
	BlockInfo
	Off string
}

// IndirectFilePtr pairs an indirect file block with the start of that
// block's range of bytes (inclusive)
type IndirectFilePtr struct {
	// When the EncodedSize field is non-zero, the block must not
	// be dirty.
	BlockInfo
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

// DeepCopy makes a complete copy of a DirBlock
func (db DirBlock) DeepCopy() *DirBlock {
	// copy the block if it's for writing
	dblockCopy := NewDirBlock().(*DirBlock)
	*dblockCopy = db
	// deep copy of children
	dblockCopy.Children = make(map[string]DirEntry)
	for k, v := range db.Children {
		dblockCopy.Children[k] = v
	}
	// TODO: deep copy of IPtrs once we have indirect dir blocks
	// TODO: copy padding once we support it.
	return dblockCopy
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

// DeepCopy makes a complete copy of a FileBlock
func (fb FileBlock) DeepCopy() *FileBlock {
	fblockCopy := NewFileBlock().(*FileBlock)
	*fblockCopy = fb
	// deep copy of contents and iptrs
	fblockCopy.Contents = make([]byte, len(fb.Contents))
	copy(fblockCopy.Contents, fb.Contents)
	fblockCopy.IPtrs = make([]IndirectFilePtr, len(fb.IPtrs))
	copy(fblockCopy.IPtrs, fb.IPtrs)
	// TODO: copy padding once we support it.
	return fblockCopy
}

// extCode is used to register codec extensions
type extCode uint64

// these track the start of a range of unique extCodes for various
// types of extensions.
const (
	extCodeOpsRangeStart = 1
)
