// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	pathlib "path"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type overallBlockState int

const (
	// cleanState: no outstanding local writes.
	cleanState overallBlockState = iota
	// dirtyState: there are outstanding local writes that haven't yet been
	// synced.
	dirtyState
)

const (
	// numBlockSizeWorkersMax is the max number of workers to use when
	// fetching a set of block sizes.
	numBlockSizeWorkersMax = 50
	// How many pointers to downgrade in a single block size call.
	numBlockSizesPerChunk = 20
	// truncateExtendCutoffPoint is the amount of data in extending
	// truncate that will trigger the extending with a hole algorithm.
	truncateExtendCutoffPoint = 128 * 1024
)

type mdToCleanIfUnused struct {
	md  ReadOnlyRootMetadata
	bps blockPutStateCopiable
}

type syncInfo struct {
	oldInfo         data.BlockInfo
	op              *syncOp
	unrefs          []data.BlockInfo
	bps             blockPutStateCopiable
	refBytes        uint64
	unrefBytes      uint64
	toCleanIfUnused []mdToCleanIfUnused
}

func (si *syncInfo) DeepCopy(
	ctx context.Context, codec kbfscodec.Codec) (newSi *syncInfo, err error) {
	newSi = &syncInfo{
		oldInfo:    si.oldInfo,
		refBytes:   si.refBytes,
		unrefBytes: si.unrefBytes,
	}
	newSi.unrefs = make([]data.BlockInfo, len(si.unrefs))
	copy(newSi.unrefs, si.unrefs)
	if si.bps != nil {
		newSi.bps, err = si.bps.deepCopy(ctx)
		if err != nil {
			return nil, err
		}
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
		newSi.toCleanIfUnused[i].bps, err = toClean.bps.deepCopy(ctx)
		if err != nil {
			return nil, err
		}
	}
	return newSi, nil
}

func (si *syncInfo) removeReplacedBlock(ctx context.Context,
	log logger.Logger, ptr data.BlockPointer) {
	for i, ref := range si.op.RefBlocks {
		if ref == ptr {
			log.CDebugf(ctx, "Replacing old ref %v", ptr)
			si.op.RefBlocks = append(si.op.RefBlocks[:i],
				si.op.RefBlocks[i+1:]...)
			for j, unref := range si.unrefs {
				if unref.BlockPointer == ptr {
					si.unrefs = append(si.unrefs[:j], si.unrefs[j+1:]...)
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

type deferredState struct {
	// Writes and truncates for blocks that were being sync'd, and
	// need to be replayed after the sync finishes on top of the new
	// versions of the blocks.
	writes []func(
		context.Context, *kbfssync.LockState, KeyMetadataWithRootDirEntry,
		data.Path) error
	// Blocks that need to be deleted from the dirty cache before any
	// deferred writes are replayed.
	dirtyDeletes []data.BlockPointer
	waitBytes    int64
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
//   - New writes to a file are "deferred" while a Sync is happening, and
//     are replayed after the Sync finishes.
//   - Syncs can be canceled or error out halfway through syncing the blocks,
//     leaving the file in a dirty state until the next Sync.
//   - Syncs can fail with a /recoverable/ error, in which case they get
//     retried automatically by folderBranchOps.  In that case, the retried
//     Sync also sucks in any outstanding deferred writes.
//
// With all that in mind, here is the rough breakdown of how this
// bytes-tracking is implemented:
//   - On a Write/Truncate to a block, folderBranchOps counts all the
//     newly-dirtied bytes in a file as "unsynced".  That is, if the block was
//     already in the dirty cache (and not already being synced), only
//     extensions to the block count as "unsynced" bytes.
//   - When a Sync starts, dirtyFile remembers the total of bytes being synced,
//     and the size of each block being synced.
//   - When each block put finishes successfully, dirtyFile subtracts the size
//     of that block from "unsynced".
//   - When a Sync finishes successfully, the total sum of bytes in that sync
//     are subtracted from the "total" dirty bytes outstanding.
//   - If a Sync fails, but some blocks were put successfully, those blocks
//     are "re-dirtied", which means they count as unsynced bytes again.
//     dirtyFile handles this.
//   - When a Write/Truncate is deferred due to an ongoing Sync, its bytes
//     still count towards the "unsynced" total.  In fact, this essentially
//     creates a new copy of those blocks, and the whole size of that block
//     (not just the newly-dirtied bytes) count for the total.  However,
//     when the write gets replayed, folderBlockOps first subtracts those bytes
//     from the system-wide numbers, since they are about to be replayed.
//   - When a Sync is retried after a recoverable failure, dirtyFile adds
//     the newly-dirtied deferred bytes to the system-wide numbers, since they
//     are now being assimilated into this Sync.
//   - dirtyFile also exposes a concept of "orphaned" blocks.  These are child
//     blocks being synced that are now referenced via a new, permanent block
//     ID from the parent indirect block.  This matters for when hard failures
//     occur during a Sync -- the blocks will no longer be accessible under
//     their previous old pointers, and so dirtyFile needs to know their old
//     bytes can be cleaned up now.
type folderBlockOps struct {
	config       Config
	log          logger.Logger
	vlog         *libkb.VDebugLog
	folderBranch data.FolderBranch
	observers    *observerList

	// forceSyncChan can be sent on to trigger an immediate
	// Sync().  It is a blocking channel.
	forceSyncChan chan<- struct{}

	// protects access to blocks in this folder and all fields
	// below.
	blockLock blockLock

	// Which files are currently dirty and have dirty blocks that are either
	// currently syncing, or waiting to be sync'd.
	dirtyFiles map[data.BlockPointer]*data.DirtyFile

	// For writes and truncates, track the unsynced to-be-unref'd
	// block infos, per-path.
	unrefCache map[data.BlockRef]*syncInfo

	// dirtyDirs track which directories are currently dirty in this
	// TLF.
	dirtyDirs          map[data.BlockPointer][]data.BlockInfo
	dirtyDirsSyncing   bool
	deferredDirUpdates []func(lState *kbfssync.LockState) error

	// dirtyRootDirEntry is a DirEntry representing the root of the
	// TLF (to be copied into the RootMetadata on a sync).
	dirtyRootDirEntry *data.DirEntry

	chargedTo keybase1.UserOrTeamID

	// Track deferred operations on a per-file basis.
	deferred map[data.BlockRef]deferredState

	// set to true if this write or truncate should be deferred
	doDeferWrite bool

	// While this channel is non-nil and non-closed, writes get blocked.
	holdNewWritesCh <-chan struct{}

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

func (fbo *folderBlockOps) branch() data.BranchName {
	return fbo.folderBranch.Branch
}

func (fbo *folderBlockOps) isSyncedTlf() bool {
	return fbo.branch() == data.MasterBranch && fbo.config.IsSyncedTlf(fbo.id())
}

// GetState returns the overall block state of this TLF.
func (fbo *folderBlockOps) GetState(
	lState *kbfssync.LockState) overallBlockState {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	if len(fbo.dirtyFiles) == 0 && len(fbo.dirtyDirs) == 0 &&
		fbo.dirtyRootDirEntry == nil {
		return cleanState
	}
	return dirtyState
}

// getCleanEncodedBlockSizesLocked retrieves the encoded sizes and
// block statuses of the clean blocks pointed to each of the block
// pointers in `ptrs`, which must be valid, either from the cache or
// from the server.  If `rtype` is `blockReadParallel`, it's assumed
// that some coordinating goroutine is holding the correct locks, and
// in that case `lState` must be `nil`.
func (fbo *folderBlockOps) getCleanEncodedBlockSizesLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	ptrs []data.BlockPointer, branch data.BranchName,
	rtype data.BlockReqType, assumeCacheIsLive bool) (
	sizes []uint32, statuses []keybase1.BlockStatus, err error) {
	if rtype != data.BlockReadParallel {
		if rtype == data.BlockWrite {
			panic("Cannot get the size of a block for writing")
		}
		fbo.blockLock.AssertAnyLocked(lState)
	} else if lState != nil {
		panic("Non-nil lState passed to getCleanEncodedBlockSizeLocked " +
			"with blockReadParallel")
	}

	sizes = make([]uint32, len(ptrs))
	statuses = make([]keybase1.BlockStatus, len(ptrs))
	var toFetchIndices []int
	var ptrsToFetch []data.BlockPointer
	for i, ptr := range ptrs {
		if !ptr.IsValid() {
			return nil, nil, InvalidBlockRefError{ptr.Ref()}
		}

		if assumeCacheIsLive {
			// If we're assuming all blocks in the cache are live, we just
			// need to get the block size, which we can do from either one
			// of the caches.
			if block, err := fbo.config.BlockCache().Get(ptr); err == nil {
				sizes[i] = block.GetEncodedSize()
				statuses[i] = keybase1.BlockStatus_LIVE
				continue
			}
			if diskBCache := fbo.config.DiskBlockCache(); diskBCache != nil {
				cacheType := DiskBlockAnyCache
				if fbo.isSyncedTlf() {
					cacheType = DiskBlockSyncCache
				}
				if buf, _, _, err := diskBCache.Get(
					ctx, fbo.id(), ptr.ID, cacheType); err == nil {
					sizes[i] = uint32(len(buf))
					statuses[i] = keybase1.BlockStatus_LIVE
					continue
				}
			}
		}

		if err := checkDataVersion(fbo.config, data.Path{}, ptr); err != nil {
			return nil, nil, err
		}

		// Fetch this block from the server.
		ptrsToFetch = append(ptrsToFetch, ptr)
		toFetchIndices = append(toFetchIndices, i)
	}

	defer func() {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "GetEncodedSizes ptrs=%v sizes=%d statuses=%s: "+
				"%+v", ptrs, sizes, statuses, err)
		if err != nil {
			return
		}

		// In certain testing situations, a block might be represented
		// with a 0 size in our journal or be missing from our local
		// data stores, and we need to reconstruct the size using the
		// cache in order to make the accounting work out for the test.
		for i, ptr := range ptrs {
			if sizes[i] == 0 {
				if block, cerr := fbo.config.BlockCache().Get(
					ptr); cerr == nil {
					fbo.vlog.CLogf(
						ctx, libkb.VLog1,
						"Fixing encoded size of %v with cached copy", ptr)
					sizes[i] = block.GetEncodedSize()
				}
			}
		}
	}()

	// Unlock the blockLock while we wait for the network, only if
	// it's locked for reading by a single goroutine.  If it's locked
	// for writing, that indicates we are performing an atomic write
	// operation, and we need to ensure that nothing else comes in and
	// modifies the blocks, so don't unlock.
	//
	// If there may be multiple goroutines fetching blocks under the
	// same lState, we can't safely unlock since some of the other
	// goroutines may be operating on the data assuming they have the
	// lock.
	bops := fbo.config.BlockOps()
	var fetchedSizes []uint32
	var fetchedStatuses []keybase1.BlockStatus
	if rtype != data.BlockReadParallel && rtype != data.BlockLookup {
		fbo.blockLock.DoRUnlockedIfPossible(lState, func(*kbfssync.LockState) {
			fetchedSizes, fetchedStatuses, err = bops.GetEncodedSizes(
				ctx, kmd, ptrsToFetch)
		})
	} else {
		fetchedSizes, fetchedStatuses, err = bops.GetEncodedSizes(
			ctx, kmd, ptrsToFetch)
	}
	if err != nil {
		return nil, nil, err
	}

	for i, j := range toFetchIndices {
		sizes[j] = fetchedSizes[i]
		statuses[j] = fetchedStatuses[i]
	}

	return sizes, statuses, nil
}

// getBlockHelperLocked retrieves the block pointed to by ptr, which
// must be valid, either from the cache or from the server. If
// notifyPath is valid and the block isn't cached, trigger a read
// notification.  If `rtype` is `blockReadParallel`, it's assumed that
// some coordinating goroutine is holding the correct locks, and
// in that case `lState` must be `nil`.
//
// This must be called only by get{File,Dir}BlockHelperLocked().
func (fbo *folderBlockOps) getBlockHelperLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptr data.BlockPointer,
	branch data.BranchName, newBlock makeNewBlock, lifetime data.BlockCacheLifetime,
	notifyPath data.Path, rtype data.BlockReqType) (data.Block, error) {
	if rtype != data.BlockReadParallel {
		fbo.blockLock.AssertAnyLocked(lState)
	} else if lState != nil {
		panic("Non-nil lState passed to getBlockHelperLocked " +
			"with blockReadParallel")
	}

	if !ptr.IsValid() {
		return nil, InvalidBlockRefError{ptr.Ref()}
	}

	if block, err := fbo.config.DirtyBlockCache().Get(
		ctx, fbo.id(), ptr, branch); err == nil {
		return block, nil
	}

	if block, lifetime, err := fbo.config.BlockCache().GetWithLifetime(ptr); err == nil {
		if lifetime != data.PermanentEntry {
			// If the block was cached in the past, and is not a permanent
			// block (i.e., currently being written by the user), we need
			// to handle it as if it's an on-demand request so that its
			// downstream prefetches are triggered correctly according to
			// the new on-demand fetch priority.
			action := fbo.config.Mode().DefaultBlockRequestAction()
			if fbo.isSyncedTlf() {
				action = action.AddSync()
			}
			prefetchStatus := fbo.config.PrefetchStatus(ctx, fbo.id(), ptr)
			fbo.config.BlockOps().Prefetcher().ProcessBlockForPrefetch(ctx, ptr,
				block, kmd, defaultOnDemandRequestPriority-1, lifetime,
				prefetchStatus, action)
		}
		return block, nil
	}

	if err := checkDataVersion(fbo.config, notifyPath, ptr); err != nil {
		return nil, err
	}

	if notifyPath.IsValidForNotification() {
		fbo.config.Reporter().Notify(ctx, readNotification(notifyPath, false))
		defer fbo.config.Reporter().Notify(ctx,
			readNotification(notifyPath, true))
	}

	// Unlock the blockLock while we wait for the network, only if
	// it's locked for reading by a single goroutine.  If it's locked
	// for writing, that indicates we are performing an atomic write
	// operation, and we need to ensure that nothing else comes in and
	// modifies the blocks, so don't unlock.
	//
	// If there may be multiple goroutines fetching blocks under the
	// same lState, we can't safely unlock since some of the other
	// goroutines may be operating on the data assuming they have the
	// lock.
	// fetch the block, and add to cache
	block := newBlock()
	bops := fbo.config.BlockOps()
	var err error
	if rtype != data.BlockReadParallel && rtype != data.BlockLookup {
		fbo.blockLock.DoRUnlockedIfPossible(lState, func(*kbfssync.LockState) {
			err = bops.Get(ctx, kmd, ptr, block, lifetime, fbo.branch())
		})
	} else {
		err = bops.Get(ctx, kmd, ptr, block, lifetime, fbo.branch())
	}
	if err != nil {
		return nil, err
	}

	return block, nil
}

// getFileBlockHelperLocked retrieves the block pointed to by ptr,
// which must be valid, either from an internal cache, the block
// cache, or from the server. An error is returned if the retrieved
// block is not a file block.  If `rtype` is `blockReadParallel`, it's
// assumed that some coordinating goroutine is holding the correct
// locks, and in that case `lState` must be `nil`.
//
// This must be called only by GetFileBlockForReading(),
// getFileBlockLocked(), and getFileLocked().
//
// p is used only when reporting errors and sending read
// notifications, and can be empty.
func (fbo *folderBlockOps) getFileBlockHelperLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptr data.BlockPointer,
	branch data.BranchName, p data.Path, rtype data.BlockReqType) (
	*data.FileBlock, error) {
	if rtype != data.BlockReadParallel {
		fbo.blockLock.AssertAnyLocked(lState)
	} else if lState != nil {
		panic("Non-nil lState passed to getFileBlockHelperLocked " +
			"with blockReadParallel")
	}

	block, err := fbo.getBlockHelperLocked(
		ctx, lState, kmd, ptr, branch, data.NewFileBlock, data.TransientEntry, p, rtype)
	if err != nil {
		return nil, err
	}

	fblock, ok := block.(*data.FileBlock)
	if !ok {
		return nil, NotFileBlockError{ptr, branch, p}
	}

	return fblock, nil
}

// GetCleanEncodedBlocksSizeSum retrieves the sum of the encoded sizes
// of the blocks pointed to by ptrs, all of which must be valid,
// either from the cache or from the server.
//
// The caller can specify a set of pointers using
// `ignoreRecoverableForRemovalErrors` for which "recoverable" fetch
// errors are tolerated.  In that case, the returned sum will not
// include the size for any pointers in the
// `ignoreRecoverableForRemovalErrors` set that hit such an error.
//
// This should be called for "internal" operations, like conflict
// resolution and state checking, which don't know what kind of block
// the pointers refer to.  Any downloaded blocks will not be cached,
// if they weren't in the cache already.
//
// If `onlyCountIfLive` is true, the sum includes blocks that the
// bserver thinks are currently reachable from the merged branch
// (i.e., un-archived).
func (fbo *folderBlockOps) GetCleanEncodedBlocksSizeSum(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptrs []data.BlockPointer,
	ignoreRecoverableForRemovalErrors map[data.BlockPointer]bool,
	branch data.BranchName, onlyCountIfLive bool) (uint64, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	ptrCh := make(chan []data.BlockPointer, len(ptrs))
	sumCh := make(chan uint32, len(ptrs))

	numChunks := (len(ptrs) + numBlockSizesPerChunk - 1) /
		numBlockSizesPerChunk
	numWorkers := numBlockSizeWorkersMax
	if numChunks < numWorkers {
		numWorkers = numChunks
	}

	currChunk := make([]data.BlockPointer, 0, numBlockSizesPerChunk)
	for _, ptr := range ptrs {
		currChunk = append(currChunk, ptr)
		if len(currChunk) == numBlockSizesPerChunk {
			ptrCh <- currChunk
			currChunk = make([]data.BlockPointer, 0, numBlockSizesPerChunk)
		}
	}
	if len(currChunk) > 0 {
		ptrCh <- currChunk
	}

	// If we don't care if something's live or not, there's no reason
	// not to use the cached block.
	assumeCacheIsLive := !onlyCountIfLive
	eg, groupCtx := errgroup.WithContext(ctx)
	for i := 0; i < numWorkers; i++ {
		eg.Go(func() error {
			for ptrs := range ptrCh {
				sizes, statuses, err := fbo.getCleanEncodedBlockSizesLocked(
					groupCtx, nil, kmd, ptrs, branch,
					data.BlockReadParallel, assumeCacheIsLive)
				for i, ptr := range ptrs {
					// TODO: we might be able to recover the size of the
					// top-most block of a removed file using the merged
					// directory entry, the same way we do in
					// `folderBranchOps.unrefEntry`.
					if isRecoverableBlockErrorForRemoval(err) &&
						ignoreRecoverableForRemovalErrors[ptr] {
						fbo.log.CDebugf(
							groupCtx, "Hit an ignorable, recoverable "+
								"error for block %v: %v", ptr, err)
						continue
					}
					if err != nil {
						return err
					}

					if onlyCountIfLive &&
						statuses[i] != keybase1.BlockStatus_LIVE {
						sumCh <- 0
					} else {
						sumCh <- sizes[i]
					}
				}
			}
			return nil
		})
	}
	close(ptrCh)

	if err := eg.Wait(); err != nil {
		return 0, err
	}
	close(sumCh)

	var sum uint64
	for size := range sumCh {
		sum += uint64(size)
	}
	return sum, nil
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
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptr data.BlockPointer,
	branch data.BranchName, p data.Path, rtype data.BlockReqType) (*data.DirBlock, error) {
	if rtype != data.BlockReadParallel {
		fbo.blockLock.AssertAnyLocked(lState)
	}

	// Check data version explicitly here, with the right path, since
	// we pass an empty path below.
	if err := checkDataVersion(fbo.config, p, ptr); err != nil {
		return nil, err
	}

	// Pass in an empty notify path because notifications should only
	// trigger for file reads.
	block, err := fbo.getBlockHelperLocked(
		ctx, lState, kmd, ptr, branch, data.NewDirBlock, data.TransientEntry,
		data.Path{}, rtype)
	if err != nil {
		return nil, err
	}

	dblock, ok := block.(*data.DirBlock)
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
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptr data.BlockPointer,
	branch data.BranchName, p data.Path) (*data.FileBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getFileBlockHelperLocked(
		ctx, lState, kmd, ptr, branch, p, data.BlockRead)
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
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptr data.BlockPointer,
	branch data.BranchName, p data.Path) (*data.DirBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getDirBlockHelperLocked(
		ctx, lState, kmd, ptr, branch, p, data.BlockRead)
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
// blockWrite, and must be r-locked when rtype == blockRead.  (This
// differs from getDirLocked.)  This is because a write operation
// (like write, truncate and sync which lock blockLock) fetching a
// file block will almost always need to modify that block, and so
// will pass in blockWrite.  If rtype == blockReadParallel, it's
// assumed that some coordinating goroutine is holding the correct
// locks, and in that case `lState` must be `nil`.
//
// file is used only when reporting errors and sending read
// notifications, and can be empty except that file.Branch must be set
// correctly.
//
// This method also returns whether the block was already dirty.
func (fbo *folderBlockOps) getFileBlockLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptr data.BlockPointer,
	file data.Path, rtype data.BlockReqType) (
	fblock *data.FileBlock, wasDirty bool, err error) {
	switch rtype {
	case data.BlockRead:
		fbo.blockLock.AssertRLocked(lState)
	case data.BlockWrite:
		fbo.blockLock.AssertLocked(lState)
	case data.BlockReadParallel:
		// This goroutine might not be the official lock holder, so
		// don't make any assertions.
		if lState != nil {
			panic("Non-nil lState passed to getFileBlockLocked " +
				"with blockReadParallel")
		}
	case data.BlockLookup:
		panic("blockLookup should only be used for directory blocks")
	default:
		panic(fmt.Sprintf("Unknown block req type: %d", rtype))
	}

	fblock, err = fbo.getFileBlockHelperLocked(
		ctx, lState, kmd, ptr, file.Branch, file, rtype)
	if err != nil {
		return nil, false, err
	}

	wasDirty = fbo.config.DirtyBlockCache().IsDirty(fbo.id(), ptr, file.Branch)
	if rtype == data.BlockWrite {
		// Copy the block if it's for writing, and either the
		// block is not yet dirty or the block is currently
		// being sync'd and needs a copy even though it's
		// already dirty.
		df := fbo.dirtyFiles[file.TailPointer()]
		if !wasDirty || (df != nil && df.BlockNeedsCopy(ptr)) {
			fblock = fblock.DeepCopy()
		}
	}
	return fblock, wasDirty, nil
}

// getFileLocked is getFileBlockLocked called with file.tailPointer().
func (fbo *folderBlockOps) getFileLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, file data.Path,
	rtype data.BlockReqType) (*data.FileBlock, error) {
	// Callers should have already done this check, but it doesn't
	// hurt to do it again.
	if !file.IsValid() {
		return nil, errors.WithStack(InvalidPathError{file})
	}
	fblock, _, err := fbo.getFileBlockLocked(
		ctx, lState, kmd, file.TailPointer(), file, rtype)
	return fblock, err
}

func (fbo *folderBlockOps) getIndirectFileBlockInfosLocked(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	file data.Path) ([]data.BlockInfo, error) {
	fbo.blockLock.AssertRLocked(lState)
	var id keybase1.UserOrTeamID // Data reads don't depend on the id.
	fd := fbo.newFileData(lState, file, id, kmd)
	return fd.GetIndirectFileBlockInfos(ctx)
}

// GetIndirectFileBlockInfos returns a list of BlockInfos for all
// indirect blocks of the given file. If the returned error is a
// recoverable one (as determined by
// isRecoverableBlockErrorForRemoval), the returned list may still be
// non-empty, and holds all the BlockInfos for all found indirect
// blocks.
func (fbo *folderBlockOps) GetIndirectFileBlockInfos(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, file data.Path) (
	[]data.BlockInfo, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getIndirectFileBlockInfosLocked(ctx, lState, kmd, file)
}

// GetIndirectDirBlockInfos returns a list of BlockInfos for all
// indirect blocks of the given directory. If the returned error is a
// recoverable one (as determined by
// isRecoverableBlockErrorForRemoval), the returned list may still be
// non-empty, and holds all the BlockInfos for all found indirect
// blocks.
func (fbo *folderBlockOps) GetIndirectDirBlockInfos(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	dir data.Path) ([]data.BlockInfo, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	var id keybase1.UserOrTeamID // Data reads don't depend on the id.
	fd := fbo.newDirDataLocked(lState, dir, id, kmd)
	return fd.GetIndirectDirBlockInfos(ctx)
}

// GetIndirectFileBlockInfosWithTopBlock returns a list of BlockInfos
// for all indirect blocks of the given file, starting from the given
// top-most block. If the returned error is a recoverable one (as
// determined by isRecoverableBlockErrorForRemoval), the returned list
// may still be non-empty, and holds all the BlockInfos for all found
// indirect blocks. (This will be relevant when we handle multiple
// levels of indirection.)
func (fbo *folderBlockOps) GetIndirectFileBlockInfosWithTopBlock(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata, file data.Path,
	topBlock *data.FileBlock) (
	[]data.BlockInfo, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	var id keybase1.UserOrTeamID // Data reads don't depend on the id.
	fd := fbo.newFileData(lState, file, id, kmd)
	return fd.GetIndirectFileBlockInfosWithTopBlock(ctx, topBlock)
}

func (fbo *folderBlockOps) getChargedToLocked(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata) (
	keybase1.UserOrTeamID, error) {
	fbo.blockLock.AssertAnyLocked(lState)
	if !fbo.chargedTo.IsNil() {
		return fbo.chargedTo, nil
	}
	chargedTo, err := chargedToForTLF(
		ctx, fbo.config.KBPKI(), fbo.config.KBPKI(), fbo.config,
		kmd.GetTlfHandle())
	if err != nil {
		return keybase1.UserOrTeamID(""), err
	}
	fbo.chargedTo = chargedTo
	return chargedTo, nil
}

// ClearChargedTo clears out the cached chargedTo UID for this FBO.
func (fbo *folderBlockOps) ClearChargedTo(lState *kbfssync.LockState) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	fbo.chargedTo = keybase1.UserOrTeamID("")
}

// DeepCopyFile makes a complete copy of the given file, deduping leaf
// blocks and making new random BlockPointers for all indirect blocks.
// It returns the new top pointer of the copy, and all the new child
// pointers in the copy.  It takes a custom DirtyBlockCache, which
// directs where the resulting block copies are stored.
func (fbo *folderBlockOps) deepCopyFileLocked(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata, file data.Path,
	dirtyBcache data.DirtyBlockCacheSimple, dataVer data.Ver) (
	newTopPtr data.BlockPointer, allChildPtrs []data.BlockPointer, err error) {
	// Deep copying doesn't alter any data in use, it only makes copy,
	// so only a read lock is needed.
	fbo.blockLock.AssertRLocked(lState)
	chargedTo, err := chargedToForTLF(
		ctx, fbo.config.KBPKI(), fbo.config.KBPKI(), fbo.config,
		kmd.GetTlfHandle())
	if err != nil {
		return data.BlockPointer{}, nil, err
	}
	fd := fbo.newFileDataWithCache(
		lState, file, chargedTo, kmd, dirtyBcache)
	return fd.DeepCopy(ctx, dataVer)
}

func (fbo *folderBlockOps) cacheHashBehavior() data.BlockCacheHashBehavior {
	return cacheHashBehavior(fbo.config, fbo.config, fbo.id())
}

func (fbo *folderBlockOps) UndupChildrenInCopy(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, file data.Path, bps blockPutState,
	dirtyBcache data.DirtyBlockCacheSimple, topBlock *data.FileBlock) (
	[]data.BlockInfo, error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return nil, err
	}
	fd := fbo.newFileDataWithCache(
		lState, file, chargedTo, kmd, dirtyBcache)
	return fd.UndupChildrenInCopy(ctx, fbo.config.BlockCache(),
		fbo.config.BlockOps(), bps, topBlock, fbo.cacheHashBehavior())
}

