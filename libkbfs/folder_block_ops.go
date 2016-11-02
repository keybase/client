// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type overallBlockState int

const (
	// cleanState: no outstanding local writes.
	cleanState overallBlockState = iota
	// dirtyState: there are outstanding local writes that haven't yet been
	// synced.
	dirtyState
)

// blockReqType indicates whether an operation makes block
// modifications or not
type blockReqType int

const (
	// A block read request.
	blockRead blockReqType = iota
	// A block write request.
	blockWrite
)

type mdToCleanIfUnused struct {
	md  ReadOnlyRootMetadata
	bps *blockPutState
}

type syncInfo struct {
	oldInfo         BlockInfo
	op              *syncOp
	unrefs          []BlockInfo
	bps             *blockPutState
	refBytes        uint64
	unrefBytes      uint64
	toCleanIfUnused []mdToCleanIfUnused
}

func (si *syncInfo) DeepCopy(codec kbfscodec.Codec) (*syncInfo, error) {
	newSi := &syncInfo{
		oldInfo:    si.oldInfo,
		refBytes:   si.refBytes,
		unrefBytes: si.unrefBytes,
	}
	newSi.unrefs = make([]BlockInfo, len(si.unrefs))
	copy(newSi.unrefs, si.unrefs)
	if si.bps != nil {
		newSi.bps = si.bps.DeepCopy()
	}
	if si.op != nil {
		err := kbfscodec.Update(codec, &newSi.op, si.op)
		if err != nil {
			return nil, err
		}
	}
	newSi.toCleanIfUnused = make([]mdToCleanIfUnused, len(si.toCleanIfUnused))
	for i, toClean := range si.toCleanIfUnused {
		// It might be overkill to deep-copy these MDs and bpses,
		// which are probably immutable, but for now let's do the safe
		// thing.
		copyMd, err := toClean.md.deepCopy(codec)
		if err != nil {
			return nil, err
		}
		newSi.toCleanIfUnused[i].md = copyMd.ReadOnly()
		newSi.toCleanIfUnused[i].bps = toClean.bps.DeepCopy()
	}
	return newSi, nil
}

func (si *syncInfo) removeReplacedBlock(ctx context.Context,
	log logger.Logger, ptr BlockPointer) {
	for i, ref := range si.op.RefBlocks {
		if ref == ptr {
			log.CDebugf(ctx, "Replacing old ref %v", ptr)
			si.op.RefBlocks = append(si.op.RefBlocks[:i],
				si.op.RefBlocks[i+1:]...)
			for j, unref := range si.unrefs {
				if unref.BlockPointer == ptr {
					// Don't completely remove the unref,
					// since it contains size info that we
					// need to incorporate into the MD
					// usage calculations.
					si.unrefs[j].BlockPointer = zeroPtr
				}
			}
			break
		}
	}
}

func (si *syncInfo) mergeUnrefCache(md *RootMetadata) {
	for _, info := range si.unrefs {
		// it's ok if we push the same ptr.ID/RefNonce multiple times,
		// because the subsequent ones should have a QuotaSize of 0.
		md.AddUnrefBlock(info)
	}
}

// folderBlockOps contains all the fields that must be synchronized by
// blockLock. It will eventually also contain all the methods that
// must be synchronized by blockLock, so that folderBranchOps will
// have no knowledge of blockLock.
//
// -- And now, a primer on tracking dirty bytes --
//
// The DirtyBlockCache tracks the number of bytes that are dirtied
// system-wide, as the number of bytes that haven't yet been synced
// ("unsynced"), and a number of bytes that haven't yet been resolved
// yet because the overall file Sync hasn't finished yet ("total").
// This data helps us decide when we need to block incoming Writes, in
// order to keep memory usage from exploding.
//
// It's the responsibility of folderBlockOps (and its helper struct
// dirtyFile) to update these totals in DirtyBlockCache for the
// individual files within this TLF.  This is complicated by a few things:
//   * New writes to a file are "deferred" while a Sync is happening, and
//     are replayed after the Sync finishes.
//   * Syncs can be canceled or error out halfway through syncing the blocks,
//     leaving the file in a dirty state until the next Sync.
//   * Syncs can fail with a /recoverable/ error, in which case they get
//     retried automatically by folderBranchOps.  In that case, the retried
//     Sync also sucks in any outstanding deferred writes.
//
// With all that in mind, here is the rough breakdown of how this
// bytes-tracking is implemented:
//   * On a Write/Truncate to a block, folderBranchOps counts all the
//     newly-dirtied bytes in a file as "unsynced".  That is, if the block was
//     already in the dirty cache (and not already being synced), only
//     extensions to the block count as "unsynced" bytes.
//   * When a Sync starts, dirtyFile remembers the total of bytes being synced,
//     and the size of each block being synced.
//   * When each block put finishes successfully, dirtyFile subtracts the size
//     of that block from "unsynced".
//   * When a Sync finishes successfully, the total sum of bytes in that sync
//     are subtracted from the "total" dirty bytes outstanding.
//   * If a Sync fails, but some blocks were put successfully, those blocks
//     are "re-dirtied", which means they count as unsynced bytes again.
//     dirtyFile handles this.
//   * When a Write/Truncate is deferred due to an ongoing Sync, its bytes
//     still count towards the "unsynced" total.  In fact, this essentially
//     creates a new copy of those blocks, and the whole size of that block
//     (not just the newly-dirtied bytes) count for the total.  However,
//     when the write gets replayed, folderBlockOps first subtracts those bytes
//     from the system-wide numbers, since they are about to be replayed.
//   * When a Sync is retried after a recoverable failure, dirtyFile adds
//     the newly-dirtied deferred bytes to the system-wide numbers, since they
//     are now being assimilated into this Sync.
//   * dirtyFile also exposes a concept of "orphaned" blocks.  These are child
//     blocks being synced that are now referenced via a new, permanent block
//     ID from the parent indirect block.  This matters for when hard failures
//     occur during a Sync -- the blocks will no longer be accessible under
//     their previous old pointers, and so dirtyFile needs to know their old
//     bytes can be cleaned up now.
type folderBlockOps struct {
	config       Config
	log          logger.Logger
	folderBranch FolderBranch
	observers    *observerList

	// forceSyncChan can be sent on to trigger an immediate
	// Sync().  It is a blocking channel.
	forceSyncChan chan<- struct{}

	// protects access to blocks in this folder and all fields
	// below.
	blockLock blockLock

	// Which files are currently dirty and have dirty blocks that are either
	// currently syncing, or waiting to be sync'd.
	dirtyFiles map[BlockPointer]*dirtyFile

	// For writes and truncates, track the unsynced to-be-unref'd
	// block infos, per-path.
	unrefCache map[BlockRef]*syncInfo
	// For writes and truncates, track the modified (but not yet
	// committed) directory entries. Maps the entry BlockRef to a
	// modified entry.
	deCache map[BlockRef]DirEntry

	// Writes and truncates for blocks that were being sync'd, and
	// need to be replayed after the sync finishes on top of the new
	// versions of the blocks.
	deferredWrites []func(context.Context, *lockState, KeyMetadata, path) error
	// Blocks that need to be deleted from the dirty cache before any
	// deferred writes are replayed.
	deferredDirtyDeletes []BlockPointer
	deferredWaitBytes    int64

	// set to true if this write or truncate should be deferred
	doDeferWrite bool

	// nodeCache itself is goroutine-safe, but write/truncate must
	// call PathFromNode() only under blockLock (see nodeCache
	// comments in folder_branch_ops.go).
	nodeCache NodeCache
}

// Only exported methods of folderBlockOps should be used outside of this
// file.
//
// Although, temporarily, folderBranchOps is allowed to reach in and
// manipulate folderBlockOps fields and methods directly.

func (fbo *folderBlockOps) id() tlf.ID {
	return fbo.folderBranch.Tlf
}

func (fbo *folderBlockOps) branch() BranchName {
	return fbo.folderBranch.Branch
}

// GetState returns the overall block state of this TLF.
func (fbo *folderBlockOps) GetState(lState *lockState) overallBlockState {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	if len(fbo.deCache) == 0 {
		return cleanState
	}
	return dirtyState
}

func (fbo *folderBlockOps) getBlockFromDirtyOrCleanCache(ptr BlockPointer,
	branch BranchName) (Block, error) {
	// Check the dirty cache first.
	if block, err := fbo.config.DirtyBlockCache().Get(
		fbo.id(), ptr, branch); err == nil {
		return block, nil
	}

	return fbo.config.BlockCache().Get(ptr)
}

func (fbo *folderBlockOps) checkDataVersion(p path, ptr BlockPointer) error {
	if ptr.DataVer < FirstValidDataVer {
		return InvalidDataVersionError{ptr.DataVer}
	}
	if ptr.DataVer > fbo.config.DataVersion() {
		return NewDataVersionError{p, ptr.DataVer}
	}
	return nil
}

// getBlockHelperLocked retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server. If
// notifyPath is valid and the block isn't cached, trigger a read
// notification.
//
// This must be called only by get{File,Dir}BlockHelperLocked().
func (fbo *folderBlockOps) getBlockHelperLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, ptr BlockPointer, branch BranchName,
	newBlock makeNewBlock, doCache bool, notifyPath path) (
	Block, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	if !ptr.IsValid() {
		return nil, InvalidBlockRefError{ptr.Ref()}
	}

	if block, err := fbo.getBlockFromDirtyOrCleanCache(
		ptr, branch); err == nil {
		return block, nil
	}

	if err := fbo.checkDataVersion(notifyPath, ptr); err != nil {
		return nil, err
	}

	// TODO: add an optimization here that will avoid fetching the
	// same block twice from over the network

	// fetch the block, and add to cache
	block := newBlock()

	bops := fbo.config.BlockOps()

	if notifyPath.isValid() {
		fbo.config.Reporter().Notify(ctx, readNotification(notifyPath, false))
		defer fbo.config.Reporter().Notify(ctx,
			readNotification(notifyPath, true))
	}

	// Unlock the blockLock while we wait for the network, only if
	// it's locked for reading.  If it's locked for writing, that
	// indicates we are performing an atomic write operation, and we
	// need to ensure that nothing else comes in and modifies the
	// blocks, so don't unlock.
	var err error
	fbo.blockLock.DoRUnlockedIfPossible(lState, func(*lockState) {
		err = bops.Get(ctx, kmd, ptr, block)
	})
	if err != nil {
		return nil, err
	}

	if doCache {
		if err := fbo.config.BlockCache().Put(ptr, fbo.id(), block,
			TransientEntry); err != nil {
			return nil, err
		}
	}
	return block, nil
}

// getFileBlockHelperLocked retrieves the block pointed to by ptr,
// which must be valid, either from an internal cache, the block
// cache, or from the server. An error is returned if the retrieved
// block is not a file block.
//
// This must be called only by GetFileBlockForReading(),
// getFileBlockLocked(), and getFileLocked().
//
// p is used only when reporting errors and sending read
// notifications, and can be empty.
func (fbo *folderBlockOps) getFileBlockHelperLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, ptr BlockPointer,
	branch BranchName, p path) (
	*FileBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	block, err := fbo.getBlockHelperLocked(
		ctx, lState, kmd, ptr, branch, NewFileBlock, true, p)
	if err != nil {
		return nil, err
	}

	fblock, ok := block.(*FileBlock)
	if !ok {
		return nil, NotFileBlockError{ptr, branch, p}
	}

	return fblock, nil
}

// GetBlockForReading retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server.  The
// returned block may have a generic type (not DirBlock or FileBlock).
//
// This should be called for "internal" operations, like conflict
// resolution and state checking, which don't know what kind of block
// the pointer refers to.  The block will not be cached, if it wasn't
// in the cache already.
func (fbo *folderBlockOps) GetBlockForReading(ctx context.Context,
	lState *lockState, kmd KeyMetadata, ptr BlockPointer, branch BranchName) (
	Block, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getBlockHelperLocked(ctx, lState, kmd, ptr, branch,
		NewCommonBlock, false, path{})
}

// getDirBlockHelperLocked retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server. An error
// is returned if the retrieved block is not a dir block.
//
// This must be called only by GetDirBlockForReading() and
// getDirLocked().
//
// p is used only when reporting errors, and can be empty.
func (fbo *folderBlockOps) getDirBlockHelperLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, ptr BlockPointer,
	branch BranchName, p path) (*DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// Pass in an empty notify path because notifications should only
	// trigger for file reads.
	block, err := fbo.getBlockHelperLocked(
		ctx, lState, kmd, ptr, branch, NewDirBlock, true, path{})
	if err != nil {
		return nil, err
	}

	dblock, ok := block.(*DirBlock)
	if !ok {
		return nil, NotDirBlockError{ptr, branch, p}
	}

	return dblock, nil
}

// GetFileBlockForReading retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server. An error
// is returned if the retrieved block is not a file block.
//
// This should be called for "internal" operations, like conflict
// resolution and state checking. "Real" operations should use
// getFileBlockLocked() and getFileLocked() instead.
//
// p is used only when reporting errors, and can be empty.
func (fbo *folderBlockOps) GetFileBlockForReading(ctx context.Context,
	lState *lockState, kmd KeyMetadata, ptr BlockPointer,
	branch BranchName, p path) (*FileBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getFileBlockHelperLocked(ctx, lState, kmd, ptr, branch, p)
}

