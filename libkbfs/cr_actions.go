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

func (cuea *copyUnmergedEntryAction) do(ctx context.Context, config Config,
	fetchUnmergedBlockCopy blockCopyFetcher,
	fetchMergedBlockCopy blockCopyFetcher,
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
		// a rename at the beginning of the mergedOps list.  Even if
		// the names are the same, this should clear out the caches of
		// any observers.
		retMergedOps = append([]op{newRenameOp(
			cuea.fromName, unmergedMostRecent, cuea.toName,
			unmergedMostRecent, unmergedEntry.BlockPointer)}, mergedOps...)
	}

	mergedBlock.Children[cuea.toName] = unmergedEntry

	// If the name changed, we have to update all the unmerged ops
	// with the new name.
	// The merged ops don't change, though later we may have to
	// manipulate the block pointers in the original ops.
	if cuea.fromName != cuea.toName {
		retUnmergedOps =
			fixupNamesInOps(cuea.fromName, cuea.toName, unmergedOps)
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
	attr     []attrChange
}

func (cuaa *copyUnmergedAttrAction) do(ctx context.Context, config Config,
	fetchUnmergedBlockCopy blockCopyFetcher,
	fetchMergedBlockCopy blockCopyFetcher,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	// Find the unmerged entry
	unmergedEntry, ok := unmergedBlock.Children[cuaa.fromName]
	if !ok {
		return nil, nil, NoSuchNameError{cuaa.fromName}
	}

	mergedEntry, ok := mergedBlock.Children[cuaa.toName]
	if !ok {
		return nil, nil, NoSuchNameError{cuaa.toName}
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

	// If the name changed, we have to update all the unmerged ops
	// with the new name.
	// The merged ops don't change, though later we may have to
	// manipulate the block pointers in the original ops.
	if cuaa.fromName != cuaa.toName {
		retUnmergedOps =
			fixupNamesInOps(cuaa.fromName, cuaa.toName, unmergedOps)
	}

	return retUnmergedOps, retMergedOps, nil
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

func (rmea *rmMergedEntryAction) do(ctx context.Context, config Config,
	fetchUnmergedBlockCopy blockCopyFetcher,
	fetchMergedBlockCopy blockCopyFetcher,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	if _, ok := mergedBlock.Children[rmea.name]; !ok {
		return nil, nil, NoSuchNameError{rmea.name}
	}
	delete(mergedBlock.Children, rmea.name)
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

func crActionCopyFile(ctx context.Context, config Config,
	fetchBlockCopy blockCopyFetcher, fromName string, toName string,
	fromBlock *DirBlock, toBlock *DirBlock) (fromEntry DirEntry, err error) {
	// Find the source entry.
	fromEntry, ok := fromBlock.Children[fromName]
	if !ok {
		return DirEntry{}, NoSuchNameError{fromName}
	}

	// We only rename files.
	if fromEntry.Type == Dir {
		// Just fill in the last path node, we don't have the full path.
		return DirEntry{}, NotFileError{path{path: []pathNode{pathNode{
			BlockPointer: fromEntry.BlockPointer,
			Name:         fromName,
		}}}}
	}

	// Fetch the top block, and dup all of the leaf blocks.
	// TODO: deal with multiple levels of indirection.
	ptr, fblock, err := fetchBlockCopy(toName, fromEntry.BlockPointer)
	if err != nil {
		return DirEntry{}, err
	}
	if fblock.IsInd {
		uid, err := config.KBPKI().GetCurrentUID(ctx)
		if err != nil {
			return DirEntry{}, err
		}
		for i, ptr := range fblock.IPtrs {
			// Generate a new nonce for each one.
			ptr.RefNonce, err = config.Crypto().MakeBlockRefNonce()
			if err != nil {
				return DirEntry{}, err
			}
			ptr.SetWriter(uid)
			fblock.IPtrs[i] = ptr
		}
	}
	// Set the entry under the new name, with the new pointer.
	fromEntry.BlockPointer = ptr
	toBlock.Children[toName] = fromEntry
	return fromEntry, nil
}

func (rua *renameUnmergedAction) do(ctx context.Context, config Config,
	fetchUnmergedBlockCopy blockCopyFetcher,
	fetchMergedBlockCopy blockCopyFetcher,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	unmergedEntry, err := crActionCopyFile(ctx, config,
		fetchUnmergedBlockCopy, rua.fromName, rua.toName, unmergedBlock,
		mergedBlock)
	if err != nil {
		return nil, nil, err
	}

	mergedEntry, ok := mergedBlock.Children[rua.fromName]
	if !ok {
		return nil, nil, NoSuchNameError{rua.fromName}
	}

	// Prepend a rename for the unmerged copy to the merged set of
	// operations, with another create for the merged file, for local
	// playback.  XXX: this isn't quite right because mergedMostRecent
	// is not a valid BlockPointer when we start playing back these
	// operations.  Hrmmm, I will fix this up in a future commit once
	// I know exactly how the operations will be fixed up and played
	// forward.
	retMergedOps = append([]op{
		newRenameOp(rua.fromName, unmergedMostRecent, rua.toName,
			mergedMostRecent, unmergedEntry.BlockPointer),
		newCreateOp(rua.fromName, mergedMostRecent, mergedEntry.Type),
	}, mergedOps...)

	// Before merging the unmerged ops, create a file with the new
	// name, and then rename all subsequent ops with it.
	retUnmergedOps = append([]op{
		newCreateOp(rua.toName, mergedMostRecent, unmergedEntry.Type),
	}, unmergedOps...)
	retUnmergedOps = fixupNamesInOps(rua.fromName, rua.toName, retUnmergedOps)
	return retUnmergedOps, retMergedOps, nil
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

func (rma *renameMergedAction) do(ctx context.Context, config Config,
	fetchUnmergedBlockCopy blockCopyFetcher,
	fetchMergedBlockCopy blockCopyFetcher,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	mergedEntry, err := crActionCopyFile(ctx, config,
		fetchMergedBlockCopy, rma.fromName, rma.toName, mergedBlock,
		mergedBlock)
	if err != nil {
		return nil, nil, err
	}

	unmergedEntry, ok := unmergedBlock.Children[rma.fromName]
	if !ok {
		return nil, nil, NoSuchNameError{rma.fromName}
	}
	mergedBlock.Children[rma.fromName] = unmergedEntry

	// Prepend a rename for the merged copy to the unmerged set of
	// operations, with another create for the unmerged file, for remote
	// playback.
	retUnmergedOps = append([]op{
		newRenameOp(rma.fromName, mergedMostRecent, rma.toName,
			mergedMostRecent, mergedEntry.BlockPointer),
		newCreateOp(rma.fromName, mergedMostRecent, unmergedEntry.Type),
	}, unmergedOps...)

	// Before merging the unmerged ops, create a file with the new
	// name, and then rename all subsequent ops with it.  XXX: this
	// isn't quite right because mergedMostRecent is not a valid
	// BlockPointer when we start playing back these operations.
	// Hrmmm, I will fix this up in a future commit once I know
	// exactly how the operations will be fixed up and played forward.
	retMergedOps = append([]op{
		newCreateOp(rma.toName, mergedMostRecent, mergedEntry.Type),
	}, mergedOps...)
	retMergedOps = fixupNamesInOps(rma.fromName, rma.toName, retMergedOps)
	return retUnmergedOps, retMergedOps, nil
}

func (rma *renameMergedAction) String() string {
	return fmt.Sprintf("renameMerged: %s -> %s", rma.fromName, rma.toName)
}

// dropUnmergedAction says that the corresponding unmerged
// operation should be dropped.
type dropUnmergedAction struct {
	op op
}

func (dua *dropUnmergedAction) do(ctx context.Context, config Config,
	fetchUnmergedBlockCopy blockCopyFetcher,
	fetchMergedBlockCopy blockCopyFetcher,
	unmergedMostRecent BlockPointer, mergedMostRecent BlockPointer,
	unmergedOps []op, mergedOps []op, unmergedBlock *DirBlock,
	mergedBlock *DirBlock) (retUnmergedOps []op, retMergedOps []op, err error) {
	for i, op := range unmergedOps {
		if op == dua.op {
			retUnmergedOps = append(unmergedOps[:i], unmergedOps[i+1:]...)
			break
		}
	}

	invertedOp := invertOpForLocalNotifications(dua.op)
	// XXX: Need to fix up the pointers in invertedOp.
	retMergedOps = append([]op{invertedOp}, mergedOps...)
	return retUnmergedOps, retMergedOps, nil
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
