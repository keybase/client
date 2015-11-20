package libkbfs

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
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
		// TODO: From the WaitGroup documentation, it's unclear what
		// happens if you call Wait() when there are no outstanding
		// CRs, so we might want to avoid calling Wait in that case.
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

// shutdownLocked requires that the caller hold shutdownLock for writing.
func (cr *ConflictResolver) shutdownLocked() {
	cr.shutdown = true
	close(cr.inputChan)
}

// Shutdown cancels any ongoing resolutions and stops any background
// goroutines.
func (cr *ConflictResolver) Shutdown() {
	cr.shutdownLock.Lock()
	defer cr.shutdownLock.Unlock()
	cr.shutdownLocked()
}

// Pause cancels any ongoing resolutions and prevents any new ones from
// starting.
func (cr *ConflictResolver) Pause() {
	cr.shutdownLock.Lock()
	defer cr.shutdownLock.Unlock()
	cr.shutdownLocked()
	cr.inputChan = make(chan conflictInput)
}

// Restart re-enables conflict resolution.
func (cr *ConflictResolver) Restart() {
	cr.shutdownLock.Lock()
	defer cr.shutdownLock.Unlock()
	if !cr.shutdown {
		return
	}

	cr.shutdown = false
	go cr.processInput()
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
	unmergedChains, err = newCRChains(ctx, cr.config.KBPKI(), unmerged)
	if err != nil {
		return nil, nil, err
	}

	mergedChains, err = newCRChains(ctx, cr.config.KBPKI(), merged)
	if err != nil {
		return nil, nil, err
	}

	cr.fbo.status.setCRChains(unmergedChains, mergedChains)
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

	nodeMap, err := cr.fbo.searchForNodes(ctx, nodeCache, ptrs, newPtrs,
		chains.mostRecentMD)
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
	mergedCreates := make(map[string]BlockPointer) // entry -> original
	for _, op := range mergedChain.ops {
		cop, ok := op.(*createOp)
		if !ok || cop.Type != Dir || len(cop.Refs()) == 0 || cop.renamed {
			continue
		}
		mergedCreates[cop.NewName] = cop.Refs()[0]
	}

	if len(mergedCreates) == 0 {
		return nil, nil
	}

	var newUnmergedPaths []path
	for _, op := range unmergedChain.ops {
		cop, ok := op.(*createOp)
		if !ok || cop.Type != Dir || len(cop.Refs()) == 0 || cop.renamed {
			continue
		}

		// Is there a corresponding merged create?
		mergedOriginal, ok := mergedCreates[cop.NewName]
		if !ok {
			continue
		}
		unmergedOriginal := cop.Refs()[0]

		cr.log.CDebugf(ctx, "Merging name %s in %v (unmerged original %v "+
			"changed to %v)", cop.NewName, unmergedChain.mostRecent,
			unmergedOriginal, mergedOriginal)
		// Change the original to match the merged original, so we can
		// check for conflicts later.  Note that the most recent will
		// stay the same, so we can still match the unmerged path
		// correctly.
		err := unmergedChains.changeOriginal(unmergedOriginal, mergedOriginal)
		if err != nil {
			return nil, err
		}

		unmergedChain, ok := unmergedChains.byOriginal[mergedOriginal]
		if !ok {
			return nil, fmt.Errorf("Change original (%v -> %v) didn't work",
				unmergedOriginal, mergedOriginal)
		}
		newPath := *unmergedPath.ChildPathNoPtr(cop.NewName)
		newPath.path[len(newPath.path)-1].BlockPointer =
			unmergedChain.mostRecent
		// recurse for this chain
		newPaths, err := cr.checkPathForMerge(ctx, unmergedChain, newPath,
			unmergedChains, mergedChains)
		if err != nil {
			return nil, err
		}
		// Add any further subdirectories that need merging under this
		// subdirectory.
		newUnmergedPaths = append(newUnmergedPaths, newPaths...)
		// Then add this create's path.
		newUnmergedPaths = append(newUnmergedPaths, newPath)
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
	unmergedPath path, unmergedChains *crChains,
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

		_, de, err :=
			cr.fbo.getEntry(ctx, unmergedChains.mostRecentMD, currPath)
		if err != nil {
			return path{}, BlockPointer{}, nil, err
		}
		co := newCreateOp(name, parentOriginal, de.Type)
		co.AddUpdate(parentOriginal, parentOriginal)
		co.setFinalPath(parentPath)
		co.AddRefBlock(currOriginal)
		recreateOps = append(recreateOps, co)
		currOriginal = parentOriginal
		currPath = parentPath
	}

	// Now we have the latest pointer along the path that is
	// shared between the branches.  Our next step is to find the
	// current merged path to the most recent version of that
	// original.  We can do that as follows:
	// * If the pointer has been changed in the merged branch, we
	//   can search for it later using fbo.searchForNodes
	// * If it hasn't been changed, check if it has been renamed to
	//   somewhere else.  If so, use fbo.searchForNodes on that parent later.
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
	unmergedPaths []path, unmergedChains *crChains, mergedChains *crChains) (
	map[BlockPointer]path, []*createOp, []path, error) {
	// maps each most recent unmerged pointer to the corresponding
	// most recent merged path.
	mergedPaths := make(map[BlockPointer]path)

	chainsToSearchFor := make(map[BlockPointer][]BlockPointer)
	var ptrs []BlockPointer

	// While we're at it, find any deleted unmerged chains containing
	// operations, where the corresponding merged chain has changed.
	// The unmerged ops will need to be re-applied in that case.
	var newUnmergedPaths []path
	for original, unmergedChain := range unmergedChains.byOriginal {
		if !unmergedChains.isDeleted(original) || len(unmergedChain.ops) == 0 {
			continue
		}
		mergedChain, ok := mergedChains.byOriginal[original]
		if !ok || len(mergedChain.ops) == 0 {
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
			ctx, p, unmergedChains, mergedChains)
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

		// Remember to fill in the corresponding mergedPath once we
		// get mostRecent's full path.
		chainsToSearchFor[mostRecent] =
			append(chainsToSearchFor[mostRecent], p.tailPointer())

		// At the end of this process, we are left with a merged path
		// that begins just after mostRecent.  We will fill this in
		// later with the searchFromNodes result.
		mergedPaths[p.tailPointer()] = mergedPath
	}

	// Now we can search for all the merged paths that need to be
	// updated due to unmerged operations.  Start with a clean node
	// cache for the merged branch.
	mergedNodeCache := newNodeCacheStandard(cr.fbo.folderBranch)
	// Initialize the root node.  There will always be at least one
	// unmerged path.
	mergedNodeCache.GetOrCreate(mergedChains.mostRecentMD.data.Dir.BlockPointer,
		unmergedPaths[0].path[0].Name, nil)

	newPtrs := make(map[BlockPointer]bool)
	for ptr := range mergedChains.byMostRecent {
		newPtrs[ptr] = true
	}
	for ptr := range chainsToSearchFor {
		ptrs = append(ptrs, ptr)
	}

	nodeMap, err := cr.fbo.searchForNodes(ctx, mergedNodeCache, ptrs, newPtrs,
		mergedChains.mostRecentMD)
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

func (cr *ConflictResolver) buildChainsAndPaths(ctx context.Context) (
	unmergedChains *crChains, mergedChains *crChains, unmergedPaths []path,
	mergedPaths map[BlockPointer]path, recreateOps []*createOp,
	unmerged []*RootMetadata, err error) {
	// Fetch the merged and unmerged MDs
	unmerged, merged, err := cr.getMDs(ctx)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	if u, m := len(unmerged), len(merged); u == 0 || m == 0 {
		cr.log.CDebugf(ctx, "Skipping merge process due to empty MD list: "+
			"%d unmerged, %d merged", u, m)
		return nil, nil, nil, nil, nil, nil, nil
	}

	// Update the current input to reflect the MDs we'll actually be
	// working with.
	err = cr.updateCurrInput(ctx, unmerged, merged)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	// Canceled before we start the heavy lifting?
	err = cr.checkDone(ctx)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	// Make the chains
	unmergedChains, mergedChains, err = cr.makeChains(ctx, unmerged, merged)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
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
		return nil, nil, nil, nil, nil, nil, err
	}

	// Add in any directory paths that were created in both branches.
	newUnmergedPaths, err := cr.findCreatedDirsToMerge(ctx, unmergedPaths,
		unmergedChains, mergedChains)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}
	unmergedPaths = append(unmergedPaths, newUnmergedPaths...)
	if len(newUnmergedPaths) > 0 {
		sort.Sort(crSortedPaths(unmergedPaths))
	}

	// Find the corresponding path in the merged branch for each of
	// these unmerged paths, and the set of any createOps needed to
	// apply these unmerged operations in the merged branch.
	mergedPaths, recreateOps, newUnmergedPaths, err =
		cr.resolveMergedPaths(ctx, unmergedPaths, unmergedChains, mergedChains)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}
	unmergedPaths = append(unmergedPaths, newUnmergedPaths...)
	if len(newUnmergedPaths) > 0 {
		sort.Sort(crSortedPaths(unmergedPaths))
	}

	return unmergedChains, mergedChains, unmergedPaths, mergedPaths,
		recreateOps, unmerged, nil
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
	uid, err := kbpki.GetCurrentUID(ctx)
	if err != nil {
		return nil, err
	}
	writerName, err := kbpki.GetNormalizedUsername(ctx, uid)
	if err != nil {
		return nil, err
	}

	var newUnmergedPaths []path
	for _, rop := range recreateOps {
		rop.setWriterName(writerName)

		// If rop.Dir.Unref is a merged most recent pointer, look up the
		// original.  Otherwise rop.Dir.Unref is the original.  Use the
		// original to look up the appropriate unmerged chain and stick
		// this op at the front.
		origTargetPtr := rop.Dir.Unref
		ptr, err := mergedChains.originalFromMostRecent(origTargetPtr)
		if err == nil {
			// A satisfactory chain was found.
			origTargetPtr = ptr
		} else if _, ok := err.(NoChainFoundError); !ok {
			// An unexpected error!
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

// fixRenameCycles checks every unmerged createOp associated with a
// rename to see if it will cause a cycle.  If so, it makes it a
// symlink create operation instead.
func (cr *ConflictResolver) fixRenameCycles(ctx context.Context,
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
	for ptr, info := range unmergedChains.renamedOriginals {
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
				return nil, fmt.Errorf("fixRenameCycles: couldn't find merged "+
					"path for %v", parent)
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
				return nil, fmt.Errorf("fixRenameCycles: couldn't find the "+
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
				return nil, fmt.Errorf("fixRenameCycles: couldn't find any "+
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
				return nil, fmt.Errorf("fixRenameCycles: no chain for "+
					"parent %v", parent)
			}

			found := false
		outer:
			for _, op := range chain.ops {
				switch cop := op.(type) {
				case *createOp:
					if !cop.renamed || cop.NewName != info.newName {
						continue
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
					cop.Type = Sym
					cop.crSymPath = symPath
					cr.log.CDebugf(ctx, "Creating symlink %s at "+
						"merged path %s", symPath, mergedPath)

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

					// invert the op in the merged chains
					invertCreate := newRmOp(info.newName,
						info.originalNewParent)
					invertRm := newCreateOp(info.oldName,
						info.originalOldParent, cop.Type)
					invertRm.renamed = true
					invertRm.AddRefBlock(ptr)

					mergedNewMostRecent := info.originalNewParent
					mrPtr, err := mergedChains.
						mostRecentFromOriginal(info.originalNewParent)
					if err == nil {
						// A satisfactory chain was found.
						mergedNewMostRecent = mrPtr
					} else if _, ok := err.(NoChainFoundError); !ok {
						// An unexpected error!
						return nil, err
					}
					mergedOldMostRecent := info.originalOldParent
					mrPtr, err = mergedChains.
						mostRecentFromOriginal(info.originalOldParent)
					if err == nil {
						// A satisfactory chain was found.
						mergedOldMostRecent = mrPtr
					} else if _, ok := err.(NoChainFoundError); !ok {
						// An unexpected error!
						return nil, err
					}
					prependOpsToChain(mergedOldMostRecent, mergedChains,
						invertRm)
					prependOpsToChain(mergedNewMostRecent, mergedChains,
						invertCreate)
					newInfo := renameInfo{
						originalOldParent: info.originalNewParent,
						oldName:           info.newName,
						originalNewParent: info.originalOldParent,
						newName:           info.oldName,
					}
					if newInfo2, ok := mergedChains.renamedOriginals[ptr]; ok {
						// move it from the existing location
						newInfo = newInfo2
						newInfo.originalOldParent = info.originalNewParent
						newInfo.oldName = info.newName
					}
					cr.log.CDebugf(ctx, "Putting new merged rename info "+
						"%v -> %v", ptr, newInfo)
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
				return nil, fmt.Errorf("fixRenameCycles: couldn't find "+
					"rename op corresponding to %v,%s in parent %v",
					ptr, info.newName, parent)
			}
			removeRenames = append(removeRenames, ptr)
		}
	}

	for _, ptr := range removeRenames {
		delete(unmergedChains.renamedOriginals, ptr)
	}

	return newUnmergedPaths, nil
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

		// First check for nodes that have been deleted in the unmerged
		// branch, but modified in the merged branch, and drop those
		// unmerged operations.
		for _, op := range unmergedChain.ops {
			ro, ok := op.(*rmOp)
			if !ok {
				continue
			}

			for _, ptr := range ro.Unrefs() {
				unrefOriginal := ptr
				if ptrChain, ok := unmergedChains.byMostRecent[ptr]; ok {
					unrefOriginal = ptrChain.original
				}

				if _, ok := mergedChains.byOriginal[unrefOriginal]; ok {
					ro.dropThis = true
				}
			}

			// Or perhaps the rm target has been renamed somewhere else.
			if len(ro.Unrefs()) == 0 {
				// TODO: Use mergedChains.renamedOriginals to look up
				// whether it has changed in the merged branch, and
				// potentially use symlinks to resolve the conflict if
				// necessary.
			}
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
// redundant actions.
func collapseActions(unmergedChains *crChains,
	mergedPaths map[BlockPointer]path,
	actionMap map[BlockPointer]crActionList) {
	for unmergedMostRecent, chain := range unmergedChains.byMostRecent {
		if !chain.isFile() {
			continue
		}

		// Find the parent directory path and combine
		p, ok := mergedPaths[unmergedMostRecent]
		if !ok {
			continue
		}

		fileActions, ok := actionMap[p.tailPointer()]
		if !ok {
			continue
		}

		parentPath := *p.parentPath()
		mergedParent := parentPath.tailPointer()
		parentActions := actionMap[mergedParent]
		combinedActions := append(parentActions, fileActions...)
		actionMap[mergedParent] = combinedActions
		mergedPaths[unmergedMostRecent] = parentPath
		delete(actionMap, p.tailPointer())
	}

	for ptr, actions := range actionMap {
		actionMap[ptr] = actions.collapse()
	}
}

func (cr *ConflictResolver) computeActions(ctx context.Context,
	unmergedChains *crChains, mergedChains *crChains,
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
	moreNewUnmergedPaths, err := cr.fixRenameCycles(ctx, unmergedChains,
		mergedChains, mergedPaths)
	if err != nil {
		return nil, nil, err
	}
	newUnmergedPaths = append(newUnmergedPaths, moreNewUnmergedPaths...)

	actionMap, err :=
		cr.getActionsToMerge(unmergedChains, mergedChains, mergedPaths)
	if err != nil {
		return nil, nil, err
	}

	// Finally, merged the file actions back into their parent
	// directory action list, and collapse everything together.
	collapseActions(unmergedChains, mergedPaths, actionMap)
	return actionMap, newUnmergedPaths, nil
}

func (cr *ConflictResolver) fetchDirBlockCopy(ctx context.Context,
	md *RootMetadata, dir path, lbc localBcache) (*DirBlock, error) {
	ptr := dir.tailPointer()
	// TODO: lock lbc if we parallelize
	if block, ok := lbc[ptr]; ok {
		return block, nil
	}
	block, err := cr.fbo.getBlockForReading(ctx, md, dir, NewDirBlock)
	if err != nil {
		return nil, err
	}
	dblock, ok := block.(*DirBlock)
	if !ok {
		return nil, NotDirError{dir}
	}
	dblock = dblock.DeepCopy()
	lbc[ptr] = dblock
	return dblock, nil
}

// fileBlockMap maps latest merged block pointer to a map of final
// merged name -> file block.
type fileBlockMap map[BlockPointer]map[string]*FileBlock

func (cr *ConflictResolver) makeFileBlockDeepCopy(ctx context.Context,
	md *RootMetadata, mergedMostRecent BlockPointer, parentPath path,
	name string, ptr BlockPointer, blocks fileBlockMap) (
	BlockPointer, error) {
	file := *parentPath.ChildPathNoPtr(name)
	file.path[len(file.path)-1].BlockPointer = ptr
	block, err := cr.fbo.getBlockForReading(ctx, md, file, NewFileBlock)
	if err != nil {
		return BlockPointer{}, err
	}
	fblock, ok := block.(*FileBlock)
	if !ok {
		return BlockPointer{}, NotFileError{file}
	}
	fblock = fblock.DeepCopy()
	newPtr := ptr
	uid, err := cr.config.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		return BlockPointer{}, err
	}
	if fblock.IsInd {
		newID, err := cr.config.Crypto().MakeTemporaryBlockID()
		if err != nil {
			return BlockPointer{}, err
		}
		newPtr = BlockPointer{
			ID:       newID,
			KeyGen:   md.LatestKeyGeneration(),
			DataVer:  cr.config.DataVersion(),
			Creator:  uid,
			RefNonce: zeroBlockRefNonce,
		}
	} else {
		newPtr.RefNonce, err = cr.config.Crypto().MakeBlockRefNonce()
		if err != nil {
			return BlockPointer{}, err
		}
		newPtr.SetWriter(uid)
	}

	if _, ok := blocks[mergedMostRecent]; !ok {
		blocks[mergedMostRecent] = make(map[string]*FileBlock)
	}

	// Dup all of the leaf blocks.
	// TODO: deal with multiple levels of indirection.
	if fblock.IsInd {
		for i, ptr := range fblock.IPtrs {
			// Generate a new nonce for each one.
			ptr.RefNonce, err = cr.config.Crypto().MakeBlockRefNonce()
			if err != nil {
				return BlockPointer{}, err
			}
			ptr.SetWriter(uid)
			fblock.IPtrs[i] = ptr
		}
	}

	blocks[mergedMostRecent][name] = fblock
	return newPtr, nil
}

func (cr *ConflictResolver) doActions(ctx context.Context,
	unmergedChains *crChains, mergedChains *crChains,
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
		unmergedBlock, err := cr.fetchDirBlockCopy(ctx,
			unmergedChains.mostRecentMD, unmergedPath, lbc)
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
			mergedBlock, err = cr.fetchDirBlockCopy(ctx,
				mergedChains.mostRecentMD, mergedPath, lbc)
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
				return cr.makeFileBlockDeepCopy(ctx,
					unmergedChains.mostRecentMD, mergedPath.tailPointer(),
					unmergedPath, name, ptr, newFileBlocks)
			}
			mergedFetcher := func(ctx context.Context, name string,
				ptr BlockPointer) (BlockPointer, error) {
				return cr.makeFileBlockDeepCopy(ctx, mergedChains.mostRecentMD,
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
						// Fetch the specified one (fake the full
						// path).  Don't need to make a copy since this
						// will just be a source block.
						dir := path{
							FolderBranch: mergedPath.FolderBranch,
							path:         []pathNode{{BlockPointer: newPtr}},
						}
						block, err := cr.fbo.getBlockForReading(ctx,
							mergedChains.mostRecentMD, dir, NewDirBlock)
						if err != nil {
							return err
						}
						dBlock, ok := block.(*DirBlock)
						if !ok {
							return NotDirError{dir}
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

// CRWrapError wraps an error that happens during conflict resolution.
type CRWrapError struct {
	err error
}

// String implements the Stringer interface for CRWrapError.
func (e CRWrapError) String() string {
	return "Conflict resolution error: " + e.err.Error()
}

func (cr *ConflictResolver) doResolve(ctx context.Context, ci conflictInput) {
	cr.log.CDebugf(ctx, "Starting conflict resolution with input %v", ci)
	var err error
	defer cr.inputGroup.Done()
	defer func() {
		cr.log.CDebugf(ctx, "Finished conflict resolution: %v", err)
		if err != nil {
			cr.config.Reporter().Report(RptE, CRWrapError{err})
		}
	}()

	// Canceled before we even got started?
	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

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
		_, err := cr.buildChainsAndPaths(ctx)
	if err != nil {
		return
	}
	if unmergedChains == nil || len(mergedPaths) == 0 {
		// nothing to do
		cr.log.CDebugf(ctx, "No updates to resolve")
		return
	}

	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	if status, _, err := cr.fbo.status.getStatus(ctx); err == nil {
		if statusString, err := json.Marshal(status); err == nil {
			cr.log.CInfof(ctx, "Current status during conflict resolution "+
				"(input %v): %s", cr.currInput, statusString)
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
		mergedChains, mergedPaths, recOps)
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
	err = cr.doActions(ctx, unmergedChains, mergedChains, unmergedPaths,
		mergedPaths, actionMap, lbc, newFileBlocks)
	if err != nil {
		return
	}

	err = cr.checkDone(ctx)
	if err != nil {
		return
	}
	cr.log.CDebugf(ctx, "Executed all actions, %d updated directory blocks",
		len(lbc))
}
