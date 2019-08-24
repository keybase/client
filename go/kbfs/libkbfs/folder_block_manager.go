// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type fbmHelper interface {
	getMostRecentFullyMergedMD(ctx context.Context) (
		ImmutableRootMetadata, error)
	finalizeGCOp(ctx context.Context, gco *GCOp) error
	getLatestMergedRevision(lState *kbfssync.LockState) kbfsmd.Revision
}

const (
	// How many pointers to downgrade in a single Archive/Delete call.
	numPointersToDowngradePerChunk = 20
	// Once the number of pointers being deleted in a single gc op
	// passes this threshold, we'll stop garbage collection at the
	// current revision.
	numPointersPerGCThresholdDefault = 100
	// The most revisions to consider for each QR run.
	numMaxRevisionsPerQR = 100
)

type blockDeleteType int

const (
	// Delete the blocks only if the given MD failed to make it to the
	// servers.
	blockDeleteOnMDFail blockDeleteType = iota

	// Always delete the blocks, without first checking if the given
	// revision was successful.  This is just an optimization to avoid
	// fetching the MD from the server when we know for sure it had
	// failed.
	blockDeleteAlways
)

type blocksToDelete struct {
	md      ReadOnlyRootMetadata
	blocks  []data.BlockPointer
	bdType  blockDeleteType
	backoff backoff.BackOff
}

// folderBlockManager is a helper class for managing the blocks in a
// particular TLF.  It archives historical blocks and reclaims quota
// usage, all in the background.
type folderBlockManager struct {
	appStateUpdater env.AppStateUpdater
	config          Config
	log             logger.Logger
	shutdownChan    chan struct{}
	id              tlf.ID

	numPointersPerGCThreshold int

	// A queue of MD updates for this folder that need to have their
	// unref's blocks archived
	archiveChan chan ReadOnlyRootMetadata

	archivePauseChan chan (<-chan struct{})

	// archiveGroup tracks the outstanding archives.
	archiveGroup kbfssync.RepeatedWaitGroup

	archiveCancelLock sync.Mutex
	archiveCancel     context.CancelFunc

	// blocksToDeleteChan is a list of blocks, for a given
	// metadata revision, that may have been Put as part of a failed
	// MD write. These blocks should be deleted as soon as we know
	// for sure that the MD write isn't visible to others.
	// TODO: Persist these to disk?
	blocksToDeleteChan      chan blocksToDelete
	blocksToDeletePauseChan chan (<-chan struct{})
	blocksToDeleteWaitGroup kbfssync.RepeatedWaitGroup

	blocksToDeleteCancelLock sync.Mutex
	blocksToDeleteCancel     context.CancelFunc

	// forceReclamation forces the manager to start a reclamation
	// process.
	forceReclamationChan chan struct{}

	// reclamationGroup tracks the outstanding quota reclamations.
	reclamationGroup kbfssync.RepeatedWaitGroup

	reclamationCancelLock sync.Mutex
	reclamationCancel     context.CancelFunc

	// latestMergedChan signals when we learn about a newer latest
	// merged revision for this TLF.
	latestMergedChan chan struct{}

	// cleanDiskCachesGroup tracks the outstanding disk-cache cleanings.
	cleanDiskCachesGroup kbfssync.RepeatedWaitGroup

	cleanDiskCacheCancelLock sync.Mutex
	cleanDiskCacheCancel     context.CancelFunc

	helper fbmHelper

	// Remembers what happened last time during quota reclamation.
	lastQRLock          sync.Mutex
	lastQRHeadRev       kbfsmd.Revision
	wasLastQRComplete   bool
	lastReclamationTime time.Time
	lastReclaimedRev    kbfsmd.Revision
}

func newFolderBlockManager(
	appStateUpdater env.AppStateUpdater, config Config, fb data.FolderBranch,
	bType branchType, helper fbmHelper) *folderBlockManager {
	tlfStringFull := fb.Tlf.String()
	log := config.MakeLogger(fmt.Sprintf("FBM %s", tlfStringFull[:8]))

	var latestMergedChan chan struct{}
	qrEnabled :=
		fb.Branch == data.MasterBranch && config.Mode().QuotaReclamationEnabled()
	if qrEnabled {
		latestMergedChan = make(chan struct{}, 1)
	}

	fbm := &folderBlockManager{
		appStateUpdater:           appStateUpdater,
		config:                    config,
		log:                       log,
		shutdownChan:              make(chan struct{}),
		id:                        fb.Tlf,
		numPointersPerGCThreshold: numPointersPerGCThresholdDefault,
		archiveChan:               make(chan ReadOnlyRootMetadata, 500),
		archivePauseChan:          make(chan (<-chan struct{})),
		blocksToDeleteChan:        make(chan blocksToDelete, 25),
		blocksToDeletePauseChan:   make(chan (<-chan struct{})),
		forceReclamationChan:      make(chan struct{}, 1),
		latestMergedChan:          latestMergedChan,
		helper:                    helper,
	}

	if bType != standard || !config.Mode().BlockManagementEnabled() {
		return fbm
	}

	go fbm.archiveBlocksInBackground()
	go fbm.deleteBlocksInBackground()
	if qrEnabled {
		go fbm.reclaimQuotaInBackground()
		go fbm.cleanDiskCachesInBackground()
	}
	return fbm
}

func (fbm *folderBlockManager) setBlocksToDeleteCancel(cancel context.CancelFunc) {
	fbm.blocksToDeleteCancelLock.Lock()
	defer fbm.blocksToDeleteCancelLock.Unlock()
	fbm.blocksToDeleteCancel = cancel
}

func (fbm *folderBlockManager) cancelBlocksToDelete() {
	blocksToDeleteCancel := func() context.CancelFunc {
		fbm.blocksToDeleteCancelLock.Lock()
		defer fbm.blocksToDeleteCancelLock.Unlock()
		blocksToDeleteCancel := fbm.blocksToDeleteCancel
		fbm.blocksToDeleteCancel = nil
		return blocksToDeleteCancel
	}()
	if blocksToDeleteCancel != nil {
		blocksToDeleteCancel()
	}
}

func (fbm *folderBlockManager) setArchiveCancel(cancel context.CancelFunc) {
	fbm.archiveCancelLock.Lock()
	defer fbm.archiveCancelLock.Unlock()
	fbm.archiveCancel = cancel
}

func (fbm *folderBlockManager) cancelArchive() {
	archiveCancel := func() context.CancelFunc {
		fbm.archiveCancelLock.Lock()
		defer fbm.archiveCancelLock.Unlock()
		archiveCancel := fbm.archiveCancel
		fbm.archiveCancel = nil
		return archiveCancel
	}()
	if archiveCancel != nil {
		archiveCancel()
	}
}

func (fbm *folderBlockManager) setReclamationCancel(cancel context.CancelFunc) {
	fbm.reclamationCancelLock.Lock()
	defer fbm.reclamationCancelLock.Unlock()
	fbm.reclamationCancel = cancel
}

