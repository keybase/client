package libkbfs

import (
	"fmt"
	"reflect"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// Block just needs to be (de)serialized using msgpack
type Block interface{}

// BlockContext is used by the server to help identify blocks
type BlockContext interface {
	// GetWriter returns the UID of the writer for the corresponding block
	GetWriter() keybase1.UID
	// GetRefNonce returns the unique reference nonce for this block
	GetRefNonce() BlockRefNonce
}

// NodeID is a unique but transient ID for a Node. That is, two Node
// objects in memory at the same time represent the same file or
// directory if and only if their NodeIDs are equal (by pointer).
type NodeID interface {
	// ParentID returns the NodeID of the directory containing the
	// pointed-to file or directory, or nil if none exists.
	ParentID() NodeID
}

// Node represents a direct pointer to a file or directory in KBFS.
// It is somewhat like an inode in a regular file system.  Users of
// KBFS can use Node as a handle when accessing files or directories
// they have previously looked up.
type Node interface {
	// GetID returns the ID of this Node. This should be used as a
	// map key instead of the Node itself.
	GetID() NodeID
	// GetFolderBranch returns the folder ID and branch for this Node.
	GetFolderBranch() FolderBranch
	// GetBasename returns the current basename of the node, or ""
	// if the node has been unlinked.
	GetBasename() string
}

// KBFSOps handles all file system operations.  Expands all indirect
// pointers.  Operations that modify the server data change all the
// block IDs along the path, and so must return a path with the new
// BlockIds so the caller can update their references.
//
// KBFSOps implementations must guarantee goroutine-safety of calls on
// a per-top-level-folder basis.
//
// There are two types of operations that could block:
//   * remote-sync operations, that need to synchronously update the
//     MD for the corresponding top-level folder.  When these
//     operations return successfully, they will have guaranteed to
//     have successfully written the modification to the KBFS servers.
//   * remote-access operations, that don't sync any modifications to KBFS
//     servers, but may block on reading data from the servers.
//
// KBFSOps implementations are supposed to give git-like consistency
// semantics for modification operations; they will be visible to
// other clients immediately after the remote-sync operations succeed,
// if and only if there was no other intervening modification to the
// same folder.  If not, the change will be sync'd to the server in a
// special per-device "unmerged" area before the operation succeeds.
// In this case, the modification will not be visible to other clients
// until the KBFS code on this device performs automatic conflict
// resolution in the background.
//
// All methods take a Context (see https://blog.golang.org/context),
// and if that context is cancelled during the operation, KBFSOps will
// abort any blocking calls and fail the operation with a
// CanceledError.  Any notifications resulting from an operation will
// also include this ctx (or a Context derived from it), allowing the
// caller to determine whether the notification is a result of their
// own action or an external action.
type KBFSOps interface {
	// GetFavorites returns the logged-in user's list of favorite
	// top-level folders.  This is a remote-access operation.
	GetFavorites(ctx context.Context) ([]TlfID, error)
	// GetOrCreateRootNodeByHandle returns the root node and root
	// directory entry associated with the given TlfHandle and branch,
	// if the logged-in user has read permissions to the top-level
	// folder.  It creates the folder if one doesn't exist yet (and
	// branch == MasterBranch), and the logged-in user has write
	// permissions to the top-level folder.  This is a remote-access
	// operation.
	GetOrCreateRootNodeForHandle(ctx context.Context, handle *TlfHandle,
		branch BranchName) (Node, DirEntry, error)
	// GetRootNode returns the root node, root directory entry, and
	// handle associated with the given TlfID and branch, if the
	// logged-in user has read permissions to the top-level folder.
	// This is a remote-access operation.
	GetRootNode(ctx context.Context, folderBranch FolderBranch) (
		Node, DirEntry, *TlfHandle, error)
	// GetDirChildren returns a map of children in the directory,
	// mapped to their EntryType, if the logged-in user has read
	// permission for the top-level folder.  This is a remote-access
	// operation.
	GetDirChildren(ctx context.Context, dir Node) (map[string]EntryType, error)
	// Lookup returns the Node and directory entry associated with a
	// given name in a directory, if the logged-in user has read
	// permissions to the top-level folder.  The returned Node is nil
	// if the name is a symlink.  This is a remote-access operation.
	Lookup(ctx context.Context, dir Node, name string) (Node, DirEntry, error)
	// Stat returns the directory entry associated with a
	// given Node, if the logged-in user has read permissions to the
	// top-level folder.  This is a remote-access operation.
	Stat(ctx context.Context, node Node) (DirEntry, error)
	// CreateDir creates a new subdirectory under the given node, if
	// the logged-in user has write permission to the top-level
	// folder.  Returns the new Node for the created subdirectory, and
	// its new directory entry.  This is a remote-sync operation.
	CreateDir(ctx context.Context, dir Node, name string) (
		Node, DirEntry, error)
	// CreateFile creates a new file under the given node, if the
	// logged-in user has write permission to the top-level folder.
	// Returns the new Node for the created file, and its new
	// directory entry.  This is a remote-sync operation.
	CreateFile(ctx context.Context, dir Node, name string, isEx bool) (
		Node, DirEntry, error)
	// CreateLink creates a new symlink under the given node, if the
	// logged-in user has write permission to the top-level folder.
	// Returns the new directory entry for the created symlink.  This
	// is a remote-sync operation.
	CreateLink(ctx context.Context, dir Node, fromName string, toPath string) (
		DirEntry, error)
	// RemoveDir removes the subdirectory represented by the given
	// node, if the logged-in user has write permission to the
	// top-level folder.  Will return an error if the subdirectory is
	// not empty.  This is a remote-sync operation.
	RemoveDir(ctx context.Context, dir Node, dirName string) error
	// RemoveEntry removes the directory entry represented by the
	// given node, if the logged-in user has write permission to the
	// top-level folder.  This is a remote-sync operation.
	RemoveEntry(ctx context.Context, dir Node, name string) error
	// Rename performs an atomic rename operation with a given
	// top-level folder if the logged-in user has write permission to
	// that folder, and will return an error if nodes from different
	// folders are passed in.  This is a remote-sync operation.
	Rename(ctx context.Context, oldParent Node, oldName string, newParent Node,
		newName string) error
	// Read fills in the given buffer with data from the file at the
	// given node starting at the given offset, if the logged-in user
	// has read permission to the top-level folder.  The read data
	// reflects any outstanding writes and truncates to that file that
	// have been written through this KBFSOps object, even if those
	// writes have not yet been sync'd.  There is no guarantee that
	// Read returns all of the requested data; it will return the
	// number of bytes that it wrote to the dest buffer.  Reads on an
	// unlinked file may or may not succeed, depending on whether or
	// not the data has been cached locally.  If (0, nil) is returned,
	// that means EOF has been reached. This is a remote-access
	// operation.
	Read(ctx context.Context, file Node, dest []byte, off int64) (int64, error)
	// Write modifies the file at the given node, by writing the given
	// buffer at the given offset within the file, if the logged-in
	// user has write permission to the top-level folder.  It
	// overwrites any data already there, and extends the file size as
	// necessary to accomodate the new data.  It guarantees to write
	// the entire buffer in one operation.  Writes on an unlinked file
	// may or may not succeed as no-ops, depending on whether or not
	// the necessary blocks have been locally cached.  This is a
	// remote-access operation.
	Write(ctx context.Context, file Node, data []byte, off int64) error
	// Truncate modifies the file at the given node, by either
	// shrinking or extending its size to match the given size, if the
	// logged-in user has write permission to the top-level folder.
	// If extending the file, it pads the new data with 0s.  Truncates
	// on an unlinked file may or may not succeed as no-ops, depending
	// on whether or not the necessary blocks have been locally
	// cached.  This is a remote-access operation.
	Truncate(ctx context.Context, file Node, size uint64) error
	// SetEx turns on or off the executable bit on the file
	// represented by a given node, if the logged-in user has write
	// permissions to the top-level folder.  This is a remote-sync
	// operation.
	SetEx(ctx context.Context, file Node, ex bool) error
	// SetMtime sets the modification time on the file represented by
	// a given node, if the logged-in user has write permissions to
	// the top-level folder.  If mtime is nil, it is a noop.  This is
	// a remote-sync operation.
	SetMtime(ctx context.Context, file Node, mtime *time.Time) error
	// Sync flushes all outstanding writes and truncates for the given
	// file to the KBFS servers, if the logged-in user has write
	// permissions to the top-level folder.  If done through a file
	// system interface, this may include modifications done via
	// multiple file handles.  This is a remote-sync operation.
	Sync(ctx context.Context, file Node) error
}

// KBPKI interacts with kbpkid to fetch info from keybase
type KBPKI interface {
	// ResolveAssertion loads a user by assertion (could also be a username)
	ResolveAssertion(input string) (*libkb.User, error)
	// GetUser loads user by UID and checks assumptions via identify
	GetUser(uid keybase1.UID) (*libkb.User, error)
	// GetSession gets the current keybase session
	GetSession() (*libkb.Session, error)
	// GetLoggedInUser gets the UID of the current logged-in user
	GetLoggedInUser() (keybase1.UID, error)
	// HasVerifyingKey returns nil if the given user has the given
	// VerifyingKey, and an error otherwise.
	//
	// TODO: Add a timestamp argument (or similar) so that we can
	// check for revocation.
	HasVerifyingKey(uid keybase1.UID, verifyingKey VerifyingKey) error
	// GetCryptPublicKeys gets all of a user's crypt public keys (one
	// per device).
	GetCryptPublicKeys(uid keybase1.UID) ([]CryptPublicKey, error)
	// GetCurrentCryptPublicKey gets the crypt public key for the
	// currently-active device.
	GetCurrentCryptPublicKey() (CryptPublicKey, error)
}

// KeyManager fetches and constructs the keys needed for KBFS file
// operations.
type KeyManager interface {
	// GetTLFCryptKeyForEncryption gets the crypt key to use for
	// encryption (i.e., with the latest key generation) for the
	// TLF with the given metadata.
	GetTLFCryptKeyForEncryption(md *RootMetadata) (TLFCryptKey, error)

	// GetTLFCryptKeyForMDDecryption gets the crypt key to use for
	// the TLF with the given metadata to decrypt the private
	// portion of the metadata.
	GetTLFCryptKeyForMDDecryption(md *RootMetadata) (TLFCryptKey, error)

	// GetTLFCryptKeyForBlockDecryption gets the crypt key to use
	// for the TLF with the given metadata to decrypt the block
	// pointed to by the given pointer.
	GetTLFCryptKeyForBlockDecryption(md *RootMetadata, blockPtr BlockPointer) (TLFCryptKey, error)

	// Rekey creates a new epoch of keys for the given TLF, which
	// must not be public.
	Rekey(md *RootMetadata) error
}

// ReportingLevel indicate the severity of a reported event.
// MK: I sort of have something like this with G.Log.Debug, G.Log.Warn, etc..
// JS: Yeah, I was thinking about that, but I was a bit unsure about tying it
//     to a purely string-based logging system, in case we want to report
//     more complex objects.  Not sure if this is the right way to go though.
//     Very open to suggestions.
// MK: Yeah, very good point...
type ReportingLevel int

const (
	// RptD indicates a debug-level event
	RptD ReportingLevel = iota
	// RptI indicates a info-level event
	RptI
	// RptW indicates a warning-level event
	RptW
	// RptE indicates a error-level event
	RptE
	// RptF indicates a fatal-level event
	RptF
)

// Reporter exports events (asynchronously) to any number of sinks
type Reporter interface {
	// Report records that a given event happened at the given reporting level.
	Report(level ReportingLevel, message fmt.Stringer)
	// LastError returns the last error-level event that occurred on
	// this device.
	LastError() (string, *time.Time)
}

// MDCache gets and puts plaintext top-level metadata into the cache.
type MDCache interface {
	// Get gets the metadata object associated with the given MD ID.
	Get(id MdID) (*RootMetadata, error)
	// Put stores the metadata object associated with the given MD ID.
	Put(id MdID, md *RootMetadata) error
}

// KeyCache handles caching for both TLFCryptKeys and BlockCryptKeys.
type KeyCache interface {
	// GetTLFCryptKey gets the crypt key for the given TLF.
	GetTLFCryptKey(TlfID, KeyGen) (TLFCryptKey, error)
	// PutTLFCryptKey stores the crypt key for the given TLF.
	PutTLFCryptKey(TlfID, KeyGen, TLFCryptKey) error
}

// BlockCache gets and puts plaintext dir blocks and file blocks into
// a cache.
type BlockCache interface {
	// Get gets the block associated with the given block ID.  Returns
	// the dirty block for the given ID, if one exists.
	Get(ptr BlockPointer, branch BranchName) (Block, error)
	// Put stores the final (content-addressable) block associated
	// with the given block ID.
	Put(id BlockID, block Block) error
	// PutDirty stores a dirty block currently identified by the given
	// block pointer and branch name.
	PutDirty(ptr BlockPointer, branch BranchName, block Block) error
	// Delete removes the (non-dirty) block associated with the given
	// block ID from the cache.  No error is returned if no block
	// exists for the given ID.
	Delete(id BlockID) error
	// DeleteDirty removes the dirty block associated with the given
	// block pointer and branch from the cache.  No error is returned
	// if no block exists for the given ID.
	DeleteDirty(ptr BlockPointer, branch BranchName) error
	// IsDirty states whether or not the block associated with the
	// given block pointer and branch name is dirty in this cache.
	IsDirty(ptr BlockPointer, branch BranchName) bool
}

// Crypto signs, verifies, encrypts, and decrypts stuff.
type Crypto interface {
	// MakeRandomTlfID generates a dir ID using a CSPRNG.
	MakeRandomTlfID(isPublic bool) (TlfID, error)

	// MakeTemporaryBlockID generates a temporary block ID using a
	// CSPRNG. This is used for indirect blocks before they're
	// committed to the server.
	MakeTemporaryBlockID() (BlockID, error)

	// MakeRefNonce generates a block reference nonce using a
	// CSPRNG. This is used for distinguishing different references to
	// the same BlockID.
	MakeBlockRefNonce() (BlockRefNonce, error)

	// MakeRandomTLFKeys generates top-level folder keys using a CSPRNG.
	MakeRandomTLFKeys() (TLFPublicKey, TLFPrivateKey, TLFEphemeralPublicKey,
		TLFEphemeralPrivateKey, TLFCryptKey, error)
	// MakeRandomTLFCryptKeyServerHalf generates the server-side of a
	// top-level folder crypt key.
	MakeRandomTLFCryptKeyServerHalf() (TLFCryptKeyServerHalf, error)
	// MakeRandomBlockCryptKeyServerHalf generates the server-side of
	// a block crypt key.
	MakeRandomBlockCryptKeyServerHalf() (BlockCryptKeyServerHalf, error)

	// MaskTLFCryptKey returns the client-side of a top-level folder crypt key.
	MaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf, key TLFCryptKey) (
		TLFCryptKeyClientHalf, error)
	// UnmaskTLFCryptKey returns the top-level folder crypt key.
	UnmaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf,
		clientHalf TLFCryptKeyClientHalf) (TLFCryptKey, error)
	// UnmaskBlockCryptKey returns the block crypt key.
	UnmaskBlockCryptKey(serverHalf BlockCryptKeyServerHalf,
		tlfCryptKey TLFCryptKey) (BlockCryptKey, error)

	// Sign signs the msg with the current device's private key.
	Sign(msg []byte) (sigInfo SignatureInfo, err error)
	// Verify verifies that sig matches msg being signed with the
	// private key that corresponds to verifyingKey.
	Verify(msg []byte, sigInfo SignatureInfo) error

	// EncryptTLFCryptKeyClientHalf encrypts a TLFCryptKeyClientHalf
	// using both a TLF's ephemeral private key and a device pubkey.
	EncryptTLFCryptKeyClientHalf(privateKey TLFEphemeralPrivateKey,
		publicKey CryptPublicKey, clientHalf TLFCryptKeyClientHalf) (
		EncryptedTLFCryptKeyClientHalf, error)

	// DecryptTLFCryptKeyClientHalf decrypts a TLFCryptKeyClientHalf
	// using the current device's private key and the TLF's ephemeral
	// public key.
	DecryptTLFCryptKeyClientHalf(publicKey TLFEphemeralPublicKey,
		encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
		TLFCryptKeyClientHalf, error)

	// EncryptPrivateMetadata encrypts a PrivateMetadata object.
	EncryptPrivateMetadata(pmd *PrivateMetadata, key TLFCryptKey) (EncryptedPrivateMetadata, error)
	// DecryptPrivateMetadata decrypts a PrivateMetadata object.
	DecryptPrivateMetadata(encryptedPMD EncryptedPrivateMetadata, key TLFCryptKey) (*PrivateMetadata, error)

	// EncryptBlocks encrypts a block. plainSize is the size of the encoded
	// block; EncryptBlock() must guarantee that plainSize <=
	// len(encryptedBlock).
	EncryptBlock(block Block, key BlockCryptKey) (
		plainSize int, encryptedBlock EncryptedBlock, err error)

	// DecryptBlock decrypts a block. Similar to EncryptBlock(),
	// DecryptBlock() must guarantee that (size of the decrypted
	// block) <= len(encryptedBlock).
	DecryptBlock(encryptedBlock EncryptedBlock, key BlockCryptKey, block Block) error

	// Mac computes a keyed MAC of buf using a shared secret derived
	// from the given MacPublicKey and the current user's MAC private
	// key.
	MAC(publicKey MacPublicKey, buf []byte) (MAC, error)
	// VerifyMac verifies a given key and buf would hash to the given
	// mac.  The mac should indicate its type.
	VerifyMAC(publicKey MacPublicKey, buf []byte, mac MAC) error

	// Hash computes a deterministic hash of buf.
	Hash(buf []byte) (libkb.NodeHash, error)
	// VerifyHash verifies a given hash (the hash should include its
	// type).
	VerifyHash(buf []byte, hash libkb.NodeHash) error
}

