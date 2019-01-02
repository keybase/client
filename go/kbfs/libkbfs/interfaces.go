// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"time"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsedits"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
	billy "gopkg.in/src-d/go-billy.v4"
)

type dataVersioner interface {
	// DataVersion returns the data version for this block
	DataVersion() DataVer
}

type logMaker interface {
	MakeLogger(module string) logger.Logger
}

type blockCacher interface {
	BlockCache() BlockCache
}

type keyGetterGetter interface {
	keyGetter() blockKeyGetter
}

type codecGetter interface {
	Codec() kbfscodec.Codec
}

type blockServerGetter interface {
	BlockServer() BlockServer
}

type cryptoPureGetter interface {
	cryptoPure() cryptoPure
}

type cryptoGetter interface {
	Crypto() Crypto
}

type chatGetter interface {
	Chat() Chat
}

type currentSessionGetterGetter interface {
	CurrentSessionGetter() CurrentSessionGetter
}

type signerGetter interface {
	Signer() kbfscrypto.Signer
}

type diskBlockCacheGetter interface {
	DiskBlockCache() DiskBlockCache
}

type diskBlockCacheSetter interface {
	MakeDiskBlockCacheIfNotExists() error
}

type diskBlockCacheFractionSetter interface {
	SetDiskBlockCacheFraction(float64)
}

type syncBlockCacheFractionSetter interface {
	SetSyncBlockCacheFraction(float64)
}

type diskMDCacheGetter interface {
	DiskMDCache() DiskMDCache
}

type diskMDCacheSetter interface {
	MakeDiskMDCacheIfNotExists() error
}

type diskQuotaCacheGetter interface {
	DiskQuotaCache() DiskQuotaCache
}

type diskQuotaCacheSetter interface {
	MakeDiskQuotaCacheIfNotExists() error
}

type blockMetadataStoreGetSeter interface {
	MakeBlockMetadataStoreIfNotExists() error
	XattrStore() XattrStore
	// Other metadata store types goes here.
}

type clockGetter interface {
	Clock() Clock
}

type diskLimiterGetter interface {
	DiskLimiter() DiskLimiter
}

type syncedTlfGetterSetter interface {
	IsSyncedTlf(tlfID tlf.ID) bool
	GetTlfSyncState(tlfID tlf.ID) FolderSyncConfig
	SetTlfSyncState(tlfID tlf.ID, config FolderSyncConfig) (<-chan error, error)
	GetAllSyncedTlfs() []tlf.ID
}

type blockRetrieverGetter interface {
	BlockRetriever() BlockRetriever
}

// Offset is a generic representation of an offset to an indirect
// pointer within an indirect Block.
type Offset interface {
	Equals(other Offset) bool
	Less(other Offset) bool
}

// Block just needs to be (de)serialized using msgpack
type Block interface {
	dataVersioner
	// GetEncodedSize returns the encoded size of this block, but only
	// if it has been previously set; otherwise it returns 0.
	GetEncodedSize() uint32
	// SetEncodedSize sets the encoded size of this block, locally
	// caching it.  The encoded size is not serialized.
	SetEncodedSize(size uint32)
	// NewEmpty returns a new block of the same type as this block
	NewEmpty() Block
	// NewEmptier returns a function that creates a new block of the
	// same type as this block.
	NewEmptier() func() Block
	// Set sets this block to the same value as the passed-in block
	Set(other Block)
	// ToCommonBlock retrieves this block as a *CommonBlock.
	ToCommonBlock() *CommonBlock
	// IsIndirect indicates whether this block contains indirect pointers.
	IsIndirect() bool
	// IsTail returns true if this block doesn't point to any other
	// blocks, either indirectly or in child directory entries.
	IsTail() bool
	// OffsetExceedsData returns true if `off` is greater than the
	// data contained in a direct block, assuming it starts at
	// `startOff`.  Note that the offset of the next block isn't
	// relevant; this function should only indicate whether the offset
	// is greater than what currently could be stored in this block.
	OffsetExceedsData(startOff, off Offset) bool
	// BytesCanBeDirtied returns the number of bytes that should be
	// marked as dirtied if this block is dirtied.
	BytesCanBeDirtied() int64
}