func (fbm *folderBlockManager) cancelReclamation() {
	reclamationCancel := func() context.CancelFunc {
		fbm.reclamationCancelLock.Lock()
		defer fbm.reclamationCancelLock.Unlock()
		reclamationCancel := fbm.reclamationCancel
		fbm.reclamationCancel = nil
		return reclamationCancel
	}()
	if reclamationCancel != nil {
		reclamationCancel()
	}
}

func (fbm *folderBlockManager) setCleanDiskCacheCancel(
	cancel context.CancelFunc) {
	fbm.cleanDiskCacheCancelLock.Lock()
	defer fbm.cleanDiskCacheCancelLock.Unlock()
	fbm.cleanDiskCacheCancel = cancel
}

func (fbm *folderBlockManager) cancelCleanDiskCache() {
	cleanDiskCacheCancel := func() context.CancelFunc {
		fbm.cleanDiskCacheCancelLock.Lock()
		defer fbm.cleanDiskCacheCancelLock.Unlock()
		cleanDiskCacheCancel := fbm.cleanDiskCacheCancel
		fbm.cleanDiskCacheCancel = nil
		return cleanDiskCacheCancel
	}()
	if cleanDiskCacheCancel != nil {
		cleanDiskCacheCancel()
	}
}

func (fbm *folderBlockManager) shutdown() {
	close(fbm.shutdownChan)
	fbm.cancelArchive()
	fbm.cancelBlocksToDelete()
	fbm.cancelReclamation()
	fbm.cancelCleanDiskCache()
}

// cleanUpBlockState cleans up any blocks that may have been orphaned
// by a failure during or after blocks have been sent to the
// server. This is usually used in a defer right before a call to
// fbo.doBlockPuts like so:
//
//  defer func() {
//    if err != nil {
//      ...cleanUpBlockState(md.ReadOnly(), bps)
//    }
//  }()
//
//  ... = ...doBlockPuts(ctx, md.ReadOnly(), *bps)
//
// The exception is for when blocks might get reused across multiple
// attempts at the same operation (like for a Sync).  In that case,
// failed blocks should be built up in a separate data structure, and
// this should be called when the operation finally succeeds.
func (fbm *folderBlockManager) cleanUpBlockState(
	md ReadOnlyRootMetadata, bps blockPutState, bdType blockDeleteType) {
	fbm.log.CDebugf(
		context.TODO(), "Clean up md %d %s, bdType=%d", md.Revision(),
		md.MergedStatus(), bdType)
	expBackoff := backoff.NewExponentialBackOff()
	// Never give up when trying to delete blocks; it might just take
	// a long time to confirm with the server whether a revision
	// succeeded or not.
	expBackoff.MaxElapsedTime = 0
	toDelete := blocksToDelete{
		md:      md,
		bdType:  bdType,
		backoff: expBackoff,
	}
	toDelete.blocks = append(toDelete.blocks, bps.Ptrs()...)
	fbm.enqueueBlocksToDelete(toDelete)
}

func (fbm *folderBlockManager) enqueueBlocksToDelete(toDelete blocksToDelete) {
	fbm.blocksToDeleteWaitGroup.Add(1)
	fbm.blocksToDeleteChan <- toDelete
}

func (fbm *folderBlockManager) enqueueBlocksToDeleteAfterShortDelay(
	ctx context.Context, toDelete blocksToDelete) {
	fbm.blocksToDeleteWaitGroup.Add(1)
	duration := toDelete.backoff.NextBackOff()
	if duration == backoff.Stop {
		panic(fmt.Sprintf("Backoff stopped while checking whether we "+
			"should delete revision %d", toDelete.md.Revision()))
	}
	time.AfterFunc(duration,
		func() {
			select {
			case fbm.blocksToDeleteChan <- toDelete:
			case <-fbm.shutdownChan:
				fbm.blocksToDeleteWaitGroup.Done()
			}
		})
}

// enqueueBlocksToDeleteNoWait enqueues blocks to be deleted just like
// enqueueBlocksToDelete, except that when fbm.blocksToDeleteChan is full, it
// doesn't block, but instead spawns a goroutine to handle the sending.
//
// This is necessary to prevent a situation like following:
// 1. A delete fails when fbm.blocksToDeleteChan is full
// 2. The goroutine tries to put the failed toDelete back to
//    fbm.blocksToDeleteChan
// 3. Step 2 becomes synchronous and is blocked because
//    fbm.blocksToDeleteChan is already full
// 4. fbm.blocksToDeleteChan never gets drained because the goroutine that
//    drains it is waiting for sending on the same channel.
// 5. Deadlock!
func (fbm *folderBlockManager) enqueueBlocksToDeleteNoWait(toDelete blocksToDelete) {
	fbm.blocksToDeleteWaitGroup.Add(1)

	select {
	case fbm.blocksToDeleteChan <- toDelete:
		return
	default:
		go func() { fbm.blocksToDeleteChan <- toDelete }()
	}
}

func isArchivableOp(op op) bool {
	switch op.(type) {
	case *createOp:
		return true
	case *rmOp:
		return true
	case *renameOp:
		return true
	case *syncOp:
		return true
	case *setAttrOp:
		return true
	case *resolutionOp:
		return true
	default:
		// rekey ops don't have anything to archive, and gc
		// ops only have deleted blocks.
		return false
	}
}

func isArchivableMDOrError(md ReadOnlyRootMetadata) error {
	if md.MergedStatus() != kbfsmd.Merged {
		return fmt.Errorf("md rev=%d is not merged", md.Revision())
	}

	for _, op := range md.data.Changes.Ops {
		if !isArchivableOp(op) {
			return fmt.Errorf(
				"md rev=%d has unarchivable op %s",
				md.Revision(), op)
		}
	}
	return nil
}

func (fbm *folderBlockManager) archiveUnrefBlocks(md ReadOnlyRootMetadata) {
	// Don't archive for unmerged revisions, because conflict
	// resolution might undo some of the unreferences.
	if md.MergedStatus() != kbfsmd.Merged {
		return
	}

	if err := isArchivableMDOrError(md); err != nil {
		panic(err)
	}

	fbm.archiveGroup.Add(1)
	fbm.archiveChan <- md
}

// archiveUnrefBlocksNoWait enqueues the MD for archiving without
// blocking.  By the time it returns, the archive group has been
// incremented so future waits will block on this archive.  This
// method is for internal use within folderBlockManager only.
func (fbm *folderBlockManager) archiveUnrefBlocksNoWait(md ReadOnlyRootMetadata) {
	// Don't archive for unmerged revisions, because conflict
	// resolution might undo some of the unreferences.
	if md.MergedStatus() != kbfsmd.Merged {
		return
	}

	if err := isArchivableMDOrError(md); err != nil {
		panic(err)
	}

	fbm.archiveGroup.Add(1)

	// Don't block if the channel is full; instead do the send in a
	// background goroutine.  We've already done the Add above, so the
	// wait calls should all work just fine.
	select {
	case fbm.archiveChan <- md:
		return
	default:
		go func() { fbm.archiveChan <- md }()
	}
}