// Codec encodes and decodes arbitrary data
type Codec interface {
	// Decode unmarshals the given buffer into the given object, if possible.
	Decode(buf []byte, obj interface{}) error
	// Encode marshals the given object into a returned buffer.
	Encode(obj interface{}) ([]byte, error)
	// RegisterType should be called for all types that are stored
	// under ambiguous types (like interface{}) in a struct that will
	// be encoded/decoded by the codec.  Each must have a unique
	// extCode.  Types that include other extension types are not
	// supported.
	RegisterType(rt reflect.Type, code extCode)
}

// MDOps gets and puts root metadata to an MDServer.  On a get, it
// verifies the metadata is signed by the metadata's signing key.
type MDOps interface {
	// GetForHandle returns the current metadata object corresponding
	// to the given top-level folder's handle, if the logged-in user
	// has read permission on the folder.  It creates the folder if
	// one doesn't exist yet, and the logged-in user has write
	// permissions to the top-level folder.
	GetForHandle(ctx context.Context, handle *TlfHandle) (*RootMetadata, error)
	// GetForTLF returns the current metadata object corresponding to the
	// given top-level folder, if the logged-in user has read
	// permission on the folder.
	GetForTLF(ctx context.Context, id TlfID) (*RootMetadata, error)
	// Get returns the metadata object corresponding that matches the
	// provided MD ID, if one exists and the logged-in user has read
	// permissions on the corresponding top-level folder.
	Get(ctx context.Context, mdID MdID) (*RootMetadata, error)
	// Put stores the given metadata object for the top-level folder
	// on the server, if the logged-in user has write permission on
	// the folder.  If deviceID is non-nil, the unmerged history for
	// the corresponding device is updated to indicate that everything
	// up to and including the provided unmergedBase has been merged
	// (similar to a git rebase).  If the server cannot commit this MD
	// to this top-level folder because md.PrevRoot does not match the
	// current MD object for the folder due to another concurrent
	// writer, it will return a specific error (TODO: make one) and
	// the caller is expected to call PutUnmerged if it wants
	// durability over consistency.
	Put(ctx context.Context, id TlfID, rmd *RootMetadata,
		deviceKID keybase1.KID, unmergedBase MdID) error
	// GetSince returns all the MD objects that have been committed
	// since (not including) the stated mdID, up to a client-imposed
	// maximum.  The server may return fewer, and should also indicate
	// whether there are more that could be returned.
	GetSince(ctx context.Context, id TlfID, mdID MdID, max int) (
		sinceRmds []*RootMetadata, hasMore bool, err error)

	// PutUnmerged gives each device (identified by the device subkey
	// KID) the ability to store its own unmerged version of the
	// metadata, in order to provide per-device durability when
	// consistency can't be quickly guaranteed.
	PutUnmerged(ctx context.Context, id TlfID, rmd *RootMetadata,
		deviceKID keybase1.KID) error
	// GetUnmergedSince returns all the MD objects that have been
	// saved to the unmerged linear history for this device since (not
	// including) the stated mdID, up to a client-imposed maximum.
	// The server may return fewer, and should also indicate whether
	// there are more that could be returned.   If mdID is the nil
	// value, it returns the list of MD objects from the beginning of
	// the unmerged history for this device.
	GetUnmergedSince(ctx context.Context, id TlfID, deviceKID keybase1.KID,
		mdID MdID, max int) (sinceRmds []*RootMetadata, hasMore bool, err error)

	// GetFavorites returns the logged-in user's list of favorite
	// top-level folders.
	GetFavorites(ctx context.Context) ([]TlfID, error)
}