// GetDirBlockForReading retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server. An error
// is returned if the retrieved block is not a dir block.
//
// This should be called for "internal" operations, like conflict
// resolution and state checking. "Real" operations should use
// getDirLocked() instead.
//
// p is used only when reporting errors, and can be empty.
func (fbo *folderBlockOps) GetDirBlockForReading(ctx context.Context,
	lState *lockState, kmd KeyMetadata, ptr BlockPointer,
	branch BranchName, p path) (*DirBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirBlockHelperLocked(ctx, lState, kmd, ptr, branch, p)
}

// getFileBlockLocked retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server. An error
// is returned if the retrieved block is not a file block.
//
// The given path must be valid, and the given pointer must be its
// tail pointer or an indirect pointer from it. A read notification is
// triggered for the given path only if the block isn't in the cache.
//
// This shouldn't be called for "internal" operations, like conflict
// resolution and state checking -- use GetFileBlockForReading() for
// those instead.
//
// When rtype == blockWrite and the cached version of the block is
// currently clean, or the block is currently being synced, this
// method makes a copy of the file block and returns it.  If this
// method might be called again for the same block within a single
// operation, it is the caller's responsibility to write that block
// back to the cache as dirty.
//
// Note that blockLock must be locked exactly when rtype ==
// blockWrite, and must be r-locked otherwise.  (This differs from
// getDirLocked.)  This is because a write operation (like write,
// truncate and sync which lock blockLock) fetching a file block will
// almost always need to modify that block, and so will pass in
// blockWrite.
func (fbo *folderBlockOps) getFileBlockLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, ptr BlockPointer,
	file path, rtype blockReqType) (*FileBlock, error) {
	if rtype == blockRead {
		fbo.blockLock.AssertRLocked(lState)
	} else {
		fbo.blockLock.AssertLocked(lState)
	}

	// Callers should have already done this check, but it doesn't
	// hurt to do it again.
	if !file.isValid() {
		return nil, InvalidPathError{file}
	}

	fblock, err := fbo.getFileBlockHelperLocked(
		ctx, lState, kmd, ptr, file.Branch, file)
	if err != nil {
		return nil, err
	}

	if rtype == blockWrite {
		// Copy the block if it's for writing, and either the
		// block is not yet dirty or the block is currently
		// being sync'd and needs a copy even though it's
		// already dirty.
		df := fbo.dirtyFiles[file.tailPointer()]
		if !fbo.config.DirtyBlockCache().IsDirty(fbo.id(), ptr, file.Branch) ||
			(df != nil && df.blockNeedsCopy(ptr)) {
			fblock, err = fblock.DeepCopy(fbo.config.Codec())
			if err != nil {
				return nil, err
			}
		}
	}
	return fblock, nil
}

// getFileLocked is getFileBlockLocked called with file.tailPointer().
func (fbo *folderBlockOps) getFileLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, file path,
	rtype blockReqType) (*FileBlock, error) {
	return fbo.getFileBlockLocked(
		ctx, lState, kmd, file.tailPointer(), file, rtype)
}

// GetIndirectFileBlockInfos returns a list of BlockInfos for all
// indirect blocks of the given file. If the returned error is a
// recoverable one (as determined by
// isRecoverableBlockErrorForRemoval), the returned list may still be
// non-empty, and holds all the BlockInfos for all found indirect
// blocks. (This will be relevant when we handle multiple levels of
// indirection.)
func (fbo *folderBlockOps) GetIndirectFileBlockInfos(ctx context.Context,
	lState *lockState, kmd KeyMetadata, file path) ([]BlockInfo, error) {
	// TODO: handle multiple levels of indirection.
	fBlock, err := func() (*FileBlock, error) {
		fbo.blockLock.RLock(lState)
		defer fbo.blockLock.RUnlock(lState)
		return fbo.getFileBlockLocked(
			ctx, lState, kmd, file.tailPointer(), file, blockRead)
	}()
	if err != nil {
		return nil, err
	}
	if !fBlock.IsInd {
		return nil, nil
	}
	blockInfos := make([]BlockInfo, len(fBlock.IPtrs))
	for i, ptr := range fBlock.IPtrs {
		blockInfos[i] = ptr.BlockInfo
	}
	return blockInfos, nil
}

// getDirLocked retrieves the block pointed to by the tail pointer of
// the given path, which must be valid, either from the cache or from
// the server. An error is returned if the retrieved block is not a
// dir block.
//
// This shouldn't be called for "internal" operations, like conflict
// resolution and state checking -- use GetDirBlockForReading() for
// those instead.
//
// When rtype == blockWrite and the cached version of the block is
// currently clean, this method makes a copy of the directory block
// and returns it.  If this method might be called again for the same
// block within a single operation, it is the caller's responsibility
// to write that block back to the cache as dirty.
//
// Note that blockLock must be either r-locked or locked, but
// independently of rtype. (This differs from getFileLocked and
// getFileBlockLocked.) File write operations (which lock blockLock)
// don't need a copy of parent dir blocks, and non-file write
// operations do need to copy dir blocks for modifications.
func (fbo *folderBlockOps) getDirLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, dir path, rtype blockReqType) (
	*DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// Callers should have already done this check, but it doesn't
	// hurt to do it again.
	if !dir.isValid() {
		return nil, InvalidPathError{dir}
	}

	// Get the block for the last element in the path.
	dblock, err := fbo.getDirBlockHelperLocked(
		ctx, lState, kmd, dir.tailPointer(), dir.Branch, dir)
	if err != nil {
		return nil, err
	}

	if rtype == blockWrite && !fbo.config.DirtyBlockCache().IsDirty(
		fbo.id(), dir.tailPointer(), dir.Branch) {
		// Copy the block if it's for writing and the block is
		// not yet dirty.
		dblock, err = dblock.DeepCopy(fbo.config.Codec())
		if err != nil {
			return nil, err
		}
	}
	return dblock, nil
}

// GetDir retrieves the block pointed to by the tail pointer of the
// given path, which must be valid, either from the cache or from the
// server. An error is returned if the retrieved block is not a dir
// block.
//
// This shouldn't be called for "internal" operations, like conflict
// resolution and state checking -- use GetDirBlockForReading() for
// those instead.
//
// When rtype == blockWrite and the cached version of the block is
// currently clean, this method makes a copy of the directory block
// and returns it.  If this method might be called again for the same
// block within a single operation, it is the caller's responsibility
// to write that block back to the cache as dirty.
func (fbo *folderBlockOps) GetDir(
	ctx context.Context, lState *lockState, kmd KeyMetadata, dir path,
	rtype blockReqType) (*DirBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirLocked(ctx, lState, kmd, dir, rtype)
}

func (fbo *folderBlockOps) getFileBlockAtOffsetLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, file path, topBlock *FileBlock,
	off int64, rtype blockReqType) (
	ptr BlockPointer, parentBlock *FileBlock, indexInParent int,
	block *FileBlock, nextBlockStartOff, startOff int64, err error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// find the block matching the offset, if it exists
	ptr = file.tailPointer()
	block = topBlock
	nextBlockStartOff = -1
	startOff = 0
	// search until it's not an indirect block
	for block.IsInd {
		nextIndex := len(block.IPtrs) - 1
		for i, ptr := range block.IPtrs {
			if ptr.Off == off {
				// small optimization to avoid iterating past the right ptr
				nextIndex = i
				break
			} else if ptr.Off > off {
				// i can never be 0, because the first ptr always has
				// an offset at the beginning of the range
				nextIndex = i - 1
				break
			}
		}
		nextPtr := block.IPtrs[nextIndex]
		parentBlock = block
		indexInParent = nextIndex
		startOff = nextPtr.Off
		// there is more to read if we ever took a path through a
		// ptr that wasn't the final ptr in its respective list
		if nextIndex != len(block.IPtrs)-1 {
			nextBlockStartOff = block.IPtrs[nextIndex+1].Off
		}
		ptr = nextPtr.BlockPointer
		if block, err = fbo.getFileBlockLocked(ctx, lState, kmd, ptr, file, rtype); err != nil {
			return
		}
	}

	return
}

// updateWithDirtyEntriesLocked checks if the given DirBlock has any
// entries that are in deCache (i.e., entries pointing to dirty
// files). If so, it makes a copy with all such entries replaced with
// the ones in deCache and returns it. If not, it just returns the
// given one.
func (fbo *folderBlockOps) updateWithDirtyEntriesLocked(ctx context.Context,
	lState *lockState, block *DirBlock) (*DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)
	// see if this directory has any outstanding writes/truncates that
	// require an updated DirEntry

	// Save some time for the common case of having no dirty
	// files.
	if len(fbo.deCache) == 0 {
		return block, nil
	}

	var dblockCopy *DirBlock
	for k, v := range block.Children {
		de, ok := fbo.deCache[v.Ref()]
		if !ok {
			continue
		}

		if dblockCopy == nil {
			var err error
			dblockCopy, err = block.DeepCopy(fbo.config.Codec())
			if err != nil {
				return nil, err
			}
		}

		dblockCopy.Children[k] = de
	}

	if dblockCopy == nil {
		return block, nil
	}

	return dblockCopy, nil
}

// getDirtyDirLocked composes getDirLocked and
// updatedWithDirtyEntriesLocked. Note that a dirty dir means that it
// has entries possibly pointing to dirty files, not that it's dirty
// itself.
func (fbo *folderBlockOps) getDirtyDirLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, dir path, rtype blockReqType) (
	*DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	dblock, err := fbo.getDirLocked(ctx, lState, kmd, dir, rtype)
	if err != nil {
		return nil, err
	}

	return fbo.updateWithDirtyEntriesLocked(ctx, lState, dblock)
}

// GetDirtyDirChildren returns a map of EntryInfos for the (possibly
// dirty) children entries of the given directory.
func (fbo *folderBlockOps) GetDirtyDirChildren(
	ctx context.Context, lState *lockState, kmd KeyMetadata, dir path) (
	map[string]EntryInfo, error) {
	dblock, err := func() (*DirBlock, error) {
		fbo.blockLock.RLock(lState)
		defer fbo.blockLock.RUnlock(lState)
		dblock, err := fbo.getDirtyDirLocked(
			ctx, lState, kmd, dir, blockRead)
		if err != nil {
			return nil, err
		}
		return dblock, nil
	}()
	if err != nil {
		return nil, err
	}

	children := make(map[string]EntryInfo)
	for k, de := range dblock.Children {
		children[k] = de.EntryInfo
	}
	return children, nil
}

// file must have a valid parent.
func (fbo *folderBlockOps) getDirtyParentAndEntryLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, file path, rtype blockReqType) (
	*DirBlock, DirEntry, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	if !file.hasValidParent() {
		return nil, DirEntry{}, InvalidParentPathError{file}
	}

	parentPath := file.parentPath()
	dblock, err := fbo.getDirtyDirLocked(
		ctx, lState, kmd, *parentPath, rtype)
	if err != nil {
		return nil, DirEntry{}, err
	}

	// make sure it exists
	name := file.tailName()
	de, ok := dblock.Children[name]
	if !ok {
		return nil, DirEntry{}, NoSuchNameError{name}
	}

	return dblock, de, err
}

// GetDirtyParentAndEntry returns a copy of the parent DirBlock
// (suitable for modification) of the given file, which may contain
// entries pointing to other dirty files, and its possibly-dirty
// DirEntry in that directory. file must have a valid parent. Use
// GetDirtyEntry() if you only need the DirEntry.
func (fbo *folderBlockOps) GetDirtyParentAndEntry(
	ctx context.Context, lState *lockState, kmd KeyMetadata, file path) (
	*DirBlock, DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirtyParentAndEntryLocked(
		ctx, lState, kmd, file, blockWrite)
}

// file must have a valid parent.
func (fbo *folderBlockOps) getDirtyEntryLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, file path) (DirEntry, error) {
	// TODO: Since we only need a single DirEntry, avoid having to
	// look up every entry in the DirBlock.
	_, de, err := fbo.getDirtyParentAndEntryLocked(
		ctx, lState, kmd, file, blockRead)
	return de, err
}

// GetDirtyEntry returns the possibly-dirty DirEntry of the given file
// in its parent DirBlock. file must have a valid parent.
func (fbo *folderBlockOps) GetDirtyEntry(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	file path) (DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirtyEntryLocked(ctx, lState, kmd, file)
}

func (fbo *folderBlockOps) getOrCreateDirtyFileLocked(lState *lockState,
	file path) *dirtyFile {
	fbo.blockLock.AssertLocked(lState)
	ptr := file.tailPointer()
	df := fbo.dirtyFiles[ptr]
	if df == nil {
		df = newDirtyFile(file, fbo.config.DirtyBlockCache())
		fbo.dirtyFiles[ptr] = df
	}
	return df
}

// cacheBlockIfNotYetDirtyLocked puts a block into the cache, but only
// does so if the block isn't already marked as dirty in the cache.
// This is useful when operating on a dirty copy of a block that may
// already be in the cache.
func (fbo *folderBlockOps) cacheBlockIfNotYetDirtyLocked(
	lState *lockState, ptr BlockPointer, file path, block Block) error {
	fbo.blockLock.AssertLocked(lState)
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	needsCaching, isSyncing := df.setBlockDirty(ptr)

	if needsCaching {
		err := fbo.config.DirtyBlockCache().Put(fbo.id(), ptr, file.Branch,
			block)
		if err != nil {
			return err
		}
	}

	if isSyncing {
		fbo.doDeferWrite = true
	}
	return nil
}

