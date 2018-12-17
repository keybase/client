// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// crChain represents the set of operations that happened to a
// particular KBFS node (e.g., individual file or directory) over a
// given set of MD updates.  It also tracks the starting and ending
// block pointers for the node.
type crChain struct {
	ops                  []op
	original, mostRecent BlockPointer
	file                 bool
}

// collapse finds complementary pairs of operations that cancel each
// other out, and remove the relevant operations from the chain.
// Examples include:
//  * A create followed by a remove for the same name (delete both ops)
//  * A create followed by a create (renamed == true) for the same name
//    (delete the create op)
//  * A remove that only unreferences blocks created within this branch
// This function returns the list of pointers that should be unreferenced
// as part of an eventual resolution of the corresponding branch.
func (cc *crChain) collapse(createdOriginals map[BlockPointer]bool,
	originals map[BlockPointer]BlockPointer) (toUnrefs []BlockPointer) {
	createsSeen := make(map[string]int)
	indicesToRemove := make(map[int]bool)
	var wr []WriteRange
	lastSyncOp := -1
	var syncRefs, syncUnrefs []BlockPointer
	for i, op := range cc.ops {
		switch realOp := op.(type) {
		case *createOp:
			if prevCreateIndex, ok :=
				createsSeen[realOp.NewName]; realOp.renamed && ok {
				// A rename has papered over the first create, so
				// just drop it.
				indicesToRemove[prevCreateIndex] = true
			}
			createsSeen[realOp.NewName] = i
		case *rmOp:
			if prevCreateIndex, ok := createsSeen[realOp.OldName]; ok {
				delete(createsSeen, realOp.OldName)
				// The rm cancels out the create, so remove it.
				indicesToRemove[prevCreateIndex] = true
				// Also remove the rmOp if it was part of a rename
				// (i.e., it wasn't a "real" rm), or if it otherwise
				// only unreferenced blocks that were created on this
				// branch.
				doRemove := true
				for _, unref := range op.Unrefs() {
					original, ok := originals[unref]
					if !ok {
						original = unref
					}
					if !createdOriginals[original] {
						doRemove = false
						break
					}
				}
				if doRemove {
					indicesToRemove[i] = true
					toUnrefs = append(toUnrefs, op.Unrefs()...)
				}
			}
		case *setAttrOp:
			// TODO: Collapse opposite setex pairs
		case *syncOp:
			wr = realOp.collapseWriteRange(wr)
			indicesToRemove[i] = true
			lastSyncOp = i
			// The last op will have its refs listed twice in the
			// collapsed op, but that's harmless.
			syncRefs = append(syncRefs, op.Refs()...)
			// The last op will have its unrefs listed twice in the
			// collapsed op, but that's harmless.
			syncUnrefs = append(syncUnrefs, op.Unrefs()...)
		default:
			// ignore other op types
		}
	}

	if len(indicesToRemove) > 0 {
		ops := make([]op, 0, len(cc.ops)-len(indicesToRemove))
		for i, op := range cc.ops {
			if i == lastSyncOp {
				so, ok := op.(*syncOp)
				if !ok {
					panic(fmt.Sprintf(
						"Op %s at index %d should have been a syncOp", op, i))
				}
				so.Writes = wr
				for _, ref := range syncRefs {
					op.AddRefBlock(ref)
				}
				for _, unref := range syncUnrefs {
					op.AddUnrefBlock(unref)
				}
				ops = append(ops, op)
			} else if !indicesToRemove[i] {
				ops = append(ops, op)
			}
		}
		cc.ops = ops
	}
	return toUnrefs
}

func (cc *crChain) getCollapsedWriteRange() []WriteRange {
	if !cc.isFile() {
		return nil
	}
	var wr []WriteRange
	for _, op := range cc.ops {
		syncOp, ok := op.(*syncOp)
		if !ok {
			continue
		}
		wr = syncOp.collapseWriteRange(wr)
	}
	return wr
}

func writeRangesEquivalent(
	wr1 []WriteRange, wr2 []WriteRange) bool {
	// Both empty?
	if len(wr1) == 0 && len(wr2) == 0 {
		return true
	}

	// If both branches contain no writes, and their truncation
	// points are the same, then there are no unmerged actions to
	// take.
	if len(wr1) == 1 && wr1[0].isTruncate() &&
		len(wr2) == 1 && wr2[0].isTruncate() &&
		wr1[0].Off == wr2[0].Off {
		return true
	}

	// TODO: In the future we may be able to do smarter merging
	// here if the write ranges don't overlap, though maybe only
	// for certain file types?
	return false
}

func (cc *crChain) removeSyncOps() {
	var newOps []op
	for _, op := range cc.ops {
		if _, ok := op.(*syncOp); !ok {
			newOps = append(newOps, op)
		}
	}

	cc.ops = newOps
}

