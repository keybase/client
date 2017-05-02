// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
)

// op represents a single file-system remote-sync operation
type op interface {
	AddRefBlock(ptr BlockPointer)
	DelRefBlock(ptr BlockPointer)
	AddUnrefBlock(ptr BlockPointer)
	DelUnrefBlock(ptr BlockPointer)
	AddUpdate(oldPtr BlockPointer, newPtr BlockPointer)
	SizeExceptUpdates() uint64
	allUpdates() []blockUpdate
	Refs() []BlockPointer
	Unrefs() []BlockPointer
	String() string
	StringWithRefs(numRefIndents int) string
	setWriterInfo(writerInfo)
	getWriterInfo() writerInfo
	setFinalPath(p path)
	getFinalPath() path
	setLocalTimestamp(t time.Time)
	getLocalTimestamp() time.Time
	checkValid() error
	// checkConflict compares the function's target op with the given
	// op, and returns a resolution if one is needed (or nil
	// otherwise).  The resulting action (if any) assumes that this
	// method's target op is the unmerged op, and the given op is the
	// merged op.
	checkConflict(ctx context.Context,
		renamer ConflictRenamer, mergedOp op, isFile bool) (
		crAction, error)
	// getDefaultAction should be called on an unmerged op only after
	// all conflicts with the corresponding change have been checked,
	// and it returns the action to take against the merged branch
	// given that there are no conflicts.
	getDefaultAction(mergedPath path) crAction
}

// op codes
const (
	createOpCode kbfscodec.ExtCode = iota + kbfscodec.ExtCodeOpsRangeStart
	rmOpCode
	renameOpCode
	syncOpCode
	setAttrOpCode
	resolutionOpCode
	rekeyOpCode
	gcOpCode // for deleting old blocks during an MD history truncation
)

// blockUpdate represents a block that was updated to have a new
// BlockPointer.
//
// NOTE: Don't add or modify anything in this struct without
// considering how old clients will handle them.
type blockUpdate struct {
	Unref BlockPointer `codec:"u,omitempty"`
	Ref   BlockPointer `codec:"r,omitempty"`
}

func makeBlockUpdate(unref, ref BlockPointer) (blockUpdate, error) {
	bu := blockUpdate{}
	err := bu.setUnref(unref)
	if err != nil {
		return blockUpdate{}, err
	}
	err = bu.setRef(ref)
	if err != nil {
		return blockUpdate{}, err
	}
	return bu, nil
}

func (u blockUpdate) checkValid() error {
	if u.Unref == (BlockPointer{}) {
		return errors.New("nil unref")
	}
	if u.Ref == (BlockPointer{}) {
		return errors.New("nil ref")
	}
	return nil
}

func (u *blockUpdate) setUnref(ptr BlockPointer) error {
	if ptr == (BlockPointer{}) {
		return fmt.Errorf("setUnref called with nil ptr")
	}
	u.Unref = ptr
	return nil
}

func (u *blockUpdate) setRef(ptr BlockPointer) error {
	if ptr == (BlockPointer{}) {
		return fmt.Errorf("setRef called with nil ptr")
	}
	u.Ref = ptr
	return nil
}

// list codes
const (
	opsListCode kbfscodec.ExtCode = iota + kbfscodec.ExtCodeListRangeStart
)

type opsList []op

// OpCommon are data structures needed by all ops.  It is only
// exported for serialization purposes.
type OpCommon struct {
	RefBlocks   []BlockPointer `codec:"r,omitempty"`
	UnrefBlocks []BlockPointer `codec:"u,omitempty"`
	Updates     []blockUpdate  `codec:"o,omitempty"`

	codec.UnknownFieldSetHandler

	// writerInfo is the keybase username and device that generated this
	// operation.
	// Not exported; only used during conflict resolution.
	writerInfo writerInfo
	// finalPath is the final resolved path to the node that this
	// operation affects in a set of MD updates.  Not exported; only
	// used locally.
	finalPath path
	// localTimestamp should be set to the localTimestamp of the
	// corresponding ImmutableRootMetadata when ops need individual
	// timestamps.  Not exported; only used locally.
	localTimestamp time.Time
}

// AddRefBlock adds this block to the list of newly-referenced blocks
// for this op.
func (oc *OpCommon) AddRefBlock(ptr BlockPointer) {
	oc.RefBlocks = append(oc.RefBlocks, ptr)
}

// DelRefBlock removes the first reference of the given block from the
// list of newly-referenced blocks for this op.
func (oc *OpCommon) DelRefBlock(ptr BlockPointer) {
	for i, ref := range oc.RefBlocks {
		if ptr == ref {
			oc.RefBlocks = append(oc.RefBlocks[:i], oc.RefBlocks[i+1:]...)
			break
		}
	}
}

// AddUnrefBlock adds this block to the list of newly-unreferenced blocks
// for this op.
func (oc *OpCommon) AddUnrefBlock(ptr BlockPointer) {
	oc.UnrefBlocks = append(oc.UnrefBlocks, ptr)
}