func (fbo *folderBlockOps) newRightBlockLocked(
	ctx context.Context, lState *lockState, ptr BlockPointer,
	file path, pblock *FileBlock,
	off int64, kmd KeyMetadata) error {
	fbo.blockLock.AssertLocked(lState)

	newRID, err := fbo.config.Crypto().MakeTemporaryBlockID()
	if err != nil {
		return err
	}
	_, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}
	rblock := &FileBlock{}

	newPtr := BlockPointer{
		ID:      newRID,
		KeyGen:  kmd.LatestKeyGeneration(),
		DataVer: DefaultNewBlockDataVersion(fbo.config, false),
		BlockContext: BlockContext{
			Creator:  uid,
			RefNonce: ZeroBlockRefNonce,
		},
	}

	pblock.IPtrs = append(pblock.IPtrs, IndirectFilePtr{
		BlockInfo: BlockInfo{
			BlockPointer: newPtr,
			EncodedSize:  0,
		},
		Off: off,
	})

	if err = fbo.cacheBlockIfNotYetDirtyLocked(
		lState, newPtr, file, rblock); err != nil {
		return err
	}
	if err = fbo.cacheBlockIfNotYetDirtyLocked(
		lState, ptr, file, pblock); err != nil {
		return err
	}
	return nil
}

func (fbo *folderBlockOps) getOrCreateSyncInfoLocked(
	lState *lockState, de DirEntry) (*syncInfo, error) {
	fbo.blockLock.AssertLocked(lState)
	ref := de.Ref()
	si, ok := fbo.unrefCache[ref]
	if !ok {
		so, err := newSyncOp(de.BlockPointer)
		if err != nil {
			return nil, err
		}
		si = &syncInfo{
			oldInfo: de.BlockInfo,
			op:      so,
		}
		fbo.unrefCache[ref] = si
	}
	return si, nil
}

// GetDirtyRefs returns a list of references of all known dirty
// blocks.
func (fbo *folderBlockOps) GetDirtyRefs(lState *lockState) []BlockRef {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	var dirtyRefs []BlockRef
	for ref := range fbo.deCache {
		dirtyRefs = append(dirtyRefs, ref)
	}
	return dirtyRefs
}

// fixChildBlocksAfterRecoverableErrorLocked should be called when a sync
// failed with a recoverable block error on a multi-block file.  It
// makes sure that any outstanding dirty versions of the file are
// fixed up to reflect the fact that some of the indirect pointers now
// need to change.
func (fbo *folderBlockOps) fixChildBlocksAfterRecoverableErrorLocked(
	ctx context.Context, lState *lockState, file path,
	redirtyOnRecoverableError map[BlockPointer]BlockPointer) {
	fbo.blockLock.AssertLocked(lState)

	df := fbo.dirtyFiles[file.tailPointer()]
	if df != nil {
		// Un-orphan old blocks, since we are reverting back to the
		// previous state.
		for _, oldPtr := range redirtyOnRecoverableError {
			fbo.log.CDebugf(ctx, "Un-orphaning %v", oldPtr)
			df.setBlockOrphaned(oldPtr, false)
		}
	}
	if df == nil || !df.isBlockDirty(file.tailPointer()) ||
		!df.isBlockSyncing(file.tailPointer()) {
		return
	}

	dirtyBcache := fbo.config.DirtyBlockCache()
	topBlock, err := dirtyBcache.Get(fbo.id(), file.tailPointer(), fbo.branch())
	fblock, ok := topBlock.(*FileBlock)
	if err != nil || !ok {
		fbo.log.CWarningf(ctx, "Couldn't find dirtied "+
			"top-block for %v: %v", file.tailPointer(), err)
		return
	}

	// If a copy of the top indirect block was made, we need to
	// redirty all the sync'd blocks under their new IDs, so that
	// future syncs will know they failed.
	for newPtr, oldPtr := range redirtyOnRecoverableError {
		found := false
		for i, iptr := range fblock.IPtrs {
			if iptr.BlockPointer == newPtr {
				found = true
				fblock.IPtrs[i].EncodedSize = 0
			}
		}
		if !found {
			continue
		}

		fbo.log.CDebugf(ctx, "Re-dirtying %v (and deleting dirty block %v)",
			newPtr, oldPtr)
		// These blocks would have been permanent, so they're
		// definitely still in the cache.
		b, err := fbo.config.BlockCache().Get(newPtr)
		if err != nil {
			fbo.log.CWarningf(ctx, "Couldn't re-dirty %v: %v", newPtr, err)
			continue
		}
		if err = fbo.cacheBlockIfNotYetDirtyLocked(
			lState, newPtr, file, b); err != nil {
			fbo.log.CWarningf(ctx, "Couldn't re-dirty %v: %v", newPtr, err)
		}
		fbo.log.CDebugf(ctx, "Deleting dirty ptr %v after recoverable error",
			oldPtr)
		err = dirtyBcache.Delete(fbo.id(), oldPtr, fbo.branch())
		if err != nil {
			fbo.log.CDebugf(ctx, "Couldn't del-dirty %v: %v", oldPtr, err)
		}
	}
}

func (fbo *folderBlockOps) nowUnixNano() int64 {
	return fbo.config.Clock().Now().UnixNano()
}

// PrepRename prepares the given rename operation. It returns copies
// of the old and new parent block (which may be the same), what is to
// be the new DirEntry, and a local block cache. It also modifies md,
// which must be a copy.
func (fbo *folderBlockOps) PrepRename(
	ctx context.Context, lState *lockState, md *RootMetadata,
	oldParent path, oldName string, newParent path, newName string) (
	oldPBlock, newPBlock *DirBlock, newDe DirEntry, lbc localBcache,
	err error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	// look up in the old path
	oldPBlock, err = fbo.getDirLocked(
		ctx, lState, md, oldParent, blockWrite)
	if err != nil {
		return nil, nil, DirEntry{}, nil, err
	}
	newDe, ok := oldPBlock.Children[oldName]
	// does the name exist?
	if !ok {
		return nil, nil, DirEntry{}, nil, NoSuchNameError{oldName}
	}

	ro, err := newRenameOp(oldName, oldParent.tailPointer(), newName,
		newParent.tailPointer(), newDe.BlockPointer, newDe.Type)
	if err != nil {
		return nil, nil, DirEntry{}, nil, err
	}
	md.AddOp(ro)

	lbc = make(localBcache)
	// TODO: Write a SameBlock() function that can deal properly with
	// dedup'd blocks that share an ID but can be updated separately.
	if oldParent.tailPointer().ID == newParent.tailPointer().ID {
		newPBlock = oldPBlock
	} else {
		newPBlock, err = fbo.getDirLocked(
			ctx, lState, md, newParent, blockWrite)
		if err != nil {
			return nil, nil, DirEntry{}, nil, err
		}
		now := fbo.nowUnixNano()

		oldGrandparent := *oldParent.parentPath()
		if len(oldGrandparent.path) > 0 {
			// Update the old parent's mtime/ctime, unless the
			// oldGrandparent is the same as newParent (in which
			// case, the syncBlockAndCheckEmbedLocked call by the
			// caller will take care of it).
			if oldGrandparent.tailPointer().ID != newParent.tailPointer().ID {
				b, err := fbo.getDirLocked(ctx, lState, md, oldGrandparent, blockWrite)
				if err != nil {
					return nil, nil, DirEntry{}, nil, err
				}
				if de, ok := b.Children[oldParent.tailName()]; ok {
					de.Ctime = now
					de.Mtime = now
					b.Children[oldParent.tailName()] = de
					// Put this block back into the local cache as dirty
					lbc[oldGrandparent.tailPointer()] = b
				}
			}
		} else {
			md.data.Dir.Ctime = now
			md.data.Dir.Mtime = now
		}
	}
	return oldPBlock, newPBlock, newDe, lbc, nil
}

// The amount that the read timeout is smaller than the global one.
const readTimeoutSmallerBy = 2 * time.Second

// Read reads from the given file into the given buffer at the given
// offset. It returns the number of bytes read and nil, or 0 and the
// error if there was one.
func (fbo *folderBlockOps) Read(
	ctx context.Context, lState *lockState, kmd KeyMetadata, file path,
	dest []byte, off int64) (int64, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	// getFileLocked already checks read permissions
	fblock, err := fbo.getFileLocked(ctx, lState, kmd, file, blockRead)
	if err != nil {
		return 0, err
	}

	// If we have a large enough timeout add a temporary timeout that is
	// readTimeoutSmallerBy. Use that for reading so short reads get returned
	// upstream without triggering the global timeout.
	now := time.Now()
	deadline, haveTimeout := ctx.Deadline()
	if haveTimeout {
		rem := deadline.Sub(now) - readTimeoutSmallerBy
		if rem > 0 {
			var cancel func()
			ctx, cancel = context.WithTimeout(ctx, rem)
			defer cancel()
		}
	}

	nRead := int64(0)
	n := int64(len(dest))

	for nRead < n {
		nextByte := nRead + off
		toRead := n - nRead
		_, _, _, block, nextBlockOff, startOff, err := fbo.getFileBlockAtOffsetLocked(
			ctx, lState, kmd, file, fblock, nextByte, blockRead)
		if err != nil {
			// If we hit a timeout while reading then return the bytes already read
			// and no error. If the upstream tries to do something blocking they
			// will encounter the error with the context again. Only do this
			// if we have already read some bytes to avoid pathological cases
			// causing a reader looping.
			if err == context.DeadlineExceeded && nRead > 0 {
				fbo.log.CDebugf(ctx, "Read short: read %d bytes of %d\n", nRead, n)
				return nRead, nil
			}
			return 0, err
		}
		blockLen := int64(len(block.Contents))
		lastByteInBlock := startOff + blockLen

		if nextByte >= lastByteInBlock {
			if nextBlockOff > 0 {
				fill := nextBlockOff - nextByte
				if fill > toRead {
					fill = toRead
				}
				fbo.log.CDebugf(ctx, "Read from hole: nextByte=%d lastByteInBlock=%d fill=%d\n", nextByte, lastByteInBlock, fill)
				if fill <= 0 {
					fbo.log.CErrorf(ctx, "Read invalid file fill <= 0 while reading hole")
					return nRead, BadSplitError{}
				}
				for i := 0; i < int(fill); i++ {
					dest[int(nRead)+i] = 0
				}
				nRead += fill
				continue
			}
			return nRead, nil
		} else if toRead > lastByteInBlock-nextByte {
			toRead = lastByteInBlock - nextByte
		}

		firstByteToRead := nextByte - startOff
		copy(dest[nRead:nRead+toRead],
			block.Contents[firstByteToRead:toRead+firstByteToRead])
		nRead += toRead
	}

	return n, nil
}

func (fbo *folderBlockOps) maybeWaitOnDeferredWrites(
	ctx context.Context, lState *lockState, file Node,
	c DirtyPermChan) error {
	var errListener chan error
	err := func() error {
		fbo.blockLock.Lock(lState)
		defer fbo.blockLock.Unlock(lState)
		filePath, err := fbo.pathFromNodeForBlockWriteLocked(lState, file)
		if err != nil {
			return err
		}
		df := fbo.getOrCreateDirtyFileLocked(lState, filePath)
		errListener = make(chan error, 1)
		df.addErrListener(errListener)
		return nil
	}()
	if err != nil {
		return err
	}

	logTimer := time.After(100 * time.Millisecond)
	doLogUnblocked := false
	for {
		select {
		case <-c:
			if doLogUnblocked {
				fbo.log.CDebugf(ctx, "Write unblocked")
			}
			// Make sure there aren't any queued errors.
			select {
			case err := <-errListener:
				return err
			default:
			}
			return nil
		case <-logTimer:
			// Print a log message once if it's taking too long.
			fbo.log.CDebugf(ctx,
				"Blocking a write because of a full dirty buffer")
			doLogUnblocked = true
		case err := <-errListener:
			// XXX: should we ignore non-fatal errors (like
			// context.Canceled), or errors that are specific only to
			// some other file being sync'd (e.g., "recoverable" block
			// errors from which we couldn't recover)?
			return err
		}
	}
}

func (fbo *folderBlockOps) pathFromNodeForBlockWriteLocked(
	lState *lockState, n Node) (path, error) {
	fbo.blockLock.AssertLocked(lState)
	p := fbo.nodeCache.PathFromNode(n)
	if !p.isValid() {
		return path{}, InvalidPathError{p}
	}
	return p, nil
}

// writeGetFileLocked checks write permissions explicitly for
// writeDataLocked, truncateLocked etc and returns
func (fbo *folderBlockOps) writeGetFileLocked(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	file path) (*FileBlock, keybase1.UID, error) {
	fbo.blockLock.AssertLocked(lState)

	username, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, "", err
	}
	if !kmd.GetTlfHandle().IsWriter(uid) {
		return nil, "", NewWriteAccessError(kmd.GetTlfHandle(), username, file.String())
	}
	fblock, err := fbo.getFileLocked(ctx, lState, kmd, file, blockWrite)
	if err != nil {
		return nil, "", err
	}
	return fblock, uid, nil
}