func (cc *crChain) getActionsToMerge(
	ctx context.Context, renamer ConflictRenamer, mergedPath path,
	mergedChain *crChain) (crActionList, error) {
	var actions crActionList

	// If this is a file, determine whether the unmerged chain
	// could actually have changed the file in some way that it
	// hasn't already been changed.  For example, if they both
	// truncate the file to the same length, and there are no
	// other writes, we can just drop the unmerged syncs.
	if cc.isFile() && mergedChain != nil {
		// The write ranges should already be collapsed into a single
		// syncOp, these calls just find that one remaining syncOp.
		myWriteRange := cc.getCollapsedWriteRange()
		mergedWriteRange := mergedChain.getCollapsedWriteRange()

		if writeRangesEquivalent(myWriteRange, mergedWriteRange) {
			// drop all sync ops
			cc.removeSyncOps()
		}
	}

	// Check each op against all ops in the corresponding merged
	// chain, looking for conflicts.  If there is a conflict, return
	// it as part of the action list.  If there are no conflicts for
	// that op, return the op's default actions.
	for _, unmergedOp := range cc.ops {
		conflict := false
		if mergedChain != nil {
			for _, mergedOp := range mergedChain.ops {
				action, err :=
					unmergedOp.checkConflict(
						ctx, renamer, mergedOp, cc.isFile())
				if err != nil {
					return nil, err
				}
				if action != nil {
					conflict = true
					actions = append(actions, action)
				}
			}
		}
		// no conflicts!
		if !conflict {
			action := unmergedOp.getDefaultAction(mergedPath)
			if action != nil {
				actions = append(actions, action)
			}
		}
	}

	return actions, nil
}

func (cc *crChain) isFile() bool {
	return cc.file
}

// identifyType figures out whether this chain represents a file or
// directory.  It tries to figure it out based purely on operation
// state, but setAttr(mtime) can apply to either type; in that case,
// we need to fetch the block to figure out the type.
func (cc *crChain) identifyType(ctx context.Context, fbo *folderBlockOps,
	kmd KeyMetadata, chains *crChains) error {
	if len(cc.ops) == 0 {
		return nil
	}

	// If any op is setAttr (ex or size) or sync, this is a file
	// chain.  If it only has a setAttr/mtime, we don't know what it
	// is, so fall through and fetch the block unless we come across
	// another op that can determine the type.
	var parentDir BlockPointer
	for _, op := range cc.ops {
		switch realOp := op.(type) {
		case *syncOp:
			cc.file = true
			return nil
		case *setAttrOp:
			if realOp.Attr != mtimeAttr {
				cc.file = true
				return nil
			}
			// We can't tell the file type from an mtimeAttr, so we
			// may have to actually fetch the block to figure it out.
			parentDir = realOp.Dir.Ref
		default:
			return nil
		}
	}

	parentOriginal, ok := chains.originals[parentDir]
	if !ok {
		// If the parent dir was created as part of a squash/batch,
		// there might not be any update for it, and so it might not
		// appear in the `originals` map.  In that case, we can use
		// the original.
		parentOriginal = parentDir
		ok = chains.createdOriginals[parentDir]
	}
	if !ok {
		if chains.isDeleted(parentDir) {
			// If the parent's been deleted, it doesn't matter whether
			// we find the type or not.
			return nil
		}
		return errors.WithStack(NoChainFoundError{parentDir})
	}

	// We have to find the current parent directory block.  If the
	// file has been renamed, that might be different from parentDir
	// above.
	if newParent, _, ok := chains.renamedParentAndName(cc.original); ok {
		parentOriginal = newParent
	}

	parentMostRecent, err := chains.mostRecentFromOriginalOrSame(parentOriginal)
	if err != nil {
		return err
	}

	// If we get down here, we have an ambiguity, and need to fetch
	// the block to figure out the file type.
	parentPath := path{
		FolderBranch: fbo.folderBranch,
		path:         []pathNode{{parentMostRecent, ""}},
	}
	parentDD, cleanupFn := fbo.newDirDataWithLBC(
		makeFBOLockState(), parentPath, keybase1.UserOrTeamID(""), kmd, nil)
	defer cleanupFn()
	entries, err := parentDD.getEntries(ctx)
	if err != nil {
		return err
	}
	// We don't have the file name handy, so search for the pointer.
	found := false
	for _, entry := range entries {
		if entry.BlockPointer != cc.mostRecent {
			continue
		}
		switch entry.Type {
		case Dir:
			cc.file = false
		case File:
			cc.file = true
		case Exec:
			cc.file = true
		default:
			return errors.Errorf("Unexpected chain type: %s", entry.Type)
		}
		found = true
		break
	}

	if !found {
		// If the node can't be found, then the entry has been removed
		// already, and there won't be any conflicts to resolve
		// anyway.  Mark it as deleted and return gracefully.
		chains.deletedOriginals[cc.original] = true
	}
	return nil
}

func (cc *crChain) remove(ctx context.Context, log logger.Logger,
	revision kbfsmd.Revision) bool {
	anyRemoved := false
	var newOps []op
	for i, currOp := range cc.ops {
		info := currOp.getWriterInfo()
		if info.revision == revision {
			log.CDebugf(ctx, "Removing op %s from chain with mostRecent=%v",
				currOp, cc.mostRecent)
			if !anyRemoved {
				newOps = make([]op, i, len(cc.ops)-1)
				// Copy everything we've iterated over so far.
				copy(newOps[:i], cc.ops[:i])
				anyRemoved = true
			}
		} else if anyRemoved {
			newOps = append(newOps, currOp)
		}
	}
	if anyRemoved {
		cc.ops = newOps
	}
	return anyRemoved
}

func (cc *crChain) hasSyncOp() bool {
	for _, op := range cc.ops {
		if _, ok := op.(*syncOp); ok {
			return true
		}
	}
	return false
}

func (cc *crChain) hasSetAttrOp() bool {
	for _, op := range cc.ops {
		if _, ok := op.(*setAttrOp); ok {
			return true
		}
	}
	return false
}

type renameInfo struct {
	originalOldParent BlockPointer
	oldName           string
	originalNewParent BlockPointer
	newName           string
}

func (ri renameInfo) String() string {
	return fmt.Sprintf(
		"renameInfo{originalOldParent: %s, oldName: %s, originalNewParent: %s, newName: %s}",
		ri.originalOldParent, ri.oldName,
		ri.originalNewParent, ri.newName)
}