// DelUnrefBlock removes the first unreference of the given block from
// the list of unreferenced blocks for this op.
func (oc *OpCommon) DelUnrefBlock(ptr BlockPointer) {
	for i, unref := range oc.UnrefBlocks {
		if ptr == unref {
			oc.UnrefBlocks = append(oc.UnrefBlocks[:i], oc.UnrefBlocks[i+1:]...)
			break
		}
	}
}

// AddUpdate adds a mapping from an old block to the new version of
// that block, for this op.
func (oc *OpCommon) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	// Either pointer may be zero, if we're building an op that
	// will be fixed up later.
	bu := blockUpdate{oldPtr, newPtr}
	oc.Updates = append(oc.Updates, bu)
}

// Refs returns a slice containing all the blocks that were initially
// referenced during this op.
func (oc *OpCommon) Refs() []BlockPointer {
	return oc.RefBlocks
}

// Unrefs returns a slice containing all the blocks that were
// unreferenced during this op.
func (oc *OpCommon) Unrefs() []BlockPointer {
	return oc.UnrefBlocks
}

func (oc *OpCommon) setWriterInfo(info writerInfo) {
	oc.writerInfo = info
}

func (oc *OpCommon) getWriterInfo() writerInfo {
	return oc.writerInfo
}

func (oc *OpCommon) setFinalPath(p path) {
	oc.finalPath = p
}

func (oc *OpCommon) getFinalPath() path {
	return oc.finalPath
}

func (oc *OpCommon) setLocalTimestamp(t time.Time) {
	oc.localTimestamp = t
}

func (oc *OpCommon) getLocalTimestamp() time.Time {
	return oc.localTimestamp
}

func (oc *OpCommon) checkUpdatesValid() error {
	for i, update := range oc.Updates {
		err := update.checkValid()
		if err != nil {
			return fmt.Errorf(
				"update[%d]=%v got error: %v", i, update, err)
		}
	}
	return nil
}

func (oc *OpCommon) stringWithRefs(numRefIndents int) string {
	indent := strings.Repeat("\t", numRefIndents)
	res := ""
	for i, update := range oc.Updates {
		res += indent + fmt.Sprintf(
			"Update[%d]: %v -> %v\n", i, update.Unref, update.Ref)
	}
	for i, ref := range oc.RefBlocks {
		res += indent + fmt.Sprintf("Ref[%d]: %v\n", i, ref)
	}
	for i, unref := range oc.UnrefBlocks {
		res += indent + fmt.Sprintf("Unref[%d]: %v\n", i, unref)
	}
	return res
}

// createOp is an op representing a file or subdirectory creation
type createOp struct {
	OpCommon
	NewName string      `codec:"n"`
	Dir     blockUpdate `codec:"d"`
	Type    EntryType   `codec:"t"`

	// If true, this create op represents half of a rename operation.
	// This op should never be persisted.
	renamed bool

	// If true, during conflict resolution the blocks of the file will
	// be copied.
	forceCopy bool

	// If this is set, ths create op needs to be turned has been
	// turned into a symlink creation locally to avoid a cycle during
	// conflict resolution, and the following field represents the
	// text of the symlink. This op should never be persisted.
	crSymPath string
}

func newCreateOp(name string, oldDir BlockPointer, t EntryType) (*createOp, error) {
	co := &createOp{
		NewName: name,
	}
	err := co.Dir.setUnref(oldDir)
	if err != nil {
		return nil, err
	}
	co.Type = t
	return co, nil
}

func newCreateOpForRootDir() *createOp {
	return &createOp{
		Type: Dir,
	}
}

func (co *createOp) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	if co.Dir == (blockUpdate{}) {
		panic("AddUpdate called on create op with empty Dir " +
			"(probably create op for root dir)")
	}
	if oldPtr == co.Dir.Unref {
		err := co.Dir.setRef(newPtr)
		if err != nil {
			panic(err)
		}
		return
	}
	co.OpCommon.AddUpdate(oldPtr, newPtr)
}

func (co *createOp) SizeExceptUpdates() uint64 {
	return uint64(len(co.NewName))
}

func (co *createOp) allUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(co.Updates))
	copy(updates, co.Updates)
	return append(updates, co.Dir)
}

func (co *createOp) checkValid() error {
	if co.NewName == "" {
		// Must be for root dir.
		return nil
	}

	err := co.Dir.checkValid()
	if err != nil {
		return fmt.Errorf("createOp.Dir=%v got error: %v", co.Dir, err)
	}
	return co.checkUpdatesValid()
}

func (co *createOp) String() string {
	res := fmt.Sprintf("create %s (%s)", co.NewName, co.Type)
	if co.renamed {
		res += " (renamed)"
	}
	return res
}

func (co *createOp) StringWithRefs(numRefIndents int) string {
	res := co.String() + "\n"
	indent := strings.Repeat("\t", numRefIndents)
	res += indent + fmt.Sprintf("Dir: %v -> %v\n", co.Dir.Unref, co.Dir.Ref)
	res += co.stringWithRefs(numRefIndents)
	return res
}

