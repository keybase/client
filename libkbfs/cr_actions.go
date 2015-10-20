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
	return unmergedOps, mergedOps, nil
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
