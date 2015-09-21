package libkbfs

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// CtxCRTagKey is the type used for unique context tags related to
// conflict resolution
type CtxCRTagKey int

const (
	// CtxCRIDKey is the type of the tag for unique operation IDs
	// related to conflict resolution
	CtxCRIDKey CtxCRTagKey = iota
)

// CtxCROpID is the display name for the unique operation
// conflict resolution ID tag.
const CtxCROpID = "CRID"

type conflictInput struct {
	unmerged MetadataRevision
	merged   MetadataRevision
}

// ConflictResolver is responsible for resolving conflicts in the
// background.
type ConflictResolver struct {
	config     Config
	fbo        *FolderBranchOps
	inputChan  chan conflictInput
	inputGroup sync.WaitGroup
	log        logger.Logger

	shutdown     bool
	shutdownLock sync.RWMutex

	currInput conflictInput
	inputLock sync.Mutex
}

// NewConflictResolver constructs a new ConflictResolver (and launches
// any necessary background goroutines).
func NewConflictResolver(
	config Config, fbo *FolderBranchOps) *ConflictResolver {
	// make a logger with an appropriate module name
	branchSuffix := ""
	if fbo.branch() != MasterBranch {
		branchSuffix = " " + string(fbo.branch())
	}
	tlfStringFull := fbo.id().String()
	log := config.MakeLogger(fmt.Sprintf("CR %s%s", tlfStringFull[:8],
		branchSuffix))

	cr := &ConflictResolver{
		config:    config,
		fbo:       fbo,
		inputChan: make(chan conflictInput),
		log:       log,
		currInput: conflictInput{
			unmerged: MetadataRevisionUninitialized,
			merged:   MetadataRevisionUninitialized,
		},
	}

	go cr.processInput()
	return cr
}

func (cr *ConflictResolver) processInput() {
	logTags := make(logger.CtxLogTags)
	logTags[CtxCRIDKey] = CtxCROpID
	backgroundCtx := logger.NewContextWithLogTags(context.Background(), logTags)

	var cancel func()
	defer func() {
		if cancel != nil {
			cancel()
		}
	}()
	for ci := range cr.inputChan {
		ctx := backgroundCtx
		id, err := MakeRandomRequestID()
		if err != nil {
			cr.log.Warning("Couldn't generate a random request ID: %v", err)
		} else {
			ctx = context.WithValue(ctx, CtxCRIDKey, id)
		}

		valid := func() bool {
			cr.inputLock.Lock()
			defer cr.inputLock.Unlock()
			// The input is only interesting if one of the revisions
			// is greater than what we've looked at to date.
			if ci.unmerged <= cr.currInput.unmerged &&
				ci.merged <= cr.currInput.merged {
				return false
			}
			cr.log.CDebugf(ctx, "New conflict input %v following old "+
				"input %v", ci, cr.currInput)
			cr.currInput = ci
			// cancel the existing conflict resolution (if any)
			if cancel != nil {
				cancel()
			}
			return true
		}()
		if !valid {
			cr.log.CDebugf(ctx, "Ignoring uninteresting input: %v", ci)
			cr.inputGroup.Done()
			continue
		}

		ctx, cancel = context.WithCancel(ctx)
		go cr.doResolve(ctx, ci)
	}
}

// Resolve takes the latest known unmerged and merged revision
// numbers, and kicks off the resolution process.
func (cr *ConflictResolver) Resolve(unmerged MetadataRevision,
	merged MetadataRevision) {
	cr.shutdownLock.RLock()
	defer cr.shutdownLock.RUnlock()
	if cr.shutdown {
		return
	}

	cr.inputGroup.Add(1)
	cr.inputChan <- conflictInput{unmerged, merged}
}