func (fbo *folderBlockOps) ReadyNonLeafBlocksInCopy(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, file data.Path, bps blockPutState,
	dirtyBcache data.DirtyBlockCacheSimple, topBlock *data.FileBlock) (
	[]data.BlockInfo, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return nil, err
	}

	fd := fbo.newFileDataWithCache(
		lState, file, chargedTo, kmd, dirtyBcache)
	return fd.ReadyNonLeafBlocksInCopy(ctx, fbo.config.BlockCache(),
		fbo.config.BlockOps(), bps, topBlock, fbo.cacheHashBehavior())
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
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ptr data.BlockPointer, dir data.Path,
	rtype data.BlockReqType) (*data.DirBlock, bool, error) {
	switch rtype {
	case data.BlockRead, data.BlockWrite, data.BlockLookup:
		fbo.blockLock.AssertAnyLocked(lState)
	case data.BlockReadParallel:
		// This goroutine might not be the official lock holder, so
		// don't make any assertions.
		if lState != nil {
			panic("Non-nil lState passed to getFileBlockLocked " +
				"with blockReadParallel")
		}
	default:
		panic(fmt.Sprintf("Unknown block req type: %d", rtype))
	}

	// Callers should have already done this check, but it doesn't
	// hurt to do it again.
	if !dir.IsValid() {
		return nil, false, errors.WithStack(InvalidPathError{dir})
	}

	// Get the block for the last element in the path.
	dblock, err := fbo.getDirBlockHelperLocked(
		ctx, lState, kmd, ptr, dir.Branch, dir, rtype)
	if err != nil {
		return nil, false, err
	}

	wasDirty := fbo.config.DirtyBlockCache().IsDirty(fbo.id(), ptr, dir.Branch)
	if rtype == data.BlockWrite && !wasDirty {
		// Copy the block if it's for writing and the block is
		// not yet dirty.
		dblock = dblock.DeepCopy()
	}
	return dblock, wasDirty, nil
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
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata, dir data.Path,
	rtype data.BlockReqType) (*data.DirBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	dblock, _, err := fbo.getDirLocked(
		ctx, lState, kmd, dir.TailPointer(), dir, rtype)
	return dblock, err
}

type dirCacheUndoFn func(lState *kbfssync.LockState)

func (fbo *folderBlockOps) wrapWithBlockLock(fn func()) dirCacheUndoFn {
	return func(lState *kbfssync.LockState) {
		if fn == nil {
			return
		}
		fbo.blockLock.Lock(lState)
		defer fbo.blockLock.Unlock(lState)
		fn()
	}
}

func (fbo *folderBlockOps) newDirDataLocked(lState *kbfssync.LockState,
	dir data.Path, chargedTo keybase1.UserOrTeamID, kmd libkey.KeyMetadata) *data.DirData {
	fbo.blockLock.AssertAnyLocked(lState)
	return data.NewDirData(dir, chargedTo, fbo.config.BlockSplitter(), kmd,
		func(ctx context.Context, kmd libkey.KeyMetadata, ptr data.BlockPointer,
			dir data.Path, rtype data.BlockReqType) (*data.DirBlock, bool, error) {
			lState := lState
			if rtype == data.BlockReadParallel {
				lState = nil
			}
			return fbo.getDirLocked(
				ctx, lState, kmd, ptr, dir, rtype)
		},
		func(ctx context.Context, ptr data.BlockPointer, block data.Block) error {
			return fbo.config.DirtyBlockCache().Put(
				ctx, fbo.id(), ptr, dir.Branch, block)
		}, fbo.log, fbo.vlog)
}

