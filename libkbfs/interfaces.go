package libkbfs

import (
	"fmt"
	"time"

	libkb "github.com/keybase/client/go/libkb"
)

// Block just needs to be (de)serialized using msgpack
type Block interface{}

// BlockContext is used by the server to help identify blocks
type BlockContext interface {
	GetKeyId() int
	GetVer() int
	GetWriter() libkb.UID
	GetQuotaSize() uint32
}

// KBFSOps handles all file system operations.  Expands all indirect
// pointers.  Operations that modify the server data change all the
// block IDs along the path, and so must return a path with the new
// BlockIds so the caller can update their references.
type KBFSOps interface {
	GetFavDirs() ([]DirId, error)
	GetRootMDForHandle(dirHandle *DirHandle) (*RootMetadata, error)
	GetRootMD(dirId DirId) (*RootMetadata, error)
	GetDir(dir Path) (*DirBlock, error)
	CreateDir(dir Path, path string) (Path, *DirEntry, error)
	CreateFile(dir Path, path string, isEx bool) (Path, *DirEntry, error)
	CreateLink(dir Path, fromPath string, toPath string) (
		Path, *DirEntry, error)
	RemoveDir(dir Path) (Path, error)    // checks for directory empty
	RemoveEntry(file Path) (Path, error) // remove any entry
	// only works within a top-level directory
	Rename(oldParent Path, oldName string, newParent Path, newName string) (
		Path, Path, error)
	Read(file Path, dest []byte, off int64) (int64, error)
	Write(file Path, data []byte, off int64) error
	Truncate(file Path, size uint64) error
	SetEx(file Path, ex bool) (changed bool, newPath Path, err error)
	SetMtime(file Path, mtime *time.Time) (Path, error)
	Sync(file Path) (Path, error)
}

// KBPKI interacts with kbpkid to fetch info from keybase
type KBPKI interface {
	// Loads a user by assertion (could also be a username)
	ResolveAssertion(input string) (*libkb.User, error)
	// Loads user by UID and checks assumptions via identify
	GetUser(uid libkb.UID) (*libkb.User, error)
	// Get the current keybase session
	GetSession() (*libkb.Session, error)
	// Get the UID of the current logged-in user
	GetLoggedInUser() (libkb.UID, error)
	// Get all the public device sibkeys for a given user
	GetDeviceSibKeys(user *libkb.User) (map[DeviceId]Key, error)
	// Get all the encryption device subkeys for a given user
	GetDeviceSubKeys(user *libkb.User) (map[DeviceId]Key, error)
	// Get the public key that corresponds to the user's private signing key
	// TODO: Need to supply a KID here, in case the signature we're trying
	// to verify is old?
	GetPublicSigningKey(user *libkb.User) (Key, error)
	// Get the ID for this device
	GetActiveDeviceId() (DeviceId, error)
}

type KeyManager interface {
	// Get the encryption key for the given directory
	GetSecretKey(dir Path, md *RootMetadata) (Key, error)
	// Get the encryption key for the given block
	GetSecretBlockKey(dir Path, id BlockId, md *RootMetadata) (Key, error)
	// Create a new epoch of keys for the given directory
	Rekey(md *RootMetadata) error
}

// reporting levels
// MK: I sort of have something like this with G.Log.Debug, G.Log.Warn, etc..
// JS: Yeah, I was thinking about that, but I was a bit unsure about tying it
//     to a purely string-based logging system, in case we want to report
//     more complex objects.  Not sure if this is the right way to go though.
//     Very open to suggestions.
// MK: Yeah, very good point...
type ReportingLevel int

const (
	RptD ReportingLevel = iota // debug
	RptI                       // info
	RptW                       // warning
	RptE                       // error
	RptF                       // fatal
)

// Reporter exports events (asynchronously) to any number of sinks
type Reporter interface {
	Report(level ReportingLevel, message fmt.Stringer)
	LastError() (string, *time.Time)
}

// MDCache gets and puts plaintext top-level metadata into the cache.
type MDCache interface {
	Get(id MDId) (*RootMetadata, error)
	Put(id MDId, md *RootMetadata) error
}

// KeyCache gets the full block keys from a cache, as well as
// unencrypted per-directory keys
type KeyCache interface {
	GetBlockKey(id BlockId) (Key, error)
	PutBlockKey(id BlockId, key Key) error
	GetDirKey(DirId, int) (Key, error)
	PutDirKey(DirId, int, Key) error
}

