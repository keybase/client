package libkbfs

import (
	"reflect"
)

// op represents a single file-system remote-sync operation
type op interface {
	AddRefBlock(ptr BlockPointer)
	AddUnrefBlock(ptr BlockPointer)
	AddUpdate(oldPtr BlockPointer, newPtr BlockPointer)
	SizeExceptUpdates() uint64
	AllUpdates() []blockUpdate
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

// createOp is an op representing a file or subdirectory creation
type createOp struct {
	OpCommon
	NewName string      `codec:"n"`
	Dir     blockUpdate `codec:"d"`
	Type    EntryType   `codec:"t"`
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

// rmOp is an op representing a file or subdirectory removal
type rmOp struct {
	OpCommon
	OldName string      `codec:"n"`
	Dir     blockUpdate `codec:"d"`
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

// renameOp is an op representing a rename of a file/subdirectory from
// one directory to another.  If this is a rename within the same
// directory, NewDir will be equivalent to blockUpdate{}.
type renameOp struct {
	OpCommon
	OldName string      `codec:"on"`
	OldDir  blockUpdate `codec:"od"`
	NewName string      `codec:"nn"`
	NewDir  blockUpdate `codec:"nd"`
}

func newRenameOp(oldName string, oldOldDir BlockPointer,
	newName string, oldNewDir BlockPointer) *renameOp {
	ro := &renameOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
		OldName: oldName,
		NewName: newName,
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

type attrChange uint16

const (
	exAttr attrChange = iota
	mtimeAttr
)

// setAttrOp is an op that represents changing the attributes of a
// file/subdirectory with in a directory.
type setAttrOp struct {
	OpCommon
	Name string      `codec:"n"`
	Dir  blockUpdate `codec:"d"`
	Attr attrChange  `codec:"a"`
}

func newSetAttrOp(name string, oldDir BlockPointer,
	attr attrChange) *setAttrOp {
	sao := &setAttrOp{
		OpCommon: OpCommon{
			customUpdates: make(map[BlockPointer]*blockUpdate),
		},
		Name: name,
	}
	sao.Dir.Unref = oldDir
	sao.customUpdates[oldDir] = &sao.Dir
	sao.Attr = attr
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
