// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strconv"
	"sync"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfshash"
)

// Int64Offset represents the offset of a block within a file.
type Int64Offset int64

var _ Offset = Int64Offset(0)

// Equals implements the Offset interface for Int64Offset.
func (i Int64Offset) Equals(other Offset) bool {
	otherI, ok := other.(Int64Offset)
	if !ok {
		panic(fmt.Sprintf("Can't compare against non-int offset: %T", other))
	}
	return int64(i) == int64(otherI)
}

// Less implements the Offset interface for Int64Offset.
func (i Int64Offset) Less(other Offset) bool {
	otherI, ok := other.(Int64Offset)
	if !ok {
		panic(fmt.Sprintf("Can't compare against non-int offset: %T", other))
	}
	return int64(i) < int64(otherI)
}

func (i Int64Offset) String() string {
	return strconv.FormatInt(int64(i), 10)
}

// StringOffset represents the offset of a block within a directory.
type StringOffset string

var _ Offset = (*StringOffset)(nil)

// Equals implements the Offset interface for StringOffset.
func (s *StringOffset) Equals(other Offset) bool {
	if s == nil {
		return other == nil
	} else if other == nil {
		return false
	}
	otherS, ok := other.(*StringOffset)
	if !ok {
		panic(fmt.Sprintf("Can't compare against non-string offset: %T", other))
	}
	return string(*s) == string(*otherS)
}

// Less implements the Offset interface for StringOffset.
func (s *StringOffset) Less(other Offset) bool {
	if s == nil {
		return other != nil
	} else if other == nil {
		return false
	}
	otherS, ok := other.(*StringOffset)
	if !ok {
		panic(fmt.Sprintf("Can't compare against non-string offset: %T", other))
	}
	return string(*s) < string(*otherS)
}

func (s *StringOffset) String() string {
	return string(*s)
}

// IndirectDirPtr pairs an indirect dir block with the start of that
// block's range of directory entries (inclusive)
type IndirectDirPtr struct {
	// TODO: Make sure that the block is not dirty when the EncodedSize
	// field is non-zero.
	BlockInfo
	Off StringOffset `codec:"o"`

	codec.UnknownFieldSetHandler
}

// IndirectFilePtr pairs an indirect file block with the start of that
// block's range of bytes (inclusive)
//
// If `Holes` is true, then this pointer is part of a list of pointers
// that has non-continuous offsets; that is, the offset of ptr `i`
// plus the length of the corresponding block contents is less than
// the offset of ptr `i`+1.
type IndirectFilePtr struct {
	// When the EncodedSize field is non-zero, the block must not
	// be dirty.
	BlockInfo
	Off Int64Offset `codec:"o"`
	// Marker for files with holes.  This is here for historical
	// reasons; a `FileBlock` should be treated as having a `HasHoles`
	// flag set to true if any of its IPtrs have `Holes` set to true.
	Holes bool `codec:"h,omitempty"`

	codec.UnknownFieldSetHandler
}

// CommonBlock holds block data that is common for both subdirectories
// and files.
type CommonBlock struct {
	// IsInd indicates where this block is so big it requires indirect pointers
	IsInd bool `codec:"s"`

	codec.UnknownFieldSetHandler

	cacheMtx sync.RWMutex
	// cachedEncodedSize is the locally-cached (non-serialized)
	// encoded size for this block.
	cachedEncodedSize uint32
}

var _ Block = (*CommonBlock)(nil)

// GetEncodedSize implements the Block interface for CommonBlock
func (cb *CommonBlock) GetEncodedSize() uint32 {
	cb.cacheMtx.RLock()
	defer cb.cacheMtx.RUnlock()
	return cb.cachedEncodedSize
}

// SetEncodedSize implements the Block interface for CommonBlock
func (cb *CommonBlock) SetEncodedSize(size uint32) {
	cb.cacheMtx.Lock()
	defer cb.cacheMtx.Unlock()
	cb.cachedEncodedSize = size
}