// newDirDataWithDBMLocked creates a new `dirData` that reads from and
// puts into a local dir block cache.  If it reads a block out from
// anything but the `dbm`, it makes a copy of it before inserting it
// into the `dbm`.
func (fbo *folderBlockOps) newDirDataWithDBMLocked(lState *kbfssync.LockState,
	dir data.Path, chargedTo keybase1.UserOrTeamID, kmd libkey.KeyMetadata,
	dbm dirBlockMap) *data.DirData {
	fbo.blockLock.AssertRLocked(lState)
	return data.NewDirData(dir, chargedTo, fbo.config.BlockSplitter(), kmd,
		func(ctx context.Context, kmd libkey.KeyMetadata, ptr data.BlockPointer,
			dir data.Path, rtype data.BlockReqType) (*data.DirBlock, bool, error) {
			hasBlock, err := dbm.hasBlock(ctx, ptr)
			if err != nil {
				return nil, false, err
			}
			if hasBlock {
				block, err := dbm.getBlock(ctx, ptr)
				if err != nil {
					return nil, false, err
				}
				return block, true, nil
			}

			localLState := lState
			getRtype := rtype
			switch rtype {
			case data.BlockReadParallel:
				localLState = nil
			case data.BlockWrite:
				getRtype = data.BlockRead
			}

			block, wasDirty, err := fbo.getDirLocked(
				ctx, localLState, kmd, ptr, dir, getRtype)
			if err != nil {
				return nil, false, err
			}

			if rtype == data.BlockWrite {
				// Make a copy before we stick it in the local block cache.
				block = block.DeepCopy()
				err = dbm.putBlock(ctx, ptr, block)
				if err != nil {
					return nil, false, err
				}
			}
			return block, wasDirty, nil
		},
		func(ctx context.Context, ptr data.BlockPointer, block data.Block) error {
			return dbm.putBlock(ctx, ptr, block.(*data.DirBlock))
		}, fbo.log, fbo.vlog)
}

// newDirDataWithDBM is like `newDirDataWithDBMLocked`, but it must be
// called with `blockLock` unlocked, and the returned function must be
// called when the returned `dirData` is no longer in use.
func (fbo *folderBlockOps) newDirDataWithDBM(
	lState *kbfssync.LockState, dir data.Path, chargedTo keybase1.UserOrTeamID,
	kmd libkey.KeyMetadata, dbm dirBlockMap) (*data.DirData, func()) {
	// Lock and fetch for reading only, we want any dirty
	// blocks to go into the dbm.
	fbo.blockLock.RLock(lState)
	cleanupFn := func() { fbo.blockLock.RUnlock(lState) }
	return fbo.newDirDataWithDBMLocked(lState, dir, chargedTo, kmd, dbm),
		cleanupFn
}

func (fbo *folderBlockOps) makeDirDirtyLocked(
	lState *kbfssync.LockState, ptr data.BlockPointer, unrefs []data.BlockInfo) func() {
	fbo.blockLock.AssertLocked(lState)
	oldUnrefs, wasDirty := fbo.dirtyDirs[ptr]
	oldLen := len(oldUnrefs)
	fbo.dirtyDirs[ptr] = append(oldUnrefs, unrefs...)
	return func() {
		dirtyBcache := fbo.config.DirtyBlockCache()
		if wasDirty {
			fbo.dirtyDirs[ptr] = oldUnrefs[:oldLen:oldLen]
		} else {
			_ = dirtyBcache.Delete(fbo.id(), ptr, fbo.branch())
			delete(fbo.dirtyDirs, ptr)
		}
		for _, unref := range unrefs {
			_ = dirtyBcache.Delete(fbo.id(), unref.BlockPointer, fbo.branch())
		}
	}
}

func (fbo *folderBlockOps) updateParentDirEntryLocked(
	ctx context.Context, lState *kbfssync.LockState, dir data.Path,
	kmd KeyMetadataWithRootDirEntry, setMtime, setCtime bool) (func(), error) {
	fbo.blockLock.AssertLocked(lState)
	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return nil, err
	}
	now := fbo.nowUnixNano()
	pp := *dir.ParentPath()
	if pp.IsValid() {
		dd := fbo.newDirDataLocked(lState, pp, chargedTo, kmd)
		de, err := dd.Lookup(ctx, dir.TailName())
		if err != nil {
			return nil, err
		}
		newDe := de
		if setMtime {
			newDe.Mtime = now
		}
		if setCtime {
			newDe.Ctime = now
		}
		unrefs, err := dd.UpdateEntry(ctx, dir.TailName(), newDe)
		if err != nil {
			return nil, err
		}
		undoDirtyFn := fbo.makeDirDirtyLocked(lState, pp.TailPointer(), unrefs)
		return func() {
			_, _ = dd.UpdateEntry(ctx, dir.TailName(), de)
			undoDirtyFn()
		}, nil
	}

	// If the parent isn't a valid path, we need to update the root entry.
	var de *data.DirEntry
	if fbo.dirtyRootDirEntry == nil {
		deCopy := kmd.GetRootDirEntry()
		fbo.dirtyRootDirEntry = &deCopy
	} else {
		deCopy := *fbo.dirtyRootDirEntry
		de = &deCopy
	}
	if setMtime {
		fbo.dirtyRootDirEntry.Mtime = now
	}
	if setCtime {
		fbo.dirtyRootDirEntry.Ctime = now
	}
	return func() {
		fbo.dirtyRootDirEntry = de
	}, nil
}

func (fbo *folderBlockOps) addDirEntryInCacheLocked(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, dir data.Path, newName data.PathPartString,
	newDe data.DirEntry) (func(), error) {
	fbo.blockLock.AssertLocked(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return nil, err
	}
	dd := fbo.newDirDataLocked(lState, dir, chargedTo, kmd)
	unrefs, err := dd.AddEntry(ctx, newName, newDe)
	if err != nil {
		return nil, err
	}
	parentUndo, err := fbo.updateParentDirEntryLocked(
		ctx, lState, dir, kmd, true, true)
	if err != nil {
		_, _ = dd.RemoveEntry(ctx, newName)
		return nil, err
	}

	undoDirtyFn := fbo.makeDirDirtyLocked(lState, dir.TailPointer(), unrefs)
	return func() {
		_, _ = dd.RemoveEntry(ctx, newName)
		undoDirtyFn()
		parentUndo()
	}, nil
}

// AddDirEntryInCache adds a brand new entry to the given directory
// and updates the directory's own mtime and ctime.  It returns a
// function that can be called if the change needs to be undone.
func (fbo *folderBlockOps) AddDirEntryInCache(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, dir data.Path, newName data.PathPartString,
	newDe data.DirEntry) (dirCacheUndoFn, error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	fn, err := fbo.addDirEntryInCacheLocked(
		ctx, lState, kmd, dir, newName, newDe)
	if err != nil {
		return nil, err
	}
	return fbo.wrapWithBlockLock(fn), nil
}

func (fbo *folderBlockOps) removeDirEntryInCacheLocked(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, dir data.Path, oldName data.PathPartString,
	oldDe data.DirEntry) (func(), error) {
	fbo.blockLock.AssertLocked(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return nil, err
	}
	dd := fbo.newDirDataLocked(lState, dir, chargedTo, kmd)
	unrefs, err := dd.RemoveEntry(ctx, oldName)
	if err != nil {
		return nil, err
	}
	if oldDe.Type == data.Dir {
		// The parent dir inherits any dirty unrefs from the removed
		// directory.
		if childUnrefs, ok := fbo.dirtyDirs[oldDe.BlockPointer]; ok {
			unrefs = append(unrefs, childUnrefs...)
		}
	}

	unlinkUndoFn := fbo.nodeCache.Unlink(
		oldDe.Ref(), dir.ChildPath(
			oldName, oldDe.BlockPointer, fbo.nodeCache.ObfuscatorMaker()()),
		oldDe)

	parentUndo, err := fbo.updateParentDirEntryLocked(
		ctx, lState, dir, kmd, true, true)
	if err != nil {
		if unlinkUndoFn != nil {
			unlinkUndoFn()
		}
		_, _ = dd.AddEntry(ctx, oldName, oldDe)
		return nil, err
	}

	undoDirtyFn := fbo.makeDirDirtyLocked(lState, dir.TailPointer(), unrefs)
	return func() {
		_, _ = dd.AddEntry(ctx, oldName, oldDe)
		if undoDirtyFn != nil {
			undoDirtyFn()
		}
		if parentUndo != nil {
			parentUndo()
		}
		if unlinkUndoFn != nil {
			unlinkUndoFn()
		}
	}, nil
}

// RemoveDirEntryInCache removes an entry from the given directory //
// and updates the directory's own mtime and ctime.  It returns a
// function that can be called if the change needs to be undone.
func (fbo *folderBlockOps) RemoveDirEntryInCache(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, dir data.Path, oldName data.PathPartString,
	oldDe data.DirEntry) (dirCacheUndoFn, error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	fn, err := fbo.removeDirEntryInCacheLocked(
		ctx, lState, kmd, dir, oldName, oldDe)
	if err != nil {
		return nil, err
	}
	return fbo.wrapWithBlockLock(fn), nil
}

// RenameDirEntryInCache updates the entries of both the old and new
// parent dirs for the given target dir atomically (with respect to
// blockLock).  It also updates the cache entry for the target, which
// would have its Ctime changed. The updates will get applied to the
// dirty blocks on subsequent fetches.
//
// The returned bool indicates whether or not the caller should clean
// up the target cache entry when the effects of the operation are no
// longer needed.
func (fbo *folderBlockOps) RenameDirEntryInCache(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, oldParent data.Path,
	oldName data.PathPartString, newParent data.Path,
	newName data.PathPartString, newDe data.DirEntry,
	replacedDe data.DirEntry) (undo dirCacheUndoFn, err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	if newParent.TailPointer() == oldParent.TailPointer() &&
		oldName == newName {
		// Noop
		return nil, nil
	}

	var undoReplace func()
	if replacedDe.IsInitialized() {
		undoReplace, err = fbo.removeDirEntryInCacheLocked(
			ctx, lState, kmd, newParent, newName, replacedDe)
		if err != nil {
			return nil, err
		}
	}
	defer func() {
		if err != nil && undoReplace != nil {
			undoReplace()
		}
	}()

	undoAdd, err := fbo.addDirEntryInCacheLocked(
		ctx, lState, kmd, newParent, newName, newDe)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil && undoAdd != nil {
			undoAdd()
		}
	}()

	undoRm, err := fbo.removeDirEntryInCacheLocked(
		ctx, lState, kmd, oldParent, oldName, data.DirEntry{})
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil && undoRm != nil {
			undoRm()
		}
	}()

	newParentNode := fbo.nodeCache.Get(newParent.TailRef())
	undoMove, err := fbo.nodeCache.Move(newDe.Ref(), newParentNode, newName)
	if err != nil {
		return nil, err
	}

	return fbo.wrapWithBlockLock(func() {
		if undoMove != nil {
			undoMove()
		}
		if undoRm != nil {
			undoRm()
		}
		if undoAdd != nil {
			undoAdd()
		}
		if undoReplace != nil {
			undoReplace()
		}
	}), nil
}

func (fbo *folderBlockOps) setCachedAttrLocked(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, dir data.Path, name data.PathPartString,
	attr attrChange, realEntry data.DirEntry) (dirCacheUndoFn, error) {
	fbo.blockLock.AssertLocked(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return nil, err
	}

	if !dir.IsValid() {
		// Can't set attrs directly on the root entry, primarily
		// because there's no way to indicate it's dirty.  TODO: allow
		// mtime-setting on the root dir?
		return nil, InvalidParentPathError{dir}
	}
	var de data.DirEntry
	var unlinkedNode Node

	dd := fbo.newDirDataLocked(lState, dir, chargedTo, kmd)
	de, err = dd.Lookup(ctx, name)
	if _, noExist := errors.Cause(err).(idutil.NoSuchNameError); noExist {
		// The node may be unlinked.
		unlinkedNode = fbo.nodeCache.Get(realEntry.Ref())
		if unlinkedNode != nil && !fbo.nodeCache.IsUnlinked(unlinkedNode) {
			unlinkedNode = nil
		}
		if unlinkedNode != nil {
			de = fbo.nodeCache.UnlinkedDirEntry(unlinkedNode)
		} else {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	oldDe := de
	switch attr {
	case exAttr:
		de.Type = realEntry.Type
	case mtimeAttr:
		de.Mtime = realEntry.Mtime
	}
	de.Ctime = realEntry.Ctime

	var undoDirtyFn func()
	if unlinkedNode != nil {
		fbo.nodeCache.UpdateUnlinkedDirEntry(unlinkedNode, de)
	} else {
		unrefs, err := dd.UpdateEntry(ctx, name, de)
		if err != nil {
			return nil, err
		}
		undoDirtyFn = fbo.makeDirDirtyLocked(lState, dir.TailPointer(), unrefs)
	}

	return fbo.wrapWithBlockLock(func() {
		if unlinkedNode != nil {
			fbo.nodeCache.UpdateUnlinkedDirEntry(unlinkedNode, oldDe)
		} else {
			_, _ = dd.UpdateEntry(ctx, name, oldDe)
			undoDirtyFn()
		}
	}), nil
}

// SetAttrInDirEntryInCache updates an entry from the given directory.
func (fbo *folderBlockOps) SetAttrInDirEntryInCache(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, p data.Path, newDe data.DirEntry,
	attr attrChange) (dirCacheUndoFn, error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	return fbo.setCachedAttrLocked(
		ctx, lState, kmd, *p.ParentPath(), p.TailName(), attr, newDe)
}

// getDirtyDirLocked composes getDirLocked and
// updateWithDirtyEntriesLocked. Note that a dirty dir means that it
// has entries possibly pointing to dirty files, and/or that its
// children list is dirty.
func (fbo *folderBlockOps) getDirtyDirLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, dir data.Path, rtype data.BlockReqType) (
	*data.DirBlock, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	dblock, _, err := fbo.getDirLocked(
		ctx, lState, kmd, dir.TailPointer(), dir, rtype)
	if err != nil {
		return nil, err
	}
	return dblock, err
}

// GetDirtyDirCopy returns a deep copy of the directory block for a
// dirty directory, while under lock, updated with all cached dirty
// entries.
func (fbo *folderBlockOps) GetDirtyDirCopy(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata, dir data.Path,
	rtype data.BlockReqType) (*data.DirBlock, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	dblock, err := fbo.getDirtyDirLocked(ctx, lState, kmd, dir, rtype)
	if err != nil {
		return nil, err
	}
	// Copy it while under lock.  Otherwise, another operation like
	// `Write` can modify it while the caller is trying to copy it,
	// leading to a panic like in KBFS-3407.
	return dblock.DeepCopy(), nil
}

// GetChildren returns a map of EntryInfos for the (possibly dirty)
// children entries of the given directory.
func (fbo *folderBlockOps) GetChildren(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	dir data.Path) (map[data.PathPartString]data.EntryInfo, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	dd := fbo.newDirDataLocked(lState, dir, keybase1.UserOrTeamID(""), kmd)
	return dd.GetChildren(ctx)
}

// GetEntries returns a map of DirEntries for the (possibly dirty)
// children entries of the given directory.
func (fbo *folderBlockOps) GetEntries(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	dir data.Path) (map[data.PathPartString]data.DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	dd := fbo.newDirDataLocked(lState, dir, keybase1.UserOrTeamID(""), kmd)
	return dd.GetEntries(ctx)
}

func (fbo *folderBlockOps) getEntryLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd KeyMetadataWithRootDirEntry, file data.Path,
	includeDeleted bool) (de data.DirEntry, err error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// See if this is the root.
	if !file.HasValidParent() {
		if fbo.dirtyRootDirEntry != nil {
			return *fbo.dirtyRootDirEntry, nil
		}
		return kmd.GetRootDirEntry(), nil
	}

	dd := fbo.newDirDataLocked(
		lState, *file.ParentPath(), keybase1.UserOrTeamID(""), kmd)
	de, err = dd.Lookup(ctx, file.TailName())
	_, noExist := errors.Cause(err).(idutil.NoSuchNameError)
	if includeDeleted && (noExist || de.BlockPointer != file.TailPointer()) {
		unlinkedNode := fbo.nodeCache.Get(file.TailPointer().Ref())
		if unlinkedNode != nil && fbo.nodeCache.IsUnlinked(unlinkedNode) {
			return fbo.nodeCache.UnlinkedDirEntry(unlinkedNode), nil
		}
		return data.DirEntry{}, err
	} else if err != nil {
		return data.DirEntry{}, err
	}
	return de, nil
}