func (fbm *folderBlockManager) waitForArchives(ctx context.Context) error {
	return fbm.archiveGroup.Wait(ctx)
}

func (fbm *folderBlockManager) waitForDeletingBlocks(ctx context.Context) error {
	return fbm.blocksToDeleteWaitGroup.Wait(ctx)
}

func (fbm *folderBlockManager) waitForQuotaReclamations(
	ctx context.Context) error {
	return fbm.reclamationGroup.Wait(ctx)
}

func (fbm *folderBlockManager) waitForDiskCacheCleans(
	ctx context.Context) error {
	return fbm.cleanDiskCachesGroup.Wait(ctx)
}

func (fbm *folderBlockManager) forceQuotaReclamation() {
	fbm.reclamationGroup.Add(1)
	select {
	case fbm.forceReclamationChan <- struct{}{}:
	default:
		fbm.reclamationGroup.Done()
	}
}

// doChunkedDowngrades sends batched archive or delete messages to the
// block server for the given block pointers.  For deletes, it returns
// a list of block IDs that no longer have any references.
func (fbm *folderBlockManager) doChunkedDowngrades(ctx context.Context,
	tlfID tlf.ID, ptrs []data.BlockPointer, archive bool) (
	[]kbfsblock.ID, error) {
	fbm.log.CDebugf(ctx, "Downgrading %d pointers (archive=%t)",
		len(ptrs), archive)
	bops := fbm.config.BlockOps()

	// Round up to find the number of chunks.
	numChunks := (len(ptrs) + numPointersToDowngradePerChunk - 1) /
		numPointersToDowngradePerChunk
	numWorkers := numChunks
	if numWorkers > maxParallelBlockPuts {
		numWorkers = maxParallelBlockPuts
	}
	chunks := make(chan []data.BlockPointer, numChunks)

	var wg sync.WaitGroup
	defer wg.Wait()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	type workerResult struct {
		zeroRefCounts []kbfsblock.ID
		err           error
	}

	chunkResults := make(chan workerResult, numChunks)
	worker := func() {
		defer wg.Done()
		for chunk := range chunks {
			var res workerResult
			fbm.log.CDebugf(ctx, "Downgrading chunk of %d pointers", len(chunk))
			if archive {
				res.err = bops.Archive(ctx, tlfID, chunk)
			} else {
				var liveCounts map[kbfsblock.ID]int
				liveCounts, res.err = bops.Delete(ctx, tlfID, chunk)
				if res.err == nil {
					for id, count := range liveCounts {
						if count == 0 {
							res.zeroRefCounts = append(res.zeroRefCounts, id)
						}
					}
				}
			}
			chunkResults <- res
			select {
			// return early if the context has been canceled
			case <-ctx.Done():
				return
			default:
			}
		}
	}
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go worker()
	}

	for start := 0; start < len(ptrs); start += numPointersToDowngradePerChunk {
		end := start + numPointersToDowngradePerChunk
		if end > len(ptrs) {
			end = len(ptrs)
		}
		chunks <- ptrs[start:end]
	}
	close(chunks)

	var zeroRefCounts []kbfsblock.ID
	for i := 0; i < numChunks; i++ {
		result := <-chunkResults
		if result.err != nil {
			// deferred cancel will stop the other workers.
			return nil, result.err
		}
		zeroRefCounts = append(zeroRefCounts, result.zeroRefCounts...)
	}
	return zeroRefCounts, nil
}

// deleteBlockRefs sends batched delete messages to the block server
// for the given block pointers.  It returns a list of block IDs that
// no longer have any references.
func (fbm *folderBlockManager) deleteBlockRefs(ctx context.Context,
	tlfID tlf.ID, ptrs []data.BlockPointer) ([]kbfsblock.ID, error) {
	return fbm.doChunkedDowngrades(ctx, tlfID, ptrs, false)
}

func (fbm *folderBlockManager) processBlocksToDelete(ctx context.Context, toDelete blocksToDelete) error {
	// also attempt to delete any error references

	defer fbm.blocksToDeleteWaitGroup.Done()

	// Make sure all blocks in the journal (if journaling is enabled)
	// are flushed before attempting to delete any of them.
	if jManager, err := GetJournalManager(fbm.config); err == nil {
		fbm.log.CDebugf(ctx, "Waiting for journal to flush")
		if err := jManager.WaitForCompleteFlush(ctx, fbm.id); err != nil {
			return err
		}
	}

	fbm.log.CDebugf(ctx, "Checking deleted blocks for revision %d",
		toDelete.md.Revision())
	// Make sure that the MD didn't actually become part of the folder
	// history.  (This could happen if the Sync was canceled while the
	// MD put was outstanding.)  If the private MD is not set, there's
	// no way the revision made it to the server, so we are free to
	// clean it up without checking with the server.
	if toDelete.bdType == blockDeleteOnMDFail &&
		toDelete.md.bareMd.GetSerializedPrivateMetadata() != nil {
		// Don't use `getSingleMD` here, since it returns an error if
		// the revision isn't found, and that's useful information for
		// us here.
		rmds, err := getMDRange(
			ctx, fbm.config, fbm.id, toDelete.md.BID(), toDelete.md.Revision(),
			toDelete.md.Revision(), toDelete.md.MergedStatus(), nil)
		if err != nil {
			fbm.log.CDebugf(ctx,
				"Error trying to get MD %d; retrying after a delay",
				toDelete.md.Revision())
			// We don't know whether or not the revision made it to
			// the server, so try again.  But don't re-enqueue
			// immediately to avoid fast infinite loops.
			fbm.enqueueBlocksToDeleteAfterShortDelay(ctx, toDelete)
			return nil
		}

		var rmd ImmutableRootMetadata
		if len(rmds) == 0 {
			// The rmd.mdID check below will fail intentionally since
			// rmd is empty.  Note that this assumes that the MD
			// servers don't cache negative lookups, or if they do,
			// they use synchronous cache invalidations for that case.
			// If we ever allow MD servers to cache negative lookups,
			// we'll have to retry here for at least the amount of the
			// maximum allowable cache timeout.
			fbm.log.CDebugf(ctx, "No revision %d found on MD server, so we "+
				"can safely archive", toDelete.md.Revision())
		} else {
			rmd = rmds[0]
		}

		mdID, err := kbfsmd.MakeID(fbm.config.Codec(), toDelete.md.bareMd)
		if err != nil {
			fbm.log.CErrorf(ctx, "Error when comparing dirs: %v", err)
		} else if mdID == rmd.mdID {
			if err := isArchivableMDOrError(rmd.ReadOnly()); err != nil {
				fbm.log.CDebugf(ctx, "Skipping archiving for non-deleted, "+
					"unarchivable revision %d: %v", rmd.Revision(), err)
				return nil
			}

			// This md is part of the history of the folder, so we
			// shouldn't delete the blocks.  But, since this MD put
			// seems to have succeeded, we should archive it.
			fbm.log.CDebugf(ctx, "Not deleting blocks from revision %d; "+
				"archiving it", rmd.Revision())
			// Don't block on archiving the MD, because that could
			// lead to deadlock.
			fbm.archiveUnrefBlocksNoWait(rmd.ReadOnly())
			return nil
		}

		// Otherwise something else has been written over
		// this MD, so get rid of the blocks.
		fbm.log.CDebugf(ctx, "Cleaning up blocks for failed revision %d",
			toDelete.md.Revision())
	} else {
		fbm.log.CDebugf(ctx, "Cleaning up blocks for revision %d",
			toDelete.md.Revision())
	}

	_, err := fbm.deleteBlockRefs(ctx, toDelete.md.TlfID(), toDelete.blocks)
	// Ignore permanent errors
	_, isPermErr := err.(kbfsblock.ServerError)
	_, isNonceNonExistentErr := err.(kbfsblock.ServerErrorNonceNonExistent)
	_, isBadRequestErr := err.(kbfsblock.ServerErrorBadRequest)
	if err != nil {
		fbm.log.CWarningf(ctx, "Couldn't delete some ref in batch %v: %v",
			toDelete.blocks, err)
		if !isPermErr && !isNonceNonExistentErr && !isBadRequestErr {
			fbm.enqueueBlocksToDeleteNoWait(toDelete)
			return nil
		}
	}

	return nil
}

