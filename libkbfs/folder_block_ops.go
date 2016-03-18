package libkbfs

import (
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

func (si *syncInfo) DeepCopy() *syncInfo {
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
		newSi.op = si.op.DeepCopy()
	}
	return newSi
}

// folderBlockOps contains all the fields that must be synchronized by
// blockLock. It will eventually also contain all the methods that
// must be synchronized by blockLock, so that folderBranchOps will
// have no knowledge of blockLock.
type folderBlockOps struct {
	config       Config
	log          logger.Logger
	folderBranch FolderBranch

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
			fblock = fblock.DeepCopy()
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
		dblock = dblock.DeepCopy()
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
	lState *lockState, block *DirBlock) *DirBlock {
	fbo.blockLock.AssertAnyLocked(lState)
	// see if this directory has any outstanding writes/truncates that
	// require an updated DirEntry

	// Save some time for the common case of having no dirty
	// files.
	if len(fbo.deCache) == 0 {
		return block
	}

	var dblockCopy *DirBlock
	var uid keybase1.UID
	var uidErr error

	for k, v := range block.Children {
		de, ok := fbo.deCache[v.ref()]
		if !ok {
			continue
		}

		if dblockCopy == nil {
			dblockCopy = block.DeepCopy()
			// If there's an error, just log it and keep
			// going because having the correct writer is
			// not important enough to fail the whole
			// lookup.
			_, uid, uidErr = fbo.config.KBPKI().GetCurrentUserInfo(ctx)
			if uidErr != nil {
				fbo.log.CDebugf(ctx, "Ignoring error while getting "+
					"logged-in user during directory entry lookup: %v", uidErr)
			}
		}

		if uidErr == nil {
			de.SetWriter(uid)
		}

		dblockCopy.Children[k] = de
	}

	if dblockCopy == nil {
		return block
	}

	return dblockCopy
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

	dblock = fbo.updateWithDirtyEntriesLocked(ctx, lState, dblock)
	return dblock, nil
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
		// its new ID already.
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

// FixChildBlocksAfterRecoverableError should be called when a sync
// failed with a recoverable block error on a multi-block file.  It
// makes sure that any outstanding dirty versions of the file are
// fixed up to reflect the fact that some of the indirect pointers now
// need to change.
//
// blockLock may or may not be held, indicated by doLock.
func (fbo *folderBlockOps) FixChildBlocksAfterRecoverableError(
	ctx context.Context, doLock bool, lState *lockState, file path,
	redirtyOnRecoverableError map[BlockPointer]BlockPointer) {
	if doLock {
		fbo.blockLock.Lock(lState)
		defer fbo.blockLock.Unlock(lState)
	} else {
		fbo.blockLock.AssertLocked(lState)
	}

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