func (co *createOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	switch realMergedOp := mergedOp.(type) {
	case *createOp:
		// Conflicts if this creates the same name and one of them
		// isn't creating a directory.
		sameName := (realMergedOp.NewName == co.NewName)
		if sameName && (realMergedOp.Type != Dir || co.Type != Dir) {
			if realMergedOp.Type != Dir &&
				(co.Type == Dir || co.crSymPath != "") {
				// Rename the merged entry only if the unmerged one is
				// a directory (or to-be-sympath'd directory) and the
				// merged one is not.
				toName, err := renamer.ConflictRename(
					ctx, mergedOp, co.NewName)
				if err != nil {
					return nil, err
				}
				return &renameMergedAction{
					fromName: co.NewName,
					toName:   toName,
					symPath:  co.crSymPath,
				}, nil
			}
			// Otherwise rename the unmerged entry (guaranteed to be a file).
			toName, err := renamer.ConflictRename(
				ctx, co, co.NewName)
			if err != nil {
				return nil, err
			}
			return &renameUnmergedAction{
				fromName: co.NewName,
				toName:   toName,
				symPath:  co.crSymPath,
			}, nil
		}

		// If they are both directories, and one of them is a rename,
		// then we have a conflict and need to rename the renamed one.
		//
		// TODO: Implement a better merging strategy for when an
		// existing directory gets into a rename conflict with another
		// existing or new directory.
		if sameName && realMergedOp.Type == Dir && co.Type == Dir &&
			(realMergedOp.renamed || co.renamed) {
			// Always rename the unmerged one
			toName, err := renamer.ConflictRename(
				ctx, co, co.NewName)
			if err != nil {
				return nil, err
			}
			return &copyUnmergedEntryAction{
				fromName: co.NewName,
				toName:   toName,
				symPath:  co.crSymPath,
				unique:   true,
			}, nil
		}
	}
	// Doesn't conflict with any rmOps, because the default action
	// will just re-create it in the merged branch as necessary.
	return nil, nil
}

func (co *createOp) getDefaultAction(mergedPath path) crAction {
	if co.forceCopy {
		return &renameUnmergedAction{
			fromName: co.NewName,
			toName:   co.NewName,
			symPath:  co.crSymPath,
		}
	}
	return &copyUnmergedEntryAction{
		fromName: co.NewName,
		toName:   co.NewName,
		symPath:  co.crSymPath,
	}
}

// rmOp is an op representing a file or subdirectory removal
type rmOp struct {
	OpCommon
	OldName string      `codec:"n"`
	Dir     blockUpdate `codec:"d"`

	// Indicates that the resolution process should skip this rm op.
	// Likely indicates the rm half of a cycle-creating rename.
	dropThis bool
}

func newRmOp(name string, oldDir BlockPointer) (*rmOp, error) {
	ro := &rmOp{
		OldName: name,
	}
	err := ro.Dir.setUnref(oldDir)
	if err != nil {
		return nil, err
	}
	return ro, nil
}

func (ro *rmOp) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	if oldPtr == ro.Dir.Unref {
		err := ro.Dir.setRef(newPtr)
		if err != nil {
			panic(err)
		}
		return
	}
	ro.OpCommon.AddUpdate(oldPtr, newPtr)
}

func (ro *rmOp) SizeExceptUpdates() uint64 {
	return uint64(len(ro.OldName))
}

func (ro *rmOp) allUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(ro.Updates))
	copy(updates, ro.Updates)
	return append(updates, ro.Dir)
}

func (ro *rmOp) checkValid() error {
	err := ro.Dir.checkValid()
	if err != nil {
		return fmt.Errorf("rmOp.Dir=%v got error: %v", ro.Dir, err)
	}
	return ro.checkUpdatesValid()
}

func (ro *rmOp) String() string {
	return fmt.Sprintf("rm %s", ro.OldName)
}

func (ro *rmOp) StringWithRefs(numRefIndents int) string {
	res := ro.String() + "\n"
	indent := strings.Repeat("\t", numRefIndents)
	res += indent + fmt.Sprintf("Dir: %v -> %v\n", ro.Dir.Unref, ro.Dir.Ref)
	res += ro.stringWithRefs(numRefIndents)
	return res
}

func (ro *rmOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	switch realMergedOp := mergedOp.(type) {
	case *createOp:
		if realMergedOp.NewName == ro.OldName {
			// Conflicts if this creates the same name.  This can only
			// happen if the merged branch deleted the old node and
			// re-created it, in which case it is totally fine to drop
			// this rm op for the original node.
			return &dropUnmergedAction{op: ro}, nil
		}
	case *rmOp:
		if realMergedOp.OldName == ro.OldName {
			// Both removed the same file.
			return &dropUnmergedAction{op: ro}, nil
		}
	}
	return nil, nil
}

func (ro *rmOp) getDefaultAction(mergedPath path) crAction {
	if ro.dropThis {
		return &dropUnmergedAction{op: ro}
	}
	return &rmMergedEntryAction{name: ro.OldName}
}