// crChains contains a crChain for every KBFS node affected by the
// operations over a given set of MD updates.  The chains are indexed
// by both the starting (original) and ending (most recent) pointers.
// It also keeps track of which chain points to the root of the folder.
type crChains struct {
	byOriginal   map[BlockPointer]*crChain
	byMostRecent map[BlockPointer]*crChain
	originalRoot BlockPointer

	// The original blockpointers for nodes that have been
	// unreferenced or initially referenced during this chain.
	deletedOriginals map[BlockPointer]bool
	createdOriginals map[BlockPointer]bool

	// A map from original blockpointer to the full rename operation
	// of the node (from the original location of the node to the
	// final locations).
	renamedOriginals map[BlockPointer]renameInfo

	// Separately track pointers for unembedded block changes.
	blockChangePointers map[BlockPointer]bool

	// Pointers that should be explicitly cleaned up in the resolution.
	toUnrefPointers map[BlockPointer]bool

	// Pointers that should explicitly *not* be cleaned up in the
	// resolution.
	doNotUnrefPointers map[BlockPointer]bool

	// Also keep the info for the most recent chain MD used to
	// build these chains.
	mostRecentChainMDInfo KeyMetadataWithRootDirEntry

	// We need to be able to track ANY BlockPointer, at any point in
	// the chain, back to its original.
	originals map[BlockPointer]BlockPointer

	// All the resolution ops from the branch, in order.
	resOps []*resolutionOp
}

func (ccs *crChains) addOp(ptr BlockPointer, op op) error {
	currChain, ok := ccs.byMostRecent[ptr]
	if !ok {
		return errors.Errorf("Could not find chain for most recent ptr %v", ptr)
	}

	currChain.ops = append(currChain.ops, op)
	return nil
}

// addNoopChain adds a new chain with no ops to the chains struct, if
// that pointer isn't involved in any chains yet.
func (ccs *crChains) addNoopChain(ptr BlockPointer) {
	if _, ok := ccs.byMostRecent[ptr]; ok {
		return
	}
	if _, ok := ccs.byOriginal[ptr]; ok {
		return
	}
	if _, ok := ccs.originals[ptr]; ok {
		return
	}
	chain := &crChain{original: ptr, mostRecent: ptr}
	ccs.byOriginal[ptr] = chain
	ccs.byMostRecent[ptr] = chain
}