// createIndirectBlockLocked creates a new indirect block and
// pick a new id for the existing block, and use the existing block's ID for
// the new indirect block that becomes the parent.
func (fbo *folderBlockOps) createIndirectBlockLocked(lState *lockState,
	kmd KeyMetadata, file path, uid keybase1.UID, dver DataVer) (
	*FileBlock, error) {

	newID, err := fbo.config.Crypto().MakeTemporaryBlockID()
	if err != nil {
		return nil, err
	}
	fblock := &FileBlock{
		CommonBlock: CommonBlock{
			IsInd: true,
		},
		IPtrs: []IndirectFilePtr{
			{
				BlockInfo: BlockInfo{
					BlockPointer: BlockPointer{
						ID:      newID,
						KeyGen:  kmd.LatestKeyGeneration(),
						DataVer: dver,
						BlockContext: BlockContext{
							Creator:  uid,
							RefNonce: ZeroBlockRefNonce,
						},
					},
					EncodedSize: 0,
				},
				Off: 0,
			},
		},
	}

	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	// Mark the old block ID as not dirty, so that we will treat the
	// old block ID as newly dirtied in cacheBlockIfNotYetDirtyLocked.
	df.setBlockNotDirty(file.tailPointer())
	err = fbo.cacheBlockIfNotYetDirtyLocked(lState, file.tailPointer(), file,
		fblock)
	if err != nil {
		return nil, err
	}
	return fblock, nil
}

// Returns the set of blocks dirtied during this write that might need
// to be cleaned up if the write is deferred.
func (fbo *folderBlockOps) writeDataLocked(
	ctx context.Context, lState *lockState, kmd KeyMetadata, file path,
	data []byte, off int64) (latestWrite WriteRange, dirtyPtrs []BlockPointer,
	newlyDirtiedChildBytes int64, err error) {
	if jServer, err := GetJournalServer(fbo.config); err == nil {
		jServer.dirtyOpStart(fbo.id())
		defer jServer.dirtyOpEnd(fbo.id())
	}

	fbo.blockLock.AssertLocked(lState)
	fbo.log.CDebugf(ctx, "writeDataLocked on file pointer %v",
		file.tailPointer())
	defer func() {
		fbo.log.CDebugf(ctx, "writeDataLocked done: %v", err)
	}()

	if sz := off + int64(len(data)); uint64(sz) > fbo.config.MaxFileBytes() {
		return WriteRange{}, nil, 0,
			FileTooBigError{file, sz, fbo.config.MaxFileBytes()}
	}

	fblock, uid, err := fbo.writeGetFileLocked(ctx, lState, kmd, file)
	if err != nil {
		return WriteRange{}, nil, 0, err
	}

	dirtyBcache := fbo.config.DirtyBlockCache()
	bsplit := fbo.config.BlockSplitter()
	n := int64(len(data))
	nCopied := int64(0)
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	defer func() {
		// Always update unsynced bytes and potentially force a sync,
		// even on an error, since the previously-dirty bytes stay in
		// the cache.
		df.updateNotYetSyncingBytes(newlyDirtiedChildBytes)
		if dirtyBcache.ShouldForceSync(fbo.id()) {
			select {
			// If we can't send on the channel, that means a sync is
			// already in progress.
			case fbo.forceSyncChan <- struct{}{}:
				fbo.log.CDebugf(ctx, "Forcing a sync due to full buffer")
			default:
			}
		}
	}()

	de, err := fbo.getDirtyEntryLocked(ctx, lState, kmd, file)
	if err != nil {
		return WriteRange{}, nil, 0, err
	}
	if de.BlockPointer != file.tailPointer() {
		fbo.log.CDebugf(ctx, "DirEntry and file tail pointer don't match: "+
			"%v vs %v", de.BlockPointer, file.tailPointer())
	}
	oldSizeWithoutHoles := de.Size

	si, err := fbo.getOrCreateSyncInfoLocked(lState, de)
	if err != nil {
		return WriteRange{}, nil, 0, err
	}
	for nCopied < n {
		ptr, parentBlock, indexInParent, block, nextBlockOff, startOff, err :=
			fbo.getFileBlockAtOffsetLocked(
				ctx, lState, kmd, file, fblock,
				off+nCopied, blockWrite)
		if err != nil {
			return WriteRange{}, nil, newlyDirtiedChildBytes, err
		}

		oldLen := len(block.Contents)
		wasDirty := dirtyBcache.IsDirty(fbo.id(), ptr, file.Branch)

		// Take care not to write past the beginning of the next block
		// by using max.
		max := len(data)
		if nextBlockOff > 0 {
			if room := int(nextBlockOff - off); room < max {
				max = room
			}
		}
		oldNCopied := nCopied
		nCopied += bsplit.CopyUntilSplit(block, nextBlockOff < 0, data[nCopied:max],
			off+nCopied-startOff)

		// TODO: support multiple levels of indirection.  Right now the
		// code only does one but it should be straightforward to
		// generalize, just annoying

		// if we need another block but there are no more, then make one
		switchToIndirect := false
		if nCopied < n && nextBlockOff < 0 {
			// If the block doesn't already have a parent block, make one.
			if ptr == file.tailPointer() {
				fblock, err = fbo.createIndirectBlockLocked(lState, kmd, file,
					uid, DefaultNewBlockDataVersion(fbo.config, false))
				if err != nil {
					return WriteRange{}, nil, newlyDirtiedChildBytes, err
				}
				ptr = fblock.IPtrs[0].BlockPointer
				// The whole block needs to be re-uploaded as an
				// indirect block, so track those dirty bytes and
				// cache the block as dirty.
				switchToIndirect = true
			}

			// Make a new right block and update the parent's
			// indirect block list
			err = fbo.newRightBlockLocked(ctx, lState, file.tailPointer(),
				file, fblock, startOff+int64(len(block.Contents)), kmd)
			if err != nil {
				return WriteRange{}, nil, newlyDirtiedChildBytes, err
			}
		} else if nCopied < n && off+nCopied < nextBlockOff {
			// We need a new block to be inserted here
			err = fbo.newRightBlockLocked(ctx, lState, file.tailPointer(),
				file, fblock, startOff+int64(len(block.Contents)), kmd)
			if err != nil {
				return WriteRange{}, nil, newlyDirtiedChildBytes, err
			}
			// And push the indirect pointers to right
			newb := fblock.IPtrs[len(fblock.IPtrs)-1]
			copy(fblock.IPtrs[indexInParent+2:], fblock.IPtrs[indexInParent+1:])
			fblock.IPtrs[indexInParent+1] = newb
			if oldSizeWithoutHoles == de.Size {
				// For the purposes of calculating the newly-dirtied
				// bytes for the deferral calculation, disregard the
				// existing "hole" in the file.
				oldSizeWithoutHoles = uint64(newb.Off)
			}
		}

		// Nothing was copied, no need to dirty anything.  This can
		// happen when trying to append to the contents of the file
		// (i.e., either to the end of the file or right before the
		// "hole"), and the last block is already full.
		if nCopied == oldNCopied && !switchToIndirect {
			continue
		}

		// Only in the last block does the file size grow.
		if oldLen != len(block.Contents) && nextBlockOff < 0 {
			de.EncodedSize = 0
			// update the file info
			de.Size += uint64(len(block.Contents) - oldLen)
		}
		// Put it in the `deCache` even if the size didn't change,
		// since the `deCache` is used to determine whether there are
		// any dirty files.  TODO: combine `deCache` with `dirtyFiles`
		// and `unrefCache`.
		fbo.deCache[file.tailPointer().Ref()] = de

		// Calculate the amount of bytes we've newly-dirtied as part
		// of this write.
		newlyDirtiedChildBytes += int64(len(block.Contents))
		if wasDirty {
			newlyDirtiedChildBytes -= int64(oldLen)
		}

		if parentBlock != nil {
			// remember how many bytes it was
			si.unrefs = append(si.unrefs,
				parentBlock.IPtrs[indexInParent].BlockInfo)
			parentBlock.IPtrs[indexInParent].EncodedSize = 0
		}

		// keep the old block ID while it's dirty
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState, ptr, file,
			block); err != nil {
			return WriteRange{}, nil, newlyDirtiedChildBytes, err
		}
		dirtyPtrs = append(dirtyPtrs, ptr)
	}

	if fblock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any write to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the dirtyFiles map.
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
			file.tailPointer(), file, fblock); err != nil {
			return WriteRange{}, nil, newlyDirtiedChildBytes, err
		}
		dirtyPtrs = append(dirtyPtrs, file.tailPointer())

		lastByteWritten := off + int64(len(data)) // not counting holes
		if fbo.doDeferWrite && lastByteWritten > int64(oldSizeWithoutHoles) {
			df.addDeferredNewBytes(lastByteWritten - int64(oldSizeWithoutHoles))
		}
	}
	latestWrite = si.op.addWrite(uint64(off), uint64(len(data)))

	return latestWrite, dirtyPtrs, newlyDirtiedChildBytes, nil
}

// Write writes the given data to the given file. May block if there
// is too much unflushed data; in that case, it will be unblocked by a
// future sync.
func (fbo *folderBlockOps) Write(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	file Node, data []byte, off int64) error {
	// If there is too much unflushed data, we should wait until some
	// of it gets flush so our memory usage doesn't grow without
	// bound.
	c, err := fbo.config.DirtyBlockCache().RequestPermissionToDirty(ctx,
		fbo.id(), int64(len(data)))
	if err != nil {
		return err
	}
	defer fbo.config.DirtyBlockCache().UpdateUnsyncedBytes(fbo.id(),
		-int64(len(data)), false)
	err = fbo.maybeWaitOnDeferredWrites(ctx, lState, file, c)
	if err != nil {
		return err
	}

	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	filePath, err := fbo.pathFromNodeForBlockWriteLocked(lState, file)
	if err != nil {
		return err
	}

	defer func() {
		fbo.doDeferWrite = false
	}()

	latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err := fbo.writeDataLocked(
		ctx, lState, kmd, filePath, data, off)
	if err != nil {
		return err
	}

	fbo.observers.localChange(ctx, file, latestWrite)

	if fbo.doDeferWrite {
		// There's an ongoing sync, and this write altered dirty
		// blocks that are in the process of syncing.  So, we have to
		// redo this write once the sync is complete, using the new
		// file path.
		//
		// There is probably a less terrible of doing this that
		// doesn't involve so much copying and rewriting, but this is
		// the most obviously correct way.
		dataCopy := make([]byte, len(data))
		copy(dataCopy, data)
		fbo.log.CDebugf(ctx, "Deferring a write to file %v off=%d len=%d",
			filePath.tailPointer(), off, len(data))
		fbo.deferredDirtyDeletes = append(fbo.deferredDirtyDeletes,
			dirtyPtrs...)
		fbo.deferredWrites = append(fbo.deferredWrites,
			func(ctx context.Context, lState *lockState, kmd KeyMetadata, f path) error {
				// We are about to re-dirty these bytes, so mark that
				// they will no longer be synced via the old file.
				df := fbo.getOrCreateDirtyFileLocked(lState, filePath)
				df.updateNotYetSyncingBytes(-newlyDirtiedChildBytes)

				// Write the data again.  We know this won't be
				// deferred, so no need to check the new ptrs.
				_, _, _, err = fbo.writeDataLocked(
					ctx, lState, kmd, f, dataCopy, off)
				return err
			})
		fbo.deferredWaitBytes += newlyDirtiedChildBytes
	}

	return nil
}

// truncateExtendLocked is called by truncateLocked to extend a file and
// creates a hole.
func (fbo *folderBlockOps) truncateExtendLocked(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	file path, size uint64) (WriteRange, []BlockPointer, error) {

	if size > fbo.config.MaxFileBytes() {
		return WriteRange{}, nil, FileTooBigError{file, int64(size), fbo.config.MaxFileBytes()}
	}

	fblock, uid, err := fbo.writeGetFileLocked(ctx, lState, kmd, file)
	if err != nil {
		return WriteRange{}, nil, err
	}

	var dirtyPtrs []BlockPointer

	fbo.log.CDebugf(ctx, "truncateExtendLocked: extending fblock %#v", fblock)
	if !fblock.IsInd {
		fbo.log.CDebugf(ctx, "truncateExtendLocked: making block indirect %v", file.tailPointer())
		old := fblock
		fblock, err = fbo.createIndirectBlockLocked(lState, kmd, file, uid,
			DefaultNewBlockDataVersion(fbo.config, true))
		if err != nil {
			return WriteRange{}, nil, err
		}
		fblock.IPtrs[0].Holes = true
		err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
			fblock.IPtrs[0].BlockPointer, file, old)
		if err != nil {
			return WriteRange{}, nil, err
		}
		dirtyPtrs = append(dirtyPtrs, fblock.IPtrs[0].BlockPointer)
		fbo.log.CDebugf(ctx, "truncateExtendLocked: new zero data block %v", fblock.IPtrs[0].BlockPointer)
	}

	// TODO: support multiple levels of indirection.  Right now the
	// code only does one but it should be straightforward to
	// generalize, just annoying

	err = fbo.newRightBlockLocked(ctx, lState, file.tailPointer(),
		file, fblock, int64(size), kmd)
	if err != nil {
		return WriteRange{}, nil, err
	}
	dirtyPtrs = append(dirtyPtrs, fblock.IPtrs[len(fblock.IPtrs)-1].BlockPointer)
	fbo.log.CDebugf(ctx, "truncateExtendLocked: new right data block %v",
		fblock.IPtrs[len(fblock.IPtrs)-1].BlockPointer)

	de, err := fbo.getDirtyEntryLocked(ctx, lState, kmd, file)
	if err != nil {
		return WriteRange{}, nil, err
	}

	si, err := fbo.getOrCreateSyncInfoLocked(lState, de)
	if err != nil {
		return WriteRange{}, nil, err
	}

	de.EncodedSize = 0
	// update the file info
	de.Size = size
	fbo.deCache[file.tailPointer().Ref()] = de

	// Mark all for presense of holes, one would be enough,
	// but this is more robust and easy.
	for i := range fblock.IPtrs {
		fblock.IPtrs[i].Holes = true
	}
	// Always make the top block dirty, so we will sync its
	// indirect blocks.  This has the added benefit of ensuring
	// that any write to a file while it's being sync'd will be
	// deferred, even if it's to a block that's not currently
	// being sync'd, since this top-most block will always be in
	// the fileBlockStates map.
	err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
		file.tailPointer(), file, fblock)
	if err != nil {
		return WriteRange{}, nil, err
	}
	dirtyPtrs = append(dirtyPtrs, file.tailPointer())
	latestWrite := si.op.addTruncate(size)

	if fbo.config.DirtyBlockCache().ShouldForceSync(fbo.id()) {
		select {
		// If we can't send on the channel, that means a sync is
		// already in progress
		case fbo.forceSyncChan <- struct{}{}:
			fbo.log.CDebugf(ctx, "Forcing a sync due to full buffer")
		default:
		}
	}

	fbo.log.CDebugf(ctx, "truncateExtendLocked: done")
	return latestWrite, dirtyPtrs, nil
}

