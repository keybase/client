package libkbfs

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// folderBlockManager is a helper class for managing the blocks in a
// particular TLF.  It archives historical blocks and reclaims quota
// usage, all in the background.
type folderBlockManager struct {
	config       Config
	log          logger.Logger
	shutdownChan chan struct{}
	id           TlfID

	// A queue of MD updates for this folder that need to have their
	// unref's blocks archived
	archiveChan chan *RootMetadata

	// We use a mutex, int, and channel to track and synchronize on
	// the number of outstanding archive requests.  We can't use a
	// sync.WaitGroup because it requires that the Add() and the
	// Wait() are fully synchronized, which means holding a mutex
	// during Wait(), which can lead to deadlocks between incoming FBO
	// calls and the background archiver.  TODO: add a struct for
	// these fields, to be shared with a similar usage in
	// ConflictResolver.
	archiveLock     sync.Mutex
	numArchives     int
	isArchiveIdleCh chan struct{} // leave as nil when initializing

	// blocksToDeleteAfterError is a list of blocks, for a given
	// metadata revision, that may have been Put as part of a failed
	// MD write.  These blocks should be deleted as soon as we know
	// for sure that the MD write isn't visible to others.
	// The lock should only be held immediately around accessing the
	// list.  TODO: Persist these to disk?
	blocksToDeleteLock       sync.Mutex
	blocksToDeleteAfterError map[*RootMetadata][]BlockPointer
}

func newFolderBlockManager(config Config, fb FolderBranch) *folderBlockManager {
	tlfStringFull := fb.Tlf.String()
	log := config.MakeLogger(fmt.Sprintf("FBM %s", tlfStringFull[:8]))
	fbm := &folderBlockManager{
		config:                   config,
		log:                      log,
		shutdownChan:             make(chan struct{}),
		id:                       fb.Tlf,
		archiveChan:              make(chan *RootMetadata, 25),
		blocksToDeleteAfterError: make(map[*RootMetadata][]BlockPointer),
	}
	go fbm.archiveBlocksInBackground()
	return fbm
}

func (fbm *folderBlockManager) shutdown() {
	close(fbm.shutdownChan)
}

func (fbm *folderBlockManager) cleanUpBlockState(
	md *RootMetadata, bps *blockPutState) {
	fbm.blocksToDeleteLock.Lock()
	defer fbm.blocksToDeleteLock.Unlock()
	// Clean up any blocks that may have been orphaned by this
	// failure.
	for _, bs := range bps.blockStates {
		fbm.blocksToDeleteAfterError[md] =
			append(fbm.blocksToDeleteAfterError[md], bs.blockPtr)
	}
}

func (fbm *folderBlockManager) archiveUnrefBlocks(md *RootMetadata) {
	// Don't archive for unmerged revisions, because conflict
	// resolution might undo some of the unreferences.
	if md.MergedStatus() != Merged {
		return
	}

	func() {
		fbm.archiveLock.Lock()
		defer fbm.archiveLock.Unlock()
		if fbm.numArchives == 0 {
			fbm.isArchiveIdleCh = make(chan struct{})
		}
		fbm.numArchives++
	}()
	fbm.archiveChan <- md
}

