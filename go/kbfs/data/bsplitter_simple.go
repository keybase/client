// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/keybase/client/go/kbfs/kbfscodec"
)

// BlockSplitterSimple implements the BlockSplitter interface by using
// a simple max-size algorithm to determine when to split blocks.
type BlockSplitterSimple struct {
	maxSize                 int64
	maxPtrsPerBlock         int
	blockChangeEmbedMaxSize uint64
	maxDirEntriesPerBlock   int
}

func getMaxDirEntriesPerBlock() (int, error) {
	dirEnv := os.Getenv("KEYBASE_BSPLIT_MAX_DIR_ENTRIES")
	if len(dirEnv) > 0 {
		maxDirEntriesPerBlock, err := strconv.Atoi(dirEnv)
		if err != nil {
			return 0, err
		}
		return maxDirEntriesPerBlock, nil
	}
	return 0, nil // disabled by default
}

// NewBlockSplitterSimple creates a new BlockSplittleSimple and
// adjusts the max size to try to match the desired size for file
// blocks, given the overhead of encoding a file block and the
// round-up padding we do.
func NewBlockSplitterSimple(desiredBlockSize int64,
	blockChangeEmbedMaxSize uint64, codec kbfscodec.Codec) (
	*BlockSplitterSimple, error) {
	// If the desired block size is exactly a power of 2, subtract one
	// from it to account for the padding we will do, which rounds up
	// when the encoded size is exactly a power of 2.
	if desiredBlockSize&(desiredBlockSize-1) == 0 {
		desiredBlockSize--
	}

	// Make a FileBlock of the expected size to see what the encoded
	// overhead is.
	block := NewFileBlock().(*FileBlock)
	fullData := make([]byte, desiredBlockSize)
	// Fill in the block with varying data to make sure not to trigger
	// any encoding optimizations.
	for i := range fullData {
		fullData[i] = byte(i)
	}

	maxSize := desiredBlockSize
	var encodedLen int64
	// Iterate until we find the right size (up to a maximum number of
	// attempts), because the overhead is not constant across
	// different Contents lengths (probably due to variable length
	// encoding of the buffer size).
	for i := 0; i < 10; i++ {
		block.Contents = fullData[:maxSize]
		encodedBlock, err := codec.Encode(block)
		if err != nil {
			return nil, err
		}

		encodedLen = int64(len(encodedBlock))
		if encodedLen >= 2*desiredBlockSize {
			return nil, fmt.Errorf("Encoded block of %d bytes is more than "+
				"twice as big as the desired block size %d",
				encodedLen, desiredBlockSize)
		}

		if encodedLen == desiredBlockSize {
			break
		}

		maxSize += (desiredBlockSize - encodedLen)
	}

	if encodedLen != desiredBlockSize {
		return nil, fmt.Errorf("Couldn't converge on a max block size for a "+
			"desired size of %d", desiredBlockSize)
	}

	// Trial and error shows that this magic 75% constant maximizes
	// the number of realistic indirect pointers you can fit into the
	// default block size.  TODO: calculate this number more exactly
	// during initialization for a given `maxSize`.
	maxPtrs := int(.75 * float64(maxSize/int64(BPSize)))
	if maxPtrs < 2 {
		maxPtrs = 2
	}

	maxDirEntriesPerBlock, err := getMaxDirEntriesPerBlock()
	if err != nil {
		return nil, err
	}

	return &BlockSplitterSimple{
		maxSize:                 maxSize,
		maxPtrsPerBlock:         maxPtrs,
		blockChangeEmbedMaxSize: blockChangeEmbedMaxSize,
		maxDirEntriesPerBlock:   maxDirEntriesPerBlock,
	}, nil
}

// NewBlockSplitterSimpleExact returns a BlockSplitterSimple with the
// max block size set to an exact value.
func NewBlockSplitterSimpleExact(
	maxSize int64, maxPtrsPerBlock int, blockChangeEmbedMaxSize uint64) (
	*BlockSplitterSimple, error) {
	maxDirEntriesPerBlock, err := getMaxDirEntriesPerBlock()
	if err != nil {
		return nil, err
	}
	return &BlockSplitterSimple{
		maxSize:                 maxSize,
		maxPtrsPerBlock:         maxPtrsPerBlock,
		blockChangeEmbedMaxSize: blockChangeEmbedMaxSize,
		maxDirEntriesPerBlock:   maxDirEntriesPerBlock,
	}, nil
}

