// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
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
	config Config
	fbo    *folderBranchOps
	log    logger.Logger

	inputChanLock sync.RWMutex
	inputChan     chan conflictInput

	// resolveGroup tracks the outstanding resolves.
	resolveGroup RepeatedWaitGroup

	inputLock sync.Mutex
	currInput conflictInput
}

// NewConflictResolver constructs a new ConflictResolver (and launches
// any necessary background goroutines).
func NewConflictResolver(
	config Config, fbo *folderBranchOps) *ConflictResolver {
	// make a logger with an appropriate module name
	branchSuffix := ""
	if fbo.branch() != MasterBranch {
		branchSuffix = " " + string(fbo.branch())
	}
	tlfStringFull := fbo.id().String()
	log := config.MakeLogger(fmt.Sprintf("CR %s%s", tlfStringFull[:8],
		branchSuffix))

	cr := &ConflictResolver{
		config: config,
		fbo:    fbo,
		log:    log,
		currInput: conflictInput{
			unmerged: MetadataRevisionUninitialized,
			merged:   MetadataRevisionUninitialized,
		},
	}

	cr.startProcessing(context.Background())
	return cr
}

func (cr *ConflictResolver) startProcessing(baseCtx context.Context) {
	cr.inputChanLock.Lock()
	defer cr.inputChanLock.Unlock()

	if cr.inputChan != nil {
		return
	}
	cr.inputChan = make(chan conflictInput)
	go cr.processInput(baseCtx, cr.inputChan)
}

func (cr *ConflictResolver) stopProcessing() {
	cr.inputChanLock.Lock()
	defer cr.inputChanLock.Unlock()

	if cr.inputChan == nil {
		return
	}
	close(cr.inputChan)
	cr.inputChan = nil
}

// processInput processes conflict resolution jobs from the given
// channel until it is closed. This function uses a parameter for the
// channel instead of accessing cr.inputChan directly so that it
// doesn't have to hold inputChanLock.
func (cr *ConflictResolver) processInput(baseCtx context.Context,
	inputChan <-chan conflictInput) {
	var cancel context.CancelFunc
	var prevCRDone chan struct{}
	defer func() {
		if cancel != nil {
			cancel()
		}
	}()
	for ci := range inputChan {
		ctx := ctxWithRandomID(baseCtx, CtxCRIDKey, CtxCROpID, cr.log)

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
			cr.resolveGroup.Done()
			continue
		}

		var waitChan chan struct{}
		if cancel != nil {
			waitChan = prevCRDone
		}
		ctx, cancel = context.WithCancel(ctx)
		prevCRDone = make(chan struct{}) // closed when doResolve finishes
		go func(ci conflictInput, done chan<- struct{}) {
			defer cr.resolveGroup.Done()
			defer close(done)
			if waitChan != nil {
				// Wait for the previous CR without blocking any
				// Resolve callers, as that could result in deadlock
				// (KBFS-1001).
				select {
				case <-waitChan:
				case <-ctx.Done():
					cr.log.CDebugf(ctx, "Resolution canceled before starting")
					return
				}
			}
			cr.doResolve(ctx, ci)
		}(ci, prevCRDone)
	}
}

// Resolve takes the latest known unmerged and merged revision
// numbers, and kicks off the resolution process.
func (cr *ConflictResolver) Resolve(unmerged MetadataRevision,
	merged MetadataRevision) {
	cr.inputChanLock.RLock()
	defer cr.inputChanLock.RUnlock()
	if cr.inputChan == nil {
		return
	}

	cr.resolveGroup.Add(1)
	cr.inputChan <- conflictInput{unmerged, merged}
}

// Wait blocks until the current set of submitted resolutions are
// complete (though not necessarily successful), or until the given
// context is canceled.
func (cr *ConflictResolver) Wait(ctx context.Context) error {
	return cr.resolveGroup.Wait(ctx)
}

// Shutdown cancels any ongoing resolutions and stops any background
// goroutines.
func (cr *ConflictResolver) Shutdown() {
	cr.stopProcessing()
}

// Pause cancels any ongoing resolutions and prevents any new ones from
// starting.
func (cr *ConflictResolver) Pause() {
	cr.stopProcessing()
}

// Restart re-enables conflict resolution, with a base context for CR
// operations.
func (cr *ConflictResolver) Restart(baseCtx context.Context) {
	cr.startProcessing(baseCtx)
}

func (cr *ConflictResolver) checkDone(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}

