package libkbfs

type BlockSplitterSimple struct {
	maxSize                 int64
	blockChangeEmbedMaxSize uint64
}

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

func (b *BlockSplitterSimple) CheckSplit(block *FileBlock) int64 {
	// The split will always be right
	return 0
}

func (b *BlockSplitterSimple) ShouldEmbedBlockChanges(
	bc *BlockChanges) bool {
	return bc.sizeEstimate <= b.blockChangeEmbedMaxSize
}