// renameOp is an op representing a rename of a file/subdirectory from
// one directory to another.  If this is a rename within the same
// directory, NewDir will be equivalent to blockUpdate{}.  renameOp
// records the moved pointer, even though it doesn't change as part of
// the operation, to make it possible to track the full path of
// directories for the purposes of conflict resolution.
type renameOp struct {
	OpCommon
	OldName     string       `codec:"on"`
	OldDir      blockUpdate  `codec:"od"`
	NewName     string       `codec:"nn"`
	NewDir      blockUpdate  `codec:"nd"`
	Renamed     BlockPointer `codec:"re"`
	RenamedType EntryType    `codec:"rt"`
}

func newRenameOp(oldName string, oldOldDir BlockPointer,
	newName string, oldNewDir BlockPointer, renamed BlockPointer,
	renamedType EntryType) (*renameOp, error) {
	ro := &renameOp{
		OldName:     oldName,
		NewName:     newName,
		Renamed:     renamed,
		RenamedType: renamedType,
	}
	err := ro.OldDir.setUnref(oldOldDir)
	if err != nil {
		return nil, err
	}
	// If we are renaming within a directory, let the NewDir remain empty.
	if oldOldDir != oldNewDir {
		err := ro.NewDir.setUnref(oldNewDir)
		if err != nil {
			return nil, err
		}
	}
	return ro, nil
}

func (ro *renameOp) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	if oldPtr == ro.OldDir.Unref {
		err := ro.OldDir.setRef(newPtr)
		if err != nil {
			panic(err)
		}
		return
	}
	if ro.NewDir != (blockUpdate{}) && oldPtr == ro.NewDir.Unref {
		err := ro.NewDir.setRef(newPtr)
		if err != nil {
			panic(err)
		}
		return
	}
	ro.OpCommon.AddUpdate(oldPtr, newPtr)
}

func (ro *renameOp) SizeExceptUpdates() uint64 {
	return uint64(len(ro.NewName) + len(ro.NewName))
}

func (ro *renameOp) allUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(ro.Updates))
	copy(updates, ro.Updates)
	if ro.NewDir != (blockUpdate{}) {
		return append(updates, ro.NewDir, ro.OldDir)
	}
	return append(updates, ro.OldDir)
}

func (ro *renameOp) checkValid() error {
	err := ro.OldDir.checkValid()
	if err != nil {
		return fmt.Errorf("renameOp.OldDir=%v got error: %v",
			ro.OldDir, err)
	}
	if ro.NewDir != (blockUpdate{}) {
		err = ro.NewDir.checkValid()
		if err != nil {
			return fmt.Errorf("renameOp.NewDir=%v got error: %v",
				ro.NewDir, err)
		}
	}

	return ro.checkUpdatesValid()
}

func (ro *renameOp) String() string {
	return fmt.Sprintf("rename %s -> %s (%s)",
		ro.OldName, ro.NewName, ro.RenamedType)
}

func (ro *renameOp) StringWithRefs(numRefIndents int) string {
	res := ro.String() + "\n"
	indent := strings.Repeat("\t", numRefIndents)
	res += indent + fmt.Sprintf("OldDir: %v -> %v\n",
		ro.OldDir.Unref, ro.OldDir.Ref)
	if ro.NewDir != (blockUpdate{}) {
		res += indent + fmt.Sprintf("NewDir: %v -> %v\n",
			ro.NewDir.Unref, ro.NewDir.Ref)
	} else {
		res += indent + fmt.Sprintf("NewDir: same as above\n")
	}
	res += indent + fmt.Sprintf("Renamed: %v\n", ro.Renamed)
	res += ro.stringWithRefs(numRefIndents)
	return res
}

func (ro *renameOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	return nil, fmt.Errorf("Unexpected conflict check on a rename op: %s", ro)
}

func (ro *renameOp) getDefaultAction(mergedPath path) crAction {
	return nil
}

// WriteRange represents a file modification.  Len is 0 for a
// truncate.
type WriteRange struct {
	Off uint64 `codec:"o"`
	Len uint64 `codec:"l,omitempty"` // 0 for truncates

	codec.UnknownFieldSetHandler
}

func (w WriteRange) isTruncate() bool {
	return w.Len == 0
}

// End returns the index of the largest byte not affected by this
// write.  It only makes sense to call this for non-truncates.
func (w WriteRange) End() uint64 {
	if w.isTruncate() {
		panic("Truncates don't have an end")
	}
	return w.Off + w.Len
}

// Affects returns true if the regions affected by this write
// operation and `other` overlap in some way.  Specifically, it
// returns true if:
//
// - both operations are writes and their write ranges overlap;
// - one operation is a write and one is a truncate, and the truncate is
//   within the write's range or before it; or
// - both operations are truncates.
func (w WriteRange) Affects(other WriteRange) bool {
	if w.isTruncate() {
		if other.isTruncate() {
			return true
		}
		// A truncate affects a write if it lands inside or before the
		// write.
		return other.End() > w.Off
	} else if other.isTruncate() {
		return w.End() > other.Off
	}
	// Both are writes -- do their ranges overlap?
	return (w.Off <= other.End() && other.End() <= w.End()) ||
		(other.Off <= w.End() && w.End() <= other.End())
}