// truncateExtendCutoffPoint is the amount of data in extending
// truncate that will trigger the extending with a hole algorithm.
const truncateExtendCutoffPoint = 128 * 1024

// Returns the set of newly-ID'd blocks created during this truncate
// that might need to be cleaned up if the truncate is deferred.
func (fbo *folderBlockOps) truncateLocked(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	file path, size uint64) (*WriteRange, []BlockPointer, int64, error) {
	if jServer, err := GetJournalServer(fbo.config); err == nil {
		jServer.dirtyOpStart(fbo.id())
		defer jServer.dirtyOpEnd(fbo.id())
	}

	fblock, _, err := fbo.writeGetFileLocked(ctx, lState, kmd, file)
	if err != nil {
		return &WriteRange{}, nil, 0, err
	}

	// find the block where the file should now end
	iSize := int64(size) // TODO: deal with overflow
	ptr, parentBlock, indexInParent, block, nextBlockOff, startOff, err :=
		fbo.getFileBlockAtOffsetLocked(
			ctx, lState, kmd, file, fblock, iSize, blockWrite)
	if err != nil {
		return &WriteRange{}, nil, 0, err
	}

	currLen := int64(startOff) + int64(len(block.Contents))
	if currLen+truncateExtendCutoffPoint < iSize {
		latestWrite, dirtyPtrs, err := fbo.truncateExtendLocked(
			ctx, lState, kmd, file, uint64(iSize))
		if err != nil {
			return &latestWrite, dirtyPtrs, 0, err
		}
		return &latestWrite, dirtyPtrs, 0, err
	} else if currLen < iSize {
		moreNeeded := iSize - currLen
		latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err :=
			fbo.writeDataLocked(ctx, lState, kmd, file,
				make([]byte, moreNeeded, moreNeeded), currLen)
		if err != nil {
			return &latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err
		}
		return &latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err
	} else if currLen == iSize && nextBlockOff < 0 {
		// same size!
		return nil, nil, 0, nil
	}

	// update the local entry size
	de, err := fbo.getDirtyEntryLocked(ctx, lState, kmd, file)
	if err != nil {
		return nil, nil, 0, err
	}

	oldLen := len(block.Contents)
	dirtyBcache := fbo.config.DirtyBlockCache()
	wasDirty := dirtyBcache.IsDirty(fbo.id(), ptr, file.Branch)

	// otherwise, we need to delete some data (and possibly entire blocks)
	block.Contents = append([]byte(nil), block.Contents[:iSize-startOff]...)

	newlyDirtiedChildBytes := int64(len(block.Contents))
	if wasDirty {
		newlyDirtiedChildBytes -= int64(oldLen) // negative
	}
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	df.updateNotYetSyncingBytes(newlyDirtiedChildBytes)

	si, err := fbo.getOrCreateSyncInfoLocked(lState, de)
	if err != nil {
		return nil, nil, 0, err
	}
	if nextBlockOff > 0 {
		// TODO: if indexInParent == 0, we can remove the level of indirection
		for _, ptr := range parentBlock.IPtrs[indexInParent+1:] {
			si.unrefs = append(si.unrefs, ptr.BlockInfo)
		}
		parentBlock.IPtrs = parentBlock.IPtrs[:indexInParent+1]
		// always make the parent block dirty, so we will sync it
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
			file.tailPointer(), file, parentBlock); err != nil {
			return nil, nil, newlyDirtiedChildBytes, err
		}
	}

	if fblock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any truncate to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the dirtyFiles map.
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
			file.tailPointer(), file, fblock); err != nil {
			return nil, nil, newlyDirtiedChildBytes, err
		}
	}

	if parentBlock != nil {
		// TODO: When we implement more than one level of indirection,
		// make sure that the pointer to parentBlock in the grandparent block
		// has EncodedSize 0.
		si.unrefs = append(si.unrefs,
			parentBlock.IPtrs[indexInParent].BlockInfo)
		parentBlock.IPtrs[indexInParent].EncodedSize = 0
	}

	latestWrite := si.op.addTruncate(size)

	de.EncodedSize = 0
	de.Size = size
	fbo.deCache[file.tailPointer().Ref()] = de

	// Keep the old block ID while it's dirty.
	if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
		ptr, file, block); err != nil {
		return nil, nil, newlyDirtiedChildBytes, err
	}

	return &latestWrite, nil, newlyDirtiedChildBytes, nil
}

// Truncate truncates or extends the given file to the given size.
// May block if there is too much unflushed data; in that case, it
// will be unblocked by a future sync.
func (fbo *folderBlockOps) Truncate(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	file Node, size uint64) error {
	// If there is too much unflushed data, we should wait until some
	// of it gets flush so our memory usage doesn't grow without
	// bound.
	//
	// Assume the whole remaining file will be dirty after this
	// truncate.  TODO: try to figure out how many bytes actually will
	// be dirtied ahead of time?
	c, err := fbo.config.DirtyBlockCache().RequestPermissionToDirty(ctx,
		fbo.id(), int64(size))
	if err != nil {
		return err
	}
	defer fbo.config.DirtyBlockCache().UpdateUnsyncedBytes(fbo.id(),
		-int64(size), false)
	err = fbo.maybeWaitOnDeferredWrites(ctx, lState, file, c)
	if err != nil {
		return err
	}

	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	filePath, err := fbo.pathFromNodeForBlockWriteLocked(lState, file)
	if err != nil {
		return err
	}

	defer func() {
		fbo.doDeferWrite = false
	}()

	latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err := fbo.truncateLocked(
		ctx, lState, kmd, filePath, size)
	if err != nil {
		return err
	}

	if latestWrite != nil {
		fbo.observers.localChange(ctx, file, *latestWrite)
	}

	if fbo.doDeferWrite {
		// There's an ongoing sync, and this truncate altered
		// dirty blocks that are in the process of syncing.  So,
		// we have to redo this truncate once the sync is complete,
		// using the new file path.
		fbo.log.CDebugf(ctx, "Deferring a truncate to file %v",
			filePath.tailPointer())
		fbo.deferredDirtyDeletes = append(fbo.deferredDirtyDeletes,
			dirtyPtrs...)
		fbo.deferredWrites = append(fbo.deferredWrites,
			func(ctx context.Context, lState *lockState, kmd KeyMetadata, f path) error {
				// We are about to re-dirty these bytes, so mark that
				// they will no longer be synced via the old file.
				df := fbo.getOrCreateDirtyFileLocked(lState, filePath)
				df.updateNotYetSyncingBytes(-newlyDirtiedChildBytes)

				// Truncate the file again.  We know this won't be
				// deferred, so no need to check the new ptrs.
				_, _, _, err := fbo.truncateLocked(
					ctx, lState, kmd, f, size)
				return err
			})
		fbo.deferredWaitBytes += newlyDirtiedChildBytes
	}

	return nil
}

// IsDirty returns whether the given file is dirty; if false is
// returned, then the file doesn't need to be synced.
func (fbo *folderBlockOps) IsDirty(lState *lockState, file path) bool {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.config.DirtyBlockCache().IsDirty(
		fbo.id(), file.tailPointer(), file.Branch)
}

func (fbo *folderBlockOps) clearCacheInfoLocked(lState *lockState,
	file path) error {
	fbo.blockLock.AssertLocked(lState)
	ref := file.tailPointer().Ref()
	delete(fbo.deCache, ref)
	delete(fbo.unrefCache, ref)
	df := fbo.dirtyFiles[file.tailPointer()]
	if df != nil {
		err := df.finishSync()
		if err != nil {
			return err
		}
		delete(fbo.dirtyFiles, file.tailPointer())
	}
	return nil
}

// ClearCacheInfo removes any cached info for the the given file.
func (fbo *folderBlockOps) ClearCacheInfo(lState *lockState, file path) error {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	return fbo.clearCacheInfoLocked(lState, file)
}

// revertSyncInfoAfterRecoverableError updates the saved sync info to
// include all the blocks from before the error, except for those that
// have encountered recoverable block errors themselves.
func (fbo *folderBlockOps) revertSyncInfoAfterRecoverableError(
	blocksToRemove []BlockPointer, result fileSyncState) {
	si := result.si
	savedSi := result.savedSi

	// Save the blocks we need to clean up on the next attempt.
	toClean := si.toCleanIfUnused

	newIndirect := make(map[BlockPointer]bool)
	for _, ptr := range result.newIndirectFileBlockPtrs {
		newIndirect[ptr] = true
	}

	// Propagate all unrefs forward, except those that belong to new
	// blocks that were created during the sync.
	unrefs := make([]BlockInfo, 0, len(si.unrefs))
	for _, unref := range si.unrefs {
		if newIndirect[unref.BlockPointer] {
			fbo.log.CDebugf(nil, "Dropping unref %v", unref)
			continue
		}
		unrefs = append(unrefs, unref)
	}

	// This sync will be retried and needs new blocks, so
	// reset everything in the sync info.
	*si = *savedSi
	si.toCleanIfUnused = toClean
	si.unrefs = unrefs
	if si.bps == nil {
		return
	}

	si.bps.blockStates = nil

	// Mark any bad pointers so they get skipped next time.
	blocksToRemoveSet := make(map[BlockPointer]bool)
	for _, ptr := range blocksToRemove {
		blocksToRemoveSet[ptr] = true
	}

	for _, bs := range savedSi.bps.blockStates {
		// Only save the good pointers
		if !blocksToRemoveSet[bs.blockPtr] {
			si.bps.blockStates = append(si.bps.blockStates, bs)
		}
	}
}

// ReadyBlock is a thin wrapper around BlockOps.Ready() that handles
// checking for duplicates.
func (fbo *folderBlockOps) ReadyBlock(ctx context.Context, kmd KeyMetadata,
	block Block, uid keybase1.UID) (
	info BlockInfo, plainSize int, readyBlockData ReadyBlockData, err error) {
	var ptr BlockPointer
	if fBlock, ok := block.(*FileBlock); ok && !fBlock.IsInd {
		// first see if we are duplicating any known blocks in this folder
		ptr, err = fbo.config.BlockCache().CheckForKnownPtr(fbo.id(), fBlock)
		if err != nil {
			return
		}
	}

	// Ready the block, even in the case where we can reuse an
	// existing block, just so that we know what the size of the
	// encrypted data will be.
	id, plainSize, readyBlockData, err :=
		fbo.config.BlockOps().Ready(ctx, kmd, block)
	if err != nil {
		return
	}

	if ptr.IsInitialized() {
		ptr.RefNonce, err = fbo.config.Crypto().MakeBlockRefNonce()
		if err != nil {
			return
		}
		ptr.SetWriter(uid)
	} else {
		ptr = BlockPointer{
			ID:      id,
			KeyGen:  kmd.LatestKeyGeneration(),
			DataVer: block.DataVersion(),
			BlockContext: BlockContext{
				Creator:  uid,
				RefNonce: ZeroBlockRefNonce,
			},
		}
	}

	info = BlockInfo{
		BlockPointer: ptr,
		EncodedSize:  uint32(readyBlockData.GetEncodedSize()),
	}
	return
}

// fileSyncState holds state for a sync operation for a single
// file.
type fileSyncState struct {
	// If fblock is non-nil, the (dirty, indirect, cached) block
	// it points to will be set to savedFblock on a recoverable
	// error.
	fblock, savedFblock *FileBlock

	// redirtyOnRecoverableError, which is non-nil only when fblock is
	// non-nil, contains pointers that need to be re-dirtied if the
	// top block gets copied during the sync, and a recoverable error
	// happens.  Maps to the old block pointer for the block, which
	// would need a DirtyBlockCache.Delete.
	redirtyOnRecoverableError map[BlockPointer]BlockPointer

	// If si is non-nil, its updated state will be reset on
	// error. Also, if the error is recoverable, it will be
	// reverted to savedSi.
	//
	// TODO: Working with si in this way is racy, since si is a
	// member of unrefCache.
	si, savedSi *syncInfo

	// oldFileBlockPtrs is a list of transient entries in the
	// block cache for the file, which should be removed when the
	// sync finishes.
	oldFileBlockPtrs []BlockPointer

	// newIndirectFileBlockPtrs is a list of permanent entries
	// added to the block cache for the file, which should be
	// removed after the blocks have been sent to the server.
	// They are not removed on an error, because in that case the
	// file is still dirty locally and may get another chance to
	// be sync'd.
	//
	// TODO: This can be a list of IDs instead.
	newIndirectFileBlockPtrs []BlockPointer
}