func (ccs *crChains) makeChainForOp(op op) error {
	// Ignore gc ops -- their unref semantics differ from the other
	// ops.  Note that this only matters for old gcOps: new gcOps
	// only unref the block ID, and not the whole pointer, so they
	// wouldn't confuse chain creation.
	if _, isGCOp := op.(*GCOp); isGCOp {
		return nil
	}

	// First set the pointers for all updates, and track what's been
	// created and destroyed.
	for _, update := range op.allUpdates() {
		chain, ok := ccs.byMostRecent[update.Unref]
		if !ok {
			// No matching chain means it's time to start a new chain
			chain = &crChain{original: update.Unref}
			ccs.byOriginal[update.Unref] = chain
		}
		if chain.mostRecent.IsInitialized() {
			// delete the old most recent pointer, it's no longer needed
			delete(ccs.byMostRecent, chain.mostRecent)
		}
		chain.mostRecent = update.Ref
		ccs.byMostRecent[update.Ref] = chain
		if chain.original != update.Ref {
			// Always be able to track this one back to its original.
			ccs.originals[update.Ref] = chain.original
		}
	}

	for _, ptr := range op.Refs() {
		ccs.createdOriginals[ptr] = true
	}

	for _, ptr := range op.Unrefs() {
		// Look up the original pointer corresponding to this most
		// recent one.
		original, ok := ccs.originals[ptr]
		if !ok {
			original = ptr
		}

		// If it has already been updated to something else, we should
		// just ignore this unref.  See KBFS-3258.
		if chain, ok := ccs.byOriginal[original]; ok {
			if ptr != chain.mostRecent {
				continue
			}
		}

		ccs.deletedOriginals[original] = true
	}

	// then set the op depending on the actual op type
	switch realOp := op.(type) {
	default:
		panic(fmt.Sprintf("Unrecognized operation: %v", op))
	case *createOp:
		err := ccs.addOp(realOp.Dir.Ref, op)
		if err != nil {
			return err
		}
	case *rmOp:
		err := ccs.addOp(realOp.Dir.Ref, op)
		if err != nil {
			return err
		}

		if len(op.Unrefs()) == 0 {
			// This might be an rmOp of a file that was created and
			// removed within a single batch.  If it's been renamed,
			// we should also mark it as deleted to avoid confusing
			// the CR code.
			chain, ok := ccs.byMostRecent[realOp.Dir.Ref]
			if !ok {
				return errors.Errorf("No chain for rmOp dir %v", realOp.Dir.Ref)
			}
			for original, ri := range ccs.renamedOriginals {
				if ri.originalNewParent == chain.original &&
					ri.newName == realOp.OldName {
					ccs.deletedOriginals[original] = true
					break
				}
			}
		}

	case *renameOp:
		// split rename op into two separate operations, one for
		// remove and one for create
		ro, err := newRmOp(
			realOp.OldName, realOp.OldDir.Unref, realOp.RenamedType)
		if err != nil {
			return err
		}
		ro.setWriterInfo(realOp.getWriterInfo())
		ro.setLocalTimestamp(realOp.getLocalTimestamp())
		// realOp.OldDir.Ref may be zero if this is a
		// post-resolution chain, so set ro.Dir.Ref manually.
		ro.Dir.Ref = realOp.OldDir.Ref
		err = ccs.addOp(realOp.OldDir.Ref, ro)
		if err != nil {
			return err
		}

		ndu := realOp.NewDir.Unref
		ndr := realOp.NewDir.Ref
		if realOp.NewDir == (blockUpdate{}) {
			// this is a rename within the same directory
			ndu = realOp.OldDir.Unref
			ndr = realOp.OldDir.Ref
		}

		if len(realOp.Unrefs()) > 0 {
			// Something was overwritten; make an explicit rm for it
			// so we can check for conflicts.
			roOverwrite, err := newRmOp(realOp.NewName, ndu,
				// We don't know the real type, but this op is only
				// used locally so it doesn't matter.
				File)
			if err != nil {
				return err
			}
			roOverwrite.setWriterInfo(realOp.getWriterInfo())
			err = roOverwrite.Dir.setRef(ndr)
			if err != nil {
				return err
			}
			err = ccs.addOp(ndr, roOverwrite)
			if err != nil {
				return err
			}
			// Transfer any unrefs over.
			for _, ptr := range realOp.Unrefs() {
				roOverwrite.AddUnrefBlock(ptr)
			}
		}

		co, err := newCreateOp(realOp.NewName, ndu, realOp.RenamedType)
		if err != nil {
			return err
		}
		co.setWriterInfo(realOp.getWriterInfo())
		co.setLocalTimestamp(realOp.getLocalTimestamp())
		co.renamed = true
		// ndr may be zero if this is a post-resolution chain,
		// so set co.Dir.Ref manually.
		co.Dir.Ref = ndr
		err = ccs.addOp(ndr, co)
		if err != nil {
			return err
		}

		// also keep track of the new parent for the renamed node
		if realOp.Renamed.IsInitialized() {
			newParentChain, ok := ccs.byMostRecent[ndr]
			if !ok {
				return errors.Errorf("While renaming, couldn't find the chain "+
					"for the new parent %v", ndr)
			}
			oldParentChain, ok := ccs.byMostRecent[realOp.OldDir.Ref]
			if !ok {
				return errors.Errorf("While renaming, couldn't find the chain "+
					"for the old parent %v", ndr)
			}

			renamedOriginal := realOp.Renamed
			if renamedChain, ok := ccs.byMostRecent[realOp.Renamed]; ok {
				renamedOriginal = renamedChain.original
			}
			// Use the previous old info if there is one already,
			// in case this node has been renamed multiple times.
			ri, ok := ccs.renamedOriginals[renamedOriginal]
			if !ok {
				// Otherwise make a new one.
				ri = renameInfo{
					originalOldParent: oldParentChain.original,
					oldName:           realOp.OldName,
				}
			}
			ri.originalNewParent = newParentChain.original
			ri.newName = realOp.NewName
			ccs.renamedOriginals[renamedOriginal] = ri
			// Remember what you create, in case we need to merge
			// directories after a rename.
			co.AddRefBlock(renamedOriginal)
		}
	case *syncOp:
		err := ccs.addOp(realOp.File.Ref, op)
		if err != nil {
			return err
		}
	case *setAttrOp:
		// Because the attributes apply to the file, which doesn't
		// actually have an updated pointer, we may need to create a
		// new chain.
		_, ok := ccs.byMostRecent[realOp.File]
		if !ok {
			// pointer didn't change, so most recent is the same:
			chain := &crChain{original: realOp.File, mostRecent: realOp.File}
			ccs.byOriginal[realOp.File] = chain
			ccs.byMostRecent[realOp.File] = chain
		}

		err := ccs.addOp(realOp.File, op)
		if err != nil {
			return err
		}
	case *resolutionOp:
		ccs.resOps = append(ccs.resOps, realOp)
	case *rekeyOp:
		// ignore rekey op
	case *GCOp:
		// ignore gc op
	}

	return nil
}

func (ccs *crChains) makeChainForNewOpWithUpdate(
	targetPtr BlockPointer, newOp op, update *blockUpdate) error {
	oldUpdate := *update
	// so that most recent == original
	var err error
	*update, err = makeBlockUpdate(targetPtr, update.Unref)
	if err != nil {
		return err
	}
	defer func() {
		// reset the update to its original state before returning.
		*update = oldUpdate
	}()
	err = ccs.makeChainForOp(newOp)
	if err != nil {
		return err
	}
	return nil
}

// makeChainForNewOp makes a new chain for an op that does not yet
// have its pointers initialized.  It does so by setting Unref and Ref
// to be the same for the duration of this function, and calling the
// usual makeChainForOp method.  This function is not goroutine-safe
// with respect to newOp.  Also note that rename ops will not be split
// into two ops; they will be placed only in the new directory chain.
func (ccs *crChains) makeChainForNewOp(targetPtr BlockPointer, newOp op) error {
	switch realOp := newOp.(type) {
	case *createOp:
		return ccs.makeChainForNewOpWithUpdate(targetPtr, newOp, &realOp.Dir)
	case *rmOp:
		return ccs.makeChainForNewOpWithUpdate(targetPtr, newOp, &realOp.Dir)
	case *renameOp:
		// In this case, we don't want to split the rename chain, so
		// just make up a new operation and later overwrite it with
		// the rename op.
		co, err := newCreateOp(realOp.NewName, realOp.NewDir.Unref, File)
		if err != nil {
			return err
		}
		err = ccs.makeChainForNewOpWithUpdate(targetPtr, co, &co.Dir)
		if err != nil {
			return err
		}
		chain, ok := ccs.byMostRecent[targetPtr]
		if !ok {
			return errors.Errorf("Couldn't find chain for %v after making it",
				targetPtr)
		}
		if len(chain.ops) != 1 {
			return errors.Errorf("Chain of unexpected length for %v after "+
				"making it", targetPtr)
		}
		chain.ops[0] = realOp
		return nil
	case *setAttrOp:
		return ccs.makeChainForNewOpWithUpdate(targetPtr, newOp, &realOp.Dir)
	case *syncOp:
		return ccs.makeChainForNewOpWithUpdate(targetPtr, newOp, &realOp.File)
	default:
		return errors.Errorf("Couldn't make chain with unknown operation %s",
			newOp)
	}
}