// syncOp is an op that represents a series of writes to a file.
type syncOp struct {
	OpCommon
	File   blockUpdate  `codec:"f"`
	Writes []WriteRange `codec:"w"`

	// If true, this says that if there is a conflict involving this
	// op, we should keep the unmerged name rather than construct a
	// conflict name (probably because the new name already
	// diverges from the name in the other branch).
	keepUnmergedTailName bool
}

func newSyncOp(oldFile BlockPointer) (*syncOp, error) {
	so := &syncOp{}
	err := so.File.setUnref(oldFile)
	if err != nil {
		return nil, err
	}
	so.resetUpdateState()
	return so, nil
}

func (so *syncOp) resetUpdateState() {
	so.Updates = nil
}

func (so *syncOp) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	if oldPtr == so.File.Unref {
		err := so.File.setRef(newPtr)
		if err != nil {
			panic(err)
		}
		return
	}
	so.OpCommon.AddUpdate(oldPtr, newPtr)
}

func (so *syncOp) addWrite(off uint64, length uint64) WriteRange {
	latestWrite := WriteRange{Off: off, Len: length}
	so.Writes = append(so.Writes, latestWrite)
	return latestWrite
}

func (so *syncOp) addTruncate(off uint64) WriteRange {
	latestWrite := WriteRange{Off: off, Len: 0}
	so.Writes = append(so.Writes, latestWrite)
	return latestWrite
}

func (so *syncOp) SizeExceptUpdates() uint64 {
	return uint64(len(so.Writes) * 16)
}

func (so *syncOp) allUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(so.Updates))
	copy(updates, so.Updates)
	return append(updates, so.File)
}

func (so *syncOp) checkValid() error {
	err := so.File.checkValid()
	if err != nil {
		return fmt.Errorf("syncOp.File=%v got error: %v", so.File, err)
	}
	return so.checkUpdatesValid()
}

func (so *syncOp) String() string {
	var writes []string
	for _, r := range so.Writes {
		writes = append(writes, fmt.Sprintf("{off=%d, len=%d}", r.Off, r.Len))
	}
	return fmt.Sprintf("sync [%s]", strings.Join(writes, ", "))
}

func (so *syncOp) StringWithRefs(numRefIndents int) string {
	res := so.String() + "\n"
	indent := strings.Repeat("\t", numRefIndents)
	res += indent + fmt.Sprintf("File: %v -> %v\n", so.File.Unref, so.File.Ref)
	res += so.stringWithRefs(numRefIndents)
	return res
}

func (so *syncOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	switch mergedOp.(type) {
	case *syncOp:
		// Any sync on the same file is a conflict.  (TODO: add
		// type-specific intelligent conflict resolvers for file
		// contents?)
		toName, err := renamer.ConflictRename(
			ctx, so, mergedOp.getFinalPath().tailName())
		if err != nil {
			return nil, err
		}

		if so.keepUnmergedTailName {
			toName = so.getFinalPath().tailName()
		}

		return &renameUnmergedAction{
			fromName: so.getFinalPath().tailName(),
			toName:   toName,
			unmergedParentMostRecent: so.getFinalPath().parentPath().tailPointer(),
			mergedParentMostRecent: mergedOp.getFinalPath().parentPath().
				tailPointer(),
		}, nil
	case *setAttrOp:
		// Someone on the merged path explicitly set an attribute, so
		// just copy the size and blockpointer over.
		return &copyUnmergedAttrAction{
			fromName: so.getFinalPath().tailName(),
			toName:   mergedOp.getFinalPath().tailName(),
			attr:     []attrChange{sizeAttr},
		}, nil
	}
	return nil, nil
}

func (so *syncOp) getDefaultAction(mergedPath path) crAction {
	return &copyUnmergedEntryAction{
		fromName: so.getFinalPath().tailName(),
		toName:   mergedPath.tailName(),
		symPath:  "",
	}
}

// In the functions below. a collapsed []WriteRange is a sequence of
// non-overlapping writes with strictly increasing Off, and maybe a
// trailing truncate (with strictly greater Off).

// coalesceWrites combines the given `wNew` with the head and tail of
// the given collapsed `existingWrites` slice.  For example, if the
// new write is {5, 100}, and `existingWrites` = [{7,5}, {18,10},
// {98,10}], the returned write will be {5,103}.  There may be a
// truncate at the end of the returned slice as well.
func coalesceWrites(existingWrites []WriteRange,
	wNew WriteRange) []WriteRange {
	if wNew.isTruncate() {
		panic("coalesceWrites cannot be called with a new truncate.")
	}
	if len(existingWrites) == 0 {
		return []WriteRange{wNew}
	}
	newOff := wNew.Off
	newEnd := wNew.End()
	wOldHead := existingWrites[0]
	wOldTail := existingWrites[len(existingWrites)-1]
	if !wOldTail.isTruncate() && wOldTail.End() > newEnd {
		newEnd = wOldTail.End()
	}
	if !wOldHead.isTruncate() && wOldHead.Off < newOff {
		newOff = wOldHead.Off
	}
	ret := []WriteRange{{Off: newOff, Len: newEnd - newOff}}
	if wOldTail.isTruncate() {
		ret = append(ret, WriteRange{Off: newEnd})
	}
	return ret
}