func (cr *ConflictResolver) getMDs(ctx context.Context, lState *lockState) (
	unmerged []*RootMetadata, merged []*RootMetadata, err error) {
	// first get all outstanding unmerged MDs for this device
	branchPoint, unmergedImmutable, err :=
		cr.fbo.getUnmergedMDUpdates(ctx, lState)
	if err != nil {
		return nil, nil, err
	}
	unmerged = make([]*RootMetadata, len(unmergedImmutable))
	// Deep copy because CR may change them.
	for i, md := range unmergedImmutable {
		mdCopy, err := md.deepCopy(cr.config.Codec(), true)
		if err != nil {
			return nil, nil, err
		}
		unmerged[i] = mdCopy
	}

	// now get all the merged MDs, starting from after the branch point
	mergedImmutable, err := getMergedMDUpdates(
		ctx, cr.fbo.config, cr.fbo.id(), branchPoint+1)
	if err != nil {
		return nil, nil, err
	}
	merged = make([]*RootMetadata, len(mergedImmutable))
	// Deep copy because CR may change them.
	for i, md := range mergedImmutable {
		mdCopy, err := md.deepCopy(cr.config.Codec(), true)
		if err != nil {
			return nil, nil, err
		}
		merged[i] = mdCopy
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
	unmergedChains, err =
		newCRChains(ctx, cr.config, unmerged, &cr.fbo.blocks, true)
	if err != nil {
		return nil, nil, err
	}

	mergedChains, err =
		newCRChains(ctx, cr.config, merged, &cr.fbo.blocks, true)
	if err != nil {
		return nil, nil, err
	}

	// Make the chain summaries.  Identify using the unmerged chains,
	// since those are most likely to be able to identify a node in
	// the cache.
	unmergedSummary := unmergedChains.summary(unmergedChains, cr.fbo.nodeCache)
	mergedSummary := mergedChains.summary(unmergedChains, cr.fbo.nodeCache)

	cr.fbo.status.setCRSummary(unmergedSummary, mergedSummary)
	return unmergedChains, mergedChains, nil
}

// A helper class that implements sort.Interface to sort paths by
// descending path length.
type crSortedPaths []path

// Len implements sort.Interface for crSortedPaths
func (sp crSortedPaths) Len() int {
	return len(sp)
}

// Less implements sort.Interface for crSortedPaths
func (sp crSortedPaths) Less(i, j int) bool {
	return len(sp[i].path) > len(sp[j].path)
}

// Swap implements sort.Interface for crSortedPaths
func (sp crSortedPaths) Swap(i, j int) {
	sp[j], sp[i] = sp[i], sp[j]
}

// getPathsFromChains returns a sorted slice of most recent paths to
// all the nodes in the given CR chains that were directly modified
// during a branch, and which existed at both the start and the end of
// the branch.  This represents the paths that need to be checked for
// conflicts.  The paths are sorted by descending path length.  It
// uses the corresponding node cache when looking up paths, which must
// at least contain the most recent root node of the branch.  Note
// that if a path cannot be found, the corresponding chain is
// completely removed from the set of CR chains.
func (cr *ConflictResolver) getPathsFromChains(ctx context.Context,
	chains *crChains, nodeCache NodeCache) ([]path, error) {
	newPtrs := make(map[BlockPointer]bool)
	var ptrs []BlockPointer
	for ptr, chain := range chains.byMostRecent {
		newPtrs[ptr] = true
		// We only care about the paths for ptrs that are directly
		// affected by operations and were live through the entire
		// unmerged branch.
		if len(chain.ops) > 0 && !chains.isCreated(chain.original) &&
			!chains.isDeleted(chain.original) {
			ptrs = append(ptrs, ptr)
		}
	}

	nodeMap, err := cr.fbo.blocks.SearchForNodes(
		ctx, nodeCache, ptrs, newPtrs,
		chains.mostRecentMD.ReadOnly())
	if err != nil {
		return nil, err
	}

	paths := make([]path, 0, len(nodeMap))
	for ptr, n := range nodeMap {
		if n == nil {
			cr.log.CDebugf(ctx, "Ignoring pointer with no found path: %v", ptr)
			chains.removeChain(ptr)
			continue
		}

		p := cr.fbo.nodeCache.PathFromNode(n)
		if p.tailPointer() != ptr {
			return nil, NodeNotFoundError{ptr}
		}
		paths = append(paths, p)

		// update the unmerged final paths
		chain, ok := chains.byMostRecent[ptr]
		if !ok {
			cr.log.CErrorf(ctx, "Couldn't find chain for found path: %v", ptr)
			continue
		}
		for _, op := range chain.ops {
			op.setFinalPath(p)
		}
	}

	// Order by descending path length.
	sort.Sort(crSortedPaths(paths))
	return paths, nil
}

func fileWithConflictingWrite(unmergedChains *crChains, mergedChains *crChains,
	unmergedOriginal BlockPointer, mergedOriginal BlockPointer) bool {
	mergedChain := mergedChains.byOriginal[mergedOriginal]
	unmergedChain := unmergedChains.byOriginal[unmergedOriginal]
	if mergedChain != nil && unmergedChain != nil {
		mergedSync := false
		unmergedSync := false
		for _, op := range mergedChain.ops {
			if _, ok := op.(*syncOp); ok {
				mergedSync = true
				break
			}
		}
		for _, op := range unmergedChain.ops {
			if _, ok := op.(*syncOp); ok {
				unmergedSync = true
				break
			}
		}
		return mergedSync && unmergedSync
	}
	return false
}

// checkPathForMerge checks whether the given unmerged chain and path
// contains any newly-created subdirectories that were created
// simultaneously in the merged branch as well.  If so, it recursively
// checks that directory as well.  It returns a slice of any new
// unmerged paths that need to be checked for conflicts later in
// conflict resolution, for all subdirectories of the given path.
func (cr *ConflictResolver) checkPathForMerge(ctx context.Context,
	unmergedChain *crChain, unmergedPath path, unmergedChains *crChains,
	mergedChains *crChains) ([]path, error) {
	mergedChain, ok := mergedChains.byOriginal[unmergedChain.original]
	if !ok {
		// No corresponding merged chain means we don't have to merge
		// any directories.
		return nil, nil
	}

	// Find instances of the same directory being created in both
	// branches.  Only merge completely new directories -- anything
	// involving a rename will result in a conflict for now.
	//
	// TODO: have a better merge strategy for renamed directories!
	mergedCreates := make(map[string]*createOp)
	for _, op := range mergedChain.ops {
		cop, ok := op.(*createOp)
		if !ok || len(cop.Refs()) == 0 || cop.renamed {
			continue
		}
		mergedCreates[cop.NewName] = cop
	}

	if len(mergedCreates) == 0 {
		return nil, nil
	}

	var newUnmergedPaths []path
	toDrop := make(map[int]bool)
	for i, op := range unmergedChain.ops {
		cop, ok := op.(*createOp)
		if !ok || len(cop.Refs()) == 0 || cop.renamed {
			continue
		}

		// Is there a corresponding merged create with the same type?
		mergedCop, ok := mergedCreates[cop.NewName]
		if !ok || mergedCop.Type != cop.Type {
			continue
		}
		unmergedOriginal := cop.Refs()[0]
		mergedOriginal := mergedCop.Refs()[0]
		if cop.Type != Dir {
			// Only merge files if they don't both have writes.
			if fileWithConflictingWrite(unmergedChains, mergedChains,
				unmergedOriginal, mergedOriginal) {
				continue
			}
		}

		toDrop[i] = true

		cr.log.CDebugf(ctx, "Merging name %s (%s) in %v (unmerged original %v "+
			"changed to %v)", cop.NewName, cop.Type, unmergedChain.mostRecent,
			unmergedOriginal, mergedOriginal)
		// Change the original to match the merged original, so we can
		// check for conflicts later.  Note that the most recent will
		// stay the same, so we can still match the unmerged path
		// correctly.
		err := unmergedChains.changeOriginal(unmergedOriginal, mergedOriginal)
		if _, notFound := err.(NoChainFoundError); notFound {
			unmergedChains.toUnrefPointers[unmergedOriginal] = true
			continue
		} else if err != nil {
			return nil, err
		}

		unmergedChain, ok := unmergedChains.byOriginal[mergedOriginal]
		if !ok {
			return nil, fmt.Errorf("Change original (%v -> %v) didn't work",
				unmergedOriginal, mergedOriginal)
		}
		newPath := unmergedPath.ChildPath(cop.NewName, unmergedChain.mostRecent)
		if cop.Type == Dir {
			// recurse for this chain
			newPaths, err := cr.checkPathForMerge(ctx, unmergedChain, newPath,
				unmergedChains, mergedChains)
			if err != nil {
				return nil, err
			}
			// Add any further subdirectories that need merging under this
			// subdirectory.
			newUnmergedPaths = append(newUnmergedPaths, newPaths...)
		} else {
			// Set the path for all child ops
			unrefedOrig := false
			for _, op := range unmergedChain.ops {
				op.setFinalPath(newPath)
				_, isSyncOp := op.(*syncOp)
				// If a later write overwrites the original, take it
				// out of the unmerged created list so it can be
				// properly unreferenced.
				if !unrefedOrig && isSyncOp {
					unrefedOrig = true
					delete(unmergedChains.createdOriginals, mergedOriginal)
				}
			}
		}
		// Then add this create's path.
		newUnmergedPaths = append(newUnmergedPaths, newPath)
	}

	// Remove the unneeded create ops
	if len(toDrop) > 0 {
		newOps := make([]op, 0, len(unmergedChain.ops)-len(toDrop))
		for i, op := range unmergedChain.ops {
			if toDrop[i] {
				cr.log.CDebugf(ctx,
					"Dropping double create unmerged operation: %s", op)
			} else {
				newOps = append(newOps, op)
			}
		}
		unmergedChain.ops = newOps
	}

	return newUnmergedPaths, nil
}

// findCreatedDirsToMerge finds directories that were created in both
// the unmerged and merged branches, and resets the original unmerged
// pointer to match the original merged pointer. It returns a slice of
// new unmerged paths that need to be combined with the unmergedPaths
// slice.
func (cr *ConflictResolver) findCreatedDirsToMerge(ctx context.Context,
	unmergedPaths []path, unmergedChains *crChains, mergedChains *crChains) (
	[]path, error) {
	var newUnmergedPaths []path
	for _, unmergedPath := range unmergedPaths {
		unmergedChain, ok :=
			unmergedChains.byMostRecent[unmergedPath.tailPointer()]
		if !ok {
			return nil, fmt.Errorf("findCreatedDirsToMerge: No unmerged chain "+
				"for most recent %v", unmergedPath.tailPointer())
		}

		newPaths, err := cr.checkPathForMerge(ctx, unmergedChain, unmergedPath,
			unmergedChains, mergedChains)
		if err != nil {
			return nil, err
		}
		newUnmergedPaths = append(newUnmergedPaths, newPaths...)
	}
	return newUnmergedPaths, nil
}

type createMapKey struct {
	ptr  BlockPointer
	name string
}

// addChildBlocksIfIndirectFile adds refblocks for all child blocks of
// the given file.  It will return an error if called with a pointer
// that doesn't represent a file.
func (cr *ConflictResolver) addChildBlocksIfIndirectFile(ctx context.Context,
	lState *lockState, original BlockPointer, unmergedChains *crChains,
	currPath path, op op) error {
	mostRecent, err := unmergedChains.mostRecentFromOriginalOrSame(original)
	if err != nil {
		return err
	}
	// For files with indirect pointers, and all child blocks
	// as refblocks for the re-created file.
	fblock, err := cr.fbo.blocks.GetFileBlockForReading(ctx, lState,
		unmergedChains.mostRecentMD.ReadOnly(),
		mostRecent, currPath.Branch, currPath)
	if err != nil {
		return err
	}
	if fblock.IsInd {
		cr.log.CDebugf(ctx, "Adding child pointers for recreated "+
			"file %s", currPath)
		for _, ptr := range fblock.IPtrs {
			op.AddRefBlock(ptr.BlockPointer)
		}
	}
	return nil
}

// resolvedMergedPathTail takes an unmerged path, and returns as much
// of the tail-end of the corresponding merged path that it can, using
// only information within the chains.  It may not be able to return a
// complete chain if, for example, a directory was changed in the
// unmerged branch but not in the merged branch, and so the merged
// chain would not have enough information to construct the merged
// branch completely. This function returns the partial path, as well
// as the most recent pointer to the first changed node in the merged
// chains (which can be subsequently used to find the beginning of the
// merged path).
//
// The given unmerged path should be for a node that wasn't created
// during the unmerged branch.
//
// It is also possible for directories used in the unmerged path to
// have been completely removed from the merged path.  In this case,
// they need to be recreated.  So this function also returns a slice
// of create ops that will need to be replayed in the merged branch
// for the conflicts to be resolved.
func (cr *ConflictResolver) resolveMergedPathTail(ctx context.Context,
	lState *lockState, unmergedPath path, unmergedChains *crChains,
	mergedChains *crChains) (path, BlockPointer, []*createOp, error) {
	unmergedOriginal, err :=
		unmergedChains.originalFromMostRecent(unmergedPath.tailPointer())
	if err != nil {
		cr.log.CDebugf(ctx, "Couldn't find original pointer for %v",
			unmergedPath.tailPointer())
		return path{}, BlockPointer{}, nil, err
	}

	var recreateOps []*createOp // fill in backwards, and reverse at the end
	currOriginal := unmergedOriginal
	currPath := unmergedPath
	mergedPath := path{
		FolderBranch: unmergedPath.FolderBranch,
		path:         nil, // fill in backwards, and reverse at the end
	}

	// First find the earliest merged parent.
	for mergedChains.isDeleted(currOriginal) {
		cr.log.CDebugf(ctx, "%v was deleted in the merged branch (%s)",
			currOriginal, currPath)
		if !currPath.hasValidParent() {
			return path{}, BlockPointer{}, nil,
				fmt.Errorf("Couldn't find valid merged parent path for %v",
					unmergedOriginal)
		}

		// If this node has been deleted, we need to search
		// backwards in the path to find the latest node that
		// hasn't been deleted and re-recreate nodes upward from
		// there.
		name := currPath.tailName()
		mergedPath.path = append(mergedPath.path, pathNode{
			BlockPointer: currOriginal,
			Name:         name,
		})
		parentPath := *currPath.parentPath()
		parentOriginal, err :=
			unmergedChains.originalFromMostRecent(parentPath.tailPointer())
		if err != nil {
			cr.log.CDebugf(ctx, "Couldn't find original pointer for %v",
				parentPath.tailPointer())
			return path{}, BlockPointer{}, nil, err
		}

		// Drop the merged rmOp since we're recreating it, and we
		// don't want to replay that notification locally.
		mergedChain, ok := mergedChains.byOriginal[parentOriginal]
		if !ok {
			continue
		}
		mergedMostRecent, err :=
			mergedChains.mostRecentFromOriginalOrSame(currOriginal)
		if err != nil {
			return path{}, BlockPointer{}, nil, err
		}
	outer:
		for i, op := range mergedChain.ops {
			ro, ok := op.(*rmOp)
			if !ok {
				continue
			}
			// Use the unref'd pointer, and not the name, to identify
			// the operation, since renames might have happened on the
			// merged branch.
			for _, unref := range ro.Unrefs() {
				if unref != mergedMostRecent {
					continue
				}

				mergedChain.ops =
					append(mergedChain.ops[:i], mergedChain.ops[i+1:]...)
				break outer
			}
		}

		de, err := cr.fbo.blocks.GetDirtyEntry(ctx, lState,
			unmergedChains.mostRecentMD.ReadOnly(),
			currPath)
		if err != nil {
			return path{}, BlockPointer{}, nil, err
		}
		co, err := newCreateOp(name, parentOriginal, de.Type)
		if err != nil {
			return path{}, BlockPointer{}, nil, err
		}
		co.AddUpdate(parentOriginal, parentOriginal)
		co.setFinalPath(parentPath)
		co.AddRefBlock(currOriginal)

		if co.Type != Dir {
			err = cr.addChildBlocksIfIndirectFile(ctx, lState,
				currOriginal, unmergedChains, currPath, co)
			if err != nil {
				return path{}, BlockPointer{}, nil, err
			}
		}

		// If this happens to have been renamed on the unmerged
		// branch, drop the rm half of the rename operation; just
		// leave it as a create.
		if ri, ok := unmergedChains.renamedOriginals[currOriginal]; ok {
			oldParent, ok := unmergedChains.byOriginal[ri.originalOldParent]
			if !ok {
				continue
			}
			for _, op := range oldParent.ops {
				ro, ok := op.(*rmOp)
				if !ok {
					continue
				}
				if ro.OldName == ri.oldName {
					ro.dropThis = true
					break
				}
			}

			// Replace the create op with the new recreate op,
			// which contains the proper refblock.
			newParent, ok := unmergedChains.byOriginal[ri.originalNewParent]
			if !ok {
				continue
			}
			for i, op := range newParent.ops {
				oldCo, ok := op.(*createOp)
				if !ok {
					continue
				}
				if oldCo.NewName == ri.newName {
					newParent.ops[i] = co
					break
				}
			}
		} else {
			recreateOps = append(recreateOps, co)
		}

		currOriginal = parentOriginal
		currPath = parentPath
	}

	// Now we have the latest pointer along the path that is
	// shared between the branches.  Our next step is to find the
	// current merged path to the most recent version of that
	// original.  We can do that as follows:
	// * If the pointer has been changed in the merged branch, we
	//   can search for it later using fbo.blocks.SearchForNodes
	// * If it hasn't been changed, check if it has been renamed to
	//   somewhere else.  If so, use fbo.blocks.SearchForNodes on
	//   that parent later.
	// * Otherwise, iterate up the path towards the root.
	var mostRecent BlockPointer
	for i := len(currPath.path) - 1; i >= 0; i-- {
		currOriginal, err := unmergedChains.originalFromMostRecent(
			currPath.path[i].BlockPointer)
		if err != nil {
			cr.log.CDebugf(ctx, "Couldn't find original pointer for %v",
				currPath.path[i])
			return path{}, BlockPointer{}, nil, err
		}

		// Has it changed in the merged branch?
		mostRecent, err = mergedChains.mostRecentFromOriginal(currOriginal)
		if err == nil {
			break
		}

		mergedPath.path = append(mergedPath.path, pathNode{
			BlockPointer: currOriginal,
			Name:         currPath.path[i].Name,
		})

		// Has it been renamed?
		if originalParent, newName, ok :=
			mergedChains.renamedParentAndName(currOriginal); ok {
			cr.log.CDebugf(ctx, "%v has been renamed in the merged branch",
				currOriginal)
			mostRecentParent, err :=
				mergedChains.mostRecentFromOriginal(originalParent)
			if err != nil {
				cr.log.CDebugf(ctx, "Couldn't find original pointer for %v",
					originalParent)
				return path{}, BlockPointer{}, nil, err
			}
			mostRecent = mostRecentParent
			// update the name for this renamed node
			mergedPath.path[len(mergedPath.path)-1].Name = newName
			break
		}
	}

	// reverse the merged path
	for i, j := 0, len(mergedPath.path)-1; i < j; i, j = i+1, j-1 {
		mergedPath.path[i], mergedPath.path[j] =
			mergedPath.path[j], mergedPath.path[i]
	}

	// reverse recreateOps
	for i, j := 0, len(recreateOps)-1; i < j; i, j = i+1, j-1 {
		recreateOps[i], recreateOps[j] = recreateOps[j], recreateOps[i]
	}

	return mergedPath, mostRecent, recreateOps, nil
}

// resolveMergedPaths maps each tail most recent pointer for all the
// given unmerged paths to a corresponding path in the merged branch.
// The merged branch may be missing some nodes that have been deleted;
// in that case, the merged path will contain placeholder path nodes
// using the original pointers for those directories.
//
// This function also returns a set of createOps that can be used to
// recreate the missing directories in the merged branch.  If the
// parent directory needing the create has been deleted, then the
// unref ptr in the createOp contains the original pointer for the
// directory rather than the most recent merged pointer.
//
// It also potentially returns a new slice of unmerged paths that the
// caller should combine with the existing slice, corresponding to
// deleted unmerged chains that still have relevant operations to
// resolve.
func (cr *ConflictResolver) resolveMergedPaths(ctx context.Context,
	lState *lockState, unmergedPaths []path, unmergedChains *crChains,
	mergedChains *crChains) (map[BlockPointer]path, []*createOp, []path, error) {
	// maps each most recent unmerged pointer to the corresponding
	// most recent merged path.
	mergedPaths := make(map[BlockPointer]path)

	chainsToSearchFor := make(map[BlockPointer][]BlockPointer)
	var ptrs []BlockPointer

	// While we're at it, find any deleted unmerged directory chains
	// containing operations, where the corresponding merged chain has
	// changed.  The unmerged ops will need to be re-applied in that
	// case.
	var newUnmergedPaths []path
	for original, unmergedChain := range unmergedChains.byOriginal {
		if !unmergedChains.isDeleted(original) || len(unmergedChain.ops) == 0 ||
			unmergedChain.isFile() {
			continue
		}
		mergedChain, ok := mergedChains.byOriginal[original]
		if !ok || len(mergedChain.ops) == 0 ||
			mergedChains.isDeleted(original) {
			continue
		}

		cr.log.CDebugf(ctx, "A modified unmerged path %v was deleted but "+
			"also modified in the merged branch %v",
			unmergedChain.mostRecent, mergedChain.mostRecent)

		// Fake the unmerged path, it doesn't matter
		unmergedPath := path{
			FolderBranch: cr.fbo.folderBranch,
			path:         []pathNode{{BlockPointer: unmergedChain.mostRecent}},
		}
		chainsToSearchFor[mergedChain.mostRecent] =
			append(chainsToSearchFor[mergedChain.mostRecent],
				unmergedChain.mostRecent)
		ptrs = append(ptrs, mergedChain.mostRecent)
		newUnmergedPaths = append(newUnmergedPaths, unmergedPath)
	}

	// Skip out early if there's nothing to do.
	if len(unmergedPaths) == 0 && len(ptrs) == 0 {
		return mergedPaths, nil, nil, nil
	}

	// For each unmerged path, find the corresponding most recent
	// pointer in the merged path.  Track which entries need to be
	// re-created.
	var recreateOps []*createOp
	createsSeen := make(map[createMapKey]bool)
	// maps a merged most recent pointer to the set of unmerged most
	// recent pointers that need some of their path filled in.
	for _, p := range unmergedPaths {
		mergedPath, mostRecent, ops, err := cr.resolveMergedPathTail(
			ctx, lState, p, unmergedChains, mergedChains)
		if err != nil {
			return nil, nil, nil, err
		}

		// Save any recreateOps we've haven't seen yet.
		for _, op := range ops {
			key := createMapKey{op.Dir.Unref, op.NewName}
			if _, ok := createsSeen[key]; ok {
				continue
			}
			createsSeen[key] = true
			recreateOps = append(recreateOps, op)
		}

		// At the end of this process, we are left with a merged path
		// that begins just after mostRecent.  We will fill this in
		// later with the searchFromNodes result.
		mergedPaths[p.tailPointer()] = mergedPath

		if mostRecent.IsInitialized() {
			// Remember to fill in the corresponding mergedPath once we
			// get mostRecent's full path.
			chainsToSearchFor[mostRecent] =
				append(chainsToSearchFor[mostRecent], p.tailPointer())
		}
	}

	// Now we can search for all the merged paths that need to be
	// updated due to unmerged operations.  Start with a clean node
	// cache for the merged branch.
	newPtrs := make(map[BlockPointer]bool)
	for ptr := range mergedChains.byMostRecent {
		newPtrs[ptr] = true
	}
	for ptr := range chainsToSearchFor {
		ptrs = append(ptrs, ptr)
	}

	if len(ptrs) == 0 {
		// Nothing to search for
		return mergedPaths, recreateOps, newUnmergedPaths, nil
	}

	mergedNodeCache := newNodeCacheStandard(cr.fbo.folderBranch)
	nodeMap, err := cr.fbo.blocks.SearchForNodes(
		ctx, mergedNodeCache, ptrs, newPtrs,
		mergedChains.mostRecentMD.ReadOnly())
	if err != nil {
		return nil, nil, nil, err
	}

	for ptr, n := range nodeMap {
		if n == nil {
			// All the pointers we're looking for should definitely be
			// findable in the merged branch somewhere.
			return nil, nil, nil, NodeNotFoundError{ptr}
		}

		p := mergedNodeCache.PathFromNode(n)
		for _, unmergedMostRecent := range chainsToSearchFor[ptr] {
			// Prepend the found path to the existing path
			mergedPath := mergedPaths[unmergedMostRecent]
			newPath := make([]pathNode, len(p.path)+len(mergedPath.path))
			copy(newPath[:len(p.path)], p.path)
			copy(newPath[len(p.path):], mergedPath.path)
			mergedPath.path = newPath
			mergedPaths[unmergedMostRecent] = mergedPath

			// update the final paths for those corresponding merged
			// chains
			mergedMostRecent := mergedPath.tailPointer()
			chain, ok := mergedChains.byMostRecent[mergedMostRecent]
			if !ok {
				// it's ok for the merged path not to exist because we
				// might still need to create it.
				continue
			}
			for _, op := range chain.ops {
				op.setFinalPath(mergedPath)
			}
		}
	}

	return mergedPaths, recreateOps, newUnmergedPaths, nil
}

// buildChainsAndPaths make crChains for both the unmerged and merged
// branches since the branch point, the corresponding full paths for
// those changes, any new recreate ops, and returns the MDs used to
// compute all this.  Note that even if err is nil, the merged MD list
// might be non-nil to allow for better error handling.
func (cr *ConflictResolver) buildChainsAndPaths(
	ctx context.Context, lState *lockState) (
	unmergedChains, mergedChains *crChains, unmergedPaths []path,
	mergedPaths map[BlockPointer]path, recreateOps []*createOp,
	unmerged, merged []*RootMetadata, err error) {
	// Fetch the merged and unmerged MDs
	unmerged, merged, err = cr.getMDs(ctx, lState)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, nil, err
	}

	if u, m := len(unmerged), len(merged); u == 0 || m == 0 {
		cr.log.CDebugf(ctx, "Skipping merge process due to empty MD list: "+
			"%d unmerged, %d merged", u, m)
		return nil, nil, nil, nil, nil, nil, nil, nil
	}

	// Update the current input to reflect the MDs we'll actually be
	// working with.
	err = cr.updateCurrInput(ctx, unmerged, merged)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, nil, err
	}

	// Canceled before we start the heavy lifting?
	err = cr.checkDone(ctx)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, nil, err
	}

	// Make the chains
	unmergedChains, mergedChains, err = cr.makeChains(ctx, unmerged, merged)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, nil, err
	}

	// TODO: if the root node didn't change in either chain, we can
	// short circuit the rest of the process with a really easy
	// merge...

	// Get the full path for every most recent unmerged pointer with a
	// chain of unmerged operations, and which was not created or
	// deleted within in the unmerged branch.
	unmergedPaths, err = cr.getPathsFromChains(ctx, unmergedChains,
		cr.fbo.nodeCache)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, nil, err
	}

	// Add in any directory paths that were created in both branches.
	newUnmergedPaths, err := cr.findCreatedDirsToMerge(ctx, unmergedPaths,
		unmergedChains, mergedChains)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, nil, err
	}
	unmergedPaths = append(unmergedPaths, newUnmergedPaths...)
	if len(newUnmergedPaths) > 0 {
		sort.Sort(crSortedPaths(unmergedPaths))
	}

	// Find the corresponding path in the merged branch for each of
	// these unmerged paths, and the set of any createOps needed to
	// apply these unmerged operations in the merged branch.
	mergedPaths, recreateOps, newUnmergedPaths, err = cr.resolveMergedPaths(
		ctx, lState, unmergedPaths, unmergedChains, mergedChains)
	if err != nil {
		// Return mergedChains in this error case, to allow the error
		// handling code to unstage if necessary.
		return nil, nil, nil, nil, nil, nil, merged, err
	}
	unmergedPaths = append(unmergedPaths, newUnmergedPaths...)
	if len(newUnmergedPaths) > 0 {
		sort.Sort(crSortedPaths(unmergedPaths))
	}

	return unmergedChains, mergedChains, unmergedPaths, mergedPaths,
		recreateOps, unmerged, merged, nil
}