func (ccs *crChains) mostRecentFromOriginal(original BlockPointer) (
	BlockPointer, error) {
	chain, ok := ccs.byOriginal[original]
	if !ok {
		return BlockPointer{}, errors.WithStack(NoChainFoundError{original})
	}
	return chain.mostRecent, nil
}

func (ccs *crChains) mostRecentFromOriginalOrSame(original BlockPointer) (
	BlockPointer, error) {
	ptr, err := ccs.mostRecentFromOriginal(original)
	if err == nil {
		// A satisfactory chain was found.
		return ptr, nil
	} else if _, ok := errors.Cause(err).(NoChainFoundError); !ok {
		// An unexpected error!
		return BlockPointer{}, err
	}
	return original, nil
}

func (ccs *crChains) originalFromMostRecent(mostRecent BlockPointer) (
	BlockPointer, error) {
	chain, ok := ccs.byMostRecent[mostRecent]
	if !ok {
		return BlockPointer{}, errors.WithStack(NoChainFoundError{mostRecent})
	}
	return chain.original, nil
}

func (ccs *crChains) originalFromMostRecentOrSame(mostRecent BlockPointer) (
	BlockPointer, error) {
	ptr, err := ccs.originalFromMostRecent(mostRecent)
	if err == nil {
		// A satisfactory chain was found.
		return ptr, nil
	} else if _, ok := errors.Cause(err).(NoChainFoundError); !ok {
		// An unexpected error!
		return BlockPointer{}, err
	}
	return mostRecent, nil
}

func (ccs *crChains) isCreated(original BlockPointer) bool {
	return ccs.createdOriginals[original]
}

func (ccs *crChains) isDeleted(original BlockPointer) bool {
	return ccs.deletedOriginals[original]
}

func (ccs *crChains) renamedParentAndName(original BlockPointer) (
	BlockPointer, string, bool) {
	info, ok := ccs.renamedOriginals[original]
	if !ok {
		return BlockPointer{}, "", false
	}
	return info.originalNewParent, info.newName, true
}

func newCRChainsEmpty() *crChains {
	return &crChains{
		byOriginal:          make(map[BlockPointer]*crChain),
		byMostRecent:        make(map[BlockPointer]*crChain),
		deletedOriginals:    make(map[BlockPointer]bool),
		createdOriginals:    make(map[BlockPointer]bool),
		renamedOriginals:    make(map[BlockPointer]renameInfo),
		blockChangePointers: make(map[BlockPointer]bool),
		toUnrefPointers:     make(map[BlockPointer]bool),
		doNotUnrefPointers:  make(map[BlockPointer]bool),
		originals:           make(map[BlockPointer]BlockPointer),
	}
}

func (ccs *crChains) addOps(codec kbfscodec.Codec,
	privateMD PrivateMetadata, winfo writerInfo,
	localTimestamp time.Time) error {
	// Copy the ops since CR will change them.
	var oldOps opsList
	if privateMD.Changes.Info.BlockPointer.IsInitialized() {
		// In some cases (e.g., journaling) we might not have been
		// able to re-embed the block changes.  So use the cached
		// version directly.
		oldOps = privateMD.cachedChanges.Ops
	} else {
		oldOps = privateMD.Changes.Ops
	}
	ops := make(opsList, len(oldOps))
	err := kbfscodec.Update(codec, &ops, oldOps)
	if err != nil {
		return err
	}

	for i, op := range ops {
		op.setFinalPath(oldOps[i].getFinalPath())
		op.setWriterInfo(winfo)
		op.setLocalTimestamp(localTimestamp)
		err := ccs.makeChainForOp(op)
		if err != nil {
			return err
		}
	}
	return nil
}

// chainMetadata is the interface for metadata objects that can be
// used in building crChains. It is implemented by
// ImmutableRootMetadata, but is also mostly implemented by
// RootMetadata (just need LastModifyingWriterVerifyingKey
// LocalTimestamp).
type chainMetadata interface {
	KeyMetadataWithRootDirEntry
	IsWriterMetadataCopiedSet() bool
	LastModifyingWriter() keybase1.UID
	LastModifyingWriterVerifyingKey() kbfscrypto.VerifyingKey
	Revision() kbfsmd.Revision
	Data() *PrivateMetadata
	LocalTimestamp() time.Time
}

