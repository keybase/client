package libkbfs

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/keybase/client/go/libkb"
)

// op represents a single file-system remote-sync operation
type op interface {
	AddRefBlock(ptr BlockPointer)
	AddUnrefBlock(ptr BlockPointer)
	AddUpdate(oldPtr BlockPointer, newPtr BlockPointer)
	SizeExceptUpdates() uint64
	AllUpdates() []blockUpdate
	Refs() []BlockPointer
	Unrefs() []BlockPointer
	String() string
	setWriterName(name libkb.NormalizedUsername)
	getWriterName() libkb.NormalizedUsername
	setFinalPath(p path)
	getFinalPath() path
	// CheckConflict compares the function's target op with the given
	// op, and returns a resolution if one is needed (or nil
	// otherwise).  The resulting action (if any) assumes that this
	// method's target op is the unmerged op, and the given op is the
	// merged op.
	CheckConflict(renamer ConflictRenamer, mergedOp op) (crAction, error)
	// GetDefaultAction should be called on an unmerged op only after
	// all conflicts with the corresponding change have been checked,
	// and it returns the action to take against the merged branch
	// given that there are no conflicts.
	GetDefaultAction(mergedPath path) crAction
}

// op codes
const (
	createOpCode extCode = iota + extCodeOpsRangeStart
	rmOpCode
	renameOpCode
	syncOpCode
	setAttrOpCode
	gcOpCode // for deleting old blocks during an MD history truncation
)

// BlockUpdate represents a block that was updated to have a new
// BlockPointer.
type blockUpdate struct {
	Unref BlockPointer `codec:"u,omitempty"`
	Ref   BlockPointer `codec:"r,omitempty"`
}

// list codes
const (
	opsListCode extCode = iota + extCodeListRangeStart
)

type opsList []op

// OpCommon are data structures needed by all ops.  It is only
// exported for serialization purposes.
type OpCommon struct {
	RefBlocks   []BlockPointer `codec:"r,omitempty"`
	UnrefBlocks []BlockPointer `codec:"u,omitempty"`
	Updates     []blockUpdate  `codec:"o,omitempty"`
	// customUpdates allows an individual op to make sure that one of
	// its custom fields is updated on AddUpdate, instead of the
	// generic Updates field.
	customUpdates map[BlockPointer]*blockUpdate
	// writerName is the keybase username that generated this
	// operation.  Not exported; only used during conflict resolution.
	writerName libkb.NormalizedUsername
	// finalPath is the final resolved path to the node that this
	// operation affects in a set of MD updates.  Not exported; only
	// used during conflict resolution.
	finalPath path
}

// AddRefBlock adds this block to the list of newly-referenced blocks
// for this op.
func (oc *OpCommon) AddRefBlock(ptr BlockPointer) {
	oc.RefBlocks = append(oc.RefBlocks, ptr)
}

// AddUnrefBlock adds this block to the list of newly-unreferenced blocks
// for this op.
func (oc *OpCommon) AddUnrefBlock(ptr BlockPointer) {
	oc.UnrefBlocks = append(oc.UnrefBlocks, ptr)
}

// AddUpdate adds a mapping from an old block to the new version of
// that block, for this op.
func (oc *OpCommon) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	if update, ok := oc.customUpdates[oldPtr]; ok {
		update.Ref = newPtr
		delete(oc.customUpdates, oldPtr)
	} else {
		oc.Updates = append(oc.Updates, blockUpdate{oldPtr, newPtr})
	}
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

func (oc *OpCommon) setWriterName(name libkb.NormalizedUsername) {
	oc.writerName = name
}

func (oc *OpCommon) getWriterName() libkb.NormalizedUsername {
	return oc.writerName
}

func (oc *OpCommon) setFinalPath(p path) {
	oc.finalPath = p
}

func (oc *OpCommon) getFinalPath() path {
	return oc.finalPath
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

func newCreateOp(name string, oldDir BlockPointer, t EntryType) *createOp {
	co := &createOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
		NewName: name,
	}
	co.Dir.Unref = oldDir
	co.customUpdates[oldDir] = &co.Dir
	co.Type = t
	return co
}

func (co *createOp) SizeExceptUpdates() uint64 {
	return uint64(len(co.NewName))
}

func (co *createOp) AllUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(co.Updates))
	copy(updates, co.Updates)
	return append(updates, co.Dir)
}

func (co *createOp) String() string {
	res := fmt.Sprintf("create %s (%s)", co.NewName, co.Type)
	if co.renamed {
		res += " (renamed)"
	}
	return res
}