// CtxFBMTagKey is the type used for unique context tags within
// folderBlockManager
type CtxFBMTagKey int

const (
	// CtxFBMIDKey is the type of the tag for unique operation IDs
	// within folderBlockManager.
	CtxFBMIDKey CtxFBMTagKey = iota
)

// CtxFBMOpID is the display name for the unique operation
// folderBlockManager ID tag.
const CtxFBMOpID = "FBMID"

func (fbm *folderBlockManager) ctxWithFBMID(
	ctx context.Context) context.Context {
	return CtxWithRandomIDReplayable(ctx, CtxFBMIDKey, CtxFBMOpID, fbm.log)
}

// Run the passed function with a context that's canceled on shutdown.
func (fbm *folderBlockManager) runUnlessShutdownWithCtx(
	ctx context.Context, fn func(ctx context.Context) error) error {
	ctx, cancelFunc := context.WithCancel(ctx)
	defer cancelFunc()
	errChan := make(chan error, 1)
	go func() {
		errChan <- fn(ctx)
	}()

	select {
	case err := <-errChan:
		return err
	case <-fbm.shutdownChan:
		return errors.New("shutdown received")
	}
}

// Run the passed function with a context that's canceled on shutdown.
func (fbm *folderBlockManager) runUnlessShutdown(
	fn func(ctx context.Context) error) error {
	ctx := fbm.ctxWithFBMID(context.Background())
	return fbm.runUnlessShutdownWithCtx(ctx, fn)
}

func (fbm *folderBlockManager) archiveBlockRefs(ctx context.Context,
	tlfID tlf.ID, ptrs []data.BlockPointer) error {
	_, err := fbm.doChunkedDowngrades(ctx, tlfID, ptrs, true)
	return err
}

type unrefIterator struct {
	nextPtr int
}

// getUnrefPointersFromMD returns a slice of BlockPointers that were
// unreferenced by the given `rmd`.  If there are too many pointers to
// process, given the current mode, then it will return a partial
// list, plus a non-nil `iter` parameter that can be passed into a
// subsequent call to get the next set of unreferenced BlockPointers
// from the same MD.  If a nil `iter` is given, pointers are returned
// from the beginning of the list.
func (fbm *folderBlockManager) getUnrefPointersFromMD(
	rmd ReadOnlyRootMetadata, includeGC bool, iter *unrefIterator) (
	ptrs []data.BlockPointer, nextIter *unrefIterator) {
	currPtr := 0
	complete := true
	nextPtr := 0
	if iter != nil {
		nextPtr = iter.nextPtr
	}
	ptrMap := make(map[data.BlockPointer]bool)
	max := fbm.config.Mode().MaxBlockPtrsToManageAtOnce()
opLoop:
	for _, op := range rmd.data.Changes.Ops {
		if _, ok := op.(*GCOp); !includeGC && ok {
			continue
		}
		for _, ptr := range op.Unrefs() {
			currPtr++
			// Skip past any ptrs we've already processed.
			if currPtr <= nextPtr {
				continue
			}

			// Can be zeroPtr in weird failed sync scenarios.
			// See syncInfo.replaceRemovedBlock for an example
			// of how this can happen.
			if ptr != data.ZeroPtr && !ptrMap[ptr] {
				ptrMap[ptr] = true
			}
			nextPtr++
			if max >= 0 && len(ptrMap) >= max {
				complete = false
				break opLoop
			}
		}
		for _, update := range op.allUpdates() {
			currPtr++
			// Skip past any ptrs we've already processed.
			if currPtr <= nextPtr {
				continue
			}

			// It's legal for there to be an "update" between
			// two identical pointers (usually because of
			// conflict resolution), so ignore that for quota
			// reclamation purposes.
			if update.Ref != update.Unref && !ptrMap[update.Unref] {
				ptrMap[update.Unref] = true
			}
			nextPtr++
			if max >= 0 && len(ptrMap) >= max {
				complete = false
				break opLoop
			}
		}
	}
	ptrs = make([]data.BlockPointer, 0, len(ptrMap))
	for ptr := range ptrMap {
		ptrs = append(ptrs, ptr)
	}
	if !complete {
		nextIter = &unrefIterator{nextPtr}
	}
	return ptrs, nextIter
}

func (fbm *folderBlockManager) archiveAllBlocksInMD(md ReadOnlyRootMetadata) {
	// This func doesn't take any locks, though it can
	// block md writes due to the buffered channel.
	// So use the long timeout to make sure things get
	// unblocked eventually, but no need for a short
	// timeout.
	ctx := fbm.ctxWithFBMID(context.Background())
	ctx, cancel := context.WithTimeout(ctx, data.BackgroundTaskTimeout)
	fbm.setArchiveCancel(cancel)
	defer fbm.cancelArchive()

	iter := &unrefIterator{0}
	defer fbm.archiveGroup.Done()
	for iter != nil {
		var ptrs []data.BlockPointer
		ptrs, iter = fbm.getUnrefPointersFromMD(md, true, iter)
		_ = fbm.runUnlessShutdownWithCtx(
			ctx, func(ctx context.Context) (err error) {
				fbm.log.CDebugf(
					ctx, "Archiving %d block pointers as a result "+
						"of revision %d", len(ptrs), md.Revision())
				err = fbm.archiveBlockRefs(ctx, md.TlfID(), ptrs)
				if err != nil {
					fbm.log.CWarningf(
						ctx, "Couldn't archive blocks: %v", err)
					return err
				}

				return nil
			})
		if iter != nil {
			fbm.log.CDebugf(
				ctx, "Archived %d pointers for revision %d, "+
					"now looking for more", len(ptrs), md.Revision())
		}
	}
}

