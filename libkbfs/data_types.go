package libkbfs

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

const (
	// ReaderSep is the string that separates readers from writers in a
	// TlfHandle string representation.
	ReaderSep = "#"

	// PublicUIDName is the name given to keybase1.PublicUID.
	PublicUIDName = "public"
)

// UserInfo contains all the info about a keybase user that kbfs cares
// about.
type UserInfo struct {
	Name            libkb.NormalizedUsername
	UID             keybase1.UID
	VerifyingKeys   []VerifyingKey
	CryptPublicKeys []CryptPublicKey
}

// SessionInfo contains all the info about the keybase session that
// kbfs cares about.
type SessionInfo struct {
	UID            keybase1.UID
	Token          string
	CryptPublicKey CryptPublicKey
}

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

func (serverHalf BlockCryptKeyServerHalf) String() string {
	return hex.EncodeToString(serverHalf.ServerHalf[:])
}

// BlockCryptKey is used to encrypt/decrypt block data. (See 4.1.2.)
type BlockCryptKey struct {
	// Exported only for serialization purposes. Should only be
	// used by implementations of Crypto.
	Key [32]byte
}

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

func (nonce BlockRefNonce) String() string {
	return hex.EncodeToString(nonce[:])
}

// BlockPointer contains the identifying information for a block in KBFS.
type BlockPointer struct {
	ID      BlockID
	KeyGen  KeyGen  // if valid, which generation of the DirKeyBundle to use.
	DataVer DataVer // if valid, which version of the KBFS data structures is pointed to
	// Creator is the UID that was first charged for the initial
	// reference to this block.
	Creator keybase1.UID
	// Writer is the UID that should be charged for this reference to
	// the block.  If empty, it defaults to Creator.
	Writer keybase1.UID `codec:"w,omitempty"`
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

// GetCreator implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetCreator() keybase1.UID {
	return p.Creator
}

// GetWriter implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetWriter() keybase1.UID {
	if !p.Writer.IsNil() {
		return p.Writer
	}
	return p.Creator
}

// SetWriter sets the Writer field, if necessary.
func (p *BlockPointer) SetWriter(newWriter keybase1.UID) {
	if p.Creator != newWriter {
		p.Writer = newWriter
	} else {
		// save some bytes by not populating the separate Writer
		// field if it matches the creator.
		p.Writer = ""
	}
}

// GetRefNonce implements the BlockContext interface for BlockPointer.
func (p BlockPointer) GetRefNonce() BlockRefNonce {
	return p.RefNonce
}

// IsInitialized returns whether or not this BlockPointer has non-nil data.
func (p BlockPointer) IsInitialized() bool {
	return p.ID != BlockID{}
}

