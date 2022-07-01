// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/pkg/errors"
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
	fromName      data.PathPartString
	toName        data.PathPartString
	symPath       data.PathPartString
	sizeOnly      bool
	unique        bool
	unmergedEntry data.DirEntry
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
	ctx context.Context, unmergedChains, mergedChains *crChains,
	unmergedDir *data.DirData) (bool, data.BlockPointer, error) {
	if cuea.symPath.Plaintext() != "" {
		return false, data.ZeroPtr, nil
	}

	unmergedEntry, err := unmergedDir.Lookup(ctx, cuea.fromName)
	if err != nil {
		return false, data.ZeroPtr, err
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
				return false, data.ZeroPtr, nil
			}
		}
		ptr = chain.original
	}
	if _, ok := mergedChains.byOriginal[ptr]; !ok ||
		mergedChains.isDeleted(ptr) {
		return false, data.ZeroPtr, nil
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
			return true, data.ZeroPtr, nil
		}
		parentOrig = ri.originalOldParent
		newName = ri.oldName
	}
	parentMostRecent, err :=
		mergedChains.mostRecentFromOriginalOrSame(parentOrig)
	if err != nil {
		return false, data.ZeroPtr, err
	}
	cuea.fromName = data.NewPathPartString(newName, cuea.fromName.Obfuscator())
	return true, parentMostRecent, nil
}

func uniquifyName(
	ctx context.Context, dir *data.DirData, name data.PathPartString) (
	data.PathPartString, error) {
	_, err := dir.Lookup(ctx, name)
	switch errors.Cause(err).(type) {
	case nil:
	case idutil.NoSuchNameError:
		return name, nil
	default:
		return data.PathPartString{}, err
	}

	base, ext := data.SplitFileExtension(name.Plaintext())
	for i := 1; i <= 100; i++ {
		newName := data.NewPathPartString(
			fmt.Sprintf("%s (%d)%s", base, i, ext), name.Obfuscator())
		_, err := dir.Lookup(ctx, newName)
		switch errors.Cause(err).(type) {
		case nil:
		case idutil.NoSuchNameError:
			return newName, nil
		default:
			return data.PathPartString{}, err
		}
	}

	return data.PathPartString{}, fmt.Errorf(
		"Couldn't find a unique name for %s", name)
}