// file must have a valid parent.
func (fbo *folderBlockOps) updateEntryLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd KeyMetadataWithRootDirEntry, file data.Path,
	de data.DirEntry, includeDeleted bool) error {
	fbo.blockLock.AssertAnyLocked(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return err
	}
	parentPath := *file.ParentPath()
	dd := fbo.newDirDataLocked(lState, parentPath, chargedTo, kmd)
	unrefs, err := dd.UpdateEntry(ctx, file.TailName(), de)
	_, noExist := errors.Cause(err).(idutil.NoSuchNameError)
	switch {
	case noExist && includeDeleted:
		unlinkedNode := fbo.nodeCache.Get(file.TailPointer().Ref())
		if unlinkedNode != nil && fbo.nodeCache.IsUnlinked(unlinkedNode) {
			fbo.nodeCache.UpdateUnlinkedDirEntry(unlinkedNode, de)
			return nil
		}
		return err
	case err != nil:
		return err
	default:
		_ = fbo.makeDirDirtyLocked(lState, parentPath.TailPointer(), unrefs)
	}

	// If we're in the middle of syncing the directories, but the
	// current file is not yet being synced, we need to re-apply this
	// update after the sync is done, so it doesn't get lost after the
	// syncing directory block is readied.  This only applies to dir
	// updates being caused by file changes; other types of dir writes
	// are protected by `folderBranchOps.syncLock`, which is held
	// during `SyncAll`.
	if fbo.dirtyDirsSyncing && !fbo.doDeferWrite {
		fbo.log.CDebugf(ctx, "Deferring update entry during sync")
		n := fbo.nodeCache.Get(file.TailRef())
		fbo.deferredDirUpdates = append(
			fbo.deferredDirUpdates, func(lState *kbfssync.LockState) error {
				file := fbo.nodeCache.PathFromNode(n)
				de.BlockPointer = file.TailPointer()
				return fbo.updateEntryLocked(
					ctx, lState, kmd, file, de, includeDeleted)
			})
	}

	return nil
}

// GetEntry returns the possibly-dirty DirEntry of the given file in
// its parent DirBlock. file must have a valid parent.
func (fbo *folderBlockOps) GetEntry(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, file data.Path) (data.DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getEntryLocked(ctx, lState, kmd, file, false)
}

// GetEntryEvenIfDeleted returns the possibly-dirty DirEntry of the
// given file in its parent DirBlock, even if the file has been
// deleted. file must have a valid parent.
func (fbo *folderBlockOps) GetEntryEvenIfDeleted(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, file data.Path) (data.DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getEntryLocked(ctx, lState, kmd, file, true)
}

func (fbo *folderBlockOps) getChildNodeLocked(
	lState *kbfssync.LockState, dir Node, name data.PathPartString,
	de data.DirEntry) (Node, error) {
	fbo.blockLock.AssertRLocked(lState)

	if de.Type == data.Sym {
		return nil, nil
	}

	return fbo.nodeCache.GetOrCreate(de.BlockPointer, name, dir, de.Type)
}

func (fbo *folderBlockOps) GetChildNode(
	lState *kbfssync.LockState, dir Node, name data.PathPartString,
	de data.DirEntry) (Node, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.getChildNodeLocked(lState, dir, name, de)
}

// Lookup returns the possibly-dirty DirEntry of the given file in its
// parent DirBlock, and a Node for the file if it exists.  It has to
// do all of this under the block lock to avoid races with
// UpdatePointers.
func (fbo *folderBlockOps) Lookup(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, dir Node, name data.PathPartString) (
	Node, data.DirEntry, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	// Protect against non-dir nodes being passed in by mistake.
	// TODO: we should make this a more specific error probably, but
	// then we need to update some places that check for
	// `NoSuchNameError` to check for this one as well.
	if dir.EntryType() != data.Dir {
		fbo.log.CDebugf(
			ctx, "Got unexpected node type when looking up %s: %s",
			name, dir.EntryType())
		return nil, data.DirEntry{}, idutil.NoSuchNameError{Name: name.String()}
	}

	dirPath := fbo.nodeCache.PathFromNode(dir)
	if !dirPath.IsValid() {
		return nil, data.DirEntry{}, errors.WithStack(InvalidPathError{dirPath})
	}

	childPath := dirPath.ChildPathNoPtr(name, fbo.nodeCache.ObfuscatorMaker()())
	de, err := fbo.getEntryLocked(ctx, lState, kmd, childPath, false)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	node, err := fbo.getChildNodeLocked(lState, dir, name, de)
	if err != nil {
		return nil, data.DirEntry{}, err
	}
	return node, de, nil
}

func (fbo *folderBlockOps) getOrCreateDirtyFileLocked(
	lState *kbfssync.LockState, file data.Path) *data.DirtyFile {
	fbo.blockLock.AssertLocked(lState)
	ptr := file.TailPointer()
	df := fbo.dirtyFiles[ptr]
	if df == nil {
		df = data.NewDirtyFile(file, fbo.config.DirtyBlockCache())
		fbo.dirtyFiles[ptr] = df
	}
	return df
}

// cacheBlockIfNotYetDirtyLocked puts a block into the cache, but only
// does so if the block isn't already marked as dirty in the cache.
// This is useful when operating on a dirty copy of a block that may
// already be in the cache.
func (fbo *folderBlockOps) cacheBlockIfNotYetDirtyLocked(
	ctx context.Context, lState *kbfssync.LockState, ptr data.BlockPointer,
	file data.Path, block data.Block) error {
	fbo.blockLock.AssertLocked(lState)
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	needsCaching, isSyncing := df.SetBlockDirty(ptr)

	if needsCaching {
		err := fbo.config.DirtyBlockCache().Put(
			ctx, fbo.id(), ptr, file.Branch, block)
		if err != nil {
			return err
		}
	}

	if isSyncing {
		fbo.doDeferWrite = true
	}
	return nil
}

func (fbo *folderBlockOps) getOrCreateSyncInfoLocked(
	lState *kbfssync.LockState, de data.DirEntry) (*syncInfo, error) {
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

// GetDirtyFileBlockRefs returns a list of references of all known dirty
// files.
func (fbo *folderBlockOps) GetDirtyFileBlockRefs(
	lState *kbfssync.LockState) []data.BlockRef {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	var dirtyRefs []data.BlockRef
	for ref := range fbo.unrefCache {
		dirtyRefs = append(dirtyRefs, ref)
	}
	return dirtyRefs
}

// GetDirtyDirBlockRefs returns a list of references of all known
// dirty directories.  Also returns a channel that, while it is open,
// all future writes will be blocked until it is closed -- this lets
// the caller ensure that the directory entries will remain stable
// (not updated with new file sizes by the writes) until all of the
// directory blocks have been safely copied.  The caller *must* close
// this channel once they are done processing the dirty directory
// blocks.
func (fbo *folderBlockOps) GetDirtyDirBlockRefs(
	lState *kbfssync.LockState) ([]data.BlockRef, chan<- struct{}) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	var dirtyRefs []data.BlockRef
	for ptr := range fbo.dirtyDirs {
		dirtyRefs = append(dirtyRefs, ptr.Ref())
	}
	if fbo.dirtyDirsSyncing {
		panic("GetDirtyDirBlockRefs() called twice")
	}
	fbo.dirtyDirsSyncing = true
	ch := make(chan struct{})
	fbo.holdNewWritesCh = ch
	return dirtyRefs, ch
}

// GetDirtyDirBlockRefsDone is called to indicate the caller is done
// with the data previously returned from `GetDirtyDirBlockRefs()`.
func (fbo *folderBlockOps) GetDirtyDirBlockRefsDone(
	lState *kbfssync.LockState) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	fbo.dirtyDirsSyncing = false
	fbo.deferredDirUpdates = nil
	fbo.holdNewWritesCh = nil
}

// getDirtyDirUnrefsLocked returns a list of block infos that need to be
// unreferenced for the given directory.
func (fbo *folderBlockOps) getDirtyDirUnrefsLocked(
	lState *kbfssync.LockState, ptr data.BlockPointer) []data.BlockInfo {
	fbo.blockLock.AssertRLocked(lState)
	return fbo.dirtyDirs[ptr]
}

// fixChildBlocksAfterRecoverableErrorLocked should be called when a sync
// failed with a recoverable block error on a multi-block file.  It
// makes sure that any outstanding dirty versions of the file are
// fixed up to reflect the fact that some of the indirect pointers now
// need to change.
func (fbo *folderBlockOps) fixChildBlocksAfterRecoverableErrorLocked(
	ctx context.Context, lState *kbfssync.LockState, file data.Path, kmd libkey.KeyMetadata,
	redirtyOnRecoverableError map[data.BlockPointer]data.BlockPointer) {
	fbo.blockLock.AssertLocked(lState)

	defer func() {
		// Below, this function can end up writing dirty blocks back
		// to the cache, which will set `doDeferWrite` to `true`.
		// This leads to future writes being unnecessarily deferred
		// when a Sync is not happening, and can lead to dirty data
		// being synced twice and sticking around for longer than
		// needed.  So just reset `doDeferWrite` once we're
		// done. We're under `blockLock`, so this is safe.
		fbo.doDeferWrite = false
	}()

	df := fbo.dirtyFiles[file.TailPointer()]
	if df != nil {
		// Un-orphan old blocks, since we are reverting back to the
		// previous state.
		for _, oldPtr := range redirtyOnRecoverableError {
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Un-orphaning %v", oldPtr)
			df.SetBlockOrphaned(oldPtr, false)
		}
	}

	dirtyBcache := fbo.config.DirtyBlockCache()
	topBlock, err := dirtyBcache.Get(
		ctx, fbo.id(), file.TailPointer(), fbo.branch())
	fblock, ok := topBlock.(*data.FileBlock)
	if err != nil || !ok {
		fbo.log.CWarningf(ctx, "Couldn't find dirtied "+
			"top-block for %v: %v", file.TailPointer(), err)
		return
	}

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't find uid during recovery: %v", err)
		return
	}
	fd := fbo.newFileData(lState, file, chargedTo, kmd)

	// If a copy of the top indirect block was made, we need to
	// redirty all the sync'd blocks under their new IDs, so that
	// future syncs will know they failed.
	newPtrs := make(map[data.BlockPointer]bool, len(redirtyOnRecoverableError))
	for newPtr := range redirtyOnRecoverableError {
		newPtrs[newPtr] = true
	}
	found, err := fd.FindIPtrsAndClearSize(ctx, fblock, newPtrs)
	if err != nil {
		fbo.log.CWarningf(
			ctx, "Couldn't find and clear iptrs during recovery: %v", err)
		return
	}
	for newPtr, oldPtr := range redirtyOnRecoverableError {
		if !found[newPtr] {
			continue
		}

		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Re-dirtying %v (and deleting dirty block %v)",
			newPtr, oldPtr)
		// These blocks would have been permanent, so they're
		// definitely still in the cache.
		b, err := fbo.config.BlockCache().Get(newPtr)
		if err != nil {
			fbo.log.CWarningf(ctx, "Couldn't re-dirty %v: %v", newPtr, err)
			continue
		}
		if err = fbo.cacheBlockIfNotYetDirtyLocked(
			ctx, lState, newPtr, file, b); err != nil {
			fbo.log.CWarningf(ctx, "Couldn't re-dirty %v: %v", newPtr, err)
		}
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Deleting dirty ptr %v after recoverable error",
			oldPtr)
		err = dirtyBcache.Delete(fbo.id(), oldPtr, fbo.branch())
		if err != nil {
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Couldn't del-dirty %v: %v", oldPtr, err)
		}
	}
}

func (fbo *folderBlockOps) nowUnixNano() int64 {
	return fbo.config.Clock().Now().UnixNano()
}

// PrepRename prepares the given rename operation. It returns the old
// and new parent block (which may be the same, and which shouldn't be
// modified), and what is to be the new DirEntry.
func (fbo *folderBlockOps) PrepRename(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, oldParent data.Path,
	oldName data.PathPartString, newParent data.Path,
	newName data.PathPartString) (
	newDe, replacedDe data.DirEntry, ro *renameOp, err error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	// Look up in the old path. Won't be modified, so only fetch for reading.
	newDe, err = fbo.getEntryLocked(
		ctx, lState, kmd, oldParent.ChildPathNoPtr(oldName, nil), false)
	if err != nil {
		return data.DirEntry{}, data.DirEntry{}, nil, err
	}

	oldParentPtr := oldParent.TailPointer()
	newParentPtr := newParent.TailPointer()
	ro, err = newRenameOp(
		oldName.Plaintext(), oldParentPtr, newName.Plaintext(), newParentPtr,
		newDe.BlockPointer, newDe.Type)
	if err != nil {
		return data.DirEntry{}, data.DirEntry{}, nil, err
	}
	ro.AddUpdate(oldParentPtr, oldParentPtr)
	ro.setFinalPath(newParent)
	ro.oldFinalPath = oldParent
	if oldParentPtr.ID != newParentPtr.ID {
		ro.AddUpdate(newParentPtr, newParentPtr)
	}

	replacedDe, err = fbo.getEntryLocked(
		ctx, lState, kmd, newParent.ChildPathNoPtr(newName, nil), false)
	if _, notExists := errors.Cause(err).(idutil.NoSuchNameError); notExists {
		return newDe, data.DirEntry{}, ro, nil
	} else if err != nil {
		return data.DirEntry{}, data.DirEntry{}, nil, err
	}

	return newDe, replacedDe, ro, nil
}

func (fbo *folderBlockOps) newFileData(lState *kbfssync.LockState,
	file data.Path, chargedTo keybase1.UserOrTeamID, kmd libkey.KeyMetadata) *data.FileData {
	fbo.blockLock.AssertAnyLocked(lState)
	return data.NewFileData(file, chargedTo, fbo.config.BlockSplitter(), kmd,
		func(ctx context.Context, kmd libkey.KeyMetadata, ptr data.BlockPointer,
			file data.Path, rtype data.BlockReqType) (*data.FileBlock, bool, error) {
			lState := lState
			if rtype == data.BlockReadParallel {
				lState = nil
			}
			return fbo.getFileBlockLocked(
				ctx, lState, kmd, ptr, file, rtype)
		},
		func(ctx context.Context, ptr data.BlockPointer, block data.Block) error {
			return fbo.cacheBlockIfNotYetDirtyLocked(
				ctx, lState, ptr, file, block)
		}, fbo.log, fbo.vlog)
}