// DataVersion returns data version for this block.
func (cb *CommonBlock) DataVersion() DataVer {
	return FirstValidDataVer
}

// NewEmpty implements the Block interface for CommonBlock.
func (cb *CommonBlock) NewEmpty() Block {
	return NewCommonBlock()
}

// NewEmptier implements the Block interface for CommonBlock.
func (cb *CommonBlock) NewEmptier() func() Block {
	return NewCommonBlock
}

// ToCommonBlock implements the Block interface for CommonBlock.
func (cb *CommonBlock) ToCommonBlock() *CommonBlock {
	return cb
}

// IsIndirect implements the Block interface for CommonBlock.
func (cb *CommonBlock) IsIndirect() bool {
	return cb.IsInd
}

// IsTail implements the Block interface for CommonBlock.
func (cb *CommonBlock) IsTail() bool {
	panic("CommonBlock doesn't know how to compute IsTail")
}

// OffsetExceedsData implements the Block interface for CommonBlock.
func (cb *CommonBlock) OffsetExceedsData(_, _ Offset) bool {
	panic("CommonBlock doesn't implement data methods")
}

// Set implements the Block interface for CommonBlock.
func (cb *CommonBlock) Set(other Block) {
	otherCommon := other.ToCommonBlock()
	cb.IsInd = otherCommon.IsInd
	cb.UnknownFieldSetHandler = otherCommon.UnknownFieldSetHandler
	cb.SetEncodedSize(otherCommon.GetEncodedSize())
}

// BytesCanBeDirtied implements the Block interface for CommonBlock.
func (cb *CommonBlock) BytesCanBeDirtied() int64 {
	return 0
}

// DeepCopy copies a CommonBlock without the lock.
func (cb *CommonBlock) DeepCopy() CommonBlock {
	return CommonBlock{
		IsInd: cb.IsInd,
		// We don't need to copy UnknownFieldSetHandler because it's immutable.
		UnknownFieldSetHandler: cb.UnknownFieldSetHandler,
		cachedEncodedSize:      cb.GetEncodedSize(),
	}
}

// NewCommonBlock returns a generic block, unsuitable for caching.
func NewCommonBlock() Block {
	return &CommonBlock{}
}

// DirBlock is the contents of a directory
type DirBlock struct {
	CommonBlock
	// if not indirect, a map of path name to directory entry
	Children map[string]DirEntry `codec:"c,omitempty"`
	// if indirect, contains the indirect pointers to the next level of blocks
	IPtrs []IndirectDirPtr `codec:"i,omitempty"`
}

var _ BlockWithPtrs = (*DirBlock)(nil)

// NewDirBlock creates a new, empty DirBlock.
func NewDirBlock() Block {
	return &DirBlock{
		Children: make(map[string]DirEntry),
	}
}

// NewDirBlockWithPtrs creates a new, empty DirBlock.
func NewDirBlockWithPtrs(isInd bool) BlockWithPtrs {
	db := NewDirBlock().(*DirBlock)
	db.IsInd = isInd
	return db
}

// NewEmpty implements the Block interface for DirBlock
func (db *DirBlock) NewEmpty() Block {
	return NewDirBlock()
}

// NewEmptier implements the Block interface for DirBlock.
func (db *DirBlock) NewEmptier() func() Block {
	return NewDirBlock
}

// IsTail implements the Block interface for DirBlock.
func (db *DirBlock) IsTail() bool {
	if db.IsInd {
		return len(db.IPtrs) == 0
	}
	for _, de := range db.Children {
		if de.Type != Sym {
			return false
		}
	}
	return true
}

// DataVersion returns data version for this block, which is assumed
// to have been modified locally.
func (db *DirBlock) DataVersion() DataVer {
	if db.IsInd {
		return IndirectDirsDataVer
	}
	return FirstValidDataVer
}

// ToCommonBlock implements the Block interface for DirBlock.
func (db *DirBlock) ToCommonBlock() *CommonBlock {
	return &db.CommonBlock
}

