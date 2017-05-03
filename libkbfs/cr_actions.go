// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"golang.org/x/net/context"
)

// copyUnmergedEntryAction says that the unmerged entry for the given
// name should be copied directly into the merged version of the
// directory; there should be no conflict.  If symPath is non-empty, then
// the unmerged entry becomes a symlink to that path.
//
// Note that under some circumstances (e.g., when the target entry has
// been updated in the merged branch but not in the unmerged branch),
// this action may copy the /merged/ entry instead of the unmerged
// one.
type copyUnmergedEntryAction struct {
	fromName      string
	toName        string
	symPath       string
	sizeOnly      bool
	unique        bool
	unmergedEntry DirEntry
	attr          []attrChange
}

func fixupNamesInOps(fromName string, toName string, ops []op,
	chains *crChains) (retOps []op) {
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
				// Fix up the new name if this is a rename.
				if realOp.renamed && len(realOp.Refs()) > 0 {
					renamed := realOp.Refs()[0]
					original, ok := chains.originals[renamed]
					if !ok {
						original = renamed
					}
					if ri, ok := chains.renamedOriginals[original]; ok {
						ri.newName = toName
						chains.renamedOriginals[original] = ri
					}
				}
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

func (cuea *copyUnmergedEntryAction) swapUnmergedBlock(
	unmergedChains *crChains, mergedChains *crChains,
	unmergedBlock *DirBlock) (bool, BlockPointer, error) {
	if cuea.symPath != "" {
		return false, zeroPtr, nil
	}

	unmergedEntry, ok := unmergedBlock.Children[cuea.fromName]
	if !ok {
		return false, zeroPtr, NoSuchNameError{cuea.fromName}
	}

	// If:
	//   * The entry BlockPointer has an unmerged chain with no (or
	//     attr-only) ops; AND
	//   * The entry BlockPointer does have a (non-deleted) merged chain
	// copy the merged entry instead by fetching the block for its merged
	// most recent parent and using that as the source, just copying over
	// the "sizeAttr" fields.
	ptr := unmergedEntry.BlockPointer
	if chain, ok := unmergedChains.byMostRecent[ptr]; ok {
		// If the chain has only setAttr ops, we still want to do the
		// swap, but we need to preserve those unmerged attr changes.
		for _, op := range chain.ops {
			// As soon as we find an op that is NOT a setAttrOp, we
			// should abort the swap.  Otherwise save the changed
			// attributes so we can re-apply them during do().
			if sao, ok := op.(*setAttrOp); ok {
				cuea.attr = append(cuea.attr, sao.Attr)
			} else {
				return false, zeroPtr, nil
			}
		}
		ptr = chain.original
	}
	if _, ok := mergedChains.byOriginal[ptr]; !ok ||
		mergedChains.isDeleted(ptr) {
		return false, zeroPtr, nil
	}

	// If this entry was renamed, use the new parent; otherwise,
	// return zeroPtr.
	parentOrig, newName, ok := mergedChains.renamedParentAndName(ptr)
	cuea.unmergedEntry = unmergedEntry
	cuea.sizeOnly = true
	if !ok {
		// What about the unmerged branch?
		ri, ok := unmergedChains.renamedOriginals[ptr]
		if !ok {
			return true, zeroPtr, nil
		}
		parentOrig = ri.originalOldParent
		newName = ri.oldName
	}
	parentMostRecent, err :=
		mergedChains.mostRecentFromOriginalOrSame(parentOrig)
	if err != nil {
		return false, zeroPtr, err
	}
	cuea.fromName = newName
	return true, parentMostRecent, nil
}

func uniquifyName(block *DirBlock, name string) (string, error) {
	if _, ok := block.Children[name]; !ok {
		return name, nil
	}

	base, ext := splitExtension(name)
	for i := 1; i <= 100; i++ {
		newName := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if _, ok := block.Children[newName]; !ok {
			return newName, nil
		}
	}

	return "", fmt.Errorf("Couldn't find a unique name for %s", name)
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

	// Make sure this entry is unique.
	if cuea.unique {
		newName, err := uniquifyName(mergedBlock, cuea.toName)
		if err != nil {
			return err
		}
		cuea.toName = newName
	}

	if cuea.sizeOnly {
		if entry, ok := mergedBlock.Children[cuea.toName]; ok {
			entry.Size = unmergedEntry.Size
			entry.EncodedSize = unmergedEntry.EncodedSize
			entry.BlockPointer = unmergedEntry.BlockPointer
			mergedBlock.Children[cuea.toName] = entry
			return nil
		}
		// copy any attrs that were explicitly set on the unmerged
		// branch.
		for _, a := range cuea.attr {
			switch a {
			case exAttr:
				unmergedEntry.Type = cuea.unmergedEntry.Type
			case mtimeAttr:
				unmergedEntry.Mtime = cuea.unmergedEntry.Mtime
			}
		}
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

func crActionConvertSymlink(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, unmergedChain *crChain,
	mergedChains *crChains, fromName string, toName string) error {
	// If this was turned into a symlink, then we have to simulate
	// rm/create at the beginning of the mergedOps list.
	ro, err := newRmOp(fromName, mergedMostRecent)
	if err != nil {
		return err
	}
	// Add a fake unref so this rm doesn't get mistaken for one
	// half of a rename operation.
	ro.AddUnrefBlock(zeroPtr)
	co, err := newCreateOp(toName, mergedMostRecent, Sym)
	if err != nil {
		return err
	}

	// If the chain already exists, just append the operations instead
	// of prepending them.  We don't want to do any rms of nodes that
	// the merged chain might also touch (e.g., a double rename
	// situation).
	chain, ok := mergedChains.byMostRecent[mergedMostRecent]
	if ok {
		chain.ops = append(chain.ops, ro, co)
	} else {
		err := prependOpsToChain(mergedMostRecent, mergedChains, ro, co)
		if err != nil {
			return err
		}
	}
	return nil
}

// trackSyncPtrChangesInCreate makes sure the correct set of refs and
// unrefs, from the syncOps on the unmerged branch, makes it into the
// createOp for a new file.
func trackSyncPtrChangesInCreate(
	mostRecentTargetPtr BlockPointer, unmergedChain *crChain,
	unmergedChains *crChains, toName string) {
	targetChain, ok := unmergedChains.byMostRecent[mostRecentTargetPtr]
	var refs, unrefs []BlockPointer
	if ok && targetChain.isFile() {
		// The create op also needs to reference the child block ptrs
		// created by any sync ops (and not unreferenced by future
		// ones).
		for _, op := range targetChain.ops {
			syncOp, ok := op.(*syncOp)
			if !ok {
				continue
			}
			for _, ref := range op.Refs() {
				if !unmergedChains.isDeleted(ref) {
					refs = append(refs, ref)
				}
			}
			for _, unref := range op.Unrefs() {
				unrefs = append(unrefs, unref)
			}
			// Account for the file ptr too, if it's the most recent.
			filePtr := syncOp.File.Ref
			_, isMostRecent := unmergedChains.byMostRecent[filePtr]
			if isMostRecent && !unmergedChains.isDeleted(filePtr) {
				refs = append(refs, filePtr)
			}
		}
	}
	if len(refs) > 0 {
		for _, uop := range unmergedChain.ops {
			cop, ok := uop.(*createOp)
			if !ok || cop.NewName != toName {
				continue
			}
			for _, ref := range refs {
				cop.AddRefBlock(ref)
			}
			for _, unref := range unrefs {
				cop.AddUnrefBlock(unref)
			}
			break
		}
	}
}

func (cuea *copyUnmergedEntryAction) trackSyncPtrChangesInCreate(
	mostRecentTargetPtr BlockPointer, unmergedChain *crChain,
	unmergedChains *crChains) {
	trackSyncPtrChangesInCreate(
		mostRecentTargetPtr, unmergedChain, unmergedChains, cuea.toName)
}

func makeLocalRenameOpForCopyAction(
	mergedMostRecent BlockPointer, mergedBlock *DirBlock,
	mergedChains *crChains, fromName, toName string) error {
	newMergedEntry, ok := mergedBlock.Children[toName]
	if !ok {
		return NoSuchNameError{toName}
	}

	rop, err := newRenameOp(fromName, mergedMostRecent, toName,
		mergedMostRecent, newMergedEntry.BlockPointer,
		newMergedEntry.Type)
	if err != nil {
		return err
	}
	err = prependOpsToChain(mergedMostRecent, mergedChains, rop)
	if err != nil {
		return err
	}
	return nil
}

func (cuea *copyUnmergedEntryAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, unmergedBlock *DirBlock,
	mergedBlock *DirBlock, unmergedChains *crChains,
	mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	if cuea.symPath != "" && !unmergedChain.isFile() {
		err := crActionConvertSymlink(unmergedMostRecent, mergedMostRecent,
			unmergedChain, mergedChains, cuea.fromName, cuea.toName)
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
			fixupNamesInOps(cuea.fromName, cuea.toName, unmergedChain.ops,
				unmergedChains)

		// We need a local rename notification if the name changed.
		makeLocalRenameOpForCopyAction(mergedMostRecent, mergedBlock,
			mergedChains, cuea.fromName, cuea.toName)
	}

	// If the target is a file that had child blocks, we need to
	// transfer those references over to the createOp.
	mergedEntry, ok := mergedBlock.Children[cuea.toName]
	if !ok {
		return fmt.Errorf("Couldn't find merged entry for %s", cuea.toName)
	}
	mostRecentTargetPtr := mergedEntry.BlockPointer
	cuea.trackSyncPtrChangesInCreate(mostRecentTargetPtr, unmergedChain,
		unmergedChains)

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
	moved    bool // move this action to the parent at most one time
}

func (cuaa *copyUnmergedAttrAction) swapUnmergedBlock(
	unmergedChains *crChains, mergedChains *crChains,
	unmergedBlock *DirBlock) (bool, BlockPointer, error) {
	return false, zeroPtr, nil
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
	mergedMostRecent BlockPointer, unmergedBlock *DirBlock,
	mergedBlock *DirBlock, unmergedChains *crChains,
	mergedChains *crChains) error {
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
			fixupNamesInOps(cuaa.fromName, cuaa.toName, unmergedChain.ops,
				unmergedChains)

		// We need a local rename notification if the name changed.
		makeLocalRenameOpForCopyAction(mergedMostRecent, mergedBlock,
			mergedChains, cuaa.fromName, cuaa.toName)
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

func (rmea *rmMergedEntryAction) swapUnmergedBlock(
	unmergedChains *crChains, mergedChains *crChains,
	unmergedBlock *DirBlock) (bool, BlockPointer, error) {
	return false, zeroPtr, nil
}

func (rmea *rmMergedEntryAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	delete(mergedBlock.Children, rmea.name)
	return nil
}

func (rmea *rmMergedEntryAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, unmergedBlock *DirBlock,
	mergedBlock *DirBlock, unmergedChains *crChains,
	mergedChains *crChains) error {
	return nil
}

func (rmea *rmMergedEntryAction) String() string {
	return fmt.Sprintf("rmMergedEntry: %s", rmea.name)
}

// renameUnmergedAction says that the unmerged copy of a file needs to
// be renamed, and the file blocks should be copied.
type renameUnmergedAction struct {
	fromName     string
	toName       string
	symPath      string
	causedByAttr attrChange // was this rename caused by a setAttr?
	moved        bool       // move this action to the parent at most one time

	// Set if this conflict is between file writes, and the parent
	// chains need to be updated with new create/rename operations.
	unmergedParentMostRecent BlockPointer
	mergedParentMostRecent   BlockPointer
}

func crActionCopyFile(ctx context.Context, copier fileBlockDeepCopier,
	fromName string, toName string, toSymPath string,
	fromBlock *DirBlock, toBlock *DirBlock) (
	BlockPointer, string, error) {
	// Find the source entry.
	fromEntry, ok := fromBlock.Children[fromName]
	if !ok {
		return BlockPointer{}, "", NoSuchNameError{fromName}
	}

	if toSymPath != "" {
		fromEntry.Type = Sym
		fromEntry.SymPath = toSymPath
	}

	// We only rename files (or make symlinks to directories).
	if fromEntry.Type == Dir {
		// Just fill in the last path node, we don't have the full path.
		return BlockPointer{}, "", NotFileError{path{path: []pathNode{{
			BlockPointer: fromEntry.BlockPointer,
			Name:         fromName,
		}}}}
	}

	// Make sure the name is unique.
	name, err := uniquifyName(toBlock, toName)
	if err != nil {
		return BlockPointer{}, "", err
	}

	var ptr BlockPointer
	if toSymPath == "" && fromEntry.BlockPointer.IsInitialized() {
		// Fetch the top block for copyable files.
		var err error
		ptr, err = copier(ctx, name, fromEntry.BlockPointer)
		if err != nil {
			return BlockPointer{}, "", err
		}
	}

	// Set the entry with the new pointer.
	oldPointer := fromEntry.BlockPointer
	fromEntry.BlockPointer = ptr
	toBlock.Children[name] = fromEntry
	return oldPointer, name, nil
}

func (rua *renameUnmergedAction) swapUnmergedBlock(
	unmergedChains *crChains, mergedChains *crChains,
	unmergedBlock *DirBlock) (bool, BlockPointer, error) {
	return false, zeroPtr, nil
}

func (rua *renameUnmergedAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	_, name, err := crActionCopyFile(ctx, unmergedCopier, rua.fromName,
		rua.toName, rua.symPath, unmergedBlock, mergedBlock)
	if err != nil {
		return err
	}
	rua.toName = name
	return nil
}

func (rua *renameUnmergedAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, unmergedBlock *DirBlock,
	mergedBlock *DirBlock, unmergedChains *crChains,
	mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	if rua.symPath != "" && !unmergedChain.isFile() {
		err := crActionConvertSymlink(unmergedMostRecent, mergedMostRecent,
			unmergedChain, mergedChains, rua.fromName, rua.toName)
		if err != nil {
			return err
		}
	}

	// Rename all operations with the old name to the new name.
	unmergedChain.ops =
		fixupNamesInOps(rua.fromName, rua.toName, unmergedChain.ops,
			unmergedChains)

	// The newly renamed entry:
	newMergedEntry, ok := mergedBlock.Children[rua.toName]
	if !ok {
		return NoSuchNameError{rua.toName}
	}

	if unmergedChain.isFile() {
		// Replace the updates on all file operations.
		for _, op := range unmergedChain.ops {
			switch realOp := op.(type) {
			case *syncOp:
				var err error
				realOp.File, err = makeBlockUpdate(
					newMergedEntry.BlockPointer,
					newMergedEntry.BlockPointer)
				if err != nil {
					return err
				}
				// Nuke the previously referenced blocks, they are no
				// longer relevant.
				realOp.RefBlocks = nil
			case *setAttrOp:
				realOp.File = newMergedEntry.BlockPointer
			}
		}

		if !rua.unmergedParentMostRecent.IsInitialized() {
			// This is not a file-file conflict.
			return nil
		}

		unmergedChain, ok =
			unmergedChains.byMostRecent[rua.unmergedParentMostRecent]
		if !ok {
			// Couldn't find the parent to update.  Sigh.
			return fmt.Errorf("Couldn't find parent %v to update "+
				"renameUnmergedAction for file %v (%s)",
				rua.unmergedParentMostRecent, unmergedMostRecent, rua.toName)
		}
		unmergedMostRecent = rua.unmergedParentMostRecent
		mergedMostRecent = rua.mergedParentMostRecent
	}

	// Prepend a rename for the unmerged copy to the merged set of
	// operations, with another create for the merged file, for local
	// playback.

	// The entry that got renamed in the unmerged branch:
	unmergedEntry, ok := unmergedBlock.Children[rua.fromName]
	if !ok {
		return NoSuchNameError{rua.fromName}
	}

	// The entry that gets created in the unmerged branch:
	mergedEntry, ok := mergedBlock.Children[rua.fromName]
	if !ok {
		return NoSuchNameError{rua.fromName}
	}

	rop, err := newRenameOp(rua.fromName, mergedMostRecent, rua.toName,
		mergedMostRecent, newMergedEntry.BlockPointer,
		newMergedEntry.Type)
	if err != nil {
		return err
	}
	// For local notifications, we need to transform the entry's
	// pointer into the new (de-dup'd) pointer.  newMergedEntry is
	// not yet the final pointer (that happens during syncBlock),
	// but a later stage will convert it.
	if rua.symPath == "" {
		rop.AddUpdate(unmergedEntry.BlockPointer,
			newMergedEntry.BlockPointer)
	}
	co, err := newCreateOp(rua.fromName, mergedMostRecent, mergedEntry.Type)
	if err != nil {
		return err
	}
	err = prependOpsToChain(mergedMostRecent, mergedChains, rop, co)
	if err != nil {
		return err
	}

	// Before merging the unmerged ops, create a file with the new
	// name, unless the create already exists.
	found := false
	co = nil
	for _, op := range unmergedChain.ops {
		var ok bool
		if co, ok = op.(*createOp); ok && co.NewName == rua.toName {
			found = true
			if len(co.RefBlocks) > 0 {
				co.RefBlocks[0] = newMergedEntry.BlockPointer
			}
			break
		}
	}
	if !found {
		co, err = newCreateOp(rua.toName, unmergedMostRecent, mergedEntry.Type)
		if err != nil {
			return err
		}
		if rua.symPath == "" {
			co.AddRefBlock(newMergedEntry.BlockPointer)
		}
		err = prependOpsToChain(unmergedMostRecent, unmergedChains, co)
		if err != nil {
			return err
		}
	}
	// Since we copied the node, unref the old block but only if
	// it's not a symlink and the name changed.  If the name is
	// the same, it means the old block pointer is still in use
	// because we just did a copy of a node still in use in the
	// merged branch.
	if unmergedEntry.BlockPointer != newMergedEntry.BlockPointer &&
		rua.fromName != rua.toName && rua.symPath == "" {
		co.AddUnrefBlock(unmergedEntry.BlockPointer)
	}

	return nil
}

func (rua *renameUnmergedAction) String() string {
	return fmt.Sprintf("renameUnmerged: %s -> %s %s", rua.fromName, rua.toName,
		rua.symPath)
}

// renameMergedAction says that the merged copy of a file needs to be
// renamed, and the unmerged entry should be added to the merged block
// under the old from name.  Merged file blocks do not have to be
// copied, because renaming a merged file can only happen when the
// conflict is with a non-file in the unmerged branch; thus, there can
// be no shared blocks between the two.
//
// Note that symPath below refers to the unmerged entry that is being
// copied into the merged block.
type renameMergedAction struct {
	fromName string
	toName   string
	symPath  string
}

func (rma *renameMergedAction) swapUnmergedBlock(
	unmergedChains *crChains, mergedChains *crChains,
	unmergedBlock *DirBlock) (bool, BlockPointer, error) {
	return false, zeroPtr, nil
}

func (rma *renameMergedAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	// Find the merged entry
	mergedEntry, ok := mergedBlock.Children[rma.fromName]
	if !ok {
		return NoSuchNameError{rma.fromName}
	}

	// Make sure this entry is unique.
	newName, err := uniquifyName(mergedBlock, rma.toName)
	if err != nil {
		return err
	}
	rma.toName = newName

	mergedBlock.Children[rma.toName] = mergedEntry

	// Add the unmerged entry as the new "fromName".
	unmergedEntry, ok := unmergedBlock.Children[rma.fromName]
	if !ok {
		return NoSuchNameError{rma.fromName}
	}
	if rma.symPath != "" {
		unmergedEntry.Type = Sym
		unmergedEntry.SymPath = rma.symPath
	}
	mergedBlock.Children[rma.fromName] = unmergedEntry

	return nil
}

func (rma *renameMergedAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, unmergedBlock *DirBlock,
	mergedBlock *DirBlock, unmergedChains *crChains,
	mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	if rma.symPath != "" && !unmergedChain.isFile() {
		err := crActionConvertSymlink(unmergedMostRecent, mergedMostRecent,
			unmergedChain, mergedChains, rma.fromName, rma.fromName)
		if err != nil {
			return err
		}
	}

	// Rename all operations with the old name to the new name.
	mergedChain := mergedChains.byMostRecent[mergedMostRecent]
	if mergedChain != nil {
		mergedChain.ops =
			fixupNamesInOps(rma.fromName, rma.toName, mergedChain.ops,
				mergedChains)
	}

	if !unmergedChain.isFile() {
		// The entry that gets renamed in the unmerged branch:
		mergedEntry, ok := mergedBlock.Children[rma.toName]
		if !ok {
			return NoSuchNameError{rma.toName}
		}

		// Prepend a rename for the merged copy to the unmerged set of
		// operations.
		rop, err := newRenameOp(rma.fromName, unmergedMostRecent, rma.toName,
			unmergedMostRecent, mergedEntry.BlockPointer, mergedEntry.Type)
		if err != nil {
			return err
		}
		err = prependOpsToChain(unmergedMostRecent, unmergedChains, rop)
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
			co, err := newCreateOp(rma.toName, mergedMostRecent, mergedEntry.Type)
			if err != nil {
				return err
			}
			err = prependOpsToChain(mergedMostRecent, mergedChains, co)
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

func (dua *dropUnmergedAction) swapUnmergedBlock(
	unmergedChains *crChains, mergedChains *crChains,
	unmergedBlock *DirBlock) (bool, BlockPointer, error) {
	return false, zeroPtr, nil
}

func (dua *dropUnmergedAction) do(ctx context.Context,
	unmergedCopier fileBlockDeepCopier, mergedCopier fileBlockDeepCopier,
	unmergedBlock *DirBlock, mergedBlock *DirBlock) error {
	return nil
}

func (dua *dropUnmergedAction) updateOps(unmergedMostRecent BlockPointer,
	mergedMostRecent BlockPointer, unmergedBlock *DirBlock,
	mergedBlock *DirBlock, unmergedChains *crChains,
	mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	found := false
	for i, op := range unmergedChain.ops {
		if op == dua.op {
			unmergedChain.ops =
				append(unmergedChain.ops[:i], unmergedChain.ops[i+1:]...)
			found = true
			break
		}
	}

	// Return early if this chain didn't contain the op; no need to
	// invert on the merged chain in that case.
	if !found {
		return nil
	}

	invertedOp, err := invertOpForLocalNotifications(dua.op)
	if err != nil {
		return err
	}
	err = prependOpsToChain(mergedMostRecent, mergedChains, invertedOp)
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
							break
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