// addRecreateOpsToUnmergedChains inserts each recreateOp, into its
// appropriate unmerged chain, creating one if it doesn't exist yet.
// It also adds entries as necessary to mergedPaths, and returns a
// slice of new unmergedPaths to be added.
func (cr *ConflictResolver) addRecreateOpsToUnmergedChains(ctx context.Context,
	recreateOps []*createOp, unmergedChains *crChains, mergedChains *crChains,
	mergedPaths map[BlockPointer]path) ([]path, error) {
	if len(recreateOps) == 0 {
		return nil, nil
	}

	// First create a lookup table that maps every block pointer in
	// every merged path to a corresponding key in the mergedPaths map.
	keys := make(map[BlockPointer]BlockPointer)
	for ptr, p := range mergedPaths {
		for _, node := range p.path {
			keys[node.BlockPointer] = ptr
		}
	}

	// we know all of these recreate ops were authored by the current user
	kbpki := cr.config.KBPKI()
	_, uid, err := kbpki.GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, err
	}
	winfo, err := newWriterInfo(ctx, cr.config, uid, unmergedChains.mostRecentMD.writerKID())
	if err != nil {
		return nil, err
	}

	var newUnmergedPaths []path
	for _, rop := range recreateOps {
		rop.setWriterInfo(winfo)

		// If rop.Dir.Unref is a merged most recent pointer, look up the
		// original.  Otherwise rop.Dir.Unref is the original.  Use the
		// original to look up the appropriate unmerged chain and stick
		// this op at the front.
		origTargetPtr, err :=
			mergedChains.originalFromMostRecentOrSame(rop.Dir.Unref)
		if err != nil {
			return nil, err
		}

		chain, ok := unmergedChains.byOriginal[origTargetPtr]
		if !ok {
			return nil, fmt.Errorf("recreateOp for %v has no chain",
				origTargetPtr)
		}
		if len(chain.ops) == 0 {
			newUnmergedPaths = append(newUnmergedPaths, rop.getFinalPath())
		}
		chain.ops = append([]op{rop}, chain.ops...)

		// Look up the corresponding unmerged most recent pointer, and
		// check whether there's a merged path for it yet.  If not,
		// create one by looking it up in the lookup table (created
		// above) and taking the appropriate subpath.
		_, ok = mergedPaths[chain.mostRecent]
		if !ok {
			mergedMostRecent := chain.original
			if !mergedChains.isDeleted(chain.original) {
				if mChain, ok := mergedChains.byOriginal[chain.original]; ok {
					mergedMostRecent = mChain.mostRecent
				}
			}
			key, ok := keys[mergedMostRecent]
			if !ok {
				return nil, fmt.Errorf("Couldn't find a merged path "+
					"containing the target of a recreate op: %v",
					mergedMostRecent)
			}
			currPath := mergedPaths[key]
			for currPath.tailPointer() != mergedMostRecent &&
				currPath.hasValidParent() {
				currPath = *currPath.parentPath()
			}
			mergedPaths[chain.mostRecent] = currPath
		}
	}

	return newUnmergedPaths, nil
}

// convertCreateIntoSymlink finds the create operation for the given
// node in the chain, and makes it into one that creates a new symlink
// (for directories) or a file copy.  It also removes the
// corresponding remove operation from the old parent chain.
func (cr *ConflictResolver) convertCreateIntoSymlinkOrCopy(ctx context.Context,
	ptr BlockPointer, info renameInfo, chain *crChain, unmergedChains *crChains,
	mergedChains *crChains, symPath string) error {
	found := false
outer:
	for _, op := range chain.ops {
		switch cop := op.(type) {
		case *createOp:
			if !cop.renamed || cop.NewName != info.newName {
				continue
			}

			if cop.Type == Dir {
				cop.Type = Sym
				cop.crSymPath = symPath
				cop.RefBlocks = nil
			} else {
				cop.forceCopy = true
			}
			cop.renamed = false

			newInfo := renameInfo{
				originalOldParent: info.originalNewParent,
				oldName:           info.newName,
				originalNewParent: info.originalOldParent,
				newName:           info.oldName,
			}
			if newInfo2, ok := mergedChains.renamedOriginals[ptr]; ok {
				// If this node was already moved in the merged
				// branch, we need to tweak the merged branch's rename
				// info so that it looks like it's being renamed from
				// the new unmerged location.
				newInfo = newInfo2
				newInfo.originalOldParent = info.originalNewParent
				newInfo.oldName = info.newName
			} else {
				// invert the op in the merged chains
				invertCreate, err := newRmOp(info.newName,
					info.originalNewParent)
				if err != nil {
					return err
				}
				err = invertCreate.Dir.setRef(info.originalNewParent)
				if err != nil {
					return err
				}
				invertRm, err := newCreateOp(info.oldName,
					info.originalOldParent, cop.Type)
				if err != nil {
					return err
				}
				err = invertRm.Dir.setRef(info.originalOldParent)
				if err != nil {
					return err
				}
				invertRm.renamed = true
				invertRm.AddRefBlock(ptr)

				mergedNewMostRecent, err := mergedChains.
					mostRecentFromOriginalOrSame(info.originalNewParent)
				if err != nil {
					return err
				}
				mergedOldMostRecent, err := mergedChains.
					mostRecentFromOriginalOrSame(info.originalOldParent)
				if err != nil {
					return err
				}
				prependOpsToChain(mergedOldMostRecent, mergedChains,
					invertRm)
				prependOpsToChain(mergedNewMostRecent, mergedChains,
					invertCreate)
			}
			cr.log.CDebugf(ctx, "Putting new merged rename info "+
				"%v -> %v (symPath: %v)", ptr, newInfo, symPath)
			mergedChains.renamedOriginals[ptr] = newInfo

			// Fix up the corresponding rmOp to make sure
			// that it gets dropped
			oldParentChain :=
				unmergedChains.byOriginal[info.originalOldParent]
			for _, oldOp := range oldParentChain.ops {
				ro, ok := oldOp.(*rmOp)
				if !ok {
					continue
				}
				if ro.OldName == info.oldName {
					// No need to copy since this createOp
					// must have been created as part of
					// conflict resolution.
					ro.dropThis = true
					break
				}
			}

			found = true
			break outer
		}
	}
	if !found {
		return fmt.Errorf("fixRenameConflicts: couldn't find "+
			"rename op corresponding to %v,%s", ptr, info.newName)
	}
	return nil
}

