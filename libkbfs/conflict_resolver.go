package libkbfs

import (
	"fmt"
	"sort"
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

func (cr *ConflictResolver) getUnmergedPaths(ctx context.Context,
	unmergedChains *crChains, mostRecentUnmergedMD *RootMetadata) (
	[]path, error) {
	newPtrs := make(map[BlockPointer]bool)
	var ptrs []BlockPointer
	for ptr, chain := range unmergedChains.byMostRecent {
		newPtrs[ptr] = true
		// We only care about the paths for ptrs that are directly
		// affected by operations and were live through the entire
		// unmerged branch.
		if len(chain.ops) > 0 && !unmergedChains.isCreated(chain.original) &&
			!unmergedChains.isDeleted(chain.original) {
			ptrs = append(ptrs, ptr)
		}
	}

	nodeMap, err := cr.fbo.searchForNodes(ctx, cr.fbo.nodeCache, ptrs, newPtrs,
		mostRecentUnmergedMD)
	if err != nil {
		return nil, err
	}

	paths := make([]path, 0, len(nodeMap))
	for ptr, n := range nodeMap {
		if n == nil {
			cr.log.CDebugf(ctx, "Ignoring pointer with no found path: %v", ptr)
			unmergedChains.removeChain(ptr)
			continue
		}

		p := cr.fbo.nodeCache.PathFromNode(n)
		if p.tailPointer() != ptr {
			return nil, NodeNotFoundError{ptr}
		}
		paths = append(paths, p)

		// update the unmerged final paths
		chain, ok := unmergedChains.byMostRecent[ptr]
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
		currPath = *currPath.parentPath()
		currOriginal, err =
			unmergedChains.originalFromMostRecent(currPath.tailPointer())
		if err != nil {
			cr.log.CDebugf(ctx, "Couldn't find original pointer for %v",
				currPath.tailPointer())
			return path{}, BlockPointer{}, nil, err
		}

		recreateOps = append(recreateOps, newCreateOp(name, currOriginal,
			File /*placeholder type, will look up actual type later*/))
	}
	if len(recreateOps) > 0 {
		// The final recreateOp (the one closest to the root) can
		// actually use the most recent merged pointer, since we know
		// the parent directory exists.
		lastCreateOriginal := recreateOps[len(recreateOps)-1].Dir.Unref
		mergedMostRecent, err :=
			mergedChains.mostRecentFromOriginal(lastCreateOriginal)
		if err != nil {
			// This directory wasn't touched on the merged branch
			mergedMostRecent = lastCreateOriginal
		}
		recreateOps[len(recreateOps)-1].Dir.Unref = mergedMostRecent
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
func (cr *ConflictResolver) resolveMergedPaths(ctx context.Context,
	unmergedPaths []path, unmergedChains *crChains, mergedChains *crChains,
	mostRecentMergedMD *RootMetadata) (
	map[BlockPointer]path, []*createOp, error) {
	// maps each most recent unmerged pointer to the corresponding
	// most recent merged path.
	mergedPaths := make(map[BlockPointer]path)

	if len(unmergedPaths) == 0 {
		return mergedPaths, nil, nil
	}

	// For each unmerged path, find the corresponding most recent
	// pointer in the merged path.  Track which entries need to be
	// re-created.
	var recreateOps []*createOp
	createsSeen := make(map[createMapKey]bool)
	// maps a merged most recent pointer to the set of unmerged most
	// recent pointers that need some of their path filled in.
	chainsToSearchFor := make(map[BlockPointer][]BlockPointer)
	for _, p := range unmergedPaths {
		mergedPath, mostRecent, ops, err := cr.resolveMergedPathTail(
			ctx, p, unmergedChains, mergedChains)
		if err != nil {
			return nil, nil, err
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
	mergedNodeCache.GetOrCreate(mostRecentMergedMD.data.Dir.BlockPointer,
		unmergedPaths[0].path[0].Name, nil)

	newPtrs := make(map[BlockPointer]bool)
	for ptr := range mergedChains.byMostRecent {
		newPtrs[ptr] = true
	}
	ptrs := make([]BlockPointer, 0, len(chainsToSearchFor))
	for ptr := range chainsToSearchFor {
		ptrs = append(ptrs, ptr)
	}

	nodeMap, err := cr.fbo.searchForNodes(ctx, mergedNodeCache, ptrs, newPtrs,
		mostRecentMergedMD)
	if err != nil {
		return nil, nil, err
	}

	for ptr, n := range nodeMap {
		if n == nil {
			// All the pointers we're looking for should definitely be
			// findable in the merged branch somewhere.
			return nil, nil, NodeNotFoundError{ptr}
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

	return mergedPaths, recreateOps, nil
}

func (cr *ConflictResolver) buildChainsAndPaths(ctx context.Context) (
	unmergedChains *crChains, mergedChains *crChains, unmergedPaths []path,
	mergedPaths map[BlockPointer]path, recreateOps []*createOp, err error) {
	// Fetch the merged and unmerged MDs
	unmerged, merged, err := cr.getMDs(ctx)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	if u, m := len(unmerged), len(merged); u == 0 || m == 0 {
		cr.log.CDebugf(ctx, "Skipping merge process due to empty MD list: "+
			"%d unmerged, %d merged", u, m)
		return nil, nil, nil, nil, nil, nil
	}

	// Update the current input to reflect the MDs we'll actually be
	// working with.
	err = cr.updateCurrInput(ctx, unmerged, merged)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	// Canceled before we start the heavy lifting?
	err = cr.checkDone(ctx)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	// Make the chains
	unmergedChains, mergedChains, err = cr.makeChains(ctx, unmerged, merged)
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	// TODO: if the root node didn't change in either chain, we can
	// short circuit the rest of the process with a really easy
	// merge...

	// Get the full path for every most recent unmerged pointer with a
	// chain of unmerged operations, and which was not created or
	// deleted within in the unmerged branch.
	unmergedPaths, err = cr.getUnmergedPaths(ctx, unmergedChains,
		unmerged[len(unmerged)-1])
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	// Find the corresponding path in the merged branch for each of
	// these unmerged paths, and the set of any createOps needed to
	// apply these unmerged operations in the merged branch.
	mergedPaths, recreateOps, err =
		cr.resolveMergedPaths(ctx, unmergedPaths, unmergedChains,
			mergedChains, merged[len(merged)-1])
	if err != nil {
		return nil, nil, nil, nil, nil, err
	}

	return unmergedChains, mergedChains, unmergedPaths, mergedPaths,
		recreateOps, nil
}

// addRecreateOpsToUnmergedChains inserts each recreateOp, into its
// appropriate unmerged chain, creating one if it doesn't exist yet.
// It also adds entries as necessary to mergedPaths.
func (cr *ConflictResolver) addRecreateOpsToUnmergedChains(ctx context.Context,
	recreateOps []*createOp, unmergedChains *crChains, mergedChains *crChains,
	mergedPaths map[BlockPointer]path) error {
	if len(recreateOps) == 0 {
		return nil
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
		return err
	}
	writerName, err := kbpki.GetNormalizedUsername(ctx, uid)
	if err != nil {
		return err
	}

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
			return err
		}

		chain, ok := unmergedChains.byOriginal[origTargetPtr]
		if ok {
			chain.ops = append([]op{rop}, chain.ops...)
		} else {
			oldUnref := rop.Dir.Unref
			rop.Dir.Unref = origTargetPtr
			rop.Dir.Ref = rop.Dir.Unref // so that most recent == original
			err := unmergedChains.makeChainForOp(rop)
			if err != nil {
				return err
			}
			rop.Dir.Unref = oldUnref
			rop.Dir.Ref = BlockPointer{}
			chain = unmergedChains.byOriginal[origTargetPtr]
		}

		// Look up the corresponding unmerged most recent pointer, and
		// check whether there's a merged path for it yet.  If not,
		// create one by looking it up in the lookup table (created
		// above) and taking the appropriate subpath.
		mergedPath, ok := mergedPaths[chain.mostRecent]
		if !ok {
			key, ok := keys[rop.Dir.Unref]
			if !ok {
				return fmt.Errorf("Couldn't find a merged path containing the "+
					"target of a recreate op: %v", rop.Dir.Unref)
			}
			currPath := mergedPaths[key]
			for currPath.tailPointer() != rop.Dir.Unref &&
				currPath.hasValidParent() {
				currPath = *currPath.parentPath()
			}
			mergedPath = currPath
			mergedPaths[chain.mostRecent] = currPath
		}
		rop.setFinalPath(mergedPath)
	}
	return nil
}

// fixRenameCycles checks every unmerged createOp associated with a
// rename to see if it will cause a cycle.  If so, it makes it a
// symlink create operation instead.
func (cr *ConflictResolver) fixRenameCycles(unmergedChains *crChains,
	mergedChains *crChains, mergedPaths map[BlockPointer]path) error {
	// For every renamed block pointer in the unmerged chains:
	//   * Check if any BlockPointer in its merged path contains a relative of
	//     itself
	//   * If so, replace the corresponding unmerged create operation with a
	//     symlink creation to the new merged path instead.
	// So, if in the merged branch someone did `mv b/ a/` and in the unmerged
	// branch someone did `mv a/ b/`, the conflict resolution would end up with
	// `a/b/a` where the second a is a symlink to "../../".
	for ptr, info := range unmergedChains.renamedOriginals {
		// The merged path is keyed by the most recent unmerged tail
		// pointer.
		parent, err :=
			unmergedChains.mostRecentFromOriginal(info.originalNewParent)
		if err != nil {
			return err
		}

		mergedPath, ok := mergedPaths[parent]
		if !ok {
			// There should definitely be a merged path for this
			// parent, since it has a create operation.
			return fmt.Errorf("fixRenameCycles: couldn't find merged path "+
				"for %v", parent)
		}

		for i, pn := range mergedPath.path {
			original, err :=
				mergedChains.originalFromMostRecent(pn.BlockPointer)
			if err != nil {
				// This node wasn't changed in the merged branch
				original = pn.BlockPointer
			}
			// If any node on this path matches the renamed pointer,
			// we have a cycle.
			if original == ptr {
				chain, ok := unmergedChains.byMostRecent[parent]
				if !ok {
					return fmt.Errorf("fixRenameCycles: no chain for parent %v",
						parent)
				}

				found := false
				for _, op := range chain.ops {
					switch cop := op.(type) {
					case *createOp:
						if !cop.renamed || cop.NewName != info.newName {
							continue
						}

						// Mark this as a symlink, and the resolver
						// will take care of making it a symlink in
						// the merged branch later. No need to copy
						// since this createOp must have been created
						// as part of conflict resolution.
						cop.Type = Sym
						symPath := "./"
						for j := len(mergedPath.path); j > i; j-- {
							symPath += "../"
						}
						cop.crSymPath = symPath

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
						break
					}
				}
				if !found {
					return fmt.Errorf("fixRenameCycles: couldn't find rename "+
						"op corresponding to %v,%s in parent %v",
						ptr, info.newName, parent)
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
	map[BlockPointer][]crAction, error) {
	actionMap := make(map[BlockPointer][]crAction)
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

		// Now check for nodes that have been deleted in the unmerged
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
					// This operation removes a node that was modified
					// in the merged branch, so we have to drop it.
					actions = append(actions, &dropUnmergedAction{op: ro})
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

		if len(actions) > 0 {
			actionMap[mergedPath.tailPointer()] = actions
		}
	}

	return actionMap, nil
}

func (cr *ConflictResolver) computeActions(ctx context.Context,
	unmergedChains *crChains, mergedChains *crChains,
	mergedPaths map[BlockPointer]path, recreateOps []*createOp) (
	map[BlockPointer][]crAction, error) {
	// Process all the recreateOps, adding them to the appropriate
	// unmerged chains.
	err := cr.addRecreateOpsToUnmergedChains(ctx, recreateOps, unmergedChains,
		mergedChains, mergedPaths)
	if err != nil {
		return nil, err
	}

	// Fix any rename cycles by turning the corresponding unmerged
	// createOp into a symlink entry type.
	err = cr.fixRenameCycles(unmergedChains, mergedChains, mergedPaths)
	if err != nil {
		return nil, err
	}

	actionMap, err :=
		cr.getActionsToMerge(unmergedChains, mergedChains, mergedPaths)
	if err != nil {
		return nil, err
	}

	return actionMap, nil
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

	// Step 1: Build the chains for each branch, as well as the paths
	// and necessary extra recreate ops.  The result of this step is:
	//   * A set of conflict resolution "chains" for both the unmerged and
	//     merged branches
	//   * A map containing, for each changed unmerged node, the full path to
	//     the corresponding merged node.
	//   * A set of "recreate" ops that must be applied on the merged branch
	//     to recreate any directories that were modified in the unmerged
	//     branch but removed in the merged branch.
	unmergedChains, mergedChains, _, mergedPaths, recreateOps, err :=
		cr.buildChainsAndPaths(ctx)
	if err != nil {
		return
	}
	if unmergedChains == nil {
		// nothing to do
		return
	}

	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	// Step 2: Figure out which actions need to be taken in the merged
	// branch to best reflect the unmerged changes.  The result of
	// this step is a map containing, for each node in the merged path
	// that will be updated during conflict resolution, a set of
	// "actions" to be applied to the merged branch.  Each of these
	// actions contains the logic needed to manipulate the data into
	// the final merged state, including the resolution of any
	// conflicts that occurred between the two branches.
	_, err = cr.computeActions(ctx, unmergedChains, mergedChains,
		mergedPaths, recreateOps)
	if err != nil {
		return
	}

	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	// TODO:
	// * Apply the actions by looking up the corresponding unmerged dir
	//   entry and copying it to a copy of the corresponding merged block.
	//   Keep these dirty block copies in a local dirty cache, keyed by
	//   corresponding merged most recent pointer.
	// * At the same time, construct two sets of ops: one that will be put
	//   into the final MD object that gets merged, and one that needs to be
	//   played through as notifications locally to get any local caches
	//   synchronized with the final merged state.
	//   * This will be taken care of by each crAction.do() method, which
	//     modifies the unmerged and merged ops for a particular chain.  After
	//     all the crActions are applied, the "unmerged" ops need to be pushed
	//     as part of the MD update, while the "merged" ops need to be applied
	//     locally.
	// * Once all the new blocks are ready, calculate the resolvedChain paths
	//   and arrange them into a tree.  Do a recursive descent and
	//   syncBlockLocked each branch (filling in the new BlockChanges in a
	//   new MD object)
	// * Finally attempt to put the final MD object.  If successful, send
	//   out all the notifyOps to observers.
	// Release all locks and reset the currInput, we're done!
}