// SetMaxDirEntriesByBlockSize sets the maximum number of directory
// entries per directory block, based on the maximum block size.  If
// the `KEYBASE_BSPLIT_MAX_DIR_ENTRIES` is set, this function does
// nothing.
func (b *BlockSplitterSimple) SetMaxDirEntriesByBlockSize(
	codec kbfscodec.Codec) error {
	dirEnv := os.Getenv("KEYBASE_BSPLIT_MAX_DIR_ENTRIES")
	if len(dirEnv) > 0 {
		// Don't override the environment variable.
		return nil
	}

	block := NewDirBlock().(*DirBlock)
	bigName := strings.Repeat("a", MaxNameBytesDefault)
	// Make "typical" DirEntry, though the max dir entry is a bit
	// bigger than this (can contain a variable-length symlink path,
	// for example).
	de := DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: BlockPointer{
				DirectType: DirectBlock,
			},
		},
		EntryInfo: EntryInfo{
			PrevRevisions: PrevRevisions{
				{Revision: 0, Count: 0},
				{Revision: 1, Count: 1},
				{Revision: 2, Count: 2},
				{Revision: 3, Count: 3},
				{Revision: 4, Count: 4},
			},
		},
	}
	block.Children[bigName] = de
	encodedBlock, err := codec.Encode(block)
	if err != nil {
		return err
	}
	oneEntrySize := int64(len(encodedBlock))
	b.maxDirEntriesPerBlock = int(b.maxSize / oneEntrySize)
	if b.maxDirEntriesPerBlock == 0 {
		b.maxDirEntriesPerBlock = 1
	}
	return nil
}

// CopyUntilSplit implements the BlockSplitter interface for
// BlockSplitterSimple.
func (b *BlockSplitterSimple) CopyUntilSplit(
	block *FileBlock, lastBlock bool, data []byte, off int64) int64 {
	n := int64(len(data))
	currLen := int64(len(block.Contents))
	// lastBlock is irrelevant since we only copy fixed sizes

	toCopy := n
	if currLen < (off + n) {
		moreNeeded := (n + off) - currLen
		// Reduce the number of additional bytes if it will take this block
		// over maxSize.
		if moreNeeded+currLen > b.maxSize {
			moreNeeded = b.maxSize - currLen
			if moreNeeded < 0 {
				// If it is already over maxSize w/o any added bytes,
				// just give up.
				return 0
			}
			// only copy to the end of the block
			toCopy = b.maxSize - off
		}

		if moreNeeded > 0 {
			block.Contents = append(block.Contents, make([]byte, moreNeeded)...)
		}
	}

	// we may have filled out the block above, but we still can't copy anything
	if off > int64(len(block.Contents)) {
		return 0
	}

	copy(block.Contents[off:off+toCopy], data[:toCopy])
	return toCopy
}

// CheckSplit implements the BlockSplitter interface for
// BlockSplitterSimple.
func (b *BlockSplitterSimple) CheckSplit(block *FileBlock) int64 {
	// The split will always be right
	return 0
}

// MaxPtrsPerBlock implements the BlockSplitter interface for
// BlockSplitterSimple.
func (b *BlockSplitterSimple) MaxPtrsPerBlock() int {
	return b.maxPtrsPerBlock
}

// ShouldEmbedData implements the BlockSplitter interface for
// BlockSplitterSimple.
func (b *BlockSplitterSimple) ShouldEmbedData(size uint64) bool {
	return size <= b.blockChangeEmbedMaxSize
}

// SplitDirIfNeeded implements the BlockSplitter interface for
// BlockSplitterSimple.
func (b *BlockSplitterSimple) SplitDirIfNeeded(block *DirBlock) (
	[]*DirBlock, *StringOffset) {
	if block.IsIndirect() {
		panic("SplitDirIfNeeded must be given only a direct block")
	}

	if b.maxDirEntriesPerBlock == 0 ||
		len(block.Children) <= b.maxDirEntriesPerBlock {
		return []*DirBlock{block}, nil
	}

	// Sort the entries and split them down the middle.
	names := make([]string, 0, len(block.Children))
	for name := range block.Children {
		names = append(names, name)
	}

	sort.Strings(names)
	// Delete the second half of the names from the original block,
	// and add to the new block.
	newBlock := NewDirBlock().(*DirBlock)
	startOff := len(names) / 2
	for _, name := range names[len(names)/2:] {
		newBlock.Children[name] = block.Children[name]
		delete(block.Children, name)
	}
	newOffset := StringOffset(names[startOff])
	return []*DirBlock{block, newBlock}, &newOffset
}

// MaxSize returns the max block size.
func (b *BlockSplitterSimple) MaxSize() int64 {
	return b.maxSize
}

// SetBlockChangeEmbedMaxSizeForTesting sets the max size for block
// change embeds, which is useful for testing.  It is not
// goroutine-safe.
func (b *BlockSplitterSimple) SetBlockChangeEmbedMaxSizeForTesting(
	newSize uint64) {
	b.blockChangeEmbedMaxSize = newSize
}

// SetMaxDirEntriesPerBlockForTesting sets the max dir entries for a
// block, which is useful for testing.  It is not goroutine-safe.
func (b *BlockSplitterSimple) SetMaxDirEntriesPerBlockForTesting(newMax int) {
	b.maxDirEntriesPerBlock = newMax
}
