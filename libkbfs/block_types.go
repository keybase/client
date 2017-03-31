// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfshash"
)

// IndirectDirPtr pairs an indirect dir block with the start of that
// block's range of directory entries (inclusive)
type IndirectDirPtr struct {
	// TODO: Make sure that the block is not dirty when the EncodedSize
	// field is non-zero.
	BlockInfo
	Off string `codec:"o"`

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
	Off int64 `codec:"o"`
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

// ToCommonBlock implements the Block interface for CommonBlock.
func (cb *CommonBlock) ToCommonBlock() *CommonBlock {
	return cb
}

// Set implements the Block interface for CommonBlock.
func (cb *CommonBlock) Set(other Block) {
	otherCopy := other.ToCommonBlock()
	cb.IsInd = otherCopy.IsInd
	cb.UnknownFieldSetHandler = otherCopy.UnknownFieldSetHandler
	cb.SetEncodedSize(otherCopy.GetEncodedSize())
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

// NewDirBlock creates a new, empty DirBlock.
func NewDirBlock() Block {
	return &DirBlock{
		Children: make(map[string]DirEntry),
	}
}

// NewEmpty implements the Block interface for DirBlock
func (db *DirBlock) NewEmpty() Block {
	return NewDirBlock()
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
	// TODO KBFS-3: add a copy for IPtrs too once we support indirect dir
	// blocks
	return &DirBlock{
		CommonBlock: db.CommonBlock.DeepCopy(),
		Children:    childrenCopy,
		IPtrs:       db.IPtrs,
	}
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

// NewFileBlock creates a new, empty FileBlock.
func NewFileBlock() Block {
	return &FileBlock{
		Contents: make([]byte, 0, 0),
	}
}

// NewEmpty implements the Block interface for FileBlock
func (fb *FileBlock) NewEmpty() Block {
	return &FileBlock{}
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

// DefaultNewBlockDataVersion returns the default data version for new blocks.
func DefaultNewBlockDataVersion(holes bool) DataVer {
	if holes {
		return ChildHolesDataVer
	}
	return FirstValidDataVer
}