func (fbm *folderBlockManager) archiveBlocksInBackground() {
	for {
		select {
		case md := <-fbm.archiveChan:
			fbm.archiveAllBlocksInMD(md)
		case unpause := <-fbm.archivePauseChan:
			_ = fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
				fbm.log.CInfof(ctx, "Archives paused")
				// wait to be unpaused
				select {
				case <-unpause:
					fbm.log.CInfof(ctx, "Archives unpaused")
				case <-ctx.Done():
					return ctx.Err()
				}
				return nil
			})
		case <-fbm.shutdownChan:
			return
		}
	}
}

func (fbm *folderBlockManager) deleteBlocksInBackground() {
	for {
		select {
		case toDelete := <-fbm.blocksToDeleteChan:
			_ = fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
				ctx, cancel := context.WithTimeout(
					ctx, data.BackgroundTaskTimeout)
				fbm.setBlocksToDeleteCancel(cancel)
				defer fbm.cancelBlocksToDelete()

				if err := fbm.processBlocksToDelete(ctx, toDelete); err != nil {
					fbm.log.CDebugf(ctx, "Error deleting blocks: %v", err)
					return err
				}

				return nil
			})
		case unpause := <-fbm.blocksToDeletePauseChan:
			_ = fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
				fbm.log.CInfof(ctx, "deleteBlocks paused")
				select {
				case <-unpause:
					fbm.log.CInfof(ctx, "deleteBlocks unpaused")
				case <-ctx.Done():
					return ctx.Err()
				}
				return nil
			})
		case <-fbm.shutdownChan:
			return
		}
	}
}

func (fbm *folderBlockManager) isOldEnough(rmd ImmutableRootMetadata) bool {
	// Trust the server's timestamp on this MD.
	mtime := rmd.localTimestamp
	unrefAge := fbm.config.Mode().QuotaReclamationMinUnrefAge()
	return mtime.Add(unrefAge).Before(fbm.config.Clock().Now())
}

// getMostRecentGCRevision returns the latest revision that was
// scrubbed by the previous gc op.
func (fbm *folderBlockManager) getMostRecentGCRevision(
	ctx context.Context, head ReadOnlyRootMetadata) (
	lastGCRev kbfsmd.Revision, err error) {
	if head.data.LastGCRevision >= kbfsmd.RevisionInitial {
		fbm.log.CDebugf(ctx, "Found last gc revision %d in "+
			"head MD revision %d", head.data.LastGCRevision,
			head.Revision())
		return head.data.LastGCRevision, nil
	}

	// Very old TLFs might not have a filled-in `LastGCRevision`, so
	// we need to walk backwards to find the latest gcOp.
	endRev := head.Revision()
	for {
		startRev := endRev - maxMDsAtATime + 1 // (kbfsmd.Revision is signed)
		if startRev < kbfsmd.RevisionInitial {
			startRev = kbfsmd.RevisionInitial
		}

		rmds, err := getMDRange(
			ctx, fbm.config, fbm.id, kbfsmd.NullBranchID, startRev,
			endRev, kbfsmd.Merged, nil)
		if err != nil {
			return kbfsmd.RevisionUninitialized, err
		}

		numNew := len(rmds)
		for i := len(rmds) - 1; i >= 0; i-- {
			rmd := rmds[i]
			if rmd.data.LastGCRevision >= kbfsmd.RevisionInitial {
				fbm.log.CDebugf(ctx, "Found last gc revision %d in "+
					"MD revision %d", rmd.data.LastGCRevision,
					rmd.Revision())
				return rmd.data.LastGCRevision, nil
			}
			for j := len(rmd.data.Changes.Ops) - 1; j >= 0; j-- {
				GCOp, ok := rmd.data.Changes.Ops[j].(*GCOp)
				if !ok || GCOp.LatestRev == kbfsmd.RevisionUninitialized {
					continue
				}
				fbm.log.CDebugf(ctx, "Found last gc op: %s", GCOp)
				return GCOp.LatestRev, nil
			}
		}

		if numNew > 0 {
			endRev = rmds[0].Revision() - 1
		}

		if numNew < maxMDsAtATime || endRev < kbfsmd.RevisionInitial {
			// Never been GC'd.
			return kbfsmd.RevisionUninitialized, nil
		}
	}
}

// getUnrefBlocks returns a slice containing all the block pointers
// that were unreferenced after the earliestRev, up to and including
// those in latestRev.  If the number of pointers is too large, it
// will shorten the range of the revisions being reclaimed, and return
// the latest revision represented in the returned slice of pointers.
func (fbm *folderBlockManager) getUnreferencedBlocks(
	ctx context.Context, earliestRev, mostRecentRev kbfsmd.Revision) (
	ptrs []data.BlockPointer, lastRev kbfsmd.Revision,
	complete bool, err error) {
	fbm.log.CDebugf(ctx, "Getting unreferenced blocks between revisions "+
		"%d and %d", earliestRev, mostRecentRev)
	defer func() {
		if err == nil {
			fbm.log.CDebugf(ctx, "Found %d pointers to clean between "+
				"revisions %d and %d", len(ptrs), earliestRev, lastRev)
		}
	}()

	// Walk forward, starting from just after earliestRev, until we
	// get enough pointers or until we reach the head or a revision
	// that's not old enough, gathering pointers to GC.
	startRev := earliestRev + 1
outer:
	for {
		endRev := startRev + maxMDsAtATime
		if endRev > mostRecentRev {
			endRev = mostRecentRev
		}

		rmds, err := getMDRange(
			ctx, fbm.config, fbm.id, kbfsmd.NullBranchID, startRev,
			endRev, kbfsmd.Merged, nil)
		if err != nil {
			return nil, kbfsmd.RevisionUninitialized, false, err
		}

		numNew := len(rmds)
		for _, rmd := range rmds {
			if !fbm.isOldEnough(rmd) {
				fbm.log.CDebugf(ctx, "Revision %d is too recent; stopping QR",
					rmd.Revision())
				complete = true
				break outer
			}
			lastRev = rmd.Revision()
			// A garbage-collection op *must* contain all pointers in
			// its respective op.  If this device can't handle it,
			// error the process and let another device take care of
			// it.
			newPtrs, iter := fbm.getUnrefPointersFromMD(
				rmd.ReadOnlyRootMetadata, false, &unrefIterator{0})
			if iter != nil {
				return nil, kbfsmd.RevisionUninitialized, false, errors.New(
					fmt.Sprintf(
						"Can't handle the unref'd pointers of revision %d",
						lastRev))
			}
			ptrs = append(ptrs, newPtrs...)
			// TODO: when can we clean up the MD's unembedded block
			// changes pointer?  It's not safe until we know for sure
			// that all existing clients have received the latest
			// update (and also that there are no outstanding staged
			// branches).  Let's do that as part of the bigger issue
			// KBFS-793 -- for now we have to leak those blocks.
			if len(ptrs) > fbm.numPointersPerGCThreshold {
				fbm.log.CDebugf(ctx, "Shortening GC range to [%d:%d]",
					earliestRev, rmd.Revision())
				break outer
			}
		}

		if numNew > 0 {
			startRev = rmds[len(rmds)-1].Revision() + 1
		}

		if numNew < maxMDsAtATime || startRev > mostRecentRev {
			complete = true
			break
		}
	}

	return ptrs, lastRev, complete, nil
}