// Assumes writes is already collapsed, i.e. a sequence of
// non-overlapping writes with strictly increasing Off, and maybe a
// trailing truncate (with strictly greater Off).
func addToCollapsedWriteRange(writes []WriteRange,
	wNew WriteRange) []WriteRange {
	// Form three regions: head, mid, and tail: head is the maximal prefix
	// of writes less than (with respect to Off) and unaffected by wNew,
	// tail is the maximal suffix of writes greater than (with respect to
	// Off) and unaffected by wNew, and mid is everything else, i.e. the
	// range of writes affected by wNew.
	var headEnd int
	for ; headEnd < len(writes); headEnd++ {
		wOld := writes[headEnd]
		if wOld.Off >= wNew.Off || wNew.Affects(wOld) {
			break
		}
	}
	head := writes[:headEnd]

	if wNew.isTruncate() {
		// end is empty, since a truncate affects a suffix of writes.
		mid := writes[headEnd:]

		if len(mid) == 0 {
			// Truncate past the last write.
			return append(head, wNew)
		} else if mid[0].isTruncate() {
			if mid[0].Off < wNew.Off {
				// A larger new truncate causes zero-fill.
				zeroLen := wNew.Off - mid[0].Off
				if len(head) > 0 {
					lastHead := head[len(head)-1]
					if lastHead.Off+lastHead.Len == mid[0].Off {
						// Combine this zero-fill with the previous write.
						head[len(head)-1].Len += zeroLen
						return append(head, wNew)
					}
				}
				return append(head,
					WriteRange{Off: mid[0].Off, Len: zeroLen}, wNew)
			}
			return append(head, wNew)
		} else if mid[0].Off < wNew.Off {
			return append(head, WriteRange{
				Off: mid[0].Off,
				Len: wNew.Off - mid[0].Off,
			}, wNew)
		}
		return append(head, wNew)
	}

	// wNew is a write.

	midEnd := headEnd
	for ; midEnd < len(writes); midEnd++ {
		wOld := writes[midEnd]
		if !wNew.Affects(wOld) {
			break
		}
	}

	mid := writes[headEnd:midEnd]
	end := writes[midEnd:]
	mid = coalesceWrites(mid, wNew)
	return append(head, append(mid, end...)...)
}

// collapseWriteRange returns a set of writes that represent the final
// dirty state of this file after this syncOp, given a previous write
// range.  It coalesces overlapping dirty writes, and it erases any
// writes that occurred before a truncation with an offset smaller
// than its max dirty byte.
//
// This function assumes that `writes` has already been collapsed (or
// is nil).
//
// NOTE: Truncates past a file's end get turned into writes by
// folderBranchOps, but in the future we may have bona fide truncate
// WriteRanges past a file's end.
func (so *syncOp) collapseWriteRange(writes []WriteRange) (
	newWrites []WriteRange) {
	newWrites = writes
	for _, wNew := range so.Writes {
		newWrites = addToCollapsedWriteRange(newWrites, wNew)
	}
	return newWrites
}

type attrChange uint16

const (
	exAttr attrChange = iota
	mtimeAttr
	sizeAttr // only used during conflict resolution
)

func (ac attrChange) String() string {
	switch ac {
	case exAttr:
		return "ex"
	case mtimeAttr:
		return "mtime"
	case sizeAttr:
		return "size"
	}
	return "<invalid attrChange>"
}

// setAttrOp is an op that represents changing the attributes of a
// file/subdirectory with in a directory.
type setAttrOp struct {
	OpCommon
	Name string       `codec:"n"`
	Dir  blockUpdate  `codec:"d"`
	Attr attrChange   `codec:"a"`
	File BlockPointer `codec:"f"`

	// If true, this says that if there is a conflict involving this
	// op, we should keep the unmerged name rather than construct a
	// conflict name (probably because the new name already
	// diverges from the name in the other branch).
	keepUnmergedTailName bool
}

func newSetAttrOp(name string, oldDir BlockPointer,
	attr attrChange, file BlockPointer) (*setAttrOp, error) {
	sao := &setAttrOp{
		Name: name,
	}
	err := sao.Dir.setUnref(oldDir)
	if err != nil {
		return nil, err
	}
	sao.Attr = attr
	sao.File = file
	return sao, nil
}

func (sao *setAttrOp) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	if oldPtr == sao.Dir.Unref {
		err := sao.Dir.setRef(newPtr)
		if err != nil {
			panic(err)
		}
		return
	}
	sao.OpCommon.AddUpdate(oldPtr, newPtr)
}

func (sao *setAttrOp) SizeExceptUpdates() uint64 {
	return uint64(len(sao.Name))
}