// BlockWithPtrs defines methods needed for interacting with indirect
// pointers.
type BlockWithPtrs interface {
	Block

	// FirstOffset returns the offset of the indirect pointer that
	// points to the first (left-most) block in a block tree.
	FirstOffset() Offset
	// NumIndirectPtrs returns the number of indirect pointers in this
	// block.  The behavior is undefined when called on a non-indirect
	// block.
	NumIndirectPtrs() int
	// IndirectPtr returns the block info and offset for the indirect
	// pointer at index `i`. The behavior is undefined when called on
	// a non-indirect block.
	IndirectPtr(i int) (BlockInfo, Offset)
	// AppendNewIndirectPtr appends a new indirect pointer at the
	// given offset.
	AppendNewIndirectPtr(ptr BlockPointer, off Offset)
	// ClearIndirectPtrSize clears the encoded size of the indirect
	// pointer stored at index `i`.
	ClearIndirectPtrSize(i int)
	// SetIndirectPtrType set the type of the indirect pointer stored
	// at index `i`.
	SetIndirectPtrType(i int, dt BlockDirectType)
	// SetIndirectPtrOff set the offset of the indirect pointer stored
	// at index `i`.
	SetIndirectPtrOff(i int, off Offset)
	// SetIndirectPtrInfo sets the block info of the indirect pointer
	// stored at index `i`.
	SetIndirectPtrInfo(i int, info BlockInfo)
	// SwapIndirectPtrs swaps the indirect ptr at `i` in this block
	// with the one at `otherI` in `other`.
	SwapIndirectPtrs(i int, other BlockWithPtrs, otherI int)
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
	// Readonly returns true if KBFS should outright reject any write
	// attempts on data or directory structures of this node.  Though
	// note that even if it returns false, KBFS can reject writes to
	// the node for other reasons, such as TLF permissions.  An
	// implementation that wraps another `Node` (`inner`) must return
	// `inner.Readonly()` if it decides not to return `true` on its
	// own.
	Readonly(ctx context.Context) bool
	// ShouldCreateMissedLookup is called for Nodes representing
	// directories, whenever `name` is looked up but is not found in
	// the directory.  If the Node decides a new entry should be
	// created matching this lookup, it should return `true` as well
	// as a context to use for the creation, the type of the new entry
	// and the symbolic link contents if the entry is a Sym; the
	// caller should then create this entry.  Otherwise it should
	// return false.  It may return the type `FakeDir` to indicate
	// that the caller should pretend the entry exists, even if it
	// really does not.  An implementation that wraps another `Node`
	// (`inner`) must return `inner.ShouldCreateMissedLookup()` if it
	// decides not to return `true` on its own.
	ShouldCreateMissedLookup(ctx context.Context, name string) (
		shouldCreate bool, newCtx context.Context, et EntryType, sympath string)
	// ShouldRetryOnDirRead is called for Nodes representing
	// directories, whenever a `Lookup` or `GetDirChildren` is done on
	// them.  It should return true to instruct the caller that it
	// should re-sync its view of the directory and retry the
	// operation.
	ShouldRetryOnDirRead(ctx context.Context) bool
	// RemoveDir is called on a `Node` before going through the normal
	// `RemoveDir` flow, to give the Node a chance to handle it in a
	// custom way.  If the `Node` handles it internally, it should
	// return `true`.
	RemoveDir(ctx context.Context, dirName string) (
		removeHandled bool, err error)
	// WrapChild returns a wrapped version of child, if desired, to
	// add custom behavior to the child node. An implementation that
	// wraps another `Node` (`inner`) must first call
	// `inner.WrapChild(child)` before performing its own wrapping
	// operation, to ensure that all wrapping is preserved and that it
	// happens in the correct order.
	WrapChild(child Node) Node
	// Unwrap returns the initial, unwrapped Node that was used to
	// create this Node.
	Unwrap() Node
	// GetFS returns a file system interface that, if non-nil, should
	// be used to satisfy any directory-related calls on this Node,
	// instead of the standard, block-based method of acessing data.
	// The provided context will be used, if possible, for any
	// subsequent calls on the file system.
	GetFS(ctx context.Context) billy.Filesystem
	// GetFile returns a file interface that, if non-nil, should be
	// used to satisfy any file-related calls on this Node, instead of
	// the standard, block-based method of accessing data.  The
	// provided context will be used, if possible, for any subsequent
	// calls on the file.
	GetFile(ctx context.Context) billy.File
	// EntryType is the type of the entry represented by this node.
	EntryType() EntryType
	// GetBlockID returns the block ID of the node.
	GetBlockID() kbfsblock.ID
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
// abort any blocking calls and return ctx.Err(). Any notifications
// resulting from an operation will also include this ctx (or a
// Context derived from it), allowing the caller to determine whether
// the notification is a result of their own action or an external
// action.
type KBFSOps interface {
	// GetFavorites returns the logged-in user's list of favorite
	// top-level folders.  This is a remote-access operation.
	GetFavorites(ctx context.Context) ([]Favorite, error)
	// RefreshCachedFavorites tells the instances to forget any cached
	// favorites list and fetch a new list from the server.  The
	// effects are asychronous; if there's an error refreshing the
	// favorites, the cached favorites will become empty.
	RefreshCachedFavorites(ctx context.Context)
	// ClearCachedFavorites tells the instances to forget any cached
	// favorites list, e.g. when a user logs out.
	ClearCachedFavorites(ctx context.Context)
	// AddFavorite adds the favorite to both the server and
	// the local cache.
	AddFavorite(ctx context.Context, fav Favorite) error
	// DeleteFavorite deletes the favorite from both the server and
	// the local cache.  Idempotent, so it succeeds even if the folder
	// isn't favorited.
	DeleteFavorite(ctx context.Context, fav Favorite) error
	// RefreshEditHistory asks the FBO for the given favorite to reload its
	// edit history.
	RefreshEditHistory(fav Favorite)

	// GetTLFCryptKeys gets crypt key of all generations as well as
	// TLF ID for tlfHandle. The returned keys (the keys slice) are ordered by
	// generation, starting with the key for FirstValidKeyGen.
	GetTLFCryptKeys(ctx context.Context, tlfHandle *TlfHandle) (
		keys []kbfscrypto.TLFCryptKey, id tlf.ID, err error)

	// GetTLFID gets the TLF ID for tlfHandle.
	GetTLFID(ctx context.Context, tlfHandle *TlfHandle) (tlf.ID, error)

	// GetTLFHandle returns the TLF handle for a given node.
	GetTLFHandle(ctx context.Context, node Node) (*TlfHandle, error)

	// GetOrCreateRootNode returns the root node and root entry
	// info associated with the given TLF handle and branch, if
	// the logged-in user has read permissions to the top-level
	// folder. It creates the folder if one doesn't exist yet (and
	// branch == MasterBranch), and the logged-in user has write
	// permissions to the top-level folder.  This is a
	// remote-access operation.
	GetOrCreateRootNode(
		ctx context.Context, h *TlfHandle, branch BranchName) (
		node Node, ei EntryInfo, err error)
	// GetRootNode is like GetOrCreateRootNode but if the root node
	// does not exist it will return a nil Node and not create it.
	GetRootNode(
		ctx context.Context, h *TlfHandle, branch BranchName) (
		node Node, ei EntryInfo, err error)
	// GetDirChildren returns a map of children in the directory,
	// mapped to their EntryInfo, if the logged-in user has read
	// permission for the top-level folder.  This is a remote-access
	// operation.
	GetDirChildren(ctx context.Context, dir Node) (map[string]EntryInfo, error)
	// Lookup returns the Node and entry info associated with a
	// given name in a directory, if the logged-in user has read
	// permissions to the top-level folder.  The returned Node is nil
	// if the name is a symlink.  This is a remote-access operation.
	Lookup(ctx context.Context, dir Node, name string) (Node, EntryInfo, error)
	// Stat returns the entry info associated with a
	// given Node, if the logged-in user has read permissions to the
	// top-level folder.  This is a remote-access operation.
	Stat(ctx context.Context, node Node) (EntryInfo, error)
	// CreateDir creates a new subdirectory under the given node, if
	// the logged-in user has write permission to the top-level
	// folder.  Returns the new Node for the created subdirectory, and
	// its new entry info.  This is a remote-sync operation.
	CreateDir(ctx context.Context, dir Node, name string) (
		Node, EntryInfo, error)
	// CreateFile creates a new file under the given node, if the
	// logged-in user has write permission to the top-level folder.
	// Returns the new Node for the created file, and its new
	// entry info. excl (when implemented) specifies whether this is an exclusive
	// create.  Semantically setting excl to WithExcl is like O_CREAT|O_EXCL in a
	// Unix open() call.
	//
	// This is a remote-sync operation.
	CreateFile(ctx context.Context, dir Node, name string, isExec bool, excl Excl) (
		Node, EntryInfo, error)
	// CreateLink creates a new symlink under the given node, if the
	// logged-in user has write permission to the top-level folder.
	// Returns the new entry info for the created symlink.  This
	// is a remote-sync operation.
	CreateLink(ctx context.Context, dir Node, fromName string, toPath string) (
		EntryInfo, error)
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
	// folders are passed in.  Also returns an error if the new name
	// already has an entry corresponding to an existing directory
	// (only non-dir types may be renamed over).  This is a
	// remote-sync operation.
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
	// SyncAll flushes all outstanding writes and truncates for any
	// dirty files to the KBFS servers within the given folder, if the
	// logged-in user has write permissions to the top-level folder.
	// If done through a file system interface, this may include
	// modifications done via multiple file handles.  This is a
	// remote-sync operation.
	SyncAll(ctx context.Context, folderBranch FolderBranch) error
	// FolderStatus returns the status of a particular folder/branch, along
	// with a channel that will be closed when the status has been
	// updated (to eliminate the need for polling this method).
	FolderStatus(ctx context.Context, folderBranch FolderBranch) (
		FolderBranchStatus, <-chan StatusUpdate, error)
	// Status returns the status of KBFS, along with a channel that will be
	// closed when the status has been updated (to eliminate the need for
	// polling this method). Note that this channel only applies to
	// connection status changes.
	//
	// KBFSStatus can be non-empty even if there is an error.
	Status(ctx context.Context) (
		KBFSStatus, <-chan StatusUpdate, error)
	// UnstageForTesting clears out this device's staged state, if
	// any, and fast-forwards to the current head of this
	// folder-branch.
	UnstageForTesting(ctx context.Context, folderBranch FolderBranch) error
	// RequestRekey requests to rekey this folder. Note that this asynchronously
	// requests a rekey, so canceling ctx doesn't cancel the rekey.
	RequestRekey(ctx context.Context, id tlf.ID)
	// SyncFromServer blocks until the local client has contacted the
	// server and guaranteed that all known updates for the given
	// top-level folder have been applied locally (and notifications
	// sent out to any observers).  It returns an error if this
	// folder-branch is currently unmerged or dirty locally. If
	// lockBeforeGet is non-nil, it blocks on idempotently taking the
	// lock from server at the time it gets any metadata.
	SyncFromServer(ctx context.Context,
		folderBranch FolderBranch, lockBeforeGet *keybase1.LockID) error
	// GetUpdateHistory returns a complete history of all the merged
	// updates of the given folder, in a data structure that's
	// suitable for encoding directly into JSON.  This is an expensive
	// operation, and should only be used for ocassional debugging.
	// Note that the history does not include any unmerged changes or
	// outstanding writes from the local device.
	GetUpdateHistory(ctx context.Context, folderBranch FolderBranch) (
		history TLFUpdateHistory, err error)
	// GetEditHistory returns the edit history of the TLF, clustered
	// by writer.
	GetEditHistory(ctx context.Context, folderBranch FolderBranch) (
		tlfHistory keybase1.FSFolderEditHistory, err error)

	// GetNodeMetadata gets metadata associated with a Node.
	GetNodeMetadata(ctx context.Context, node Node) (NodeMetadata, error)

	// Shutdown is called to clean up any resources associated with
	// this KBFSOps instance.
	Shutdown(ctx context.Context) error
	// PushConnectionStatusChange updates the status of a service for
	// human readable connection status tracking.
	PushConnectionStatusChange(service string, newStatus error)
	// PushStatusChange causes Status listeners to be notified via closing
	// the status channel.
	PushStatusChange()
	// ClearPrivateFolderMD clears any cached private folder metadata,
	// e.g. on a logout.
	ClearPrivateFolderMD(ctx context.Context)
	// ForceFastForward forwards the nodes of all folders that have
	// been previously cleared with `ClearPrivateFolderMD` to their
	// newest version.  It works asynchronously, so no error is
	// returned.
	ForceFastForward(ctx context.Context)
	// InvalidateNodeAndChildren sends invalidation messages for the
	// given node and all of its children that are currently in the
	// NodeCache.  It's useful if the caller has outside knowledge of
	// data changes to that node or its children that didn't come
	// through the usual MD update channels (e.g., autogit nodes need
	// invalidation when the corresponding git repo is updated).
	InvalidateNodeAndChildren(ctx context.Context, node Node) error
	// TeamNameChanged indicates that a team has changed its name, and
	// we should clean up any outstanding handle info associated with
	// the team ID.
	TeamNameChanged(ctx context.Context, tid keybase1.TeamID)
	// TeamAbandoned indicates that a team has been abandoned, and
	// shouldn't be referred to by its previous name anymore.
	TeamAbandoned(ctx context.Context, tid keybase1.TeamID)
	// MigrateToImplicitTeam migrates the given folder from a private-
	// or public-keyed folder, to a team-keyed folder.  If it's
	// already a private/public team-keyed folder, nil is returned.
	MigrateToImplicitTeam(ctx context.Context, id tlf.ID) error
	// KickoffAllOutstandingRekeys kicks off all outstanding rekeys. It does
	// nothing to folders that have not scheduled a rekey. This should be
	// called when we receive an event of "paper key cached" from service.
	KickoffAllOutstandingRekeys() error
	// NewNotificationChannel is called to notify any existing TLF
	// matching `handle` that a new kbfs-edits channel is available.
	NewNotificationChannel(
		ctx context.Context, handle *TlfHandle, convID chat1.ConversationID,
		channelName string)
	// Reset completely resets the given folder.  Should only be
	// called after explicit user confirmation.  After the call,
	// `handle` has the new TLF ID.
	Reset(ctx context.Context, handle *TlfHandle) error

	// GetSyncConfig returns the sync state configuration for the
	// given TLF.
	GetSyncConfig(ctx context.Context, tlfID tlf.ID) (
		keybase1.FolderSyncConfig, error)
	// SetSyncConfig sets the sync state configuration for the given
	// TLF to either fully enabled, fully disabled, or partially
	// syncing selected paths.  If syncing is disabled, it returns a
	// channel that is closed when all of the TLF's blocks have been
	// removed from the sync cache.  For a partially-synced folder,
	// the config must contain no absolute paths, no duplicate paths,
	// and no relative paths that go out of the TLF.
	SetSyncConfig(
		ctx context.Context, tlfID tlf.ID, config keybase1.FolderSyncConfig) (
		<-chan error, error)
}

type merkleRootGetter interface {
	// GetCurrentMerkleRoot returns the current root of the global
	// Keybase Merkle tree.
	GetCurrentMerkleRoot(ctx context.Context) (
		keybase1.MerkleRootV2, time.Time, error)
	// VerifyMerkleRoot checks that the specified merkle root
	// contains the given KBFS root; if not, it returns an error.
	VerifyMerkleRoot(
		ctx context.Context, root keybase1.MerkleRootV2,
		kbfsRoot keybase1.KBFSRoot) error
}

type gitMetadataPutter interface {
	PutGitMetadata(ctx context.Context, folder keybase1.Folder,
		repoID keybase1.RepoID, metadata keybase1.GitLocalMetadata) error
}

// KeybaseService is an interface for communicating with the keybase
// service.
type KeybaseService interface {
	merkleRootGetter
	gitMetadataPutter

	// Resolve, given an assertion, resolves it to a username/UID
	// pair. The username <-> UID mapping is trusted and
	// immutable, so it can be cached. If the assertion is just
	// the username or a UID assertion, then the resolution can
	// also be trusted. If the returned pair is equal to that of
	// the current session, then it can also be
	// trusted. Otherwise, Identify() needs to be called on the
	// assertion before the assertion -> (username, UID) mapping
	// can be trusted.
	Resolve(ctx context.Context, assertion string) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)

	// Identify, given an assertion, returns a UserInfo struct
	// with the user that matches that assertion, or an error
	// otherwise. The reason string is displayed on any tracker
	// popups spawned.
	Identify(ctx context.Context, assertion, reason string) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)

	// NormalizeSocialAssertion creates a SocialAssertion from its input and
	// normalizes it.  The service name will be lowercased.  If the service is
	// case-insensitive, then the username will also be lowercased.  Colon
	// assertions (twitter:user) will be transformed to the user@twitter
	// format.  Only registered services are allowed.
	NormalizeSocialAssertion(
		ctx context.Context, assertion string) (keybase1.SocialAssertion, error)

	// ResolveIdentifyImplicitTeam resolves, and optionally
	// identifies, an implicit team.  If the implicit team doesn't yet
	// exist, and doIdentifies is true, one is created.
	ResolveIdentifyImplicitTeam(
		ctx context.Context, assertions, suffix string, tlfType tlf.Type,
		doIdentifies bool, reason string) (ImplicitTeamInfo, error)

	// ResolveImplicitTeamByID resolves an implicit team to a team
	// name, given a team ID.
	ResolveImplicitTeamByID(
		ctx context.Context, teamID keybase1.TeamID) (string, error)

	// CreateTeamTLF associates the given TLF ID with the team ID in
	// the team's sigchain.  If the team already has a TLF ID
	// associated with it, this overwrites it.
	CreateTeamTLF(
		ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) error

	// GetTeamSettings returns the KBFS settings for the given team.
	GetTeamSettings(ctx context.Context, teamID keybase1.TeamID) (
		keybase1.KBFSTeamSettings, error)

	// LoadUserPlusKeys returns a UserInfo struct for a
	// user with the specified UID.
	// If you have the UID for a user and don't require Identify to
	// validate an assertion or the identity of a user, use this to
	// get UserInfo structs as it is much cheaper than Identify.
	//
	// pollForKID, if non empty, causes `PollForKID` field to be populated, which
	// causes the service to poll for the given KID. This is useful during
	// provisioning where the provisioner needs to get the MD revision that the
	// provisionee has set the rekey bit on.
	LoadUserPlusKeys(ctx context.Context,
		uid keybase1.UID, pollForKID keybase1.KID) (UserInfo, error)

	// LoadTeamPlusKeys returns a TeamInfo struct for a team with the
	// specified TeamID.  The caller can specify `desiredKeyGen` to
	// force a server check if that particular key gen isn't yet
	// known; it may be set to UnspecifiedKeyGen if no server check is
	// required.  The caller can specify `desiredUID` and
	// `desiredRole` to force a server check if that particular UID
	// isn't a member of the team yet according to local caches; it
	// may be set to "" if no server check is required.
	LoadTeamPlusKeys(ctx context.Context, tid keybase1.TeamID,
		tlfType tlf.Type, desiredKeyGen kbfsmd.KeyGen,
		desiredUser keybase1.UserVersion, desiredKey kbfscrypto.VerifyingKey,
		desiredRole keybase1.TeamRole) (TeamInfo, error)

	// CurrentSession returns a SessionInfo struct with all the
	// information for the current session, or an error otherwise.
	CurrentSession(ctx context.Context, sessionID int) (SessionInfo, error)

	// FavoriteAdd adds the given folder to the list of favorites.
	FavoriteAdd(ctx context.Context, folder keybase1.Folder) error

	// FavoriteAdd removes the given folder from the list of
	// favorites.
	FavoriteDelete(ctx context.Context, folder keybase1.Folder) error

	// FavoriteList returns the current list of favorites.
	FavoriteList(ctx context.Context, sessionID int) ([]keybase1.Folder, error)

	// EncryptFavorites encrypts cached favorites to store on disk.
	EncryptFavorites(ctx context.Context, dataToEncrypt []byte) ([]byte, error)

	// DecryptFavorites decrypts cached favorites stored on disk.
	DecryptFavorites(ctx context.Context, dataToDecrypt []byte) ([]byte, error)

	// Notify sends a filesystem notification.
	Notify(ctx context.Context, notification *keybase1.FSNotification) error

	// NotifyPathUpdated sends a path updated notification.
	NotifyPathUpdated(ctx context.Context, path string) error

	// NotifySyncStatus sends a sync status notification.
	NotifySyncStatus(ctx context.Context,
		status *keybase1.FSPathSyncStatus) error

	// FlushUserFromLocalCache instructs this layer to clear any
	// KBFS-side, locally-cached information about the given user.
	// This does NOT involve communication with the daemon, this is
	// just to force future calls loading this user to fall through to
	// the daemon itself, rather than being served from the cache.
	FlushUserFromLocalCache(ctx context.Context, uid keybase1.UID)

	// TODO: Add CryptoClient methods, too.

	// EstablishMountDir asks the service for the current mount path
	// and sets it if not established.
	EstablishMountDir(ctx context.Context) (string, error)

	// Shutdown frees any resources associated with this
	// instance. No other methods may be called after this is
	// called.
	Shutdown()
}

// KeybaseServiceCn defines methods needed to construct KeybaseService
// and Crypto implementations.
type KeybaseServiceCn interface {
	NewKeybaseService(
		config Config, params InitParams, ctx Context, log logger.Logger) (
		KeybaseService, error)
	NewCrypto(
		config Config, params InitParams, ctx Context, log logger.Logger) (
		Crypto, error)
	NewChat(
		config Config, params InitParams, ctx Context, log logger.Logger) (
		Chat, error)
}

type resolver interface {
	// Resolve, given an assertion, resolves it to a username/UID
	// pair. The username <-> UID mapping is trusted and
	// immutable, so it can be cached. If the assertion is just
	// the username or a UID assertion, then the resolution can
	// also be trusted. If the returned pair is equal to that of
	// the current session, then it can also be
	// trusted. Otherwise, Identify() needs to be called on the
	// assertion before the assertion -> (username, UserOrTeamID) mapping
	// can be trusted.
	//
	// TODO: some of the above assumptions on cacheability aren't
	// right for subteams, which can change their name, so this may
	// need updating.
	Resolve(ctx context.Context, assertion string) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)
	// ResolveImplicitTeam resolves the given implicit team.
	ResolveImplicitTeam(
		ctx context.Context, assertions, suffix string, tlfType tlf.Type) (
		ImplicitTeamInfo, error)
	// ResolveImplicitTeamByID resolves the given implicit team, given
	// a team ID.
	ResolveImplicitTeamByID(
		ctx context.Context, teamID keybase1.TeamID, tlfType tlf.Type) (
		ImplicitTeamInfo, error)
	// ResolveTeamTLFID returns the TLF ID associated with a given
	// team ID, or tlf.NullID if no ID is yet associated with that
	// team.
	ResolveTeamTLFID(ctx context.Context, teamID keybase1.TeamID) (
		tlf.ID, error)
	// NormalizeSocialAssertion creates a SocialAssertion from its input and
	// normalizes it.  The service name will be lowercased.  If the service is
	// case-insensitive, then the username will also be lowercased.  Colon
	// assertions (twitter:user) will be transformed to the user@twitter
	// format.  Only registered services are allowed.
	NormalizeSocialAssertion(
		ctx context.Context, assertion string) (keybase1.SocialAssertion, error)
}