// KeyOps fetches server-side key halves and MAC public keys from the
// key server.
type KeyOps interface {
	// GetTLFCryptKeyServerHalf gets the server-side key half for a
	// device (identified by its CryptPublicKey) for a given TLF.
	GetTLFCryptKeyServerHalf(id TlfID, keyGen KeyGen,
		cryptPublicKey CryptPublicKey) (TLFCryptKeyServerHalf, error)
	// PutTLFCryptKeyServerHalf puts the server-side key half for a
	// device (identified by its CryptPublicKey) for a given TLF.
	PutTLFCryptKeyServerHalf(id TlfID, keyGen KeyGen,
		cryptPublicKey CryptPublicKey, serverHalf TLFCryptKeyServerHalf) error

	// GetMacPublicKey gets the public MAC key for a given user.
	GetMacPublicKey(uid keybase1.UID) (MacPublicKey, error)
}

// BlockOps gets and puts data blocks to a BlockServer. It performs
// the necessary crypto operations on each block.
type BlockOps interface {
	// Get gets the block associated with the given block pointer
	// (which belongs to the TLF with the given metadata),
	// decrypts it if necessary, and fills in the provided block
	// object with its contents, if the logged-in user has read
	// permission for that block.
	Get(ctx context.Context, md *RootMetadata, blockPtr BlockPointer,
		block Block) error

	// Ready turns the given block (which belongs to the TLF with
	// the given metadata) into encoded (and encrypted) data, and
	// calculates its ID and size, so that we can do a bunch of
	// block puts in parallel for every write. Ready() must
	// guarantee that plainSize <= readyBlockData.QuotaSize().
	Ready(md *RootMetadata, block Block) (
		id BlockID, plainSize int, readyBlockData ReadyBlockData, err error)

	// Put stores the readied block data under the given block
	// pointer (which belongs to the TLF with the given metadata)
	// on the server.
	Put(ctx context.Context, md *RootMetadata, blockPtr BlockPointer,
		readyBlockData ReadyBlockData) error

	// Delete instructs the server to delete the block data associated
	// with the given ID and context.
	Delete(ctx context.Context, md *RootMetadata, id BlockID,
		context BlockContext) error
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
	// GetForHandle returns the current (signed/encrypted) metadata
	// object corresponding to the given top-level folder's handle, if
	// the logged-in user has read permission on the folder.  It
	// creates the folder if one doesn't exist yet, and the logged-in
	// user has permission to do so.
	GetForHandle(ctx context.Context, handle *TlfHandle) (
		*RootMetadataSigned, error)
	// GetForTLF returns the current (signed/encrypted) metadata object
	// corresponding to the given top-level folder, if the logged-in
	// user has read permission on the folder.
	GetForTLF(ctx context.Context, id TlfID) (*RootMetadataSigned, error)
	// Get returns the (signed/encrypted) metadata object that matches
	// the provided MD ID, if one exists and the logged-in user has
	// read permission on the corresponding top-level folder.
	Get(ctx context.Context, mdID MdID) (*RootMetadataSigned, error)
	// GetSince returns all the MD objects that have been committed
	// since (not including) the stated mdID, up to a client-imposed
	// maximum.  The server may return fewer, and should also indicate
	// whether there are more that could be returned.
	GetSince(ctx context.Context, id TlfID, mdID MdID, max int) (
		sinceRmds []*RootMetadataSigned, hasMore bool, err error)
	// Put stores the (signed/encrypted) metadata object for the given
	// top-level folder, under the given MD ID.  If deviceID is
	// non-nil, the unmerged history for the corresponding device is
	// updated to indicate that everything up to and including the
	// provided unmergedBase has been merged (similar to a git
	// rebase).  If the server cannot commit this MD to this top-level
	// folder because md.PrevRoot does not match the current MD object
	// for the folder due to another concurrent writer, it will return
	// a specific error (TODO: make one) and the caller is expected to
	// call PutUnmerged if it wants durability over consistency.
	Put(ctx context.Context, id TlfID, mdID MdID, rmds *RootMetadataSigned,
		deviceKID keybase1.KID, unmergedBase MdID) error

	// PutUnmerged gives each device (identified by the device subkey
	// KID) the ability to store its own unmerged version of the
	// metadata, in order to provide per-device durability when
	// consistency can't be quickly guaranteed.
	PutUnmerged(ctx context.Context, id TlfID, mdID MdID,
		rmds *RootMetadataSigned, deviceKID keybase1.KID) error
	// GetUnmergedSince returns all the MD objects that have been
	// saved to the unmerged linear history for this device since (not
	// including) the stated mdID, up to a client-imposed maximum.
	// The server may return fewer, and should also indicate whether
	// there are more that could be returned.  If mdID is the nil
	// value, it returns the list of MD objects from the beginning of
	// the unmerged history for this device.
	GetUnmergedSince(ctx context.Context, id TlfID, deviceKID keybase1.KID,
		mdID MdID, max int) (
		sinceRmds []*RootMetadataSigned, hasMore bool, err error)

	// GetFavorites returns the logged-in user's list of favorite
	// top-level folders.
	// TODO: this data should be at least signed.
	GetFavorites(ctx context.Context) ([]TlfID, error)
}