// Set implements the Block interface for DirBlock
func (db *DirBlock) Set(other Block) {
	otherDb := other.(*DirBlock)
	dbCopy := otherDb.DeepCopy()
	db.Children = dbCopy.Children
	db.IPtrs = dbCopy.IPtrs
	db.ToCommonBlock().Set(dbCopy.ToCommonBlock())
}

// DeepCopy makes a complete copy of a DirBlock
func (db *DirBlock) DeepCopy() *DirBlock {
	childrenCopy := make(map[string]DirEntry, len(db.Children))
	for k, v := range db.Children {
		childrenCopy[k] = v
	}
	var iptrsCopy []IndirectDirPtr
	if db.IsInd {
		iptrsCopy = make([]IndirectDirPtr, len(db.IPtrs))
		copy(iptrsCopy, db.IPtrs)
	}
	return &DirBlock{
		CommonBlock: db.CommonBlock.DeepCopy(),
		Children:    childrenCopy,
		IPtrs:       iptrsCopy,
	}
}

// OffsetExceedsData implements the Block interface for DirBlock.
func (db *DirBlock) OffsetExceedsData(startOff, off Offset) bool {
	// DirBlocks have open-ended children maps, so theoretically this
	// block could have children all the way to the end of the
	// alphabet.
	return false
}

// BytesCanBeDirtied implements the Block interface for DirBlock.
func (db *DirBlock) BytesCanBeDirtied() int64 {
	// Dir blocks don't track individual dirty bytes.
	return 0
}

// FirstOffset implements the Block interface for DirBlock.
func (db *DirBlock) FirstOffset() Offset {
	firstString := StringOffset("")
	return &firstString
}

// NumIndirectPtrs implements the BlockWithPtrs interface for DirBlock.
func (db *DirBlock) NumIndirectPtrs() int {
	if !db.IsInd {
		panic("NumIndirectPtrs called on a direct directory block")
	}
	return len(db.IPtrs)
}

// IndirectPtr implements the BlockWithPtrs interface for DirBlock.
func (db *DirBlock) IndirectPtr(i int) (BlockInfo, Offset) {
	if !db.IsInd {
		panic("IndirectPtr called on a direct directory block")
	}
	iptr := db.IPtrs[i]
	off := StringOffset(iptr.Off)
	return iptr.BlockInfo, &off
}

// AppendNewIndirectPtr implements the BlockWithPtrs interface for FileBlock.
func (db *DirBlock) AppendNewIndirectPtr(ptr BlockPointer, off Offset) {
	if !db.IsInd {
		panic("AppendNewIndirectPtr called on a direct directory block")
	}
	sOff, ok := off.(*StringOffset)
	if !ok {
		panic(fmt.Sprintf("AppendNewIndirectPtr called on a directory block "+
			"with a %T offset", off))
	}
	db.IPtrs = append(db.IPtrs, IndirectDirPtr{
		BlockInfo: BlockInfo{
			BlockPointer: ptr,
			EncodedSize:  0,
		},
		Off: *sOff,
	})
}

// ClearIndirectPtrSize implements the BlockWithPtrs interface for DirBlock.
func (db *DirBlock) ClearIndirectPtrSize(i int) {
	if !db.IsInd {
		panic("ClearIndirectPtrSize called on a direct directory block")
	}
	db.IPtrs[i].EncodedSize = 0
}

// SetIndirectPtrType implements the BlockWithPtrs interface for DirBlock.
func (db *DirBlock) SetIndirectPtrType(i int, dt BlockDirectType) {
	if !db.IsInd {
		panic("SetIndirectPtrType called on a direct directory block")
	}
	db.IPtrs[i].DirectType = dt
}