type identifier interface {
	// Identify resolves an assertion (which could also be a
	// username) to a UserInfo struct, spawning tracker popups if
	// necessary.  The reason string is displayed on any tracker
	// popups spawned.
	Identify(ctx context.Context, assertion, reason string) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)
	// IdentifyImplicitTeam identifies (and creates if necessary) the
	// given implicit team.
	IdentifyImplicitTeam(
		ctx context.Context, assertions, suffix string, tlfType tlf.Type,
		reason string) (ImplicitTeamInfo, error)
}

type normalizedUsernameGetter interface {
	// GetNormalizedUsername returns the normalized username
	// corresponding to the given UID.
	GetNormalizedUsername(ctx context.Context, id keybase1.UserOrTeamID) (
		kbname.NormalizedUsername, error)
}

// CurrentSessionGetter is an interface for objects that can return
// session info.
type CurrentSessionGetter interface {
	// GetCurrentSession gets the current session info.
	GetCurrentSession(ctx context.Context) (SessionInfo, error)
}

// teamMembershipChecker is a copy of kbfsmd.TeamMembershipChecker for
// embedding in KBPKI. Unfortunately, this is necessary since mockgen
// can't handle embedded interfaces living in other packages.
type teamMembershipChecker interface {
	// IsTeamWriter is a copy of
	// kbfsmd.TeamMembershipChecker.IsTeamWriter.
	IsTeamWriter(ctx context.Context, tid keybase1.TeamID, uid keybase1.UID,
		verifyingKey kbfscrypto.VerifyingKey) (bool, error)
	// NoLongerTeamWriter returns the global Merkle root of the
	// most-recent time the given user (with the given device key,
	// which implies an eldest seqno) transitioned from being a writer
	// to not being a writer on the given team.  If the user was never
	// a writer of the team, it returns an error.
	NoLongerTeamWriter(
		ctx context.Context, tid keybase1.TeamID, tlfType tlf.Type,
		uid keybase1.UID, verifyingKey kbfscrypto.VerifyingKey) (
		keybase1.MerkleRootV2, error)
	// IsTeamReader is a copy of
	// kbfsmd.TeamMembershipChecker.IsTeamWriter.
	IsTeamReader(ctx context.Context, tid keybase1.TeamID, uid keybase1.UID) (
		bool, error)
}

type teamKeysGetter interface {
	// GetTeamTLFCryptKeys gets all of a team's secret crypt keys, by
	// generation, as well as the latest key generation number for the
	// team.  The caller can specify `desiredKeyGen` to force a server
	// check if that particular key gen isn't yet known; it may be set
	// to UnspecifiedKeyGen if no server check is required.
	GetTeamTLFCryptKeys(ctx context.Context, tid keybase1.TeamID,
		desiredKeyGen kbfsmd.KeyGen) (
		map[kbfsmd.KeyGen]kbfscrypto.TLFCryptKey, kbfsmd.KeyGen, error)
}

type teamRootIDGetter interface {
	// GetTeamRootID returns the root team ID for the given (sub)team
	// ID.
	GetTeamRootID(ctx context.Context, tid keybase1.TeamID) (
		keybase1.TeamID, error)
}

// KBPKI interacts with the Keybase daemon to fetch user info.
type KBPKI interface {
	CurrentSessionGetter
	resolver
	identifier
	normalizedUsernameGetter
	merkleRootGetter
	teamMembershipChecker
	teamKeysGetter
	teamRootIDGetter
	gitMetadataPutter

	// HasVerifyingKey returns nil if the given user has the given
	// VerifyingKey, and an error otherwise.  If the revoked key was
	// valid according to the untrusted server timestamps, a special
	// error type `RevokedDeviceVerificationError` is returned, which
	// includes information the caller can use to verify the key using
	// the merkle tree.
	HasVerifyingKey(ctx context.Context, uid keybase1.UID,
		verifyingKey kbfscrypto.VerifyingKey,
		atServerTime time.Time) error

	// GetCryptPublicKeys gets all of a user's crypt public keys (including
	// paper keys).
	GetCryptPublicKeys(ctx context.Context, uid keybase1.UID) (
		[]kbfscrypto.CryptPublicKey, error)

	// TODO: Split the methods below off into a separate
	// FavoriteOps interface.

	// FavoriteAdd adds folder to the list of the logged in user's
	// favorite folders.  It is idempotent.
	FavoriteAdd(ctx context.Context, folder keybase1.Folder) error

	// FavoriteDelete deletes folder from the list of the logged in user's
	// favorite folders.  It is idempotent.
	FavoriteDelete(ctx context.Context, folder keybase1.Folder) error

	// FavoriteList returns the list of all favorite folders for
	// the logged in user.
	FavoriteList(ctx context.Context) ([]keybase1.Folder, error)

	// CreateTeamTLF associates the given TLF ID with the team ID in
	// the team's sigchain.  If the team already has a TLF ID
	// associated with it, this overwrites it.
	CreateTeamTLF(
		ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) error

	// Notify sends a filesystem notification.
	Notify(ctx context.Context, notification *keybase1.FSNotification) error

	// NotifyPathUpdated sends a path updated notification.
	NotifyPathUpdated(ctx context.Context, path string) error
}

// KeyMetadata is an interface for something that holds key
// information. This is usually implemented by RootMetadata.
type KeyMetadata interface {
	// TlfID returns the ID of the TLF for which this object holds
	// key info.
	TlfID() tlf.ID

	// TypeForKeying returns the keying type for this MD.
	TypeForKeying() tlf.KeyingType

	// LatestKeyGeneration returns the most recent key generation
	// with key data in this object, or PublicKeyGen if this TLF
	// is public.
	LatestKeyGeneration() kbfsmd.KeyGen

	// GetTlfHandle returns the handle for the TLF. It must not
	// return nil.
	//
	// TODO: Remove the need for this function in this interface,
	// so that kbfsmd.RootMetadata can implement this interface
	// fully.
	GetTlfHandle() *TlfHandle

	// IsWriter checks that the given user is a valid writer of the TLF
	// right now.
	IsWriter(
		ctx context.Context, checker kbfsmd.TeamMembershipChecker,
		uid keybase1.UID, verifyingKey kbfscrypto.VerifyingKey) (
		bool, error)

	// HasKeyForUser returns whether or not the given user has
	// keys for at least one device. Returns an error if the TLF
	// is public.
	HasKeyForUser(user keybase1.UID) (bool, error)

	// GetTLFCryptKeyParams returns all the necessary info to
	// construct the TLF crypt key for the given key generation,
	// user, and device (identified by its crypt public key), or
	// false if not found. This returns an error if the TLF is
	// public.
	GetTLFCryptKeyParams(
		keyGen kbfsmd.KeyGen, user keybase1.UID,
		key kbfscrypto.CryptPublicKey) (
		kbfscrypto.TLFEphemeralPublicKey,
		kbfscrypto.EncryptedTLFCryptKeyClientHalf,
		kbfscrypto.TLFCryptKeyServerHalfID, bool, error)

	// StoresHistoricTLFCryptKeys returns whether or not history keys are
	// symmetrically encrypted; if not, they're encrypted per-device.
	StoresHistoricTLFCryptKeys() bool

	// GetHistoricTLFCryptKey attempts to symmetrically decrypt the key at the given
	// generation using the current generation's TLFCryptKey.
	GetHistoricTLFCryptKey(codec kbfscodec.Codec, keyGen kbfsmd.KeyGen,
		currentKey kbfscrypto.TLFCryptKey) (
		kbfscrypto.TLFCryptKey, error)
}

// KeyMetadataWithRootDirEntry is like KeyMetadata, but can also
// return the root dir entry for the associated MD update.
type KeyMetadataWithRootDirEntry interface {
	KeyMetadata

	// GetRootDirEntry returns the root directory entry for the
	// associated MD.
	GetRootDirEntry() DirEntry
}

type encryptionKeyGetter interface {
	// GetTLFCryptKeyForEncryption gets the crypt key to use for
	// encryption (i.e., with the latest key generation) for the
	// TLF with the given metadata.
	GetTLFCryptKeyForEncryption(ctx context.Context, kmd KeyMetadata) (
		kbfscrypto.TLFCryptKey, error)
}

type mdDecryptionKeyGetter interface {
	// GetTLFCryptKeyForMDDecryption gets the crypt key to use for the
	// TLF with the given metadata to decrypt the private portion of
	// the metadata.  It finds the appropriate key from mdWithKeys
	// (which in most cases is the same as mdToDecrypt) if it's not
	// already cached.
	GetTLFCryptKeyForMDDecryption(ctx context.Context,
		kmdToDecrypt, kmdWithKeys KeyMetadata) (
		kbfscrypto.TLFCryptKey, error)
}

type blockDecryptionKeyGetter interface {
	// GetTLFCryptKeyForBlockDecryption gets the crypt key to use
	// for the TLF with the given metadata to decrypt the block
	// pointed to by the given pointer.
	GetTLFCryptKeyForBlockDecryption(ctx context.Context, kmd KeyMetadata,
		blockPtr BlockPointer) (kbfscrypto.TLFCryptKey, error)
}

type blockKeyGetter interface {
	encryptionKeyGetter
	blockDecryptionKeyGetter
}

// KeyManager fetches and constructs the keys needed for KBFS file
// operations.
type KeyManager interface {
	blockKeyGetter
	mdDecryptionKeyGetter

	// GetTLFCryptKeyOfAllGenerations gets the crypt keys of all generations
	// for current devices. keys contains crypt keys from all generations, in
	// order, starting from FirstValidKeyGen.
	GetTLFCryptKeyOfAllGenerations(ctx context.Context, kmd KeyMetadata) (
		keys []kbfscrypto.TLFCryptKey, err error)

	// Rekey checks the given MD object, if it is a private TLF,
	// against the current set of device keys for all valid
	// readers and writers.  If there are any new devices, it
	// updates all existing key generations to include the new
	// devices.  If there are devices that have been removed, it
	// creates a new epoch of keys for the TLF.  If there was an
	// error, or the RootMetadata wasn't changed, it returns false.
	// Otherwise, it returns true. If a new key generation is
	// added the second return value points to this new key. This
	// is to allow for caching of the TLF crypt key only after a
	// successful merged write of the metadata. Otherwise we could
	// prematurely pollute the key cache.
	//
	// If the given MD object is a public TLF, it simply updates
	// the TLF's handle with any newly-resolved writers.
	//
	// If promptPaper is set, prompts for any unlocked paper keys.
	// promptPaper shouldn't be set if md is for a public TLF.
	Rekey(ctx context.Context, md *RootMetadata, promptPaper bool) (
		bool, *kbfscrypto.TLFCryptKey, error)
}

// Reporter exports events (asynchronously) to any number of sinks
type Reporter interface {
	// ReportErr records that a given error happened.
	ReportErr(ctx context.Context, tlfName tlf.CanonicalName, t tlf.Type,
		mode ErrorModeType, err error)
	// AllKnownErrors returns all errors known to this Reporter.
	AllKnownErrors() []ReportedError
	// Notify sends the given notification to any sink.
	Notify(ctx context.Context, notification *keybase1.FSNotification)
	// NotifyPathUpdated sends the given notification to any sink.
	NotifyPathUpdated(ctx context.Context, path string)
	// NotifySyncStatus sends the given path sync status to any sink.
	NotifySyncStatus(ctx context.Context, status *keybase1.FSPathSyncStatus)
	// Shutdown frees any resources allocated by a Reporter.
	Shutdown()
}

// MDCache gets and puts plaintext top-level metadata into the cache.
type MDCache interface {
	// Get gets the metadata object associated with the given TLF ID,
	// revision number, and branch ID (kbfsmd.NullBranchID for merged MD).
	Get(tlf tlf.ID, rev kbfsmd.Revision, bid kbfsmd.BranchID) (ImmutableRootMetadata, error)
	// Put stores the metadata object, only if an MD matching that TLF
	// ID, revision number, and branch ID isn't already cached.  If
	// there is already a matching item in the cache, we require that
	// caller manages the cache explicitly by deleting or replacing it
	// explicitly.  This should be used when putting existing MDs
	// being fetched from the server.
	Put(md ImmutableRootMetadata) error
	// Delete removes the given metadata object from the cache if it exists.
	Delete(tlf tlf.ID, rev kbfsmd.Revision, bid kbfsmd.BranchID)
	// Replace replaces the entry matching the md under the old branch
	// ID with the new one.  If the old entry doesn't exist, this is
	// equivalent to a Put, except that it overrides anything else
	// that's already in the cache.  This should be used when putting
	// new MDs created locally.
	Replace(newRmd ImmutableRootMetadata, oldBID kbfsmd.BranchID) error
	// MarkPutToServer sets `PutToServer` to true for the specified
	// MD, if it already exists in the cache.
	MarkPutToServer(tlf tlf.ID, rev kbfsmd.Revision, bid kbfsmd.BranchID)
	// GetIDForHandle retrieves a cached, trusted TLF ID for the given
	// handle, if one exists.
	GetIDForHandle(handle *TlfHandle) (tlf.ID, error)
	// PutIDForHandle caches a trusted TLF ID for the given handle.
	PutIDForHandle(handle *TlfHandle, id tlf.ID) error
	// ChangeHandleForID moves an ID to be under a new handle, if the
	// ID is cached already.
	ChangeHandleForID(oldHandle *TlfHandle, newHandle *TlfHandle)
	// GetNextMD returns a cached view of the next MD following the
	// given global Merkle root.
	GetNextMD(tlfID tlf.ID, rootSeqno keybase1.Seqno) (
		nextKbfsRoot *kbfsmd.MerkleRoot, nextMerkleNodes [][]byte,
		nextRootSeqno keybase1.Seqno, err error)
	// PutNextMD caches a view of the next MD following the given
	// global Merkle root.
	PutNextMD(tlfID tlf.ID, rootSeqno keybase1.Seqno,
		nextKbfsRoot *kbfsmd.MerkleRoot, nextMerkleNodes [][]byte,
		nextRootSeqno keybase1.Seqno) error
}

