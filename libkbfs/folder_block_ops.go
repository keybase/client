// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol"
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

// syncBlockState represents that state of a block with respect to
// whether it's currently being synced.  There can be three states:
//  1) Not being synced
//  2) Being synced and not yet re-dirtied: any write needs to
//     make a copy of the block before dirtying it.  Also, all writes must be
//     deferred.
//  3) Being synced and already re-dirtied: no copies are needed, but all
//     writes must still be deferred.
type syncBlockState int

const (
	blockNotBeingSynced syncBlockState = iota
	blockSyncingNotDirty
	blockSyncingAndDirty
)

type syncInfo struct {
	oldInfo    BlockInfo
	op         *syncOp
	unrefs     []BlockInfo
	bps        *blockPutState
	refBytes   uint64
	unrefBytes uint64
}

func (si *syncInfo) DeepCopy(codec Codec) (*syncInfo, error) {
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
		err := CodecUpdate(codec, &newSi.op, si.op)
		if err != nil {
			return nil, err
		}
	}
	return newSi, nil
}

// folderBlockOps contains all the fields that must be synchronized by
// blockLock. It will eventually also contain all the methods that
// must be synchronized by blockLock, so that folderBranchOps will
// have no knowledge of blockLock.
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

	// Which blocks are currently being synced, so that writes and
	// truncates can do copy-on-write to avoid messing up the ongoing
	// sync.  If it is blockSyncingNotDirty, then any write to the
	// block should result in a deep copy and those writes should be
	// deferred; if it is blockSyncingAndDirty, then just defer the
	// writes.
	fileBlockStates map[BlockPointer]syncBlockState

	// For writes and truncates, track the unsynced to-be-unref'd
	// block infos, per-path.
	unrefCache map[blockRef]*syncInfo
	// For writes and truncates, track the modified (but not yet
	// committed) directory entries. Maps the entry blockRef to a
	// modified entry.
	deCache map[blockRef]DirEntry

	// Writes and truncates for blocks that were being sync'd, and
	// need to be replayed after the sync finishes on top of the new
	// versions of the blocks.
	deferredWrites []func(context.Context, *lockState, *RootMetadata, path) error
	// Blocks that need to be deleted from the dirty cache before any
	// deferred writes are replayed.
	deferredDirtyDeletes []BlockPointer
	// If there are too many deferred bytes outstanding, writes should
	// add themselves to this list (while holding blockLock).  They
	// will be able to receive on the channel on an outstanding Sync()
	// completes.  If they receive an error, they should fail the
	// write.
	syncListeners []chan error

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

