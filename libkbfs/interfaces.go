package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
)

// Block just needs to be (de)serialized using msgpack
type Block interface{}

// BlockContext is used by the server to help identify blocks
type BlockContext interface {
	GetKeyVer() KeyVer
	GetVer() Ver
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
	CreateDir(dir Path, path string) (Path, DirEntry, error)
	CreateFile(dir Path, path string, isEx bool) (Path, DirEntry, error)
	CreateLink(dir Path, fromPath string, toPath string) (
		Path, DirEntry, error)
	RemoveDir(dir Path) (Path, error)    // checks for directory empty
	RemoveEntry(file Path) (Path, error) // remove any entry
	// only works within a top-level directory
	Rename(oldParent Path, oldName string, newParent Path, newName string) (
		Path, Path, error)
	Read(file Path, dest []byte, off int64) (int64, error)
	Write(file Path, data []byte, off int64) error
	Truncate(file Path, size uint64) error
	SetEx(file Path, ex bool) (newPath Path, err error)
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
	// Returns nil if the given user has the given VerifyingKey,
	// and an error otherwise.
	//
	// TODO: Add a timestamp argument (or similar) so that we can
	// check for revocation.
	HasVerifyingKey(uid libkb.UID, verifyingKey VerifyingKey) error
	// Get all of a user's crypt public keys (one per device).
	GetCryptPublicKeys(uid libkb.UID) ([]CryptPublicKey, error)
	// Get the crypt public key for the currently-active device.
	GetCurrentCryptPublicKey() (CryptPublicKey, error)
}

type KeyManager interface {
	// Get the crypt key for the given TLF.
	GetTLFCryptKey(dir Path, md *RootMetadata) (TLFCryptKey, error)
	// Get the crypt key for the given block.
	GetBlockCryptKey(dir Path, id BlockId, md *RootMetadata) (BlockCryptKey, error)
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

// KeyCache handles caching for both TLFCryptKeys and BlockCryptKeys.
type KeyCache interface {
	GetTLFCryptKey(DirId, KeyVer) (TLFCryptKey, error)
	PutTLFCryptKey(DirId, KeyVer, TLFCryptKey) error
	GetBlockCryptKey(id BlockId) (BlockCryptKey, error)
	PutBlockCryptKey(id BlockId, key BlockCryptKey) error
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
	// Make objects of various types using a CSPRNG.
	MakeRandomBlockId() (BlockId, error)
	MakeRandomTLFKeys() (TLFPublicKey, TLFPrivateKey, TLFEphemeralPublicKey, TLFEphemeralPrivateKey, TLFCryptKey, error)
	MakeRandomTLFCryptKeyServerHalf() (TLFCryptKeyServerHalf, error)
	MakeRandomBlockCryptKeyServerHalf() (BlockCryptKeyServerHalf, error)

	// Mask and unmask objects of various types.
	MaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, key TLFCryptKey) (TLFCryptKeyClientHalf, error)
	UnmaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, clientHalf TLFCryptKeyClientHalf) (TLFCryptKey, error)
	UnmaskBlockCryptKey(serverHalf BlockCryptKeyServerHalf, tlfCryptKey TLFCryptKey) (BlockCryptKey, error)

	// Sign msg with the current device's private key.
	Sign(msg []byte) (sig []byte, verifyingKey VerifyingKey, err error)
	// Verify that sig matches msg being signed with the private
	// key that corresponds to verifyingKey.
	Verify(sig []byte, msg []byte, verifyingKey VerifyingKey) (err error)

	// Encrypt a TLFCryptKeyClientHalf using both a TLF's
	// ephemeral private key and a device pubkey.
	EncryptTLFCryptKeyClientHalf(privateKey TLFEphemeralPrivateKey, publicKey CryptPublicKey, clientHalf TLFCryptKeyClientHalf) ([]byte, error)
	// Decrypt a TLFCryptKeyClientHalf using the current device's
	// private key and the TLF's ephemeral public key.
	DecryptTLFCryptKeyClientHalf(publicKey TLFEphemeralPublicKey, buf []byte) (TLFCryptKeyClientHalf, error)

	// Encrypt/decrypt a serialized PrivateMetadata object.
	EncryptPrivateMetadata(buf []byte, key TLFCryptKey) ([]byte, error)
	DecryptPrivateMetadata(buf []byte, key TLFCryptKey) ([]byte, error)

	// Encrypt a block. plainSize is the size of the encoded
	// block; EncryptBlock() must guarantee that plainSize <=
	// len(encryptedBlock).
	EncryptBlock(block Block, key BlockCryptKey) (plainSize int, encryptedBlock []byte, err error)

	// Decrypt a block. Similar to EncryptBlock(), DecryptBlock()
	// must guarantee that (size of the decrypted block) <=
	// len(encryptedBlock).
	DecryptBlock(encryptedBlock []byte, key BlockCryptKey, block Block) error

	// Computes a keyed MAC of buf using a shared secret derived
	// from the given MacPublicKey and the current user's MAC
	// private key.
	MAC(publicKey MacPublicKey, buf []byte) (MAC, error)
	// Verifies a given key and buf would hash to the given mac.  The
	// mac should indicate its type.
	VerifyMAC(publicKey MacPublicKey, buf []byte, mac MAC) error

	// Computes a deterministic hash of buf.
	Hash(buf []byte) (libkb.NodeHash, error)
	// Verifies a given hash (the hash should include its type).
	VerifyHash(buf []byte, hash libkb.NodeHash) error
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