// KeyCache handles caching for both TLFCryptKeys and BlockCryptKeys.
type KeyCache interface {
	// GetTLFCryptKey gets the crypt key for the given TLF.
	GetTLFCryptKey(tlf.ID, kbfsmd.KeyGen) (kbfscrypto.TLFCryptKey, error)
	// PutTLFCryptKey stores the crypt key for the given TLF.
	PutTLFCryptKey(tlf.ID, kbfsmd.KeyGen, kbfscrypto.TLFCryptKey) error
}

// BlockCacheLifetime denotes the lifetime of an entry in BlockCache.
type BlockCacheLifetime int

func (l BlockCacheLifetime) String() string {
	switch l {
	case NoCacheEntry:
		return "NoCacheEntry"
	case TransientEntry:
		return "TransientEntry"
	case PermanentEntry:
		return "PermanentEntry"
	}
	return "Unknown"
}

const (
	// NoCacheEntry means that the entry will not be cached.
	NoCacheEntry BlockCacheLifetime = iota
	// TransientEntry means that the cache entry may be evicted at
	// any time.
	TransientEntry
	// PermanentEntry means that the cache entry must remain until
	// explicitly removed from the cache.
	PermanentEntry
)

// BlockCacheSimple gets and puts plaintext dir blocks and file blocks into
// a cache.  These blocks are immutable and identified by their
// content hash.
type BlockCacheSimple interface {
	// Get gets the block associated with the given block ID.
	Get(ptr BlockPointer) (Block, error)
	// Put stores the final (content-addressable) block associated
	// with the given block ID. If lifetime is TransientEntry,
	// then it is assumed that the block exists on the server and
	// the entry may be evicted from the cache at any time. If
	// lifetime is PermanentEntry, then it is assumed that the
	// block doesn't exist on the server and must remain in the
	// cache until explicitly removed. As an intermediary state,
	// as when a block is being sent to the server, the block may
	// be put into the cache both with TransientEntry and
	// PermanentEntry -- these are two separate entries. This is
	// fine, since the block should be the same.
	Put(ptr BlockPointer, tlf tlf.ID, block Block,
		lifetime BlockCacheLifetime) error
}

// BlockCache specifies the interface of BlockCacheSimple, and also more
// advanced and internal methods.
type BlockCache interface {
	BlockCacheSimple
	// CheckForKnownPtr sees whether this cache has a transient
	// entry for the given file block, which must be a direct file
	// block containing data).  Returns the full BlockPointer
	// associated with that ID, including key and data versions.
	// If no ID is known, return an uninitialized BlockPointer and
	// a nil error.
	CheckForKnownPtr(tlf tlf.ID, block *FileBlock) (BlockPointer, error)
	// DeleteTransient removes the transient entry for the given
	// ID from the cache, as well as any cached IDs so the block
	// won't be reused.
	DeleteTransient(id kbfsblock.ID, tlf tlf.ID) error
	// Delete removes the permanent entry for the non-dirty block
	// associated with the given block ID from the cache.  No
	// error is returned if no block exists for the given ID.
	DeletePermanent(id kbfsblock.ID) error
	// DeleteKnownPtr removes the cached ID for the given file
	// block. It does not remove the block itself.
	DeleteKnownPtr(tlf tlf.ID, block *FileBlock) error
	// GetWithLifetime retrieves a block from the cache, along with
	// the block's lifetime.
	GetWithLifetime(ptr BlockPointer) (
		block Block, lifetime BlockCacheLifetime, err error)

	// SetCleanBytesCapacity atomically sets clean bytes capacity for block
	// cache.
	SetCleanBytesCapacity(capacity uint64)

	// GetCleanBytesCapacity atomically gets clean bytes capacity for block
	// cache.
	GetCleanBytesCapacity() (capacity uint64)
}

// DirtyPermChan is a channel that gets closed when the holder has
// permission to write.  We are forced to define it as a type due to a
// bug in mockgen that can't handle return values with a chan
// struct{}.
type DirtyPermChan <-chan struct{}

// DirtyBlockCacheSimple is a bare-bones interface for a dirty block
// cache.
type DirtyBlockCacheSimple interface {
	// Get gets the block associated with the given block ID.  Returns
	// the dirty block for the given ID, if one exists.
	Get(
		ctx context.Context, tlfID tlf.ID, ptr BlockPointer,
		branch BranchName) (Block, error)
	// Put stores a dirty block currently identified by the
	// given block pointer and branch name.
	Put(
		ctx context.Context, tlfID tlf.ID, ptr BlockPointer, branch BranchName,
		block Block) error
}

type isDirtyProvider interface {
	// IsDirty states whether or not the block associated with the
	// given block pointer and branch name is dirty in this cache.
	IsDirty(tlfID tlf.ID, ptr BlockPointer, branch BranchName) bool
}

// DirtyBlockCache gets and puts plaintext dir blocks and file blocks
// into a cache, which have been modified by the application and not
// yet committed on the KBFS servers.  They are identified by a
// (potentially random) ID that may not have any relationship with
// their context, along with a Branch in case the same TLF is being
// modified via multiple branches.  Dirty blocks are never evicted,
// they must be deleted explicitly.
type DirtyBlockCache interface {
	isDirtyProvider
	DirtyBlockCacheSimple

	// Delete removes the dirty block associated with the given block
	// pointer and branch from the cache.  No error is returned if no
	// block exists for the given ID.
	Delete(tlfID tlf.ID, ptr BlockPointer, branch BranchName) error
	// IsAnyDirty returns whether there are any dirty blocks in the
	// cache. tlfID may be ignored.
	IsAnyDirty(tlfID tlf.ID) bool
	// RequestPermissionToDirty is called whenever a user wants to
	// write data to a file.  The caller provides an estimated number
	// of bytes that will become dirty -- this is difficult to know
	// exactly without pre-fetching all the blocks involved, but in
	// practice we can just use the number of bytes sent in via the
	// Write. It returns a channel that blocks until the cache is
	// ready to receive more dirty data, at which point the channel is
	// closed.  The user must call
	// `UpdateUnsyncedBytes(-estimatedDirtyBytes)` once it has
	// completed its write and called `UpdateUnsyncedBytes` for all
	// the exact dirty block sizes.
	RequestPermissionToDirty(ctx context.Context, tlfID tlf.ID,
		estimatedDirtyBytes int64) (DirtyPermChan, error)
	// UpdateUnsyncedBytes is called by a user, who has already been
	// granted permission to write, with the delta in block sizes that
	// were dirtied as part of the write.  So for example, if a
	// newly-dirtied block of 20 bytes was extended by 5 bytes, they
	// should send 25.  If on the next write (before any syncs), bytes
	// 10-15 of that same block were overwritten, they should send 0
	// over the channel because there were no new bytes.  If an
	// already-dirtied block is truncated, or if previously requested
	// bytes have now been updated more accurately in previous
	// requests, newUnsyncedBytes may be negative.  wasSyncing should
	// be true if `BlockSyncStarted` has already been called for this
	// block.
	UpdateUnsyncedBytes(tlfID tlf.ID, newUnsyncedBytes int64, wasSyncing bool)
	// UpdateSyncingBytes is called when a particular block has
	// started syncing, or with a negative number when a block is no
	// longer syncing due to an error (and BlockSyncFinished will
	// never be called).
	UpdateSyncingBytes(tlfID tlf.ID, size int64)
	// BlockSyncFinished is called when a particular block has
	// finished syncing, though the overall sync might not yet be
	// complete.  This lets the cache know it might be able to grant
	// more permission to writers.
	BlockSyncFinished(tlfID tlf.ID, size int64)
	// SyncFinished is called when a complete sync has completed and
	// its dirty blocks have been removed from the cache.  This lets
	// the cache know it might be able to grant more permission to
	// writers.
	SyncFinished(tlfID tlf.ID, size int64)
	// ShouldForceSync returns true if the sync buffer is full enough
	// to force all callers to sync their data immediately.
	ShouldForceSync(tlfID tlf.ID) bool

	// Shutdown frees any resources associated with this instance.  It
	// returns an error if there are any unsynced blocks.
	Shutdown() error
}

// DiskBlockCacheType specifies a type of an on-disk block cache.
type DiskBlockCacheType int

const (
	// DiskBlockAnyCache indicates that any disk block cache is fine.
	DiskBlockAnyCache DiskBlockCacheType = iota
	// DiskBlockWorkingSetCache indicates that the working set cache
	// should be used.
	DiskBlockWorkingSetCache
	// DiskBlockSyncCache indicates that the sync cache should be
	// used.
	DiskBlockSyncCache
)

func (dbct DiskBlockCacheType) String() string {
	switch dbct {
	case DiskBlockSyncCache:
		return "DiskBlockSyncCache"
	case DiskBlockWorkingSetCache:
		return "DiskBlockWorkingSetCache"
	case DiskBlockAnyCache:
		return "DiskBlockAnyCache"
	default:
		return "unknown DiskBlockCacheType"
	}
}

// DiskBlockCache caches blocks to the disk.
type DiskBlockCache interface {
	// Get gets a block from the disk cache.  If a specific preferred
	// cache type is given, the block and its metadata are moved to
	// that cache if they're not yet in it.
	Get(ctx context.Context, tlfID tlf.ID, blockID kbfsblock.ID,
		preferredCacheType DiskBlockCacheType) (
		buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf,
		prefetchStatus PrefetchStatus, err error)
	// Put puts a block to the disk cache. Returns after it has
	// updated the metadata but before it has finished writing the
	// block.  If cacheType is specified, the block is put into that
	// cache; by default, block are put into the working set cache.
	Put(ctx context.Context, tlfID tlf.ID, blockID kbfsblock.ID, buf []byte,
		serverHalf kbfscrypto.BlockCryptKeyServerHalf,
		cacheType DiskBlockCacheType) error
	// Delete deletes some blocks from the disk cache.
	Delete(ctx context.Context, blockIDs []kbfsblock.ID) (numRemoved int,
		sizeRemoved int64, err error)
	// UpdateMetadata updates metadata for a given block in the disk cache.
	UpdateMetadata(ctx context.Context, blockID kbfsblock.ID,
		prefetchStatus PrefetchStatus) error
	// ClearAllTlfBlocks deletes all the synced blocks corresponding
	// to the given TLF ID from the cache.  It doesn't affect
	// transient blocks for unsynced TLFs.
	ClearAllTlfBlocks(
		ctx context.Context, tlfID tlf.ID, cacheType DiskBlockCacheType) error
	// GetLastUnrefRev returns the last revision that has been marked
	// unref'd for the given TLF.
	GetLastUnrefRev(
		ctx context.Context, tlfID tlf.ID, cacheType DiskBlockCacheType) (
		kbfsmd.Revision, error)
	// PutLastUnrefRev saves the given revision as the last unref'd
	// revision for the given TLF.
	PutLastUnrefRev(
		ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision,
		cacheType DiskBlockCacheType) error
	// Status returns the current status of the disk cache.
	Status(ctx context.Context) map[string]DiskBlockCacheStatus
	// DoesCacheHaveSpace returns whether the given cache has
	// space.
	DoesCacheHaveSpace(
		ctx context.Context, cacheType DiskBlockCacheType) (bool, error)
	// Mark tags a given block in the disk cache with the given tag.
	Mark(
		ctx context.Context, blockID kbfsblock.ID, tag string,
		cacheType DiskBlockCacheType) error
	// DeleteUnmarked deletes all the given TLF's blocks in the disk
	// cache without the given tag.
	DeleteUnmarked(
		ctx context.Context, tlfID tlf.ID, tag string,
		cacheType DiskBlockCacheType) error
	// Shutdown cleanly shuts down the disk block cache.
	Shutdown(ctx context.Context)
}