// newCRChains builds a new crChains object from the given list of
// chainMetadatas, which must be non-empty.
func newCRChains(
	ctx context.Context, codec kbfscodec.Codec,
	chainMDs []chainMetadata, fbo *folderBlockOps, identifyTypes bool) (
	ccs *crChains, err error) {
	ccs = newCRChainsEmpty()

	// For each MD update, turn each update in each op into map
	// entries and create chains for the BlockPointers that are
	// affected directly by the operation.
	for _, chainMD := range chainMDs {
		// No new operations in these.
		if chainMD.IsWriterMetadataCopiedSet() {
			continue
		}

		winfo := newWriterInfo(
			chainMD.LastModifyingWriter(),
			chainMD.LastModifyingWriterVerifyingKey(),
			chainMD.Revision())
		if err != nil {
			return nil, err
		}

		data := *chainMD.Data()

		err = ccs.addOps(codec, data, winfo, chainMD.LocalTimestamp())

		if ptr := data.cachedChanges.Info.BlockPointer; ptr != zeroPtr {
			ccs.blockChangePointers[ptr] = true

			// Any child block change pointers?
			infos, err := fbo.GetIndirectFileBlockInfos(
				ctx, makeFBOLockState(), chainMD,
				path{fbo.folderBranch, []pathNode{{
					ptr, fmt.Sprintf("<MD rev %d>", chainMD.Revision())}}})
			if err != nil {
				return nil, err
			}
			for _, info := range infos {
				ccs.blockChangePointers[info.BlockPointer] = true
			}
		}

		if err != nil {
			return nil, err
		}

		if !ccs.originalRoot.IsInitialized() {
			// Find the original pointer for the root directory
			if rootChain, ok :=
				ccs.byMostRecent[data.Dir.BlockPointer]; ok {
				ccs.originalRoot = rootChain.original
			}
		}
	}

	mostRecentMD := chainMDs[len(chainMDs)-1]

	for _, chain := range ccs.byOriginal {
		toUnrefs := chain.collapse(ccs.createdOriginals, ccs.originals)
		for _, unref := range toUnrefs {
			ccs.toUnrefPointers[unref] = true
		}
		// NOTE: even if we've removed all its ops, still keep the
		// chain around so we can see the mapping between the original
		// and most recent pointers.

		// Figure out if this chain is a file or directory.  We don't
		// need to do this for chains that represent a resolution in
		// progress, since in that case all actions are already
		// completed.
		if identifyTypes {
			err := chain.identifyType(ctx, fbo, mostRecentMD, ccs)
			if err != nil {
				return nil, err
			}
		}
	}

	ccs.mostRecentChainMDInfo = mostRecentMD
	return ccs, nil
}

// newCRChainsForIRMDs simply builds a list of chainMetadatas from the
// given list of ImmutableRootMetadatas and calls newCRChains with it.
func newCRChainsForIRMDs(
	ctx context.Context, codec kbfscodec.Codec,
	irmds []ImmutableRootMetadata, fbo *folderBlockOps,
	identifyTypes bool) (ccs *crChains, err error) {
	chainMDs := make([]chainMetadata, len(irmds))
	for i, irmd := range irmds {
		chainMDs[i] = irmd
	}
	return newCRChains(ctx, codec, chainMDs, fbo, identifyTypes)
}

type crChainSummary struct {
	Path string
	Ops  []string
}

func (ccs *crChains) summary(identifyChains *crChains,
	nodeCache NodeCache) (res []*crChainSummary) {
	for _, chain := range ccs.byOriginal {
		summary := &crChainSummary{}
		res = append(res, summary)

		// first stringify all the ops so they are displayed even if
		// we can't find the path.
		for _, op := range chain.ops {
			summary.Ops = append(summary.Ops, op.String())
		}

		// find the path name using the identified most recent pointer
		n := nodeCache.Get(chain.mostRecent.Ref())
		if n == nil {
			summary.Path = fmt.Sprintf("Unknown path: %v", chain.mostRecent)
			continue
		}

		path := nodeCache.PathFromNode(n)
		summary.Path = path.String()
	}

	return res
}

func (ccs *crChains) removeChain(ptr BlockPointer) {
	if chain, ok := ccs.byMostRecent[ptr]; ok {
		delete(ccs.byOriginal, chain.original)
	} else {
		delete(ccs.byOriginal, ptr)
	}
	delete(ccs.byMostRecent, ptr)
}

// copyOpAndRevertUnrefsToOriginals returns a shallow copy of the op,
// modifying each custom BlockPointer field to reference the original
// version of the corresponding blocks.
func (ccs *crChains) copyOpAndRevertUnrefsToOriginals(currOp op) op {
	var unrefs []*BlockPointer
	var newOp op
	switch realOp := currOp.(type) {
	case *createOp:
		newCreateOp := *realOp
		unrefs = append(unrefs, &newCreateOp.Dir.Unref)
		newOp = &newCreateOp
	case *rmOp:
		newRmOp := *realOp
		unrefs = append(unrefs, &newRmOp.Dir.Unref)
		newOp = &newRmOp
	case *renameOp:
		newRenameOp := *realOp
		unrefs = append(unrefs, &newRenameOp.OldDir.Unref,
			&newRenameOp.NewDir.Unref, &newRenameOp.Renamed)
		newOp = &newRenameOp
	case *syncOp:
		newSyncOp := *realOp
		unrefs = append(unrefs, &newSyncOp.File.Unref)
		newOp = &newSyncOp
	case *setAttrOp:
		newSetAttrOp := *realOp
		unrefs = append(unrefs, &newSetAttrOp.Dir.Unref, &newSetAttrOp.File)
		newOp = &newSetAttrOp
	case *GCOp:
		// No need to copy a GCOp, it won't be modified
		newOp = realOp
	case *rekeyOp:
		newOp = realOp
	}
	for _, unref := range unrefs {
		ok := true
		// Loop over the originals, since if `changeOriginal` was
		// called, there might be a path of them.
		for ok {
			var original BlockPointer
			original, ok = ccs.originals[*unref]
			if ok {
				*unref = original
			}
		}
	}
	return newOp
}