// BlockServer gets and puts opaque data blocks.  The instantiation
// should be able to fetch session/user details via KBPKI.  On a
// put/delete, the server is reponsible for: 1) checking that the ID
// matches the hash of the buffer; and 2) enforcing writer quotas.
type BlockServer interface {
	// Get gets the (encrypted) block data associated with the given
	// block ID and context, uses the provided block key to decrypt
	// the block, and fills in the provided block object with its
	// contents, if the logged-in user has read permission for that
	// block.
	Get(ctx context.Context, id BlockID, context BlockContext) (
		[]byte, BlockCryptKeyServerHalf, error)
	// Put stores the (encrypted) block data under the given ID and
	// context on the server, along with the server half of the block
	// key.
	Put(ctx context.Context, id BlockID, tlfID TlfID, context BlockContext,
		buf []byte, serverHalf BlockCryptKeyServerHalf) error
	// Delete instructs the server to delete the block data
	// associated with the given ID. No error is returned if no
	// data exists for the given ID.
	Delete(ctx context.Context, id BlockID, tlfID TlfID,
		context BlockContext) error
}

// BlockSplitter decides when a file or directory block needs to be split
type BlockSplitter interface {
	// CopyUntilSplit copies data into the block until we reach the
	// point where we should split, but only if writing to the end of
	// the last block.  If this is writing into the middle of a file,
	// just copy everything that will fit into the block, and assume
	// that block boundaries will be fixed later. Return how much was
	// copied.
	CopyUntilSplit(
		block *FileBlock, lastBlock bool, data []byte, off int64) int64

	// CheckSplit, given a block, figures out whether it ends at the
	// right place.  If so, return 0.  If not, return either the
	// offset in the block where it should be split, or -1 if more
	// bytes from the next block should be appended.
	CheckSplit(block *FileBlock) int64

	// ShouldEmbedBlockChanges decides whether we should keep the
	// block changes embedded in the MD or not.
	ShouldEmbedBlockChanges(bc *BlockChanges) bool
}