// DiskMDCache caches encrypted MD objects to the disk.
type DiskMDCache interface {
	// Get gets the latest cached MD for the given TLF from the disk
	// cache. `ver` is the version of the encoded MD, and `timestamp`
	// is the server timestamp for the MD.
	Get(ctx context.Context, tlfID tlf.ID) (
		buf []byte, ver kbfsmd.MetadataVer, timestamp time.Time, err error)
	// Stage asks the disk cache to store the given MD in memory, but
	// not yet write it to disk.  A later call to `Commit` or
	// `Unstage` for `rev` or higher is required to avoid memory leaks.
	Stage(ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision, buf []byte,
		ver kbfsmd.MetadataVer, timestamp time.Time) error
	// Commit writes a previously-staged MD to disk.  Trying to commit
	// a revision that hasn't been staged is a no-op, to allow callers
	// to call Commit without knowing whether Stage was called first
	// (e.g., if the revision came from the cache in the first place).
	// If older revisions (or other copies of this same revision) are
	// staged, they will become unstaged.
	Commit(ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error
	// Unstage unstages and forgets about a previously-staged MD.  (If
	// multiple copies of the same revision have been staged, it only
	// unstages the first of them.)
	Unstage(ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error
	// Status returns the current status of the disk cache.
	Status(ctx context.Context) DiskMDCacheStatus
	// Shutdown cleanly shuts down the disk MD cache.
	Shutdown(ctx context.Context)
}

// DiskQuotaCache caches encrypts per-ID quotas to the disk.
type DiskQuotaCache interface {
	// Get gets the latest cached quota for the given ID from the disk
	// cache.
	Get(ctx context.Context, id keybase1.UserOrTeamID) (
		info kbfsblock.QuotaInfo, err error)
	// Put stores the latest cached quota for the given ID to the disk
	// cache.
	Put(ctx context.Context, id keybase1.UserOrTeamID,
		info kbfsblock.QuotaInfo) (err error)
	// Status returns the current status of the disk cache.
	Status(ctx context.Context) DiskQuotaCacheStatus
	// Shutdown cleanly shuts down the disk quota cache.
	Shutdown(ctx context.Context)
}

// BlockMetadataStore defines a type that stores block metadata locally on
// device.
type BlockMetadataStore interface {
	// GetMetadata looks for and returns the block metadata for blockID if it's
	// found, and an error whose Cause is ldberrors.ErrNotFound if it's not
	// found.
	GetMetadata(ctx context.Context, blockID kbfsblock.ID) (BlockMetadataValue, error)
	// UpdateMetadata updates the block metadata for blockID using updater.
	// Specifically, it looks for existing block metdata for blockID. If it's
	// found, it's passed into updater. Otherwise, a zero value of
	// BlockMetadataValue is passed into the updater. After if updater returns
	// nil, the updated metadata is stored.
	UpdateMetadata(ctx context.Context, blockID kbfsblock.ID, updater BlockMetadataUpdater) error
	// Shutdown cleanly shuts down the disk block metadata cache.
	Shutdown()
}

// XattrStore defines a type that handles locally stored xattr
// values by interacting with a BlockMetadataStore.
type XattrStore interface {
	// GetXattr looks for and returns the Xattr value of xattrType for blockID
	// if it's found, and an error whose Cause is ldberrors.ErrNotFound if it's
	// not found.
	GetXattr(ctx context.Context,
		blockID kbfsblock.ID, xattrType XattrType) ([]byte, error)
	// SetXattr sets xattrType Xattr to xattrValue for blockID.
	SetXattr(ctx context.Context,
		blockID kbfsblock.ID, xattrType XattrType, xattrValue []byte) error
}

// cryptoPure contains all methods of Crypto that don't depend on
// implicit state, i.e. they're pure functions of the input.
type cryptoPure interface {
	// MakeRandomTlfID generates a dir ID using a CSPRNG.
	MakeRandomTlfID(t tlf.Type) (tlf.ID, error)

	// MakeRandomBranchID generates a per-device branch ID using a
	// CSPRNG.  It will not return LocalSquashBranchID or
	// kbfsmd.NullBranchID.
	MakeRandomBranchID() (kbfsmd.BranchID, error)

	// MakeTemporaryBlockID generates a temporary block ID using a
	// CSPRNG. This is used for indirect blocks before they're
	// committed to the server.
	MakeTemporaryBlockID() (kbfsblock.ID, error)

	// MakeRefNonce generates a block reference nonce using a
	// CSPRNG. This is used for distinguishing different references to
	// the same BlockID.
	MakeBlockRefNonce() (kbfsblock.RefNonce, error)

	// MakeRandomTLFEphemeralKeys generates ephemeral keys using a
	// CSPRNG for a TLF. These keys can then be used to key/rekey
	// the TLF.
	MakeRandomTLFEphemeralKeys() (kbfscrypto.TLFEphemeralPublicKey,
		kbfscrypto.TLFEphemeralPrivateKey, error)

	// MakeRandomTLFKeys generates keys using a CSPRNG for a
	// single key generation of a TLF.
	MakeRandomTLFKeys() (kbfscrypto.TLFPublicKey,
		kbfscrypto.TLFPrivateKey, kbfscrypto.TLFCryptKey, error)

	// MakeRandomBlockCryptKeyServerHalf generates the server-side of
	// a block crypt key.
	MakeRandomBlockCryptKeyServerHalf() (
		kbfscrypto.BlockCryptKeyServerHalf, error)

	// EncryptPrivateMetadata encrypts a PrivateMetadata object.
	EncryptPrivateMetadata(
		pmd PrivateMetadata, key kbfscrypto.TLFCryptKey) (
		kbfscrypto.EncryptedPrivateMetadata, error)
	// DecryptPrivateMetadata decrypts a PrivateMetadata object.
	DecryptPrivateMetadata(
		encryptedPMD kbfscrypto.EncryptedPrivateMetadata,
		key kbfscrypto.TLFCryptKey) (PrivateMetadata, error)

	// EncryptBlocks encrypts a block. plainSize is the size of the encoded
	// block; EncryptBlock() must guarantee that plainSize <=
	// len(encryptedBlock).
	EncryptBlock(
		block Block, tlfCryptKey kbfscrypto.TLFCryptKey,
		blockServerHalf kbfscrypto.BlockCryptKeyServerHalf) (
		plainSize int, encryptedBlock kbfscrypto.EncryptedBlock, err error)

	// DecryptBlock decrypts a block. Similar to EncryptBlock(),
	// DecryptBlock() must guarantee that (size of the decrypted
	// block) <= len(encryptedBlock).
	DecryptBlock(
		encryptedBlock kbfscrypto.EncryptedBlock,
		tlfCryptKey kbfscrypto.TLFCryptKey,
		blockServerHalf kbfscrypto.BlockCryptKeyServerHalf, block Block) error
}

// Crypto signs, verifies, encrypts, and decrypts stuff.
type Crypto interface {
	cryptoPure

	// Duplicate kbfscrypto.Signer here to work around gomock's
	// limitations.
	Sign(context.Context, []byte) (kbfscrypto.SignatureInfo, error)
	SignForKBFS(context.Context, []byte) (kbfscrypto.SignatureInfo, error)
	SignToString(context.Context, []byte) (string, error)

	// DecryptTLFCryptKeyClientHalf decrypts a
	// kbfscrypto.TLFCryptKeyClientHalf using the current device's
	// private key and the TLF's ephemeral public key.
	DecryptTLFCryptKeyClientHalf(ctx context.Context,
		publicKey kbfscrypto.TLFEphemeralPublicKey,
		encryptedClientHalf kbfscrypto.EncryptedTLFCryptKeyClientHalf) (
		kbfscrypto.TLFCryptKeyClientHalf, error)

	// DecryptTLFCryptKeyClientHalfAny decrypts one of the
	// kbfscrypto.TLFCryptKeyClientHalf using the available
	// private keys and the ephemeral public key.  If promptPaper
	// is true, the service will prompt the user for any unlocked
	// paper keys.
	DecryptTLFCryptKeyClientHalfAny(ctx context.Context,
		keys []EncryptedTLFCryptKeyClientAndEphemeral,
		promptPaper bool) (
		kbfscrypto.TLFCryptKeyClientHalf, int, error)

	// DecryptTeamMerkleLeaf decrypts a team-encrypted Merkle leaf
	// using some team key generation greater than `minKeyGen`, and
	// the provided ephemeral public key.
	DecryptTeamMerkleLeaf(ctx context.Context, teamID keybase1.TeamID,
		publicKey kbfscrypto.TLFEphemeralPublicKey,
		encryptedMerkleLeaf kbfscrypto.EncryptedMerkleLeaf,
		minKeyGen keybase1.PerTeamKeyGeneration) ([]byte, error)

	// Shutdown frees any resources associated with this instance.
	Shutdown()
}

type tlfIDGetter interface {
	// GetIDForHandle returns the tlf.ID associated with the given
	// handle, if the logged-in user has read permission on the
	// folder.  It may or may not create the folder if it doesn't
	// exist yet, and it may return `tlf.NullID` with a `nil` error if
	// it doesn't create a missing folder.
	GetIDForHandle(ctx context.Context, handle *TlfHandle) (tlf.ID, error)
	// ValidateLatestHandleForTLF returns true if the TLF ID contained
	// in `h` does not currently map to a finalized TLF.
	ValidateLatestHandleNotFinal(ctx context.Context, h *TlfHandle) (
		bool, error)
}

// MDOps gets and puts root metadata to an MDServer.  On a get, it
// verifies the metadata is signed by the metadata's signing key.
type MDOps interface {
	tlfIDGetter

	// GetForTLF returns the current metadata object
	// corresponding to the given top-level folder, if the logged-in
	// user has read permission on the folder.
	//
	// If lockBeforeGet is not nil, it causes mdserver to take the lock on the
	// lock ID before the get.
	GetForTLF(ctx context.Context, id tlf.ID, lockBeforeGet *keybase1.LockID) (
		ImmutableRootMetadata, error)

	// GetForTLFByTime returns the newest merged MD update with a
	// server timestamp less than or equal to `serverTime`.
	GetForTLFByTime(ctx context.Context, id tlf.ID, serverTime time.Time) (
		ImmutableRootMetadata, error)

	// GetUnmergedForTLF is the same as the above but for unmerged
	// metadata.
	GetUnmergedForTLF(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) (
		ImmutableRootMetadata, error)

	// GetRange returns a range of metadata objects corresponding to
	// the passed revision numbers (inclusive).
	//
	// If lockBeforeGet is not nil, it causes mdserver to take the lock on the
	// lock ID before the get.
	GetRange(ctx context.Context, id tlf.ID, start, stop kbfsmd.Revision,
		lockID *keybase1.LockID) ([]ImmutableRootMetadata, error)

	// GetUnmergedRange is the same as the above but for unmerged
	// metadata history (inclusive).
	GetUnmergedRange(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID,
		start, stop kbfsmd.Revision) ([]ImmutableRootMetadata, error)

	// Put stores the metadata object for the given top-level folder.
	// This also adds the resulting ImmutableRootMetadata object to
	// the mdcache, if the Put is successful.  Note that constructing
	// the ImmutableRootMetadata requires knowing the verifying key,
	// which might not be the same as the local user's verifying key
	// if the MD has been copied from a previous update.
	//
	// If lockContext is not nil, it causes the mdserver to check a lockID at
	// the time of the put, and optionally (if specified in lockContext)
	// releases the lock on the lock ID if the put is successful. Releasing the
	// lock in mdserver is idempotent. Note that journalMDOps doesn't support
	// lockContext for now. If journaling is enabled, use FinishSinbleOp to
	// require locks.
	//
	// The priority parameter specifies the priority of this particular MD put
	// operation. When conflict happens, mdserver tries to prioritize writes
	// with higher priorities. Caller should use pre-defined (or define new)
	// constants in keybase1 package, such as keybase1.MDPriorityNormal. Note
	// that journalMDOps doesn't support any priority other than
	// MDPriorityNormal for now. If journaling is enabled, use FinishSinbleOp
	// to override priority.
	Put(ctx context.Context, rmd *RootMetadata,
		verifyingKey kbfscrypto.VerifyingKey,
		lockContext *keybase1.LockContext, priority keybase1.MDPriority) (
		ImmutableRootMetadata, error)

	// PutUnmerged is the same as the above but for unmerged metadata
	// history.  This also adds the resulting ImmutableRootMetadata
	// object to the mdcache, if the PutUnmerged is successful.  Note
	// that constructing the ImmutableRootMetadata requires knowing
	// the verifying key, which might not be the same as the local
	// user's verifying key if the MD has been copied from a previous
	// update.
	PutUnmerged(ctx context.Context, rmd *RootMetadata,
		verifyingKey kbfscrypto.VerifyingKey) (ImmutableRootMetadata, error)

	// PruneBranch prunes all unmerged history for the given TLF
	// branch.
	PruneBranch(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) error

	// ResolveBranch prunes all unmerged history for the given TLF
	// branch, and also deletes any blocks in `blocksToDelete` that
	// are still in the local journal.  In addition, it appends the
	// given MD to the journal.  This also adds the resulting
	// ImmutableRootMetadata object to the mdcache, if the
	// ResolveBranch is successful.  Note that constructing the
	// ImmutableRootMetadata requires knowing the verifying key, which
	// might not be the same as the local user's verifying key if the
	// MD has been copied from a previous update.
	ResolveBranch(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID,
		blocksToDelete []kbfsblock.ID, rmd *RootMetadata,
		verifyingKey kbfscrypto.VerifyingKey) (ImmutableRootMetadata, error)

	// GetLatestHandleForTLF returns the server's idea of the latest
	// handle for the TLF, which may not yet be reflected in the MD if
	// the TLF hasn't been rekeyed since it entered into a conflicting
	// state.
	GetLatestHandleForTLF(ctx context.Context, id tlf.ID) (tlf.Handle, error)
}

// KeyOps fetches server-side key halves from the key server.
type KeyOps interface {
	// GetTLFCryptKeyServerHalf gets a server-side key half for a
	// device given the key half ID.
	GetTLFCryptKeyServerHalf(ctx context.Context,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID,
		cryptPublicKey kbfscrypto.CryptPublicKey) (
		kbfscrypto.TLFCryptKeyServerHalf, error)

	// PutTLFCryptKeyServerHalves stores a server-side key halves for a
	// set of users and devices.
	PutTLFCryptKeyServerHalves(ctx context.Context,
		keyServerHalves kbfsmd.UserDeviceKeyServerHalves) error

	// DeleteTLFCryptKeyServerHalf deletes a server-side key half for a
	// device given the key half ID.
	DeleteTLFCryptKeyServerHalf(ctx context.Context,
		uid keybase1.UID, key kbfscrypto.CryptPublicKey,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID) error
}

// Prefetcher is an interface to a block prefetcher.
type Prefetcher interface {
	// ProcessBlockForPrefetch potentially triggers and monitors a prefetch.
	ProcessBlockForPrefetch(ctx context.Context, ptr BlockPointer, block Block,
		kmd KeyMetadata, priority int, lifetime BlockCacheLifetime,
		prefetchStatus PrefetchStatus, action BlockRequestAction)
	// WaitChannelForBlockPrefetch returns a channel that can be used
	// to wait for a block to finish prefetching or be canceled.  If
	// the block isn't currently being prefetched, it will return an
	// already-closed channel.  When the channel is closed, the caller
	// should still verify that the prefetch status of the block is
	// what they expect it to be, in case there was an error.
	WaitChannelForBlockPrefetch(ctx context.Context, ptr BlockPointer) (
		<-chan struct{}, error)
	// CancelPrefetch notifies the prefetcher that a prefetch should be
	// canceled.
	CancelPrefetch(BlockPointer)
	// Shutdown shuts down the prefetcher idempotently. Future calls to
	// the various Prefetch* methods will return io.EOF. The returned channel
	// allows upstream components to block until all pending prefetches are
	// complete. This feature is mainly used for testing, but also to toggle
	// the prefetcher on and off.
	Shutdown() <-chan struct{}
}

// BlockOps gets and puts data blocks to a BlockServer. It performs
// the necessary crypto operations on each block.
type BlockOps interface {
	blockRetrieverGetter

	// Get gets the block associated with the given block pointer
	// (which belongs to the TLF with the given key metadata),
	// decrypts it if necessary, and fills in the provided block
	// object with its contents, if the logged-in user has read
	// permission for that block. cacheLifetime controls the behavior of the
	// write-through cache once a Get completes.
	Get(ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer,
		block Block, cacheLifetime BlockCacheLifetime) error

	// GetEncodedSize gets the encoded size of the block associated
	// with the given block pointer (which belongs to the TLF with the
	// given key metadata).
	GetEncodedSize(ctx context.Context, kmd KeyMetadata,
		blockPtr BlockPointer) (uint32, keybase1.BlockStatus, error)

	// Ready turns the given block (which belongs to the TLF with
	// the given key metadata) into encoded (and encrypted) data,
	// and calculates its ID and size, so that we can do a bunch
	// of block puts in parallel for every write. Ready() must
	// guarantee that plainSize <= readyBlockData.QuotaSize().
	Ready(ctx context.Context, kmd KeyMetadata, block Block) (
		id kbfsblock.ID, plainSize int, readyBlockData ReadyBlockData, err error)

	// Delete instructs the server to delete the given block references.
	// It returns the number of not-yet deleted references to
	// each block reference
	Delete(ctx context.Context, tlfID tlf.ID, ptrs []BlockPointer) (
		liveCounts map[kbfsblock.ID]int, err error)

	// Archive instructs the server to mark the given block references
	// as "archived"; that is, they are not being used in the current
	// view of the folder, and shouldn't be served to anyone other
	// than folder writers.
	Archive(ctx context.Context, tlfID tlf.ID, ptrs []BlockPointer) error

	// TogglePrefetcher activates or deactivates the prefetcher.
	TogglePrefetcher(enable bool) <-chan struct{}

	// Prefetcher retrieves this BlockOps' Prefetcher.
	Prefetcher() Prefetcher

	// Shutdown shuts down all the workers performing Get operations
	Shutdown()
}

// Duplicate kbfscrypto.AuthTokenRefreshHandler here to work around
// gomock's limitations.
type authTokenRefreshHandler interface {
	RefreshAuthToken(context.Context)
}

// MDServer gets and puts metadata for each top-level directory.  The
// instantiation should be able to fetch session/user details via KBPKI.  On a
// put, the server is responsible for 1) ensuring the user has appropriate
// permissions for whatever modifications were made; 2) ensuring that
// LastModifyingWriter and LastModifyingUser are updated appropriately; and 3)
// detecting conflicting writes based on the previous root block ID (i.e., when
// it supports strict consistency).  On a get, it verifies the logged-in user
// has read permissions.
//
// TODO: Add interface for searching by time
type MDServer interface {
	authTokenRefreshHandler

	// GetForHandle returns the current (signed/encrypted) metadata
	// object corresponding to the given top-level folder's handle, if
	// the logged-in user has read permission on the folder.  It
	// creates the folder if one doesn't exist yet, and the logged-in
	// user has permission to do so.
	//
	// If lockBeforeGet is not nil, it takes a lock on the lock ID before
	// trying to get anything. If taking the lock fails, an error is returned.
	// Note that taking a lock from the mdserver is idempotent.
	//
	// If there is no returned error, then the returned ID must
	// always be non-null. A nil *RootMetadataSigned may be
	// returned, but if it is non-nil, then its ID must match the
	// returned ID.
	GetForHandle(ctx context.Context, handle tlf.Handle,
		mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (
		tlf.ID, *RootMetadataSigned, error)

	// GetForTLF returns the current (signed/encrypted) metadata object
	// corresponding to the given top-level folder, if the logged-in
	// user has read permission on the folder.
	//
	// If lockBeforeGet is not nil, it takes a lock on the lock ID before
	// trying to get anything. If taking the lock fails, an error is returned.
	// Note that taking a lock from the mdserver is idempotent.
	GetForTLF(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus,
		lockBeforeGet *keybase1.LockID) (*RootMetadataSigned, error)

	// GetForTLFByTime returns the earliest merged MD update with a
	// server timestamp equal or greater to `serverTime`.
	GetForTLFByTime(ctx context.Context, id tlf.ID, serverTime time.Time) (
		*RootMetadataSigned, error)

	// GetRange returns a range of (signed/encrypted) metadata objects
	// corresponding to the passed revision numbers (inclusive).
	//
	// If lockBeforeGet is not nil, it takes a lock on the lock ID before
	// trying to get anything. If taking the lock fails, an error is returned.
	// Note that taking a lock from the mdserver is idempotent.
	GetRange(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus,
		start, stop kbfsmd.Revision, lockBeforeGet *keybase1.LockID) (
		[]*RootMetadataSigned, error)

	// Put stores the (signed/encrypted) metadata object for the given
	// top-level folder. Note: If the unmerged bit is set in the metadata
	// block's flags bitmask it will be appended to the unmerged per-device
	// history.
	//
	// If lockContext is not nil, it causes the mdserver to check a lockID at
	// the time of the put, and optionally (if specified in lockContext)
	// releases the lock on the lock ID if the put is successful. Releasing the
	// lock in mdserver is idempotent.
	Put(ctx context.Context, rmds *RootMetadataSigned, extra kbfsmd.ExtraMetadata,
		lockContext *keybase1.LockContext, priority keybase1.MDPriority) error

	// Lock ensures lockID for tlfID is taken by this session, i.e.,
	// idempotently take the lock. If the lock is already taken by *another*
	// session, mdserver returns a throttle error, causing RPC layer at client
	// to retry. So caller of this method should observe a behavior similar to
	// blocking call, which upon successful return, makes sure the lock is
	// taken on the server. Note that the lock expires after certain time, so
	// it's important to make writes contingent to the lock by requiring the
	// lockID in Put.
	Lock(ctx context.Context, tlfID tlf.ID, lockID keybase1.LockID) error

	// Release Lock ensures lockID for tlfID is not taken by this session, i.e.,
	// idempotently release the lock. If the lock is already released or
	// expired, this is a no-op.
	ReleaseLock(ctx context.Context, tlfID tlf.ID, lockID keybase1.LockID) error

	// StartImplicitTeamMigration tells mdserver to put a implicit team
	// migration lock on id, which prevents any rekey MD writes from going
	// in. Normal classic MD updates can still happen after implicit team
	// migration has started, until a iTeam-style MD is written.
	StartImplicitTeamMigration(ctx context.Context, id tlf.ID) (err error)

	// PruneBranch prunes all unmerged history for the given TLF branch.
	PruneBranch(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) error

	// RegisterForUpdate tells the MD server to inform the caller when
	// there is a merged update with a revision number greater than
	// currHead, which did NOT originate from this same MD server
	// session.  This method returns a chan which can receive only a
	// single error before it's closed.  If the received err is nil,
	// then there is updated MD ready to fetch which didn't originate
	// locally; if it is non-nil, then the previous registration
	// cannot send the next notification (e.g., the connection to the
	// MD server may have failed). In either case, the caller must
	// re-register to get a new chan that can receive future update
	// notifications.
	RegisterForUpdate(ctx context.Context, id tlf.ID,
		currHead kbfsmd.Revision) (<-chan error, error)

	// CancelRegistration lets the local MDServer instance know that
	// we are no longer interested in updates for the specified
	// folder.  It does not necessarily forward this cancellation to
	// remote servers.
	CancelRegistration(ctx context.Context, id tlf.ID)

	// CheckForRekeys initiates the rekey checking process on the
	// server.  The server is allowed to delay this request, and so it
	// returns a channel for returning the error. Actual rekey
	// requests are expected to come in asynchronously.
	CheckForRekeys(ctx context.Context) <-chan error

	// TruncateLock attempts to take the history truncation lock for
	// this folder, for a TTL defined by the server.  Returns true if
	// the lock was successfully taken.
	TruncateLock(ctx context.Context, id tlf.ID) (bool, error)
	// TruncateUnlock attempts to release the history truncation lock
	// for this folder.  Returns true if the lock was successfully
	// released.
	TruncateUnlock(ctx context.Context, id tlf.ID) (bool, error)

	// DisableRekeyUpdatesForTesting disables processing rekey updates
	// received from the mdserver while testing.
	DisableRekeyUpdatesForTesting()

	// Shutdown is called to shutdown an MDServer connection.
	Shutdown()

	// IsConnected returns whether the MDServer is connected.
	IsConnected() bool

	// GetLatestHandleForTLF returns the server's idea of the latest handle for the TLF,
	// which may not yet be reflected in the MD if the TLF hasn't been rekeyed since it
	// entered into a conflicting state.  For the highest level of confidence, the caller
	// should verify the mapping with a Merkle tree lookup.
	GetLatestHandleForTLF(ctx context.Context, id tlf.ID) (tlf.Handle, error)

	// OffsetFromServerTime is the current estimate for how off our
	// local clock is from the mdserver clock.  Add this to any
	// mdserver-provided timestamps to get the "local" time of the
	// corresponding event.  If the returned bool is false, then we
	// don't have a current estimate for the offset.
	OffsetFromServerTime() (time.Duration, bool)

	// GetKeyBundles looks up the key bundles for the given key
	// bundle IDs. tlfID must be non-zero but either or both wkbID
	// and rkbID can be zero, in which case nil will be returned
	// for the respective bundle. If a bundle cannot be found, an
	// error is returned and nils are returned for both bundles.
	GetKeyBundles(ctx context.Context, tlfID tlf.ID,
		wkbID kbfsmd.TLFWriterKeyBundleID, rkbID kbfsmd.TLFReaderKeyBundleID) (
		*kbfsmd.TLFWriterKeyBundleV3, *kbfsmd.TLFReaderKeyBundleV3, error)

	// CheckReachability is called when the Keybase service sends a notification
	// that network connectivity has changed.
	CheckReachability(ctx context.Context)

	// FastForwardBackoff fast forwards any existing backoff timer for
	// reconnects. If MD server is connected at the time this is called, it's
	// essentially a no-op.
	FastForwardBackoff()

	// FindNextMD finds the serialized (and possibly encrypted) root
	// metadata object from the leaf node of the second KBFS merkle
	// tree to be produced after a given Keybase global merkle tree
	// sequence number `rootSeqno` (and all merkle nodes between it
	// and the root, and the root itself).  It also returns the global
	// merkle tree sequence number of the root that first included the
	// returned metadata object.
	FindNextMD(ctx context.Context, tlfID tlf.ID, rootSeqno keybase1.Seqno) (
		nextKbfsRoot *kbfsmd.MerkleRoot, nextMerkleNodes [][]byte,
		nextRootSeqno keybase1.Seqno, err error)

	// GetMerkleRootLatest returns the latest KBFS merkle root for the
	// given tree ID.
	GetMerkleRootLatest(ctx context.Context, treeID keybase1.MerkleTreeID) (
		root *kbfsmd.MerkleRoot, err error)
}

type mdServerLocal interface {
	MDServer
	addNewAssertionForTest(
		uid keybase1.UID, newAssertion keybase1.SocialAssertion) error
	getCurrentMergedHeadRevision(ctx context.Context, id tlf.ID) (
		rev kbfsmd.Revision, err error)
	isShutdown() bool
	copy(config mdServerLocalConfig) mdServerLocal
	enableImplicitTeams()
	setKbfsMerkleRoot(treeID keybase1.MerkleTreeID, root *kbfsmd.MerkleRoot)
}

// BlockServer gets and puts opaque data blocks.  The instantiation
// should be able to fetch session/user details via KBPKI.  On a
// put/delete, the server is reponsible for: 1) checking that the ID
// matches the hash of the buffer; and 2) enforcing writer quotas.
type BlockServer interface {
	authTokenRefreshHandler

	// Get gets the (encrypted) block data associated with the given
	// block ID and context, uses the provided block key to decrypt
	// the block, and fills in the provided block object with its
	// contents, if the logged-in user has read permission for that
	// block.
	Get(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
		context kbfsblock.Context, cacheType DiskBlockCacheType) (
		[]byte, kbfscrypto.BlockCryptKeyServerHalf, error)

	// GetEncodedSize gets the encoded size of the block associated
	// with the given block pointer (which belongs to the TLF with the
	// given key metadata).
	GetEncodedSize(
		ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
		context kbfsblock.Context) (uint32, keybase1.BlockStatus, error)

	// Put stores the (encrypted) block data under the given ID
	// and context on the server, along with the server half of
	// the block key.  context should contain a kbfsblock.RefNonce
	// of zero.  There will be an initial reference for this block
	// for the given context.
	//
	// Put should be idempotent, although it should also return an
	// error if, for a given ID, any of the other arguments differ
	// from previous Put calls with the same ID.
	//
	// If this returns a kbfsblock.ServerErrorOverQuota, with
	// Throttled=false, the caller can treat it as informational
	// and otherwise ignore the error.
	Put(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
		context kbfsblock.Context, buf []byte,
		serverHalf kbfscrypto.BlockCryptKeyServerHalf,
		cacheType DiskBlockCacheType) error

	// PutAgain re-stores a previously deleted block under the same ID
	// with the same data.
	PutAgain(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
		context kbfsblock.Context, buf []byte,
		serverHalf kbfscrypto.BlockCryptKeyServerHalf,
		cacheType DiskBlockCacheType) error

	// AddBlockReference adds a new reference to the given block,
	// defined by the given context (which should contain a
	// non-zero kbfsblock.RefNonce).  (Contexts with a
	// kbfsblock.RefNonce of zero should be used when putting the
	// block for the first time via Put().)  Returns a
	// kbfsblock.ServerErrorBlockNonExistent if id is unknown within this
	// folder.
	//
	// AddBlockReference should be idempotent, although it should
	// also return an error if, for a given ID and refnonce, any
	// of the other fields of context differ from previous
	// AddBlockReference calls with the same ID and refnonce.
	//
	// If this returns a kbfsblock.ServerErrorOverQuota, with
	// Throttled=false, the caller can treat it as informational
	// and otherwise ignore the error.
	AddBlockReference(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
		context kbfsblock.Context) error
	// RemoveBlockReferences removes the references to the given block
	// ID defined by the given contexts.  If no references to the block
	// remain after this call, the server is allowed to delete the
	// corresponding block permanently.  If the reference defined by
	// the count has already been removed, the call is a no-op.
	// It returns the number of remaining not-yet-deleted references after this
	// reference has been removed
	RemoveBlockReferences(ctx context.Context, tlfID tlf.ID,
		contexts kbfsblock.ContextMap) (liveCounts map[kbfsblock.ID]int, err error)

	// ArchiveBlockReferences marks the given block references as
	// "archived"; that is, they are not being used in the current
	// view of the folder, and shouldn't be served to anyone other
	// than folder writers.
	//
	// For a given ID/refnonce pair, ArchiveBlockReferences should
	// be idempotent, although it should also return an error if
	// any of the other fields of the context differ from previous
	// calls with the same ID/refnonce pair.
	ArchiveBlockReferences(ctx context.Context, tlfID tlf.ID,
		contexts kbfsblock.ContextMap) error

	// IsUnflushed returns whether a given block is being queued
	// locally for later flushing to another block server.  If the
	// block is currently being flushed to the server, this should
	// return `true`, so that the caller will try to clean it up from
	// the server if it's no longer needed.
	IsUnflushed(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID) (
		bool, error)

	// Shutdown is called to shutdown a BlockServer connection.
	Shutdown(ctx context.Context)

	// GetUserQuotaInfo returns the quota for the logged-in user.
	GetUserQuotaInfo(ctx context.Context) (info *kbfsblock.QuotaInfo, err error)

	// GetTeamQuotaInfo returns the quota for a team.
	GetTeamQuotaInfo(ctx context.Context, tid keybase1.TeamID) (
		info *kbfsblock.QuotaInfo, err error)
}

// blockServerLocal is the interface for BlockServer implementations
// that store data locally.
type blockServerLocal interface {
	BlockServer
	// getAllRefsForTest returns all the known block references
	// for the given TLF, and should only be used during testing.
	getAllRefsForTest(ctx context.Context, tlfID tlf.ID) (
		map[kbfsblock.ID]blockRefMap, error)
}

// BlockSplitter decides when a file block needs to be split
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

	// MaxPtrsPerBlock describes the number of indirect pointers we
	// can fit into one indirect block.
	MaxPtrsPerBlock() int

	// ShouldEmbedBlockChanges decides whether we should keep the
	// block changes embedded in the MD or not.
	ShouldEmbedBlockChanges(bc *BlockChanges) bool

	// SplitDirIfNeeded splits a direct DirBlock into multiple blocks
	// if needed.  It may modify `block`.  If a split isn't needed, it
	// returns a one-element slice containing `block`.  If a split is
	// needed, it returns a non-nil offset for the new block.
	SplitDirIfNeeded(block *DirBlock) ([]*DirBlock, *StringOffset)
}

// KeyServer fetches/writes server-side key halves from/to the key server.
type KeyServer interface {
	// GetTLFCryptKeyServerHalf gets a server-side key half for a
	// device given the key half ID.
	GetTLFCryptKeyServerHalf(ctx context.Context,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID,
		cryptPublicKey kbfscrypto.CryptPublicKey) (
		kbfscrypto.TLFCryptKeyServerHalf, error)

	// PutTLFCryptKeyServerHalves stores a server-side key halves for a
	// set of users and devices.
	PutTLFCryptKeyServerHalves(ctx context.Context,
		keyServerHalves kbfsmd.UserDeviceKeyServerHalves) error

	// DeleteTLFCryptKeyServerHalf deletes a server-side key half for a
	// device given the key half ID.
	DeleteTLFCryptKeyServerHalf(ctx context.Context,
		uid keybase1.UID, key kbfscrypto.CryptPublicKey,
		serverHalfID kbfscrypto.TLFCryptKeyServerHalfID) error

	// Shutdown is called to free any KeyServer resources.
	Shutdown()
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
	// together atomically.  Each NodeChange in `changes` affects the
	// same top-level folder and branch. `allAffectedNodeIDs` is a
	// list of all the nodes that had their underlying data changed,
	// even if it wasn't an user-visible change (e.g., if a
	// subdirectory was updated, the directory block for the TLF root
	// is updated but that wouldn't be visible to a user).
	BatchChanges(ctx context.Context, changes []NodeChange,
		allAffectedNodeIDs []NodeID)
	// TlfHandleChange announces that the handle of the corresponding
	// folder branch has changed, likely due to previously-unresolved
	// assertions becoming resolved.  This indicates that the listener
	// should switch over any cached paths for this folder-branch to
	// the new name.  Nodes that were acquired under the old name will
	// still continue to work, but new lookups on the old name may
	// either encounter alias errors or entirely new TLFs (in the case
	// of conflicts).
	TlfHandleChange(ctx context.Context, newHandle *TlfHandle)
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

// Clock is an interface for getting the current time
type Clock interface {
	// Now returns the current time.
	Now() time.Time
}

// ConflictRenamer deals with names for conflicting directory entries.
type ConflictRenamer interface {
	// ConflictRename returns the appropriately modified filename.
	ConflictRename(ctx context.Context, op op, original string) (
		string, error)
}

// Tracer maybe adds traces to contexts.
type Tracer interface {
	// MaybeStartTrace, if tracing is on, returns a new context
	// based on the given one with an attached trace made with the
	// given family and title. Otherwise, it returns the given
	// context unchanged.
	MaybeStartTrace(ctx context.Context, family, title string) context.Context
	// MaybeFinishTrace, finishes the trace attached to the given
	// context, if any.
	MaybeFinishTrace(ctx context.Context, err error)
}

// InitMode encapsulates mode differences.
type InitMode interface {
	// Type returns the InitModeType of this mode.
	Type() InitModeType
	// IsTestMode returns whether we are running a test.
	IsTestMode() bool
	// BlockWorkers returns the number of block workers to run.
	BlockWorkers() int
	// PrefetchWorkers returns the number of prefetch workers to run.
	PrefetchWorkers() int
	// DefaultBlockRequestAction returns the action to be used by
	// default whenever fetching a block.
	DefaultBlockRequestAction() BlockRequestAction
	// RekeyWorkers returns the number of rekey workers to run.
	RekeyWorkers() int
	// RekeyQueueSize returns the size of the rekey queue.
	RekeyQueueSize() int
	// DirtyBlockCacheEnabled indicates if we should run a dirty block
	// cache.
	DirtyBlockCacheEnabled() bool
	// BackgroundFlushesEnabled indicates if we should periodically be
	// flushing unsynced dirty writes to the server or journal.
	BackgroundFlushesEnabled() bool
	// MetricsEnabled indicates if we should be collecting metrics.
	MetricsEnabled() bool
	// ConflictResolutionEnabled indicated if we should be running
	// the conflict resolution background process.
	ConflictResolutionEnabled() bool
	// BlockManagementEnabled indicates whether we should be running
	// the block archive/delete background process, and whether we
	// should be re-embedding block change blocks in MDs.
	BlockManagementEnabled() bool
	// QuotaReclamationEnabled indicates whether we should be running
	// the quota reclamation background process.
	QuotaReclamationEnabled() bool
	// QuotaReclamationPeriod indicates how often should each TLF
	// should check for quota to reclaim.  If the Duration.Seconds()
	// == 0, quota reclamation should not run automatically.
	QuotaReclamationPeriod() time.Duration
	// QuotaReclamationMinUnrefAge indicates the minimum time a block
	// must have been unreferenced before it can be reclaimed.
	QuotaReclamationMinUnrefAge() time.Duration
	// QuotaReclamationMinHeadAge indicates the minimum age of the
	// most recently merged MD update before we can run reclamation,
	// to avoid conflicting with a currently active writer.
	QuotaReclamationMinHeadAge() time.Duration
	// NodeCacheEnabled indicates whether we should be caching data nodes.
	NodeCacheEnabled() bool
	// TLFUpdatesEnabled indicates whether we should be registering
	// ourselves with the mdserver for TLF updates.
	TLFUpdatesEnabled() bool
	// KBFSServiceEnabled indicates whether we should launch a local
	// service for answering incoming KBFS-related RPCs.
	KBFSServiceEnabled() bool
	// JournalEnabled indicates whether this mode supports a journal.
	JournalEnabled() bool
	// UnmergedTLFsEnabled indicates whether it's possible for a
	// device in this mode to have unmerged TLFs.
	UnmergedTLFsEnabled() bool
	// ServiceKeepaliveEnabled indicates whether we need to send
	// keepalive probes to the Keybase service daemon.
	ServiceKeepaliveEnabled() bool
	// TLFEditHistoryEnabled indicates whether we should be running
	// the background TLF edit history process.
	TLFEditHistoryEnabled() bool
	// SendEditNotificationsEnabled indicates whether we should send
	// edit notifications on FS writes.
	SendEditNotificationsEnabled() bool
	// ClientType indicates the type we should advertise to the
	// Keybase service.
	ClientType() keybase1.ClientType
	// LocalHTTPServerEnabled represents whether we should launch an HTTP
	// server.
	LocalHTTPServerEnabled() bool
	// MaxCleanBlockCacheCapacity is the maximum number of bytes to be taken up
	// by the clean block cache.
	MaxCleanBlockCacheCapacity() uint64
}

type initModeGetter interface {
	// Mode indicates how KBFS is configured to run.
	Mode() InitMode

	// IsTestMode() inidicates whether KBFS is running in a test.
	IsTestMode() bool
}

type blockCryptVersioner interface {
	// BlockCryptVersion returns the block encryption version to be used for
	// new blocks.
	BlockCryptVersion() kbfscrypto.EncryptionVer
}

// Config collects all the singleton instance instantiations needed to
// run KBFS in one place.  The methods below are self-explanatory and
// do not require comments.
type Config interface {
	dataVersioner
	blockCryptVersioner
	logMaker
	blockCacher
	blockServerGetter
	codecGetter
	cryptoPureGetter
	keyGetterGetter
	cryptoGetter
	chatGetter
	signerGetter
	currentSessionGetterGetter
	diskBlockCacheGetter
	diskBlockCacheSetter
	diskBlockCacheFractionSetter
	syncBlockCacheFractionSetter
	diskMDCacheGetter
	diskMDCacheSetter
	diskQuotaCacheGetter
	diskQuotaCacheSetter
	blockMetadataStoreGetSeter
	clockGetter
	diskLimiterGetter
	syncedTlfGetterSetter
	initModeGetter
	Tracer
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
	SetKeyBundleCache(kbfsmd.KeyBundleCache)
	KeyBundleCache() kbfsmd.KeyBundleCache
	SetKeyCache(KeyCache)
	SetBlockCache(BlockCache)
	DirtyBlockCache() DirtyBlockCache
	SetDirtyBlockCache(DirtyBlockCache)
	SetCrypto(Crypto)
	SetChat(Chat)
	SetCodec(kbfscodec.Codec)
	MDOps() MDOps
	SetMDOps(MDOps)
	KeyOps() KeyOps
	SetKeyOps(KeyOps)
	BlockOps() BlockOps
	SetBlockOps(BlockOps)
	MDServer() MDServer
	SetMDServer(MDServer)
	SetBlockServer(BlockServer)
	KeyServer() KeyServer
	SetKeyServer(KeyServer)
	KeybaseService() KeybaseService
	SetKeybaseService(KeybaseService)
	BlockSplitter() BlockSplitter
	SetBlockSplitter(BlockSplitter)
	Notifier() Notifier
	SetNotifier(Notifier)
	SetClock(Clock)
	ConflictRenamer() ConflictRenamer
	SetConflictRenamer(ConflictRenamer)
	UserHistory() *kbfsedits.UserHistory
	SetUserHistory(*kbfsedits.UserHistory)
	MetadataVersion() kbfsmd.MetadataVer
	SetMetadataVersion(kbfsmd.MetadataVer)
	SetBlockCryptVersion(kbfscrypto.EncryptionVer)
	DefaultBlockType() keybase1.BlockType
	SetDefaultBlockType(blockType keybase1.BlockType)
	RekeyQueue() RekeyQueue
	SetRekeyQueue(RekeyQueue)
	// ReqsBufSize indicates the number of read or write operations
	// that can be buffered per folder
	ReqsBufSize() int
	// MaxNameBytes indicates the maximum supported size of a
	// directory entry name in bytes.
	MaxNameBytes() uint32
	// DoBackgroundFlushes says whether we should periodically try to
	// flush dirty files, even without a sync from the user.  Should
	// be true except for during some testing.
	DoBackgroundFlushes() bool
	SetDoBackgroundFlushes(bool)
	// RekeyWithPromptWaitTime indicates how long to wait, after
	// setting the rekey bit, before prompting for a paper key.
	RekeyWithPromptWaitTime() time.Duration
	SetRekeyWithPromptWaitTime(time.Duration)
	// PrefetchStatus returns the prefetch status of a block.
	PrefetchStatus(context.Context, tlf.ID, BlockPointer) PrefetchStatus

	// GracePeriod specifies a grace period for which a delayed cancellation
	// waits before actual cancels the context. This is useful for giving
	// critical portion of a slow remote operation some extra time to finish as
	// an effort to avoid conflicting. Example include an O_EXCL Create call
	// interrupted by ALRM signal actually makes it to the server, while
	// application assumes not since EINTR is returned. A delayed cancellation
	// allows us to distinguish between successful cancel (where remote operation
	// didn't make to server) or failed cancel (where remote operation made to
	// the server). However, the optimal value of this depends on the network
	// conditions. A long grace period for really good network condition would
	// just unnecessarily slow down Ctrl-C.
	//
	// TODO: make this adaptive and self-change over time based on network
	// conditions.
	DelayedCancellationGracePeriod() time.Duration
	SetDelayedCancellationGracePeriod(time.Duration)

	// ResetCaches clears and re-initializes all data and key caches.
	ResetCaches()

	// StorageRoot returns the path to the storage root for this config.
	StorageRoot() string

	// MetricsRegistry may be nil, which should be interpreted as
	// not using metrics at all. (i.e., as if UseNilMetrics were
	// set). This differs from how go-metrics treats nil Registry
	// objects, which is to use the default registry.
	MetricsRegistry() metrics.Registry
	SetMetricsRegistry(metrics.Registry)

	// SetTraceOptions set the options for tracing (via x/net/trace).
	SetTraceOptions(enabled bool)

	// TLFValidDuration is the time TLFs are valid before identification needs to be redone.
	TLFValidDuration() time.Duration
	// SetTLFValidDuration sets TLFValidDuration.
	SetTLFValidDuration(time.Duration)

	// BGFlushDirOpBatchSize returns the directory op batch size for
	// background flushes.
	BGFlushDirOpBatchSize() int
	// SetBGFlushDirOpBatchSize sets the directory op batch size for
	// background flushes.
	SetBGFlushDirOpBatchSize(s int)

	// BGFlushPeriod returns how long to wait for a batch to fill up
	// before syncing a set of changes to the servers.
	BGFlushPeriod() time.Duration
	// SetBGFlushPeriod sets how long to wait for a batch to fill up
	// before syncing a set of changes to the servers.
	SetBGFlushPeriod(p time.Duration)

	// Shutdown is called to free config resources.
	Shutdown(context.Context) error
	// CheckStateOnShutdown tells the caller whether or not it is safe
	// to check the state of the system on shutdown.
	CheckStateOnShutdown() bool

	// GetRekeyFSMLimiter returns the global rekey FSM limiter.
	GetRekeyFSMLimiter() *OngoingWorkLimiter

	// RootNodeWrappers returns the set of root node wrapper functions
	// that will be applied to each newly-created root node.
	RootNodeWrappers() []func(Node) Node
	// AddRootNodeWrapper adds a new wrapper function that will be
	// applied whenever a root Node is created.  This will only apply
	// to TLFs that are first accessed after `AddRootNodeWrapper` is
	// called.
	AddRootNodeWrapper(func(Node) Node)
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
	GetOrCreate(
		ptr BlockPointer, name string, parent Node, et EntryType) (Node, error)
	// Get returns the Node associated with the given ptr if one
	// already exists.  Otherwise, it returns nil.
	Get(ref BlockRef) Node
	// UpdatePointer updates the BlockPointer for the corresponding
	// Node.  NodeCache ignores this call when oldRef is not cached in
	// any Node. Returns whether the ID of the node that was updated,
	// or `nil` if nothing was updated.
	UpdatePointer(oldRef BlockRef, newPtr BlockPointer) NodeID
	// Move swaps the parent node for the corresponding Node, and
	// updates the node's name.  NodeCache ignores the call when ptr
	// is not cached.  If newParent is nil, it treats the ptr's
	// corresponding node as being unlinked from the old parent
	// completely. If successful, it returns a function that can be
	// called to undo the effect of the move (or `nil` if nothing
	// needs to be done); if newParent cannot be found, it returns an
	// error and a `nil` undo function.
	Move(ref BlockRef, newParent Node, newName string) (
		undoFn func(), err error)
	// Unlink set the corresponding node's parent to nil and caches
	// the provided path in case the node is still open. NodeCache
	// ignores the call when ptr is not cached.  The path is required
	// because the caller may have made changes to the parent nodes
	// already that shouldn't be reflected in the cached path.  It
	// returns a function that can be called to undo the effect of the
	// unlink (or `nil` if nothing needs to be done).
	Unlink(ref BlockRef, oldPath path, oldDe DirEntry) (undoFn func())
	// IsUnlinked returns whether `Unlink` has been called for the
	// reference behind this node.
	IsUnlinked(node Node) bool
	// UnlinkedDirEntry returns a directory entry if `Unlink` has been
	// called for the reference behind this node.
	UnlinkedDirEntry(node Node) DirEntry
	// UpdateUnlinkedDirEntry modifies a cached directory entry for a
	// node that has already been unlinked.
	UpdateUnlinkedDirEntry(node Node, newDe DirEntry)
	// PathFromNode creates the path up to a given Node.
	PathFromNode(node Node) path
	// AllNodes returns the complete set of nodes currently in the
	// cache.  The returned Nodes are not wrapped, and shouldn't be
	// used for data access.
	AllNodes() []Node
	// AllNodeChildren returns the complete set of nodes currently in
	// the cache, for which the given node `n` is a parent (direct or
	// indirect).  The returned slice does not include `n` itself.
	// The returned Nodes are not wrapped, and shouldn't be used for
	// data access.
	AllNodeChildren(n Node) []Node
	// AddRootWrapper adds a new wrapper function that will be applied
	// whenever a root Node is created.
	AddRootWrapper(func(Node) Node)
}

// fileBlockDeepCopier fetches a file block, makes a deep copy of it
// (duplicating pointer for any indirect blocks) and generates a new
// random temporary block ID for it.  It returns the new BlockPointer,
// and internally saves the block for future uses.
type fileBlockDeepCopier func(context.Context, string, BlockPointer) (
	BlockPointer, error)

// crAction represents a specific action to take as part of the
// conflict resolution process.
type crAction interface {
	// swapUnmergedBlock should be called before do(), and if it
	// returns true, the caller must use the merged block
	// corresponding to the returned BlockPointer instead of
	// unmergedBlock when calling do().  If BlockPointer{} is zeroPtr
	// (and true is returned), just swap in the regular mergedBlock.
	swapUnmergedBlock(
		ctx context.Context, unmergedChains, mergedChains *crChains,
		unmergedDir *dirData) (bool, BlockPointer, error)
	// do modifies the given merged `dirData` in place to resolve the
	// conflict, and potentially uses the provided
	// `fileBlockDeepCopier`s to obtain copies of other blocks (along
	// with new BlockPointers) when requiring a block copy.  It
	// returns a set of block infos that need to be unreferenced as
	// part of this conflict resolution.
	do(
		ctx context.Context, unmergedCopier, mergedCopier fileBlockDeepCopier,
		unmergedDir, mergedDir *dirData) (unrefs []BlockInfo, err error)
	// updateOps potentially modifies, in place, the slices of
	// unmerged and merged operations stored in the corresponding
	// crChains for the given unmerged and merged most recent
	// pointers.  Eventually, the "unmerged" ops will be pushed as
	// part of a MD update, and so should contain any necessarily
	// operations to fully merge the unmerged data, including any
	// conflict resolution.  The "merged" ops will be played through
	// locally, to notify any caches about the newly-obtained merged
	// data (and any changes to local data that were required as part
	// of conflict resolution, such as renames).  A few things to note:
	// * A particular action's updateOps method may be called more than
	//   once for different sets of chains, however it should only add
	//   new directory operations (like create/rm/rename) into directory
	//   chains.
	// * updateOps doesn't necessarily result in correct BlockPointers within
	//   each of those ops; that must happen in a later phase.
	// * mergedDir can be nil if the chain is for a file.
	updateOps(
		ctx context.Context, unmergedMostRecent, mergedMostRecent BlockPointer,
		unmergedDir, mergedDir *dirData,
		unmergedChains, mergedChains *crChains) error
	// String returns a string representation for this crAction, used
	// for debugging.
	String() string
}

// RekeyQueue is a managed queue of folders needing some rekey action taken
// upon them by the current client.
type RekeyQueue interface {
	// Enqueue enqueues a folder for rekey action. If the TLF is already in the
	// rekey queue, the error channel of the existing one is returned.
	Enqueue(tlf.ID)
	// IsRekeyPending returns true if the given folder is in the rekey queue.
	// Note that an ongoing rekey doesn't count as "pending".
	IsRekeyPending(tlf.ID) bool
	// Shutdown cancels all pending rekey actions and clears the queue. It
	// doesn't cancel ongoing rekeys. After Shutdown() is called, the same
	// RekeyQueue shouldn't be used anymore.
	Shutdown()
}

// RekeyFSM is a Finite State Machine (FSM) for housekeeping rekey states for a
// FolderBranch. Each FolderBranch has its own FSM for rekeys.
//
// See rekey_fsm.go for implementation details.
//
// TODO: report FSM status in FolderBranchStatus?
type RekeyFSM interface {
	// Event sends an event to the FSM.
	Event(event RekeyEvent)
	// Shutdown shuts down the FSM. No new event should be sent into the FSM
	// after this method is called.
	Shutdown()

	// listenOnEvent adds a listener (callback) to the FSM so that when
	// event happens, callback is called with the received event. If repeatedly
	// is set to false, callback is called only once. Otherwise it's called every
	// time event happens.
	//
	// Currently this is only used in tests and for RekeyFile. See comment for
	// RequestRekeyAndWaitForOneFinishEvent for more details.
	listenOnEvent(
		event rekeyEventType, callback func(RekeyEvent), repeatedly bool)
}

// BlockRetriever specifies how to retrieve blocks.
type BlockRetriever interface {
	// Request retrieves blocks asynchronously.  `action` determines
	// what happens after the block is fetched successfully.
	Request(ctx context.Context, priority int, kmd KeyMetadata,
		ptr BlockPointer, block Block, lifetime BlockCacheLifetime,
		action BlockRequestAction) <-chan error
	// PutInCaches puts the block into the in-memory cache, and ensures that
	// the disk cache metadata is updated.
	PutInCaches(ctx context.Context, ptr BlockPointer, tlfID tlf.ID,
		block Block, lifetime BlockCacheLifetime,
		prefetchStatus PrefetchStatus) error
	// TogglePrefetcher creates a new prefetcher.
	TogglePrefetcher(enable bool, syncCh <-chan struct{}) <-chan struct{}
}

// ChatChannelNewMessageCB is a callback function that can be called
// when there's a new message on a given conversation.
type ChatChannelNewMessageCB func(convID chat1.ConversationID, body string)

// Chat specifies a minimal interface for Keybase chatting.
type Chat interface {
	// GetConversationID returns the chat conversation ID associated
	// with the given TLF name, type, chat type and channel name.
	GetConversationID(
		ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
		channelName string, chatType chat1.TopicType) (
		chat1.ConversationID, error)

	// SendTextMessage (asynchronously) sends a text chat message to
	// the given conversation and channel.
	SendTextMessage(
		ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
		convID chat1.ConversationID, body string) error

	// GetGroupedInbox returns the TLFs with the most-recent chat
	// messages of the given type, up to `maxChats` of them.
	GetGroupedInbox(
		ctx context.Context, chatType chat1.TopicType, maxChats int) (
		[]*TlfHandle, error)

	// GetChannels returns a list of all the channels for a given
	// chat. The entries in `convIDs` and `channelNames` have a 1-to-1
	// correspondence.
	GetChannels(
		ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
		chatType chat1.TopicType) (
		convIDs []chat1.ConversationID, channelNames []string, err error)

	// ReadChannel returns a set of text messages from a channel, and
	// a `nextPage` pointer to the following set of messages.  If the
	// given `startPage` is non-nil, it's used to specify the starting
	// point for the set of messages returned.
	ReadChannel(
		ctx context.Context, convID chat1.ConversationID, startPage []byte) (
		messages []string, nextPage []byte, err error)

	// RegisterForMessages registers a callback that will be called
	// for each new messages that reaches convID.
	RegisterForMessages(convID chat1.ConversationID, cb ChatChannelNewMessageCB)

	// ClearCache is called to force this instance to forget
	// everything it might have cached, e.g. when a user logs out.
	ClearCache()
}

type blockPutState interface {
	addNewBlock(
		ctx context.Context, blockPtr BlockPointer, block Block,
		readyBlockData ReadyBlockData, syncedCb func() error) error
	saveOldPtr(ctx context.Context, oldPtr BlockPointer) error
	oldPtr(ctx context.Context, blockPtr BlockPointer) (BlockPointer, error)
	mergeOtherBps(ctx context.Context, other blockPutState) error
	removeOtherBps(ctx context.Context, other blockPutState) error
	ptrs() []BlockPointer
	getBlock(ctx context.Context, blockPtr BlockPointer) (Block, error)
	getReadyBlockData(
		ctx context.Context, blockPtr BlockPointer) (ReadyBlockData, error)
	synced(blockPtr BlockPointer) error
	numBlocks() int
	deepCopy(ctx context.Context) (blockPutState, error)
	deepCopyWithBlacklist(
		ctx context.Context, blacklist map[BlockPointer]bool) (
		blockPutState, error)
}