// startSyncWrite contains the portion of StartSync() that's done
// while write-locking blockLock.  If there is no dirty de cache
// entry, dirtyDe will be nil.
func (fbo *folderBlockOps) startSyncWrite(ctx context.Context,
	lState *lockState, md *RootMetadata, uid keybase1.UID, file path) (
	fblock *FileBlock, bps *blockPutState, syncState fileSyncState,
	dirtyDe *DirEntry, err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	// update the parent directories, and write all the new blocks out
	// to disk
	fblock, err = fbo.getFileLocked(ctx, lState, md.ReadOnly(), file, blockWrite)
	if err != nil {
		return nil, nil, syncState, nil, err
	}

	fileRef := file.tailPointer().Ref()
	si, ok := fbo.unrefCache[fileRef]
	if !ok {
		return nil, nil, syncState, nil,
			fmt.Errorf("No syncOp found for file ref %v", fileRef)
	}

	md.AddOp(si.op)

	// Fill in syncState.
	if fblock.IsInd {
		fblockCopy, err := fblock.DeepCopy(fbo.config.Codec())
		if err != nil {
			return nil, nil, syncState, nil, err
		}
		syncState.fblock = fblock
		syncState.savedFblock = fblockCopy
		syncState.redirtyOnRecoverableError = make(map[BlockPointer]BlockPointer)
	}
	syncState.si = si
	syncState.savedSi, err = si.DeepCopy(fbo.config.Codec())
	if err != nil {
		return nil, nil, syncState, nil, err
	}

	if si.bps == nil {
		si.bps = newBlockPutState(1)
	} else {
		// reinstate byte accounting from the previous Sync
		md.SetRefBytes(si.refBytes)
		md.AddDiskUsage(si.refBytes)
		md.SetUnrefBytes(si.unrefBytes)
		md.SetDiskUsage(md.DiskUsage() - si.unrefBytes)
		syncState.newIndirectFileBlockPtrs = append(
			syncState.newIndirectFileBlockPtrs, si.op.Refs()...)
	}
	defer func() {
		si.refBytes = md.RefBytes()
		si.unrefBytes = md.UnrefBytes()
	}()

	bcache := fbo.config.BlockCache()
	dirtyBcache := fbo.config.DirtyBlockCache()
	df := fbo.getOrCreateDirtyFileLocked(lState, file)

	// Note: below we add possibly updated file blocks as "unref" and
	// "ref" blocks.  This is fine, since conflict resolution or
	// notifications will never happen within a file.

	// if this is an indirect block:
	//   1) check if each dirty block is split at the right place.
	//   2) if it needs fewer bytes, prepend the extra bytes to the next
	//      block (making a new one if it doesn't exist), and the next block
	//      gets marked dirty
	//   3) if it needs more bytes, then use copyUntilSplit() to fetch bytes
	//      from the next block (if there is one), remove the copied bytes
	//      from the next block and mark it dirty
	//   4) Then go through once more, and ready and finalize each
	//      dirty block, updating its ID in the indirect pointer list
	bsplit := fbo.config.BlockSplitter()
	if fblock.IsInd {
		// TODO: Verify that any getFileBlock... calls here
		// only use the dirty cache and not the network, since
		// the blocks are be dirty.
		for i := 0; i < len(fblock.IPtrs); i++ {
			ptr := fblock.IPtrs[i]
			isDirty := dirtyBcache.IsDirty(fbo.id(), ptr.BlockPointer,
				file.Branch)
			if (ptr.EncodedSize > 0) && isDirty {
				return nil, nil, syncState, nil,
					InconsistentEncodedSizeError{ptr.BlockInfo}
			}
			if isDirty {
				_, _, _, block, nextBlockOff, _, err :=
					fbo.getFileBlockAtOffsetLocked(
						ctx, lState, md.ReadOnly(), file, fblock,
						ptr.Off, blockWrite)
				if err != nil {
					return nil, nil, syncState, nil, err
				}

				splitAt := bsplit.CheckSplit(block)
				switch {
				case splitAt == 0:
					continue
				case splitAt > 0:
					endOfBlock := ptr.Off + int64(len(block.Contents))
					extraBytes := block.Contents[splitAt:]
					block.Contents = block.Contents[:splitAt]
					// put the extra bytes in front of the next block
					if nextBlockOff < 0 {
						// need to make a new block
						if err := fbo.newRightBlockLocked(
							ctx, lState, file.tailPointer(), file, fblock,
							endOfBlock, md.ReadOnly()); err != nil {
							return nil, nil, syncState, nil, err
						}
					}
					rPtr, _, _, rblock, _, _, err :=
						fbo.getFileBlockAtOffsetLocked(
							ctx, lState, md.ReadOnly(), file, fblock,
							endOfBlock, blockWrite)
					if err != nil {
						return nil, nil, syncState, nil, err
					}
					rblock.Contents = append(extraBytes, rblock.Contents...)
					if err = fbo.cacheBlockIfNotYetDirtyLocked(
						lState, rPtr, file, rblock); err != nil {
						return nil, nil, syncState, nil, err
					}
					fblock.IPtrs[i+1].Off = ptr.Off + int64(len(block.Contents))
					md.AddUnrefBlock(fblock.IPtrs[i+1].BlockInfo)
					fblock.IPtrs[i+1].EncodedSize = 0
				case splitAt < 0:
					if nextBlockOff < 0 {
						// end of the line
						continue
					}

					endOfBlock := ptr.Off + int64(len(block.Contents))
					rPtr, _, _, rblock, _, _, err :=
						fbo.getFileBlockAtOffsetLocked(
							ctx, lState, md.ReadOnly(), file, fblock,
							endOfBlock, blockWrite)
					if err != nil {
						return nil, nil, syncState, nil, err
					}
					// copy some of that block's data into this block
					nCopied := bsplit.CopyUntilSplit(block, false,
						rblock.Contents, int64(len(block.Contents)))
					rblock.Contents = rblock.Contents[nCopied:]
					if len(rblock.Contents) > 0 {
						if err = fbo.cacheBlockIfNotYetDirtyLocked(
							lState, rPtr, file, rblock); err != nil {
							return nil, nil, syncState, nil, err
						}
						fblock.IPtrs[i+1].Off =
							ptr.Off + int64(len(block.Contents))
						md.AddUnrefBlock(fblock.IPtrs[i+1].BlockInfo)
						fblock.IPtrs[i+1].EncodedSize = 0
					} else {
						// TODO: delete the block, and if we're down
						// to just one indirect block, remove the
						// layer of indirection
						//
						// TODO: When we implement more than one level
						// of indirection, make sure that the pointer
						// to the parent block in the grandparent
						// block has EncodedSize 0.
						md.AddUnrefBlock(fblock.IPtrs[i+1].BlockInfo)
						fblock.IPtrs =
							append(fblock.IPtrs[:i+1], fblock.IPtrs[i+2:]...)
					}
				}
			}
		}

		for i, ptr := range fblock.IPtrs {
			localPtr := ptr.BlockPointer
			isDirty := dirtyBcache.IsDirty(fbo.id(), localPtr, file.Branch)
			if (ptr.EncodedSize > 0) && isDirty {
				return nil, nil, syncState, nil,
					InconsistentEncodedSizeError{ptr.BlockInfo}
			}
			if isDirty {
				_, _, _, block, _, _, err := fbo.getFileBlockAtOffsetLocked(
					ctx, lState, md.ReadOnly(), file, fblock, ptr.Off, blockWrite)
				if err != nil {
					return nil, nil, syncState, nil, err
				}

				newInfo, _, readyBlockData, err :=
					fbo.ReadyBlock(ctx, md.ReadOnly(), block, uid)
				if err != nil {
					return nil, nil, syncState, nil, err
				}

				syncState.newIndirectFileBlockPtrs = append(syncState.newIndirectFileBlockPtrs, newInfo.BlockPointer)
				err = bcache.Put(newInfo.BlockPointer, fbo.id(), block, PermanentEntry)
				if err != nil {
					return nil, nil, syncState, nil, err
				}
				df.setBlockOrphaned(ptr.BlockPointer, true)

				// Defer the DirtyBlockCache.Delete until after the
				// new path is ready, in case anyone tries to read the
				// dirty file in the meantime.
				syncState.oldFileBlockPtrs =
					append(syncState.oldFileBlockPtrs, localPtr)

				fblock.IPtrs[i].BlockInfo = newInfo
				md.AddRefBlock(newInfo)

				// If this block is replacing a block from a previous,
				// failed Sync, we need to take that block out of the
				// refs list, and avoid unrefing it as well.
				si.removeReplacedBlock(ctx, fbo.log, localPtr)

				si.bps.addNewBlock(newInfo.BlockPointer, block, readyBlockData,
					func() error {
						return df.setBlockSynced(localPtr)
					})
				err = df.setBlockSyncing(localPtr)
				if err != nil {
					return nil, nil, syncState, nil, err
				}
				syncState.redirtyOnRecoverableError[newInfo.BlockPointer] = localPtr
			}
		}
	}

	err = df.setBlockSyncing(file.tailPointer())
	if err != nil {
		return nil, nil, syncState, nil, err
	}
	syncState.oldFileBlockPtrs = append(syncState.oldFileBlockPtrs, file.tailPointer())

	// Capture the current de before we release the block lock, so
	// other deferred writes don't slip in.
	if de, ok := fbo.deCache[fileRef]; ok {
		dirtyDe = &de
	}

	// TODO: Returning si.bps in this way is racy, since si is a
	// member of unrefCache.
	return fblock, si.bps, syncState, dirtyDe, nil
}

func (fbo *folderBlockOps) makeLocalBcache(ctx context.Context,
	lState *lockState, md *RootMetadata, file path, si *syncInfo,
	dirtyDe *DirEntry) (lbc localBcache, err error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	parentPath := file.parentPath()

	dblock, err := fbo.getDirLocked(
		ctx, lState, md.ReadOnly(), *parentPath, blockWrite)
	if err != nil {
		return nil, err
	}

	// Add in the cached unref'd blocks.
	si.mergeUnrefCache(md)

	lbc = make(localBcache)

	// Update the file's directory entry to the cached copy.
	if dirtyDe != nil {
		dirtyDe.EncodedSize = si.oldInfo.EncodedSize
		dblock.Children[file.tailName()] = *dirtyDe
		lbc[parentPath.tailPointer()] = dblock
	}

	return lbc, nil
}

// StartSync starts a sync for the given file. It returns the new
// FileBlock which has the readied top-level block which includes all
// writes since the last sync. Must be used with CleanupSyncState()
// and FinishSync() like so:
//
// 	fblock, bps, lbc, syncState, err :=
//		...fbo.StartSync(ctx, lState, md, uid, file)
//	defer func() {
//		...fbo.CleanupSyncState(
//			ctx, lState, md, file, ..., syncState, err)
//	}()
//	if err != nil {
//		...
//	}
//      ...
//
//	... = ...fbo.FinishSync(ctx, lState, file, ..., syncState)
func (fbo *folderBlockOps) StartSync(ctx context.Context,
	lState *lockState, md *RootMetadata, uid keybase1.UID, file path) (
	fblock *FileBlock, bps *blockPutState, lbc localBcache,
	syncState fileSyncState, err error) {
	if jServer, err := GetJournalServer(fbo.config); err == nil {
		jServer.dirtyOpStart(fbo.id())
	}

	fblock, bps, syncState, dirtyDe, err := fbo.startSyncWrite(
		ctx, lState, md, uid, file)
	if err != nil {
		return nil, nil, nil, syncState, err
	}

	lbc, err = fbo.makeLocalBcache(ctx, lState, md, file, syncState.savedSi,
		dirtyDe)
	if err != nil {
		return nil, nil, nil, syncState, err
	}
	return fblock, bps, lbc, syncState, err
}