// BlockCache gets and puts plaintext dir blocks and file blocks into
// a cache.
type BlockCache interface {
	Get(id BlockId) (Block, error)
	Put(id BlockId, block Block, dirty bool) error
	Delete(id BlockId) error
	Finalize(oldId BlockId, newId BlockId) error // clears dirty
	IsDirty(id BlockId) bool
}

// Crypto signs, verifies, encrypts, and decrypts stuff.
type Crypto interface {
	// Signs buf with your current active device private key
	Sign(buf []byte) ([]byte, error)
	// Verifies that sig matches buf being signed with the private key
	// that corresponds to key
	Verify(sig []byte, buf []byte, key Key) error
	// Encrypts buf using both a folder's ephemeral private key and a
	// device pubkey
	Box(privkey Key, pubkey Key, buf []byte) ([]byte, error)
	// Decrypts buf using your current active device's private key and
	// the folder's public key
	Unbox(pubkey Key, buf []byte) ([]byte, error)
	// Encrypts buf using the folder's secret key
	Encrypt(buf []byte, key Key) ([]byte, error)
	// Decrypts buf using the folder's secret key
	Decrypt(buf []byte, key Key) ([]byte, error)
	// Computes a deterministic hash of buf
	Hash(buf []byte) (libkb.NodeHash, error)
	// Verifies a given hash (the hash should include its type)
	VerifyHash(buf []byte, hash libkb.NodeHash) error
	// Computes a shared secret between two given keys
	SharedSecret(key1 Key, key2 Key) (Key, error)
	// Computes a keyed Hash MAC of buf using a shared secret
	HMAC(secret Key, buf []byte) (HMAC, error)
	// Verifies a given key and buf would hash to the given hmac.  The
	// hmac should indicate its type.
	VerifyHMAC(secret Key, buf []byte, hmac HMAC) error
	// XORs two keys together
	XOR(key1 Key, key2 Key) (Key, error)
	// Makes a random secret key, suitable for per-folder or per-block secrets
	GenRandomSecretKey() Key
	// Makes a random Curve25519 key pair, suitable for encrypting
	// per-folder secrets
	GenCurveKeyPair() (pubkey Key, privkey Key)
}

// Codec encodes and decodes arbitrary data
type Codec interface {
	Decode(buf []byte, obj interface{}) error
	Encode(obj interface{}) ([]byte, error)
}

// MDOps gets and puts root metadata to an MDServer.  On a get, it
// verifies the metadata is signed by the metadata's signing key.
type MDOps interface {
	GetAtHandle(handle *DirHandle) (*RootMetadata, error)
	Get(id DirId) (*RootMetadata, error)
	GetAtId(id DirId, mdId MDId) (*RootMetadata, error)
	Put(id DirId, md *RootMetadata) error

	GetFavorites() ([]DirId, error)
}

// KeyOps fetches server-side key halves from the key server
type KeyOps interface {
	// Get the server-side key half for a block
	GetBlockKey(id BlockId) (Key, error)
	// Put the server-side key half for a new block
	PutBlockKey(id BlockId, key Key) error
	// Delete the server-side key half for a block
	DeleteBlockKey(id BlockId) error
	// Get the server-side key half for a device for a given folder
	GetDirDeviceKey(id DirId, keyVer int, device DeviceId) (Key, error)
	// Put the server-side key half for a device for a given folder
	PutDirDeviceKey(
		id DirId, keyVer int, user libkb.UID, device DeviceId, key Key) error
	// Get the public DH key for a given user.
	// If "kid" is empty, fetch the current DH key.
	GetPublicMacKey(user libkb.UID, kid libkb.KID) (Key, error)
	// Get the private DH key for the logged-in user.
	// If "kid" is empty, fetch the current DH key.
	GetMyPrivateMacKey(kid libkb.KID) (Key, error)
}

// BlockOps gets and puts data blocks to a BlockServer. It performs
// the necessary crypto operations on each block.
type BlockOps interface {
	Get(id BlockId, context BlockContext, decryptKey Key, block Block) error
	// ready blocks by calculating their IDs and contents, so that we
	// can do a bunch of block puts in parallel for every write.
	Ready(block Block, encryptKey Key) (BlockId, []byte, error)
	Put(id BlockId, context BlockContext, buf []byte) error
	Delete(id BlockId, context BlockContext) error
}