func (fbo *folderBlockOps) id() TlfID {
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

// getBlockHelperLocked retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server. If
// notifyPath is valid and the block isn't cached, trigger a read
// notification.
//
// This must be called only by get{File,Dir}BlockHelperLocked().
func (fbo *folderBlockOps) getBlockHelperLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, ptr BlockPointer, branch BranchName,
	newBlock makeNewBlock, doCache bool, notifyPath path) (
	Block, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	if !ptr.IsValid() {
		return nil, InvalidBlockRefError{ptr.ref()}
	}

	bcache := fbo.config.BlockCache()
	if block, err := bcache.Get(ptr, branch); err == nil {
		return block, nil
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
		err = bops.Get(ctx, md, ptr, block)
	})
	if err != nil {
		return nil, err
	}

	if doCache {
		if err := bcache.Put(ptr, fbo.id(), block, TransientEntry); err != nil {
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
	lState *lockState, md *RootMetadata, ptr BlockPointer,
	branch BranchName, p path) (
	*FileBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	block, err := fbo.getBlockHelperLocked(
		ctx, lState, md, ptr, branch, NewFileBlock, true, p)
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
	lState *lockState, md *RootMetadata, ptr BlockPointer, branch BranchName) (
	Block, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getBlockHelperLocked(ctx, lState, md, ptr, branch,
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
	lState *lockState, md *RootMetadata, ptr BlockPointer,
	branch BranchName, p path) (*DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// Pass in an empty notify path because notifications should only
	// trigger for file reads.
	block, err := fbo.getBlockHelperLocked(
		ctx, lState, md, ptr, branch, NewDirBlock, true, path{})
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
	lState *lockState, md *RootMetadata, ptr BlockPointer,
	branch BranchName, p path) (*FileBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getFileBlockHelperLocked(ctx, lState, md, ptr, branch, p)
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
	lState *lockState, md *RootMetadata, ptr BlockPointer,
	branch BranchName, p path) (*DirBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirBlockHelperLocked(ctx, lState, md, ptr, branch, p)
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
	lState *lockState, md *RootMetadata, ptr BlockPointer,
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
		ctx, lState, md, ptr, file.Branch, file)
	if err != nil {
		return nil, err
	}

	if rtype == blockWrite {
		// Copy the block if it's for writing, and either the
		// block is not yet dirty or the block is currently
		// being sync'd and needs a copy even though it's
		// already dirty.
		if !fbo.config.BlockCache().IsDirty(ptr, file.Branch) ||
			fbo.fileBlockStates[ptr] == blockSyncingNotDirty {
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
	lState *lockState, md *RootMetadata, file path,
	rtype blockReqType) (*FileBlock, error) {
	return fbo.getFileBlockLocked(
		ctx, lState, md, file.tailPointer(), file, rtype)
}

// GetIndirectFileBlockInfos returns a list of BlockInfos for all
// indirect blocks of the given file.
func (fbo *folderBlockOps) GetIndirectFileBlockInfos(ctx context.Context,
	lState *lockState, md *RootMetadata, file path) ([]BlockInfo, error) {
	// TODO: handle multiple levels of indirection.
	fBlock, err := func() (*FileBlock, error) {
		fbo.blockLock.RLock(lState)
		defer fbo.blockLock.RUnlock(lState)
		return fbo.getFileBlockLocked(
			ctx, lState, md, file.tailPointer(), file, blockRead)
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
	lState *lockState, md *RootMetadata, dir path, rtype blockReqType) (
	*DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// Callers should have already done this check, but it doesn't
	// hurt to do it again.
	if !dir.isValid() {
		return nil, InvalidPathError{dir}
	}

	// Get the block for the last element in the path.
	dblock, err := fbo.getDirBlockHelperLocked(
		ctx, lState, md, dir.tailPointer(), dir.Branch, dir)
	if err != nil {
		return nil, err
	}

	if rtype == blockWrite && !fbo.config.BlockCache().IsDirty(
		dir.tailPointer(), dir.Branch) {
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
	ctx context.Context, lState *lockState, md *RootMetadata, dir path,
	rtype blockReqType) (*DirBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirLocked(ctx, lState, md, dir, rtype)
}

func (fbo *folderBlockOps) getFileBlockAtOffsetLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, file path, topBlock *FileBlock,
	off int64, rtype blockReqType) (
	ptr BlockPointer, parentBlock *FileBlock, indexInParent int,
	block *FileBlock, more bool, startOff int64, err error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// find the block matching the offset, if it exists
	ptr = file.tailPointer()
	block = topBlock
	more = false
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
		more = more || (nextIndex != len(block.IPtrs)-1)
		ptr = nextPtr.BlockPointer
		if block, err = fbo.getFileBlockLocked(ctx, lState, md, ptr, file, rtype); err != nil {
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
		de, ok := fbo.deCache[v.ref()]
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
	lState *lockState, md *RootMetadata, dir path, rtype blockReqType) (
	*DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	dblock, err := fbo.getDirLocked(ctx, lState, md, dir, rtype)
	if err != nil {
		return nil, err
	}

	return fbo.updateWithDirtyEntriesLocked(ctx, lState, dblock)
}

// GetDirtyDirChildren returns a map of EntryInfos for the (possibly
// dirty) children entries of the given directory.
func (fbo *folderBlockOps) GetDirtyDirChildren(
	ctx context.Context, lState *lockState, md *RootMetadata, dir path) (
	map[string]EntryInfo, error) {
	dblock, err := func() (*DirBlock, error) {
		fbo.blockLock.RLock(lState)
		defer fbo.blockLock.RUnlock(lState)
		dblock, err := fbo.getDirtyDirLocked(
			ctx, lState, md, dir, blockRead)
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
	lState *lockState, md *RootMetadata, file path, rtype blockReqType) (
	*DirBlock, DirEntry, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	if !file.hasValidParent() {
		return nil, DirEntry{}, InvalidParentPathError{file}
	}

	parentPath := file.parentPath()
	dblock, err := fbo.getDirtyDirLocked(
		ctx, lState, md, *parentPath, rtype)
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
	ctx context.Context, lState *lockState, md *RootMetadata, file path) (
	*DirBlock, DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirtyParentAndEntryLocked(
		ctx, lState, md, file, blockWrite)
}

// file must have a valid parent.
func (fbo *folderBlockOps) getDirtyEntryLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, file path) (DirEntry, error) {
	// TODO: Since we only need a single DirEntry, avoid having to
	// look up every entry in the DirBlock.
	_, de, err := fbo.getDirtyParentAndEntryLocked(
		ctx, lState, md, file, blockRead)
	return de, err
}

// GetDirtyEntry returns the possibly-dirty DirEntry of the given file
// in its parent DirBlock. file must have a valid parent.
func (fbo *folderBlockOps) GetDirtyEntry(
	ctx context.Context, lState *lockState, md *RootMetadata,
	file path) (DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirtyEntryLocked(ctx, lState, md, file)
}

// cacheBlockIfNotYetDirtyLocked puts a block into the cache, but only
// does so if the block isn't already marked as dirty in the cache.
// This is useful when operating on a dirty copy of a block that may
// already be in the cache.
func (fbo *folderBlockOps) cacheBlockIfNotYetDirtyLocked(
	lState *lockState, ptr BlockPointer, branch BranchName, block Block) error {
	fbo.blockLock.AssertLocked(lState)

	if !fbo.config.BlockCache().IsDirty(ptr, branch) {
		return fbo.config.BlockCache().PutDirty(ptr, branch, block)
	}

	switch fbo.fileBlockStates[ptr] {
	case blockNotBeingSynced:
		// Nothing to do
	case blockSyncingNotDirty:
		// Overwrite the dirty block if this is a copy-on-write during
		// a sync.  Don't worry, the old dirty block is safe in the
		// sync goroutine (and also probably saved to the cache under
		// its new ID already).
		err := fbo.config.BlockCache().PutDirty(ptr, branch, block)
		if err != nil {
			return err
		}
		// Future writes can use this same block.
		fbo.fileBlockStates[ptr] = blockSyncingAndDirty
		fbo.doDeferWrite = true
	case blockSyncingAndDirty:
		fbo.doDeferWrite = true
	}

	return nil
}

func (fbo *folderBlockOps) newRightBlockLocked(
	ctx context.Context, lState *lockState, ptr BlockPointer,
	branch BranchName, pblock *FileBlock,
	off int64, md *RootMetadata) error {
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
		ID:       newRID,
		KeyGen:   md.LatestKeyGeneration(),
		DataVer:  fbo.config.DataVersion(),
		Creator:  uid,
		RefNonce: zeroBlockRefNonce,
	}

	pblock.IPtrs = append(pblock.IPtrs, IndirectFilePtr{
		BlockInfo: BlockInfo{
			BlockPointer: newPtr,
			EncodedSize:  0,
		},
		Off: off,
	})

	if err := fbo.config.BlockCache().PutDirty(
		newPtr, branch, rblock); err != nil {
		return err
	}

	if err = fbo.cacheBlockIfNotYetDirtyLocked(
		lState, ptr, branch, pblock); err != nil {
		return err
	}
	return nil
}

func (fbo *folderBlockOps) getOrCreateSyncInfoLocked(
	lState *lockState, de DirEntry) *syncInfo {
	fbo.blockLock.AssertLocked(lState)
	ref := de.ref()
	si, ok := fbo.unrefCache[ref]
	if !ok {
		si = &syncInfo{
			oldInfo: de.BlockInfo,
			op:      newSyncOp(de.BlockPointer),
		}
		fbo.unrefCache[ref] = si
	}
	return si
}

func (fbo *folderBlockOps) mergeUnrefCacheLocked(
	lState *lockState, file path, md *RootMetadata) {
	fbo.blockLock.AssertRLocked(lState)
	fileRef := file.tailPointer().ref()
	for _, info := range fbo.unrefCache[fileRef].unrefs {
		// it's ok if we push the same ptr.ID/RefNonce multiple times,
		// because the subsequent ones should have a QuotaSize of 0.
		md.AddUnrefBlock(info)
	}
}

// GetDirtyRefs returns a list of references of all known dirty
// blocks.
func (fbo *folderBlockOps) GetDirtyRefs(lState *lockState) []blockRef {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	var dirtyRefs []blockRef
	for ref := range fbo.deCache {
		dirtyRefs = append(dirtyRefs, ref)
	}
	return dirtyRefs
}

// fixChildBlocksAfterRecoverableError should be called when a sync
// failed with a recoverable block error on a multi-block file.  It
// makes sure that any outstanding dirty versions of the file are
// fixed up to reflect the fact that some of the indirect pointers now
// need to change.
func (fbo *folderBlockOps) fixChildBlocksAfterRecoverableError(
	ctx context.Context, lState *lockState, file path,
	redirtyOnRecoverableError map[BlockPointer]BlockPointer) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	bcache := fbo.config.BlockCache()

	// If a copy of the top indirect block was made, we need to
	// redirty all the sync'd blocks under their new IDs, so that
	// future syncs will know they failed.
	state := fbo.fileBlockStates[file.tailPointer()]
	if state != blockSyncingAndDirty {
		return
	}

	topBlock, err := bcache.Get(file.tailPointer(), fbo.branch())
	fblock, ok := topBlock.(*FileBlock)
	if err != nil || !ok {
		fbo.log.CWarningf(ctx, "Couldn't find dirtied "+
			"top-block for %v: %v", file.tailPointer(), err)
		return
	}
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
		// These block would have been permanent,
		// so they're definitely still in the
		// cache
		b, err := bcache.Get(newPtr, fbo.branch())
		if err != nil {
			fbo.log.CWarningf(ctx, "Couldn't re-dirty %v: %v", newPtr, err)
			continue
		}
		err = bcache.PutDirty(newPtr, fbo.branch(), b)
		if err != nil {
			fbo.log.CWarningf(ctx, "Couldn't re-dirty %v: %v", newPtr, err)
		}
		err = bcache.DeleteDirty(oldPtr, fbo.branch())
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

	md.AddOp(newRenameOp(oldName, oldParent.tailPointer(), newName,
		newParent.tailPointer(), newDe.BlockPointer, newDe.Type))

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

// Read reads from the given file into the given buffer at the given
// offset. It returns the number of bytes read and nil, or 0 and the
// error if there was one.
func (fbo *folderBlockOps) Read(
	ctx context.Context, lState *lockState, md *RootMetadata, file path,
	dest []byte, off int64) (int64, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	// getFileLocked already checks read permissions
	fblock, err := fbo.getFileLocked(ctx, lState, md, file, blockRead)
	if err != nil {
		return 0, err
	}

	nRead := int64(0)
	n := int64(len(dest))

	for nRead < n {
		nextByte := nRead + off
		toRead := n - nRead
		_, _, _, block, _, startOff, err := fbo.getFileBlockAtOffsetLocked(
			ctx, lState, md, file, fblock, nextByte, blockRead)
		if err != nil {
			return 0, err
		}
		blockLen := int64(len(block.Contents))
		lastByteInBlock := startOff + blockLen

		if nextByte >= lastByteInBlock {
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
	ctx context.Context, lState *lockState) error {
	// If there is too much unflushed data, we should wait until some
	// of it gets flush so our memory usage doesn't grow without
	// bound.
	bcache := fbo.config.BlockCache()
	var syncBlockingCh chan error
	for {
		overThreshold := func() bool {
			fbo.blockLock.Lock(lState)
			defer fbo.blockLock.Unlock(lState)
			dirtyBytes := bcache.DirtyBytesEstimate()
			if dirtyBytes < dirtyBytesThreshold {
				return false
			}
			fbo.log.CDebugf(ctx, "Blocking a write because of %d dirty bytes",
				dirtyBytes)
			if syncBlockingCh == nil {
				syncBlockingCh = make(chan error, 1)
				fbo.syncListeners =
					append(fbo.syncListeners, syncBlockingCh)
			}
			return true
		}()
		if !overThreshold {
			break
		}

		select {
		// If we can't send on the channel, that means a sync is
		// already in progress
		case fbo.forceSyncChan <- struct{}{}:
		default:
		}

		// Check again periodically, in case some other TLF is hogging
		// all the dirty bytes.
		t := time.NewTimer(100 * time.Millisecond)
		select {
		case err := <-syncBlockingCh:
			syncBlockingCh = nil
			if err != nil {
				// XXX: should we ignore non-fatal errors (like
				// context.Canceled), or errors that are specific only
				// to some other file being sync'd (e.g.,
				// "recoverable" block errors from which we couldn't
				// recover)?
				return err
			}
		case <-t.C:
		case <-ctx.Done():
			return ctx.Err()
		}

		fbo.log.CDebugf(ctx, "Write unblocked")
	}
	return nil
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

// Returns the set of blocks dirtied during this write that might need
// to be cleaned up if the write is deferred.
func (fbo *folderBlockOps) writeDataLocked(
	ctx context.Context, lState *lockState, md *RootMetadata, file path,
	data []byte, off int64) (WriteRange, []BlockPointer, error) {
	fbo.blockLock.AssertLocked(lState)

	if sz := off + int64(len(data)); uint64(sz) > fbo.config.MaxFileBytes() {
		return WriteRange{}, nil, FileTooBigError{file, sz, fbo.config.MaxFileBytes()}
	}

	// check writer status explicitly
	username, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return WriteRange{}, nil, err
	}
	if !md.GetTlfHandle().IsWriter(uid) {
		return WriteRange{}, nil, NewWriteAccessError(md.GetTlfHandle(), username)
	}

	fblock, err := fbo.getFileLocked(ctx, lState, md, file, blockWrite)
	if err != nil {
		return WriteRange{}, nil, err
	}

	bcache := fbo.config.BlockCache()
	bsplit := fbo.config.BlockSplitter()
	n := int64(len(data))
	nCopied := int64(0)

	de, err := fbo.getDirtyEntryLocked(ctx, lState, md, file)
	if err != nil {
		return WriteRange{}, nil, err
	}

	si := fbo.getOrCreateSyncInfoLocked(lState, de)
	var dirtyPtrs []BlockPointer
	for nCopied < n {
		ptr, parentBlock, indexInParent, block, more, startOff, err :=
			fbo.getFileBlockAtOffsetLocked(
				ctx, lState, md, file, fblock,
				off+nCopied, blockWrite)
		if err != nil {
			return WriteRange{}, nil, err
		}

		oldLen := len(block.Contents)
		nCopied += bsplit.CopyUntilSplit(block, !more, data[nCopied:],
			off+nCopied-startOff)

		// the block splitter could only have copied to the end of the
		// existing block (or appended to the end of the final block), so
		// we shouldn't ever hit this case:
		if more && oldLen < len(block.Contents) {
			return WriteRange{}, nil, BadSplitError{}
		}

		// TODO: support multiple levels of indirection.  Right now the
		// code only does one but it should be straightforward to
		// generalize, just annoying

		// if we need another block but there are no more, then make one
		if nCopied < n && !more {
			// If the block doesn't already have a parent block, make one.
			if ptr == file.tailPointer() {
				// pick a new id for this block, and use this block's ID for
				// the parent
				newID, err := fbo.config.Crypto().MakeTemporaryBlockID()
				if err != nil {
					return WriteRange{}, nil, err
				}
				fblock = &FileBlock{
					CommonBlock: CommonBlock{
						IsInd: true,
					},
					IPtrs: []IndirectFilePtr{
						{
							BlockInfo: BlockInfo{
								BlockPointer: BlockPointer{
									ID:       newID,
									KeyGen:   md.LatestKeyGeneration(),
									DataVer:  fbo.config.DataVersion(),
									Creator:  uid,
									RefNonce: zeroBlockRefNonce,
								},
								EncodedSize: 0,
							},
							Off: 0,
						},
					},
				}
				if err := bcache.PutDirty(
					file.tailPointer(), file.Branch, fblock); err != nil {
					return WriteRange{}, nil, err
				}
				ptr = fblock.IPtrs[0].BlockPointer
			}

			// Make a new right block and update the parent's
			// indirect block list
			err := fbo.newRightBlockLocked(ctx, lState, file.tailPointer(),
				file.Branch, fblock, startOff+int64(len(block.Contents)), md)
			if err != nil {
				return WriteRange{}, nil, err
			}
		}

		if oldLen != len(block.Contents) {
			de.EncodedSize = 0
			// update the file info
			de.Size += uint64(len(block.Contents) - oldLen)
			fbo.deCache[file.tailPointer().ref()] = de
		}

		if parentBlock != nil {
			// remember how many bytes it was
			si.unrefs = append(si.unrefs,
				parentBlock.IPtrs[indexInParent].BlockInfo)
			parentBlock.IPtrs[indexInParent].EncodedSize = 0
		}
		// keep the old block ID while it's dirty
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState, ptr, file.Branch,
			block); err != nil {
			return WriteRange{}, nil, err
		}
		dirtyPtrs = append(dirtyPtrs, ptr)
	}

	if fblock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any write to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the fileBlockStates map.
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
			file.tailPointer(), file.Branch, fblock); err != nil {
			return WriteRange{}, nil, err
		}
		dirtyPtrs = append(dirtyPtrs, file.tailPointer())
	}
	latestWrite := si.op.addWrite(uint64(off), uint64(len(data)))

	if d := bcache.DirtyBytesEstimate(); d > dirtyBytesThreshold {
		fbo.log.CDebugf(ctx, "Forcing a sync due to %d dirty bytes", d)
		select {
		// If we can't send on the channel, that means a sync is
		// already in progress
		case fbo.forceSyncChan <- struct{}{}:
		default:
		}
	}

	return latestWrite, dirtyPtrs, nil
}

// Write writes the given data to the given file. May block if there
// is too much unflushed data; in that case, it will be unblocked by a
// future sync (as controlled by NotifyBlockedWrites).
func (fbo *folderBlockOps) Write(
	ctx context.Context, lState *lockState, md *RootMetadata,
	file Node, data []byte, off int64) error {
	if err := fbo.maybeWaitOnDeferredWrites(ctx, lState); err != nil {
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

	latestWrite, dirtyPtrs, err := fbo.writeDataLocked(
		ctx, lState, md, filePath, data, off)
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
			func(ctx context.Context, lState *lockState, rmd *RootMetadata, f path) error {
				// Write the data again.  We know this won't be
				// deferred, so no need to check the new ptrs.
				_, _, err = fbo.writeDataLocked(
					ctx, lState, rmd, f, dataCopy, off)
				return err
			})
	}

	return nil
}

// Returns the set of newly-ID'd blocks created during this truncate
// that might need to be cleaned up if the truncate is deferred.
func (fbo *folderBlockOps) truncateLocked(
	ctx context.Context, lState *lockState, md *RootMetadata,
	file path, size uint64) (*WriteRange, []BlockPointer, error) {
	fbo.blockLock.AssertLocked(lState)

	// check writer status explicitly
	username, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, nil, err
	}
	if !md.GetTlfHandle().IsWriter(uid) {
		return nil, nil, NewWriteAccessError(md.GetTlfHandle(), username)
	}

	fblock, err := fbo.getFileLocked(ctx, lState, md, file, blockWrite)
	if err != nil {
		return nil, nil, err
	}

	// find the block where the file should now end
	iSize := int64(size) // TODO: deal with overflow
	ptr, parentBlock, indexInParent, block, more, startOff, err :=
		fbo.getFileBlockAtOffsetLocked(
			ctx, lState, md, file, fblock, iSize, blockWrite)

	currLen := int64(startOff) + int64(len(block.Contents))
	if currLen < iSize {
		// if we need to extend the file, let's just do a write
		moreNeeded := iSize - currLen
		latestWrite, dirtyPtrs, err := fbo.writeDataLocked(
			ctx, lState, md, file,
			make([]byte, moreNeeded, moreNeeded), currLen)
		if err != nil {
			return nil, nil, err
		}
		return &latestWrite, dirtyPtrs, err
	} else if currLen == iSize {
		// same size!
		return nil, nil, nil
	}

	// update the local entry size
	de, err := fbo.getDirtyEntryLocked(ctx, lState, md, file)
	if err != nil {
		return nil, nil, err
	}

	// otherwise, we need to delete some data (and possibly entire blocks)
	block.Contents = append([]byte(nil), block.Contents[:iSize-startOff]...)

	si := fbo.getOrCreateSyncInfoLocked(lState, de)
	if more {
		// TODO: if indexInParent == 0, we can remove the level of indirection
		for _, ptr := range parentBlock.IPtrs[indexInParent+1:] {
			si.unrefs = append(si.unrefs, ptr.BlockInfo)
		}
		parentBlock.IPtrs = parentBlock.IPtrs[:indexInParent+1]
		// always make the parent block dirty, so we will sync it
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
			file.tailPointer(), file.Branch, parentBlock); err != nil {
			return nil, nil, err
		}
	}

	if fblock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any truncate to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the fileBlockStates map.
		if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
			file.tailPointer(), file.Branch, fblock); err != nil {
			return nil, nil, err
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
	fbo.deCache[file.tailPointer().ref()] = de

	// Keep the old block ID while it's dirty.
	if err = fbo.cacheBlockIfNotYetDirtyLocked(lState,
		ptr, file.Branch, block); err != nil {
		return nil, nil, err
	}

	return &latestWrite, nil, nil
}

