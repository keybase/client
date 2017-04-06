// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type fbmHelper interface {
	getMostRecentFullyMergedMD(ctx context.Context) (
		ImmutableRootMetadata, error)
	finalizeGCOp(ctx context.Context, gco *GCOp) error
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

	// The delay to wait for before trying a failed block deletion
	// again. Used by enqueueBlocksToDeleteAfterShortDelay().
	deleteBlocksRetryDelay = 10 * time.Millisecond
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
	blocks  []BlockPointer
	bdType  blockDeleteType
	backoff backoff.BackOff
}

// folderBlockManager is a helper class for managing the blocks in a
// particular TLF.  It archives historical blocks and reclaims quota
// usage, all in the background.
type folderBlockManager struct {
	config       Config
	log          logger.Logger
	shutdownChan chan struct{}
	id           tlf.ID

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

	helper fbmHelper

	// Remembers what happened last time during quota reclamation.
	lastQRLock          sync.Mutex
	lastQRHeadRev       MetadataRevision
	lastQROldEnoughRev  MetadataRevision
	wasLastQRComplete   bool
	lastReclamationTime time.Time
}

func newFolderBlockManager(config Config, fb FolderBranch,
	helper fbmHelper) *folderBlockManager {
	tlfStringFull := fb.Tlf.String()
	log := config.MakeLogger(fmt.Sprintf("FBM %s", tlfStringFull[:8]))
	fbm := &folderBlockManager{
		config:       config,
		log:          log,
		shutdownChan: make(chan struct{}),
		id:           fb.Tlf,
		numPointersPerGCThreshold: numPointersPerGCThresholdDefault,
		archiveChan:               make(chan ReadOnlyRootMetadata, 500),
		archivePauseChan:          make(chan (<-chan struct{})),
		blocksToDeleteChan:        make(chan blocksToDelete, 25),
		blocksToDeletePauseChan:   make(chan (<-chan struct{})),
		forceReclamationChan:      make(chan struct{}, 1),
		helper:                    helper,
	}
	// Pass in the BlockOps here so that the archive goroutine
	// doesn't do possibly-racy-in-tests access to
	// fbm.config.BlockOps().

	if config.Mode() == InitMinimal {
		// If this device is in minimal mode and won't be doing any
		// data writes, no need deal with block-level cleanup
		// operations.  TODO: in the future it might still be useful
		// to have e.g. mobile devices doing QR.
		return fbm
	}

	go fbm.archiveBlocksInBackground()
	go fbm.deleteBlocksInBackground()
	if fb.Branch == MasterBranch {
		go fbm.reclaimQuotaInBackground()
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

func (fbm *folderBlockManager) shutdown() {
	close(fbm.shutdownChan)
	fbm.cancelArchive()
	fbm.cancelBlocksToDelete()
	fbm.cancelReclamation()
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
	md ReadOnlyRootMetadata, bps *blockPutState, bdType blockDeleteType) {
	fbm.log.CDebugf(nil, "Clean up md %d %s, bdType=%d", md.Revision(),
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
	for _, bs := range bps.blockStates {
		toDelete.blocks = append(toDelete.blocks, bs.blockPtr)
	}
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
	if md.MergedStatus() != Merged {
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
	if md.MergedStatus() != Merged {
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
	if md.MergedStatus() != Merged {
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
	tlfID tlf.ID, ptrs []BlockPointer, archive bool) (
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
	chunks := make(chan []BlockPointer, numChunks)

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
	tlfID tlf.ID, ptrs []BlockPointer) ([]kbfsblock.ID, error) {
	return fbm.doChunkedDowngrades(ctx, tlfID, ptrs, false)
}

func (fbm *folderBlockManager) processBlocksToDelete(ctx context.Context, toDelete blocksToDelete) error {
	// also attempt to delete any error references

	defer fbm.blocksToDeleteWaitGroup.Done()

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
			toDelete.md.Revision(), toDelete.md.MergedStatus())
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

		mdID, err := fbm.config.Crypto().MakeMdID(toDelete.md.bareMd)
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
	_, isPermErr := err.(kbfsblock.BServerError)
	_, isNonceNonExistentErr := err.(kbfsblock.BServerErrorNonceNonExistent)
	_, isBadRequestErr := err.(kbfsblock.BServerErrorBadRequest)
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
	return ctxWithRandomIDReplayable(ctx, CtxFBMIDKey, CtxFBMOpID, fbm.log)
}

// Run the passed function with a context that's canceled on shutdown.
func (fbm *folderBlockManager) runUnlessShutdown(
	fn func(ctx context.Context) error) error {
	ctx := fbm.ctxWithFBMID(context.Background())
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

func (fbm *folderBlockManager) archiveBlockRefs(ctx context.Context,
	tlfID tlf.ID, ptrs []BlockPointer) error {
	_, err := fbm.doChunkedDowngrades(ctx, tlfID, ptrs, true)
	return err
}

func (fbm *folderBlockManager) archiveBlocksInBackground() {
	for {
		select {
		case md := <-fbm.archiveChan:
			var ptrs []BlockPointer
			for _, op := range md.data.Changes.Ops {
				for _, ptr := range op.Unrefs() {
					// Can be zeroPtr in weird failed sync scenarios.
					// See syncInfo.replaceRemovedBlock for an example
					// of how this can happen.
					if ptr != zeroPtr {
						ptrs = append(ptrs, ptr)
					}
				}
				for _, update := range op.allUpdates() {
					// It's legal for there to be an "update" between
					// two identical pointers (usually because of
					// conflict resolution), so ignore that for
					// archival purposes.
					if update.Ref != update.Unref {
						ptrs = append(ptrs, update.Unref)
					}
				}
			}
			fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
				defer fbm.archiveGroup.Done()
				// This func doesn't take any locks, though it can
				// block md writes due to the buffered channel.  So
				// use the long timeout to make sure things get
				// unblocked eventually, but no need for a short timeout.
				ctx, cancel := context.WithTimeout(ctx, backgroundTaskTimeout)
				fbm.setArchiveCancel(cancel)
				defer fbm.cancelArchive()

				fbm.log.CDebugf(ctx, "Archiving %d block pointers as a result "+
					"of revision %d", len(ptrs), md.Revision())
				err = fbm.archiveBlockRefs(ctx, md.TlfID(), ptrs)
				if err != nil {
					fbm.log.CWarningf(ctx, "Couldn't archive blocks: %v", err)
					return err
				}

				return nil
			})
		case unpause := <-fbm.archivePauseChan:
			fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
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
			fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
				ctx, cancel := context.WithTimeout(ctx, backgroundTaskTimeout)
				fbm.setBlocksToDeleteCancel(cancel)
				defer fbm.cancelBlocksToDelete()

				if err := fbm.processBlocksToDelete(ctx, toDelete); err != nil {
					fbm.log.CDebugf(ctx, "Error deleting blocks: %v", err)
					return err
				}

				return nil
			})
		case unpause := <-fbm.blocksToDeletePauseChan:
			fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
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
	unrefAge := fbm.config.QuotaReclamationMinUnrefAge()
	return mtime.Add(unrefAge).Before(fbm.config.Clock().Now())
}

// getMostRecentOldEnoughAndGCRevisions returns the most recent MD
// that's older than the unref age, as well as the latest revision
// that was scrubbed by the previous gc op.
func (fbm *folderBlockManager) getMostRecentOldEnoughAndGCRevisions(
	ctx context.Context, head ReadOnlyRootMetadata) (
	mostRecentOldEnoughRev, lastGCRev MetadataRevision, err error) {
	// Walk backwards until we find one that is old enough.  Also,
	// look out for the previous GCOp.  TODO: Eventually get rid of
	// this scan once we have some way to get the MD corresponding to
	// a given timestamp.
	currHead := head.Revision()
	mostRecentOldEnoughRev = MetadataRevisionUninitialized
	lastGCRev = MetadataRevisionUninitialized
	if head.data.LastGCRevision >= MetadataRevisionInitial {
		fbm.log.CDebugf(ctx, "Found last gc revision %d in "+
			"head MD revision %d", head.data.LastGCRevision,
			head.Revision())
		lastGCRev = head.data.LastGCRevision
	}

	for {
		startRev := currHead - maxMDsAtATime + 1 // (MetadataRevision is signed)
		if startRev < MetadataRevisionInitial {
			startRev = MetadataRevisionInitial
		}

		rmds, err := getMDRange(ctx, fbm.config, fbm.id, NullBranchID, startRev,
			currHead, Merged)
		if err != nil {
			return MetadataRevisionUninitialized,
				MetadataRevisionUninitialized, err
		}

		numNew := len(rmds)
		for i := len(rmds) - 1; i >= 0; i-- {
			rmd := rmds[i]
			if mostRecentOldEnoughRev == MetadataRevisionUninitialized &&
				fbm.isOldEnough(rmd) {
				fbm.log.CDebugf(ctx, "Revision %d is older than the unref "+
					"age %s", rmd.Revision(),
					fbm.config.QuotaReclamationMinUnrefAge())
				mostRecentOldEnoughRev = rmd.Revision()
			}

			if lastGCRev == MetadataRevisionUninitialized {
				if rmd.data.LastGCRevision >= MetadataRevisionInitial {
					fbm.log.CDebugf(ctx, "Found last gc revision %d in "+
						"MD revision %d", rmd.data.LastGCRevision,
						rmd.Revision())
					lastGCRev = rmd.data.LastGCRevision
				} else {
					for j := len(rmd.data.Changes.Ops) - 1; j >= 0; j-- {
						GCOp, ok := rmd.data.Changes.Ops[j].(*GCOp)
						if !ok {
							continue
						}
						fbm.log.CDebugf(ctx, "Found last gc op: %s", GCOp)
						lastGCRev = GCOp.LatestRev
						break
					}
				}
			}

			// Once both return values are set, we are done
			if mostRecentOldEnoughRev != MetadataRevisionUninitialized &&
				lastGCRev != MetadataRevisionUninitialized {
				return mostRecentOldEnoughRev, lastGCRev, nil
			}
		}

		if numNew > 0 {
			currHead = rmds[0].Revision() - 1
		}

		if numNew < maxMDsAtATime || currHead < MetadataRevisionInitial {
			break
		}

		if lastGCRev != MetadataRevisionUninitialized &&
			currHead < head.Revision()-numMaxRevisionsPerQR {
			// If we've already found the latest gc rev, we should
			// avoid scanning too far back into the update history
			// because it's expensive.  We can rely on the fact that
			// eventually there will be a lull in updates, and we'll
			// be able to find the mostRecentOldEnoughRev quickly by
			// just looking at the head.
			fbm.log.CDebugf(ctx, "Stopping QR early because we can't easily "+
				"find the most recent old-enough revision (last GC rev %d)",
				lastGCRev)
			break
		}
	}

	return mostRecentOldEnoughRev, lastGCRev, nil
}

// getUnrefBlocks returns a slice containing all the block pointers
// that were unreferenced after the earliestRev, up to and including
// those in latestRev.  If the number of pointers is too large, it
// will shorten the range of the revisions being reclaimed, and return
// the latest revision represented in the returned slice of pointers.
func (fbm *folderBlockManager) getUnreferencedBlocks(
	ctx context.Context, latestRev, earliestRev MetadataRevision) (
	ptrs []BlockPointer, lastRevConsidered MetadataRevision,
	complete bool, err error) {
	fbm.log.CDebugf(ctx, "Getting unreferenced blocks between revisions "+
		"%d and %d", earliestRev, latestRev)
	defer func() {
		if err == nil {
			fbm.log.CDebugf(ctx, "Found %d pointers to clean between "+
				"revisions %d and %d", len(ptrs), earliestRev, latestRev)
		}
	}()

	if latestRev <= earliestRev {
		// Nothing to do.
		fbm.log.CDebugf(ctx, "Latest rev %d is included in the previous "+
			"gc op (%d)", latestRev, earliestRev)
		return nil, MetadataRevisionUninitialized, true, nil
	}

	// Walk backward, starting from latestRev, until just after
	// earliestRev, gathering block pointers.
	currHead := latestRev
	revStartPositions := make(map[MetadataRevision]int)
outer:
	for {
		startRev := currHead - maxMDsAtATime + 1 // (MetadataRevision is signed)
		if startRev < MetadataRevisionInitial {
			startRev = MetadataRevisionInitial
		}

		rmds, err := getMDRange(ctx, fbm.config, fbm.id, NullBranchID, startRev,
			currHead, Merged)
		if err != nil {
			return nil, MetadataRevisionUninitialized, false, err
		}

		numNew := len(rmds)
		for i := len(rmds) - 1; i >= 0; i-- {
			rmd := rmds[i]
			if rmd.Revision() <= earliestRev {
				break outer
			}
			// Save the latest revision starting at this position:
			revStartPositions[rmd.Revision()] = len(ptrs)
			for _, op := range rmd.data.Changes.Ops {
				if _, ok := op.(*GCOp); ok {
					continue
				}
				for _, ptr := range op.Unrefs() {
					// Can be zeroPtr in weird failed sync scenarios.
					// See syncInfo.replaceRemovedBlock for an example
					// of how this can happen.
					if ptr != zeroPtr {
						ptrs = append(ptrs, ptr)
					}
				}
				for _, update := range op.allUpdates() {
					// It's legal for there to be an "update" between
					// two identical pointers (usually because of
					// conflict resolution), so ignore that for quota
					// reclamation purposes.
					if update.Ref != update.Unref {
						ptrs = append(ptrs, update.Unref)
					}
				}
			}
			// TODO: when can we clean up the MD's unembedded block
			// changes pointer?  It's not safe until we know for sure
			// that all existing clients have received the latest
			// update (and also that there are no outstanding staged
			// branches).  Let's do that as part of the bigger issue
			// KBFS-793 -- for now we have to leak those blocks.
		}

		if numNew > 0 {
			currHead = rmds[0].Revision() - 1
		}

		if numNew < maxMDsAtATime || currHead < MetadataRevisionInitial {
			break
		}
	}

	complete = true
	if len(ptrs) > fbm.numPointersPerGCThreshold {
		// Find the earliest revision to clean up that lets us send at
		// least numPointersPerGCThreshold pointers.  The earliest
		// pointers are at the end of the list, so subtract the
		// threshold from the back.
		threshStart := len(ptrs) - fbm.numPointersPerGCThreshold
		origLatestRev := latestRev
		origPtrsLen := len(ptrs)
		// TODO: optimize by keeping rev->pos mappings in sorted order.
		for rev, i := range revStartPositions {
			if i < threshStart && rev < latestRev {
				latestRev = rev
			}
		}
		if latestRev < origLatestRev {
			ptrs = ptrs[revStartPositions[latestRev]:]
			fbm.log.CDebugf(ctx, "Shortening GC range from [%d:%d] to [%d:%d],"+
				" reducing pointers from %d to %d", earliestRev, origLatestRev,
				earliestRev, latestRev, origPtrsLen, len(ptrs))
			complete = false
		}
	}

	return ptrs, latestRev, complete, nil
}

func (fbm *folderBlockManager) finalizeReclamation(ctx context.Context,
	ptrs []BlockPointer, zeroRefCounts []kbfsblock.ID,
	latestRev MetadataRevision) error {
	gco := newGCOp(latestRev)
	for _, id := range zeroRefCounts {
		gco.AddUnrefBlock(BlockPointer{ID: id})
	}

	ctx, err := makeExtendedIdentify(
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
	selfWroteHead := session.VerifyingKey == head.LastModifyingWriterVerifyingKey()

	// Don't do reclamation if the head isn't old enough and it wasn't
	// written by this device.  We want to avoid fighting with other
	// active writers whenever possible.
	if !selfWroteHead {
		headAge := fbm.config.Clock().Now().Sub(head.localTimestamp)
		if headAge < fbm.config.QuotaReclamationMinHeadAge() {
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
	//   * The last QR did not completely clean every available thing
	if head.Revision() != fbm.lastQRHeadRev || !fbm.wasLastQRComplete {
		return true
	}

	// Do QR if the head was not reclaimable at the last QR time, but
	// is old enough now.
	return fbm.lastQRHeadRev > fbm.lastQROldEnoughRev &&
		fbm.isOldEnough(head)
}

func (fbm *folderBlockManager) doReclamation(timer *time.Timer) (err error) {
	ctx, cancel := context.WithCancel(fbm.ctxWithFBMID(context.Background()))
	fbm.setReclamationCancel(cancel)
	defer fbm.cancelReclamation()
	defer timer.Reset(fbm.config.QuotaReclamationPeriod())
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
	} else if err := isReadableOrError(ctx, fbm.config.KBPKI(), head.ReadOnly()); err != nil {
		return err
	} else if head.MergedStatus() != Merged {
		return errors.New("Supposedly fully-merged MD is unexpectedly unmerged")
	} else if head.IsFinal() {
		return MetadataIsFinalError{}
	}

	// Make sure we're a writer
	session, err := fbm.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	if !head.GetTlfHandle().IsWriter(session.UID) {
		return NewWriteAccessError(head.GetTlfHandle(), session.Name,
			head.GetTlfHandle().GetCanonicalPath())
	}

	if !fbm.isQRNecessary(ctx, head) {
		// Nothing has changed since last time, or the current head is
		// too new, so no need to do any QR.
		return nil
	}
	var mostRecentOldEnoughRev MetadataRevision
	var complete bool
	var reclamationTime time.Time
	defer func() {
		fbm.lastQRLock.Lock()
		defer fbm.lastQRLock.Unlock()
		// Remember the QR we just performed.
		if err == nil && head != (ImmutableRootMetadata{}) {
			fbm.lastQRHeadRev = head.Revision()
			fbm.lastQROldEnoughRev = mostRecentOldEnoughRev
			fbm.wasLastQRComplete = complete
		}
		if !reclamationTime.IsZero() {
			fbm.lastReclamationTime = reclamationTime
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

	mostRecentOldEnoughRev, lastGCRev, err :=
		fbm.getMostRecentOldEnoughAndGCRevisions(ctx, head.ReadOnly())
	if err != nil {
		return err
	}
	if mostRecentOldEnoughRev == MetadataRevisionUninitialized ||
		mostRecentOldEnoughRev <= lastGCRev {
		// TODO: need a log level more fine-grained than Debug to
		// print out that we're not doing reclamation.
		complete = true
		return nil
	}

	// Don't try to do too many at a time.
	shortened := false
	if mostRecentOldEnoughRev-lastGCRev > numMaxRevisionsPerQR {
		mostRecentOldEnoughRev = lastGCRev + numMaxRevisionsPerQR
		shortened = true
	}

	// Don't print these until we know for sure that we'll be
	// reclaiming some quota, to avoid log pollution.
	fbm.log.CDebugf(ctx, "Starting quota reclamation process")
	defer func() {
		fbm.log.CDebugf(ctx, "Ending quota reclamation process: %v", err)
		reclamationTime = fbm.config.Clock().Now()
	}()

	ptrs, latestRev, complete, err :=
		fbm.getUnreferencedBlocks(ctx, mostRecentOldEnoughRev, lastGCRev)
	if err != nil {
		return err
	}
	if len(ptrs) == 0 && !shortened {
		complete = true

		// Add a new gcOp to show other clients that they don't need
		// to explore this range again.
		return fbm.finalizeReclamation(ctx, nil, nil, latestRev)
	}

	zeroRefCounts, err := fbm.deleteBlockRefs(ctx, head.TlfID(), ptrs)
	if err != nil {
		return err
	}

	return fbm.finalizeReclamation(ctx, ptrs, zeroRefCounts, latestRev)
}

func (fbm *folderBlockManager) reclaimQuotaInBackground() {
	timer := time.NewTimer(fbm.config.QuotaReclamationPeriod())
	timerChan := timer.C
	for {
		// Don't let the timer fire if auto-reclamation is turned off.
		if fbm.config.QuotaReclamationPeriod().Seconds() == 0 {
			timer.Stop()
			// Use a channel that will never fire instead.
			timerChan = make(chan time.Time)
		}
		select {
		case <-fbm.shutdownChan:
			return
		case <-timerChan:
			fbm.reclamationGroup.Add(1)
		case <-fbm.forceReclamationChan:
		}

		err := fbm.doReclamation(timer)
		_, isWriteError := err.(WriteAccessError)
		_, isFinalError := err.(MetadataIsFinalError)
		if isWriteError || isFinalError {
			// If we can't write the MD, don't bother with the timer
			// anymore. Don't completely shut down, since we don't
			// want forced reclamations to hang.
			timer.Stop()
			timerChan = make(chan time.Time)
			fbm.log.CDebugf(context.Background(),
				"Permanently stopping QR due to error: %+v", err)
		}
	}
}

func (fbm *folderBlockManager) getLastQRData() (time.Time, MetadataRevision) {
	fbm.lastQRLock.Lock()
	defer fbm.lastQRLock.Unlock()
	return fbm.lastReclamationTime, fbm.lastQROldEnoughRev
}

func (fbm *folderBlockManager) clearLastQRData() {
	fbm.lastQRLock.Lock()
	defer fbm.lastQRLock.Unlock()
	fbm.lastQRHeadRev = MetadataRevisionUninitialized
	fbm.lastQROldEnoughRev = MetadataRevisionUninitialized
	fbm.wasLastQRComplete = false
	fbm.lastReclamationTime = time.Time{}
}