// changeOriginal converts the original of a chain to a different
// original, which originated in some other branch.
func (ccs *crChains) changeOriginal(oldOriginal BlockPointer,
	newOriginal BlockPointer) error {
	if oldOriginal == newOriginal {
		// This apparently can happen, but I'm not sure how.  (See
		// KBFS-2946.)  Maybe because of a self-conflict in some weird
		// error conditions. In this case, we can just pretend the
		// change worked, and let CR continue it's normal process.
		return nil
	}
	chain, ok := ccs.byOriginal[oldOriginal]
	if !ok {
		return errors.WithStack(NoChainFoundError{oldOriginal})
	}
	if _, ok := ccs.byOriginal[newOriginal]; ok {
		return errors.Errorf("crChains.changeOriginal: New original %v "+
			"already exists", newOriginal)
	}

	delete(ccs.byOriginal, oldOriginal)
	chain.original = newOriginal
	ccs.byOriginal[newOriginal] = chain
	ccs.originals[oldOriginal] = newOriginal

	if _, ok := ccs.deletedOriginals[oldOriginal]; ok {
		delete(ccs.deletedOriginals, oldOriginal)
		ccs.deletedOriginals[newOriginal] = true
	}
	if _, ok := ccs.createdOriginals[oldOriginal]; ok {
		delete(ccs.createdOriginals, oldOriginal)
		// We're swapping in an original made on some other branch, so
		// it shouldn't go in the `createdOriginals` map.
	}
	if ri, ok := ccs.renamedOriginals[oldOriginal]; ok {
		delete(ccs.renamedOriginals, oldOriginal)
		ccs.renamedOriginals[newOriginal] = ri
	}
	for p, info := range ccs.renamedOriginals {
		changed := false
		if info.originalOldParent == oldOriginal {
			info.originalOldParent = newOriginal
			changed = true
		}
		if info.originalNewParent == oldOriginal {
			info.originalNewParent = newOriginal
			changed = true
		}
		if changed {
			ccs.renamedOriginals[p] = info
		}
	}
	return nil
}

func (ccs *crChains) findPathForDeleted(mostRecent BlockPointer) path {
	// Find the parent chain that deleted this one.
	for ptr, chain := range ccs.byMostRecent {
		for _, op := range chain.ops {
			ro, ok := op.(*rmOp)
			if !ok {
				continue
			}
			for _, unref := range ro.Unrefs() {
				if unref == mostRecent {
					// If the path isn't set yet, recurse.
					p := ro.getFinalPath()
					if !p.isValid() {
						p = ccs.findPathForDeleted(ptr)
					}
					return p.ChildPath(ro.OldName, mostRecent)
				}
			}
		}
	}
	// We can get here if the entry in question was also created
	// during the chain period, in which case `mostRecent` doesn't
	// need to be unreferenced explicitly.  There's nothing easy we
	// can do here.  But the path isn't very important; for the most
	// part, it's just informational for log messages and journal
	// status.  So if we are stuck, just pick use the root directory
	// and a fake name.
	var rootMostRecent BlockPointer
	if ccs.mostRecentChainMDInfo != nil {
		rootMostRecent =
			ccs.mostRecentChainMDInfo.GetRootDirEntry().BlockPointer
	}
	return path{
		FolderBranch: FolderBranch{
			Tlf:    ccs.mostRecentChainMDInfo.TlfID(),
			Branch: MasterBranch,
		},
		path: []pathNode{{
			BlockPointer: rootMostRecent,
			Name:         mostRecent.String(),
		}},
	}
}

func (ccs *crChains) findPathForCreated(mostRecent BlockPointer) path {
	// Find the parent chain that deleted this one.
	for ptr, chain := range ccs.byMostRecent {
		for _, op := range chain.ops {
			co, ok := op.(*createOp)
			if !ok {
				continue
			}
			for _, ref := range co.Refs() {
				if ref == mostRecent {
					// If the path isn't set yet, recurse.
					p := co.getFinalPath()
					if !p.isValid() {
						p = ccs.findPathForCreated(ptr)
					}
					return p.ChildPath(co.NewName, mostRecent)
				}
			}
		}
	}
	// We can get here if the entry in question was also deleted
	// during the chain period, in which case `mostRecent` doesn't
	// need to be unreferenced explicitly.  There's nothing easy we
	// can do here.  But the path isn't very important; for the most
	// part, it's just informational for log messages and journal
	// status.  So if we are stuck, just pick use the root directory
	// and a fake name.
	var rootMostRecent BlockPointer
	if ccs.mostRecentChainMDInfo != nil {
		rootMostRecent =
			ccs.mostRecentChainMDInfo.GetRootDirEntry().BlockPointer
	}
	return path{
		FolderBranch: FolderBranch{
			Tlf:    ccs.mostRecentChainMDInfo.TlfID(),
			Branch: MasterBranch,
		},
		path: []pathNode{{
			BlockPointer: rootMostRecent,
			Name:         mostRecent.String(),
		}},
	}
}