// MDServer gets and puts metadata for each top-level directory.  The
// instantiation should be able to fetch session/user details via
// KBPKI.  On a put, the server is responsible for 1) ensuring the
// user has write permissions; 2) ensuring the writer appears as
// LastWriter; 3) ensuring the LastWriter matches the current session;
// and 4) detecting conflicting writes based on the previous root
// block ID (i.e., when it supports strict consistency).  On a get, it
// verifies the logged-in user has read permissions.
//
// TODO: Add interface for searching by time
// TODO: PutFavorites() to allow for signed favorites list
type MDServer interface {
	GetAtHandle(handle *DirHandle) (*RootMetadataSigned, error)
	Get(id DirId) (*RootMetadataSigned, error)
	GetAtId(id DirId, mdId MDId) (*RootMetadataSigned, error)
	Put(id DirId, mdId MDId, md *RootMetadataSigned) error
	GetFavorites() ([]DirId, error)
}

// KeyServer fetches server-side symmetric encryption key halves.  The
// instantiation should be able to fetch session/user details via
// KBPKI.
type KeyServer interface {
	GetBlockKey(id BlockId) (Key, error)
	PutBlockKey(id BlockId, key Key) error
	DeleteBlockKey(id BlockId) error
}

// BlockServer gets and puts opaque data blocks.  The instantiation
// should be able to fetch session/user details via KBPKI.  On a
// put/delete, the server is reponsible for: 1) checking that the ID
// matches the hash of the buffer; and 2) enforcing writer quotas.
type BlockServer interface {
	Get(id BlockId, context BlockContext) ([]byte, error)
	Put(id BlockId, context BlockContext, buf []byte) error
	Delete(id BlockId, context BlockContext) error
}

// BlockSplitter decides when a file or directory block needs to be split
type BlockSplitter interface {
	// Copy data into the block until we reach the point where we should
	// split, but only if writing to the end of the last block.  If this
	// is writing into the middle of a file, just copy everything that will
	// fit into the block, and assume that block boundaries will be fixed
	// later. Return how much was copied.
	CopyUntilSplit(
		block *FileBlock, lastBlock bool, data []byte, off int64) int64

	// Given a block, figure out whether it ends at the right place.
	// If so, return 0.  If not, return either the offset in the block
	// where it should be split, or -1 if more bytes from the next block
	// should be appended.
	CheckSplit(block *FileBlock) int64

	// Should we keep the block changes embedded in the MD or not?
	ShouldEmbedBlockChanges(bc *BlockChanges) bool
}

// Notifiee can be notified that there is an available update for a
// given directory
type Notifiee interface {
	Notify(dir DirId)
	// TODO: Notify about changes in favorites list
}

// Notifier notifies registrants of directory changes
type Notifier interface {
	Register(dirs []DirId, n Notifiee) error
	Unregister(dirs []DirId) error
}

type Config interface {
	KBFSOps() KBFSOps
	SetKBFSOps(KBFSOps)
	KBPKI() KBPKI
	SetKBPKI(KBPKI)
	KeyManager() KeyManager
	SetKeyManager(KeyManager)
	Reporter() Reporter
	SetReporter(Reporter)
	MDCache() MDCache
	SetMDCache(MDCache)
	KeyCache() KeyCache
	SetKeyCache(KeyCache)
	BlockCache() BlockCache
	SetBlockCache(BlockCache)
	Crypto() Crypto
	SetCrypto(Crypto)
	Codec() Codec
	SetCodec(Codec)
	MDOps() MDOps
	SetMDOps(MDOps)
	KeyOps() KeyOps
	SetKeyOps(KeyOps)
	BlockOps() BlockOps
	SetBlockOps(BlockOps)
	MDServer() MDServer
	SetMDServer(MDServer)
	KeyServer() KeyServer
	SetKeyServer(KeyServer)
	BlockServer() BlockServer
	SetBlockServer(BlockServer)
	BlockSplitter() BlockSplitter
	SetBlockSplitter(BlockSplitter)
	Notifier() Notifier
	SetNotifier(Notifier)
	DataVersion() int
}