// fixRenameConflicts checks every unmerged createOp associated with a
// rename to see if it will cause a cycle.  If so, it makes it a
// symlink create operation instead.  It also checks whether a
// particular node had been renamed in both branches; if so, it will
// copy files, and use symlinks for directories.
func (cr *ConflictResolver) fixRenameConflicts(ctx context.Context,
	unmergedChains *crChains, mergedChains *crChains,
	mergedPaths map[BlockPointer]path) ([]path, error) {
	// For every renamed block pointer in the unmerged chains:
	//   * Check if any BlockPointer in its merged path contains a relative of
	//     itself
	//   * If so, replace the corresponding unmerged create operation with a
	//     symlink creation to the new merged path instead.
	// So, if in the merged branch someone did `mv b/ a/` and in the unmerged
	// branch someone did `mv a/ b/`, the conflict resolution would end up with
	// `a/b/a` where the second a is a symlink to "../".
	//
	// To calculate what the symlink should be, consider the following:
	//   * The unmerged path for the new parent of ptr P is u_1/u_2/.../u_n
	//   * u_i is the largest i <= n such that the corresponding block
	//     can be mapped to a node in merged branch (pointer m_j).
	//   * The full path to m_j in the merged branch is m_1/m_2/m_3/.../m_j
	//   * For a rename cycle to occur, some m_x where x <= j must be a
	//     descendant of P's original pointer.
	//   * The full merged path to the parent of the second copy of P will
	//     then be: m_1/m_2/.../m_x/.../m_j/u_i+1/.../u_n.
	//   * Then, the symlink to put under P's name in u_n is "../"*((n-i)+(j-x))
	// In the case that u_n is a directory that was newly-created in the
	// unmerged branch, we also need to construct a complete corresponding
	// merged path, for use in later stages (like executing actions).  This
	// merged path is just m_1/.../m_j/u_i+1/.../u_n, using the most recent
	// unmerged pointers.
	var newUnmergedPaths []path
	var removeRenames []BlockPointer
	var doubleRenames []BlockPointer // merged most recent ptrs
	for ptr, info := range unmergedChains.renamedOriginals {
		// Also, we need to get the merged paths for anything that was
		// renamed in both branches, if they are different.
		if mergedInfo, ok := mergedChains.renamedOriginals[ptr]; ok &&
			(info.originalNewParent != mergedInfo.originalNewParent ||
				info.newName != mergedInfo.newName) {
			mergedMostRecent, err :=
				mergedChains.mostRecentFromOriginalOrSame(ptr)
			if err != nil {
				return nil, err
			}

			doubleRenames = append(doubleRenames, mergedMostRecent)
			continue
		}

		// The merged path is keyed by the most recent unmerged tail
		// pointer.
		parent, err :=
			unmergedChains.mostRecentFromOriginal(info.originalNewParent)
		if err != nil {
			return nil, err
		}

		mergedPath, ok := mergedPaths[parent]
		unmergedWalkBack := 0 // (n-i) in the equation above
		var unmergedPath path
		if !ok {
			// If this parent was newly created in the unmerged
			// branch, we need to look up its earliest parent that
			// existed in both branches.
			if !unmergedChains.isCreated(info.originalNewParent) {
				// There should definitely be a merged path for this
				// parent, since it has a create operation.
				return nil, fmt.Errorf("fixRenameConflicts: couldn't find "+
					"merged path for %v", parent)
			}

			// Reuse some code by creating a new chains object
			// consisting of only this node.
			newChains := newCRChainsEmpty()
			chain := unmergedChains.byOriginal[info.originalNewParent]
			newChains.byOriginal[chain.original] = chain
			newChains.byMostRecent[chain.mostRecent] = chain
			// Fake out the rest of the chains to populate newPtrs
			for _, c := range unmergedChains.byOriginal {
				if c.original == chain.original {
					continue
				}
				newChain := &crChain{
					original:   c.original,
					mostRecent: c.mostRecent,
				}
				newChains.byOriginal[c.original] = newChain
				newChains.byMostRecent[c.mostRecent] = newChain
			}
			newChains.mostRecentMD = unmergedChains.mostRecentMD
			unmergedPaths, err := cr.getPathsFromChains(ctx, newChains,
				cr.fbo.nodeCache)
			if err != nil {
				return nil, err
			}

			if len(unmergedPaths) != 1 {
				return nil, fmt.Errorf("fixRenameConflicts: couldn't find the "+
					"unmerged path for %v", info.originalNewParent)
			}
			unmergedPath = unmergedPaths[0]
			// Look backwards to find the first parent with a merged path.
			n := len(unmergedPath.path) - 1
			for i := n; i >= 0; i-- {
				mergedPath, ok = mergedPaths[unmergedPath.path[i].BlockPointer]
				if ok {
					unmergedWalkBack = n - i
					break
				}
			}
			if !ok {
				return nil, fmt.Errorf("fixRenameConflicts: couldn't find any "+
					"merged path for any parents of %v", parent)
			}
		}

		for x, pn := range mergedPath.path {
			original, err :=
				mergedChains.originalFromMostRecent(pn.BlockPointer)
			if err != nil {
				// This node wasn't changed in the merged branch
				original = pn.BlockPointer
			}

			if original != ptr {
				continue
			}

			// If any node on this path matches the renamed pointer,
			// we have a cycle.
			chain, ok := unmergedChains.byMostRecent[parent]
			if !ok {
				return nil, fmt.Errorf("fixRenameConflicts: no chain for "+
					"parent %v", parent)
			}

			j := len(mergedPath.path) - 1
			// (j-x) in the above equation
			mergedWalkBack := j - x
			walkBack := unmergedWalkBack + mergedWalkBack

			// Mark this as a symlink, and the resolver
			// will take care of making it a symlink in
			// the merged branch later. No need to copy
			// since this createOp must have been created
			// as part of conflict resolution.
			symPath := "./" + strings.Repeat("../", walkBack)
			cr.log.CDebugf(ctx, "Creating symlink %s at "+
				"merged path %s", symPath, mergedPath)

			err = cr.convertCreateIntoSymlinkOrCopy(ctx, ptr, info, chain,
				unmergedChains, mergedChains, symPath)
			if err != nil {
				return nil, err
			}

			if unmergedWalkBack > 0 {
				cr.log.CDebugf(ctx, "Adding new unmerged path %s",
					unmergedPath)
				newUnmergedPaths = append(newUnmergedPaths,
					unmergedPath)
				// Fake a merged path to make sure these
				// actions will be taken.
				mergedLen := len(mergedPath.path)
				pLen := mergedLen + unmergedWalkBack
				p := path{
					FolderBranch: mergedPath.FolderBranch,
					path:         make([]pathNode, pLen),
				}
				unmergedStart := len(unmergedPath.path) -
					unmergedWalkBack
				copy(p.path[:mergedLen], mergedPath.path)
				copy(p.path[mergedLen:],
					unmergedPath.path[unmergedStart:])
				mergedPaths[unmergedPath.tailPointer()] = p
			}

			removeRenames = append(removeRenames, ptr)
		}
	}

	for _, ptr := range removeRenames {
		delete(unmergedChains.renamedOriginals, ptr)
	}

	if len(doubleRenames) == 0 {
		return newUnmergedPaths, nil
	}

	// Make chains for the new merged parents of all the double renames.
	newPtrs := make(map[BlockPointer]bool)
	ptrs := make([]BlockPointer, len(doubleRenames))
	copy(ptrs, doubleRenames)
	// Fake out the rest of the chains to populate newPtrs
	for ptr := range mergedChains.byMostRecent {
		newPtrs[ptr] = true
	}

	mergedNodeCache := newNodeCacheStandard(cr.fbo.folderBranch)
	nodeMap, err := cr.fbo.blocks.SearchForNodes(
		ctx, mergedNodeCache, ptrs, newPtrs,
		mergedChains.mostRecentMD.ReadOnly())
	if err != nil {
		return nil, err
	}

	for _, ptr := range doubleRenames {
		// Find the merged paths
		node, ok := nodeMap[ptr]
		if !ok || node == nil {
			return nil, fmt.Errorf("Couldn't find merged path for "+
				"doubly-renamed pointer %v", ptr)
		}

		original, err :=
			mergedChains.originalFromMostRecentOrSame(ptr)
		if err != nil {
			return nil, err
		}
		unmergedInfo, ok := unmergedChains.renamedOriginals[original]
		if !ok {
			return nil, fmt.Errorf("fixRenameConflicts: can't find the "+
				"unmerged rename info for %v during double-rename resolution",
				original)
		}
		mergedInfo, ok := mergedChains.renamedOriginals[original]
		if !ok {
			return nil, fmt.Errorf("fixRenameConflicts: can't find the "+
				"merged rename info for %v during double-rename resolution",
				original)
		}

		// If any node on this path matches the renamed pointer,
		// we have a cycle.
		chain, ok := unmergedChains.byOriginal[unmergedInfo.originalNewParent]
		if !ok {
			return nil, fmt.Errorf("fixRenameConflicts: no chain for "+
				"parent %v", unmergedInfo.originalNewParent)
		}

		// For directories, the symlinks traverse down the merged path
		// to the first common node, and then back up to the new
		// parent/name.  TODO: what happens when some element along
		// the merged path also got renamed by the unmerged branch?
		// The symlink would likely be wrong in that case.
		mergedPathOldParent, ok := mergedPaths[chain.mostRecent]
		if !ok {
			return nil, fmt.Errorf("fixRenameConflicts: couldn't find "+
				"merged path for old parent %v", chain.mostRecent)
		}
		mergedPathNewParent := mergedNodeCache.PathFromNode(node)
		symPath := "./"
		newParentStart := 0
	outer:
		for i := len(mergedPathOldParent.path) - 1; i >= 0; i-- {
			mostRecent := mergedPathOldParent.path[i].BlockPointer
			for j, pnode := range mergedPathNewParent.path {
				original, err :=
					unmergedChains.originalFromMostRecentOrSame(mostRecent)
				if err != nil {
					return nil, err
				}
				mergedMostRecent, err :=
					mergedChains.mostRecentFromOriginalOrSame(original)
				if err != nil {
					return nil, err
				}
				if pnode.BlockPointer == mergedMostRecent {
					newParentStart = j
					break outer
				}
			}
			symPath += "../"
		}
		// Move up directories starting from beyond the common parent,
		// to right before the actual node.
		for i := newParentStart + 1; i < len(mergedPathNewParent.path)-1; i++ {
			symPath += mergedPathNewParent.path[i].Name + "/"
		}
		symPath += mergedInfo.newName

		err = cr.convertCreateIntoSymlinkOrCopy(ctx, original, unmergedInfo,
			chain, unmergedChains, mergedChains, symPath)
		if err != nil {
			return nil, err
		}
	}

	return newUnmergedPaths, nil
}

// addMergedRecreates drops any unmerged operations that remove a node
// that was modified in the merged branch, and adds a create op to the
// merged chain so that the node will be re-created locally.
func (cr *ConflictResolver) addMergedRecreates(ctx context.Context,
	unmergedChains *crChains, mergedChains *crChains) error {
	for _, unmergedChain := range unmergedChains.byMostRecent {
		// First check for nodes that have been deleted in the unmerged
		// branch, but modified in the merged branch, and drop those
		// unmerged operations.
		for _, untypedOp := range unmergedChain.ops {
			ro, ok := untypedOp.(*rmOp)
			if !ok {
				continue
			}

			// Perhaps the rm target has been renamed somewhere else,
			// before eventually being deleted.  In this case, we have
			// to look up the original by iterating over
			// renamedOriginals.
			if len(ro.Unrefs()) == 0 {
				for original, info := range unmergedChains.renamedOriginals {
					if info.originalOldParent == unmergedChain.original &&
						info.oldName == ro.OldName &&
						unmergedChains.isDeleted(original) {
						ro.AddUnrefBlock(original)
						break
					}
				}
			}

			for _, ptr := range ro.Unrefs() {
				unrefOriginal, err :=
					unmergedChains.originalFromMostRecentOrSame(ptr)
				if err != nil {
					return err
				}

				if c, ok := mergedChains.byOriginal[unrefOriginal]; ok {
					ro.dropThis = true
					// Need to prepend a create here to the merged parent,
					// in order catch any conflicts.
					parentOriginal := unmergedChain.original
					name := ro.OldName
					if newParent, newName, ok :=
						mergedChains.renamedParentAndName(unrefOriginal); ok {
						// It was renamed in the merged branch, so
						// recreate with the new parent and new name.
						parentOriginal = newParent
						name = newName
					} else if info, ok :=
						unmergedChains.renamedOriginals[unrefOriginal]; ok {
						// It was only renamed in the old parent, so
						// use the old parent and original name.
						parentOriginal = info.originalOldParent
						name = info.oldName
					}
					chain, ok := mergedChains.byOriginal[parentOriginal]
					if !ok {
						return fmt.Errorf("Couldn't find chain for parent %v "+
							"of merged entry %v we're trying to recreate",
							parentOriginal, unrefOriginal)
					}
					t := Dir
					if c.isFile() {
						// TODO: how to fix this up for executables
						// and symlinks?  Only matters for checking
						// conflicts if something with the same name
						// is created on the unmerged branch.
						t = File
					}
					co, err := newCreateOp(name, chain.original, t)
					if err != nil {
						return err
					}
					err = co.Dir.setRef(chain.original)
					if err != nil {
						return err
					}
					co.AddRefBlock(c.mostRecent)
					winfo, err := newWriterInfo(ctx, cr.config,
						mergedChains.mostRecentMD.LastModifyingWriter,
						mergedChains.mostRecentMD.writerKID())
					if err != nil {
						return err
					}
					co.setWriterInfo(winfo)
					chain.ops = append([]op{co}, chain.ops...)
					cr.log.CDebugf(ctx, "Re-created rm'd merge-modified node "+
						"%v with operation %s in parent %v", unrefOriginal, co,
						parentOriginal)
				}
			}

		}
	}
	return nil
}

// getActionsToMerge returns the set of actions needed to merge each
// unmerged chain of operations, in a map keyed by the tail pointer of
// the corresponding merged path.
func (cr *ConflictResolver) getActionsToMerge(unmergedChains *crChains,
	mergedChains *crChains, mergedPaths map[BlockPointer]path) (
	map[BlockPointer]crActionList, error) {
	actionMap := make(map[BlockPointer]crActionList)
	for unmergedMostRecent, unmergedChain := range unmergedChains.byMostRecent {
		original := unmergedChain.original
		// If this is a file that has been deleted in the merged
		// branch, a corresponding recreate op will take care of it,
		// no need to do anything here.

		// We don't need the "ok" value from this lookup because it's
		// fine to pass a nil mergedChain into crChain.getActionsToMerge.
		mergedChain := mergedChains.byOriginal[original]
		mergedPath, ok := mergedPaths[unmergedMostRecent]
		if !ok {
			// This most likely means that the file was created or
			// deleted in the unmerged branch and thus has no
			// corresponding merged path yet.
			continue
		}

		actions, err := unmergedChain.getActionsToMerge(
			cr.config.ConflictRenamer(), mergedPath, mergedChain)
		if err != nil {
			return nil, err
		}

		if len(actions) > 0 {
			actionMap[mergedPath.tailPointer()] = actions
		}
	}

	return actionMap, nil
}

// collapseActions combines file updates with their parent directory
// updates, because conflict resolution only happens within a
// directory (i.e., files are merged directly, they are just
// renamed/copied).  It also collapses each action list to get rid of
// redundant actions.  It returns a slice of additional unmerged paths
// that should be included in the overall list of unmergedPaths.
func collapseActions(unmergedChains *crChains, unmergedPaths []path,
	mergedPaths map[BlockPointer]path,
	actionMap map[BlockPointer]crActionList) (newUnmergedPaths []path) {
	for unmergedMostRecent, chain := range unmergedChains.byMostRecent {
		// Find the parent directory path and combine
		p, ok := mergedPaths[unmergedMostRecent]
		if !ok {
			continue
		}

		fileActions, ok := actionMap[p.tailPointer()]
		if !ok {
			continue
		}

		// If this is a directory with setAttr(mtime)-related actions,
		// just those action should be collapsed into the parent.
		if !chain.isFile() {
			var parentActions crActionList
			var otherDirActions crActionList
			for _, action := range fileActions {
				moved := false
				switch realAction := action.(type) {
				case *copyUnmergedAttrAction:
					if realAction.attr[0] == mtimeAttr && !realAction.moved {
						realAction.moved = true
						parentActions = append(parentActions, realAction)
						moved = true
					}
				case *renameUnmergedAction:
					if realAction.causedByAttr == mtimeAttr &&
						!realAction.moved {
						realAction.moved = true
						parentActions = append(parentActions, realAction)
						moved = true
					}
				}
				if !moved {
					otherDirActions = append(otherDirActions, action)
				}
			}
			if len(parentActions) == 0 {
				// A directory with no mtime actions, so treat it
				// normally.
				continue
			}
			fileActions = parentActions
			if len(otherDirActions) > 0 {
				actionMap[p.tailPointer()] = otherDirActions
			} else {
				delete(actionMap, p.tailPointer())
			}
		} else {
			// Mark the copyUnmergedAttrActions as moved, so they
			// don't get moved again by the parent.
			for _, action := range fileActions {
				if realAction, ok := action.(*copyUnmergedAttrAction); ok {
					realAction.moved = true
				}
			}
		}

		parentPath := *p.parentPath()
		mergedParent := parentPath.tailPointer()
		parentActions, wasParentActions := actionMap[mergedParent]
		combinedActions := append(parentActions, fileActions...)
		actionMap[mergedParent] = combinedActions
		if chain.isFile() {
			mergedPaths[unmergedMostRecent] = parentPath
			delete(actionMap, p.tailPointer())
		} else if !wasParentActions {
			// The parent isn't yet represented in our data
			// structures, so we have to make sure its actions get
			// executed.
			//
			// Find the unmerged path to get the unmerged parent.
			for _, unmergedPath := range unmergedPaths {
				if unmergedPath.tailPointer() != unmergedMostRecent {
					continue
				}
				unmergedParentPath := *unmergedPath.parentPath()
				newUnmergedPaths = append(newUnmergedPaths, unmergedParentPath)
				unmergedParent := unmergedParentPath.tailPointer()
				mergedPaths[unmergedParent] = parentPath
			}
		}
	}

	for ptr, actions := range actionMap {
		actionMap[ptr] = actions.collapse()
	}
	return newUnmergedPaths
}