func (fbm *folderBlockManager) waitForArchives(ctx context.Context) error {
	archiveIdleCh := func() chan struct{} {
		fbm.archiveLock.Lock()
		defer fbm.archiveLock.Unlock()
		return fbm.isArchiveIdleCh
	}()

	if archiveIdleCh == nil {
		return nil
	}

	select {
	case <-archiveIdleCh:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (fbm *folderBlockManager) processBlocksToDelete(ctx context.Context) error {
	// also attempt to delete any error references
	var toDelete map[*RootMetadata][]BlockPointer
	func() {
		fbm.blocksToDeleteLock.Lock()
		defer fbm.blocksToDeleteLock.Unlock()
		toDelete = fbm.blocksToDeleteAfterError
		fbm.blocksToDeleteAfterError =
			make(map[*RootMetadata][]BlockPointer)
	}()

	if len(toDelete) == 0 {
		return nil
	}

	toDeleteAgain := make(map[*RootMetadata][]BlockPointer)
	bops := fbm.config.BlockOps()
	for md, ptrs := range toDelete {
		fbm.log.CDebugf(ctx, "Checking deleted blocks for revision %d",
			md.Revision)
		// Make sure that the MD didn't actually become
		// part of the folder history.  (This could happen
		// if the Sync was canceled while the MD put was
		// outstanding.)
		var rmds []*RootMetadata
		var err error
		if md.MergedStatus() == Merged {
			rmds, err = getMergedMDUpdates(ctx, fbm.config, fbm.id,
				md.Revision)
		} else {
			_, rmds, err = getUnmergedMDUpdates(ctx, fbm.config, fbm.id,
				md.BID, md.Revision)
		}
		if err != nil || len(rmds) == 0 {
			toDeleteAgain[md] = ptrs
			continue
		}
		if rmds[0].data.Dir == md.data.Dir {
			// This md is part of the history of the folder,
			// so we shouldn't delete the blocks.
			fbm.log.CDebugf(ctx, "Not deleting blocks from revision %d",
				md.Revision)
			// But, since this MD put seems to have succeeded, we
			// should archive it.
			fbm.log.CDebugf(ctx, "Archiving successful MD revision %d",
				rmds[0].Revision)
			fbm.archiveUnrefBlocks(rmds[0])
			continue
		}

		// Otherwise something else has been written over
		// this MD, so get rid of the blocks.
		fbm.log.CDebugf(ctx, "Cleaning up blocks for failed revision %d",
			md.Revision)

		for _, ptr := range ptrs {
			err := bops.Delete(ctx, md, ptr.ID, ptr)
			// Ignore permanent errors
			_, isPermErr := err.(BServerError)
			if err != nil {
				fbm.log.CWarningf(ctx, "Couldn't delete ref %v: %v", ptr, err)
				if !isPermErr {
					toDeleteAgain[md] = append(toDeleteAgain[md], ptr)
				}
			}
		}
	}

	if len(toDeleteAgain) > 0 {
		func() {
			fbm.blocksToDeleteLock.Lock()
			defer fbm.blocksToDeleteLock.Unlock()
			for md, ptrs := range toDeleteAgain {
				fbm.blocksToDeleteAfterError[md] =
					append(fbm.blocksToDeleteAfterError[md], ptrs...)
			}
		}()
	}

	return nil
}

func (fbm *folderBlockManager) archiveDone() {
	fbm.archiveLock.Lock()
	defer fbm.archiveLock.Unlock()
	if fbm.numArchives <= 0 {
		panic(fmt.Sprintf("Bad number of archives in archivesDone: %d",
			fbm.numArchives))
	}
	fbm.numArchives--
	if fbm.numArchives == 0 {
		close(fbm.isArchiveIdleCh)
		fbm.isArchiveIdleCh = nil
	}
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
	return ctxWithRandomID(ctx, CtxFBMIDKey, CtxFBMOpID, fbm.log)
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

func (fbm *folderBlockManager) archiveBlocksInBackground() {
	for {
		select {
		case md := <-fbm.archiveChan:
			var ptrs []BlockPointer
			for _, op := range md.data.Changes.Ops {
				ptrs = append(ptrs, op.Unrefs()...)
				for _, update := range op.AllUpdates() {
					ptrs = append(ptrs, update.Unref)
				}
			}
			fbm.runUnlessShutdown(func(ctx context.Context) (err error) {
				defer fbm.archiveDone()
				// This func doesn't take any locks, though it can
				// block md writes due to the buffered channel.  So
				// use the long timeout to make sure things get
				// unblocked eventually, but no need for a short timeout.
				ctx, cancel := context.WithTimeout(ctx, backgroundTaskTimeout)
				defer cancel()

				fbm.log.CDebugf(ctx, "Archiving %d block pointers as a result "+
					"of revision %d", len(ptrs), md.Revision)
				bops := fbm.config.BlockOps()
				err = bops.Archive(ctx, md, ptrs)
				if err != nil {
					fbm.log.CWarningf(ctx, "Couldn't archive blocks: %v", err)
					return err
				}

				// Also see if we can delete any blocks.
				if err := fbm.processBlocksToDelete(ctx); err != nil {
					fbm.log.CDebugf(ctx, "Error deleting blocks: %v", err)
					return err
				}

				return nil
			})
		case <-fbm.shutdownChan:
			return
		}
	}
}