func (fbo *folderBlockOps) newFileDataWithCache(lState *kbfssync.LockState,
	file data.Path, chargedTo keybase1.UserOrTeamID, kmd libkey.KeyMetadata,
	dirtyBcache data.DirtyBlockCacheSimple) *data.FileData {
	fbo.blockLock.AssertAnyLocked(lState)
	return data.NewFileData(file, chargedTo, fbo.config.BlockSplitter(), kmd,
		func(ctx context.Context, kmd libkey.KeyMetadata, ptr data.BlockPointer,
			file data.Path, rtype data.BlockReqType) (*data.FileBlock, bool, error) {
			block, err := dirtyBcache.Get(ctx, file.Tlf, ptr, file.Branch)
			if fblock, ok := block.(*data.FileBlock); ok && err == nil {
				return fblock, true, nil
			}
			lState := lState
			if rtype == data.BlockReadParallel {
				lState = nil
			}
			return fbo.getFileBlockLocked(
				ctx, lState, kmd, ptr, file, rtype)
		},
		func(ctx context.Context, ptr data.BlockPointer, block data.Block) error {
			return dirtyBcache.Put(ctx, file.Tlf, ptr, file.Branch, block)
		}, fbo.log, fbo.vlog)
}

// Read reads from the given file into the given buffer at the given
// offset. It returns the number of bytes read and nil, or 0 and the
// error if there was one.
func (fbo *folderBlockOps) Read(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata, file Node,
	dest []byte, off int64) (int64, error) {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	filePath := fbo.nodeCache.PathFromNode(file)

	fbo.vlog.CLogf(ctx, libkb.VLog1, "Reading from %v", filePath.TailPointer())

	var id keybase1.UserOrTeamID // Data reads don't depend on the id.
	fd := fbo.newFileData(lState, filePath, id, kmd)
	return fd.Read(ctx, dest, data.Int64Offset(off))
}

func (fbo *folderBlockOps) maybeWaitOnDeferredWrites(
	ctx context.Context, lState *kbfssync.LockState, file Node,
	c data.DirtyPermChan) error {
	var errListener chan error
	registerErr := func() error {
		fbo.blockLock.Lock(lState)
		defer fbo.blockLock.Unlock(lState)
		filePath, err := fbo.pathFromNodeForBlockWriteLocked(lState, file)
		if err != nil {
			return err
		}
		df := fbo.getOrCreateDirtyFileLocked(lState, filePath)
		errListener = make(chan error, 1)
		df.AddErrListener(errListener)
		return nil
	}
	err := registerErr()
	if err != nil {
		return err
	}

	logTimer := time.After(100 * time.Millisecond)
	doLogUnblocked := false
	for {
		var err error
	outerSelect:
		select {
		case <-c:
			if doLogUnblocked {
				fbo.vlog.CLogf(ctx, libkb.VLog1, "Write unblocked")
			}
			// Make sure there aren't any queued errors.
			select {
			case err = <-errListener:
				// Break the select to check the cause of the error below.
				break outerSelect
			default:
			}
			return nil
		case <-logTimer:
			// Print a log message once if it's taking too long.
			fbo.log.CDebugf(ctx,
				"Blocking a write because of a full dirty buffer")
			doLogUnblocked = true
		case <-ctx.Done():
			return ctx.Err()
		case err = <-errListener:
			// Fall through to check the cause of the error below.
		}
		// Context errors are safe to ignore, since they are likely to
		// be specific to a previous sync (e.g., a user hit ctrl-c
		// during an fsync, or a sync timed out, or a test was
		// provoking an error specifically [KBFS-2164]).
		cause := errors.Cause(err)
		if cause == context.Canceled || cause == context.DeadlineExceeded {
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Ignoring sync err: %+v", err)
			err := registerErr()
			if err != nil {
				return err
			}
			continue
		} else if err != nil {
			// Treat other errors as fatal to this write -- e.g., the
			// user's quota is full, the local journal is broken,
			// etc. XXX: should we ignore errors that are specific
			// only to some other file being sync'd (e.g.,
			// "recoverable" block errors from which we couldn't
			// recover)?
			return err
		}
	}
}

func (fbo *folderBlockOps) pathFromNodeForBlockWriteLocked(
	lState *kbfssync.LockState, n Node) (data.Path, error) {
	fbo.blockLock.AssertLocked(lState)
	p := fbo.nodeCache.PathFromNode(n)
	if !p.IsValid() {
		return data.Path{}, errors.WithStack(InvalidPathError{p})
	}
	return p, nil
}

// writeGetFileLocked checks write permissions explicitly for
// writeDataLocked, truncateLocked etc and returns
func (fbo *folderBlockOps) writeGetFileLocked(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	file data.Path) (*data.FileBlock, error) {
	fbo.blockLock.AssertLocked(lState)

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return nil, err
	}
	isWriter, err := kmd.IsWriter(
		ctx, fbo.config.KBPKI(), fbo.config, session.UID, session.VerifyingKey)
	if err != nil {
		return nil, err
	}
	if !isWriter {
		return nil, tlfhandle.NewWriteAccessError(kmd.GetTlfHandle(),
			session.Name, file.String())
	}
	fblock, err := fbo.getFileLocked(ctx, lState, kmd, file, data.BlockWrite)
	if err != nil {
		return nil, err
	}
	return fblock, nil
}

// Returns the set of blocks dirtied during this write that might need
// to be cleaned up if the write is deferred.
func (fbo *folderBlockOps) writeDataLocked(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, file data.Path, buf []byte, off int64) (
	latestWrite WriteRange, dirtyPtrs []data.BlockPointer,
	newlyDirtiedChildBytes int64, err error) {
	_, wasAlreadyUnref := fbo.unrefCache[file.TailPointer().Ref()]
	defer func() {
		// if the write didn't succeed, and the file wasn't already
		// being cached, clear out any cached state.
		if err != nil && !wasAlreadyUnref {
			_ = fbo.clearCacheInfoLocked(lState, file)
		}
	}()

	if jManager, err := GetJournalManager(fbo.config); err == nil {
		jManager.dirtyOpStart(fbo.id())
		defer jManager.dirtyOpEnd(fbo.id())
	}

	fbo.blockLock.AssertLocked(lState)
	fbo.vlog.CLogf(ctx, libkb.VLog1, "writeDataLocked on file pointer %v",
		file.TailPointer())
	defer func() {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "writeDataLocked done: %v", err)
	}()

	fblock, err := fbo.writeGetFileLocked(ctx, lState, kmd, file)
	if err != nil {
		return WriteRange{}, nil, 0, err
	}

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return WriteRange{}, nil, 0, err
	}

	fd := fbo.newFileData(lState, file, chargedTo, kmd)

	dirtyBcache := fbo.config.DirtyBlockCache()
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	defer func() {
		// Always update unsynced bytes and potentially force a sync,
		// even on an error, since the previously-dirty bytes stay in
		// the cache.
		df.UpdateNotYetSyncingBytes(newlyDirtiedChildBytes)
		if dirtyBcache.ShouldForceSync(fbo.id()) {
			select {
			// If we can't send on the channel, that means a sync is
			// already in progress.
			case fbo.forceSyncChan <- struct{}{}:
				fbo.vlog.CLogf(
					ctx, libkb.VLog1, "Forcing a sync due to full buffer")
			default:
			}
		}
	}()

	de, err := fbo.getEntryLocked(ctx, lState, kmd, file, true)
	if err != nil {
		return WriteRange{}, nil, 0, err
	}
	if de.BlockPointer != file.TailPointer() {
		fbo.log.CDebugf(ctx, "DirEntry and file tail pointer don't match: "+
			"%v vs %v, parent=%s", de.BlockPointer, file.TailPointer(),
			file.ParentPath().TailPointer())
	}

	si, err := fbo.getOrCreateSyncInfoLocked(lState, de)
	if err != nil {
		return WriteRange{}, nil, 0, err
	}

	newDe, dirtyPtrs, unrefs, newlyDirtiedChildBytes, bytesExtended, err :=
		fd.Write(ctx, buf, data.Int64Offset(off), fblock, de, df)
	// Record the unrefs before checking the error so we remember the
	// state of newly dirtied blocks.
	si.unrefs = append(si.unrefs, unrefs...)
	if err != nil {
		return WriteRange{}, nil, newlyDirtiedChildBytes, err
	}

	// Update the file's directory entry.
	now := fbo.nowUnixNano()
	newDe.Mtime = now
	newDe.Ctime = now
	err = fbo.updateEntryLocked(ctx, lState, kmd, file, newDe, true)
	if err != nil {
		return WriteRange{}, nil, newlyDirtiedChildBytes, err
	}

	if fbo.doDeferWrite {
		df.AddDeferredNewBytes(bytesExtended)
	}

	latestWrite = si.op.addWrite(uint64(off), uint64(len(buf)))

	return latestWrite, dirtyPtrs, newlyDirtiedChildBytes, nil
}

func (fbo *folderBlockOps) holdWritesLocked(
	ctx context.Context, lState *kbfssync.LockState) error {
	fbo.blockLock.AssertLocked(lState)

	// Loop until either the hold channel is nil, or it has been
	// closed.  However, we can't hold the lock while we're waiting
	// for it to close, as that will cause deadlocks.  So we need to
	// verify that it's the _same_ channel that was closed after we
	// re-take the lock; otherwise, we need to wait again on the new
	// channel.
	for fbo.holdNewWritesCh != nil {
		ch := fbo.holdNewWritesCh
		fbo.blockLock.Unlock(lState)
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Blocking write on hold channel")
		select {
		case <-ch:
			fbo.blockLock.Lock(lState)
			// If the channel hasn't changed since we checked it
			// outside of the lock, we are good to proceed.
			if ch == fbo.holdNewWritesCh {
				fbo.vlog.CLogf(
					ctx, libkb.VLog1, "Unblocking write on hold channel")
				return nil
			}
		case <-ctx.Done():
			fbo.blockLock.Lock(lState)
			return ctx.Err()
		}
	}
	return nil
}

// Write writes the given data to the given file. May block if there
// is too much unflushed data; in that case, it will be unblocked by a
// future sync.
func (fbo *folderBlockOps) Write(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, file Node, buf []byte, off int64) error {
	// If there is too much unflushed data, we should wait until some
	// of it gets flush so our memory usage doesn't grow without
	// bound.
	c, err := fbo.config.DirtyBlockCache().RequestPermissionToDirty(ctx,
		fbo.id(), int64(len(buf)))
	if err != nil {
		return err
	}
	defer fbo.config.DirtyBlockCache().UpdateUnsyncedBytes(fbo.id(),
		-int64(len(buf)), false)
	err = fbo.maybeWaitOnDeferredWrites(ctx, lState, file, c)
	if err != nil {
		return err
	}

	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	err = fbo.holdWritesLocked(ctx, lState)
	if err != nil {
		return err
	}

	filePath, err := fbo.pathFromNodeForBlockWriteLocked(lState, file)
	if err != nil {
		return err
	}

	defer func() {
		fbo.doDeferWrite = false
	}()

	latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err := fbo.writeDataLocked(
		ctx, lState, kmd, filePath, buf, off)
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
		bufCopy := make([]byte, len(buf))
		copy(bufCopy, buf)
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Deferring a write to file %v off=%d len=%d",
			filePath.TailPointer(), off, len(buf))
		ds := fbo.deferred[filePath.TailRef()]
		ds.dirtyDeletes = append(ds.dirtyDeletes, dirtyPtrs...)
		ds.writes = append(ds.writes,
			func(ctx context.Context, lState *kbfssync.LockState,
				kmd KeyMetadataWithRootDirEntry, f data.Path) error {
				// We are about to re-dirty these bytes, so mark that
				// they will no longer be synced via the old file.
				df := fbo.getOrCreateDirtyFileLocked(lState, filePath)
				df.UpdateNotYetSyncingBytes(-newlyDirtiedChildBytes)

				// Write the data again.  We know this won't be
				// deferred, so no need to check the new ptrs.
				_, _, _, err = fbo.writeDataLocked(
					ctx, lState, kmd, f, bufCopy, off)
				return err
			})
		ds.waitBytes += newlyDirtiedChildBytes
		fbo.deferred[filePath.TailRef()] = ds
	}

	return nil
}

// truncateExtendLocked is called by truncateLocked to extend a file and
// creates a hole.
func (fbo *folderBlockOps) truncateExtendLocked(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, file data.Path, size uint64,
	parentBlocks []data.ParentBlockAndChildIndex) (
	WriteRange, []data.BlockPointer, error) {
	fblock, err := fbo.writeGetFileLocked(ctx, lState, kmd, file)
	if err != nil {
		return WriteRange{}, nil, err
	}

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return WriteRange{}, nil, err
	}

	fd := fbo.newFileData(lState, file, chargedTo, kmd)

	de, err := fbo.getEntryLocked(ctx, lState, kmd, file, true)
	if err != nil {
		return WriteRange{}, nil, err
	}
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	newDe, dirtyPtrs, err := fd.TruncateExtend(
		ctx, size, fblock, parentBlocks, de, df)
	if err != nil {
		return WriteRange{}, nil, err
	}

	now := fbo.nowUnixNano()
	newDe.Mtime = now
	newDe.Ctime = now
	err = fbo.updateEntryLocked(ctx, lState, kmd, file, newDe, true)
	if err != nil {
		return WriteRange{}, nil, err
	}

	si, err := fbo.getOrCreateSyncInfoLocked(lState, de)
	if err != nil {
		return WriteRange{}, nil, err
	}
	latestWrite := si.op.addTruncate(size)

	if fbo.config.DirtyBlockCache().ShouldForceSync(fbo.id()) {
		select {
		// If we can't send on the channel, that means a sync is
		// already in progress
		case fbo.forceSyncChan <- struct{}{}:
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Forcing a sync due to full buffer")
		default:
		}
	}

	fbo.vlog.CLogf(ctx, libkb.VLog1, "truncateExtendLocked: done")
	return latestWrite, dirtyPtrs, nil
}