func (cr *ConflictResolver) computeActions(ctx context.Context,
	unmergedChains *crChains, mergedChains *crChains, unmergedPaths []path,
	mergedPaths map[BlockPointer]path, recreateOps []*createOp) (
	map[BlockPointer]crActionList, []path, error) {
	// Process all the recreateOps, adding them to the appropriate
	// unmerged chains.
	newUnmergedPaths, err := cr.addRecreateOpsToUnmergedChains(
		ctx, recreateOps, unmergedChains, mergedChains, mergedPaths)
	if err != nil {
		return nil, nil, err
	}

	// Fix any rename cycles by turning the corresponding unmerged
	// createOp into a symlink entry type.
	moreNewUnmergedPaths, err := cr.fixRenameConflicts(ctx, unmergedChains,
		mergedChains, mergedPaths)
	if err != nil {
		return nil, nil, err
	}
	newUnmergedPaths = append(newUnmergedPaths, moreNewUnmergedPaths...)

	// Recreate any modified merged nodes that were rm'd in the
	// unmerged branch.
	if err := cr.addMergedRecreates(
		ctx, unmergedChains, mergedChains); err != nil {
		return nil, nil, err
	}

	actionMap, err :=
		cr.getActionsToMerge(unmergedChains, mergedChains, mergedPaths)
	if err != nil {
		return nil, nil, err
	}

	// Finally, merged the file actions back into their parent
	// directory action list, and collapse everything together.
	moreNewUnmergedPaths =
		collapseActions(unmergedChains, unmergedPaths, mergedPaths, actionMap)
	return actionMap, append(newUnmergedPaths, moreNewUnmergedPaths...), nil
}

func (cr *ConflictResolver) fetchDirBlockCopy(ctx context.Context,
	lState *lockState, md ReadOnlyRootMetadata, dir path, lbc localBcache) (
	*DirBlock, error) {
	ptr := dir.tailPointer()
	// TODO: lock lbc if we parallelize
	if block, ok := lbc[ptr]; ok {
		return block, nil
	}
	dblock, err := cr.fbo.blocks.GetDirBlockForReading(
		ctx, lState, md, ptr, dir.Branch, dir)
	if err != nil {
		return nil, err
	}
	dblock, err = dblock.DeepCopy(cr.config.Codec())
	if err != nil {
		return nil, err
	}
	lbc[ptr] = dblock
	return dblock, nil
}

// fileBlockMap maps latest merged block pointer to a map of final
// merged name -> file block.
type fileBlockMap map[BlockPointer]map[string]*FileBlock

func (cr *ConflictResolver) makeFileBlockDeepCopy(ctx context.Context,
	lState *lockState, chains *crChains, mergedMostRecent BlockPointer, parentPath path,
	name string, ptr BlockPointer, blocks fileBlockMap) (
	BlockPointer, error) {
	md := chains.mostRecentMD
	fblock, err := cr.fbo.blocks.GetFileBlockForReading(
		ctx, lState, md.ReadOnly(), ptr,
		parentPath.Branch, parentPath.ChildPath(name, ptr))
	if err != nil {
		return BlockPointer{}, err
	}
	fblock, err = fblock.DeepCopy(cr.config.Codec())
	if err != nil {
		return BlockPointer{}, err
	}
	newPtr := ptr
	_, uid, err := cr.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return BlockPointer{}, err
	}
	if fblock.IsInd {
		newID, err := cr.config.Crypto().MakeTemporaryBlockID()
		if err != nil {
			return BlockPointer{}, err
		}
		newPtr = BlockPointer{
			ID:      newID,
			KeyGen:  md.LatestKeyGeneration(),
			DataVer: cr.config.DataVersion(),
			BlockContext: BlockContext{
				Creator:  uid,
				RefNonce: zeroBlockRefNonce,
			},
		}
	} else {
		newPtr.RefNonce, err = cr.config.Crypto().MakeBlockRefNonce()
		if err != nil {
			return BlockPointer{}, err
		}
		newPtr.SetWriter(uid)
	}
	cr.log.CDebugf(ctx, "Deep copying file %s: %v -> %v", name, ptr, newPtr)
	// Mark this as having been created during this chain, so that
	// later during block accounting we can infer the origin of the
	// block.
	chains.createdOriginals[newPtr] = true
	// If this file was created within the branch, we should clean up
	// all the old block pointers.
	original, err := chains.originalFromMostRecentOrSame(ptr)
	if err != nil {
		return BlockPointer{}, err
	}
	newlyCreated := chains.isCreated(original)
	if newlyCreated {
		chains.toUnrefPointers[original] = true
	}

	if _, ok := blocks[mergedMostRecent]; !ok {
		blocks[mergedMostRecent] = make(map[string]*FileBlock)
	}

	// Dup all of the leaf blocks.
	// TODO: deal with multiple levels of indirection.
	if fblock.IsInd {
		for i, iptr := range fblock.IPtrs {
			if newlyCreated {
				chains.toUnrefPointers[iptr.BlockPointer] = true
			}

			// Generate a new nonce for each one.
			iptr.RefNonce, err = cr.config.Crypto().MakeBlockRefNonce()
			if err != nil {
				return BlockPointer{}, err
			}
			iptr.SetWriter(uid)
			fblock.IPtrs[i] = iptr
			chains.createdOriginals[iptr.BlockPointer] = true
		}
	}

	blocks[mergedMostRecent][name] = fblock
	return newPtr, nil
}