func (co *createOp) CheckConflict(renamer ConflictRenamer, mergedOp op) (
	crAction, error) {
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
				return &renameMergedAction{
					fromName: co.NewName,
					toName:   co.NewName + renamer.GetConflictSuffix(mergedOp),
					symPath:  co.crSymPath,
				}, nil
			}
			// Otherwise rename the unmerged entry (guaranteed to be a file).
			return &renameUnmergedAction{
				fromName: co.NewName,
				toName:   co.NewName + renamer.GetConflictSuffix(co),
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
			return &copyUnmergedEntryAction{
				fromName: co.NewName,
				toName:   co.NewName + renamer.GetConflictSuffix(co),
				symPath:  co.crSymPath,
				unique:   true,
			}, nil
		}
	}
	// Doesn't conflict with any rmOps, because the default action
	// will just re-create it in the merged branch as necessary.
	return nil, nil
}

func (co *createOp) GetDefaultAction(mergedPath path) crAction {
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

func newRmOp(name string, oldDir BlockPointer) *rmOp {
	ro := &rmOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
		OldName: name,
	}
	ro.Dir.Unref = oldDir
	ro.customUpdates[oldDir] = &ro.Dir
	return ro
}

func (ro *rmOp) SizeExceptUpdates() uint64 {
	return uint64(len(ro.OldName))
}

func (ro *rmOp) AllUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(ro.Updates))
	copy(updates, ro.Updates)
	return append(updates, ro.Dir)
}

func (ro *rmOp) String() string {
	return fmt.Sprintf("rm %s", ro.OldName)
}

func (ro *rmOp) CheckConflict(renamer ConflictRenamer, mergedOp op) (
	crAction, error) {
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

func (ro *rmOp) GetDefaultAction(mergedPath path) crAction {
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
	renamedType EntryType) *renameOp {
	ro := &renameOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
		OldName:     oldName,
		NewName:     newName,
		Renamed:     renamed,
		RenamedType: renamedType,
	}
	ro.OldDir.Unref = oldOldDir
	ro.customUpdates[oldOldDir] = &ro.OldDir
	// If we are renaming within a directory, let the NewDir remain empty.
	if oldOldDir != oldNewDir {
		ro.NewDir.Unref = oldNewDir
		ro.customUpdates[oldNewDir] = &ro.NewDir
	}
	return ro
}

func (ro *renameOp) SizeExceptUpdates() uint64 {
	return uint64(len(ro.NewName) + len(ro.NewName))
}

func (ro *renameOp) AllUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(ro.Updates))
	copy(updates, ro.Updates)
	if (ro.NewDir != blockUpdate{}) {
		return append(updates, ro.NewDir, ro.OldDir)
	}
	return append(updates, ro.OldDir)
}

func (ro *renameOp) String() string {
	return fmt.Sprintf("rename %s -> %s", ro.OldName, ro.NewName)
}

func (ro *renameOp) CheckConflict(renamer ConflictRenamer, mergedOp op) (
	crAction, error) {
	return nil, fmt.Errorf("Unexpected conflict check on a rename op: %s", ro)
}

func (ro *renameOp) GetDefaultAction(mergedPath path) crAction {
	return nil
}

// WriteRange represents a file modification.  Len is 0 for a
// truncate.
type WriteRange struct {
	Off uint64 `codec:"o"`
	Len uint64 `codec:"l,omitempty"` // 0 for truncates
}

// syncOp is an op that represents a series of writes to a file.
type syncOp struct {
	OpCommon
	File   blockUpdate  `codec:"f"`
	Writes []WriteRange `codec:"w"`
}

func newSyncOp(oldFile BlockPointer) *syncOp {
	so := &syncOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
	}
	so.File.Unref = oldFile
	so.customUpdates[oldFile] = &so.File
	return so
}

func (so *syncOp) addWrite(off uint64, length uint64) {
	so.Writes = append(so.Writes, WriteRange{off, length})
}

func (so *syncOp) addTruncate(off uint64) {
	so.Writes = append(so.Writes, WriteRange{off, 0})
}

func (so *syncOp) SizeExceptUpdates() uint64 {
	return uint64(len(so.Writes) * 16)
}

func (so *syncOp) AllUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(so.Updates))
	copy(updates, so.Updates)
	return append(updates, so.File)
}

func (so *syncOp) String() string {
	var writes []string
	for _, r := range so.Writes {
		writes = append(writes, fmt.Sprintf("{off=%d, len=%d}", r.Off, r.Len))
	}
	return fmt.Sprintf("sync [%s]", strings.Join(writes, ", "))
}