// getPaths returns a sorted slice of most recent paths to all the
// nodes in the given CR chains that were directly modified during a
// branch, and which existed at both the start and the end of the
// branch.  This represents the paths that need to be checked for
// conflicts.  The paths are sorted by descending path length.  It
// uses nodeCache when looking up paths, which must at least contain
// the most recent root node of the branch.  Note that if a path
// cannot be found, the corresponding chain is completely removed from
// the set of CR chains.  Set includeCreates to true if the returned
// paths should include the paths of newly-created nodes.
func (ccs *crChains) getPaths(ctx context.Context, blocks *folderBlockOps,
	log logger.Logger, nodeCache NodeCache, includeCreates bool,
	checkOpFinalPaths bool) ([]path, error) {
	newPtrs := make(map[BlockPointer]bool)
	var ptrs []BlockPointer
	renameOps := make(map[BlockPointer][]*renameOp)
	for ptr, chain := range ccs.byMostRecent {
		newPtrs[ptr] = true
		// We only care about the paths for ptrs that are directly
		// affected by operations and were live through the entire
		// unmerged branch, or, if includeCreates was set, was created
		// and not deleted in the unmerged branch.
		if len(chain.ops) > 0 &&
			(includeCreates || !ccs.isCreated(chain.original)) &&
			!ccs.isDeleted(chain.original) {
			ptrs = append(ptrs, ptr)
			// Also resolve the old name for any renames, if needed.
			for _, op := range chain.ops {
				ro, ok := op.(*renameOp)
				if !ok {
					continue
				}

				oldDirPtr := ro.OldDir.Ref
				if ro.NewDir != (blockUpdate{}) {
					if !newPtrs[oldDirPtr] {
						ptrs = append(ptrs, oldDirPtr)
						newPtrs[oldDirPtr] = true
					}
					renameOps[oldDirPtr] = append(renameOps[oldDirPtr], ro)
				}
			}
		}
	}

	if checkOpFinalPaths {
		// If we plan to check all the paths, clear them out first.
		for _, chain := range ccs.byMostRecent {
			for _, op := range chain.ops {
				op.setFinalPath(path{})
			}
		}
	}

	pathMap, err := blocks.SearchForPaths(ctx, nodeCache, ptrs,
		newPtrs, ccs.mostRecentChainMDInfo,
		ccs.mostRecentChainMDInfo.GetRootDirEntry().BlockPointer)
	if err != nil {
		return nil, err
	}

	paths := make([]path, 0, len(pathMap))
	for ptr, p := range pathMap {
		if len(p.path) == 0 {
			log.CDebugf(ctx, "Ignoring pointer with no found path: %v", ptr)
			ccs.removeChain(ptr)
			continue
		}
		paths = append(paths, p)

		// update the unmerged final paths
		if chain, ok := ccs.byMostRecent[ptr]; ok {
			for _, op := range chain.ops {
				op.setFinalPath(p)
			}
		}
		for _, ro := range renameOps[ptr] {
			ro.oldFinalPath = p
		}
	}

	// Fill in the paths for any deleted entries.
	for original := range ccs.deletedOriginals {
		chain, ok := ccs.byOriginal[original]
		if !ok {
			continue
		}
		p := ccs.findPathForDeleted(chain.mostRecent)
		for _, op := range chain.ops {
			op.setFinalPath(p)
		}
	}

	// Even if `includeCreates` is false, we still might need to have
	// the final paths set on all the ops, later during conflict
	// resolution.  For example, in the case where the same directory
	// is created in both the unmerged and merged branches, and the
	// child entries need to be compared for conflicts
	if !includeCreates {
		for original := range ccs.createdOriginals {
			chain, ok := ccs.byOriginal[original]
			if !ok {
				continue
			}
			p := ccs.findPathForCreated(chain.mostRecent)
			for _, op := range chain.ops {
				op.setFinalPath(p)
			}
		}
	}

	if checkOpFinalPaths {
		for _, chain := range ccs.byMostRecent {
			for _, op := range chain.ops {
				if !op.getFinalPath().isValid() {
					return nil, errors.Errorf(
						"Op %s doesn't have final path", op)
				}
			}
		}
	}

	// Order by descending path length.
	sort.Sort(crSortedPaths(paths))
	return paths, nil
}

// remove deletes all operations associated with the given revision
// from the chains.  It leaves original block pointers in place
// though, even when removing operations from the head of the chain.
// It returns the set of chains with at least one operation removed.
func (ccs *crChains) remove(ctx context.Context, log logger.Logger,
	revision kbfsmd.Revision) []*crChain {
	var chainsWithRemovals []*crChain
	for _, chain := range ccs.byOriginal {
		if chain.remove(ctx, log, revision) {
			chainsWithRemovals = append(chainsWithRemovals, chain)
		}
	}
	return chainsWithRemovals
}

func (ccs *crChains) revertRenames(oldOps []op) {
	for _, op := range oldOps {
		if rop, ok := op.(*renameOp); ok {
			// Replace the corresponding createOp, and remove the
			// rmOp.
			oldChain, ok := ccs.byMostRecent[rop.OldDir.Ref]
			if !ok {
				continue
			}
			for i, oldOp := range oldChain.ops {
				if rmop, ok := oldOp.(*rmOp); ok &&
					rmop.OldName == rop.OldName {
					rop.oldFinalPath = rmop.getFinalPath()
					oldChain.ops = append(
						oldChain.ops[:i], oldChain.ops[i+1:]...)
					// The first rm should be the one that matches, as
					// earlier ones should have been collapsed away
					// from the chain.
					break
				}
			}

			if !rop.oldFinalPath.isValid() {
				// We don't need to revert any renames without an
				// rmOp, because it was probably just created and
				// renamed within a single journal update.
				continue
			}

			newChain := oldChain
			if rop.NewDir != (blockUpdate{}) {
				newChain = ccs.byMostRecent[rop.NewDir.Ref]
			}

			for i, newOp := range newChain.ops {
				if cop, ok := newOp.(*createOp); ok &&
					cop.renamed && cop.NewName == rop.NewName {
					rop.setFinalPath(cop.getFinalPath())
					newChain.ops[i] = rop
					break
				}
			}
		}
	}
}
