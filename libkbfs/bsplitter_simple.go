package libkbfs

import "fmt"

// BlockSplitterSimple implements the BlockSplitter interface by using
// a simple max-size algorithm to determine when to split blocks.
type BlockSplitterSimple struct {
	maxSize                 int64
	blockChangeEmbedMaxSize uint64
}

// NewBlockSplitterSimple creates a new BlockSplittleSimple and
// adjusts the max size to try to match the desired size for file
// blocks, given the overhead of encoding a file block and the
// round-up padding we do.
func NewBlockSplitterSimple(desiredBlockSize int64,
	blockChangeEmbedMaxSize uint64, codec Codec) (*BlockSplitterSimple, error) {
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
	for i := range fullData {
		fullData[i] = byte(i)
	}
	block.Contents = fullData
	encodedBlock, err := codec.Encode(block)
	if err != nil {
		return nil, err
	}

	overhead := int64(0)
	// Iterate until we find the right size (up to a maximum number of
	// attempts), because the overhead is not constant across
	// different Contents lengths.
	for i := 0; int64(len(encodedBlock)) != desiredBlockSize && i < 10; i++ {
		overhead += int64(len(encodedBlock)) - desiredBlockSize
		if overhead+1 > desiredBlockSize {
			return nil, fmt.Errorf("Too much block overhead: %d", overhead)
		}

		block.Contents = fullData[:desiredBlockSize-overhead]
		encodedBlock, err = codec.Encode(block)
		if err != nil {
			return nil, err
		}
	}

	return &BlockSplitterSimple{
		maxSize:                 desiredBlockSize - overhead,
		blockChangeEmbedMaxSize: blockChangeEmbedMaxSize,
	}, nil
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
		// over maxSize
		// If it is already over maxSize w/o any added bytes, just give up
		if moreNeeded+currLen > b.maxSize {
			moreNeeded = b.maxSize - currLen
			if moreNeeded <= 0 {
				return 0
			}
			// only copy to the end of the block
			toCopy = b.maxSize - off
		}

		block.Contents = append(block.Contents,
			make([]byte, moreNeeded, moreNeeded)...)
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

// ShouldEmbedBlockChanges implements the BlockSplitter interface for
// BlockSplitterSimple.
func (b *BlockSplitterSimple) ShouldEmbedBlockChanges(
	bc *BlockChanges) bool {
	return bc.sizeEstimate <= b.blockChangeEmbedMaxSize
}
