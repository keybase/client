// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"context"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
)

// Versioner defines a method for getting the version of some piece of
// data.
type Versioner interface {
	// DataVersion returns the data version for this block
	DataVersion() Ver
}

// Offset is a generic representation of an offset to an indirect
// pointer within an indirect Block.
type Offset interface {
	Equals(other Offset) bool
	Less(other Offset) bool
}

// Block just needs to be (de)serialized using msgpack
type Block interface {
	Versioner
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

	// ShouldEmbedData decides whether we should keep the data of size
	// `size` embedded in the MD or not.
	ShouldEmbedData(size uint64) bool

	// SplitDirIfNeeded splits a direct DirBlock into multiple blocks
	// if needed.  It may modify `block`.  If a split isn't needed, it
	// returns a one-element slice containing `block`.  If a split is
	// needed, it returns a non-nil offset for the new block.
	SplitDirIfNeeded(block *DirBlock) ([]*DirBlock, *StringOffset)
}

// BlockCacheSimple gets and puts plaintext dir blocks and file blocks into
// a cache.  These blocks are immutable and identified by their
// content hash.
type BlockCacheSimple interface {
	// Get gets the block associated with the given block ID.
	Get(ptr BlockPointer) (Block, error)
	// Put stores the final (content-addressable) block associated
	// with the given block ID. If lifetime is TransientEntry, then it
	// is assumed that the block exists on the server and the entry
	// may be evicted from the cache at any time. If lifetime is
	// PermanentEntry, then it is assumed that the block doesn't exist
	// on the server and must remain in the cache until explicitly
	// removed. As an intermediary state, as when a block is being
	// sent to the server, the block may be put into the cache both
	// with TransientEntry and PermanentEntry -- these are two
	// separate entries. This is fine, since the block should be the
	// same.  `hashBehavior` indicates whether the plaintext contents
	// of transient, direct blocks should be hashed, in order to
	// identify blocks that can be de-duped.
	Put(ptr BlockPointer, tlf tlf.ID, block Block,
		lifetime BlockCacheLifetime, hashBehavior BlockCacheHashBehavior) error
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

// IsDirtyProvider defines a method for checking whether a given
// pointer is dirty.
type IsDirtyProvider interface {
	// IsDirty states whether or not the block associated with the
	// given block pointer and branch name is dirty in this cache.
	IsDirty(tlfID tlf.ID, ptr BlockPointer, branch BranchName) bool
}

// ReadyProvider defines a method for readying a block.
type ReadyProvider interface {
	// Ready turns the given block (which belongs to the TLF with
	// the given key metadata) into encoded (and encrypted) data,
	// and calculates its ID and size, so that we can do a bunch
	// of block puts in parallel for every write. Ready() must
	// guarantee that plainSize <= readyBlockData.QuotaSize().
	Ready(ctx context.Context, kmd libkey.KeyMetadata, block Block) (
		id kbfsblock.ID, plainSize int, readyBlockData ReadyBlockData,
		err error)
}

// BlockPutState is an interface for keeping track of readied blocks
// before putting them to the bserver.
type BlockPutState interface {
	AddNewBlock(
		ctx context.Context, blockPtr BlockPointer, block Block,
		readyBlockData ReadyBlockData, syncedCb func() error) error
	SaveOldPtr(ctx context.Context, oldPtr BlockPointer) error
}

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

// DirtyPermChan is a channel that gets closed when the holder has
// permission to write.  We are forced to define it as a type due to a
// bug in mockgen that can't handle return values with a chan
// struct{}.
type DirtyPermChan <-chan struct{}

// DirtyBlockCache gets and puts plaintext dir blocks and file blocks
// into a cache, which have been modified by the application and not
// yet committed on the KBFS servers.  They are identified by a
// (potentially random) ID that may not have any relationship with
// their context, along with a Branch in case the same TLF is being
// modified via multiple branches.  Dirty blocks are never evicted,
// they must be deleted explicitly.
type DirtyBlockCache interface {
	IsDirtyProvider
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

// Obfuscator can transform a given plaintext string into a
// securely-obfuscated, but still human-readable, string.
type Obfuscator interface {
	// Obfuscate returns an obfuscated version of `plaintext`.
	Obfuscate(plaintext string) string
}