// IsFirstRef returns whether or not p represents the first reference
// to the corresponding BlockID.
func (p BlockPointer) IsFirstRef() bool {
	return p.RefNonce == zeroBlockRefNonce
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

// TlfHandle uniquely identifies top-level folders by readers and
// writers.  It is go-routine-safe.
type TlfHandle struct {
	Readers     []keybase1.UID `codec:"r,omitempty"`
	Writers     []keybase1.UID `codec:"w,omitempty"`
	cachedName  string
	cachedBytes []byte
	cacheMutex  sync.Mutex // control access to the "cached" values
}

// NewTlfHandle constructs a new, blank TlfHandle.
func NewTlfHandle() *TlfHandle {
	return &TlfHandle{}
}

// TlfHandleDecode decodes b into a TlfHandle.
func TlfHandleDecode(b []byte, config Config) (*TlfHandle, error) {
	var handle TlfHandle
	err := config.Codec().Decode(b, &handle)
	if err != nil {
		return nil, err
	}

	return &handle, nil
}

func resolveUser(ctx context.Context, config Config, name string,
	errCh chan<- error, results chan<- keybase1.UID) {
	// short-circuit if this is the special public user:
	if name == PublicUIDName {
		results <- keybase1.PublicUID
		return
	}

	uid, err := config.KBPKI().ResolveAssertion(ctx, name)
	if err != nil {
		select {
		case errCh <- err:
		default:
			// another worker reported an error before us; first one wins
		}
		return
	}
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
	u[i], u[j] = u[j], u[i]
}

func sortUIDS(m map[keybase1.UID]struct{}) []keybase1.UID {
	var s []keybase1.UID
	for uid := range m {
		s = append(s, uid)
	}
	sort.Sort(uidList(s))
	return s
}

// ParseTlfHandle parses a TlfHandle from an encoded string. See
// ToString for the opposite direction.
func ParseTlfHandle(ctx context.Context, config Config, name string) (
	*TlfHandle, error) {
	splitNames := strings.SplitN(name, ReaderSep, 3)
	if len(splitNames) > 2 {
		return nil, BadTLFNameError{name}
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
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	for uid := range usedWNames {
		delete(usedRNames, uid)
	}

	d := &TlfHandle{
		Writers: sortUIDS(usedWNames),
		Readers: sortUIDS(usedRNames),
	}
	return d, nil
}

// IsPublic returns whether or not this TlfHandle represents a public
// top-level folder.
func (h *TlfHandle) IsPublic() bool {
	return len(h.Readers) == 1 && h.Readers[0].Equal(keybase1.PublicUID)
}

// IsPrivateShare returns whether or not this TlfHandle represents a
// private share (some non-public directory with more than one writer).
func (h *TlfHandle) IsPrivateShare() bool {
	return !h.IsPublic() && len(h.Writers) > 1
}

// HasPublic represents whether this top-level folder should have a
// corresponding public top-level folder.
func (h *TlfHandle) HasPublic() bool {
	return len(h.Readers) == 0
}

func (h *TlfHandle) findUserInList(user keybase1.UID,
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
// top-level folder represented by this TlfHandle.
func (h *TlfHandle) IsWriter(user keybase1.UID) bool {
	return h.findUserInList(user, h.Writers)
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this TlfHandle.
func (h *TlfHandle) IsReader(user keybase1.UID) bool {
	return h.IsPublic() || h.findUserInList(user, h.Readers) || h.IsWriter(user)
}

func resolveUids(ctx context.Context, config Config,
	uids []keybase1.UID) string {
	names := make([]string, 0, len(uids))
	// TODO: parallelize?
	for _, uid := range uids {
		if uid.Equal(keybase1.PublicUID) {
			// PublicUIDName is already normalized.
			names = append(names, PublicUIDName)
		} else if name, err := config.KBPKI().GetNormalizedUsername(ctx, uid); err == nil {
			names = append(names, string(name))
		} else {
			config.Reporter().Report(RptE, WrapError{err})
			names = append(names, fmt.Sprintf("uid:%s", uid))
		}
	}

	sort.Strings(names)
	return strings.Join(names, ",")
}

// ToString returns a string representation of this TlfHandle
func (h *TlfHandle) ToString(ctx context.Context, config Config) string {
	h.cacheMutex.Lock()
	defer h.cacheMutex.Unlock()
	if h.cachedName != "" {
		// TODO: we should expire this cache periodically
		return h.cachedName
	}

	// resolve every uid to a name
	h.cachedName = resolveUids(ctx, config, h.Writers)

	// assume only additional readers are listed
	if len(h.Readers) > 0 {
		h.cachedName += ReaderSep + resolveUids(ctx, config, h.Readers)
	}

	// TODO: don't cache if there were errors?
	return h.cachedName
}

// ToBytes marshals this TlfHandle.
func (h *TlfHandle) ToBytes(config Config) (out []byte) {
	h.cacheMutex.Lock()
	defer h.cacheMutex.Unlock()
	if len(h.cachedBytes) > 0 {
		return h.cachedBytes
	}

	var err error
	if out, err = config.Codec().Encode(h); err != nil {
		h.cachedBytes = out
	}
	return
}

// ToKBFolder converts a TlfHandle into a keybase1.Folder,
// suitable for KBPKI calls.
func (h *TlfHandle) ToKBFolder(ctx context.Context, config Config) keybase1.Folder {
	return keybase1.Folder{
		Name:    h.ToString(ctx, config),
		Private: !h.IsPublic(),
	}
}

// Equal returns true if two TlfHandles are equal.
func (h *TlfHandle) Equal(rhs *TlfHandle, config Config) bool {
	return bytes.Equal(h.ToBytes(config), rhs.ToBytes(config))
}

// Favorite is a top-level favorited folder name.
type Favorite struct {
	Name   string
	Public bool
}

// NewFavoriteFromFolder creates a Favorite from a
// keybase1.Folder.
func NewFavoriteFromFolder(folder keybase1.Folder) *Favorite {
	const publicSuffix = ReaderSep + PublicUIDName
	name := strings.TrimSuffix(folder.Name, publicSuffix)
	return &Favorite{
		Name:   name,
		Public: len(name) != len(folder.Name),
	}
}

// PathNode is a single node along an KBFS path, pointing to the top
// block for that node of the path.
type pathNode struct {
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

// FolderBranch represents a unique pair of top-level folder and a
// branch of that folder.
type FolderBranch struct {
	Tlf    TlfID
	Branch BranchName // master branch, by default
}

// path represents the full KBFS path to a particular location, so
// that a flush can traverse backwards and fix up ids along the way.
type path struct {
	FolderBranch
	path []pathNode
}

// isValid() returns true if the path has at least one node (for the
// root).
func (p path) isValid() bool {
	return len(p.path) >= 1
}

// hasValidParent() returns true if this path is valid and
// parentPath() is a valid path.
func (p path) hasValidParent() bool {
	return len(p.path) >= 2
}

// tailName returns the name of the final node in the Path. Must be
// called with a valid path.
func (p path) tailName() string {
	return p.path[len(p.path)-1].Name
}

// tailPointer returns the BlockPointer of the final node in the Path.
// Must be called with a valid path.
func (p path) tailPointer() BlockPointer {
	return p.path[len(p.path)-1].BlockPointer
}

// String implements the fmt.Stringer interface for Path.
func (p path) String() string {
	names := make([]string, 0, len(p.path))
	for _, node := range p.path {
		names = append(names, node.Name)
	}
	return strings.Join(names, "/")
}

// parentPath returns a new Path representing the parent subdirectory
// of this Path. Must be called with a valid path. Should not be
// called with a path of only a single node, as that would produce an
// invalid path.
func (p path) parentPath() *path {
	return &path{p.FolderBranch, p.path[:len(p.path)-1]}
}

// childPathNoPtr returns a new Path with the addition of a new entry
// with the given name.  That final PathNode will have no BlockPointer.
func (p path) ChildPathNoPtr(name string) *path {
	child := &path{
		FolderBranch: p.FolderBranch,
		path:         make([]pathNode, len(p.path), len(p.path)+1),
	}
	copy(child.path, p.path)
	child.path = append(child.path, pathNode{Name: name})
	return child
}

// hasPublic returns whether or not this is a top-level folder that
// should have a "public" subdirectory.
func (p path) hasPublic() bool {
	// This directory has a corresponding public subdirectory if the
	// path has only one node and the top-level directory is not
	// already public TODO: Ideally, we'd also check if there are no
	// explicit readers, but for now we expect the caller to check
	// that.
	return len(p.path) == 1 && !p.Tlf.IsPublic()
}

// TLFCryptKeyServerHalfID is the identifier type for a server-side key half.
type TLFCryptKeyServerHalfID struct {
	ID HMAC // Exported for serialization.
}

// DeepCopy returns a complete copy of a TLFCryptKeyServerHalfID.
func (id TLFCryptKeyServerHalfID) DeepCopy() TLFCryptKeyServerHalfID {
	return id
}

// String implements the Stringer interface for TLFCryptKeyServerHalfID.
func (id TLFCryptKeyServerHalfID) String() string {
	return id.ID.String()
}

// TLFCryptKeyInfo is a per-device key half entry in the DirKeyBundle.
type TLFCryptKeyInfo struct {
	ClientHalf   EncryptedTLFCryptKeyClientHalf
	ServerHalfID TLFCryptKeyServerHalfID
	EPubKeyIndex int `codec:"i,omitempty"`
}

// DeepCopy returns a complete copy of a TLFCryptKeyInfo.
func (info TLFCryptKeyInfo) DeepCopy() TLFCryptKeyInfo {
	return TLFCryptKeyInfo{
		ClientHalf:   info.ClientHalf.DeepCopy(),
		ServerHalfID: info.ServerHalfID.DeepCopy(),
		EPubKeyIndex: info.EPubKeyIndex,
	}
}

// UserCryptKeyBundle is a map from a user devices (identified by the
// KID of the corresponding device CryptPublicKey) to the
// corresponding crypt key information.
type UserCryptKeyBundle map[keybase1.KID]TLFCryptKeyInfo

func (uckb UserCryptKeyBundle) fillInDeviceInfo(crypto Crypto,
	uid keybase1.UID, tlfCryptKey TLFCryptKey,
	ePrivKey TLFEphemeralPrivateKey, ePubIndex int,
	publicKeys []CryptPublicKey) (
	serverMap map[keybase1.KID]TLFCryptKeyServerHalf, err error) {
	serverMap = make(map[keybase1.KID]TLFCryptKeyServerHalf)
	// for each device:
	//    * create a new random server half
	//    * mask it with the key to get the client half
	//    * encrypt the client half
	//
	// TODO: parallelize
	for _, k := range publicKeys {
		// Skip existing entries, only fill in new ones
		if _, ok := uckb[k.KID]; ok {
			continue
		}

		var serverHalf TLFCryptKeyServerHalf
		serverHalf, err = crypto.MakeRandomTLFCryptKeyServerHalf()
		if err != nil {
			return nil, err
		}

		var clientHalf TLFCryptKeyClientHalf
		clientHalf, err = crypto.MaskTLFCryptKey(serverHalf, tlfCryptKey)
		if err != nil {
			return nil, err
		}

		var encryptedClientHalf EncryptedTLFCryptKeyClientHalf
		encryptedClientHalf, err =
			crypto.EncryptTLFCryptKeyClientHalf(ePrivKey, k, clientHalf)
		if err != nil {
			return nil, err
		}

		var serverHalfID TLFCryptKeyServerHalfID
		serverHalfID, err =
			crypto.GetTLFCryptKeyServerHalfID(uid, k.KID, serverHalf)
		if err != nil {
			return nil, err
		}

		uckb[k.KID] = TLFCryptKeyInfo{
			ClientHalf:   encryptedClientHalf,
			ServerHalfID: serverHalfID,
			EPubKeyIndex: ePubIndex,
		}
		serverMap[k.KID] = serverHalf
	}

	return serverMap, nil
}

// DirKeyBundle is a bundle of all the keys for a directory
type DirKeyBundle struct {
	// Symmetric secret key, encrypted for each writer's device
	// (identified by the KID of the corresponding device CryptPublicKey).
	WKeys map[keybase1.UID]UserCryptKeyBundle
	// Symmetric secret key, encrypted for each reader's device
	// (identified by the KID of the corresponding device CryptPublicKey).
	RKeys map[keybase1.UID]UserCryptKeyBundle

	// M_f as described in 4.1.1 of https://keybase.io/blog/crypto.
	TLFPublicKey TLFPublicKey `codec:"pubKey"`

	// M_e as described in 4.1.1 of https://keybase.io/blog/crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	TLFEphemeralPublicKeys []TLFEphemeralPublicKey `codec:"ePubKey"`
}

// DeepCopy returns a complete copy of this DirKeyBundle.
func (dkb DirKeyBundle) DeepCopy() DirKeyBundle {
	newDkb := dkb
	newDkb.WKeys = make(map[keybase1.UID]UserCryptKeyBundle)
	for u, m := range dkb.WKeys {
		newDkb.WKeys[u] = UserCryptKeyBundle{}
		for k, b := range m {
			newDkb.WKeys[u][k] = b.DeepCopy()
		}
	}
	newDkb.RKeys = make(map[keybase1.UID]UserCryptKeyBundle)
	for u, m := range dkb.RKeys {
		newDkb.RKeys[u] = UserCryptKeyBundle{}
		for k, b := range m {
			newDkb.RKeys[u][k] = b.DeepCopy()
		}
	}
	newDkb.TLFPublicKey = dkb.TLFPublicKey.DeepCopy()
	newDkb.TLFEphemeralPublicKeys =
		make([]TLFEphemeralPublicKey, len(dkb.TLFEphemeralPublicKeys))
	for i, k := range dkb.TLFEphemeralPublicKeys {
		newDkb.TLFEphemeralPublicKeys[i] = k.DeepCopy()
	}
	return newDkb
}

// IsWriter returns true if the given user device is in the writer set.
func (dkb *DirKeyBundle) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := dkb.WKeys[user][deviceKID]
	return ok
}

// IsReader returns true if the given user device is in the reader set.
func (dkb *DirKeyBundle) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := dkb.RKeys[user][deviceKID]
	return ok
}

// fillInDevices ensures that every device for every writer and reader
// in the provided lists has complete TLF crypt key info, and uses the
// new ephemeral key pair to generate the info if it doesn't yet
// exist.
func (dkb *DirKeyBundle) fillInDevices(crypto Crypto,
	wKeys map[keybase1.UID][]CryptPublicKey,
	rKeys map[keybase1.UID][]CryptPublicKey, ePubKey TLFEphemeralPublicKey,
	ePrivKey TLFEphemeralPrivateKey, tlfCryptKey TLFCryptKey) (
	map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf, error) {
	dkb.TLFEphemeralPublicKeys =
		append(dkb.TLFEphemeralPublicKeys, ePubKey)
	newIndex := len(dkb.TLFEphemeralPublicKeys) - 1

	// now fill in the secret keys as needed
	newServerKeys :=
		make(map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf)
	for w, keys := range wKeys {
		if _, ok := dkb.WKeys[w]; !ok {
			dkb.WKeys[w] = UserCryptKeyBundle{}
		}

		serverMap, err := dkb.WKeys[w].fillInDeviceInfo(
			crypto, w, tlfCryptKey, ePrivKey, newIndex, keys)
		if err != nil {
			return nil, err
		}
		if len(serverMap) > 0 {
			newServerKeys[w] = serverMap
		}
	}
	for r, keys := range rKeys {
		if _, ok := dkb.RKeys[r]; !ok {
			dkb.RKeys[r] = UserCryptKeyBundle{}
		}

		serverMap, err := dkb.RKeys[r].fillInDeviceInfo(
			crypto, r, tlfCryptKey, ePrivKey, newIndex, keys)
		if err != nil {
			return nil, err
		}
		if len(serverMap) > 0 {
			newServerKeys[r] = serverMap
		}
	}
	return newServerKeys, nil
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
	Ops opsList `codec:"o,omitempty"`
	// Estimate the number of bytes that this set of changes will take to encode
	sizeEstimate uint64
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
	// We want an estimate of the codec-encoded size, but the
	// in-memory size is good enough.
	bc.sizeEstimate += uint64(reflect.TypeOf(BlockPointer{}).Size())
}

// AddRefBlock adds the newly-referenced block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddRefBlock(ptr BlockPointer) {
	bc.Ops[len(bc.Ops)-1].AddRefBlock(ptr)
	bc.addBPSize()
}

// AddUnrefBlock adds the newly unreferenced block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUnrefBlock(ptr BlockPointer) {
	bc.Ops[len(bc.Ops)-1].AddUnrefBlock(ptr)
	bc.addBPSize()
}

// AddUpdate adds the newly updated block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	bc.Ops[len(bc.Ops)-1].AddUpdate(oldPtr, newPtr)
	// add sizes for both block pointers
	bc.addBPSize()
	bc.addBPSize()
}