func (fbm *folderBlockManager) finalizeReclamation(ctx context.Context,
	ptrs []data.BlockPointer, zeroRefCounts []kbfsblock.ID,
	latestRev kbfsmd.Revision) error {
	gco := newGCOp(latestRev)
	for _, id := range zeroRefCounts {
		gco.AddUnrefBlock(data.BlockPointer{ID: id})
	}

	ctx, err := tlfhandle.MakeExtendedIdentify(
		// TLFIdentifyBehavior_KBFS_QR makes service suppress the tracker popup.
		ctx, keybase1.TLFIdentifyBehavior_KBFS_QR)
	if err != nil {
		return err
	}

	fbm.log.CDebugf(ctx, "Finalizing reclamation %s with %d ptrs", gco,
		len(ptrs))
	// finalizeGCOp could wait indefinitely on locks, so run it in a
	// goroutine.
	return runUnlessCanceled(ctx,
		func() error { return fbm.helper.finalizeGCOp(ctx, gco) })
}

func (fbm *folderBlockManager) isQRNecessary(
	ctx context.Context, head ImmutableRootMetadata) bool {
	fbm.lastQRLock.Lock()
	defer fbm.lastQRLock.Unlock()
	if head == (ImmutableRootMetadata{}) {
		return false
	}

	session, err := fbm.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		fbm.log.CWarningf(ctx, "Couldn't get the current session: %+v", err)
		return false
	}
	// It's ok to treat both MDs written by this process on this
	// device, and MDs written by other processes (e.g., kbgit) in the
	// same way.  Other processes are likely to be short-lived, and
	// probably won't do their own QR, so a conflict is unlikely here.
	selfWroteHead := session.VerifyingKey == head.LastModifyingWriterVerifyingKey()

	// Don't do reclamation if the head isn't old enough and it wasn't
	// written by this device.  We want to avoid fighting with other
	// active writers whenever possible.
	if !selfWroteHead {
		minHeadAge := fbm.config.Mode().QuotaReclamationMinHeadAge()
		if minHeadAge <= 0 {
			return false
		}
		headAge := fbm.config.Clock().Now().Sub(head.localTimestamp)
		if headAge < minHeadAge {
			return false
		}
	}

	// If the head includes a single gcOp that covers everything up to
	// the previous head, we can skip QR.
	if len(head.data.Changes.Ops) == 1 {
		gcOp, isGCOp := head.data.Changes.Ops[0].(*GCOp)
		if isGCOp && gcOp.LatestRev == head.Revision()-1 {
			return false
		}
	}

	// Do QR if:
	//   * The head has changed since last time, OR
	//   * The last QR did not completely clean every available thing, OR
	//   * The head is now old enough for QR
	return head.Revision() != fbm.lastQRHeadRev || !fbm.wasLastQRComplete ||
		fbm.isOldEnough(head)
}

func (fbm *folderBlockManager) doReclamation(timer *time.Timer) (err error) {
	ctx, cancel := context.WithCancel(fbm.ctxWithFBMID(context.Background()))
	fbm.setReclamationCancel(cancel)
	defer fbm.cancelReclamation()
	nextPeriod := fbm.config.Mode().QuotaReclamationPeriod()
	defer func() {
		// `nextPeriod` may be changed by later code in this function,
		// to speed up the next QR cycle when we couldn't reclaim a
		// complete set of blocks during this run.
		timer.Reset(nextPeriod)
	}()
	defer fbm.reclamationGroup.Done()

	// Don't set a context deadline.  For users that have written a
	// lot of updates since their last QR, this might involve fetching
	// a lot of MD updates in small chunks.  It doesn't hold locks for
	// any considerable amount of time, so it should be safe to let it
	// run indefinitely.

	// First get the most recent fully merged MD (might be different
	// from the local head if journaling is enabled), and see if we're
	// staged or not.
	head, err := fbm.helper.getMostRecentFullyMergedMD(ctx)
	if err != nil {
		return err
	}
	if err := isReadableOrError(
		ctx, fbm.config.KBPKI(), fbm.config, head.ReadOnly()); err != nil {
		return err
	}
	switch {
	case head.MergedStatus() != kbfsmd.Merged:
		return errors.New("Supposedly fully-merged MD is unexpectedly unmerged")
	case head.IsFinal():
		return kbfsmd.MetadataIsFinalError{}
	}

	// Make sure we're a writer
	session, err := fbm.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	isWriter, err := head.IsWriter(
		ctx, fbm.config.KBPKI(), fbm.config, session.UID, session.VerifyingKey)
	if err != nil {
		return err
	}
	if !isWriter {
		return tlfhandle.NewWriteAccessError(head.GetTlfHandle(), session.Name,
			head.GetTlfHandle().GetCanonicalPath())
	}

	if !fbm.isQRNecessary(ctx, head) {
		// Nothing has changed since last time, or the current head is
		// too new, so no need to do any QR.
		return nil
	}
	var complete bool
	var reclamationTime time.Time
	var lastRev kbfsmd.Revision
	defer func() {
		fbm.lastQRLock.Lock()
		defer fbm.lastQRLock.Unlock()
		// Remember the QR we just performed.
		if err == nil && head != (ImmutableRootMetadata{}) {
			fbm.lastQRHeadRev = head.Revision()
			fbm.wasLastQRComplete = complete
		}
		if !reclamationTime.IsZero() {
			fbm.lastReclamationTime = reclamationTime
		}
		if lastRev > kbfsmd.RevisionUninitialized {
			fbm.lastReclaimedRev = lastRev
		}
		if !complete {
			// If there's more data to reclaim, only wait a short
			// while before the next QR attempt.
			nextPeriod = 1 * time.Minute
		}
	}()

	// Then grab the lock for this folder, so we're the only one doing
	// garbage collection for a while.
	locked, err := fbm.config.MDServer().TruncateLock(ctx, fbm.id)
	if err != nil {
		return err
	}
	if !locked {
		fbm.log.CDebugf(ctx, "Couldn't get the truncate lock")
		return fmt.Errorf("Couldn't get the truncate lock for folder %d",
			fbm.id)
	}
	defer func() {
		unlocked, unlockErr := fbm.config.MDServer().TruncateUnlock(ctx, fbm.id)
		if unlockErr != nil {
			fbm.log.CDebugf(ctx, "Couldn't release the truncate lock: %v",
				unlockErr)
		}
		if !unlocked {
			fbm.log.CDebugf(ctx, "Couldn't unlock the truncate lock")
		}
	}()

	lastGCRev, err := fbm.getMostRecentGCRevision(ctx, head.ReadOnly())
	if err != nil {
		return err
	}
	if head.Revision() <= lastGCRev {
		// TODO: need a log level more fine-grained than Debug to
		// print out that we're not doing reclamation.
		complete = true
		return nil
	}

	// Don't try to do too many at a time.
	shortened := false
	mostRecentRev := head.Revision()
	if mostRecentRev-lastGCRev > numMaxRevisionsPerQR {
		mostRecentRev = lastGCRev + numMaxRevisionsPerQR
		shortened = true
	}

	// Don't print these until we know for sure that we'll be
	// reclaiming some quota, to avoid log pollution.
	fbm.log.CDebugf(ctx, "Starting quota reclamation process")
	defer func() {
		fbm.log.CDebugf(ctx, "Ending quota reclamation process: %v", err)
		reclamationTime = fbm.config.Clock().Now()
	}()

	ptrs, lastRev, complete, err := fbm.getUnreferencedBlocks(
		ctx, lastGCRev, mostRecentRev)
	if err != nil {
		return err
	}
	if lastRev == kbfsmd.RevisionUninitialized {
		fbm.log.CDebugf(ctx, "No recent revisions to GC")
		complete = true
		return nil
	}
	if len(ptrs) == 0 && !shortened {
		complete = true

		// Add a new gcOp to show other clients that they don't need
		// to explore this range again.
		return fbm.finalizeReclamation(ctx, nil, nil, lastRev)
	} else if shortened {
		complete = false
	}

	zeroRefCounts, err := fbm.deleteBlockRefs(ctx, head.TlfID(), ptrs)
	if err != nil {
		return err
	}

	return fbm.finalizeReclamation(ctx, ptrs, zeroRefCounts, lastRev)
}