// Truncate truncates or extends the given file to the given size.
// May block if there is too much unflushed data; in that case, it
// will be unblocked by a future sync (as controlled by
// NotifyBlockedWrites).
func (fbo *folderBlockOps) Truncate(
	ctx context.Context, lState *lockState, md *RootMetadata,
	file Node, size uint64) error {
	if err := fbo.maybeWaitOnDeferredWrites(ctx, lState); err != nil {
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

	latestWrite, dirtyPtrs, err := fbo.truncateLocked(
		ctx, lState, md, filePath, size)
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
			func(ctx context.Context, lState *lockState, rmd *RootMetadata, f path) error {
				// Truncate the file again.  We know this won't be
				// deferred, so no need to check the new ptrs.
				_, _, err := fbo.truncateLocked(
					ctx, lState, rmd, f, size)
				return err
			})
	}

	return nil
}

// IsDirty returns whether the given file is dirty; if false is
// returned, then the file doesn't need to be synced.
func (fbo *folderBlockOps) IsDirty(lState *lockState, file path) bool {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.config.BlockCache().IsDirty(file.tailPointer(), file.Branch)
}

func (fbo *folderBlockOps) clearCacheInfoLocked(lState *lockState, file path) {
	fbo.blockLock.AssertLocked(lState)
	ref := file.tailPointer().ref()
	delete(fbo.deCache, ref)
	delete(fbo.unrefCache, ref)
}