// Returns the set of newly-ID'd blocks created during this truncate
// that might need to be cleaned up if the truncate is deferred.
func (fbo *folderBlockOps) truncateLocked(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, file data.Path, size uint64) (
	wr *WriteRange, ptrs []data.BlockPointer, dirtyBytes int64, err error) {
	_, wasAlreadyUnref := fbo.unrefCache[file.TailPointer().Ref()]
	defer func() {
		// if the truncate didn't succeed, and the file wasn't already
		// being cached, clear out any cached state.
		if err != nil && !wasAlreadyUnref {
			_ = fbo.clearCacheInfoLocked(lState, file)
		}
	}()

	if jManager, err := GetJournalManager(fbo.config); err == nil {
		jManager.dirtyOpStart(fbo.id())
		defer jManager.dirtyOpEnd(fbo.id())
	}

	fblock, err := fbo.writeGetFileLocked(ctx, lState, kmd, file)
	if err != nil {
		return &WriteRange{}, nil, 0, err
	}

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return &WriteRange{}, nil, 0, err
	}

	fd := fbo.newFileData(lState, file, chargedTo, kmd)

	// find the block where the file should now end
	iSize := int64(size) // TODO: deal with overflow
	_, parentBlocks, block, nextBlockOff, startOff, _, err :=
		fd.GetFileBlockAtOffset(
			ctx, fblock, data.Int64Offset(iSize), data.BlockWrite)
	if err != nil {
		return &WriteRange{}, nil, 0, err
	}

	currLen := int64(startOff) + int64(len(block.Contents))
	switch {
	case currLen+truncateExtendCutoffPoint < iSize:
		latestWrite, dirtyPtrs, err := fbo.truncateExtendLocked(
			ctx, lState, kmd, file, uint64(iSize), parentBlocks)
		if err != nil {
			return &latestWrite, dirtyPtrs, 0, err
		}
		return &latestWrite, dirtyPtrs, 0, err
	case currLen < iSize:
		moreNeeded := iSize - currLen
		latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err :=
			fbo.writeDataLocked(
				ctx, lState, kmd, file, make([]byte, moreNeeded), currLen)
		if err != nil {
			return &latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err
		}
		return &latestWrite, dirtyPtrs, newlyDirtiedChildBytes, err
	case currLen == iSize && nextBlockOff < 0:
		// same size!
		if !wasAlreadyUnref {
			_ = fbo.clearCacheInfoLocked(lState, file)
		}
		return nil, nil, 0, nil
	}

	// update the local entry size
	de, err := fbo.getEntryLocked(ctx, lState, kmd, file, true)
	if err != nil {
		return nil, nil, 0, err
	}

	si, err := fbo.getOrCreateSyncInfoLocked(lState, de)
	if err != nil {
		return nil, nil, 0, err
	}

	newDe, dirtyPtrs, unrefs, newlyDirtiedChildBytes, err := fd.TruncateShrink(
		ctx, size, fblock, de)
	// Record the unrefs before checking the error so we remember the
	// state of newly dirtied blocks.
	si.unrefs = append(si.unrefs, unrefs...)
	if err != nil {
		return nil, nil, newlyDirtiedChildBytes, err
	}

	// Update dirtied bytes and unrefs regardless of error.
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	df.UpdateNotYetSyncingBytes(newlyDirtiedChildBytes)

	latestWrite := si.op.addTruncate(size)
	now := fbo.nowUnixNano()
	newDe.Mtime = now
	newDe.Ctime = now
	err = fbo.updateEntryLocked(ctx, lState, kmd, file, newDe, true)
	if err != nil {
		return nil, nil, newlyDirtiedChildBytes, err
	}

	return &latestWrite, dirtyPtrs, newlyDirtiedChildBytes, nil
}

// Truncate truncates or extends the given file to the given size.
// May block if there is too much unflushed data; in that case, it
// will be unblocked by a future sync.
func (fbo *folderBlockOps) Truncate(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, file Node, size uint64) error {
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

	err = fbo.holdWritesLocked(ctx, lState)
	if err != nil {
		return err
	}

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
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Deferring a truncate to file %v",
			filePath.TailPointer())
		ds := fbo.deferred[filePath.TailRef()]
		ds.dirtyDeletes = append(ds.dirtyDeletes, dirtyPtrs...)
		ds.writes = append(ds.writes,
			func(ctx context.Context, lState *kbfssync.LockState,
				kmd KeyMetadataWithRootDirEntry, f data.Path) error {
				// We are about to re-dirty these bytes, so mark that
				// they will no longer be synced via the old file.
				df := fbo.getOrCreateDirtyFileLocked(lState, filePath)
				df.UpdateNotYetSyncingBytes(-newlyDirtiedChildBytes)

				// Truncate the file again.  We know this won't be
				// deferred, so no need to check the new ptrs.
				_, _, _, err := fbo.truncateLocked(
					ctx, lState, kmd, f, size)
				return err
			})
		ds.waitBytes += newlyDirtiedChildBytes
		fbo.deferred[filePath.TailRef()] = ds
	}

	return nil
}

// IsDirty returns whether the given file is dirty; if false is
// returned, then the file doesn't need to be synced.
func (fbo *folderBlockOps) IsDirty(lState *kbfssync.LockState, file data.Path) bool {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	// A dirty file should probably match all three of these, but
	// check them individually just in case.
	if fbo.config.DirtyBlockCache().IsDirty(
		fbo.id(), file.TailPointer(), file.Branch) {
		return true
	}

	if _, ok := fbo.dirtyFiles[file.TailPointer()]; ok {
		return ok
	}

	_, ok := fbo.unrefCache[file.TailRef()]
	return ok
}

func (fbo *folderBlockOps) clearCacheInfoLocked(lState *kbfssync.LockState,
	file data.Path) error {
	fbo.blockLock.AssertLocked(lState)
	ref := file.TailRef()
	delete(fbo.unrefCache, ref)
	df := fbo.dirtyFiles[file.TailPointer()]
	if df != nil {
		err := df.FinishSync()
		if err != nil {
			return err
		}
		delete(fbo.dirtyFiles, file.TailPointer())
	}
	return nil
}

func (fbo *folderBlockOps) clearAllDirtyDirsLocked(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata) {
	fbo.blockLock.AssertLocked(lState)
	dirtyBCache := fbo.config.DirtyBlockCache()
	for ptr := range fbo.dirtyDirs {
		dir := data.Path{
			FolderBranch: fbo.folderBranch,
			Path: []data.PathNode{
				{BlockPointer: ptr,
					Name: data.NewPathPartString(ptr.String(), nil),
				},
			},
		}
		dd := fbo.newDirDataLocked(lState, dir, keybase1.UserOrTeamID(""), kmd)
		childPtrs, err := dd.GetDirtyChildPtrs(ctx, dirtyBCache)
		if err != nil {
			fbo.log.CDebugf(ctx, "Failed to get child ptrs for %v: %+v",
				ptr, err)
		}
		for childPtr := range childPtrs {
			err := dirtyBCache.Delete(fbo.id(), childPtr, fbo.branch())
			if err != nil {
				fbo.log.CDebugf(
					ctx, "Failed to delete %v from dirty "+"cache: %+v",
					childPtr, err)
			}
		}

		err = dirtyBCache.Delete(fbo.id(), ptr, fbo.branch())
		if err != nil {
			fbo.log.CDebugf(ctx, "Failed to delete %v from dirty cache: %+v",
				ptr, err)
		}
	}
	fbo.dirtyDirs = make(map[data.BlockPointer][]data.BlockInfo)
	fbo.dirtyRootDirEntry = nil
	fbo.dirtyDirsSyncing = false
	deferredDirUpdates := fbo.deferredDirUpdates
	fbo.deferredDirUpdates = nil
	// Re-apply any deferred directory updates related to files that
	// weren't synced as part of this batch.
	for _, f := range deferredDirUpdates {
		err := f(lState)
		if err != nil {
			fbo.log.CWarningf(ctx, "Deferred entry update failed: %+v", err)
		}
	}
}

// ClearCacheInfo removes any cached info for the the given file.
func (fbo *folderBlockOps) ClearCacheInfo(
	lState *kbfssync.LockState, file data.Path) error {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	return fbo.clearCacheInfoLocked(lState, file)
}

// revertSyncInfoAfterRecoverableError updates the saved sync info to
// include all the blocks from before the error, except for those that
// have encountered recoverable block errors themselves.
func (fbo *folderBlockOps) revertSyncInfoAfterRecoverableError(
	ctx context.Context, blocksToRemove []data.BlockPointer, result fileSyncState) {
	si := result.si
	savedSi := result.savedSi

	// Save the blocks we need to clean up on the next attempt.
	toClean := si.toCleanIfUnused

	newIndirect := make(map[data.BlockPointer]bool)
	for _, ptr := range result.newIndirectFileBlockPtrs {
		newIndirect[ptr] = true
	}

	// Propagate all unrefs forward, except those that belong to new
	// blocks that were created during the sync.
	unrefs := make([]data.BlockInfo, 0, len(si.unrefs))
	for _, unref := range si.unrefs {
		if newIndirect[unref.BlockPointer] {
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Dropping unref %v", unref)
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

	// Mark any bad pointers so they get skipped next time.
	blocksToRemoveSet := make(map[data.BlockPointer]bool)
	for _, ptr := range blocksToRemove {
		blocksToRemoveSet[ptr] = true
	}

	newBps, err := savedSi.bps.deepCopyWithBlacklist(ctx, blocksToRemoveSet)
	if err != nil {
		return
	}
	si.bps = newBps
}

// fileSyncState holds state for a sync operation for a single
// file.
type fileSyncState struct {
	// If fblock is non-nil, the (dirty, indirect, cached) block
	// it points to will be set to savedFblock on a recoverable
	// error.
	fblock, savedFblock *data.FileBlock

	// redirtyOnRecoverableError, which is non-nil only when fblock is
	// non-nil, contains pointers that need to be re-dirtied if the
	// top block gets copied during the sync, and a recoverable error
	// happens.  Maps to the old block pointer for the block, which
	// would need a DirtyBlockCache.Delete.
	redirtyOnRecoverableError map[data.BlockPointer]data.BlockPointer

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
	oldFileBlockPtrs []data.BlockPointer

	// newIndirectFileBlockPtrs is a list of permanent entries
	// added to the block cache for the file, which should be
	// removed after the blocks have been sent to the server.
	// They are not removed on an error, because in that case the
	// file is still dirty locally and may get another chance to
	// be sync'd.
	//
	// TODO: This can be a list of IDs instead.
	newIndirectFileBlockPtrs []data.BlockPointer
}

// startSyncWrite contains the portion of StartSync() that's done
// while write-locking blockLock.  If there is no dirty de cache
// entry, dirtyDe will be nil.
func (fbo *folderBlockOps) startSyncWrite(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata, file data.Path) (
	fblock *data.FileBlock, bps blockPutStateCopiable, syncState fileSyncState,
	dirtyDe *data.DirEntry, err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	// update the parent directories, and write all the new blocks out
	// to disk
	fblock, err = fbo.getFileLocked(ctx, lState, md.ReadOnly(), file, data.BlockWrite)
	if err != nil {
		return nil, nil, syncState, nil, err
	}

	fileRef := file.TailRef()
	si, ok := fbo.unrefCache[fileRef]
	if !ok {
		return nil, nil, syncState, nil,
			fmt.Errorf("No syncOp found for file ref %v", fileRef)
	}

	// Collapse the write range to reduce the size of the sync op.
	si.op.Writes = si.op.collapseWriteRange(nil)
	// If this function returns a success, we need to make sure the op
	// in `md` is not the same variable as the op in `unrefCache`,
	// because the latter could get updated still by local writes
	// before `md` is flushed to the server.  We don't copy it here
	// because code below still needs to modify it (and by extension,
	// the one stored in `syncState.si`).
	si.op.setFinalPath(file)
	md.AddOp(si.op)

	// Fill in syncState.
	if fblock.IsInd {
		fblockCopy := fblock.DeepCopy()
		syncState.fblock = fblock
		syncState.savedFblock = fblockCopy
		syncState.redirtyOnRecoverableError = make(map[data.BlockPointer]data.BlockPointer)
	}
	syncState.si = si
	syncState.savedSi, err = si.DeepCopy(ctx, fbo.config.Codec())
	if err != nil {
		return nil, nil, syncState, nil, err
	}

	if si.bps == nil {
		si.bps = newBlockPutStateMemory(1)
	} else {
		// reinstate byte accounting from the previous Sync
		md.SetRefBytes(si.refBytes)
		md.AddDiskUsage(si.refBytes)
		md.SetUnrefBytes(si.unrefBytes)
		md.SetMDRefBytes(0) // this will be calculated anew
		md.SetDiskUsage(md.DiskUsage() - si.unrefBytes)
		syncState.newIndirectFileBlockPtrs = append(
			syncState.newIndirectFileBlockPtrs, si.op.Refs()...)
	}
	defer func() {
		si.refBytes = md.RefBytes()
		si.unrefBytes = md.UnrefBytes()
	}()

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, md)
	if err != nil {
		return nil, nil, syncState, nil, err
	}

	dirtyBcache := fbo.config.DirtyBlockCache()
	df := fbo.getOrCreateDirtyFileLocked(lState, file)
	fd := fbo.newFileData(lState, file, chargedTo, md.ReadOnly())

	// Note: below we add possibly updated file blocks as "unref" and
	// "ref" blocks.  This is fine, since conflict resolution or
	// notifications will never happen within a file.

	// If needed, split the children blocks up along new boundaries
	// (e.g., if using a fingerprint-based block splitter).
	unrefs, err := fd.Split(ctx, fbo.id(), dirtyBcache, fblock, df)
	// Preserve any unrefs before checking the error.
	for _, unref := range unrefs {
		md.AddUnrefBlock(unref)
	}
	if err != nil {
		return nil, nil, syncState, nil, err
	}

	// Ready all children blocks, if any.
	oldPtrs, err := fd.Ready(ctx, fbo.id(), fbo.config.BlockCache(),
		fbo.config.DirtyBlockCache(), fbo.config.BlockOps(), si.bps, fblock, df,
		fbo.cacheHashBehavior())
	if err != nil {
		return nil, nil, syncState, nil, err
	}

	for newInfo, oldPtr := range oldPtrs {
		syncState.newIndirectFileBlockPtrs = append(
			syncState.newIndirectFileBlockPtrs, newInfo.BlockPointer)
		df.SetBlockOrphaned(oldPtr, true)

		// Defer the DirtyBlockCache.Delete until after the new path
		// is ready, in case anyone tries to read the dirty file in
		// the meantime.
		syncState.oldFileBlockPtrs = append(syncState.oldFileBlockPtrs, oldPtr)

		md.AddRefBlock(newInfo)

		// If this block is replacing a block from a previous, failed
		// Sync, we need to take that block out of the refs list, and
		// avoid unrefing it as well.
		si.removeReplacedBlock(ctx, fbo.log, oldPtr)

		err = df.SetBlockSyncing(ctx, oldPtr)
		if err != nil {
			return nil, nil, syncState, nil, err
		}
		syncState.redirtyOnRecoverableError[newInfo.BlockPointer] = oldPtr
	}

	err = df.SetBlockSyncing(ctx, file.TailPointer())
	if err != nil {
		return nil, nil, syncState, nil, err
	}
	syncState.oldFileBlockPtrs = append(
		syncState.oldFileBlockPtrs, file.TailPointer())

	// Capture the current de before we release the block lock, so
	// other deferred writes don't slip in.
	dd := fbo.newDirDataLocked(lState, *file.ParentPath(), chargedTo, md)
	de, err := dd.Lookup(ctx, file.TailName())
	if err != nil {
		return nil, nil, syncState, nil, err
	}
	dirtyDe = &de

	// Leave a copy of the syncOp in `unrefCache`, since it may be
	// modified by future local writes while the syncOp in `md` should
	// only be modified by the rest of this sync process.
	var syncOpCopy *syncOp
	err = kbfscodec.Update(fbo.config.Codec(), &syncOpCopy, si.op)
	if err != nil {
		return nil, nil, syncState, nil, err
	}
	fbo.unrefCache[fileRef].op = syncOpCopy

	// If there are any deferred bytes, it must be because this is
	// a retried sync and some blocks snuck in between sync. Those
	// blocks will get transferred now, but they are also on the
	// deferred list and will be retried on the next sync as well.
	df.AssimilateDeferredNewBytes()

	// TODO: Returning si.bps in this way is racy, since si is a
	// member of unrefCache.
	return fblock, si.bps, syncState, dirtyDe, nil
}

func prepDirtyEntryForSync(md *RootMetadata, si *syncInfo, dirtyDe *data.DirEntry) {
	// Add in the cached unref'd blocks.
	si.mergeUnrefCache(md)
	// Update the file's directory entry to the cached copy.
	if dirtyDe != nil {
		dirtyDe.EncodedSize = si.oldInfo.EncodedSize
	}
}

// mergeDirtyEntryWithDBM sets the entry for a file into a directory,
// storing all the affected blocks into `dbm` rather than the dirty
// block cache.  It must only be called with an entry that's already
// been written to the dirty block cache, such that no new blocks are
// dirtied.
func (fbo *folderBlockOps) mergeDirtyEntryWithDBM(
	ctx context.Context, lState *kbfssync.LockState, file data.Path, md libkey.KeyMetadata,
	dbm dirBlockMap, dirtyDe data.DirEntry) error {
	// Lock and fetch for reading only, any dirty blocks will go into
	// the dbm.
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, md)
	if err != nil {
		return err
	}

	dd := fbo.newDirDataWithDBMLocked(
		lState, *file.ParentPath(), chargedTo, md, dbm)
	unrefs, err := dd.SetEntry(ctx, file.TailName(), dirtyDe)
	if err != nil {
		return err
	}
	if len(unrefs) != 0 {
		return errors.Errorf(
			"Merging dirty entry produced %d new unrefs", len(unrefs))
	}
	return nil
}