// KeyOps fetches server-side key halves and MAC public keys from the
// key server.
type KeyOps interface {
	// Get the server-side key half for a block.
	GetBlockCryptKeyServerHalf(id BlockId) (BlockCryptKeyServerHalf, error)
	// Put the server-side key half for a new block.
	PutBlockCryptKeyServerHalf(id BlockId, serverHalf BlockCryptKeyServerHalf) error
	// Delete the server-side key half for a block.
	DeleteBlockCryptKeyServerHalf(id BlockId) error

	// Get the server-side key half for a device (identified by
	// its CryptPublicKey) for a given TLF.
	GetTLFCryptKeyServerHalf(id DirId, keyVer KeyVer, cryptPublicKey CryptPublicKey) (TLFCryptKeyServerHalf, error)
	// Put the server-side key half for a device (identified by
	// its CryptPublicKey) for a given TLF.
	PutTLFCryptKeyServerHalf(
		id DirId, keyVer KeyVer, user libkb.UID, cryptPublicKey CryptPublicKey, serverHalf TLFCryptKeyServerHalf) error

	// Get the public MAC key for a given user.
	GetMacPublicKey(uid libkb.UID) (MacPublicKey, error)
}

// BlockOps gets and puts data blocks to a BlockServer. It performs
// the necessary crypto operations on each block.
type BlockOps interface {
	Get(id BlockId, context BlockContext, cryptKey BlockCryptKey, block Block) error
	// Ready blocks by calculating their IDs and contents, so that we
	// can do a bunch of block puts in parallel for every write.
	// Ready() must guarantee that plainSize <= len(buf).
	Ready(block Block, cryptKey BlockCryptKey) (
		id BlockId, plainSize int, buf []byte, err error)
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

// Observer can be notified that there is an available update for a
// given directory.  The notification callbacks should not block, or
// make any calls to the Notifier interface.
type Observer interface {
	// LocalChange announces that the file at this path has been
	// updated locally, but not yet saved at the server.  The nodes
	// along the path are still identified by the same IDs.
	LocalChange(path Path)
	// BatchChanges announces that the files at this path have all
	// been updated together, and may have changed their IDs.
	BatchChanges(dir DirId, paths []Path)
	// TODO: Notify about changes in favorites list
}

// Notifier notifies registrants of directory changes
type Notifier interface {
	RegisterForChanges(dirs []DirId, obs Observer) error
	UnregisterFromChanges(dirs []DirId, obs Observer) error
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
	BlockServer() BlockServer
	SetBlockServer(BlockServer)
	BlockSplitter() BlockSplitter
	SetBlockSplitter(BlockSplitter)
	Notifier() Notifier
	SetNotifier(Notifier)
	DataVersion() Ver
	// the number of read or write operations that can be buffered per folder
	ReqsBufSize() int
}