func (sao *setAttrOp) allUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(sao.Updates))
	copy(updates, sao.Updates)
	return append(updates, sao.Dir)
}

func (sao *setAttrOp) checkValid() error {
	err := sao.Dir.checkValid()
	if err != nil {
		return fmt.Errorf("setAttrOp.Dir=%v got error: %v", sao.Dir, err)
	}
	return sao.checkUpdatesValid()
}

func (sao *setAttrOp) String() string {
	return fmt.Sprintf("setAttr %s (%s)", sao.Name, sao.Attr)
}

func (sao *setAttrOp) StringWithRefs(numRefIndents int) string {
	res := sao.String() + "\n"
	indent := strings.Repeat("\t", numRefIndents)
	res += indent + fmt.Sprintf("Dir: %v -> %v\n", sao.Dir.Unref, sao.Dir.Ref)
	res += indent + fmt.Sprintf("File: %v\n", sao.File)
	res += sao.stringWithRefs(numRefIndents)
	return res
}

func (sao *setAttrOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	switch realMergedOp := mergedOp.(type) {
	case *setAttrOp:
		if realMergedOp.Attr == sao.Attr {
			var symPath string
			var causedByAttr attrChange
			if !isFile {
				// A directory has a conflict on an mtime attribute.
				// Create a symlink entry with the unmerged mtime
				// pointing to the merged entry.
				symPath = mergedOp.getFinalPath().tailName()
				causedByAttr = sao.Attr
			}

			// A set attr for the same attribute on the same file is a
			// conflict.
			fromName := sao.getFinalPath().tailName()
			toName, err := renamer.ConflictRename(ctx, sao, fromName)
			if err != nil {
				return nil, err
			}

			if sao.keepUnmergedTailName {
				toName = sao.getFinalPath().tailName()
			}

			return &renameUnmergedAction{
				fromName:                 fromName,
				toName:                   toName,
				symPath:                  symPath,
				causedByAttr:             causedByAttr,
				unmergedParentMostRecent: sao.getFinalPath().parentPath().tailPointer(),
				mergedParentMostRecent: mergedOp.getFinalPath().parentPath().
					tailPointer(),
			}, nil
		}
	}
	return nil, nil
}

func (sao *setAttrOp) getDefaultAction(mergedPath path) crAction {
	return &copyUnmergedAttrAction{
		fromName: sao.getFinalPath().tailName(),
		toName:   mergedPath.tailName(),
		attr:     []attrChange{sao.Attr},
	}
}

// resolutionOp is an op that represents the block changes that took
// place as part of a conflict resolution.
type resolutionOp struct {
	OpCommon
}

func newResolutionOp() *resolutionOp {
	ro := &resolutionOp{}
	return ro
}

func (ro *resolutionOp) SizeExceptUpdates() uint64 {
	return 0
}

func (ro *resolutionOp) allUpdates() []blockUpdate {
	return ro.Updates
}

func (ro *resolutionOp) checkValid() error {
	return ro.checkUpdatesValid()
}

func (ro *resolutionOp) String() string {
	return "resolution"
}

func (ro *resolutionOp) StringWithRefs(numRefIndents int) string {
	res := ro.String() + "\n"
	res += ro.stringWithRefs(numRefIndents)
	return res
}

func (ro *resolutionOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	return nil, nil
}

func (ro *resolutionOp) getDefaultAction(mergedPath path) crAction {
	return nil
}

// rekeyOp is an op that represents a rekey on a TLF.
type rekeyOp struct {
	OpCommon
}

func newRekeyOp() *rekeyOp {
	ro := &rekeyOp{}
	return ro
}

func (ro *rekeyOp) SizeExceptUpdates() uint64 {
	return 0
}

func (ro *rekeyOp) allUpdates() []blockUpdate {
	return ro.Updates
}

func (ro *rekeyOp) checkValid() error {
	return ro.checkUpdatesValid()
}

func (ro *rekeyOp) String() string {
	return "rekey"
}

func (ro *rekeyOp) StringWithRefs(numRefIndents int) string {
	res := ro.String() + "\n"
	res += ro.stringWithRefs(numRefIndents)
	return res
}

func (ro *rekeyOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	return nil, nil
}

func (ro *rekeyOp) getDefaultAction(mergedPath path) crAction {
	return nil
}

// GCOp is an op that represents garbage-collecting the history of a
// folder (which may involve unreferencing blocks that previously held
// operation lists.  It may contain unref blocks before it is added to
// the metadata ops list.
type GCOp struct {
	OpCommon

	// LatestRev is the most recent MD revision that was
	// garbage-collected with this operation.
	//
	// The codec name overrides the one for RefBlocks in OpCommon,
	// which GCOp doesn't use.
	LatestRev MetadataRevision `codec:"r"`
}

func newGCOp(latestRev MetadataRevision) *GCOp {
	gco := &GCOp{
		LatestRev: latestRev,
	}
	return gco
}