// AddOp starts a new operation for this BlockChanges.  Subsequent
// Add* calls will populate this operation.
func (bc *BlockChanges) AddOp(o op) {
	bc.Ops = append(bc.Ops, o)
	bc.sizeEstimate += o.SizeExceptUpdates()
}

// EntryType is the type of a directory entry.
type EntryType int

const (
	// File is a regular file.
	File EntryType = iota
	// Exec is an executable file.
	Exec
	// Dir is a directory.
	Dir
	// Sym is a symbolic link.
	Sym
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
	path    string `codec:",omitempty"`
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
	extCodeOpsRangeStart  = 1
	extCodeListRangeStart = 101
)

// ReportedError represents an error reported by KBFS.
type ReportedError struct {
	Level ReportingLevel
	Time  time.Time
	Error fmt.Stringer
	// TODO: stacktrace would be nice
}

// MergeStatus represents the merge status of a TLF.
type MergeStatus int

const (
	// Merged means that the TLF is merged and no conflict
	// resolution needs to be done.
	Merged MergeStatus = iota
	// Unmerged means that the TLF is unmerged and conflict
	// resolution needs to be done.
	Unmerged
)

func (m MergeStatus) String() string {
	switch m {
	case Merged:
		return "merged"
	case Unmerged:
		return "unmerged"
	default:
		return "unknown"
	}
}