// NodeChange represents a change made to a node as part of an atomic
// file system operation.
type NodeChange struct {
	Node Node
	// Basenames of entries added/removed.
	DirUpdated  []string
	FileUpdated []WriteRange
}

// Observer can be notified that there is an available update for a
// given directory.  The notification callbacks should not block, or
// make any calls to the Notifier interface.  Nodes passed to the
// observer should not be held past the end of the notification
// callback.
type Observer interface {
	// LocalChange announces that the file at this Node has been
	// updated locally, but not yet saved at the server.
	LocalChange(ctx context.Context, node Node, write WriteRange)
	// BatchChanges announces that the nodes have all been updated
	// together atomically.  Each NodeChange in changes affects the
	// same top-level folder and branch.
	BatchChanges(ctx context.Context, changes []NodeChange)
	// TODO: Notify about changes in favorites list
}

// Notifier notifies registrants of directory changes
type Notifier interface {
	// RegisterForChanges declares that the given Observer wants to
	// subscribe to updates for the given top-level folders.
	RegisterForChanges(folderBranches []FolderBranch, obs Observer) error
	// UnregisterFromChanges declares that the given Observer no
	// longer wants to subscribe to updates for the given top-level
	// folders.
	UnregisterFromChanges(folderBranches []FolderBranch, obs Observer) error
}