// SwapIndirectPtrs implements the BlockWithPtrs interface for DirBlock.
func (db *DirBlock) SwapIndirectPtrs(i int, other BlockWithPtrs, otherI int) {
	otherDB, ok := other.(*DirBlock)
	if !ok {
		panic(fmt.Sprintf(
			"SwapIndirectPtrs cannot swap between block types: %T", other))
	}

	db.IPtrs[i], otherDB.IPtrs[otherI] = otherDB.IPtrs[otherI], db.IPtrs[i]
}

// SetIndirectPtrOff implements the BlockWithPtrs interface for DirBlock.
func (db *DirBlock) SetIndirectPtrOff(i int, off Offset) {
	if !db.IsInd {
		panic("SetIndirectPtrOff called on a direct directory block")
	}
	sOff, ok := off.(*StringOffset)
	if !ok {
		panic(fmt.Sprintf("SetIndirectPtrOff called on a dirctory block "+
			"with a %T offset", off))
	}
	db.IPtrs[i].Off = *sOff
}

// SetIndirectPtrInfo implements the BlockWithPtrs interface for DirBlock.
func (db *DirBlock) SetIndirectPtrInfo(i int, info BlockInfo) {
	if !db.IsInd {
		panic("SetIndirectPtrInfo called on a direct directory block")
	}
	db.IPtrs[i].BlockInfo = info
}

func (db *DirBlock) totalPlainSizeEstimate(
	plainSize int, bsplit BlockSplitter) int {
	if !db.IsIndirect() || len(db.IPtrs) == 0 {
		return plainSize
	}

	// If the top block is indirect, it's too costly to estimate the
	// sizes by checking the plain sizes of all the leafs.  Instead
	// use the following imperfect heuristics:
	//
	// * If there are N child pointers, and the first one is a direct
	//   pointer, assume N-1 of them are full.
	//
	// * If there are N child pointers, and the first one is an
	//   indirect pointer, just give up and max out at the maximum
	//   number of indirect pointers in a block, assuming that at
	//   least one indirect block is full of pointers when there are
	//   at least 2 indirect levels in the tree.
	//
	// This isn't great since it overestimates in many cases
	// (especially when removing entries), and can vastly unerestimate
	// if there are more than 2 levels of indirection.  But it seems
	// unlikely that directory byte size matters for anything in real
	// life.  Famous last words, of course...
	if db.IPtrs[0].DirectType == DirectBlock {
		return MaxBlockSizeBytesDefault * (len(db.IPtrs) - 1)
	}
	return MaxBlockSizeBytesDefault * bsplit.MaxPtrsPerBlock()
}

// FileBlock is the contents of a file
type FileBlock struct {
	CommonBlock
	// if not indirect, the full contents of this block
	Contents []byte `codec:"c,omitempty"`
	// if indirect, contains the indirect pointers to the next level of blocks
	IPtrs []IndirectFilePtr `codec:"i,omitempty"`

	// this is used for caching plaintext (block.Contents) hash. It is used by
	// only direct blocks.
	hash *kbfshash.RawDefaultHash
}

var _ BlockWithPtrs = (*FileBlock)(nil)

// NewFileBlock creates a new, empty FileBlock.
func NewFileBlock() Block {
	return &FileBlock{
		Contents: make([]byte, 0, 0),
	}
}

// NewFileBlockWithPtrs creates a new, empty FileBlock.
func NewFileBlockWithPtrs(isInd bool) BlockWithPtrs {
	fb := NewFileBlock().(*FileBlock)
	fb.IsInd = isInd
	return fb
}

// NewEmpty implements the Block interface for FileBlock
func (fb *FileBlock) NewEmpty() Block {
	return &FileBlock{}
}

// NewEmptier implements the Block interface for FileBlock.
func (fb *FileBlock) NewEmptier() func() Block {
	return NewFileBlock
}

// IsTail implements the Block interface for FileBlock.
func (fb *FileBlock) IsTail() bool {
	if fb.IsInd {
		return len(fb.IPtrs) == 0
	}
	return true
}