// Wait blocks until the current set of submitted resolutions are
// complete (though not necessarily successful), or until the given
// context is canceled.
func (cr *ConflictResolver) Wait(ctx context.Context) error {
	c := make(chan struct{}, 1)
	go func() {
		cr.inputGroup.Wait()
		c <- struct{}{}
	}()

	select {
	case <-c:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Shutdown cancels any ongoing resolutions and stops any background
// goroutines.
func (cr *ConflictResolver) Shutdown() {
	cr.shutdownLock.Lock()
	defer cr.shutdownLock.Unlock()
	cr.shutdown = true
	close(cr.inputChan)
}

func (cr *ConflictResolver) checkDone(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}

func (cr *ConflictResolver) getMDs(ctx context.Context) (
	unmerged []*RootMetadata, merged []*RootMetadata, err error) {
	// first get all outstanding unmerged MDs for this device
	branchPoint, unmerged, err := cr.fbo.getUnmergedMDUpdates(ctx)
	if err != nil {
		return nil, nil, err
	}

	// now get all the merged MDs, starting from after the branch point
	merged, err = getMergedMDUpdates(ctx, cr.fbo.config, cr.fbo.id(),
		branchPoint+1)
	if err != nil {
		return nil, nil, err
	}

	// re-embed all the block changes
	err = cr.fbo.reembedBlockChanges(ctx, unmerged)
	if err != nil {
		return nil, nil, err
	}
	err = cr.fbo.reembedBlockChanges(ctx, merged)
	if err != nil {
		return nil, nil, err
	}

	return unmerged, merged, nil
}

func (cr *ConflictResolver) updateCurrInput(ctx context.Context,
	unmerged []*RootMetadata, merged []*RootMetadata) (err error) {
	cr.inputLock.Lock()
	defer cr.inputLock.Unlock()
	// check done while holding the lock, so we know for sure if
	// we've already been canceled and replaced by a new input.
	err = cr.checkDone(ctx)
	if err != nil {
		return err
	}

	prevInput := cr.currInput
	defer func() {
		// reset the currInput if we get an error below
		if err != nil {
			cr.currInput = prevInput
		}
	}()

	if len(unmerged) > 0 {
		rev := unmerged[len(unmerged)-1].Revision
		if rev < cr.currInput.unmerged {
			return fmt.Errorf("Unmerged revision %d is lower than the "+
				"expected unmerged revision %d", rev, cr.currInput.unmerged)
		}
		cr.currInput.unmerged = rev
	}
	if len(merged) > 0 {
		rev := merged[len(merged)-1].Revision
		if rev < cr.currInput.merged {
			return fmt.Errorf("Merged revision %d is lower than the "+
				"expected merged revision %d", rev, cr.currInput.merged)
		}
		cr.currInput.merged = rev
	}
	return nil
}

func (cr *ConflictResolver) makeChains(ctx context.Context,
	unmerged []*RootMetadata, merged []*RootMetadata) (
	unmergedChains *crChains, mergedChains *crChains, err error) {
	unmergedChains, err = newCRChains(unmerged)
	if err != nil {
		return nil, nil, err
	}

	mergedChains, err = newCRChains(merged)
	if err != nil {
		return nil, nil, err
	}

	cr.fbo.status.setCRChains(unmergedChains, mergedChains)
	return unmergedChains, mergedChains, nil
}

func (cr *ConflictResolver) getUnmergedPaths(ctx context.Context,
	unmergedChains *crChains, mostRecentUnmergedMD *RootMetadata) (
	[]path, error) {
	newPtrs := make(map[BlockPointer]bool)
	ptrs := make([]BlockPointer, 0, len(unmergedChains.byMostRecent))
	for ptr := range unmergedChains.byMostRecent {
		newPtrs[ptr] = true
		ptrs = append(ptrs, ptr)
	}

	nodeMap, err := cr.fbo.searchForNodes(ctx, ptrs, newPtrs,
		mostRecentUnmergedMD)
	if err != nil {
		return nil, err
	}

	paths := make(map[BlockPointer]path)
	for ptr, n := range nodeMap {
		if n == nil {
			cr.log.CDebugf(ctx, "Ignoring pointer with no found path: %v", ptr)
			unmergedChains.removeChain(ptr)
		} else {
			p := cr.fbo.nodeCache.PathFromNode(n)
			if p.tailPointer() != ptr {
				return nil, NodeNotFoundError{ptr}
			}
			paths = append(paths, p)
		}
	}

	return paths, nil
}

func (cr *ConflictResolver) doResolve(ctx context.Context, ci conflictInput) {
	cr.log.CDebugf(ctx, "Starting conflict resolution with input %v", ci)
	var err error
	defer cr.inputGroup.Done()
	defer func() {
		cr.log.CDebugf(ctx, "Finished conflict resolution: %v", err)
	}()

	// Canceled before we even got started?
	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	// Fetch the merged and unmerged MDs
	unmerged, merged, err := cr.getMDs(ctx)
	if err != nil {
		return
	}

	if u, m := len(unmerged), len(merged); u == 0 || m == 0 {
		cr.log.CDebugf(ctx, "Skipping merge process due to empty MD list: "+
			"%d unmerged, %d merged", u, m)
		return
	}

	// Update the current input to reflect the MDs we'll actually be
	// working with.
	err = cr.updateCurrInput(ctx, unmerged, merged)
	if err != nil {
		return
	}

	// Canceled before we start the heavy lifting?
	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	// Make the chains
	unmergedChains, _, err := cr.makeChains(ctx, unmerged, merged)
	if err != nil {
		return
	}

	// Get the full path for every most recent pointer with a chain of
	// unmerged operations. If the path doesn't exist, that means the
	// whole node was deleted, so skip.
	_, err = cr.getUnmergedPaths(ctx, unmergedChains, unmerged[len(unmerged)-1])
	if err != nil {
		return
	}

	// * Order by descending path length.
	// * Find the corresponding path in the merged/resolved branch
	//   * Find the original pointer for the most recent pointer.
	//   * Find the merged most recent pointer of that original pointer.
	//   * Search for the full path to that most recent pointer in the final
	//     state of B.
	//   * If it exists, great!
	//   * If it doesn't exist, repeat on the next component of the path
	//     (closer to the root), until you find a path that does exist.
	//   * Now add createOps as necessary to resolvedChains in order to
	//     create the full path again, and add entries to the corresponding
	//     dirty blocks.  Use the most recent pointer unmerged block pointer
	//     for the directory as the starting pointer for the new directory.
	// * For syncOps, add a syncAttr setAttrOp to the parent unmerged dir chain
	//   * If there's a conflict, add a resolving createOp to the parent.
	// * Otherwise, for each operation in the unmerged chain, check for
	//   conflicts in the corresponding merged chain and resolve accordingly.
	//   * During this process, construct a separate set of notifyOps that
	//     will be played locally to the local caches into line with the
	//     new reality.
	// * In addition, if the op is an rmOp that's not part of a rename, check
	//   whether the original pointer of the actual BlockPointer in the
	//   directory entry being removed has a different most recent pointer
	//   in the merged branch.  If so, something has changed in it or in
	//   one of its children in the merged branch, so we can ignore the rmOp.
	// * Apply the operations by looking up the corresponding unmerged dir
	//   entry and copying it to a copy of the corresponding merged block.
	//   Keep these dirty block copies in a local dirty cache, keyed by
	//   corresponding merged most recent pointer.
	// * Once all the new blocks are ready, calculate the resolvedChain paths
	//   and arrange them into a tree.  Do a recursive descent and
	//   syncBlockLocked each branch (filling in the new BlockChanges in a
	//   new MD object)
	// * Finally attempt to put the final MD object.  If successful, send
	//   out all the notifyOps to observers.
	// Release all locks and reset the currInput, we're done!
}