func (so *syncOp) CheckConflict(renamer ConflictRenamer, mergedOp op) (
	crAction, error) {
	switch mergedOp.(type) {
	case *syncOp:
		// Any sync on the same file is a conflict.  (TODO: add
		// type-specific intelligent conflict resolvers for file
		// contents?)
		return &renameUnmergedAction{
			fromName: so.getFinalPath().tailName(),
			toName: mergedOp.getFinalPath().tailName() +
				renamer.GetConflictSuffix(so),
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

func (so *syncOp) GetDefaultAction(mergedPath path) crAction {
	return &copyUnmergedEntryAction{
		fromName: so.getFinalPath().tailName(),
		toName:   mergedPath.tailName(),
		symPath:  "",
	}
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
}

func newSetAttrOp(name string, oldDir BlockPointer,
	attr attrChange, file BlockPointer) *setAttrOp {
	sao := &setAttrOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
		Name: name,
	}
	sao.Dir.Unref = oldDir
	sao.customUpdates[oldDir] = &sao.Dir
	sao.Attr = attr
	sao.File = file
	return sao
}

func (sao *setAttrOp) SizeExceptUpdates() uint64 {
	return uint64(len(sao.Name))
}

func (sao *setAttrOp) AllUpdates() []blockUpdate {
	updates := make([]blockUpdate, len(sao.Updates))
	copy(updates, sao.Updates)
	return append(updates, sao.Dir)
}

func (sao *setAttrOp) String() string {
	return fmt.Sprintf("setAttr %s (%s)", sao.Name, sao.Attr)
}

func (sao *setAttrOp) CheckConflict(renamer ConflictRenamer, mergedOp op) (
	crAction, error) {
	switch realMergedOp := mergedOp.(type) {
	case *setAttrOp:
		if realMergedOp.Attr == sao.Attr {
			// A set attr for the same attribute on the same file is a
			// conflict.
			return &renameUnmergedAction{
				fromName: sao.getFinalPath().tailName(),
				toName: mergedOp.getFinalPath().tailName() +
					renamer.GetConflictSuffix(sao),
			}, nil
		}
	}
	return nil, nil
}

func (sao *setAttrOp) GetDefaultAction(mergedPath path) crAction {
	return &copyUnmergedAttrAction{
		fromName: sao.getFinalPath().tailName(),
		toName:   mergedPath.tailName(),
		attr:     []attrChange{sao.Attr},
	}
}

// gcOp is an op that represents garbage-collecting the history of a
// folder (which may involve unreferencing blocks that previously held
// operation lists.
type gcOp struct {
	OpCommon
}

func newGCOp() *gcOp {
	gco := &gcOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
	}
	return gco
}

func (gco *gcOp) SizeExceptUpdates() uint64 {
	return 0
}

func (gco *gcOp) AllUpdates() []blockUpdate {
	return gco.Updates
}

func (gco *gcOp) String() string {
	return "gc"
}

func (gco *gcOp) CheckConflict(renamer ConflictRenamer, mergedOp op) (
	crAction, error) {
	return nil, nil
}

func (gco *gcOp) GetDefaultAction(mergedPath path) crAction {
	return nil
}

// invertOpForLocalNotifications returns an operation that represents
// an undoing of the effect of the given op.  These are intended to be
// used for local notifications only, and would not be useful for
// finding conflicts (for example, we lose information about the type
// of the file in a rmOp that we are trying to re-create).
func invertOpForLocalNotifications(oldOp op) op {
	var newOp op
	switch op := oldOp.(type) {
	default:
		panic(fmt.Sprintf("Unrecognized operation: %v", op))
	case *createOp:
		newOp = newRmOp(op.NewName, op.Dir.Ref)
	case *rmOp:
		// Guess at the type, shouldn't be used for local notification
		// purposes.
		newOp = newCreateOp(op.OldName, op.Dir.Ref, File)
	case *renameOp:
		newOp = newRenameOp(op.NewName, op.NewDir.Ref,
			op.OldName, op.OldDir.Ref, op.Renamed, op.RenamedType)
	case *syncOp:
		// Just replay the writes; for notifications purposes, they
		// will do the right job of marking the right bytes as
		// invalid.
		newOp = newSyncOp(op.File.Ref)
		newOp.(*syncOp).Writes = make([]WriteRange, len(op.Writes))
		copy(newOp.(*syncOp).Writes, op.Writes)
	case *setAttrOp:
		newOp = newSetAttrOp(op.Name, op.Dir.Ref, op.Attr, op.File)
	case *gcOp:
		newOp = op
	}

	// Now reverse all the block updates.  Don't bother with bare Refs
	// and Unrefs since they don't matter for local notification
	// purposes.
	for _, update := range oldOp.AllUpdates() {
		newOp.AddUpdate(update.Ref, update.Unref)
	}
	return newOp
}

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
	case gcOp:
		return reflect.ValueOf(&op)
	}
}

// RegisterOps registers all op types with the given codec.
func RegisterOps(codec Codec) {
	codec.RegisterType(reflect.TypeOf(createOp{}), createOpCode)
	codec.RegisterType(reflect.TypeOf(rmOp{}), rmOpCode)
	codec.RegisterType(reflect.TypeOf(renameOp{}), renameOpCode)
	codec.RegisterType(reflect.TypeOf(syncOp{}), syncOpCode)
	codec.RegisterType(reflect.TypeOf(setAttrOp{}), setAttrOpCode)
	codec.RegisterType(reflect.TypeOf(gcOp{}), gcOpCode)
	codec.RegisterIfaceSliceType(reflect.TypeOf(opsList{}), opsListCode,
		opPointerizer)
}