// DataVersion returns data version for this block, which is assumed
// to have been modified locally.
func (fb *FileBlock) DataVersion() DataVer {
	if !fb.IsInd {
		return FirstValidDataVer
	}

	if len(fb.IPtrs) == 0 {
		// This is a truncated file block that hasn't had its level of
		// indirection removed.
		return FirstValidDataVer
	}

	// If this is an indirect block, and none of its children are
	// marked as direct blocks, then this must be a big file.  Note
	// that we do it this way, rather than returning on the first
	// non-direct block, to support appending to existing files and
	// making them big.
	hasHoles := false
	hasDirect := false
	maxDirectType := UnknownDirectType
	for i := range fb.IPtrs {
		if maxDirectType != UnknownDirectType &&
			fb.IPtrs[i].DirectType != UnknownDirectType &&
			maxDirectType != fb.IPtrs[i].DirectType {
			panic("Mixed data versions among indirect pointers")
		}
		if fb.IPtrs[i].DirectType > maxDirectType {
			maxDirectType = fb.IPtrs[i].DirectType
		}

		if fb.IPtrs[i].DirectType == DirectBlock {
			hasDirect = true
		} else if fb.IPtrs[i].Holes {
			hasHoles = true
		}
		// We can only safely break if both vars are definitely set to
		// their final value.
		if hasDirect && hasHoles {
			break
		}
	}

	if maxDirectType == UnknownDirectType {
		panic("No known type for any indirect pointer")
	}

	if !hasDirect {
		return AtLeastTwoLevelsOfChildrenDataVer
	} else if hasHoles {
		return ChildHolesDataVer
	}
	return FirstValidDataVer
}

// ToCommonBlock implements the Block interface for FileBlock.
func (fb *FileBlock) ToCommonBlock() *CommonBlock {
	return &fb.CommonBlock
}

// Set implements the Block interface for FileBlock
func (fb *FileBlock) Set(other Block) {
	otherFb := other.(*FileBlock)
	fbCopy := otherFb.DeepCopy()
	fb.Contents = fbCopy.Contents
	fb.IPtrs = fbCopy.IPtrs
	fb.ToCommonBlock().Set(fbCopy.ToCommonBlock())
	// Ensure that the Set is complete from Go's perspective by calculating the
	// hash on the new FileBlock if the old one has been set. This is mainly so
	// tests can blindly compare that blocks are equivalent.
	if otherFb.hash != nil {
		_ = fb.GetHash()
	}
}

// DeepCopy makes a complete copy of a FileBlock
func (fb *FileBlock) DeepCopy() *FileBlock {
	var contentsCopy []byte
	if fb.Contents != nil {
		contentsCopy = make([]byte, len(fb.Contents))
		copy(contentsCopy, fb.Contents)
	}
	var iptrsCopy []IndirectFilePtr
	if fb.IPtrs != nil {
		iptrsCopy = make([]IndirectFilePtr, len(fb.IPtrs))
		copy(iptrsCopy, fb.IPtrs)
	}
	return &FileBlock{
		CommonBlock: fb.CommonBlock.DeepCopy(),
		Contents:    contentsCopy,
		IPtrs:       iptrsCopy,
	}
}

// GetHash returns the hash of this FileBlock. If the hash is nil, it first
// calculates it.
func (fb *FileBlock) GetHash() kbfshash.RawDefaultHash {
	h := func() *kbfshash.RawDefaultHash {
		fb.cacheMtx.RLock()
		defer fb.cacheMtx.RUnlock()
		return fb.hash
	}()
	if h != nil {
		return *h
	}
	_, hash := kbfshash.DoRawDefaultHash(fb.Contents)
	fb.cacheMtx.Lock()
	defer fb.cacheMtx.Unlock()
	fb.hash = &hash
	return *fb.hash
}

