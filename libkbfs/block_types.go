// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
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
	// Marker for files with holes
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

// NewEmpty implements the Block interface for CommonBlock
func (cb *CommonBlock) NewEmpty() Block {
	return NewCommonBlock()
}

// Set implements the Block interface for CommonBlock
func (cb *CommonBlock) Set(other Block, codec kbfscodec.Codec) {
	// Don't assert type for CommonBlock because we need to be able to Set from
	// specific block types
	err := kbfscodec.Update(codec, cb, other)
	if err != nil {
		panic("Unable to CommonBlock.Set")
	}
	cb.cacheMtx.Lock()
	defer cb.cacheMtx.Unlock()
	cb.cachedEncodedSize = other.GetEncodedSize()
}

// Copy copies a CommonBlock without the lock
func (cb *CommonBlock) Copy() CommonBlock {
	return CommonBlock{
		IsInd: cb.IsInd,
		UnknownFieldSetHandler: cb.UnknownFieldSetHandler,
		cachedEncodedSize:      cb.cachedEncodedSize,
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

// Set implements the Block interface for DirBlock
func (db *DirBlock) Set(other Block, codec kbfscodec.Codec) {
	otherDb := other.(*DirBlock)
	dbCopy, err := otherDb.DeepCopy(codec)
	if err != nil {
		panic("Unable to DirBlock.Set")
	}
	db.cacheMtx.Lock()
	defer db.cacheMtx.Unlock()
	db.IsInd = dbCopy.IsInd
	db.UnknownFieldSetHandler = dbCopy.UnknownFieldSetHandler
	db.cachedEncodedSize = dbCopy.cachedEncodedSize
	db.Children = dbCopy.Children
	db.IPtrs = dbCopy.IPtrs
}

// DeepCopy makes a complete copy of a DirBlock
func (db *DirBlock) DeepCopy(codec kbfscodec.Codec) (*DirBlock, error) {
	var dirBlockCopy DirBlock
	db.cacheMtx.RLock()
	defer db.cacheMtx.RUnlock()
	err := kbfscodec.Update(codec, &dirBlockCopy, db)
	if err != nil {
		return nil, err
	}
	if dirBlockCopy.Children == nil {
		dirBlockCopy.Children = make(map[string]DirEntry)
	}
	dirBlockCopy.cachedEncodedSize = db.cachedEncodedSize
	return &dirBlockCopy, nil
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

// DataVersion returns data version for this block.
func (fb *FileBlock) DataVersion() DataVer {
	for i := range fb.IPtrs {
		if fb.IPtrs[i].Holes {
			return FilesWithHolesDataVer
		}
	}
	return FirstValidDataVer
}

// Set implements the Block interface for FileBlock
func (fb *FileBlock) Set(other Block, codec kbfscodec.Codec) {
	otherFb := other.(*FileBlock)
	copy, err := otherFb.DeepCopy(codec)
	if err != nil {
		panic("Unable to DirBlock.Set")
	}
	fb.cacheMtx.Lock()
	defer fb.cacheMtx.Unlock()
	fb.IsInd = copy.IsInd
	fb.UnknownFieldSetHandler = copy.UnknownFieldSetHandler
	fb.cachedEncodedSize = copy.cachedEncodedSize
	fb.Contents = copy.Contents
	fb.IPtrs = copy.IPtrs
	fb.hash = copy.hash
}

// DeepCopy makes a complete copy of a FileBlock
func (fb *FileBlock) DeepCopy(codec kbfscodec.Codec) (*FileBlock, error) {
	fb.cacheMtx.RLock()
	defer fb.cacheMtx.RUnlock()
	var fileBlockCopy FileBlock
	err := kbfscodec.Update(codec, &fileBlockCopy, fb)
	if err != nil {
		return nil, err
	}
	fileBlockCopy.hash = fb.hash.Copy()
	fileBlockCopy.cachedEncodedSize = fb.cachedEncodedSize
	return &fileBlockCopy, nil
}

// UpdateHash updates the hash of this FileBlock
func (fb *FileBlock) UpdateHash() kbfshash.RawDefaultHash {
	fb.cacheMtx.Lock()
	defer fb.cacheMtx.Unlock()
	_, hash := kbfshash.DoRawDefaultHash(fb.Contents)
	fb.hash = &hash
	return hash
}

// UpdateHashIfNil updates the hash of this FileBlock only if
// the hash is currently nil
func (fb *FileBlock) UpdateHashIfNil() kbfshash.RawDefaultHash {
	fb.cacheMtx.Lock()
	defer fb.cacheMtx.Unlock()
	if fb.hash == nil {
		_, hash := kbfshash.DoRawDefaultHash(fb.Contents)
		fb.hash = &hash
	}
	return *fb.hash
}

// DefaultNewBlockDataVersion returns the default data version for new blocks.
func DefaultNewBlockDataVersion(holes bool) DataVer {
	if holes {
		return FilesWithHolesDataVer
	}
	return FirstValidDataVer
}