// SizeExceptUpdates implements op.
func (gco *GCOp) SizeExceptUpdates() uint64 {
	return bpSize * uint64(len(gco.UnrefBlocks))
}

func (gco *GCOp) allUpdates() []blockUpdate {
	return gco.Updates
}

func (gco *GCOp) checkValid() error {
	return gco.checkUpdatesValid()
}

func (gco *GCOp) String() string {
	return fmt.Sprintf("gc %d", gco.LatestRev)
}

// StringWithRefs implements the op interface for GCOp.
func (gco *GCOp) StringWithRefs(numRefIndents int) string {
	res := gco.String() + "\n"
	res += gco.stringWithRefs(numRefIndents)
	return res
}

// checkConflict implements op.
func (gco *GCOp) checkConflict(
	ctx context.Context, renamer ConflictRenamer, mergedOp op,
	isFile bool) (crAction, error) {
	return nil, nil
}

// getDefaultAction implements op.
func (gco *GCOp) getDefaultAction(mergedPath path) crAction {
	return nil
}

// invertOpForLocalNotifications returns an operation that represents
// an undoing of the effect of the given op.  These are intended to be
// used for local notifications only, and would not be useful for
// finding conflicts (for example, we lose information about the type
// of the file in a rmOp that we are trying to re-create).
func invertOpForLocalNotifications(oldOp op) (newOp op, err error) {
	switch op := oldOp.(type) {
	default:
		panic(fmt.Sprintf("Unrecognized operation: %v", op))
	case *createOp:
		newOp, err = newRmOp(op.NewName, op.Dir.Ref)
		if err != nil {
			return nil, err
		}
	case *rmOp:
		// Guess at the type, shouldn't be used for local notification
		// purposes.
		newOp, err = newCreateOp(op.OldName, op.Dir.Ref, File)
		if err != nil {
			return nil, err
		}
	case *renameOp:
		newDirRef := op.NewDir.Ref
		if op.NewDir == (blockUpdate{}) {
			newDirRef = op.OldDir.Ref
		}
		newOp, err = newRenameOp(op.NewName, newDirRef,
			op.OldName, op.OldDir.Ref, op.Renamed, op.RenamedType)
		if err != nil {
			return nil, err
		}
	case *syncOp:
		// Just replay the writes; for notifications purposes, they
		// will do the right job of marking the right bytes as
		// invalid.
		so, err := newSyncOp(op.File.Ref)
		if err != nil {
			return nil, err
		}
		so.Writes = make([]WriteRange, len(op.Writes))
		copy(so.Writes, op.Writes)
		newOp = so
	case *setAttrOp:
		newOp, err = newSetAttrOp(op.Name, op.Dir.Ref, op.Attr, op.File)
		if err != nil {
			return nil, err
		}
	case *GCOp:
		newOp = newGCOp(op.LatestRev)
	case *resolutionOp:
		newOp = newResolutionOp()
	}

	// Now reverse all the block updates.  Don't bother with bare Refs
	// and Unrefs since they don't matter for local notification
	// purposes.
	for _, update := range oldOp.allUpdates() {
		newOp.AddUpdate(update.Ref, update.Unref)
	}
	return newOp, nil
}

// NOTE: If you're updating opPointerizer and RegisterOps, make sure
// to also update opPointerizerFuture and registerOpsFuture in
// ops_test.go.

// Our ugorji codec cannot decode our extension types as pointers, and
// we need them to be pointers so they correctly satisfy the op
// interface.  So this function simply converts them into pointers as
// needed.
func opPointerizer(iface interface{}) reflect.Value {
	switch op := iface.(type) {
	default:
		return reflect.ValueOf(iface)
	case createOp:
		return reflect.ValueOf(&op)
	case rmOp:
		return reflect.ValueOf(&op)
	case renameOp:
		return reflect.ValueOf(&op)
	case syncOp:
		return reflect.ValueOf(&op)
	case setAttrOp:
		return reflect.ValueOf(&op)
	case resolutionOp:
		return reflect.ValueOf(&op)
	case rekeyOp:
		return reflect.ValueOf(&op)
	case GCOp:
		return reflect.ValueOf(&op)
	}
}

// RegisterOps registers all op types with the given codec.
func RegisterOps(codec kbfscodec.Codec) {
	codec.RegisterType(reflect.TypeOf(createOp{}), createOpCode)
	codec.RegisterType(reflect.TypeOf(rmOp{}), rmOpCode)
	codec.RegisterType(reflect.TypeOf(renameOp{}), renameOpCode)
	codec.RegisterType(reflect.TypeOf(syncOp{}), syncOpCode)
	codec.RegisterType(reflect.TypeOf(setAttrOp{}), setAttrOpCode)
	codec.RegisterType(reflect.TypeOf(resolutionOp{}), resolutionOpCode)
	codec.RegisterType(reflect.TypeOf(rekeyOp{}), rekeyOpCode)
	codec.RegisterType(reflect.TypeOf(GCOp{}), gcOpCode)
	codec.RegisterIfaceSliceType(reflect.TypeOf(opsList{}), opsListCode,
		opPointerizer)
}