func (cr *ConflictResolver) doActions(ctx context.Context,
	lState *lockState, unmergedChains *crChains, mergedChains *crChains,
	unmergedPaths []path, mergedPaths map[BlockPointer]path,
	actionMap map[BlockPointer]crActionList, lbc localBcache,
	newFileBlocks fileBlockMap) error {
	// For each set of actions:
	//   * Find the corresponding chains
	//   * Make a reference to each slice of ops
	//   * Get the unmerged block.
	//   * Get the merged block if it's not already in the local cache, and
	//     make a copy.
	//   * Get the merged block
	//   * Do each action, updating the ops references to the returned ones
	// At the end, the local block cache should contain all the
	// updated merged blocks.  A future phase will update the pointers
	// in standard Merkle-tree-fashion.
	doneActions := make(map[BlockPointer]bool)
	for _, unmergedPath := range unmergedPaths {
		unmergedMostRecent := unmergedPath.tailPointer()
		unmergedChain, ok :=
			unmergedChains.byMostRecent[unmergedMostRecent]
		if !ok {
			return fmt.Errorf("Couldn't find unmerged chain for %v",
				unmergedMostRecent)
		}

		// If this is a file that has been deleted in the merged
		// branch, a corresponding recreate op will take care of it,
		// no need to do anything here.

		// find the corresponding merged path
		mergedPath, ok := mergedPaths[unmergedMostRecent]
		if !ok {
			// This most likely means that the file was created or
			// deleted in the unmerged branch and thus has no
			// corresponding merged path yet.
			continue
		}
		if unmergedChain.isFile() {
			// The unmerged path is actually the parent (the merged
			// path was already corrected above).
			unmergedPath = *unmergedPath.parentPath()
		}

		actions := actionMap[mergedPath.tailPointer()]
		// Now get the directory blocks.
		unmergedBlock, err := cr.fetchDirBlockCopy(ctx, lState,
			unmergedChains.mostRecentMD.ReadOnly(),
			unmergedPath, lbc)
		if err != nil {
			return err
		}

		// recreateOps update the merged paths using original
		// pointers; but if other stuff happened in the block before
		// it was deleted (such as other removes) we want to preserve
		// those.
		var mergedBlock *DirBlock
		if mergedChains.isDeleted(mergedPath.tailPointer()) {
			mergedBlock = NewDirBlock().(*DirBlock)
			lbc[mergedPath.tailPointer()] = mergedBlock
		} else {
			mergedBlock, err = cr.fetchDirBlockCopy(ctx, lState,
				mergedChains.mostRecentMD.ReadOnly(),
				mergedPath, lbc)
			if err != nil {
				return err
			}
		}

		if len(actions) > 0 && !doneActions[mergedPath.tailPointer()] {
			// Make sure we don't try to execute the same actions twice.
			doneActions[mergedPath.tailPointer()] = true

			// Any file block copies, keyed by their new temporary block
			// IDs, and later we will ready them.
			unmergedFetcher := func(ctx context.Context, name string,
				ptr BlockPointer) (BlockPointer, error) {
				return cr.makeFileBlockDeepCopy(ctx, lState, unmergedChains,
					mergedPath.tailPointer(), unmergedPath, name, ptr,
					newFileBlocks)
			}
			mergedFetcher := func(ctx context.Context, name string,
				ptr BlockPointer) (BlockPointer, error) {
				return cr.makeFileBlockDeepCopy(ctx, lState, mergedChains,
					mergedPath.tailPointer(), mergedPath, name,
					ptr, newFileBlocks)
			}

			// Execute each action and save the modified ops back into
			// each chain.
			for _, action := range actions {
				swap, newPtr, err := action.swapUnmergedBlock(unmergedChains,
					mergedChains, unmergedBlock)
				if err != nil {
					return err
				}
				uBlock := unmergedBlock
				if swap {
					cr.log.CDebugf(ctx, "Swapping out block %v for %v",
						newPtr, unmergedPath.tailPointer())
					if newPtr == zeroPtr {
						// Use this merged block
						uBlock = mergedBlock
					} else {
						// Fetch the specified one. Don't need to make
						// a copy since this will just be a source
						// block.
						dBlock, err := cr.fbo.blocks.GetDirBlockForReading(ctx, lState,
							mergedChains.mostRecentMD.ReadOnly(), newPtr,
							mergedPath.Branch, path{})
						if err != nil {
							return err
						}
						uBlock = dBlock
					}
				}

				err = action.do(ctx, unmergedFetcher, mergedFetcher, uBlock,
					mergedBlock)
				if err != nil {
					return err
				}
			}
		}

		// Now update the ops related to this exact path (not the ops
		// for its parent!).
		for _, action := range actions {
			// unmergedMostRecent is for the correct pointer, but
			// mergedPath may be for the parent in the case of files
			// so we need to find the real mergedMostRecent pointer.
			mergedMostRecent := unmergedChain.original
			mergedChain, ok := mergedChains.byOriginal[unmergedChain.original]
			if ok {
				mergedMostRecent = mergedChain.mostRecent
			}

			err := action.updateOps(unmergedMostRecent, mergedMostRecent,
				unmergedBlock, mergedBlock, unmergedChains, mergedChains)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

type crRenameHelperKey struct {
	parentOriginal BlockPointer
	name           string
}

// makeRevertedOps changes the BlockPointers of the corresponding
// operations for the given set of paths back to their originals,
// which allows other parts of conflict resolution to more easily
// build up the local and remote notifications needed.  Also, it
// reverts rm/create pairs back into complete rename operations, for
// the purposes of notification, so this should only be called after
// all conflicts and actions have been resolved.  It returns the
// complete slice of reverted operations.
func (cr *ConflictResolver) makeRevertedOps(ctx context.Context,
	lState *lockState, sortedPaths []path, chains *crChains,
	otherChains *crChains) ([]op, error) {
	var ops []op
	// Build a map of directory {original, name} -> renamed original.
	// This will help us map create ops to the corresponding old
	// parent.
	renames := make(map[crRenameHelperKey]BlockPointer)
	for original, ri := range chains.renamedOriginals {
		renames[crRenameHelperKey{ri.originalNewParent, ri.newName}] = original
	}

	// Insert the operations starting closest to the root, so
	// necessary directories are created first.
	for i := len(sortedPaths) - 1; i >= 0; i-- {
		ptr := sortedPaths[i].tailPointer()
		chain, ok := chains.byMostRecent[ptr]
		if !ok {
			return nil, fmt.Errorf("makeRevertedOps: Couldn't find chain "+
				"for %v", ptr)
		}

		for _, op := range chain.ops {
			// Skip any rms that were part of a rename
			if rop, ok := op.(*rmOp); ok && len(rop.Unrefs()) == 0 {
				continue
			}

			// Turn the create half of a rename back into a full rename.
			if cop, ok := op.(*createOp); ok && cop.renamed {
				renameOriginal, ok := renames[crRenameHelperKey{
					chain.original, cop.NewName}]
				if !ok {
					if cop.crSymPath != "" || cop.Type == Sym {
						// For symlinks created by the CR process, we
						// expect the rmOp to have been removed.  For
						// existing symlinks that were simply moved,
						// there is no benefit in combining their
						// create and rm ops back together since there
						// is no corresponding node.
						continue
					}
					return nil, fmt.Errorf("Couldn't find corresponding "+
						"renamed original for %v, %s",
						chain.original, cop.NewName)
				}

				if otherChains.isDeleted(renameOriginal) ||
					chains.isCreated(renameOriginal) {
					// If we are re-instating a deleted node, or
					// dealing with a node that was created entirely
					// in this branch, just use the create op.
					op = chains.copyOpAndRevertUnrefsToOriginals(cop)
					if cop.Type != Dir {
						err := cr.addChildBlocksIfIndirectFile(ctx, lState,
							renameOriginal, chains, cop.getFinalPath(), op)
						if err != nil {
							return nil, err
						}
					}
				} else {
					ri, ok := chains.renamedOriginals[renameOriginal]
					if !ok {
						return nil, fmt.Errorf("Couldn't find the rename info "+
							"for original %v", renameOriginal)
					}

					rop, err := newRenameOp(ri.oldName, ri.originalOldParent,
						ri.newName, ri.originalNewParent, renameOriginal,
						cop.Type)
					if err != nil {
						return nil, err
					}
					// Set the Dir.Ref fields to be the same as the Unref
					// -- they will be fixed up later.
					rop.AddUpdate(ri.originalOldParent, ri.originalOldParent)
					if ri.originalNewParent != ri.originalOldParent {
						rop.AddUpdate(ri.originalNewParent,
							ri.originalNewParent)
					}
					for _, ptr := range cop.Unrefs() {
						origPtr, err := chains.originalFromMostRecentOrSame(ptr)
						if err != nil {
							return nil, err
						}
						rop.AddUnrefBlock(origPtr)
					}
					op = rop
				}
			} else {
				op = chains.copyOpAndRevertUnrefsToOriginals(op)
				// The dir of renamed setAttrOps must be reverted to
				// the new parent's original pointer.
				if sao, ok := op.(*setAttrOp); ok {
					if newDir, _, ok :=
						otherChains.renamedParentAndName(sao.File); ok {
						err := sao.Dir.setUnref(newDir)
						if err != nil {
							return nil, err
						}
					}
				}
			}

			ops = append(ops, op)
		}
	}

	return ops, nil
}

// createResolvedMD creates a MD update that will be merged into the
// main folder as the resolving commit.  It contains all of the
// unmerged operations, as well as a "dummy" operation at the end
// which will catch all of the BlockPointer updates.  A later phase
// will move all of those updates into their proper locations within
// the other operations.
func (cr *ConflictResolver) createResolvedMD(ctx context.Context,
	lState *lockState, unmergedPaths []path, unmergedChains *crChains,
	mergedChains *crChains) (*RootMetadata, error) {
	currMD := mergedChains.mostRecentMD
	currMDID, err := cr.config.Crypto().MakeMdID(&currMD.BareRootMetadata)
	if err != nil {
		return nil, err
	}
	newMD, err := currMD.MakeSuccessor(cr.config, currMDID, true)
	if err != nil {
		return nil, err
	}

	// We also need to add in any creates that happened within
	// newly-created directories (which aren't being merged with other
	// newly-created directories), to ensure that the overall Refs are
	// correct and that future CR processes can check those create ops
	// for conflicts.
	var newPaths []path
	for original, chain := range unmergedChains.byOriginal {
		if !unmergedChains.isCreated(original) ||
			mergedChains.isCreated(original) {
			continue
		}
		added := false
		for i, op := range chain.ops {
			if cop, ok := op.(*createOp); ok {
				// Shallowly copy the create op and update its
				// directory to the most recent pointer -- this won't
				// work with the usual revert ops process because that
				// skips chains which are newly-created within this
				// branch.
				newCreateOp := *cop
				newCreateOp.Dir, err = makeBlockUpdate(
					chain.mostRecent, chain.mostRecent)
				if err != nil {
					return nil, err
				}
				chain.ops[i] = &newCreateOp
				if !added {
					newPaths = append(newPaths, path{
						FolderBranch: cr.fbo.folderBranch,
						path: []pathNode{{
							BlockPointer: chain.mostRecent}},
					})
					added = true
				}
				if cop.Type == Dir || len(cop.Refs()) == 0 {
					continue
				}
				// Make sure to add any direct file blocks too,
				// originating in later syncs.
				ptr, err :=
					unmergedChains.mostRecentFromOriginalOrSame(cop.Refs()[0])
				if err != nil {
					return nil, err
				}
				file := path{
					FolderBranch: cr.fbo.folderBranch,
					path:         []pathNode{{BlockPointer: ptr}},
				}
				fblock, err := cr.fbo.blocks.GetFileBlockForReading(ctx, lState,
					unmergedChains.mostRecentMD.ReadOnly(), ptr, file.Branch, file)
				if err != nil {
					return nil, err
				}
				if fblock.IsInd {
					newCreateOp.RefBlocks = make([]BlockPointer,
						len(fblock.IPtrs)+1)
					newCreateOp.RefBlocks[0] = cop.Refs()[0]
					for j, iptr := range fblock.IPtrs {
						newCreateOp.RefBlocks[j+1] = iptr.BlockPointer
					}
				}
			}
		}
	}
	if len(newPaths) > 0 {
		// Put the new paths at the beginning so they are processed
		// last in sorted order.
		unmergedPaths = append(newPaths, unmergedPaths...)
	}

	ops, err := cr.makeRevertedOps(
		ctx, lState, unmergedPaths, unmergedChains, mergedChains)
	if err != nil {
		return nil, err
	}

	cr.log.CDebugf(ctx, "Remote notifications: %v", ops)
	for _, op := range ops {
		cr.log.CDebugf(ctx, "%s: refs %v", op, op.Refs())
		newMD.AddOp(op)
	}

	// Add a final dummy operation to collect all of the block updates.
	newMD.AddOp(newResolutionOp())

	return newMD, nil
}

// crFixOpPointers takes in a slice of "reverted" ops (all referring
// to the original BlockPointers) and a map of BlockPointer updates
// (from original to the new most recent pointer), and corrects all
// the ops to use the new most recent pointers instead.  It returns a
// new slice of these operations with room in the first slot for a
// dummy operation containing all the updates.
func crFixOpPointers(oldOps []op, updates map[BlockPointer]BlockPointer,
	chains *crChains) (
	[]op, error) {
	newOps := make([]op, 0, len(oldOps)+1)
	newOps = append(newOps, nil) // placeholder for dummy op
	for _, op := range oldOps {
		var updatesToFix []*blockUpdate
		var ptrsToFix []*BlockPointer
		switch realOp := op.(type) {
		case *createOp:
			updatesToFix = append(updatesToFix, &realOp.Dir)
			// Since the created node was made exclusively during this
			// branch, we can use the most recent pointer for that
			// node as its ref.
			refs := realOp.Refs()
			realOp.RefBlocks = make([]BlockPointer, len(refs))
			for i, ptr := range refs {
				mostRecent, err := chains.mostRecentFromOriginalOrSame(ptr)
				if err != nil {
					return nil, err
				}
				realOp.RefBlocks[i] = mostRecent
				ptrsToFix = append(ptrsToFix, &realOp.RefBlocks[i])
			}
			// The leading resolutionOp will take care of the updates.
			realOp.Updates = nil
		case *rmOp:
			updatesToFix = append(updatesToFix, &realOp.Dir)
			// Since the rm'd node was made exclusively during this
			// branch, we can use the original pointer for that
			// node as its unref.
			unrefs := realOp.Unrefs()
			realOp.UnrefBlocks = make([]BlockPointer, len(unrefs))
			for i, ptr := range unrefs {
				original, err := chains.originalFromMostRecentOrSame(ptr)
				if err != nil {
					return nil, err
				}
				realOp.UnrefBlocks[i] = original
			}
			// The leading resolutionOp will take care of the updates.
			realOp.Updates = nil
		case *renameOp:
			updatesToFix = append(updatesToFix, &realOp.OldDir, &realOp.NewDir)
			ptrsToFix = append(ptrsToFix, &realOp.Renamed)
			// Hack: we need to fixup local conflict renames so that the block
			// update changes to the new block pointer.
			for i := range realOp.Updates {
				ptrsToFix = append(ptrsToFix, &realOp.Updates[i].Ref)
			}
			// Note: Unrefs from the original renameOp are now in a
			// separate rm operation.
		case *syncOp:
			updatesToFix = append(updatesToFix, &realOp.File)
			realOp.Updates = nil
		case *setAttrOp:
			updatesToFix = append(updatesToFix, &realOp.Dir)
			ptrsToFix = append(ptrsToFix, &realOp.File)
			// The leading resolutionOp will take care of the updates.
			realOp.Updates = nil
		}

		for _, update := range updatesToFix {
			newPtr, ok := updates[update.Unref]
			if !ok {
				continue
			}
			// Since the first op does all the heavy lifting of
			// updating pointers, we can set these to both just be the
			// new pointer
			var err error
			*update, err = makeBlockUpdate(newPtr, newPtr)
			if err != nil {
				return nil, err
			}
		}
		for _, ptr := range ptrsToFix {
			newPtr, ok := updates[*ptr]
			if !ok {
				continue
			}
			*ptr = newPtr
		}

		newOps = append(newOps, op)
	}
	return newOps, nil
}

// resolveOnePath figures out the new merged path, in the resolved
// folder, for a given unmerged pointer.  For each node on the path,
// see if the node has been renamed.  If so, see if there's a
// resolution for it yet.  If there is, complete the path using that
// resolution.  If not, recurse.
func (cr *ConflictResolver) resolveOnePath(ctx context.Context,
	unmergedMostRecent BlockPointer, unmergedChains *crChains,
	mergedChains *crChains, resolvedChains *crChains,
	mergedPaths map[BlockPointer]path,
	resolvedPaths map[BlockPointer]path) (path, error) {
	if p, ok := resolvedPaths[unmergedMostRecent]; ok {
		return p, nil
	}

	// There should always be a merged path, because we should only be
	// calling this with pointers that were updated in the unmerged
	// branch.
	resolvedPath, ok := mergedPaths[unmergedMostRecent]
	if !ok {
		var ptrsToAppend []BlockPointer
		var namesToAppend []string
		next := unmergedMostRecent
		for len(mergedPaths[next].path) == 0 {
			newPtrs := make(map[BlockPointer]bool)
			ptrs := []BlockPointer{unmergedMostRecent}
			for ptr := range unmergedChains.byMostRecent {
				newPtrs[ptr] = true
			}

			nodeMap, err := cr.fbo.blocks.SearchForNodes(
				ctx, cr.fbo.nodeCache, ptrs, newPtrs,
				unmergedChains.mostRecentMD.ReadOnly())
			if err != nil {
				return path{}, err
			}
			n := nodeMap[unmergedMostRecent]
			if n == nil {
				return path{}, fmt.Errorf("resolveOnePath: Couldn't find "+
					"merged path for %v", unmergedMostRecent)
			}
			p := cr.fbo.nodeCache.PathFromNode(n)
			ptrsToAppend = append(ptrsToAppend, next)
			namesToAppend = append(namesToAppend, p.tailName())
			next = p.parentPath().tailPointer()
		}
		resolvedPath = mergedPaths[next]
		for i, ptr := range ptrsToAppend {
			resolvedPath = resolvedPath.ChildPath(namesToAppend[i], ptr)
		}
	}

	i := len(resolvedPath.path) - 1
	for i >= 0 {
		mergedMostRecent := resolvedPath.path[i].BlockPointer
		original, err :=
			mergedChains.originalFromMostRecentOrSame(mergedMostRecent)
		if err != nil {
			return path{}, err
		}

		origNewParent, newName, renamed :=
			resolvedChains.renamedParentAndName(original)
		if !renamed {
			i--
			continue
		}
		unmergedNewParent, err :=
			unmergedChains.mostRecentFromOriginalOrSame(origNewParent)
		if err != nil {
			return path{}, err
		}

		// Is the new parent resolved yet?
		parentPath, err := cr.resolveOnePath(ctx, unmergedNewParent,
			unmergedChains, mergedChains, resolvedChains, mergedPaths,
			resolvedPaths)
		if err != nil {
			return path{}, err
		}

		// Reset the resolved path
		newPathLen := len(parentPath.path) + len(resolvedPath.path) - i
		newResolvedPath := path{
			FolderBranch: resolvedPath.FolderBranch,
			path:         make([]pathNode, newPathLen),
		}
		copy(newResolvedPath.path[:len(parentPath.path)], parentPath.path)
		copy(newResolvedPath.path[len(parentPath.path):], resolvedPath.path[i:])
		i = len(parentPath.path) - 1
		newResolvedPath.path[i+1].Name = newName
		resolvedPath = newResolvedPath
	}

	resolvedPaths[unmergedMostRecent] = resolvedPath
	return resolvedPath, nil
}

// makePostResolutionPaths returns the full paths to each unmerged
// pointer, taking into account any rename operations that occurred in
// the merged branch.
func (cr *ConflictResolver) makePostResolutionPaths(ctx context.Context,
	md *RootMetadata, unmergedChains *crChains, mergedChains *crChains,
	mergedPaths map[BlockPointer]path) (map[BlockPointer]path, error) {
	// No need to run any identifies on these chains, since we have
	// already finished all actions.
	resolvedChains, err := newCRChains(ctx, cr.config,
		[]*RootMetadata{md}, &cr.fbo.blocks, false)
	if err != nil {
		return nil, err
	}

	// If there are no renames, we don't need to fix any of the paths
	if len(resolvedChains.renamedOriginals) == 0 {
		return mergedPaths, nil
	}

	resolvedPaths := make(map[BlockPointer]path)
	for ptr, oldP := range mergedPaths {
		p, err := cr.resolveOnePath(ctx, ptr, unmergedChains, mergedChains,
			resolvedChains, mergedPaths, resolvedPaths)
		if err != nil {
			return nil, err
		}
		cr.log.CDebugf(ctx, "Resolved path for %v from %v to %v",
			ptr, oldP.path, p.path)
	}

	return resolvedPaths, nil
}

// crPathTreeNode represents a particular node in the part of the FS
// tree affected by the conflict resolution, which needs to be sync'd.
type crPathTreeNode struct {
	ptr        BlockPointer
	parent     *crPathTreeNode
	children   map[string]*crPathTreeNode
	mergedPath path
}

// syncTree, given a node in part of the FS tree that needs to be
// sync'd, either calls FolderBranchOps.syncBlock on it if the node
// has no children of its own, or it calls syncTree recursively for
// all children.  When calling itself recursively on its children, it
// instructs each child to sync only up to this node, except for the
// last child which may sync back to the given stopAt pointer.  This
// ensures that the sync process will ready blocks that are complete
// (with all child changes applied) before readying any parent blocks.
// syncTree returns the merged blockPutState for itself and all of its
// children.
func (cr *ConflictResolver) syncTree(ctx context.Context, lState *lockState,
	newMD *RootMetadata, uid keybase1.UID, node *crPathTreeNode,
	stopAt BlockPointer, lbc localBcache, newFileBlocks fileBlockMap) (
	*blockPutState, error) {
	// If this has no children, then sync it, as far back as stopAt.
	if len(node.children) == 0 {
		// Look for the directory block or the new file block.
		entryType := Dir
		var block Block
		var ok bool
		block, ok = lbc[node.ptr]
		// non-nil exactly when entryType != Dir.
		var fblock *FileBlock
		if !ok {
			// This must be a file, so look it up in the parent
			if node.parent == nil {
				return nil, fmt.Errorf("No parent found for node %v while "+
					"syncing path %v", node.ptr, node.mergedPath.path)
			}

			fileBlocks, ok := newFileBlocks[node.parent.ptr]
			if !ok {
				return nil, fmt.Errorf("No file blocks found for parent %v",
					node.parent.ptr)
			}
			fblock, ok = fileBlocks[node.mergedPath.tailName()]
			if !ok {
				return nil, fmt.Errorf("No file block found name %s under "+
					"parent %v", node.mergedPath.tailName(), node.parent.ptr)
			}
			block = fblock
			entryType = File // TODO: FIXME for Ex and Sym
		}

		// TODO: fix mtime and ctime?
		_, _, bps, err := cr.fbo.syncBlockForConflictResolution(
			ctx, lState, uid, newMD, block,
			*node.mergedPath.parentPath(), node.mergedPath.tailName(),
			entryType, false, false, stopAt, lbc)
		if err != nil {
			return nil, err
		}

		if entryType != Dir {
			if fblock.IsInd {
				// For an indirect file block, make sure a new
				// reference is made for every child block.
				for _, iptr := range fblock.IPtrs {
					bps.addNewBlock(iptr.BlockPointer, nil, ReadyBlockData{},
						nil)
					// TODO: add block updates to the op chain for these guys
					// (need encoded size!)
					newMD.AddRefBlock(iptr.BlockInfo)
				}
			}
		}

		return bps, nil
	}

	// If there is more than one child, use this node as the stopAt
	// since it is the branch point, except for the last child.
	bps := newBlockPutState(len(lbc))
	count := 0
	for _, child := range node.children {
		localStopAt := node.ptr
		count++
		if count == len(node.children) {
			localStopAt = stopAt
		}
		childBps, err := cr.syncTree(
			ctx, lState, newMD, uid, child, localStopAt, lbc,
			newFileBlocks)
		if err != nil {
			return nil, err
		}
		bps.mergeOtherBps(childBps)
	}
	return bps, nil
}

// calculateResolutionBytes figured out how many bytes are referenced
// and unreferenced in the merged branch by this resolution.  It
// should be called before the block changes are unembedded in md.
func (cr *ConflictResolver) calculateResolutionUsage(ctx context.Context,
	lState *lockState, md *RootMetadata, bps *blockPutState,
	unmergedChains *crChains, mergedChains *crChains) error {
	md.RefBytes = 0
	md.UnrefBytes = 0
	md.DiskUsage = mergedChains.mostRecentMD.DiskUsage

	// Track the refs and unrefs in a set, to ensure no duplicates
	refs := make(map[BlockPointer]bool)
	unrefs := make(map[BlockPointer]bool)
	for _, op := range md.data.Changes.Ops {
		for _, ptr := range op.Refs() {
			// Don't add usage if it's an unembedded block change pointer.
			if _, ok := unmergedChains.blockChangePointers[ptr]; !ok {
				refs[ptr] = true
			}
		}
		for _, ptr := range op.Unrefs() {
			unrefs[ptr] = true
			delete(refs, ptr)
		}
		for _, update := range op.AllUpdates() {
			if update.Unref != update.Ref {
				unrefs[update.Unref] = true
				delete(refs, update.Unref)
				refs[update.Ref] = true
			}
		}
	}

	localBlocks := make(map[BlockPointer]Block)
	for _, bs := range bps.blockStates {
		if bs.block != nil {
			localBlocks[bs.blockPtr] = bs.block
		}
	}

	// Add bytes for every ref'd block.
	var err error
	for ptr := range refs {
		block, ok := localBlocks[ptr]
		if !ok {
			// Look up the block to get its size.  Since we don't know
			// whether this is a file or directory, just look it up
			// generically.
			//
			// TODO: If the block wasn't already in the cache, this
			// call won't cache it, so it's kind of wasting work.
			// Furthermore, we might be able to get the encoded size
			// from other sources as well (such as its directory entry
			// or its indirect file block) if we happened to have come
			// across it before.
			block, err = cr.fbo.blocks.GetBlockForReading(ctx, lState,
				md.ReadOnly(), ptr, cr.fbo.branch())
			if err != nil {
				return err
			}
		}

		cr.log.CDebugf(ctx, "Ref'ing block %v", ptr)
		size := uint64(block.GetEncodedSize())
		md.RefBytes += size
		md.DiskUsage += size
	}

	// Subtract bytes for every unref'd block that wasn't created in
	// the unmerged branch
	for ptr := range unrefs {
		original, ok := unmergedChains.originals[ptr]
		if !ok {
			original = ptr
		}
		if original != ptr || unmergedChains.isCreated(original) {
			// Only unref pointers that weren't created as part of the
			// unmerged branch.  Either they existed already or they
			// were created as part of the merged branch.
			continue
		}
		// Also make sure this wasn't already removed on the merged branch.
		original, ok = mergedChains.originals[ptr]
		if !ok {
			original = ptr
		}
		if mergedChains.isDeleted(original) {
			continue
		}

		block, err := cr.fbo.blocks.GetBlockForReading(ctx, lState,
			mergedChains.mostRecentMD.ReadOnly(), ptr, cr.fbo.branch())
		if err != nil {
			cr.log.CDebugf(ctx, "Got err reading %v", ptr)
			return err
		}

		cr.log.CDebugf(ctx, "Unref'ing block %v", ptr)
		size := uint64(block.GetEncodedSize())
		md.UnrefBytes += size
		md.DiskUsage -= size
	}

	// Any blocks that were created on the unmerged branch, but didn't
	// survive the resolution, should be marked as unreferenced in the
	// resolution.
	toUnref := make(map[BlockPointer]bool)
	for ptr := range unmergedChains.originals {
		if !refs[ptr] && !unrefs[ptr] {
			toUnref[ptr] = true
		}
	}
	for ptr := range unmergedChains.createdOriginals {
		if !refs[ptr] && !unrefs[ptr] && unmergedChains.byOriginal[ptr] != nil {
			toUnref[ptr] = true
		} else if _, ok := unmergedChains.blockChangePointers[ptr]; ok {
			toUnref[ptr] = true
		} else if _, ok := unmergedChains.toUnrefPointers[ptr]; ok {
			toUnref[ptr] = true
		}
	}
	for ptr := range toUnref {
		// Put the unrefs on the final operations, to cancel out any
		// stray refs in earlier ops.
		cr.log.CDebugf(ctx, "Unreferencing dropped block %v", ptr)
		md.data.Changes.Ops[len(md.data.Changes.Ops)-1].AddUnrefBlock(ptr)
	}

	cr.log.CDebugf(ctx, "New md byte usage: %d ref, %d unref, %d total usage "+
		"(previously %d)", md.RefBytes, md.UnrefBytes, md.DiskUsage,
		mergedChains.mostRecentMD.DiskUsage)
	return nil
}

// syncBlocks takes in the complete set of paths affected by this
// conflict resolution, and organizes them into a tree, which it then
// syncs using syncTree.  It returns a map describing how blocks were
// updated in the merged branch, as well as the complete set of blocks
// that need to be put to the server (and cached) to complete this
// resolution.
func (cr *ConflictResolver) syncBlocks(ctx context.Context, lState *lockState,
	md *RootMetadata, unmergedChains *crChains, mergedChains *crChains,
	resolvedPaths map[BlockPointer]path, lbc localBcache,
	newFileBlocks fileBlockMap) (
	updates map[BlockPointer]BlockPointer, bps *blockPutState, err error) {
	// Construct a tree out of the merged paths, and do a sync at each leaf.
	var root *crPathTreeNode
	for _, p := range resolvedPaths {
		cr.log.CDebugf(ctx, "Creating tree from merged path: %v", p.path)
		var parent *crPathTreeNode
		for i, pnode := range p.path {
			var nextNode *crPathTreeNode
			if parent != nil {
				nextNode = parent.children[pnode.Name]
			} else if root != nil {
				nextNode = root
			}
			if nextNode == nil {
				cr.log.CDebugf(ctx, "Creating node with pointer %v",
					pnode.BlockPointer)
				nextNode = &crPathTreeNode{
					ptr:      pnode.BlockPointer,
					parent:   parent,
					children: make(map[string]*crPathTreeNode),
					// save the full path, since we'll only use this
					// at the leaves anyway.
					mergedPath: p,
				}
				if parent != nil {
					parent.children[pnode.Name] = nextNode
				}
			}
			if parent == nil && root == nil {
				root = nextNode
			}
			parent = nextNode

			// If this node is a directory that has files to sync,
			// make nodes for them as well.  (Because of
			// collapseActions, these files won't have their own
			// mergedPath.)
			blocks, ok := newFileBlocks[pnode.BlockPointer]
			if !ok {
				continue
			}
			dblock, ok := lbc[pnode.BlockPointer]
			if !ok {
				continue
			}
			for name := range blocks {
				if _, ok := nextNode.children[name]; ok {
					continue
				}
				// Try to lookup the block pointer, but this might be
				// for a new file.
				var filePtr BlockPointer
				if de, ok := dblock.Children[name]; ok {
					filePtr = de.BlockPointer
				}
				cr.log.CDebugf(ctx, "Creating child node for name %s for "+
					"parent %v", name, pnode.BlockPointer)
				childPath := path{
					FolderBranch: p.FolderBranch,
					path:         make([]pathNode, i+2),
				}
				copy(childPath.path[0:i+1], p.path[0:i+1])
				childPath.path[i+1] = pathNode{Name: name}
				childNode := &crPathTreeNode{
					ptr:        filePtr,
					parent:     nextNode,
					children:   make(map[string]*crPathTreeNode),
					mergedPath: childPath,
				}
				nextNode.children[name] = childNode
			}
		}
	}

	updates = make(map[BlockPointer]BlockPointer)
	if root == nil {
		return updates, newBlockPutState(0), nil
	}

	_, uid, err := cr.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, nil, err
	}

	// Now do a depth-first walk, and syncBlock back up to the fork on
	// every branch
	bps, err = cr.syncTree(ctx, lState, md, uid, root, BlockPointer{},
		lbc, newFileBlocks)
	if err != nil {
		return nil, nil, err
	}

	oldOps := md.data.Changes.Ops
	resOp, ok := oldOps[len(oldOps)-1].(*resolutionOp)
	if !ok {
		return nil, nil, fmt.Errorf("dummy op is not gc: %s",
			oldOps[len(oldOps)-1])
	}

	// Create an update map, and fix up the gc ops.
	for i, update := range resOp.Updates {
		cr.log.CDebugf(ctx, "resOp update: %v -> %v", update.Unref, update.Ref)
		// The unref should represent the most recent merged pointer
		// for the block.  However, the other ops will be using the
		// original pointer as the unref, so use that as the key.
		updates[update.Unref] = update.Ref
		if chain, ok := mergedChains.byMostRecent[update.Unref]; ok {
			updates[chain.original] = update.Ref
		}

		// Fix the gc updates to make sure they all unref the most
		// recent block pointer.  In cases where the two users create
		// the same directory independently, the update might
		// currently unref the unmerged most recent pointer.
		if chain, ok := unmergedChains.byMostRecent[update.Unref]; ok {
			// In case there was no merged chain above, map the
			// original to the ref again.
			updates[chain.original] = update.Ref

			mergedMostRecent, err :=
				mergedChains.mostRecentFromOriginalOrSame(chain.original)
			if err != nil {
				return nil, nil, err
			}
			cr.log.CDebugf(ctx, "Fixing resOp update from unmerged most "+
				"recent %v to merged most recent %v",
				update.Unref, mergedMostRecent)
			err = update.setUnref(mergedMostRecent)
			if err != nil {
				return nil, nil, err
			}
			resOp.Updates[i] = update
			updates[update.Unref] = update.Ref
		}
	}

	// For all chains that were created only in the unmerged branch,
	// make sure we update all the pointers to their most recent
	// version.
	for original, chain := range unmergedChains.byOriginal {
		if !unmergedChains.isCreated(original) ||
			mergedChains.isCreated(original) {
			continue
		}
		if _, ok := updates[chain.original]; !ok {
			updates[chain.original] = chain.mostRecent
		}
	}

	// For all chains that were updated in both branches, make sure
	// the most recent unmerged pointer updates to the most recent
	// merged pointer.  Normally this would get fixed up in the resOp
	// loop above, but that will miss directories that were not
	// updated as part of the resolution.  (For example, if a file was
	// moved out of a directory in the merged branch, but an attr was
	// set on that file in the unmerged branch.)
	for unmergedOriginal := range unmergedChains.byOriginal {
		mergedChain, ok := mergedChains.byOriginal[unmergedOriginal]
		if !ok {
			continue
		}
		if _, ok := updates[unmergedOriginal]; !ok {
			updates[unmergedOriginal] = mergedChain.mostRecent
		}
	}

	// For all chains that were renamed only in the unmerged branch,
	// make sure we update all the pointers to their most recent
	// version.
	for original := range unmergedChains.renamedOriginals {
		mergedChain, ok := mergedChains.byOriginal[original]
		if !ok {
			continue
		}
		updates[original] = mergedChain.mostRecent
	}

	// Consolidate any chains of updates
	for k, v := range updates {
		if v2, ok := updates[v]; ok {
			updates[k] = v2
			delete(updates, v)
		}
	}

	newOps, err := crFixOpPointers(oldOps[:len(oldOps)-1], updates,
		unmergedChains)
	if err != nil {
		return nil, nil, err
	}

	// Clean up any gc updates that don't refer to blocks that exist
	// in the merged branch.
	var newUpdates []blockUpdate
	for _, update := range resOp.Updates {
		// Ignore it if it doesn't descend from an original block
		// pointer or one created in the merged branch.
		if _, ok := unmergedChains.originals[update.Unref]; !ok &&
			unmergedChains.byOriginal[update.Unref] == nil &&
			mergedChains.byMostRecent[update.Unref] == nil {
			cr.log.CDebugf(ctx, "Turning update from %v into just a ref for %v",
				update.Unref, update.Ref)
			resOp.AddRefBlock(update.Ref)
			continue
		}
		newUpdates = append(newUpdates, update)
	}
	resOp.Updates = newUpdates

	// Also include rmop unrefs for chains that were deleted in the
	// unmerged branch (and so wouldn't be included in the resolved
	// ops), and not re-created by some action in the merged branch.
	// These need to be in the resolution for proper block accounting
	// and invalidation.
	for original, chain := range unmergedChains.byOriginal {
		mergedChain := mergedChains.byOriginal[original]
		if chain.isFile() || !unmergedChains.isDeleted(original) ||
			mergedChains.isDeleted(original) ||
			(mergedChain != nil && len(mergedChain.ops) > 0) {
			continue
		}
		for _, op := range chain.ops {
			if _, ok := op.(*rmOp); !ok {
				continue
			}

			// TODO: We might need to include these rmOps in the
			// actual resolved MD, to send the proper invalidations
			// into the kernel before we rm the parent.
			for _, ptr := range op.Unrefs() {
				if unrefOrig, ok := unmergedChains.originals[ptr]; ok {
					ptr = unrefOrig
				}
				resOp.AddUnrefBlock(ptr)
			}
		}
	}

	newOps[0] = resOp // move the dummy ops to the front
	md.data.Changes.Ops = newOps

	// TODO: only perform this loop if debugging is enabled.
	for _, op := range newOps {
		cr.log.CDebugf(ctx, "remote op %s: refs: %v", op, op.Refs())
		cr.log.CDebugf(ctx, "remote op %s: unrefs: %v", op, op.Unrefs())
		for _, update := range op.AllUpdates() {
			cr.log.CDebugf(ctx, "remote op %s: update: %v -> %v", op,
				update.Unref, update.Ref)
		}
	}

	err = cr.calculateResolutionUsage(ctx, lState, md, bps, unmergedChains,
		mergedChains)
	if err != nil {
		return nil, nil, err
	}

	// do the block changes need their own blocks?
	bsplit := cr.config.BlockSplitter()
	if !bsplit.ShouldEmbedBlockChanges(&md.data.Changes) {
		err = cr.fbo.unembedBlockChanges(ctx, bps, md, &md.data.Changes, uid)
		if err != nil {
			return nil, nil, err
		}
	}
	return updates, bps, nil
}

// getOpsForLocalNotification returns the set of operations that this
// node will need to send local notifications for, in order to
// transition from the staged state to the merged state.
func (cr *ConflictResolver) getOpsForLocalNotification(ctx context.Context,
	lState *lockState, md *RootMetadata, unmergedChains *crChains,
	mergedChains *crChains, updates map[BlockPointer]BlockPointer) (
	[]op, error) {
	dummyOp := newResolutionOp()
	newPtrs := make(map[BlockPointer]bool)
	for original, newMostRecent := range updates {
		chain, ok := unmergedChains.byOriginal[original]
		if ok {
			// If this unmerged node was updated in the resolution,
			// track that update here.
			dummyOp.AddUpdate(chain.mostRecent, newMostRecent)
		} else {
			dummyOp.AddUpdate(original, newMostRecent)
		}
		newPtrs[newMostRecent] = true
	}

	var ptrs []BlockPointer
	chainsToUpdate := make(map[BlockPointer]BlockPointer)
	chainsToAdd := make(map[BlockPointer]*crChain)
	for ptr, chain := range mergedChains.byMostRecent {
		if newMostRecent, ok := updates[chain.original]; ok {
			ptrs = append(ptrs, newMostRecent)
			chainsToUpdate[chain.mostRecent] = newMostRecent
			// This update was already handled above.
			continue
		}

		// If the node changed in both branches, but NOT in the
		// resolution, make sure the local notification uses the
		// unmerged most recent pointer as the unref.
		original := chain.original
		if c, ok := unmergedChains.byOriginal[chain.original]; ok {
			original = c.mostRecent
			updates[chain.original] = chain.mostRecent

			// If the node pointer didn't change in the merged chain
			// (e.g., due to a setattr), fast forward its most-recent
			// pointer to be the unmerged most recent pointer, so that
			// local notifications work correctly.
			if chain.original == chain.mostRecent {
				ptrs = append(ptrs, c.mostRecent)
				chainsToAdd[c.mostRecent] = chain
				delete(mergedChains.byMostRecent, chain.mostRecent)
				chain.mostRecent = c.mostRecent
			}
		}

		newPtrs[ptr] = true
		dummyOp.AddUpdate(original, chain.mostRecent)
		updates[original] = chain.mostRecent
		ptrs = append(ptrs, chain.mostRecent)
	}
	for ptr, chain := range chainsToAdd {
		mergedChains.byMostRecent[ptr] = chain
	}

	// If any nodes changed only in the unmerged branch, make sure we
	// update the pointers in the local ops (e.g., renameOp.Renamed)
	// to the latest local most recent.
	for original, chain := range unmergedChains.byOriginal {
		if _, ok := updates[original]; !ok {
			updates[original] = chain.mostRecent
		}
	}

	// Update the merged chains so they all have the new most recent
	// pointer.
	for mostRecent, newMostRecent := range chainsToUpdate {
		chain, ok := mergedChains.byMostRecent[mostRecent]
		if !ok {
			continue
		}
		delete(mergedChains.byMostRecent, mostRecent)
		chain.mostRecent = newMostRecent
		mergedChains.byMostRecent[newMostRecent] = chain
	}

	// We need to get the complete set of updated merged paths, so
	// that we can correctly order the chains from the root outward.
	mergedNodeCache := newNodeCacheStandard(cr.fbo.folderBranch)
	nodeMap, err := cr.fbo.blocks.SearchForNodes(
		ctx, mergedNodeCache, ptrs, newPtrs, md.ReadOnly())
	if err != nil {
		return nil, err
	}
	mergedPaths := make([]path, 0, len(nodeMap))
	for _, node := range nodeMap {
		if node == nil {
			continue
		}
		mergedPaths = append(mergedPaths, mergedNodeCache.PathFromNode(node))
	}
	sort.Sort(crSortedPaths(mergedPaths))

	ops, err := cr.makeRevertedOps(
		ctx, lState, mergedPaths, mergedChains, unmergedChains)
	if err != nil {
		return nil, err
	}
	newOps, err := crFixOpPointers(ops, updates, mergedChains)
	if err != nil {
		return nil, err
	}
	newOps[0] = dummyOp
	return newOps, err
}

// finalizeResolution finishes the resolution process, making the
// resolution visible to any nodes on the merged branch, and taking
// the local node out of staged mode.
func (cr *ConflictResolver) finalizeResolution(ctx context.Context,
	lState *lockState, md *RootMetadata, unmergedChains *crChains,
	mergedChains *crChains, updates map[BlockPointer]BlockPointer,
	bps *blockPutState) error {
	// Fix up all the block pointers in the merged ops to work well
	// for local notifications.  Make a dummy op at the beginning to
	// convert all the merged most recent pointers into unmerged most
	// recent pointers.
	newOps, err := cr.getOpsForLocalNotification(
		ctx, lState, md, unmergedChains,
		mergedChains, updates)
	if err != nil {
		return err
	}

	cr.log.CDebugf(ctx, "Local notifications: %v", newOps)

	return cr.fbo.finalizeResolution(ctx, lState, md, bps, newOps)
}

// completeResolution pushes all the resolved blocks to the servers,
// computes all remote and local notifications, and finalizes the
// resolution process.
func (cr *ConflictResolver) completeResolution(ctx context.Context,
	lState *lockState, unmergedChains *crChains, mergedChains *crChains,
	unmergedPaths []path, mergedPaths map[BlockPointer]path, lbc localBcache,
	newFileBlocks fileBlockMap, unmergedMDs []*RootMetadata) (err error) {
	md, err := cr.createResolvedMD(ctx, lState, unmergedPaths, unmergedChains,
		mergedChains)
	if err != nil {
		return err
	}

	resolvedPaths, err := cr.makePostResolutionPaths(ctx, md, unmergedChains,
		mergedChains, mergedPaths)
	if err != nil {
		return err
	}

	updates, bps, err := cr.syncBlocks(
		ctx, lState, md, unmergedChains, mergedChains,
		resolvedPaths, lbc, newFileBlocks)
	if err != nil {
		return err
	}

	// Can only do this after syncBlocks, since syncBlocks calls
	// crFixOpPointers, and the ops may be invalid until then.
	err = md.data.checkValid()
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			cr.fbo.fbm.cleanUpBlockState(
				md.ReadOnly(), bps, blockDeleteOnMDFail)
		}
	}()

	// Put all the blocks.  TODO: deal with recoverable block errors?
	_, err = cr.fbo.doBlockPuts(ctx, md.ReadOnly(), *bps)
	if err != nil {
		return err
	}

	err = cr.finalizeResolution(ctx, lState, md, unmergedChains,
		mergedChains, updates, bps)
	if err != nil {
		return err
	}
	return nil
}