// StartSync starts a sync for the given file. It returns the new
// FileBlock which has the readied top-level block which includes all
// writes since the last sync. Must be used with CleanupSyncState()
// and UpdatePointers/FinishSyncLocked() like so:
//
//		fblock, bps, dirtyDe, syncState, err :=
//			...fbo.StartSync(ctx, lState, md, uid, file)
//		defer func() {
//			...fbo.CleanupSyncState(
//				ctx, lState, md, file, ..., syncState, err)
//		}()
//		if err != nil {
//			...
//		}
//	     ...
//
//
//		... = fbo.UpdatePointers(..., func() error {
//	     ...fbo.FinishSyncLocked(ctx, lState, file, ..., syncState)
//	 })
func (fbo *folderBlockOps) StartSync(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata, file data.Path) (
	fblock *data.FileBlock, bps blockPutStateCopiable, dirtyDe *data.DirEntry,
	syncState fileSyncState, err error) {
	if jManager, err := GetJournalManager(fbo.config); err == nil {
		jManager.dirtyOpStart(fbo.id())
	}

	fblock, bps, syncState, dirtyDe, err = fbo.startSyncWrite(
		ctx, lState, md, file)
	if err != nil {
		return nil, nil, nil, syncState, err
	}

	prepDirtyEntryForSync(md, syncState.si, dirtyDe)
	return fblock, bps, dirtyDe, syncState, err
}

// Does any clean-up for a sync of the given file, given an error
// (which may be nil) that happens during or after StartSync() and
// before FinishSync(). blocksToRemove may be nil.
func (fbo *folderBlockOps) CleanupSyncState(
	ctx context.Context, lState *kbfssync.LockState, md ReadOnlyRootMetadata,
	file data.Path, blocksToRemove []data.BlockPointer,
	result fileSyncState, err error) {
	if jManager, err := GetJournalManager(fbo.config); err == nil {
		defer jManager.dirtyOpEnd(fbo.id())
	}

	if err == nil {
		return
	}

	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	// Notify error listeners before we reset the dirty blocks and
	// permissions to be granted.
	fbo.notifyErrListenersLocked(lState, file.TailPointer(), err)

	// If there was an error, we need to back out any changes that
	// might have been filled into the sync op, because it could
	// get reused again in a later Sync call.
	if result.si != nil {
		result.si.op.resetUpdateState()

		// Save this MD for later, so we can clean up its
		// newly-referenced block pointers if necessary.
		bpsCopy, err := result.si.bps.deepCopy(ctx)
		if err != nil {
			return
		}
		result.si.toCleanIfUnused = append(result.si.toCleanIfUnused,
			mdToCleanIfUnused{md, bpsCopy})
	}
	if isRecoverableBlockError(err) {
		if result.si != nil {
			fbo.revertSyncInfoAfterRecoverableError(ctx, blocksToRemove, result)
		}
		if result.fblock != nil {
			result.fblock.Set(result.savedFblock)
			fbo.fixChildBlocksAfterRecoverableErrorLocked(
				ctx, lState, file, md,
				result.redirtyOnRecoverableError)
		}
	} else {
		// Since the sync has errored out unrecoverably, the deferred
		// bytes are already accounted for.
		ds := fbo.deferred[file.TailRef()]
		if df := fbo.dirtyFiles[file.TailPointer()]; df != nil {
			df.UpdateNotYetSyncingBytes(-ds.waitBytes)

			// Some blocks that were dirty are now clean under their
			// readied block ID, and now live in the bps rather than
			// the dirty bcache, so we can delete them from the dirty
			// bcache.
			dirtyBcache := fbo.config.DirtyBlockCache()
			for _, ptr := range result.oldFileBlockPtrs {
				if df.IsBlockOrphaned(ptr) {
					fbo.vlog.CLogf(
						ctx, libkb.VLog1, "Deleting dirty orphan: %v", ptr)
					if err := dirtyBcache.Delete(fbo.id(), ptr,
						fbo.branch()); err != nil {
						fbo.vlog.CLogf(
							ctx, libkb.VLog1, "Couldn't delete %v", ptr)
					}
				}
			}
		}

		// On an unrecoverable error, the deferred writes aren't
		// needed anymore since they're already part of the
		// (still-)dirty blocks.
		delete(fbo.deferred, file.TailRef())
	}

	// The sync is over, due to an error, so reset the map so that we
	// don't defer any subsequent writes.
	// Old syncing blocks are now just dirty
	if df := fbo.dirtyFiles[file.TailPointer()]; df != nil {
		df.ResetSyncingBlocksToDirty()
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
	refs := make(map[data.BlockPointer]bool)
	for _, op := range md.data.Changes.Ops {
		for _, ptr := range op.Refs() {
			if ptr == data.ZeroPtr {
				panic("Unexpected zero ref ptr in a sync MD revision")
			}
			refs[ptr] = true
		}
		for _, update := range op.allUpdates() {
			if update.Ref == data.ZeroPtr {
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
	blocksSeen := make(map[data.BlockPointer]bool)
	for _, oldMD := range syncState.si.toCleanIfUnused {
		bdType := blockDeleteAlways
		if oldMD.md.MergedStatus() != md.MergedStatus() {
			bdType = blockDeleteOnMDFail
		}

		failedBps := newBlockPutStateMemory(oldMD.bps.numBlocks())
		for _, ptr := range oldMD.bps.Ptrs() {
			if ptr == data.ZeroPtr {
				panic("Unexpected zero block ptr in an old sync MD revision")
			}
			if blocksSeen[ptr] {
				continue
			}
			blocksSeen[ptr] = true
			if refs[ptr] && bdType == blockDeleteAlways {
				continue
			}
			failedBps.blockStates[ptr] = blockState{}
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Cleaning up block %v from a previous "+
					"failed revision %d (oldMD is %s, bdType=%d)", ptr,
				oldMD.md.Revision(), oldMD.md.MergedStatus(), bdType)
		}

		if len(failedBps.blockStates) > 0 {
			fbm.cleanUpBlockState(oldMD.md, failedBps, bdType)
		}
	}
	return nil
}

func (fbo *folderBlockOps) doDeferredWritesLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd KeyMetadataWithRootDirEntry,
	oldPath, newPath data.Path) (stillDirty bool, err error) {
	fbo.blockLock.AssertLocked(lState)

	// Redo any writes or truncates that happened to our file while
	// the sync was happening.
	ds := fbo.deferred[oldPath.TailRef()]
	stillDirty = len(ds.writes) != 0
	delete(fbo.deferred, oldPath.TailRef())

	// Clear any dirty blocks that resulted from a write/truncate
	// happening during the sync, since we're redoing them below.
	dirtyBcache := fbo.config.DirtyBlockCache()
	for _, ptr := range ds.dirtyDeletes {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Deleting deferred dirty ptr %v", ptr)
		if err := dirtyBcache.Delete(fbo.id(), ptr, fbo.branch()); err != nil {
			return true, err
		}
	}

	for _, f := range ds.writes {
		err = f(ctx, lState, kmd, newPath)
		if err != nil {
			// It's a little weird to return an error from a deferred
			// write here. Hopefully that will never happen.
			return true, err
		}
	}
	return stillDirty, nil
}

// FinishSyncLocked finishes the sync process for a file, given the
// state from StartSync. Specifically, it re-applies any writes that
// happened since the call to StartSync.
func (fbo *folderBlockOps) FinishSyncLocked(
	ctx context.Context, lState *kbfssync.LockState,
	oldPath, newPath data.Path, md ReadOnlyRootMetadata,
	syncState fileSyncState, fbm *folderBlockManager) (
	stillDirty bool, err error) {
	fbo.blockLock.AssertLocked(lState)

	dirtyBcache := fbo.config.DirtyBlockCache()
	for _, ptr := range syncState.oldFileBlockPtrs {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Deleting dirty ptr %v", ptr)
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

	stillDirty, err = fbo.doDeferredWritesLocked(
		ctx, lState, md, oldPath, newPath)
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
func (fbo *folderBlockOps) notifyErrListenersLocked(
	lState *kbfssync.LockState, ptr data.BlockPointer, err error) {
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
		df.NotifyErrListeners(err)
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
	lState *kbfssync.LockState, cache NodeCache, newPtrs map[data.BlockPointer]bool,
	kmd libkey.KeyMetadata, rootNode Node, currDir data.Path, nodeMap map[data.BlockPointer]Node,
	numNodesFoundSoFar int) (int, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return 0, err
	}
	dd := fbo.newDirDataLocked(lState, currDir, chargedTo, kmd)
	entries, err := dd.GetEntries(ctx)
	if err != nil {
		return 0, err
	}

	// getDirLocked may have unlocked blockLock, which means the cache
	// could have changed out from under us.  Verify that didn't
	// happen, so we can avoid messing it up with nodes from an old MD
	// version.  If it did happen, return a special error that lets
	// the caller know they should retry with a fresh cache.
	if currDir.Path[0].BlockPointer !=
		cache.PathFromNode(rootNode).TailPointer() {
		return 0, searchWithOutOfDateCacheError{}
	}

	if numNodesFoundSoFar >= len(nodeMap) {
		return 0, nil
	}

	numNodesFound := 0
	for name, de := range entries {
		childPath := currDir.ChildPath(name, de.BlockPointer, nil)
		if _, ok := nodeMap[de.BlockPointer]; ok {
			// make a node for every pathnode
			n := rootNode
			for i, pn := range childPath.Path[1:] {
				if !pn.BlockPointer.IsValid() {
					// Temporary debugging output for KBFS-1764 -- the
					// GetOrCreate call below will panic.
					fbo.log.CDebugf(ctx, "Invalid block pointer, path=%s, "+
						"path.path=%v (index %d), name=%s, de=%#v, "+
						"nodeMap=%v, newPtrs=%v, kmd=%#v",
						childPath, childPath.Path, i, name, de, nodeMap,
						newPtrs, kmd)
				}
				et := data.Dir
				if i == len(childPath.Path)-2 {
					et = de.Type
				}
				n, err = cache.GetOrCreate(pn.BlockPointer, pn.Name, n, et)
				if err != nil {
					return 0, err
				}
			}
			childPath.ChildObfuscator = n.Obfuscator()
			nodeMap[de.BlockPointer] = n
			numNodesFound++
			if numNodesFoundSoFar+numNodesFound >= len(nodeMap) {
				return numNodesFound, nil
			}
		}

		// otherwise, recurse if this represents an updated block
		if _, ok := newPtrs[de.BlockPointer]; de.Type == data.Dir && ok {
			if childPath.Obfuscator() == nil {
				childPath.ChildObfuscator = fbo.nodeCache.ObfuscatorMaker()()
			}
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
	lState *kbfssync.LockState, cache NodeCache, ptrs []data.BlockPointer,
	newPtrs map[data.BlockPointer]bool, kmd libkey.KeyMetadata, rootPtr data.BlockPointer) (
	map[data.BlockPointer]Node, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	nodeMap := make(map[data.BlockPointer]Node)
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
			data.NewPathPartString(
				string(kmd.GetTlfHandle().GetCanonicalName()), nil),
			nil, data.Dir)
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
	if len(rootPath.Path) != 1 {
		return nil, fmt.Errorf("Invalid root path for %v: %s",
			rootPtr, rootPath)
	}

	_, err := fbo.searchForNodesInDirLocked(ctx, lState, cache, newPtrs,
		kmd, node, rootPath, nodeMap, numNodesFound)
	if err != nil {
		return nil, err
	}

	if rootPtr != cache.PathFromNode(node).TailPointer() {
		return nil, searchWithOutOfDateCacheError{}
	}

	return nodeMap, nil
}

func (fbo *folderBlockOps) searchForNodesLocked(ctx context.Context,
	lState *kbfssync.LockState, cache NodeCache, ptrs []data.BlockPointer,
	newPtrs map[data.BlockPointer]bool, kmd libkey.KeyMetadata,
	rootPtr data.BlockPointer) (map[data.BlockPointer]Node, NodeCache, error) {
	fbo.blockLock.AssertAnyLocked(lState)

	// First try the passed-in cache.  If it doesn't work because the
	// cache is out of date, try again with a clean cache.
	nodeMap, err := fbo.trySearchWithCacheLocked(ctx, lState, cache, ptrs,
		newPtrs, kmd, rootPtr)
	if _, ok := err.(searchWithOutOfDateCacheError); ok {
		// The md is out-of-date, so use a throwaway cache so we
		// don't pollute the real node cache with stale nodes.
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Root node %v doesn't exist in the node "+
				"cache; using a throwaway node cache instead",
			rootPtr)
		cache = newNodeCacheStandard(fbo.folderBranch)
		cache.SetObfuscatorMaker(fbo.nodeCache.ObfuscatorMaker())
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
	cache NodeCache, ptrs []data.BlockPointer, newPtrs map[data.BlockPointer]bool,
	kmd libkey.KeyMetadata, rootPtr data.BlockPointer) (
	map[data.BlockPointer]Node, NodeCache, error) {
	lState := makeFBOLockState()
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	return fbo.searchForNodesLocked(
		ctx, lState, cache, ptrs, newPtrs, kmd, rootPtr)
}

// SearchForPaths is like SearchForNodes, except it returns a
// consistent view of all the paths of the searched-for pointers.
func (fbo *folderBlockOps) SearchForPaths(ctx context.Context,
	cache NodeCache, ptrs []data.BlockPointer, newPtrs map[data.BlockPointer]bool,
	kmd libkey.KeyMetadata, rootPtr data.BlockPointer) (map[data.BlockPointer]data.Path, error) {
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

	paths := make(map[data.BlockPointer]data.Path)
	for ptr, n := range nodeMap {
		if n == nil {
			paths[ptr] = data.Path{}
			continue
		}

		p := cache.PathFromNode(n)
		if p.TailPointer() != ptr {
			return nil, NodeNotFoundError{ptr}
		}
		paths[ptr] = p
	}

	return paths, nil
}

// UpdateCachedEntryAttributesOnRemovedFile updates any cached entry
// for the given path of an unlinked file, according to the given op,
// and it makes a new dirty cache entry if one doesn't exist yet.  We
// assume Sync will be called eventually on the corresponding open
// file handle, which will clear out the entry.
func (fbo *folderBlockOps) UpdateCachedEntryAttributesOnRemovedFile(
	ctx context.Context, lState *kbfssync.LockState,
	kmd KeyMetadataWithRootDirEntry, op *setAttrOp, p data.Path, de data.DirEntry) error {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	_, err := fbo.setCachedAttrLocked(
		ctx, lState, kmd, *p.ParentPath(), p.TailName(), op.Attr, de)
	return err
}

func (fbo *folderBlockOps) getDeferredWriteCountForTest(
	lState *kbfssync.LockState) int {
	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)
	writes := 0
	for _, ds := range fbo.deferred {
		writes += len(ds.writes)
	}
	return writes
}

func (fbo *folderBlockOps) updatePointer(kmd libkey.KeyMetadata, oldPtr data.BlockPointer, newPtr data.BlockPointer, shouldPrefetch bool) NodeID {
	updatedNode := fbo.nodeCache.UpdatePointer(oldPtr.Ref(), newPtr)
	if updatedNode == nil || oldPtr.ID == newPtr.ID {
		return nil
	}

	// Only prefetch if the updated pointer is a new block ID.
	// TODO: Remove this comment when we're done debugging because it'll be everywhere.
	ctx := context.TODO()
	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Updated reference for pointer %s to %s.",
		oldPtr.ID, newPtr.ID)
	if shouldPrefetch {
		// Prefetch the new ref, but only if the old ref already exists in
		// the block cache. Ideally we'd always prefetch it, but we need
		// the type of the block so that we can call `NewEmpty`.
		block, lifetime, err := fbo.config.BlockCache().GetWithLifetime(oldPtr)
		if err != nil {
			return updatedNode
		}

		// No need to cache because it's already cached.
		action := fbo.config.Mode().DefaultBlockRequestAction()
		if fbo.branch() != data.MasterBranch {
			action = action.AddNonMasterBranch()
		}
		_ = fbo.config.BlockOps().BlockRetriever().Request(
			ctx, updatePointerPrefetchPriority, kmd, newPtr, block.NewEmpty(),
			lifetime, action)
	}
	// Cancel any prefetches for the old pointer from the prefetcher.
	fbo.config.BlockOps().Prefetcher().CancelPrefetch(oldPtr)
	return updatedNode
}

// UpdatePointers updates all the pointers in the node cache
// atomically.  If `afterUpdateFn` is non-nil, it's called under the
// same block lock under which the pointers were updated.
func (fbo *folderBlockOps) UpdatePointers(
	kmd libkey.KeyMetadata, lState *kbfssync.LockState, op op, shouldPrefetch bool,
	afterUpdateFn func() error) (affectedNodeIDs []NodeID, err error) {
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	for _, update := range op.allUpdates() {
		updatedNode := fbo.updatePointer(
			kmd, update.Unref, update.Ref, shouldPrefetch)
		if updatedNode != nil {
			affectedNodeIDs = append(affectedNodeIDs, updatedNode)
		}
	}

	// Cancel any prefetches for all unreferenced block pointers.
	for _, unref := range op.Unrefs() {
		fbo.config.BlockOps().Prefetcher().CancelPrefetch(unref)
	}

	if afterUpdateFn == nil {
		return affectedNodeIDs, nil
	}

	return affectedNodeIDs, afterUpdateFn()
}

func (fbo *folderBlockOps) unlinkDuringFastForwardLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd KeyMetadataWithRootDirEntry, ref data.BlockRef) (undoFn func()) {
	fbo.blockLock.AssertLocked(lState)
	oldNode := fbo.nodeCache.Get(ref)
	if oldNode == nil {
		return nil
	}
	oldPath := fbo.nodeCache.PathFromNode(oldNode)
	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Unlinking missing node %s/%v during "+
			"fast-forward", oldPath, ref)
	de, err := fbo.getEntryLocked(ctx, lState, kmd, oldPath, true)
	if err != nil {
		fbo.log.CDebugf(ctx, "Couldn't find old dir entry for %s/%v: %+v",
			oldPath, ref, err)
	}
	return fbo.nodeCache.Unlink(ref, oldPath, de)
}