// Does any clean-up for a sync of the given file, given an error
// (which may be nil) that happens during or after StartSync() and
// before FinishSync(). blocksToRemove may be nil.
func (fbo *folderBlockOps) CleanupSyncState(
	ctx context.Context, lState *lockState, md ReadOnlyRootMetadata,
	file path, blocksToRemove []BlockPointer,
	result fileSyncState, err error) {
	if jServer, err := GetJournalServer(fbo.config); err == nil {
		defer jServer.dirtyOpEnd(fbo.id())
	}

	if err == nil {
		return
	}

	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	// Notify error listeners before we reset the dirty blocks and
	// permissions to be granted.
	fbo.notifyErrListenersLocked(lState, file.tailPointer(), err)

	// If there was an error, we need to back out any changes that
	// might have been filled into the sync op, because it could
	// get reused again in a later Sync call.
	if result.si != nil {
		result.si.op.resetUpdateState()

		// Save this MD for later, so we can clean up its
		// newly-referenced block pointers if necessary.
		result.si.toCleanIfUnused = append(result.si.toCleanIfUnused,
			mdToCleanIfUnused{md, result.si.bps.DeepCopy()})
	}
	if isRecoverableBlockError(err) {
		if df := fbo.dirtyFiles[file.tailPointer()]; df != nil {
			df.assimilateDeferredNewBytes()
		}

		if result.si != nil {
			fbo.revertSyncInfoAfterRecoverableError(blocksToRemove, result)
		}
		if result.fblock != nil {
			*result.fblock = *result.savedFblock
			fbo.fixChildBlocksAfterRecoverableErrorLocked(
				ctx, lState, file,
				result.redirtyOnRecoverableError)
		}
	} else {
		// Since the sync has errored out unrecoverably, the deferred
		// bytes are already accounted for.
		if df := fbo.dirtyFiles[file.tailPointer()]; df != nil {
			df.updateNotYetSyncingBytes(-fbo.deferredWaitBytes)

			// Some blocks that were dirty are now clean under their
			// readied block ID, and now live in the bps rather than
			// the dirty bcache, so we can delete them from the dirty
			// bcache.
			dirtyBcache := fbo.config.DirtyBlockCache()
			for _, ptr := range result.oldFileBlockPtrs {
				if df.isBlockOrphaned(ptr) {
					fbo.log.CDebugf(ctx, "Deleting dirty orphan: %v", ptr)
					if err := dirtyBcache.Delete(fbo.id(), ptr,
						fbo.branch()); err != nil {
						fbo.log.CDebugf(ctx, "Couldn't delete %v", ptr)
					}
				}
			}
		}

		// On an unrecoverable error, the deferred writes aren't
		// needed anymore since they're already part of the
		// (still-)dirty blocks.
		fbo.deferredDirtyDeletes = nil
		fbo.deferredWrites = nil
		fbo.deferredWaitBytes = 0

	}

	// The sync is over, due to an error, so reset the map so that we
	// don't defer any subsequent writes.
	// Old syncing blocks are now just dirty
	if df := fbo.dirtyFiles[file.tailPointer()]; df != nil {
		df.resetSyncingBlocksToDirty()
	}
}

// cleanUpUnusedBlocks cleans up the blocks from any previous failed
// sync attempts.
func (fbo *folderBlockOps) cleanUpUnusedBlocks(ctx context.Context,
	md ReadOnlyRootMetadata, syncState fileSyncState, fbm *folderBlockManager) error {
	numToClean := len(syncState.si.toCleanIfUnused)
	if numToClean == 0 {
		return nil
	}

	// What blocks are referenced in the successful MD?
	refs := make(map[BlockPointer]bool)
	for _, op := range md.data.Changes.Ops {
		for _, ptr := range op.Refs() {
			if ptr == zeroPtr {
				panic("Unexpected zero ref ptr in a sync MD revision")
			}
			refs[ptr] = true
		}
		for _, update := range op.allUpdates() {
			if update.Ref == zeroPtr {
				panic("Unexpected zero update ref ptr in a sync MD revision")
			}

			refs[update.Ref] = true
		}
	}

	// For each MD to clean, clean up the old failed blocks
	// immediately if the merge status matches the successful put, if
	// they didn't get referenced in the successful put.  If the merge
	// status is different (e.g., we ended up on a conflict branch),
	// clean it up only if the original revision failed.  If the same
	// block appears more than once, the one with a different merged
	// status takes precedence (which will always come earlier in the
	// list of MDs).
	blocksSeen := make(map[BlockPointer]bool)
	for _, oldMD := range syncState.si.toCleanIfUnused {
		bdType := blockDeleteAlways
		if oldMD.md.MergedStatus() != md.MergedStatus() {
			bdType = blockDeleteOnMDFail
		}

		failedBps := newBlockPutState(len(oldMD.bps.blockStates))
		for _, bs := range oldMD.bps.blockStates {
			if bs.blockPtr == zeroPtr {
				panic("Unexpected zero block ptr in an old sync MD revision")
			}
			if blocksSeen[bs.blockPtr] {
				continue
			}
			blocksSeen[bs.blockPtr] = true
			if refs[bs.blockPtr] && bdType == blockDeleteAlways {
				continue
			}
			failedBps.blockStates = append(failedBps.blockStates,
				blockState{blockPtr: bs.blockPtr})
			fbo.log.CDebugf(ctx, "Cleaning up block %v from a previous "+
				"failed revision %d (oldMD is %s, bdType=%d)", bs.blockPtr,
				oldMD.md.Revision(), oldMD.md.MergedStatus(), bdType)
		}

		if len(failedBps.blockStates) > 0 {
			fbm.cleanUpBlockState(oldMD.md, failedBps, bdType)
		}
	}
	return nil
}

func (fbo *folderBlockOps) doDeferredWritesLocked(ctx context.Context,
	lState *lockState, kmd KeyMetadata, newPath path) (
	stillDirty bool, err error) {
	fbo.blockLock.AssertLocked(lState)

	// Redo any writes or truncates that happened to our file while
	// the sync was happening.
	deletes := fbo.deferredDirtyDeletes
	writes := fbo.deferredWrites
	stillDirty = len(fbo.deferredWrites) != 0
	fbo.deferredDirtyDeletes = nil
	fbo.deferredWrites = nil
	fbo.deferredWaitBytes = 0

	// Clear any dirty blocks that resulted from a write/truncate
	// happening during the sync, since we're redoing them below.
	dirtyBcache := fbo.config.DirtyBlockCache()
	for _, ptr := range deletes {
		fbo.log.CDebugf(ctx, "Deleting deferred dirty ptr %v", ptr)
		if err := dirtyBcache.Delete(fbo.id(), ptr, fbo.branch()); err != nil {
			return true, err
		}
	}

	for _, f := range writes {
		err = f(ctx, lState, kmd, newPath)
		if err != nil {
			// It's a little weird to return an error from a deferred
			// write here. Hopefully that will never happen.
			return true, err
		}
	}
	return false, nil
}

// FinishSync finishes the sync process for a file, given the state
// from StartSync. Specifically, it re-applies any writes that
// happened since the call to StartSync.
func (fbo *folderBlockOps) FinishSync(
	ctx context.Context, lState *lockState,
	oldPath, newPath path, md ReadOnlyRootMetadata,
	syncState fileSyncState, fbm *folderBlockManager) (
	stillDirty bool, err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	dirtyBcache := fbo.config.DirtyBlockCache()
	for _, ptr := range syncState.oldFileBlockPtrs {
		fbo.log.CDebugf(ctx, "Deleting dirty ptr %v", ptr)
		if err := dirtyBcache.Delete(fbo.id(), ptr, fbo.branch()); err != nil {
			return true, err
		}
	}

	bcache := fbo.config.BlockCache()
	for _, ptr := range syncState.newIndirectFileBlockPtrs {
		err := bcache.DeletePermanent(ptr.ID)
		if err != nil {
			fbo.log.CWarningf(ctx, "Error when deleting %v from cache: %v",
				ptr.ID, err)
		}
	}

	stillDirty, err = fbo.doDeferredWritesLocked(ctx, lState, md, newPath)
	if err != nil {
		return true, err
	}

	// Clear cached info for the old path.  We are guaranteed that any
	// concurrent write to this file was deferred, even if it was to a
	// block that wasn't currently being sync'd, since the top-most
	// block is always in dirtyFiles and is always dirtied during a
	// write/truncate.
	//
	// Also, we can get rid of all the sync state that might have
	// happened during the sync, since we will replay the writes
	// below anyway.
	if err := fbo.clearCacheInfoLocked(lState, oldPath); err != nil {
		return true, err
	}

	if err := fbo.cleanUpUnusedBlocks(ctx, md, syncState, fbm); err != nil {
		return true, err
	}

	return stillDirty, nil
}

// notifyErrListeners notifies any write operations that are blocked
// on a file so that they can learn about unrecoverable sync errors.
func (fbo *folderBlockOps) notifyErrListenersLocked(lState *lockState,
	ptr BlockPointer, err error) {
	fbo.blockLock.AssertLocked(lState)
	if isRecoverableBlockError(err) {
		// Don't bother any listeners with this error, since the sync
		// will be retried.  Unless the sync has reached its retry
		// limit, but in that case the listeners will just proceed as
		// normal once the dirty block cache bytes are freed, and
		// that's ok since this error isn't fatal.
		return
	}
	df := fbo.dirtyFiles[ptr]
	if df != nil {
		df.notifyErrListeners(err)
	}
}

type searchWithOutOfDateCacheError struct {
}

func (e searchWithOutOfDateCacheError) Error() string {
	return fmt.Sprintf("Search is using an out-of-date node cache; " +
		"try again with a clean cache.")
}

// searchForNodesInDirLocked recursively tries to find a path, and
// ultimately a node, to ptr, given the set of pointers that were
// updated in a particular operation.  The keys in nodeMap make up the
// set of BlockPointers that are being searched for, and nodeMap is
// updated in place to include the corresponding discovered nodes.
//
// Returns the number of nodes found by this invocation.  If the error
// it returns is searchWithOutOfDateCache, the search should be
// retried by the caller with a clean cache.
func (fbo *folderBlockOps) searchForNodesInDirLocked(ctx context.Context,
	lState *lockState, cache NodeCache, newPtrs map[BlockPointer]bool,
	kmd KeyMetadata, rootNode Node, currDir path, nodeMap map[BlockPointer]Node,
	numNodesFoundSoFar int) (int, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	dirBlock, err := fbo.getDirLocked(
		ctx, lState, kmd, currDir, blockRead)
	if err != nil {
		return 0, err
	}

	// getDirLocked may have unlocked blockLock, which means the cache
	// could have changed out from under us.  Verify that didn't
	// happen, so we can avoid messing it up with nodes from an old MD
	// version.  If it did happen, return a special error that lets
	// the caller know they should retry with a fresh cache.
	if currDir.path[0].BlockPointer !=
		cache.PathFromNode(rootNode).tailPointer() {
		return 0, searchWithOutOfDateCacheError{}
	}

	if numNodesFoundSoFar >= len(nodeMap) {
		return 0, nil
	}

	numNodesFound := 0
	for name, de := range dirBlock.Children {
		if _, ok := nodeMap[de.BlockPointer]; ok {
			childPath := currDir.ChildPath(name, de.BlockPointer)
			// make a node for every pathnode
			n := rootNode
			for _, pn := range childPath.path[1:] {
				n, err = cache.GetOrCreate(pn.BlockPointer, pn.Name, n)
				if err != nil {
					return 0, err
				}
			}
			nodeMap[de.BlockPointer] = n
			numNodesFound++
			if numNodesFoundSoFar+numNodesFound >= len(nodeMap) {
				return numNodesFound, nil
			}
		}

		// otherwise, recurse if this represents an updated block
		if _, ok := newPtrs[de.BlockPointer]; de.Type == Dir && ok {
			childPath := currDir.ChildPath(name, de.BlockPointer)
			n, err := fbo.searchForNodesInDirLocked(ctx, lState, cache,
				newPtrs, kmd, rootNode, childPath, nodeMap,
				numNodesFoundSoFar+numNodesFound)
			if err != nil {
				return 0, err
			}
			numNodesFound += n
			if numNodesFoundSoFar+numNodesFound >= len(nodeMap) {
				return numNodesFound, nil
			}
		}
	}

	return numNodesFound, nil
}

func (fbo *folderBlockOps) trySearchWithCacheLocked(ctx context.Context,
	lState *lockState, cache NodeCache, ptrs []BlockPointer,
	newPtrs map[BlockPointer]bool, kmd KeyMetadata, rootPtr BlockPointer) (
	map[BlockPointer]Node, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	nodeMap := make(map[BlockPointer]Node)
	for _, ptr := range ptrs {
		nodeMap[ptr] = nil
	}

	if len(ptrs) == 0 {
		return nodeMap, nil
	}

	var node Node
	// The node cache used by the main part of KBFS is
	// fbo.nodeCache. This basically maps from BlockPointers to
	// Nodes. Nodes are used by the callers of the library, but
	// internally we need to know the series of BlockPointers and
	// file/dir names that make up the path of the corresponding
	// file/dir. fbo.nodeCache is long-lived and never invalidated.
	//
	// As folderBranchOps gets informed of new local or remote MD
	// updates, which change the BlockPointers of some subset of the
	// nodes in this TLF, it calls nodeCache.UpdatePointer for each
	// change. Then, when a caller passes some old Node they have
	// lying around into an FBO call, we can translate it to its
	// current path using fbo.nodeCache. Note that on every TLF
	// modification, we are guaranteed that the BlockPointer of the
	// root directory will change (because of the merkle-ish tree of
	// content hashes we use to assign BlockPointers).
	//
	// fbo.nodeCache needs to maintain the absolute latest mappings
	// for the TLF, or else FBO calls won't see up-to-date data. The
	// tension in search comes from the fact that we are trying to
	// discover the BlockPointers of certain files at a specific point
	// in the MD history, which is not necessarily the same as the
	// most-recently-seen MD update. Specifically, some callers
	// process a specific range of MDs, but folderBranchOps may have
	// heard about a newer one before, or during, when the caller
	// started processing. That means fbo.nodeCache may have been
	// updated to reflect the newest BlockPointers, and is no longer
	// correct as a cache for our search for the data at the old point
	// in time.
	if cache == fbo.nodeCache {
		// Root node should already exist if we have an up-to-date md.
		node = cache.Get(rootPtr.Ref())
		if node == nil {
			return nil, searchWithOutOfDateCacheError{}
		}
	} else {
		// Root node may or may not exist.
		var err error
		node, err = cache.GetOrCreate(rootPtr,
			string(kmd.GetTlfHandle().GetCanonicalName()), nil)
		if err != nil {
			return nil, err
		}
	}
	if node == nil {
		return nil, fmt.Errorf("Cannot find root node corresponding to %v",
			rootPtr)
	}

	// are they looking for the root directory?
	numNodesFound := 0
	if _, ok := nodeMap[rootPtr]; ok {
		nodeMap[rootPtr] = node
		numNodesFound++
		if numNodesFound >= len(nodeMap) {
			return nodeMap, nil
		}
	}

	rootPath := cache.PathFromNode(node)
	if len(rootPath.path) != 1 {
		return nil, fmt.Errorf("Invalid root path for %v: %s",
			rootPtr, rootPath)
	}

	_, err := fbo.searchForNodesInDirLocked(ctx, lState, cache, newPtrs,
		kmd, node, rootPath, nodeMap, numNodesFound)
	if err != nil {
		return nil, err
	}

	if rootPtr != cache.PathFromNode(node).tailPointer() {
		return nil, searchWithOutOfDateCacheError{}
	}

	return nodeMap, nil
}

