package libkbfs

import "fmt"

// copyUnmergedEntryAction says that the unmerged entry for the given
// name should be copied directly into the merged version of the
// directory; there should be no conflict.  If symPath is non-empty, then
// the unmerged entry becomes a symlink to that path.
type copyUnmergedEntryAction struct {
	fromName string
	toName   string
	symPath  string
}

func (cuea *copyUnmergedEntryAction) do(config Config,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	// Find the unmerged entry
	unmergedEntry, ok := unmergedBlock.Children[cuea.fromName]
	if !ok {
		return nil, nil, NoSuchNameError{cuea.fromName}
	}

	if cuea.symPath != "" {
		unmergedEntry.Type = Sym
		unmergedEntry.SymPath = cuea.symPath

		// If this was turned into a symlink, then we have to simulate
		// a rename in the mergedOps list.  Even if the names are the
		// same, this should clear out the caches of any observers.
		retMergedOps = append(retMergedOps,
			newRenameOp(cuea.fromName, unmergedMostRecent, cuea.toName,
				unmergedMostRecent, unmergedEntry.BlockPointer))
	}

	mergedBlock.Children[cuea.toName] = unmergedEntry

	// If the name changed, we have to update all the unmerged ops
	// with the new name.

	// The unmerged ops don't change, though later we may have to
	// manipulate the block pointers in the original ops.
	if cuea.fromName != cuea.toName {
		retUnmergedOps := make([]op, len(unmergedOps))
		for _, uop := range unmergedOps {
			done := false
			switch realOp := uop.(type) {
			// The only names that matter are in createOps or
			// setAttrOps.  rms on the unmerged side wouldn't be
			// part of the unmerged entry
			case *createOp:
				if realOp.NewName == cuea.fromName {
					realOpCopy := *realOp
					realOpCopy.NewName = cuea.toName
					retUnmergedOps = append(retUnmergedOps, &realOpCopy)
					done = true
				}
			case *setAttrOp:
				if realOp.Name == cuea.fromName {
					realOpCopy := *realOp
					realOpCopy.Name = cuea.toName
					retUnmergedOps = append(retUnmergedOps, &realOpCopy)
					done = true
				}
			}
			if !done {
				retUnmergedOps = append(retUnmergedOps, uop)
			}
		}
	}

	return retUnmergedOps, retMergedOps, nil
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
	attr     attrChange
}

func (cuaa *copyUnmergedAttrAction) do(config Config,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	return unmergedOps, mergedOps, nil
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

func (rmea *rmMergedEntryAction) do(config Config,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	return unmergedOps, mergedOps, nil
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

func (rua *renameUnmergedAction) do(config Config,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	return unmergedOps, mergedOps, nil
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

func (rma *renameMergedAction) do(config Config,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	return unmergedOps, mergedOps, nil
}

func (rma *renameMergedAction) String() string {
	return fmt.Sprintf("renameMerged: %s -> %s", rma.fromName, rma.toName)
}

// dropUnmergedAction says that the corresponding unmerged
// operation should be dropped.
type dropUnmergedAction struct {
	op op
}

func (dua *dropUnmergedAction) do(config Config,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	return unmergedOps, mergedOps, nil
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
			switch untypedTopAction.(type) {
			case *renameUnmergedAction:
				indicesToRemove[i] = true
			case *copyUnmergedEntryAction:
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