type nodeChildrenMap map[string]map[data.PathNode]bool

func (ncm nodeChildrenMap) addDirChange(
	node Node, p data.Path, changes []NodeChange, affectedNodeIDs []NodeID) (
	[]NodeChange, []NodeID) {
	change := NodeChange{Node: node}
	for subchild := range ncm[p.String()] {
		change.DirUpdated = append(change.DirUpdated, subchild.Name)
	}
	changes = append(changes, change)
	affectedNodeIDs = append(affectedNodeIDs, node.GetID())
	return changes, affectedNodeIDs
}

func (nodeChildrenMap) addFileChange(
	node Node, changes []NodeChange, affectedNodeIDs []NodeID) (
	[]NodeChange, []NodeID) {
	// Invalidate the entire file contents.
	changes = append(changes, NodeChange{
		Node:        node,
		FileUpdated: []WriteRange{{Len: 0, Off: 0}},
	})
	affectedNodeIDs = append(affectedNodeIDs, node.GetID())
	return changes, affectedNodeIDs
}

func (fbo *folderBlockOps) fastForwardDirAndChildrenLocked(ctx context.Context,
	lState *kbfssync.LockState, currDir data.Path, children nodeChildrenMap,
	kmd KeyMetadataWithRootDirEntry,
	updates map[data.BlockPointer]data.BlockPointer) (
	changes []NodeChange, affectedNodeIDs []NodeID, undoFns []func(),
	err error) {
	fbo.blockLock.AssertLocked(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return nil, nil, undoFns, err
	}
	dd := fbo.newDirDataLocked(lState, currDir, chargedTo, kmd)
	entries, err := dd.GetEntries(ctx)
	if err != nil {
		return nil, nil, undoFns, err
	}

	prefix := currDir.String()

	// TODO: parallelize me?
	for child := range children[prefix] {
		entry, ok := entries[child.Name]
		if !ok {
			undoFn := fbo.unlinkDuringFastForwardLocked(
				ctx, lState, kmd, child.BlockPointer.Ref())
			if undoFn != nil {
				undoFns = append(undoFns, undoFn)
			}
			continue
		}

		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Fast-forwarding %v -> %v",
			child.BlockPointer, entry.BlockPointer)
		fbo.updatePointer(kmd, child.BlockPointer,
			entry.BlockPointer, true)
		updates[child.BlockPointer] = entry.BlockPointer
		node := fbo.nodeCache.Get(entry.BlockPointer.Ref())
		if node == nil {
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Skipping missing node for %s",
				entry.BlockPointer)
			continue
		}
		if entry.Type == data.Dir {
			newPath := fbo.nodeCache.PathFromNode(node)
			changes, affectedNodeIDs = children.addDirChange(
				node, newPath, changes, affectedNodeIDs)

			childChanges, childAffectedNodeIDs, childUndoFns, err :=
				fbo.fastForwardDirAndChildrenLocked(
					ctx, lState, newPath, children, kmd, updates)
			undoFns = append(undoFns, childUndoFns...)
			if err != nil {
				return nil, nil, undoFns, err
			}
			changes = append(changes, childChanges...)
			affectedNodeIDs = append(affectedNodeIDs, childAffectedNodeIDs...)
		} else {
			// File -- invalidate the entire file contents.
			changes, affectedNodeIDs = children.addFileChange(
				node, changes, affectedNodeIDs)
		}
	}
	delete(children, prefix)
	return changes, affectedNodeIDs, undoFns, nil
}

func (fbo *folderBlockOps) makeChildrenTreeFromNodesLocked(
	lState *kbfssync.LockState, nodes []Node) (
	rootPath data.Path, children nodeChildrenMap) {
	fbo.blockLock.AssertLocked(lState)

	// Build a "tree" representation for each interesting path prefix.
	children = make(nodeChildrenMap)
	for _, n := range nodes {
		p := fbo.nodeCache.PathFromNode(n)
		if len(p.Path) == 1 {
			rootPath = p
		}
		prevPath := ""
		for _, pn := range p.Path {
			if prevPath != "" {
				childPNs := children[prevPath]
				if childPNs == nil {
					childPNs = make(map[data.PathNode]bool)
					children[prevPath] = childPNs
				}
				childPNs[pn] = true
			}
			prevPath = pathlib.Join(prevPath, pn.Name.Plaintext())
		}
	}
	return rootPath, children
}

// FastForwardAllNodes attempts to update the block pointers
// associated with nodes in the cache by searching for their paths in
// the current version of the TLF.  If it can't find a corresponding
// node, it assumes it's been deleted and unlinks it.  Returns the set
// of node changes that resulted.  If there are no nodes, it returns a
// nil error because there's nothing to be done.
func (fbo *folderBlockOps) FastForwardAllNodes(ctx context.Context,
	lState *kbfssync.LockState, md ReadOnlyRootMetadata) (
	changes []NodeChange, affectedNodeIDs []NodeID, err error) {
	if fbo.nodeCache == nil {
		// Nothing needs to be done!
		return nil, nil, nil
	}

	// Take a hard lock through this whole process.  TODO: is there
	// any way to relax this?  It could lead to file system operation
	// timeouts, even on reads, if we hold it too long.
	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)

	nodes := fbo.nodeCache.AllNodes()
	if len(nodes) == 0 {
		// Nothing needs to be done!
		return nil, nil, nil
	}
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Fast-forwarding %d nodes", len(nodes))
	defer func() {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Fast-forward complete: %v", err)
	}()

	rootPath, children := fbo.makeChildrenTreeFromNodesLocked(lState, nodes)
	if !rootPath.IsValid() {
		return nil, nil, errors.New("Couldn't find the root path")
	}

	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Fast-forwarding root %v -> %v",
		rootPath.Path[0].BlockPointer, md.data.Dir.BlockPointer)
	fbo.updatePointer(md, rootPath.Path[0].BlockPointer,
		md.data.Dir.BlockPointer, false)

	// Keep track of all the pointer updates done, and unwind them if
	// there's any error.
	updates := make(map[data.BlockPointer]data.BlockPointer)
	updates[rootPath.Path[0].BlockPointer] = md.data.Dir.BlockPointer
	var undoFns []func()
	defer func() {
		if err == nil {
			return
		}
		for oldID, newID := range updates {
			fbo.updatePointer(md, newID, oldID, false)
		}
		for _, f := range undoFns {
			f()
		}
	}()

	rootPath.Path[0].BlockPointer = md.data.Dir.BlockPointer
	rootNode := fbo.nodeCache.Get(md.data.Dir.BlockPointer.Ref())
	if rootNode != nil {
		change := NodeChange{Node: rootNode}
		for child := range children[rootPath.String()] {
			change.DirUpdated = append(change.DirUpdated, child.Name)
		}
		changes = append(changes, change)
		affectedNodeIDs = append(affectedNodeIDs, rootNode.GetID())
	}

	childChanges, childAffectedNodeIDs, undoFns, err :=
		fbo.fastForwardDirAndChildrenLocked(
			ctx, lState, rootPath, children, md, updates)
	if err != nil {
		return nil, nil, err
	}
	changes = append(changes, childChanges...)
	affectedNodeIDs = append(affectedNodeIDs, childAffectedNodeIDs...)

	// Unlink any children that remain.
	for _, childPNs := range children {
		for child := range childPNs {
			fbo.unlinkDuringFastForwardLocked(
				ctx, lState, md, child.BlockPointer.Ref())
		}
	}
	return changes, affectedNodeIDs, nil
}

func (fbo *folderBlockOps) getInvalidationChangesForNodes(
	ctx context.Context, lState *kbfssync.LockState, nodes []Node) (
	changes []NodeChange, affectedNodeIDs []NodeID, err error) {
	fbo.blockLock.AssertLocked(lState)
	if len(nodes) == 0 {
		// Nothing needs to be done!
		return nil, nil, nil
	}

	_, children := fbo.makeChildrenTreeFromNodesLocked(lState, nodes)
	for _, node := range nodes {
		p := fbo.nodeCache.PathFromNode(node)
		prefix := p.String()
		childNodes := children[prefix]
		if len(childNodes) > 0 {
			// This must be a directory.  Invalidate all children.
			changes, affectedNodeIDs = children.addDirChange(
				node, p, changes, affectedNodeIDs)
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Invalidating dir node %p/%s", node, prefix)
		} else {
			// This might be a file.  In any case, it doesn't have any
			// children that need invalidation, so just send the file
			// change.
			changes, affectedNodeIDs = children.addFileChange(
				node, changes, affectedNodeIDs)
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Invalidating possible file node %p/%s",
				node, prefix)
		}
	}
	return changes, affectedNodeIDs, nil
}

// GetInvalidationChangesForNode returns the list of invalidation
// notifications for all the nodes rooted at the given node.
func (fbo *folderBlockOps) GetInvalidationChangesForNode(
	ctx context.Context, lState *kbfssync.LockState, node Node) (
	changes []NodeChange, affectedNodeIDs []NodeID, err error) {
	if fbo.nodeCache == nil {
		// Nothing needs to be done!
		return nil, nil, nil
	}

	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "About to get all children for node %p", node)
	childNodes := fbo.nodeCache.AllNodeChildren(node)
	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Found %d children for node %p", len(childNodes),
		node)
	return fbo.getInvalidationChangesForNodes(
		ctx, lState, append(childNodes, node))
}

// GetInvalidationChangesForAll returns the list of invalidation
// notifications for the entire TLF.
func (fbo *folderBlockOps) GetInvalidationChangesForAll(
	ctx context.Context, lState *kbfssync.LockState) (
	changes []NodeChange, affectedNodeIDs []NodeID, err error) {
	if fbo.nodeCache == nil {
		// Nothing needs to be done!
		return nil, nil, nil
	}

	fbo.blockLock.Lock(lState)
	defer fbo.blockLock.Unlock(lState)
	childNodes := fbo.nodeCache.AllNodes()
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Found %d nodes", len(childNodes))
	return fbo.getInvalidationChangesForNodes(ctx, lState, childNodes)
}

// MarkNode marks all the blocks in the node's block tree with the
// given tag.
func (fbo *folderBlockOps) MarkNode(
	ctx context.Context, lState *kbfssync.LockState, node Node, kmd libkey.KeyMetadata,
	tag string, cacheType DiskBlockCacheType) error {
	dbc := fbo.config.DiskBlockCache()
	if dbc == nil {
		return nil
	}

	fbo.blockLock.RLock(lState)
	defer fbo.blockLock.RUnlock(lState)

	chargedTo, err := fbo.getChargedToLocked(ctx, lState, kmd)
	if err != nil {
		return err
	}
	p := fbo.nodeCache.PathFromNode(node)
	err = dbc.Mark(ctx, p.TailPointer().ID, tag, cacheType)
	if err != nil {
		return err
	}
	var infos []data.BlockInfo
	if node.EntryType() == data.Dir {
		dd := fbo.newDirDataLocked(lState, p, chargedTo, kmd)
		infos, err = dd.GetIndirectDirBlockInfos(ctx)
	} else {
		fd := fbo.newFileData(lState, p, chargedTo, kmd)
		infos, err = fd.GetIndirectFileBlockInfos(ctx)
	}
	if err != nil {
		return err
	}

	for _, info := range infos {
		err = dbc.Mark(ctx, info.BlockPointer.ID, tag, cacheType)
		switch errors.Cause(err).(type) {
		case nil:
		case data.NoSuchBlockError:
		default:
			return err
		}
	}
	return nil
}

type chainsPathPopulator interface {
	populateChainPaths(context.Context, logger.Logger, *crChains, bool) error
	obfuscatorMaker() func() data.Obfuscator
}

// populateChainPaths updates all the paths in all the ops tracked by
// `chains`, using the main nodeCache.
func (fbo *folderBlockOps) populateChainPaths(ctx context.Context,
	log logger.Logger, chains *crChains, includeCreates bool) error {
	_, err := chains.getPaths(
		ctx, fbo, log, fbo.nodeCache, includeCreates,
		fbo.config.Mode().IsTestMode())
	return err
}

func (fbo *folderBlockOps) obfuscatorMaker() func() data.Obfuscator {
	return fbo.nodeCache.ObfuscatorMaker()
}

var _ chainsPathPopulator = (*folderBlockOps)(nil)
