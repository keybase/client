package libkbfs

import (
	"fmt"

	"golang.org/x/net/context"
)

// copyUnmergedEntryAction says that the unmerged entry for the given
// name should be copied directly into the merged version of the
// directory; there should be no conflict.  If symPath is non-empty, then
// the unmerged entry becomes a symlink to that path.
type copyUnmergedEntryAction struct {
	fromName string
	toName   string
	symPath  string
}

func fixupNamesInOps(fromName string, toName string, ops []op) (retOps []op) {
	retOps = make([]op, 0, len(ops))
	for _, uop := range ops {
		done := false
		switch realOp := uop.(type) {
		// The only names that matter are in createOps or
		// setAttrOps.  rms on the unmerged side wouldn't be
		// part of the unmerged entry
		case *createOp:
			if realOp.NewName == fromName {
				realOpCopy := *realOp
				realOpCopy.NewName = toName
				retOps = append(retOps, &realOpCopy)
				done = true
			}
		case *setAttrOp:
			if realOp.Name == fromName {
				realOpCopy := *realOp
				realOpCopy.Name = toName
				retOps = append(retOps, &realOpCopy)
				done = true
			}
		}
		if !done {
			retOps = append(retOps, uop)
		}
	}
	return retOps
}

func (cuea *copyUnmergedEntryAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	// Find the unmerged entry
	unmergedEntry, ok := unmergedBlock.Children[cuea.fromName]
	if !ok {
		return NoSuchNameError{cuea.fromName}
	}

	if cuea.symPath != "" {
		unmergedEntry.Type = Sym
		unmergedEntry.SymPath = cuea.symPath
	}

	mergedBlock.Children[cuea.toName] = unmergedEntry
	return nil
}

func prependOpsToChain(mostRecent BlockPointer, chains *crChains,
	newOps ...op) error {
	chain := chains.byMostRecent[mostRecent]
	// Create the chain if it doesn't exist yet.
	if chain == nil && len(newOps) > 0 {
		err := chains.makeChainForNewOp(mostRecent, newOps[0])
		if err != nil {
			return err
		}
		chain = chains.byMostRecent[mostRecent]
		chain.ops = nil // will prepend it below
	}
	// prepend it
	chain.ops = append(newOps, chain.ops...)
	return nil
}

func (cuea *copyUnmergedEntryAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, mergedBlock *DirBlock,
	unmergedChains *crChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	if cuea.symPath != "" && !unmergedChain.isFile() {
		// If this was turned into a symlink, then we have to simulate
		// rm/create at the beginning of the mergedOps list.
		err := prependOpsToChain(mergedMostRecent, mergedChains,
			newRmOp(cuea.fromName, mergedMostRecent),
			newCreateOp(cuea.toName, mergedMostRecent, Sym))
		if err != nil {
			return err
		}
	}

	// If the name changed, we have to update all the unmerged ops
	// with the new name.
	// The merged ops don't change, though later we may have to
	// manipulate the block pointers in the original ops.
	if cuea.fromName != cuea.toName {
		unmergedChain.ops =
			fixupNamesInOps(cuea.fromName, cuea.toName, unmergedChain.ops)
	}
	return nil
}

func (cuea *copyUnmergedEntryAction) String() string {
	return fmt.Sprintf("copyUnmergedEntry: %s -> %s %s",
		cuea.fromName, cuea.toName, cuea.symPath)
}

// copyUnmergedAttrAction says that the given attributes in the
// unmerged entry for the given name should be copied directly into
// the merged version of the directory; there should be no conflict.
type copyUnmergedAttrAction struct {
	fromName string
	toName   string
	attr     []attrChange
}

func (cuaa *copyUnmergedAttrAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	// Find the unmerged entry
	unmergedEntry, ok := unmergedBlock.Children[cuaa.fromName]
	if !ok {
		return NoSuchNameError{cuaa.fromName}
	}

	mergedEntry, ok := mergedBlock.Children[cuaa.toName]
	if !ok {
		return NoSuchNameError{cuaa.toName}
	}
	for _, attr := range cuaa.attr {
		switch attr {
		case exAttr:
			mergedEntry.Type = unmergedEntry.Type
		case mtimeAttr:
			mergedEntry.Mtime = unmergedEntry.Mtime
		case sizeAttr:
			mergedEntry.Size = unmergedEntry.Size
			mergedEntry.EncodedSize = unmergedEntry.EncodedSize
			mergedEntry.BlockPointer = unmergedEntry.BlockPointer
		}
	}
	mergedBlock.Children[cuaa.toName] = mergedEntry

	return nil
}

func (cuaa *copyUnmergedAttrAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, mergedBlock *DirBlock,
	unmergedChains *crChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	// If the name changed, we have to update all the unmerged ops
	// with the new name.
	// The merged ops don't change, though later we may have to
	// manipulate the block pointers in the original ops.
	if cuaa.fromName != cuaa.toName {
		unmergedChain.ops =
			fixupNamesInOps(cuaa.fromName, cuaa.toName, unmergedChain.ops)
	}
	return nil
}