// OffsetExceedsData implements the Block interface for FileBlock.
func (fb *FileBlock) OffsetExceedsData(startOff, off Offset) bool {
	if fb.IsInd {
		panic("OffsetExceedsData called on an indirect file block")
	}

	if len(fb.Contents) == 0 {
		return false
	}

	offI, ok := off.(Int64Offset)
	if !ok {
		panic(fmt.Sprintf("Bad offset of type %T passed to FileBlock", off))
	}
	startOffI, ok := startOff.(Int64Offset)
	if !ok {
		panic(fmt.Sprintf("Bad offset of type %T passed to FileBlock",
			startOff))
	}
	return int64(offI) >= int64(startOffI)+int64(len(fb.Contents))
}

// BytesCanBeDirtied implements the Block interface for FileBlock.
func (fb *FileBlock) BytesCanBeDirtied() int64 {
	return int64(len(fb.Contents))
}

// FirstOffset implements the Block interface for FileBlock.
func (fb *FileBlock) FirstOffset() Offset {
	return Int64Offset(0)
}

// NumIndirectPtrs implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) NumIndirectPtrs() int {
	if !fb.IsInd {
		panic("NumIndirectPtrs called on a direct file block")
	}
	return len(fb.IPtrs)
}

// IndirectPtr implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) IndirectPtr(i int) (BlockInfo, Offset) {
	if !fb.IsInd {
		panic("IndirectPtr called on a direct file block")
	}
	iptr := fb.IPtrs[i]
	return iptr.BlockInfo, iptr.Off
}

// AppendNewIndirectPtr implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) AppendNewIndirectPtr(ptr BlockPointer, off Offset) {
	if !fb.IsInd {
		panic("AppendNewIndirectPtr called on a direct file block")
	}
	iOff, ok := off.(Int64Offset)
	if !ok {
		panic(fmt.Sprintf("AppendNewIndirectPtr called on a file block "+
			"with a %T offset", off))
	}
	fb.IPtrs = append(fb.IPtrs, IndirectFilePtr{
		BlockInfo: BlockInfo{
			BlockPointer: ptr,
			EncodedSize:  0,
		},
		Off: iOff,
	})
}

// ClearIndirectPtrSize implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) ClearIndirectPtrSize(i int) {
	if !fb.IsInd {
		panic("ClearIndirectPtrSize called on a direct file block")
	}
	fb.IPtrs[i].EncodedSize = 0
}

// SetIndirectPtrType implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) SetIndirectPtrType(i int, dt BlockDirectType) {
	if !fb.IsInd {
		panic("SetIndirectPtrType called on a direct file block")
	}
	fb.IPtrs[i].DirectType = dt
}

// SwapIndirectPtrs implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) SwapIndirectPtrs(i int, other BlockWithPtrs, otherI int) {
	otherFB, ok := other.(*FileBlock)
	if !ok {
		panic(fmt.Sprintf(
			"SwapIndirectPtrs cannot swap between block types: %T", other))
	}

	fb.IPtrs[i], otherFB.IPtrs[otherI] = otherFB.IPtrs[otherI], fb.IPtrs[i]
}

// SetIndirectPtrOff implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) SetIndirectPtrOff(i int, off Offset) {
	if !fb.IsInd {
		panic("SetIndirectPtrOff called on a direct file block")
	}
	iOff, ok := off.(Int64Offset)
	if !ok {
		panic(fmt.Sprintf("SetIndirectPtrOff called on a file block "+
			"with a %T offset", off))
	}
	fb.IPtrs[i].Off = iOff
}

// SetIndirectPtrInfo implements the BlockWithPtrs interface for FileBlock.
func (fb *FileBlock) SetIndirectPtrInfo(i int, info BlockInfo) {
	if !fb.IsInd {
		panic("SetIndirectPtrInfo called on a direct file block")
	}
	fb.IPtrs[i].BlockInfo = info
}

// DefaultNewBlockDataVersion returns the default data version for new blocks.
func DefaultNewBlockDataVersion(holes bool) DataVer {
	if holes {
		return ChildHolesDataVer
	}
	return FirstValidDataVer
}