func isPermanentQRError(err error) bool {
	switch errors.Cause(err).(type) {
	case tlfhandle.WriteAccessError, kbfsmd.MetadataIsFinalError,
		RevokedDeviceVerificationError:
		return true
	default:
		return false
	}
}

func (fbm *folderBlockManager) reclaimQuotaInBackground() {
	autoQR := true
	timer := time.NewTimer(fbm.config.Mode().QuotaReclamationPeriod())

	if fbm.config.Mode().QuotaReclamationPeriod().Seconds() != 0 {
		// Run QR once immediately at the start of the period.
		fbm.reclamationGroup.Add(1)
		err := fbm.doReclamation(timer)
		if isPermanentQRError(err) {
			autoQR = false
			fbm.log.CDebugf(context.Background(),
				"Permanently stopping QR due to initial error: %+v", err)
		}
	}

	timerChan := timer.C
	for {
		// Don't let the timer fire if auto-reclamation is turned off.
		if !autoQR ||
			fbm.config.Mode().QuotaReclamationPeriod().Seconds() == 0 {
			timer.Stop()
			// Use a channel that will never fire instead.
			timerChan = make(chan time.Time)
		}

		state := keybase1.MobileAppState_FOREGROUND
		select {
		case <-fbm.shutdownChan:
			return
		case state = <-fbm.appStateUpdater.NextAppStateUpdate(&state):
			for state != keybase1.MobileAppState_FOREGROUND {
				fbm.log.CDebugf(context.Background(),
					"Pausing QR while not foregrounded: state=%s", state)
				state = <-fbm.appStateUpdater.NextAppStateUpdate(&state)
			}
			fbm.log.CDebugf(
				context.Background(), "Resuming QR while foregrounded")
			continue
		case <-timerChan:
			fbm.reclamationGroup.Add(1)
		case <-fbm.forceReclamationChan:
		}

		err := fbm.doReclamation(timer)
		if isPermanentQRError(err) {
			// If we can't write the MD, don't bother with the timer
			// anymore. Don't completely shut down, since we don't
			// want forced reclamations to hang.
			timer.Stop()
			timerChan = make(chan time.Time)
			autoQR = false
			fbm.log.CDebugf(context.Background(),
				"Permanently stopping QR due to error: %+v", err)
		}
	}
}

func (fbm *folderBlockManager) getLastQRData() (time.Time, kbfsmd.Revision) {
	fbm.lastQRLock.Lock()
	defer fbm.lastQRLock.Unlock()
	return fbm.lastReclamationTime, fbm.lastReclaimedRev
}

func (fbm *folderBlockManager) clearLastQRData() {
	fbm.lastQRLock.Lock()
	defer fbm.lastQRLock.Unlock()
	fbm.lastQRHeadRev = kbfsmd.RevisionUninitialized
	fbm.wasLastQRComplete = false
	fbm.lastReclamationTime = time.Time{}
	fbm.lastReclaimedRev = kbfsmd.RevisionUninitialized
}

func (fbm *folderBlockManager) doChunkedGetNonLiveBlocks(
	ctx context.Context, ptrs []data.BlockPointer) (
	nonLiveBlocks []kbfsblock.ID, err error) {
	fbm.log.CDebugf(ctx, "Get live count for %d pointers", len(ptrs))
	bops := fbm.config.BlockOps()

	// Round up to find the number of chunks.
	numChunks := (len(ptrs) + numPointersToDowngradePerChunk - 1) /
		numPointersToDowngradePerChunk
	numWorkers := numChunks
	if numWorkers > maxParallelBlockPuts {
		numWorkers = maxParallelBlockPuts
	}
	chunks := make(chan []data.BlockPointer, numChunks)

	eg, groupCtx := errgroup.WithContext(ctx)
	chunkResults := make(chan []kbfsblock.ID, numChunks)
	for i := 0; i < numWorkers; i++ {
		eg.Go(func() error {
			for chunk := range chunks {
				fbm.log.CDebugf(groupCtx,
					"Getting live count for chunk of %d pointers", len(chunk))
				liveCounts, err := bops.GetLiveCount(ctx, fbm.id, chunk)
				if err != nil {
					return err
				}
				ids := make([]kbfsblock.ID, 0, len(liveCounts))
				for id, count := range liveCounts {
					if count == 0 {
						ids = append(ids, id)
					} else {
						fbm.log.CDebugf(groupCtx,
							"Ignoring live block %s with %d refs", id, count)
					}
				}
				chunkResults <- ids
				select {
				// return early if the context has been canceled
				case <-groupCtx.Done():
					return groupCtx.Err()
				default:
				}
			}
			return nil
		})
	}

	for start := 0; start < len(ptrs); start += numPointersToDowngradePerChunk {
		end := start + numPointersToDowngradePerChunk
		if end > len(ptrs) {
			end = len(ptrs)
		}
		chunks <- ptrs[start:end]
	}
	close(chunks)

	err = eg.Wait()
	if err != nil {
		return nil, err
	}
	close(chunkResults)

	for result := range chunkResults {
		nonLiveBlocks = append(nonLiveBlocks, result...)
	}
	return nonLiveBlocks, nil
}