func (cuaa *copyUnmergedAttrAction) String() string {
	return fmt.Sprintf("copyUnmergedAttr: %s -> %s (%s)",
		cuaa.fromName, cuaa.toName, cuaa.attr)
}

// rmMergedEntryAction says that the merged entry for the given name
// should be deleted.
type rmMergedEntryAction struct {
	name string
}

func (rmea *rmMergedEntryAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	if _, ok := mergedBlock.Children[rmea.name]; !ok {
		return NoSuchNameError{rmea.name}
	}
	delete(mergedBlock.Children, rmea.name)
	return nil
}

func (rmea *rmMergedEntryAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, mergedBlock *DirBlock,
	unmergedChains *crChains, mergedChains *crChains) error {
	return nil
}

func (rmea *rmMergedEntryAction) String() string {
	return fmt.Sprintf("rmMergedEntry: %s", rmea.name)
}

// renameUnmergedAction says that the unmerged copy of a file needs to
// be renamed, and the file blocks should be copied.
type renameUnmergedAction struct {
	fromName string
	toName   string
}

func crActionCopyFile(ctx context.Context, copier fileBlockDeepCopier,
	fromName string, toName string, fromBlock *DirBlock, toBlock *DirBlock) (
	fromEntry DirEntry, err error) {
	// Find the source entry.
	fromEntry, ok := fromBlock.Children[fromName]
	if !ok {
		return DirEntry{}, NoSuchNameError{fromName}
	}

	// We only rename files.
	if fromEntry.Type == Dir {
		// Just fill in the last path node, we don't have the full path.
		return DirEntry{}, NotFileError{path{path: []pathNode{{
			BlockPointer: fromEntry.BlockPointer,
			Name:         fromName,
		}}}}
	}

	// Fetch the top block.
	ptr, err := copier(ctx, toName, fromEntry.BlockPointer)
	if err != nil {
		return DirEntry{}, err
	}
	// Set the entry under the new name, with the new pointer.
	fromEntry.BlockPointer = ptr
	toBlock.Children[toName] = fromEntry
	return fromEntry, nil
}

func (rua *renameUnmergedAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	_, err := crActionCopyFile(ctx, unmergedCopier, rua.fromName, rua.toName,
		unmergedBlock, mergedBlock)
	if err != nil {
		return err
	}
	return nil
}