// ClearCacheInfo removes any cached info for the the given file.
func (fbo *folderBlockOps) ClearCacheInfo(lState *lockState, file path) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	fbo.clearCacheInfoLocked(lState, file)
}

// revertSyncInfoAfterRecoverableError updates the saved sync info to
// include all the blocks from before the error, except for those that
// have encountered recoverable block errors themselves.
func (fbo *folderBlockOps) revertSyncInfoAfterRecoverableError(
	blocksToRemove []BlockPointer, si, savedSi *syncInfo) {
	// This sync will be retried and needs new blocks, so
	// reset everything in the sync info.
	*si = *savedSi
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
func (fbo *folderBlockOps) ReadyBlock(ctx context.Context, md *RootMetadata,
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
		fbo.config.BlockOps().Ready(ctx, md, block)
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
			ID:       id,
			KeyGen:   md.LatestKeyGeneration(),
			DataVer:  fbo.config.DataVersion(),
			Creator:  uid,
			RefNonce: zeroBlockRefNonce,
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

	// redirtyOnRecoverableError, which is non-nil only when
	// fblock is non-nil, contains pointers that need to be
	// re-dirtied if the top block gets copied during the sync,
	// and a recoverable error happens.  Maps to the old block
	// pointer for the block, which would need a DeleteDirty.
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

// startSyncWriteLocked contains the portion of StartSync() that's
// done while write-locking blockLock.
func (fbo *folderBlockOps) startSyncWriteLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, uid keybase1.UID, file path) (
	fblock *FileBlock, bps *blockPutState, syncState fileSyncState,
	err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	// update the parent directories, and write all the new blocks out
	// to disk
	fblock, err = fbo.getFileLocked(ctx, lState, md, file, blockWrite)
	if err != nil {
		return nil, nil, syncState, err
	}

	fileRef := file.tailPointer().ref()
	si, ok := fbo.unrefCache[fileRef]
	if !ok {
		return nil, nil, syncState, fmt.Errorf("No syncOp found for file ref %v", fileRef)
	}

	md.AddOp(si.op)

	// Fill in syncState.
	if fblock.IsInd {
		fblockCopy, err := fblock.DeepCopy(fbo.config.Codec())
		if err != nil {
			return nil, nil, syncState, err
		}
		syncState.fblock = fblock
		syncState.savedFblock = fblockCopy
		syncState.redirtyOnRecoverableError = make(map[BlockPointer]BlockPointer)
	}
	syncState.si = si
	syncState.savedSi, err = si.DeepCopy(fbo.config.Codec())
	if err != nil {
		return nil, nil, syncState, err
	}

	if si.bps == nil {
		si.bps = newBlockPutState(1)
	} else {
		// reinstate byte accounting from the previous Sync
		md.RefBytes = si.refBytes
		md.DiskUsage += si.refBytes
		md.UnrefBytes = si.unrefBytes
		md.DiskUsage -= si.unrefBytes
		syncState.newIndirectFileBlockPtrs = append(
			syncState.newIndirectFileBlockPtrs, si.op.Refs()...)
	}
	defer func() {
		si.refBytes = md.RefBytes
		si.unrefBytes = md.UnrefBytes
	}()

	bcache := fbo.config.BlockCache()

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
			isDirty := bcache.IsDirty(ptr.BlockPointer, file.Branch)
			if (ptr.EncodedSize > 0) && isDirty {
				return nil, nil, syncState, InconsistentEncodedSizeError{ptr.BlockInfo}
			}
			if isDirty {
				_, _, _, block, more, _, err :=
					fbo.getFileBlockAtOffsetLocked(
						ctx, lState, md, file, fblock,
						ptr.Off, blockWrite)
				if err != nil {
					return nil, nil, syncState, err
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
					if !more {
						// need to make a new block
						if err := fbo.newRightBlockLocked(
							ctx, lState, file.tailPointer(), file.Branch, fblock,
							endOfBlock, md); err != nil {
							return nil, nil, syncState, err
						}
					}
					rPtr, _, _, rblock, _, _, err :=
						fbo.getFileBlockAtOffsetLocked(
							ctx, lState, md, file, fblock,
							endOfBlock, blockWrite)
					if err != nil {
						return nil, nil, syncState, err
					}
					rblock.Contents = append(extraBytes, rblock.Contents...)
					if err = fbo.cacheBlockIfNotYetDirtyLocked(
						lState, rPtr, file.Branch, rblock); err != nil {
						return nil, nil, syncState, err
					}
					fblock.IPtrs[i+1].Off = ptr.Off + int64(len(block.Contents))
					md.AddUnrefBlock(fblock.IPtrs[i+1].BlockInfo)
					fblock.IPtrs[i+1].EncodedSize = 0
				case splitAt < 0:
					if !more {
						// end of the line
						continue
					}

					endOfBlock := ptr.Off + int64(len(block.Contents))
					rPtr, _, _, rblock, _, _, err :=
						fbo.getFileBlockAtOffsetLocked(
							ctx, lState, md, file, fblock,
							endOfBlock, blockWrite)
					if err != nil {
						return nil, nil, syncState, err
					}
					// copy some of that block's data into this block
					nCopied := bsplit.CopyUntilSplit(block, false,
						rblock.Contents, int64(len(block.Contents)))
					rblock.Contents = rblock.Contents[nCopied:]
					if len(rblock.Contents) > 0 {
						if err = fbo.cacheBlockIfNotYetDirtyLocked(
							lState, rPtr, file.Branch, rblock); err != nil {
							return nil, nil, syncState, err
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
			isDirty := bcache.IsDirty(localPtr, file.Branch)
			if (ptr.EncodedSize > 0) && isDirty {
				return nil, nil, syncState, InconsistentEncodedSizeError{ptr.BlockInfo}
			}
			if isDirty {
				_, _, _, block, _, _, err := fbo.getFileBlockAtOffsetLocked(
					ctx, lState, md, file, fblock, ptr.Off, blockWrite)
				if err != nil {
					return nil, nil, syncState, err
				}

				newInfo, _, readyBlockData, err :=
					fbo.ReadyBlock(ctx, md, block, uid)
				if err != nil {
					return nil, nil, syncState, err
				}

				syncState.newIndirectFileBlockPtrs = append(syncState.newIndirectFileBlockPtrs, newInfo.BlockPointer)
				err = bcache.Put(newInfo.BlockPointer, fbo.id(), block, PermanentEntry)
				if err != nil {
					return nil, nil, syncState, err
				}

				// Defer the DeleteDirty until after the new path is
				// ready, in case anyone tries to read the dirty file
				// in the meantime.
				syncState.oldFileBlockPtrs =
					append(syncState.oldFileBlockPtrs, localPtr)

				fblock.IPtrs[i].BlockInfo = newInfo
				md.AddRefBlock(newInfo)
				si.bps.addNewBlock(newInfo.BlockPointer, block, readyBlockData)
				fbo.fileBlockStates[localPtr] = blockSyncingNotDirty
				syncState.redirtyOnRecoverableError[newInfo.BlockPointer] = localPtr
			}
		}
	}

	fbo.fileBlockStates[file.tailPointer()] = blockSyncingNotDirty
	syncState.oldFileBlockPtrs = append(syncState.oldFileBlockPtrs, file.tailPointer())
	// TODO: Returning si.bps in this way is racy, since si is a
	// member of unrefCache.
	return fblock, si.bps, syncState, nil
}

func (fbo *folderBlockOps) makeLocalBcache(ctx context.Context,
	lState *lockState, md *RootMetadata, file path, si *syncInfo) (
	lbc localBcache, err error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	parentPath := file.parentPath()

	dblock, err := fbo.getDirLocked(
		ctx, lState, md, *parentPath, blockWrite)
	if err != nil {
		return nil, err
	}

	// add in the cached unref pieces and fixup the dir entry
	fbo.mergeUnrefCacheLocked(lState, file, md)

	fileRef := file.tailPointer().ref()

	lbc = make(localBcache)

	// update the file's directory entry to the cached copy
	if de, ok := fbo.deCache[fileRef]; ok {
		// remember the old info
		de.EncodedSize = si.oldInfo.EncodedSize
		dblock.Children[file.tailName()] = de
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
//			ctx, lState, file, ..., syncState, err)
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
	fblock, bps, syncState, err = fbo.startSyncWriteLocked(
		ctx, lState, md, uid, file)
	if err != nil {
		return nil, nil, nil, syncState, err
	}

	lbc, err = fbo.makeLocalBcache(ctx, lState, md, file, syncState.si)
	if err != nil {
		return nil, nil, nil, syncState, err
	}
	return fblock, bps, lbc, syncState, err
}

// Does any clean-up for a sync of the given file, given an error
// (which may be nil) that happens during or after StartSync() and
// before FinishSync(). blocksToRemove may be nil.
func (fbo *folderBlockOps) CleanupSyncState(
	ctx context.Context, lState *lockState,
	file path, blocksToRemove []BlockPointer,
	result fileSyncState, err error) {
	if err == nil {
		return
	}

	// If there was an error, we need to back out any changes that
	// might have been filled into the sync op, because it could
	// get reused again in a later Sync call.
	if result.si != nil {
		result.si.op.resetUpdateState()
	}
	if isRecoverableBlockError(err) {
		if result.si != nil {
			fbo.revertSyncInfoAfterRecoverableError(
				blocksToRemove, result.si, result.savedSi)
		}
		if result.fblock != nil {
			*result.fblock = *result.savedFblock
			fbo.fixChildBlocksAfterRecoverableError(
				ctx, lState, file,
				result.redirtyOnRecoverableError)
		}
	}

	// The sync is over, due to an error, so reset the map so that we
	// don't defer any subsequent writes.
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	fbo.fileBlockStates = make(map[BlockPointer]syncBlockState)

	// TODO: Clear deferredWrites and deferredDirtyDeletes?
}

// FinishSync finishes the sync process for a file, given the state
// from StartSync. Specifically, it re-applies any writes that
// happened since the call to StartSync.
func (fbo *folderBlockOps) FinishSync(
	ctx context.Context, lState *lockState,
	oldPath, newPath path, md *RootMetadata,
	syncState fileSyncState) (stillDirty bool, err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	bcache := fbo.config.BlockCache()

	for _, ptr := range syncState.oldFileBlockPtrs {
		if err := bcache.DeleteDirty(ptr, fbo.branch()); err != nil {
			return true, err
		}
	}

	for _, ptr := range syncState.newIndirectFileBlockPtrs {
		err := bcache.DeletePermanent(ptr.ID)
		if err != nil {
			fbo.log.CWarningf(ctx, "Error when deleting %v from cache: %v", ptr.ID, err)
		}
	}

	fbo.fileBlockStates = make(map[BlockPointer]syncBlockState)
	// Redo any writes or truncates that happened to our file while
	// the sync was happening.
	deletes := fbo.deferredDirtyDeletes
	writes := fbo.deferredWrites
	stillDirty = len(fbo.deferredWrites) != 0
	fbo.deferredDirtyDeletes = nil
	fbo.deferredWrites = nil

	// Clear any dirty blocks that resulted from a write/truncate
	// happening during the sync, since we're redoing them below.
	for _, ptr := range deletes {
		if err := bcache.DeleteDirty(ptr, fbo.branch()); err != nil {
			return true, err
		}
	}

	// Clear cached info for the old path.  We are guaranteed that
	// any concurrent write to this file was deferred, even if it
	// was to a block that wasn't currently being sync'd, since
	// the top-most block is always in fileBlockStates and is
	// always dirtied during a write/truncate.
	//
	// Also, we can get rid of all the sync state that might have
	// happened during the sync, since we will replay the writes
	// below anyway.
	fbo.clearCacheInfoLocked(lState, oldPath)

	for _, f := range writes {
		err = f(ctx, lState, md, newPath)
		if err != nil {
			// It's a little weird to return an error from a deferred
			// write here. Hopefully that will never happen.
			return true, err
		}
	}

	return stillDirty, nil
}

// NotifyBlockedWrites notifies any write operations that are blocked
// so that they can check if they can be unblocked. Should be called
// after a sync.
func (fbo *folderBlockOps) NotifyBlockedWrites(lState *lockState, err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	listeners := fbo.syncListeners
	fbo.syncListeners = nil
	for _, listener := range listeners {
		listener <- err
	}
}

// searchForNodesInDirLocked recursively tries to find a path, and
// ultimately a node, to ptr, given the set of pointers that were
// updated in a particular operation.  The keys in nodeMap make up the
// set of BlockPointers that are being searched for, and nodeMap is
// updated in place to include the corresponding discovered nodes.
//
// Returns the number of nodes found by this invocation.
func (fbo *folderBlockOps) searchForNodesInDirLocked(ctx context.Context,
	lState *lockState, cache NodeCache, newPtrs map[BlockPointer]bool,
	md *RootMetadata, currDir path, nodeMap map[BlockPointer]Node,
	numNodesFoundSoFar int) (int, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	dirBlock, err := fbo.getDirLocked(
		ctx, lState, md, currDir, blockRead)
	if err != nil {
		return 0, err
	}

	if numNodesFoundSoFar >= len(nodeMap) {
		return 0, nil
	}

	numNodesFound := 0
	for name, de := range dirBlock.Children {
		if _, ok := nodeMap[de.BlockPointer]; ok {
			childPath := currDir.ChildPath(name, de.BlockPointer)
			// make a node for every pathnode
			var n Node
			for _, pn := range childPath.path {
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
			n, err := fbo.searchForNodesInDirLocked(ctx, lState, cache, newPtrs, md,
				childPath, nodeMap, numNodesFoundSoFar+numNodesFound)
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

// SearchForNodes tries to resolve all the given pointers to a Node
// object, using only the updated pointers specified in newPtrs.
// Returns an error if any subset of the pointer paths do not exist;
// it is the caller's responsibility to decide to error on particular
// unresolved nodes.
func (fbo *folderBlockOps) SearchForNodes(ctx context.Context,
	cache NodeCache, ptrs []BlockPointer, newPtrs map[BlockPointer]bool,
	md *RootMetadata) (map[BlockPointer]Node, error) {
	lState := makeFBOLockState()
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	nodeMap := make(map[BlockPointer]Node)
	for _, ptr := range ptrs {
		nodeMap[ptr] = nil
	}

	if len(ptrs) == 0 {
		return nodeMap, nil
	}

	// Start with the root node
	rootPtr := md.data.Dir.BlockPointer
	var node Node
	if cache == fbo.nodeCache {
		// Root node should already exist.
		node = cache.Get(rootPtr.ref())
	} else {
		// Root node may or may not exist.
		var err error
		node, err = cache.GetOrCreate(rootPtr,
			string(md.GetTlfHandle().GetCanonicalName()), nil)
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
			md.data.Dir.BlockPointer, rootPath)
	}

	_, err := fbo.searchForNodesInDirLocked(ctx, lState, cache, newPtrs, md, rootPath,
		nodeMap, numNodesFound)
	if err != nil {
		return nil, err
	}

	// Return the whole map even if some nodes weren't found.
	return nodeMap, nil
}

// getUndirtiedEntry returns the clean entry for the given path
// corresponding to a cached dirty entry. If there is no dirty or
// clean entry, nil is returned.
func (fbo *folderBlockOps) getUndirtiedEntry(
	ctx context.Context, lState *lockState, md *RootMetadata,
	file path) (*DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	_, ok := fbo.deCache[file.tailPointer().ref()]
	if !ok {
		return nil, nil
	}

	// Get the undirtied dir block.
	dblock, err := fbo.getDirLocked(
		ctx, lState, md, *file.parentPath(), blockRead)
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
	ref blockRef, op *setAttrOp, realEntry *DirEntry) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	fileEntry, ok := fbo.deCache[ref]
	if !ok {
		return
	}

	switch op.Attr {
	case exAttr:
		fileEntry.Type = realEntry.Type
	case mtimeAttr:
		fileEntry.Mtime = realEntry.Mtime
	}
	fbo.deCache[ref] = fileEntry
}

// UpdateCachedEntryAttributes updates any cached entry for the given
// path according to the given op. The node for the path is returned
// if there is one.
func (fbo *folderBlockOps) UpdateCachedEntryAttributes(
	ctx context.Context, lState *lockState, md *RootMetadata,
	dir path, op *setAttrOp) (Node, error) {
	childPath := dir.ChildPathNoPtr(op.Name)

	// find the node for the actual change; requires looking up
	// the child entry to get the BlockPointer, unfortunately.
	de, err := fbo.GetDirtyEntry(ctx, lState, md, childPath)
	if err != nil {
		return nil, err
	}

	childNode := fbo.nodeCache.Get(de.ref())
	if childNode == nil {
		// Nothing to do, since the cache entry won't be
		// accessible from any node.
		return nil, nil
	}

	childPath = dir.ChildPath(op.Name, de.BlockPointer)

	// If there's a cache entry, we need to update it, so try and
	// fetch the undirtied entry.
	cleanEntry, err := fbo.getUndirtiedEntry(ctx, lState, md, childPath)
	if err != nil {
		return nil, err
	}

	if cleanEntry != nil {
		fbo.setCachedAttr(ctx, lState, de.ref(), op, cleanEntry)
	}

	return childNode, nil
}

func (fbo *folderBlockOps) getDeferredWriteCountForTest(lState *lockState) int {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return len(fbo.deferredWrites)
}