func (fbo *folderBlockOps) searchForNodesLocked(ctx context.Context,
	lState *lockState, cache NodeCache, ptrs []BlockPointer,
	newPtrs map[BlockPointer]bool, kmd KeyMetadata, rootPtr BlockPointer) (
	map[BlockPointer]Node, NodeCache, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// First try the passed-in cache.  If it doesn't work because the
	// cache is out of date, try again with a clean cache.
	nodeMap, err := fbo.trySearchWithCacheLocked(ctx, lState, cache, ptrs,
		newPtrs, kmd, rootPtr)
	if _, ok := err.(searchWithOutOfDateCacheError); ok {
		// The md is out-of-date, so use a throwaway cache so we
		// don't pollute the real node cache with stale nodes.
		fbo.log.CDebugf(ctx, "Root node %v doesn't exist in the node "+
			"cache; using a throwaway node cache instead",
			rootPtr)
		cache = newNodeCacheStandard(fbo.folderBranch)
		nodeMap, err = fbo.trySearchWithCacheLocked(ctx, lState, cache, ptrs,
			newPtrs, kmd, rootPtr)
	}

	if err != nil {
		return nil, nil, err
	}

	// Return the whole map even if some nodes weren't found.
	return nodeMap, cache, nil
}

// SearchForNodes tries to resolve all the given pointers to a Node
// object, using only the updated pointers specified in newPtrs.
// Returns an error if any subset of the pointer paths do not exist;
// it is the caller's responsibility to decide to error on particular
// unresolved nodes.  It also returns the cache that ultimately
// contains the nodes -- this might differ from the passed-in cache if
// another goroutine updated that cache and it no longer contains the
// root pointer specified in md.
func (fbo *folderBlockOps) SearchForNodes(ctx context.Context,
	cache NodeCache, ptrs []BlockPointer, newPtrs map[BlockPointer]bool,
	kmd KeyMetadata, rootPtr BlockPointer) (
	map[BlockPointer]Node, NodeCache, error) {
	lState := makeFBOLockState()
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.searchForNodesLocked(
		ctx, lState, cache, ptrs, newPtrs, kmd, rootPtr)
}

// SearchForPaths is like SearchForNodes, except it returns a
// consistent view of all the paths of the searched-for pointers.
func (fbo *folderBlockOps) SearchForPaths(ctx context.Context,
	cache NodeCache, ptrs []BlockPointer, newPtrs map[BlockPointer]bool,
	kmd KeyMetadata, rootPtr BlockPointer) (map[BlockPointer]path, error) {
	lState := makeFBOLockState()
	// Hold the lock while processing the paths so they can't be changed.
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	nodeMap, cache, err :=
		fbo.searchForNodesLocked(
			ctx, lState, cache, ptrs, newPtrs, kmd, rootPtr)
	if err != nil {
		return nil, err
	}

	paths := make(map[BlockPointer]path)
	for ptr, n := range nodeMap {
		if n == nil {
			paths[ptr] = path{}
			continue
		}

		p := cache.PathFromNode(n)
		if p.tailPointer() != ptr {
			return nil, NodeNotFoundError{ptr}
		}
		paths[ptr] = p
	}

	return paths, nil
}

// getUndirtiedEntry returns the clean entry for the given path
// corresponding to a cached dirty entry. If there is no dirty or
// clean entry, nil is returned.
func (fbo *folderBlockOps) getUndirtiedEntry(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	file path) (*DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	_, ok := fbo.deCache[file.tailPointer().Ref()]
	if !ok {
		return nil, nil
	}

	// Get the undirtied dir block.
	dblock, err := fbo.getDirLocked(
		ctx, lState, kmd, *file.parentPath(), blockRead)
	if err != nil {
		return nil, err
	}

	undirtiedEntry, ok := dblock.Children[file.tailName()]
	if !ok {
		return nil, nil
	}

	return &undirtiedEntry, nil
}

func (fbo *folderBlockOps) setCachedAttr(
	ctx context.Context, lState *lockState,
	ref BlockRef, op *setAttrOp, realEntry *DirEntry, doCreate bool) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	fileEntry, ok := fbo.deCache[ref]
	if !ok {
		if !doCreate {
			return
		}
		fileEntry = *realEntry
	}

	switch op.Attr {
	case exAttr:
		fileEntry.Type = realEntry.Type
	case mtimeAttr:
		fileEntry.Mtime = realEntry.Mtime
	}
	fileEntry.Ctime = realEntry.Ctime
	fbo.deCache[ref] = fileEntry
}

// UpdateCachedEntryAttributes updates any cached entry for the given
// path according to the given op. The node for the path is returned
// if there is one.
func (fbo *folderBlockOps) UpdateCachedEntryAttributes(
	ctx context.Context, lState *lockState, kmd KeyMetadata,
	dir path, op *setAttrOp) (Node, error) {
	childPath := dir.ChildPathNoPtr(op.Name)

	// find the node for the actual change; requires looking up
	// the child entry to get the BlockPointer, unfortunately.
	de, err := fbo.GetDirtyEntry(ctx, lState, kmd, childPath)
	if err != nil {
		return nil, err
	}

	childNode := fbo.nodeCache.Get(de.Ref())
	if childNode == nil {
		// Nothing to do, since the cache entry won't be
		// accessible from any node.
		return nil, nil
	}

	childPath = dir.ChildPath(op.Name, de.BlockPointer)

	// If there's a cache entry, we need to update it, so try and
	// fetch the undirtied entry.
	cleanEntry, err := fbo.getUndirtiedEntry(ctx, lState, kmd, childPath)
	if err != nil {
		return nil, err
	}

	if cleanEntry != nil {
		fbo.setCachedAttr(ctx, lState, de.Ref(), op, cleanEntry, false)
	}

	return childNode, nil
}

// UpdateCachedEntryAttributesOnRemovedFile updates any cached entry
// for the given path of an unlinked file, according to the given op,
// and it makes a new dirty cache entry if one doesn't exist yet.  We
// assume Sync will be called eventually on the corresponding open
// file handle, which will clear out the entry.
func (fbo *folderBlockOps) UpdateCachedEntryAttributesOnRemovedFile(
	ctx context.Context, lState *lockState, op *setAttrOp, de DirEntry) {
	fbo.setCachedAttr(ctx, lState, de.Ref(), op, &de, true)
}

func (fbo *folderBlockOps) getDeferredWriteCountForTest(lState *lockState) int {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return len(fbo.deferredWrites)
}

// UpdatePointers updates all the pointers in the node cache
// atomically.
func (fbo *folderBlockOps) UpdatePointers(lState *lockState, op op) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	for _, update := range op.allUpdates() {
		oldRef := update.Unref.Ref()
		fbo.nodeCache.UpdatePointer(oldRef, update.Ref)
	}
}

func (fbo *folderBlockOps) unlinkDuringFastForwardLocked(ctx context.Context,
	lState *lockState, ref BlockRef) {
	fbo.blockLock.AssertLocked(lState)
	oldNode := fbo.nodeCache.Get(ref)
	if oldNode == nil {
		return
	}
	oldPath := fbo.nodeCache.PathFromNode(oldNode)
	fbo.log.CDebugf(ctx, "Unlinking missing node %s/%v during "+
		"fast-forward", oldPath, ref)
	fbo.nodeCache.Unlink(ref, oldPath)
}

func (fbo *folderBlockOps) fastForwardDirAndChildrenLocked(ctx context.Context,
	lState *lockState, currDir path, children map[string]map[pathNode]bool,
	kmd KeyMetadata) ([]NodeChange, error) {
	fbo.blockLock.AssertLocked(lState)
	dirBlock, err := fbo.getDirLocked(ctx, lState, kmd, currDir, blockRead)
	if err != nil {
		return nil, err
	}

	prefix := currDir.String()

	// TODO: parallelize me?
	var changes []NodeChange
	for child := range children[prefix] {
		entry, ok := dirBlock.Children[child.Name]
		if !ok {
			fbo.unlinkDuringFastForwardLocked(
				ctx, lState, child.BlockPointer.Ref())
			continue
		}

		fbo.log.CDebugf(ctx, "Fast-forwarding %v -> %v",
			child.BlockPointer, entry.BlockPointer)
		fbo.nodeCache.UpdatePointer(child.BlockPointer.Ref(),
			entry.BlockPointer)
		node := fbo.nodeCache.Get(entry.BlockPointer.Ref())
		newPath := fbo.nodeCache.PathFromNode(node)
		if entry.Type == Dir {
			if node != nil {
				change := NodeChange{Node: node}
				for subchild := range children[newPath.String()] {
					change.DirUpdated = append(change.DirUpdated, subchild.Name)
				}
				changes = append(changes, change)
			}

			childChanges, err := fbo.fastForwardDirAndChildrenLocked(
				ctx, lState, newPath, children, kmd)
			if err != nil {
				return nil, err
			}
			changes = append(changes, childChanges...)
		} else if node != nil {
			// File -- invalidate the entire file contents.
			changes = append(changes, NodeChange{
				Node:        node,
				FileUpdated: []WriteRange{{Len: 0, Off: 0}},
			})
		}
	}
	delete(children, prefix)
	return changes, nil
}

// FastForwardAllNodes attempts to update the block pointers
// associated with nodes in the cache by searching for their paths in
// the current version of the TLF.  If it can't find a corresponding
// node, it assumes it's been deleted and unlinks it.  Returns the set
// of node changes that resulted.
func (fbo *folderBlockOps) FastForwardAllNodes(ctx context.Context,
	lState *lockState, md ReadOnlyRootMetadata) (
	changes []NodeChange, err error) {
	defer func() { fbo.log.CDebugf(ctx, "Fast-forward complete: %v", err) }()

	// Take a hard lock through this whole process.  TODO: is there
	// any way to relax this?  It could lead to file system operation
	// timeouts, even on reads, if we hold it too long.
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	nodes := fbo.nodeCache.AllNodes()
	fbo.log.CDebugf(ctx, "Fast-forwarding %d nodes", len(nodes))

	// Build a "tree" representation for each interesting path prefix.
	children := make(map[string]map[pathNode]bool)
	var rootPath path
	for _, n := range nodes {
		p := fbo.nodeCache.PathFromNode(n)
		if len(p.path) == 1 {
			rootPath = p
		}
		prevPath := ""
		for _, pn := range p.path {
			if prevPath != "" {
				childPNs := children[prevPath]
				if childPNs == nil {
					childPNs = make(map[pathNode]bool)
					children[prevPath] = childPNs
				}
				childPNs[pn] = true
			}
			prevPath = filepath.Join(prevPath, pn.Name)
		}
	}

	if !rootPath.isValid() {
		return nil, errors.New("Couldn't find the root path")
	}

	fbo.log.CDebugf(ctx, "Fast-forwarding root %v -> %v",
		rootPath.path[0].BlockPointer, md.data.Dir.BlockPointer)
	fbo.nodeCache.UpdatePointer(rootPath.path[0].BlockPointer.Ref(),
		md.data.Dir.BlockPointer)
	rootPath.path[0].BlockPointer = md.data.Dir.BlockPointer
	rootNode := fbo.nodeCache.Get(md.data.Dir.BlockPointer.Ref())
	if rootNode != nil {
		change := NodeChange{Node: rootNode}
		for child := range children[rootPath.String()] {
			change.DirUpdated = append(change.DirUpdated, child.Name)
		}
		changes = append(changes, change)
	}

	childChanges, err := fbo.fastForwardDirAndChildrenLocked(
		ctx, lState, rootPath, children, md)
	if err != nil {
		return nil, err
	}
	changes = append(changes, childChanges...)

	// Unlink any children that remain.
	for _, childPNs := range children {
		for child := range childPNs {
			fbo.unlinkDuringFastForwardLocked(
				ctx, lState, child.BlockPointer.Ref())
		}
	}
	return changes, nil
}

type chainsPathPopulator interface {
	populateChainPaths(context.Context, logger.Logger, *crChains, bool) error
}

// populateChainPaths updates all the paths in all the ops tracked by
// `chains`, using the main nodeCache.
func (fbo *folderBlockOps) populateChainPaths(ctx context.Context,
	log logger.Logger, chains *crChains, includeCreates bool) error {
	_, err := chains.getPaths(ctx, fbo, log, fbo.nodeCache, includeCreates)
	return err
}

var _ chainsPathPopulator = (*folderBlockOps)(nil)