func (rua *renameUnmergedAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, mergedBlock *DirBlock,
	unmergedChains *crChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	// Rename all operations with the old name to the new name.
	unmergedChain.ops =
		fixupNamesInOps(rua.fromName, rua.toName, unmergedChain.ops)

	// Prepend a rename for the unmerged copy to the merged set of
	// operations, with another create for the merged file, for local
	// playback.
	if !unmergedChain.isFile() {
		unmergedEntry, ok := mergedBlock.Children[rua.toName]
		if !ok {
			return NoSuchNameError{rua.toName}
		}

		mergedEntry, ok := mergedBlock.Children[rua.fromName]
		if !ok {
			return NoSuchNameError{rua.fromName}
		}

		err := prependOpsToChain(mergedMostRecent, mergedChains,
			newRenameOp(rua.fromName, unmergedMostRecent, rua.toName,
				mergedMostRecent, unmergedEntry.BlockPointer),
			newCreateOp(rua.fromName, mergedMostRecent, mergedEntry.Type))
		if err != nil {
			return err
		}

		// Before merging the unmerged ops, create a file with the new
		// name, unless the create already exists.
		found := false
		for _, op := range unmergedChain.ops {
			if co, ok := op.(*createOp); ok && co.NewName == rua.toName {
				found = true
				break
			}
		}
		if !found {
			err = prependOpsToChain(unmergedMostRecent, unmergedChains,
				newCreateOp(rua.toName, mergedMostRecent, mergedEntry.Type))
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (rua *renameUnmergedAction) String() string {
	return fmt.Sprintf("renameUnmerged: %s -> %s", rua.fromName, rua.toName)
}

// renameMergedAction says that the merged copy of a file needs to be
// renamed, and the file blocks should be copied.
type renameMergedAction struct {
	fromName string
	toName   string
}

func (rma *renameMergedAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	_, err := crActionCopyFile(ctx, mergedCopier, rma.fromName, rma.toName,
		mergedBlock, mergedBlock)
	if err != nil {
		return err
	}

	unmergedEntry, ok := unmergedBlock.Children[rma.fromName]
	if !ok {
		return NoSuchNameError{rma.fromName}
	}
	mergedBlock.Children[rma.fromName] = unmergedEntry
	return nil
}

func (rma *renameMergedAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, mergedBlock *DirBlock,
	unmergedChains *crChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	// Rename all operations with the old name to the new name.
	mergedChain := mergedChains.byMostRecent[mergedMostRecent]
	if mergedChain != nil {
		mergedChain.ops =
			fixupNamesInOps(rma.fromName, rma.toName, mergedChain.ops)
	}

	if !unmergedChain.isFile() {
		unmergedEntry, ok := mergedBlock.Children[rma.fromName]
		if !ok {
			return NoSuchNameError{rma.fromName}
		}

		mergedEntry, ok := mergedBlock.Children[rma.toName]
		if !ok {
			return NoSuchNameError{rma.toName}
		}

		// Prepend a rename for the merged copy to the unmerged set of
		// operations, with another create for the unmerged file, for remote
		// playback.
		err := prependOpsToChain(unmergedMostRecent, unmergedChains,
			newRenameOp(rma.fromName, mergedMostRecent, rma.toName,
				mergedMostRecent, mergedEntry.BlockPointer),
			newCreateOp(rma.fromName, mergedMostRecent, unmergedEntry.Type))
		if err != nil {
			return err
		}

		// Before playing back the merged ops, create a file with the
		// new name, unless the create already exists.
		found := false
		if mergedChain != nil {
			for _, op := range mergedChain.ops {
				if co, ok := op.(*createOp); ok && co.NewName == rma.toName {
					found = true
					break
				}
			}
		}
		if !found {
			err := prependOpsToChain(mergedMostRecent, mergedChains,
				newCreateOp(rma.toName, mergedMostRecent, mergedEntry.Type))
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (rma *renameMergedAction) String() string {
	return fmt.Sprintf("renameMerged: %s -> %s", rma.fromName, rma.toName)
}

// dropUnmergedAction says that the corresponding unmerged
// operation should be dropped.
type dropUnmergedAction struct {
	op op
}

func (dua *dropUnmergedAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	return nil
}

func (dua *dropUnmergedAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, mergedBlock *DirBlock,
	unmergedChains *crChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	for i, op := range unmergedChain.ops {
		if op == dua.op {
			unmergedChain.ops =
				append(unmergedChain.ops[:i], unmergedChain.ops[i+1:]...)
			break
		}
	}

	invertedOp := invertOpForLocalNotifications(dua.op)
	err := prependOpsToChain(mergedMostRecent, mergedChains, invertedOp)
	if err != nil {
		return err
	}
	return nil
}

func (dua *dropUnmergedAction) String() string {
	return fmt.Sprintf("dropUnmerged: %s", dua.op)
}

type collapseActionInfo struct {
	topAction      crAction
	topActionIndex int
}

type crActionList []crAction

func setTopAction(action crAction, fromName string, index int,
	infoMap map[string]collapseActionInfo, indicesToRemove map[int]bool) {
	info, ok := infoMap[fromName]
	if ok {
		indicesToRemove[info.topActionIndex] = true
	}
	info.topAction = action
	info.topActionIndex = index
	infoMap[fromName] = info
}

// collapse drops any actions that are made irrelevant by other
// actions in the list.  It assumes that file-related actions have
// already been merged into their parent directory action lists.
func (cal crActionList) collapse() crActionList {
	// Order of precedence for a given fromName:
	// 1) renameUnmergedAction
	// 2) copyUnmergedEntryAction
	// 3) copyUnmergedAttrAction
	infoMap := make(map[string]collapseActionInfo) // fromName -> info
	indicesToRemove := make(map[int]bool)
	for i, untypedAction := range cal {
		switch action := untypedAction.(type) {

		// Unmerged actions:
		case *renameUnmergedAction:
			setTopAction(action, action.fromName, i, infoMap, indicesToRemove)
		case *copyUnmergedEntryAction:
			untypedTopAction := infoMap[action.fromName].topAction
			switch untypedTopAction.(type) {
			case *renameUnmergedAction:
				indicesToRemove[i] = true
			default:
				setTopAction(action, action.fromName, i, infoMap,
					indicesToRemove)
			}
		case *copyUnmergedAttrAction:
			untypedTopAction := infoMap[action.fromName].topAction
			switch topAction := untypedTopAction.(type) {
			case *renameUnmergedAction:
				indicesToRemove[i] = true
			case *copyUnmergedEntryAction:
				indicesToRemove[i] = true
			case *copyUnmergedAttrAction:
				// Add attributes to the current top action, if not
				// already there.
				for _, a := range action.attr {
					found := false
					for _, topA := range topAction.attr {
						if a == topA {
							found = true
						}
					}
					if !found {
						topAction.attr = append(topAction.attr, a)
					}
				}
				indicesToRemove[i] = true
			default:
				setTopAction(action, action.fromName, i, infoMap,
					indicesToRemove)
			}

		// Merged actions
		case *renameMergedAction:
			// Prefix merged actions with a reserved prefix to keep
			// them separate from the unmerged actions.
			setTopAction(action, ".kbfs_merged_"+action.fromName, i, infoMap,
				indicesToRemove)
		}
	}

	if len(indicesToRemove) == 0 {
		return cal
	}

	newList := make(crActionList, 0, len(cal)-len(indicesToRemove))
	for i, action := range cal {
		if indicesToRemove[i] {
			continue
		}
		newList = append(newList, action)
	}

	return newList
}