// maybeUnstageAfterFailure abandons this branch if there was a
// conflict resolution failure due to missing blocks, caused by a
// concurrent gcOp on the main branch.
func (cr *ConflictResolver) maybeUnstageAfterFailure(ctx context.Context,
	lState *lockState, mergedMDs []*RootMetadata, err error) error {
	// Make sure the error is related to a missing block.
	_, isBlockNotFound := err.(BServerErrorBlockNonExistent)
	_, isBlockDeleted := err.(BServerErrorBlockDeleted)
	if !isBlockNotFound && !isBlockDeleted {
		return err
	}

	// Make sure there was a gcOp on the main branch.
	foundGCOp := false
outer:
	for _, rmd := range mergedMDs {
		for _, op := range rmd.data.Changes.Ops {
			if _, ok := op.(*gcOp); ok {
				foundGCOp = true
				break outer
			}
		}
	}
	if !foundGCOp {
		return err
	}

	cr.log.CDebugf(ctx, "Unstaging due to a failed resolution: %v", err)
	reportedError := CRAbandonStagedBranchError{err, cr.fbo.bid}
	unstageErr := cr.fbo.unstageAfterFailedResolution(ctx, lState)
	if unstageErr != nil {
		cr.log.CDebugf(ctx, "Couldn't unstage: %v", unstageErr)
		return err
	}

	handle := cr.fbo.getHead(lState).GetTlfHandle()
	cr.config.Reporter().ReportErr(ctx,
		handle.GetCanonicalName(), handle.IsPublic(),
		WriteMode, reportedError)
	return nil
}