func (fbm *folderBlockManager) doCleanDiskCache(cacheType DiskBlockCacheType) (
	err error) {
	dbc := fbm.config.DiskBlockCache()
	if dbc == nil {
		return nil
	}

	ctx, cancel := context.WithCancel(fbm.ctxWithFBMID(context.Background()))
	fbm.setCleanDiskCacheCancel(cancel)
	defer fbm.cancelCleanDiskCache()

	lState := makeFBOLockState()
	recentRev := fbm.helper.getLatestMergedRevision(lState)

	lastRev, err := dbc.GetLastUnrefRev(ctx, fbm.id, cacheType)
	if err != nil {
		return err
	}

	if lastRev < kbfsmd.RevisionInitial {
		if recentRev > kbfsmd.RevisionInitial {
			// This can happen if the sync cache was created and
			// populated before we started keeping track of the last
			// unref'd revision. In that case, we just let the blocks
			// from the old revision stay in the cache until they are
			// manually cleaned up.
			//
			// It can also happen if the device just started
			// monitoring the TLF for syncing, in which case it
			// shouldn't have any cached blocks that were unref'd in
			// earlier revisions.
			fbm.log.CDebugf(ctx, "Starting to clean %s at revision %d",
				cacheType, recentRev)
			lastRev = recentRev - 1
		} else {
			// No revisions to clean yet.
			return dbc.PutLastUnrefRev(
				ctx, fbm.id, recentRev, cacheType)
		}
	}

	if lastRev >= recentRev {
		// Nothing to do.
		return nil
	}

	fbm.log.CDebugf(ctx, "Cleaning %s revisions after %d, "+
		"up to %d", cacheType, lastRev, recentRev)
	defer func() {
		fbm.log.CDebugf(ctx, "Done cleaning %s: %+v", cacheType, err)
	}()
	for nextRev := lastRev + 1; nextRev <= recentRev; nextRev++ {
		rmd, err := getSingleMD(
			ctx, fbm.config, fbm.id, kbfsmd.NullBranchID, nextRev,
			kbfsmd.Merged, nil)
		if err != nil {
			return err
		}

		iter := &unrefIterator{0}
		for iter != nil {
			// Include unrefs from `gcOp`s here, as a double-check
			// against archive races (see comment below).
			var ptrs []data.BlockPointer
			ptrs, iter = fbm.getUnrefPointersFromMD(
				rmd.ReadOnlyRootMetadata, true, iter)

			// Cancel any prefetches for these blocks that might be in
			// flight, to make sure they don't get put into the cache
			// after we're done cleaning it.  Ideally we would cancel
			// them in a particular order (the lowest level ones
			// first, up to the root), but since we already do one
			// round of prefetch-canceling as part of applying the MD
			// and updating the pointers, doing a second round here
			// should be good enough to catch any weird relationships
			// between the pointers where one non-yet-canceled
			// prefetch can revive the prefetch of an already-canceled
			// child block.
			for _, ptr := range ptrs {
				fbm.config.BlockOps().Prefetcher().CancelPrefetch(ptr)
				c, err := fbm.config.BlockOps().Prefetcher().
					WaitChannelForBlockPrefetch(ctx, ptr)
				if err != nil {
					return err
				}
				select {
				case <-c:
				case <-ctx.Done():
					return ctx.Err()
				}
			}

			var ids []kbfsblock.ID
			if cacheType == DiskBlockSyncCache {
				// Wait for our own archives to complete, to make sure
				// the bserver already knows this block isn't live yet
				// when we make the call below.  However, when dealing
				// with MDs written by other clients, there could be a
				// race here where we see the ID is live before the
				// other client gets to archive the block, leading to
				// a leak.  Once the revision is GC'd though, we
				// should run through this code again with the `gcOp`,
				// and we'll delete the block then.  (Note there's
				// always a chance for a race here, since the client
				// could crash before archiving the blocks.  But the
				// GC should always catch it eventually.)
				err := fbm.waitForArchives(ctx)
				if err != nil {
					return err
				}

				ids, err = fbm.doChunkedGetNonLiveBlocks(ctx, ptrs)
				if err != nil {
					return err
				}
			} else {
				ids = make([]kbfsblock.ID, 0, len(ptrs))
				for _, ptr := range ptrs {
					ids = append(ids, ptr.ID)
				}
			}
			fbm.log.CDebugf(ctx, "Deleting %d blocks from cache", len(ids))
			_, _, err = dbc.Delete(ctx, ids, cacheType)
			if err != nil {
				return err
			}

			if iter != nil {
				fbm.log.CDebugf(
					ctx, "Cleaned %d pointers for revision %d, "+
						"now looking for more", len(ptrs), rmd.Revision())
			}
		}

		err = dbc.PutLastUnrefRev(ctx, fbm.id, nextRev, cacheType)
		if err != nil {
			return err
		}

	}
	return nil
}

func (fbm *folderBlockManager) doCleanDiskCaches() (err error) {
	defer fbm.cleanDiskCachesGroup.Done()

	// Clean out sync cache only if it is enabled
	syncConfig := fbm.config.GetTlfSyncState(fbm.id)
	if syncConfig.Mode != keybase1.FolderSyncMode_DISABLED {
		err = fbm.doCleanDiskCache(DiskBlockSyncCache)
		if err != nil {
			return err
		}
	}
	return fbm.doCleanDiskCache(DiskBlockWorkingSetCache)
}

func (fbm *folderBlockManager) cleanDiskCachesInBackground() {
	// While in the foreground, clean the disk caches every time we learn about
	// a newer latest merged revision for this TLF.
	for {
		state := keybase1.MobileAppState_FOREGROUND
		select {
		case <-fbm.latestMergedChan:
		case <-fbm.shutdownChan:
			return
		case state = <-fbm.appStateUpdater.NextAppStateUpdate(&state):
			for state != keybase1.MobileAppState_FOREGROUND {
				fbm.log.CDebugf(context.Background(),
					"Pausing sync-cache cleaning while not foregrounded: "+
						"state=%s", state)
				state = <-fbm.appStateUpdater.NextAppStateUpdate(&state)
			}
			fbm.log.CDebugf(context.Background(),
				"Resuming sync-cache cleaning while foregrounded")
			continue
		}

		_ = fbm.doCleanDiskCaches()
	}
}

func (fbm *folderBlockManager) signalLatestMergedRevision() {
	if fbm.latestMergedChan == nil {
		return
	}

	fbm.cleanDiskCachesGroup.Add(1)
	select {
	case fbm.latestMergedChan <- struct{}{}:
	default:
		fbm.cleanDiskCachesGroup.Done()
	}
}