func (cuea *copyUnmergedEntryAction) do(
	ctx context.Context, unmergedCopier, mergedCopier fileBlockDeepCopier,
	unmergedDir, mergedDir *data.DirData) ([]data.BlockInfo, error) {
	// Find the unmerged entry
	unmergedEntry, err := unmergedDir.Lookup(ctx, cuea.fromName)
	if err != nil {
		return nil, err
	}

	if cuea.symPath.Plaintext() != "" {
		unmergedEntry.Type = data.Sym
		unmergedEntry.SymPath = cuea.symPath.Plaintext()
	}

	// Make sure this entry is unique.
	if cuea.unique {
		newName, err := uniquifyName(ctx, mergedDir, cuea.toName)
		if err != nil {
			return nil, err
		}
		cuea.toName = newName
	}

	mergedEntry, err := mergedDir.Lookup(ctx, cuea.toName)
	mergedEntryOk := true
	switch errors.Cause(err).(type) {
	case nil:
	case idutil.NoSuchNameError:
		mergedEntryOk = false
	default:
		return nil, err
	}

	if cuea.sizeOnly {
		if mergedEntryOk {
			mergedEntry.Size = unmergedEntry.Size
			mergedEntry.EncodedSize = unmergedEntry.EncodedSize
			mergedEntry.BlockPointer = unmergedEntry.BlockPointer
			return mergedDir.SetEntry(ctx, cuea.toName, mergedEntry)
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

	// Throw out all the unmerged revisions and start over with the
	// merged revisions.
	if mergedEntryOk {
		unmergedEntry.PrevRevisions = mergedEntry.PrevRevisions
	} else {
		unmergedEntry.PrevRevisions = nil
	}

	return mergedDir.SetEntry(ctx, cuea.toName, unmergedEntry)
}

func prependOpsToChain(mostRecent data.BlockPointer, chains *crChains,
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
	for _, op := range newOps {
		chain.ensurePath(op, mostRecent)
	}
	// prepend it
	chain.ops = append(newOps, chain.ops...)
	return nil
}

func crActionConvertSymlink(unmergedMostRecent data.BlockPointer,
	mergedMostRecent data.BlockPointer, unmergedChain *crChain,
	mergedChains *crChains, toName string) error {
	co, err := newCreateOp(toName, mergedMostRecent, data.Sym)
	if err != nil {
		return err
	}

	// If the chain already exists, just append the operation instead
	// of prepending them.  If there was something else at that
	// location in the unmerged branch, it should be moved out of the
	// way first by a `renameOp` (see
	// `makeLocalRenameOpForCopyAction()`).
	chain, ok := mergedChains.byMostRecent[mergedMostRecent]
	if ok {
		chain.ensurePath(co, mergedMostRecent)
		chain.ops = append(chain.ops, co)
	} else {
		err := prependOpsToChain(mergedMostRecent, mergedChains, co)
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
	mostRecentTargetPtr data.BlockPointer, unmergedChain *crChain,
	unmergedChains *crChains, toName string) {
	targetChain, ok := unmergedChains.byMostRecent[mostRecentTargetPtr]
	var refs, unrefs []data.BlockPointer
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
			unrefs = append(unrefs, op.Unrefs()...)
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
	mostRecentTargetPtr data.BlockPointer, unmergedChain *crChain,
	unmergedChains *crChains) {
	trackSyncPtrChangesInCreate(
		mostRecentTargetPtr, unmergedChain, unmergedChains,
		cuea.toName.Plaintext())
}

func makeLocalRenameOpForCopyAction(
	ctx context.Context, mergedMostRecent data.BlockPointer,
	mergedDir *data.DirData, mergedChains *crChains, fromName,
	toName data.PathPartString) error {
	newMergedEntry, err := mergedDir.Lookup(ctx, toName)
	if err != nil {
		return err
	}

	rop, err := newRenameOp(
		fromName.Plaintext(), mergedMostRecent, toName.Plaintext(),
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

func (cuea *copyUnmergedEntryAction) updateOps(
	ctx context.Context, unmergedMostRecent, mergedMostRecent data.BlockPointer,
	_, mergedDir *data.DirData, unmergedChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	if cuea.symPath.Plaintext() != "" && !unmergedChain.isFile() {
		err := crActionConvertSymlink(unmergedMostRecent, mergedMostRecent,
			unmergedChain, mergedChains, cuea.toName.Plaintext())
		if err != nil {
			return err
		}
	}

	// If the name changed, we have to update all the unmerged ops
	// with the new name.
	// The merged ops don't change, though later we may have to
	// manipulate the block pointers in the original ops.
	if cuea.fromName.Plaintext() != cuea.toName.Plaintext() {
		unmergedChain.ops = fixupNamesInOps(
			cuea.fromName.Plaintext(), cuea.toName.Plaintext(),
			unmergedChain.ops, unmergedChains)

		if cuea.unique || cuea.symPath.Plaintext() != "" {
			// If a directory was renamed locally, either because of a
			// direct conflict or because it was turned into a
			// symlink, we need to fake a merged rename op from the
			// unmerged name to the merged name, before creating the
			// symlink, so the local Node objects are updated
			// correctly.
			err := makeLocalRenameOpForCopyAction(
				ctx, mergedMostRecent, mergedDir, mergedChains, cuea.fromName,
				cuea.toName)
			if err != nil {
				return err
			}
		}
	}

	// If the target is a file that had child blocks, we need to
	// transfer those references over to the createOp.
	mergedEntry, err := mergedDir.Lookup(ctx, cuea.toName)
	if err != nil {
		return err
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
	fromName data.PathPartString
	toName   data.PathPartString
	attr     []attrChange
	moved    bool // move this action to the parent at most one time
}

func (cuaa *copyUnmergedAttrAction) swapUnmergedBlock(
	_ context.Context, _, _ *crChains, _ *data.DirData) (bool, data.BlockPointer, error) {
	return false, data.ZeroPtr, nil
}

func (cuaa *copyUnmergedAttrAction) do(
	ctx context.Context, unmergedCopier, mergedCopier fileBlockDeepCopier,
	unmergedDir, mergedDir *data.DirData) ([]data.BlockInfo, error) {
	// Find the unmerged entry
	unmergedEntry, err := unmergedDir.Lookup(ctx, cuaa.fromName)
	if err != nil {
		return nil, err
	}

	mergedEntry, err := mergedDir.Lookup(ctx, cuaa.toName)
	if err != nil {
		return nil, err
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

	return mergedDir.SetEntry(ctx, cuaa.toName, mergedEntry)
}

func (cuaa *copyUnmergedAttrAction) updateOps(
	_ context.Context, unmergedMostRecent, _ data.BlockPointer,
	_, _ *data.DirData, unmergedChains, _ *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	// If the name changed, we have to update all the unmerged ops
	// with the new name.
	// The merged ops don't change, though later we may have to
	// manipulate the block pointers in the original ops.
	if cuaa.fromName.Plaintext() != cuaa.toName.Plaintext() {
		unmergedChain.ops = fixupNamesInOps(
			cuaa.fromName.Plaintext(), cuaa.toName.Plaintext(),
			unmergedChain.ops, unmergedChains)
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
	name data.PathPartString
}

func (rmea *rmMergedEntryAction) swapUnmergedBlock(
	_ context.Context, _, _ *crChains, _ *data.DirData) (bool, data.BlockPointer, error) {
	return false, data.ZeroPtr, nil
}

func (rmea *rmMergedEntryAction) do(
	ctx context.Context, _, _ fileBlockDeepCopier,
	_, mergedDir *data.DirData) ([]data.BlockInfo, error) {
	unrefs, err := mergedDir.RemoveEntry(ctx, rmea.name)
	if _, notExists := errors.Cause(err).(idutil.NoSuchNameError); notExists {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return unrefs, nil
}

func (rmea *rmMergedEntryAction) updateOps(
	_ context.Context, _, _ data.BlockPointer, _, _ *data.DirData, _, _ *crChains) error {
	return nil
}

func (rmea *rmMergedEntryAction) String() string {
	return fmt.Sprintf("rmMergedEntry: %s", rmea.name)
}

// renameUnmergedAction says that the unmerged copy of a file needs to
// be renamed, and the file blocks should be copied.
type renameUnmergedAction struct {
	fromName     data.PathPartString
	toName       data.PathPartString
	symPath      data.PathPartString
	causedByAttr attrChange // was this rename caused by a setAttr?
	moved        bool       // move this action to the parent at most one time

	// Set if this conflict is between file writes, and the parent
	// chains need to be updated with new create/rename operations.
	unmergedParentMostRecent data.BlockPointer
	mergedParentMostRecent   data.BlockPointer
}

func crActionCopyFile(
	ctx context.Context, copier fileBlockDeepCopier,
	fromName, toName, toSymPath data.PathPartString,
	fromDir, toDir *data.DirData) (
	data.BlockPointer, data.PathPartString, []data.BlockInfo, error) {
	// Find the source entry.
	fromEntry, err := fromDir.Lookup(ctx, fromName)
	if err != nil {
		return data.BlockPointer{}, data.PathPartString{}, nil, err
	}

	if toSymPath.Plaintext() != "" {
		fromEntry.Type = data.Sym
		fromEntry.SymPath = toSymPath.Plaintext()
	}

	// We only rename files (or make symlinks to directories).
	if fromEntry.Type == data.Dir {
		// Just fill in the last path node, we don't have the full path.
		return data.BlockPointer{}, data.PathPartString{}, nil, NotFileError{
			data.Path{Path: []data.PathNode{{
				BlockPointer: fromEntry.BlockPointer,
				Name:         fromName,
			}}}}
	}

	// Make sure the name is unique.
	name, err := uniquifyName(ctx, toDir, toName)
	if err != nil {
		return data.BlockPointer{}, data.PathPartString{}, nil, err
	}

	var ptr data.BlockPointer
	if toSymPath.Plaintext() == "" && fromEntry.BlockPointer.IsInitialized() {
		// Fetch the top block for copyable files.
		var err error
		ptr, err = copier(ctx, name, fromEntry.BlockPointer)
		if err != nil {
			return data.BlockPointer{}, data.PathPartString{}, nil, err
		}
	}

	// Set the entry with the new pointer.
	oldPointer := fromEntry.BlockPointer
	fromEntry.BlockPointer = ptr
	unrefs, err := toDir.SetEntry(ctx, name, fromEntry)
	if err != nil {
		return data.BlockPointer{}, data.PathPartString{}, nil, err
	}
	return oldPointer, name, unrefs, nil
}

func (rua *renameUnmergedAction) swapUnmergedBlock(
	_ context.Context, _, _ *crChains, _ *data.DirData) (bool, data.BlockPointer, error) {
	return false, data.ZeroPtr, nil
}

func (rua *renameUnmergedAction) do(
	ctx context.Context, unmergedCopier, mergedCopier fileBlockDeepCopier,
	unmergedDir, mergedDir *data.DirData) ([]data.BlockInfo, error) {
	_, name, unrefs, err := crActionCopyFile(
		ctx, unmergedCopier, rua.fromName, rua.toName, rua.symPath,
		unmergedDir, mergedDir)
	if err != nil {
		return nil, err
	}
	rua.toName = name
	return unrefs, nil
}

func removeRmOpFromChain(
	original data.BlockPointer, chains *crChains, oldName string) {
	chain := chains.byOriginal[original]
	for i, op := range chain.ops {
		if ro, ok := op.(*rmOp); !ok || ro.OldName != oldName {
			continue
		}
		chain.ops = append(chain.ops[:i], chain.ops[i+1:]...)
	}
}

func (rua *renameUnmergedAction) updateOps(
	ctx context.Context, unmergedMostRecent, mergedMostRecent data.BlockPointer,
	unmergedDir, mergedDir *data.DirData,
	unmergedChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	unmergedEntry, err := unmergedDir.Lookup(ctx, rua.fromName)
	if err != nil {
		return err
	}
	original, err := unmergedChains.originalFromMostRecentOrSame(
		unmergedEntry.BlockPointer)
	if err != nil {
		return err
	}

	if rua.symPath.Plaintext() != "" && !unmergedChain.isFile() {
		err := crActionConvertSymlink(unmergedMostRecent, mergedMostRecent,
			unmergedChain, mergedChains, rua.toName.Plaintext())
		if err != nil {
			return err
		}
	}

	// Rename all operations with the old name to the new name.
	unmergedChain.ops = fixupNamesInOps(
		rua.fromName.Plaintext(), rua.toName.Plaintext(), unmergedChain.ops,
		unmergedChains)

	// The newly renamed entry:
	newMergedEntry, err := mergedDir.Lookup(ctx, rua.toName)
	if err != nil {
		return err
	}

	if unmergedChain.isFile() {
		// Replace the updates on all file operations.
		for _, op := range unmergedChain.ops {
			switch realOp := op.(type) {
			case *syncOp:
				// Only apply to syncs that match the pointer chain
				// for which `updateOps` was called.
				opOriginal, ok := unmergedChains.originals[realOp.File.Ref]
				if !ok {
					opOriginal = realOp.File.Ref
				}
				if opOriginal != original {
					continue
				}

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
				// Only apply to setAttrs that match the pointer chain
				// for which `updateOps` was called.
				opOriginal, ok := unmergedChains.originals[realOp.File]
				if !ok {
					opOriginal = realOp.File
				}
				if opOriginal != original {
					continue
				}

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

	// The entry that gets created in the unmerged branch:
	mergedEntry, err := mergedDir.Lookup(ctx, rua.fromName)
	if err != nil {
		return err
	}

	_, mergedRename := mergedChains.renamedOriginals[original]
	if rua.toName.Plaintext() == rua.fromName.Plaintext() && mergedRename {
		// The merged copy is the one changing its name, so turn the
		// merged rename op into just a create by removing the rmOp.
		removeRmOpFromChain(
			unmergedChain.original, mergedChains, rua.toName.Plaintext())
		if rua.symPath.Plaintext() == "" {
			// Pretend to write to the new, deduplicated unmerged
			// copy, to update its pointer in the node cache.
			so, err := newSyncOp(unmergedEntry.BlockPointer)
			if err != nil {
				return err
			}
			so.AddUpdate(
				unmergedEntry.BlockPointer, newMergedEntry.BlockPointer)
			err = prependOpsToChain(
				unmergedEntry.BlockPointer, mergedChains, so)
			if err != nil {
				return err
			}
		}
	} else {
		// The unmerged copy is changing its name, so make a local
		// rename op for it, and a create op for the merged version.
		rop, err := newRenameOp(
			rua.fromName.Plaintext(), mergedMostRecent, rua.toName.Plaintext(),
			mergedMostRecent, newMergedEntry.BlockPointer, newMergedEntry.Type)
		if err != nil {
			return err
		}
		// For local notifications, we need to transform the entry's
		// pointer into the new (de-dup'd) pointer.  newMergedEntry is
		// not yet the final pointer (that happens during syncBlock),
		// but a later stage will convert it.
		if rua.symPath.Plaintext() == "" {
			rop.AddUpdate(
				unmergedEntry.BlockPointer, newMergedEntry.BlockPointer)
		}
		co, err := newCreateOp(
			rua.fromName.Plaintext(), mergedMostRecent, mergedEntry.Type)
		if err != nil {
			return err
		}
		err = prependOpsToChain(mergedMostRecent, mergedChains, rop, co)
		if err != nil {
			return err
		}
	}

	// Before merging the unmerged ops, create a file with the new
	// name, unless the create already exists.
	found := false
	var co *createOp
	for _, op := range unmergedChain.ops {
		var ok bool
		if co, ok = op.(*createOp); ok && co.NewName == rua.toName.Plaintext() {
			found = true
			if len(co.RefBlocks) > 0 {
				co.RefBlocks[0] = newMergedEntry.BlockPointer
			}
			break
		}
	}
	if !found {
		co, err = newCreateOp(
			rua.toName.Plaintext(), unmergedMostRecent, mergedEntry.Type)
		if err != nil {
			return err
		}
		if rua.symPath.Plaintext() == "" {
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
		rua.fromName.Plaintext() != rua.toName.Plaintext() &&
		rua.symPath.Plaintext() == "" {
		co.AddUnrefBlock(unmergedEntry.BlockPointer)
		orig, ok := unmergedChains.originals[unmergedEntry.BlockPointer]
		if !ok {
			orig = unmergedEntry.BlockPointer
		}
		unmergedChains.deletedOriginals[orig] = true
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
	fromName data.PathPartString
	toName   data.PathPartString
	symPath  data.PathPartString
}

func (rma *renameMergedAction) swapUnmergedBlock(
	_ context.Context, _, _ *crChains, _ *data.DirData) (bool, data.BlockPointer, error) {
	return false, data.ZeroPtr, nil
}

func (rma *renameMergedAction) do(
	ctx context.Context, unmergedCopier, mergedCopier fileBlockDeepCopier,
	unmergedDir, mergedDir *data.DirData) ([]data.BlockInfo, error) {
	// Find the merged entry
	mergedEntry, err := mergedDir.Lookup(ctx, rma.fromName)
	if err != nil {
		return nil, err
	}

	// Make sure this entry is unique.
	newName, err := uniquifyName(ctx, mergedDir, rma.toName)
	if err != nil {
		return nil, err
	}
	rma.toName = newName

	unrefs, err := mergedDir.SetEntry(ctx, rma.toName, mergedEntry)
	if err != nil {
		return nil, err
	}

	// Add the unmerged entry as the new "fromName".
	unmergedEntry, err := unmergedDir.Lookup(ctx, rma.fromName)
	if err != nil {
		return nil, err
	}
	if rma.symPath.Plaintext() != "" {
		unmergedEntry.Type = data.Sym
		unmergedEntry.SymPath = rma.symPath.Plaintext()
	}
	unmergedEntry.PrevRevisions = nil

	moreUnrefs, err := mergedDir.SetEntry(ctx, rma.fromName, unmergedEntry)
	if err != nil {
		return nil, err
	}
	unrefs = append(unrefs, moreUnrefs...)
	return unrefs, nil
}

func (rma *renameMergedAction) updateOps(
	ctx context.Context, unmergedMostRecent, mergedMostRecent data.BlockPointer,
	unmergedDir, mergedDir *data.DirData,
	unmergedChains *crChains, mergedChains *crChains) error {
	unmergedChain, ok := unmergedChains.byMostRecent[unmergedMostRecent]
	if !ok {
		return fmt.Errorf("Couldn't find unmerged chain for %v",
			unmergedMostRecent)
	}

	if rma.symPath.Plaintext() != "" && !unmergedChain.isFile() {
		err := crActionConvertSymlink(unmergedMostRecent, mergedMostRecent,
			unmergedChain, mergedChains, rma.fromName.Plaintext())
		if err != nil {
			return err
		}
	}

	// Rename all operations with the old name to the new name.
	mergedChain := mergedChains.byMostRecent[mergedMostRecent]
	if mergedChain != nil {
		mergedChain.ops = fixupNamesInOps(
			rma.fromName.Plaintext(), rma.toName.Plaintext(), mergedChain.ops,
			mergedChains)
	}

	if !unmergedChain.isFile() {
		// The entry that gets renamed in the unmerged branch:
		mergedEntry, err := mergedDir.Lookup(ctx, rma.toName)
		if err != nil {
			return err
		}

		// Prepend a rename for the merged copy to the unmerged set of
		// operations.
		rop, err := newRenameOp(
			rma.fromName.Plaintext(), unmergedMostRecent,
			rma.toName.Plaintext(), unmergedMostRecent,
			mergedEntry.BlockPointer, mergedEntry.Type)
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
				if co, ok := op.(*createOp); ok &&
					co.NewName == rma.toName.Plaintext() {
					found = true
					break
				}
			}
		}
		if !found {
			co, err := newCreateOp(
				rma.toName.Plaintext(), mergedMostRecent, mergedEntry.Type)
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
	_ context.Context, _, _ *crChains, _ *data.DirData) (bool, data.BlockPointer, error) {
	return false, data.ZeroPtr, nil
}

func (dua *dropUnmergedAction) do(
	_ context.Context, _, _ fileBlockDeepCopier, _, _ *data.DirData) (
	[]data.BlockInfo, error) {
	return nil, nil
}

func (dua *dropUnmergedAction) updateOps(
	_ context.Context, unmergedMostRecent, mergedMostRecent data.BlockPointer,
	_, _ *data.DirData, unmergedChains, mergedChains *crChains) error {
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
			setTopAction(
				action, action.fromName.Plaintext(), i, infoMap,
				indicesToRemove)
		case *copyUnmergedEntryAction:
			untypedTopAction := infoMap[action.fromName.Plaintext()].topAction
			switch untypedTopAction.(type) {
			case *renameUnmergedAction:
				indicesToRemove[i] = true
			default:
				setTopAction(
					action, action.fromName.Plaintext(), i, infoMap,
					indicesToRemove)
			}
		case *copyUnmergedAttrAction:
			untypedTopAction := infoMap[action.fromName.Plaintext()].topAction
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
				setTopAction(
					action, action.fromName.Plaintext(), i, infoMap,
					indicesToRemove)
			}

		// Merged actions
		case *renameMergedAction:
			// Prefix merged actions with a reserved prefix to keep
			// them separate from the unmerged actions.
			setTopAction(
				action, ".kbfs_merged_"+action.fromName.Plaintext(), i, infoMap,
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