// CRWrapError wraps an error that happens during conflict resolution.
type CRWrapError struct {
	err error
}

// Error implements the error interface for CRWrapError.
func (e CRWrapError) Error() string {
	return "Conflict resolution error: " + e.err.Error()
}

func (cr *ConflictResolver) doResolve(ctx context.Context, ci conflictInput) {
	cr.log.CDebugf(ctx, "Starting conflict resolution with input %v", ci)
	var err error
	lState := makeFBOLockState()
	defer func() {
		cr.log.CDebugf(ctx, "Finished conflict resolution: %v", err)
		if err != nil {
			handle := cr.fbo.getHead(lState).GetTlfHandle()
			cr.config.Reporter().ReportErr(ctx,
				handle.GetCanonicalName(), handle.IsPublic(),
				WriteMode, CRWrapError{err})
		}
	}()

	// Canceled before we even got started?
	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	var mergedMDs []*RootMetadata
	defer func() {
		if err != nil {
			err = cr.maybeUnstageAfterFailure(ctx, lState, mergedMDs, err)
		}
	}()

	// Step 1: Build the chains for each branch, as well as the paths
	// and necessary extra recreate ops.  The result of this step is:
	//   * A set of conflict resolution "chains" for both the unmerged and
	//     merged branches
	//   * A map containing, for each changed unmerged node, the full path to
	//     the corresponding merged node.
	//   * A set of "recreate" ops that must be applied on the merged branch
	//     to recreate any directories that were modified in the unmerged
	//     branch but removed in the merged branch.
	unmergedChains, mergedChains, unmergedPaths, mergedPaths, recOps,
		unmergedMDs, mergedMDs, err := cr.buildChainsAndPaths(ctx, lState)
	if err != nil {
		return
	}
	if len(mergedPaths) == 0 {
		// nothing to do
		cr.log.CDebugf(ctx, "No updates to resolve, so finishing")
		lbc := make(localBcache)
		newFileBlocks := make(fileBlockMap)
		err = cr.completeResolution(ctx, lState, unmergedChains, mergedChains,
			unmergedPaths, mergedPaths, lbc, newFileBlocks, unmergedMDs)
		return
	}

	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	if status, _, err := cr.fbo.status.getStatus(ctx); err == nil {
		if statusString, err := json.Marshal(status); err == nil {
			ci := func() conflictInput {
				cr.inputLock.Lock()
				defer cr.inputLock.Unlock()
				return cr.currInput
			}()
			cr.log.CInfof(ctx, "Current status during conflict resolution "+
				"(input %v): %s", ci, statusString)
		}
	}
	cr.log.CDebugf(ctx, "Recreate ops: %s", recOps)

	// Step 2: Figure out which actions need to be taken in the merged
	// branch to best reflect the unmerged changes.  The result of
	// this step is a map containing, for each node in the merged path
	// that will be updated during conflict resolution, a set of
	// "actions" to be applied to the merged branch.  Each of these
	// actions contains the logic needed to manipulate the data into
	// the final merged state, including the resolution of any
	// conflicts that occurred between the two branches.
	actionMap, newUnmergedPaths, err := cr.computeActions(ctx, unmergedChains,
		mergedChains, unmergedPaths, mergedPaths, recOps)
	if err != nil {
		return
	}

	// Insert the new unmerged paths as needed
	if len(newUnmergedPaths) > 0 {
		unmergedPaths = append(unmergedPaths, newUnmergedPaths...)
		sort.Sort(crSortedPaths(unmergedPaths))
	}

	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	cr.log.CDebugf(ctx, "Action map: %v", actionMap)

	// Step 3: Apply the actions by looking up the corresponding
	// unmerged dir entry and copying it to a copy of the
	// corresponding merged block.  Keep these dirty block copies in a
	// local dirty cache, keyed by corresponding merged most recent
	// pointer.
	//
	// At the same time, construct two sets of ops: one that will be
	// put into the final MD object that gets merged, and one that
	// needs to be played through as notifications locally to get any
	// local caches synchronized with the final merged state.
	//
	// * This will be taken care of by each crAction.updateOps()
	// method, which modifies the unmerged and merged ops for a
	// particular chain.  After all the crActions are applied, the
	// "unmerged" ops need to be pushed as part of the MD update,
	// while the "merged" ops need to be applied locally.

	// lbc contains the modified directory blocks we need to sync
	lbc := make(localBcache)
	// newFileBlocks contains the copies of the file blocks we need to
	// sync.  If a block is indirect, we need to put it and add new
	// references for all indirect pointers inside it.  If it is not
	// an indirect block, just add a new reference to the block.
	newFileBlocks := make(fileBlockMap)
	err = cr.doActions(ctx, lState, unmergedChains, mergedChains,
		unmergedPaths, mergedPaths, actionMap, lbc, newFileBlocks)
	if err != nil {
		return
	}

	err = cr.checkDone(ctx)
	if err != nil {
		return
	}
	cr.log.CDebugf(ctx, "Executed all actions, %d updated directory blocks",
		len(lbc))

	// Step 4: finish up by syncing all the blocks, computing and
	// putting the final resolved MD, and issuing all the local
	// notifications.
	err = cr.completeResolution(ctx, lState, unmergedChains, mergedChains,
		unmergedPaths, mergedPaths, lbc, newFileBlocks, unmergedMDs)
	if err != nil {
		return
	}

	// TODO: If conflict resolution fails after some blocks were put,
	// remember these and include them in the later resolution so they
	// don't count against the quota forever.  (Though of course if we
	// completely fail, we'll need to rely on a future complete scan
	// to clean up the quota anyway . . .)
}