// Config collects all the singleton instance instantiations needed to
// run KBFS in one place.  The methods below are self-explanatory and
// do not require comments.
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
	DataVersion() DataVer
	// ReqsBufSize indicates the number of read or write operations
	// that can be buffered per folder
	ReqsBufSize() int
}

// NodeCache holds Nodes, and allows libkbfs to update them when
// things change about the underlying KBFS blocks.  It is probably
// most useful to instantiate this on a per-folder-branch basis, so
// that it can create a Path with the correct DirId and Branch name.
type NodeCache interface {
	// GetOrCreate either makes a new Node for the given
	// BlockPointer, or returns an existing one. TODO: If we ever
	// support hard links, we will have to revisit the "name" and
	// "parent" parameters here.  name must not be empty. Returns
	// an error if parent cannot be found.
	GetOrCreate(ptr BlockPointer, name string, parent Node) (Node, error)
	// Get returns the Node associated with the given ptr if one
	// already exists.  Otherwise, it returns nil.
	Get(ptr BlockPointer) Node
	// UpdatePointer swaps the BlockPointer for the corresponding
	// Node.  NodeCache ignores this call when oldPtr is not cached in
	// any Node.
	UpdatePointer(oldPtr BlockPointer, newPtr BlockPointer)
	// Move swaps the parent node for the corresponding Node, and
	// updates the node's name.  NodeCache ignores the call when ptr
	// is not cached.  Returns an error if newParent cannot be found.
	// If newParent is nil, it treats the ptr's corresponding node as
	// being unlinked from the old parent completely.
	Move(ptr BlockPointer, newParent Node, newName string) error
	// Unlink set the corresponding node's parent to nil and caches
	// the provided path in case the node is still open. NodeCache
	// ignores the call when ptr is not cached.  The path is required
	// because the caller may have made changes to the parent nodes
	// already that shouldn't be reflected in the cached path.
	Unlink(ptr BlockPointer, oldPath path)
	// PathFromNode creates the path up to a given Node.
	PathFromNode(node Node) path
}
