// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "github.com/keybase/go-codec/codec"

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

	// cachedEncodedSize is the locally-cached (non-serialized)
	// encoded size for this block.
	cachedEncodedSize uint32
}

// GetEncodedSize implements the Block interface for CommonBlock
func (cb CommonBlock) GetEncodedSize() uint32 {
	return cb.cachedEncodedSize
}

// SetEncodedSize implements the Block interface for CommonBlock
func (cb *CommonBlock) SetEncodedSize(size uint32) {
	cb.cachedEncodedSize = size
}

// DataVersion returns data version for this block.
func (cb *CommonBlock) DataVersion() DataVer {
	return FirstValidDataVer
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

// DeepCopy makes a complete copy of a DirBlock
func (db DirBlock) DeepCopy(codec Codec) (*DirBlock, error) {
	var dirBlockCopy DirBlock
	err := CodecUpdate(codec, &dirBlockCopy, db)
	if err != nil {
		return nil, err
	}
	if dirBlockCopy.Children == nil {
		dirBlockCopy.Children = make(map[string]DirEntry)
	}
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
	hash *RawDefaultHash
}

// NewFileBlock creates a new, empty FileBlock.
func NewFileBlock() Block {
	return &FileBlock{
		Contents: make([]byte, 0, 0),
	}
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

// DeepCopy makes a complete copy of a FileBlock
func (fb FileBlock) DeepCopy(codec Codec) (*FileBlock, error) {
	var fileBlockCopy FileBlock
	err := CodecUpdate(codec, &fileBlockCopy, fb)
	if err != nil {
		return nil, err
	}
	return &fileBlockCopy, nil
}

// DefaultNewBlockDataVersion returns the default data version for new blocks.
func DefaultNewBlockDataVersion(c Config, holes bool) DataVer {
	if holes {
		return FilesWithHolesDataVer
	}
	return FirstValidDataVer
}
