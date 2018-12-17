// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// fileBlockGetter is a function that gets a block suitable for
// reading or writing, and also returns whether the block was already
// dirty.  It may be called from new goroutines, and must handle any
// required locks accordingly.
type fileBlockGetter func(context.Context, KeyMetadata, BlockPointer,
	path, blockReqType) (fblock *FileBlock, wasDirty bool, err error)

// fileData is a helper struct for accessing and manipulating data
// within a file.  It's meant for use within a single scope, not for
// long-term storage.  The caller must ensure goroutine-safety.
type fileData struct {
	getter fileBlockGetter
	tree   *blockTree
}

func newFileData(file path, chargedTo keybase1.UserOrTeamID, crypto cryptoPure,
	bsplit BlockSplitter, kmd KeyMetadata, getter fileBlockGetter,
	cacher dirtyBlockCacher, log logger.Logger) *fileData {
	fd := &fileData{
		getter: getter,
	}
	fd.tree = &blockTree{
		file:      file,
		chargedTo: chargedTo,
		crypto:    crypto,
		kmd:       kmd,
		bsplit:    bsplit,
		getter:    fd.blockGetter,
		cacher:    cacher,
		log:       log,
	}
	return fd
}

func (fd *fileData) rootBlockPointer() BlockPointer {
	return fd.tree.file.tailPointer()
}

func (fd *fileData) blockGetter(
	ctx context.Context, kmd KeyMetadata, ptr BlockPointer,
	file path, rtype blockReqType) (
	block BlockWithPtrs, wasDirty bool, err error) {
	return fd.getter(ctx, kmd, ptr, file, rtype)
}

func (fd *fileData) getLeafBlocksForOffsetRange(ctx context.Context,
	ptr BlockPointer, pblock *FileBlock, startOff, endOff Int64Offset,
	prefixOk bool) (pathsFromRoot [][]parentBlockAndChildIndex,
	blocks map[BlockPointer]Block, nextBlockOffset Int64Offset,
	err error) {
	var eo Offset
	if endOff >= 0 {
		eo = endOff
	}
	pathsFromRoot, blocks, nbo, err := fd.tree.getBlocksForOffsetRange(
		ctx, ptr, pblock, startOff, eo, prefixOk, true)
	if err != nil {
		return nil, nil, 0, err
	}
	if nbo != nil {
		nextBlockOffset = nbo.(Int64Offset)
	} else {
		nextBlockOffset = -1
	}
	return pathsFromRoot, blocks, nextBlockOffset, nil
}

func childFileIptr(p parentBlockAndChildIndex) IndirectFilePtr {
	fb := p.pblock.(*FileBlock)
	return fb.IPtrs[p.childIndex]
}

// getByteSlicesInOffsetRange returns an ordered, continuous slice of
// byte ranges for the data described by the half-inclusive offset
// range `[startOff, endOff)`.  If `endOff` == -1, it returns data to
// the end of the file.  The caller is responsible for concatenating
// the data into a single buffer if desired. If `prefixOk` is true,
// the function will ignore context deadline errors and return
// whatever prefix of the data it could fetch within the deadine.
func (fd *fileData) getByteSlicesInOffsetRange(ctx context.Context,
	startOff, endOff Int64Offset, prefixOk bool) ([][]byte, error) {
	if startOff < 0 || endOff < -1 {
		return nil, fmt.Errorf("Bad offset range [%d, %d)", startOff, endOff)
	} else if endOff != -1 && endOff <= startOff {
		return nil, nil
	}

	topBlock, _, err := fd.getter(ctx, fd.tree.kmd, fd.rootBlockPointer(),
		fd.tree.file, blockRead)
	if err != nil {
		return nil, err
	}

	// Find all the indirect pointers to leaf blocks in the offset range.
	var iptrs []IndirectFilePtr
	firstBlockOff := Int64Offset(-1)
	endBlockOff := Int64Offset(-1)
	nextBlockOff := Int64Offset(-1)
	var blockMap map[BlockPointer]Block
	if topBlock.IsInd {
		var pfr [][]parentBlockAndChildIndex
		pfr, blockMap, nextBlockOff, err = fd.getLeafBlocksForOffsetRange(
			ctx, fd.rootBlockPointer(), topBlock, startOff, endOff, prefixOk)
		if err != nil {
			return nil, err
		}

		for i, p := range pfr {
			if len(p) == 0 {
				return nil, fmt.Errorf("Unexpected empty path to child for "+
					"file %v", fd.rootBlockPointer())
			}
			lowestAncestor := p[len(p)-1]
			iptr := childFileIptr(lowestAncestor)
			iptrs = append(iptrs, iptr)
			if firstBlockOff < 0 {
				firstBlockOff = iptr.Off
			}
			if i == len(pfr)-1 {
				leafBlock := blockMap[iptr.BlockPointer].(*FileBlock)
				endBlockOff = iptr.Off + Int64Offset(len(leafBlock.Contents))
			}
		}
	} else {
		iptrs = []IndirectFilePtr{{
			BlockInfo: BlockInfo{BlockPointer: fd.rootBlockPointer()},
			Off:       0,
		}}
		firstBlockOff = 0
		endBlockOff = Int64Offset(len(topBlock.Contents))
		blockMap = map[BlockPointer]Block{fd.rootBlockPointer(): topBlock}
	}

	if len(iptrs) == 0 {
		return nil, nil
	}

	nRead := int64(0)
	n := int64(endOff - startOff)
	if endOff == -1 {
		n = int64(endBlockOff - startOff)
	}

	// Grab the relevant byte slices from each block described by the
	// indirect pointer, filling in holes as needed.
	var bytes [][]byte
	for i, iptr := range iptrs {
		block := blockMap[iptr.BlockPointer].(*FileBlock)
		blockLen := int64(len(block.Contents))
		nextByte := nRead + int64(startOff)
		toRead := n - nRead
		blockOff := iptr.Off
		lastByteInBlock := int64(blockOff) + blockLen

		nextIPtrOff := nextBlockOff
		if i < len(iptrs)-1 {
			nextIPtrOff = iptrs[i+1].Off
		}

		if nextByte >= lastByteInBlock {
			if nextIPtrOff > 0 {
				fill := int64(nextIPtrOff) - nextByte
				if fill > toRead {
					fill = toRead
				}
				fd.tree.log.CDebugf(ctx, "Read from hole: nextByte=%d "+
					"lastByteInBlock=%d fill=%d", nextByte, lastByteInBlock,
					fill)
				if fill <= 0 {
					fd.tree.log.CErrorf(ctx,
						"Read invalid file fill <= 0 while reading hole")
					return nil, BadSplitError{}
				}
				bytes = append(bytes, make([]byte, fill))
				nRead += fill
				continue
			}
			return bytes, nil
		} else if toRead > lastByteInBlock-nextByte {
			toRead = lastByteInBlock - nextByte
		}

		// Check for holes in the middle of a file.
		if nextByte < int64(blockOff) {
			fill := int64(blockOff) - nextByte
			bytes = append(bytes, make([]byte, fill))
			nRead += fill
			nextByte += fill
			toRead -= fill
		}

		firstByteToRead := nextByte - int64(blockOff)
		bytes = append(bytes,
			block.Contents[firstByteToRead:toRead+firstByteToRead])
		nRead += toRead
	}

	// If we didn't complete the read and there's another block, then
	// we've hit another hole and need to add a fill.
	if nRead < n && nextBlockOff > 0 {
		toRead := n - nRead
		nextByte := nRead + int64(startOff)
		fill := int64(nextBlockOff) - nextByte
		if fill > toRead {
			fill = toRead
		}
		fd.tree.log.CDebugf(ctx, "Read from hole at end of file: nextByte=%d "+
			"fill=%d", nextByte, fill)
		if fill <= 0 {
			fd.tree.log.CErrorf(ctx,
				"Read invalid file fill <= 0 while reading hole")
			return nil, BadSplitError{}
		}
		bytes = append(bytes, make([]byte, fill))
	}
	return bytes, nil
}

// The amount that the read timeout is smaller than the global one.
const readTimeoutSmallerBy = 2 * time.Second

// read fills the `dest` buffer with data from the file, starting at
// `startOff`.  Returns the number of bytes copied.  If the read
// operation nears the deadline set in `ctx`, it returns as big a
// prefix as possible before reaching the deadline.
func (fd *fileData) read(ctx context.Context, dest []byte,
	startOff Int64Offset) (int64, error) {
	if len(dest) == 0 {
		return 0, nil
	}

	// If we have a large enough timeout add a temporary timeout that is
	// readTimeoutSmallerBy. Use that for reading so short reads get returned
	// upstream without triggering the global timeout.
	now := time.Now()
	deadline, haveTimeout := ctx.Deadline()
	if haveTimeout {
		rem := deadline.Sub(now) - readTimeoutSmallerBy
		if rem > 0 {
			var cancel func()
			ctx, cancel = context.WithTimeout(ctx, rem)
			defer cancel()
		}
	}

	bytes, err := fd.getByteSlicesInOffsetRange(ctx, startOff,
		startOff+Int64Offset(len(dest)), true)
	if err != nil {
		return 0, err
	}

	currLen := int64(0)
	for _, b := range bytes {
		bLen := int64(len(b))
		copy(dest[currLen:currLen+bLen], b)
		currLen += bLen
	}
	return currLen, nil
}

// getBytes returns a buffer containing data from the file, in the
// half-inclusive range `[startOff, endOff)`.  If `endOff` == -1, it
// returns data until the end of the file.
func (fd *fileData) getBytes(ctx context.Context,
	startOff, endOff Int64Offset) (data []byte, err error) {
	bytes, err := fd.getByteSlicesInOffsetRange(ctx, startOff, endOff, false)
	if err != nil {
		return nil, err
	}

	bufSize := 0
	for _, b := range bytes {
		bufSize += len(b)
	}
	data = make([]byte, bufSize)
	currLen := 0
	for _, b := range bytes {
		copy(data[currLen:currLen+len(b)], b)
		currLen += len(b)
	}

	return data, nil
}

// createIndirectBlock creates a new indirect block and pick a new id
// for the existing block, and use the existing block's ID for the new
// indirect block that becomes the parent.
func (fd *fileData) createIndirectBlock(
	ctx context.Context, df *dirtyFile, dver DataVer) (*FileBlock, error) {
	newID, err := fd.tree.crypto.MakeTemporaryBlockID()
	if err != nil {
		return nil, err
	}
	fblock := &FileBlock{
		CommonBlock: CommonBlock{
			IsInd: true,
		},
		IPtrs: []IndirectFilePtr{
			{
				BlockInfo: BlockInfo{
					BlockPointer: BlockPointer{
						ID:      newID,
						KeyGen:  fd.tree.kmd.LatestKeyGeneration(),
						DataVer: dver,
						Context: kbfsblock.MakeFirstContext(
							fd.tree.chargedTo,
							fd.rootBlockPointer().GetBlockType()),
						DirectType: fd.rootBlockPointer().DirectType,
					},
					EncodedSize: 0,
				},
				Off: 0,
			},
		},
	}

	fd.tree.log.CDebugf(ctx, "Creating new level of indirection for file %v, "+
		"new block id for old top level is %v", fd.rootBlockPointer(), newID)

	// Mark the old block ID as not dirty, so that we will treat the
	// old block ID as newly dirtied in cacheBlockIfNotYetDirtyLocked.
	df.setBlockNotDirty(fd.rootBlockPointer())
	err = fd.tree.cacher(ctx, fd.rootBlockPointer(), fblock)
	if err != nil {
		return nil, err
	}

	return fblock, nil
}

func (fd *fileData) getFileBlockAtOffset(ctx context.Context,
	topBlock *FileBlock, off Int64Offset, rtype blockReqType) (
	ptr BlockPointer, parentBlocks []parentBlockAndChildIndex,
	block *FileBlock, nextBlockStartOff, startOff Int64Offset,
	wasDirty bool, err error) {
	ptr, parentBlocks, b, nbso, so, wasDirty, err := fd.tree.getBlockAtOffset(
		ctx, topBlock, off, rtype)
	if err != nil {
		return zeroPtr, nil, nil, 0, 0, false, err
	}
	if b != nil {
		block = b.(*FileBlock)
	}
	if nbso != nil {
		nextBlockStartOff = nbso.(Int64Offset)
	} else {
		nextBlockStartOff = -1
	}
	if so != nil {
		startOff = so.(Int64Offset)
	}
	return ptr, parentBlocks, block, nextBlockStartOff, startOff, wasDirty, nil
}

func (fd *fileData) fileTopBlocker(df *dirtyFile) createTopBlockFn {
	return func(ctx context.Context, dv DataVer) (BlockWithPtrs, error) {
		return fd.createIndirectBlock(ctx, df, dv)
	}
}

// write sets the given data and the given offset within the file,
// making new blocks and new levels of indirection as needed. Return
// params:
// * newDe: a new directory entry with the EncodedSize cleared if the file
//   was extended.
// * dirtyPtrs: a slice of the BlockPointers that have been dirtied during
//   the write.  This includes any interior indirect blocks that may not
//   have been changed yet, but which will need to change as part of the
//   sync process because of leaf node changes below it.
// * unrefs: a slice of BlockInfos that must be unreferenced as part of an
//   eventual sync of this write.  May be non-nil even if err != nil.
// * newlyDirtiedChildBytes is the total amount of block data dirtied by this
//   write, including the entire size of blocks that have had at least one
//   byte dirtied.  As above, it may be non-zero even if err != nil.
// * bytesExtended is the number of bytes the length of the file has been
//   extended as part of this write.
func (fd *fileData) write(ctx context.Context, data []byte, off Int64Offset,
	topBlock *FileBlock, oldDe DirEntry, df *dirtyFile) (
	newDe DirEntry, dirtyPtrs []BlockPointer, unrefs []BlockInfo,
	newlyDirtiedChildBytes int64, bytesExtended int64, err error) {
	n := int64(len(data))
	nCopied := int64(0)
	oldSizeWithoutHoles := oldDe.Size
	newDe = oldDe

	fd.tree.log.CDebugf(ctx, "Writing %d bytes at off %d", n, off)

	dirtyMap := make(map[BlockPointer]bool)
	for nCopied < n {
		ptr, parentBlocks, block, nextBlockOff, startOff, wasDirty, err :=
			fd.getFileBlockAtOffset(
				ctx, topBlock, off+Int64Offset(nCopied), blockWrite)
		if err != nil {
			return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
		}

		oldLen := len(block.Contents)

		// Take care not to write past the beginning of the next block
		// by using max.
		max := Int64Offset(len(data))
		if nextBlockOff > 0 {
			if room := nextBlockOff - off; room < max {
				max = room
			}
		}
		oldNCopied := nCopied
		nCopied += fd.tree.bsplit.CopyUntilSplit(
			block, nextBlockOff < 0, data[nCopied:max],
			int64(off+Int64Offset(nCopied)-startOff))

		// If we need another block but there are no more, then make one.
		switchToIndirect := false
		if nCopied < n {
			needExtendFile := nextBlockOff < 0
			needFillHole := off+Int64Offset(nCopied) < nextBlockOff
			newBlockOff := startOff + Int64Offset(len(block.Contents))
			if nCopied == 0 {
				if newBlockOff < off {
					// We are writing past the end of a file, or
					// somewhere inside a hole, not right at the start
					// of it; all we have done so far it reached the
					// end of an existing block (possibly zero-filling
					// it out to its capacity).  Make sure the next
					// block starts right at the offset we care about.
					newBlockOff = off
				}
			} else if newBlockOff != off+Int64Offset(nCopied) {
				return newDe, nil, unrefs, newlyDirtiedChildBytes, 0,
					fmt.Errorf("Copied %d bytes, but newBlockOff=%d does not "+
						"match off=%d plus new bytes",
						nCopied, newBlockOff, off)
			}
			var rightParents []parentBlockAndChildIndex
			if needExtendFile || needFillHole {
				// Make a new right block and update the parent's
				// indirect block list, adding a level of indirection
				// if needed.  If we're just filling a hole, the block
				// will end up all the way to the right of the range,
				// and its offset will be smaller than the block to
				// its left -- we'll fix that up below.
				var newDirtyPtrs []BlockPointer
				fd.tree.log.CDebugf(ctx, "Making new right block at "+
					"nCopied=%d, newBlockOff=%d", nCopied, newBlockOff)
				wasIndirect := topBlock.IsInd
				rightParents, newDirtyPtrs, err = fd.tree.newRightBlock(
					ctx, parentBlocks, newBlockOff,
					DefaultNewBlockDataVersion(false), NewFileBlockWithPtrs,
					fd.fileTopBlocker(df),
				)
				if err != nil {
					return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
				}
				topBlock = rightParents[0].pblock.(*FileBlock)
				for _, p := range newDirtyPtrs {
					dirtyMap[p] = true
				}
				if topBlock.IsInd != wasIndirect {
					// The whole direct data block needs to be
					// re-uploaded as a child block with a new block
					// pointer, so below we'll need to track the dirty
					// bytes of the direct block and cache the block
					// as dirty.  (Note that currently we don't track
					// dirty bytes for indirect blocks.)
					switchToIndirect = true
					ptr = topBlock.IPtrs[0].BlockPointer
				}
			}
			// If we're filling a hole, swap the new right block into
			// the hole and shift everything else over.
			if needFillHole {
				newDirtyPtrs, newUnrefs, bytes, err :=
					fd.tree.shiftBlocksToFillHole(ctx, topBlock, rightParents)
				if err != nil {
					return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
				}
				for _, p := range newDirtyPtrs {
					dirtyMap[p] = true
				}
				unrefs = append(unrefs, newUnrefs...)
				newlyDirtiedChildBytes += bytes
				if oldSizeWithoutHoles == oldDe.Size {
					// For the purposes of calculating the newly-dirtied
					// bytes for the deferral calculation, disregard the
					// existing "hole" in the file.
					oldSizeWithoutHoles = uint64(newBlockOff)
				}
			}
		}

		// Nothing was copied, no need to dirty anything.  This can
		// happen when trying to append to the contents of the file
		// (i.e., either to the end of the file or right before the
		// "hole"), and the last block is already full.
		if nCopied == oldNCopied && oldLen == len(block.Contents) &&
			!switchToIndirect {
			continue
		}

		// Only in the last block does the file size grow.
		if oldLen != len(block.Contents) && nextBlockOff < 0 {
			newDe.EncodedSize = 0
			// Since this is the last block, the end of this block
			// marks the file size.
			newDe.Size = uint64(startOff + Int64Offset(len(block.Contents)))
		}

		// Calculate the amount of bytes we've newly-dirtied as part
		// of this write.
		newlyDirtiedChildBytes += int64(len(block.Contents))
		if wasDirty {
			newlyDirtiedChildBytes -= int64(oldLen)
		}

		newDirtyPtrs, newUnrefs, err := fd.tree.markParentsDirty(
			ctx, parentBlocks)
		unrefs = append(unrefs, newUnrefs...)
		if err != nil {
			return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
		}
		for _, p := range newDirtyPtrs {
			dirtyMap[p] = true
		}

		// keep the old block ID while it's dirty
		if err = fd.tree.cacher(ctx, ptr, block); err != nil {
			return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
		}
		dirtyMap[ptr] = true
	}

	// Always make the top block dirty, so we will sync any indirect
	// blocks.  This has the added benefit of ensuring that any write
	// to a file while it's being sync'd will be deferred, even if
	// it's to a block that's not currently being sync'd, since this
	// top-most block will always be in the dirtyFiles map.  We do
	// this even for 0-byte writes, which indicate a forced sync.
	if err = fd.tree.cacher(ctx, fd.rootBlockPointer(), topBlock); err != nil {
		return newDe, nil, unrefs, newlyDirtiedChildBytes, 0, err
	}
	dirtyMap[fd.rootBlockPointer()] = true

	lastByteWritten := int64(off) + int64(len(data)) // not counting holes
	bytesExtended = 0
	if lastByteWritten > int64(oldSizeWithoutHoles) {
		bytesExtended = lastByteWritten - int64(oldSizeWithoutHoles)
	}

	dirtyPtrs = make([]BlockPointer, 0, len(dirtyMap))
	for p := range dirtyMap {
		dirtyPtrs = append(dirtyPtrs, p)
	}

	return newDe, dirtyPtrs, unrefs, newlyDirtiedChildBytes, bytesExtended, nil
}

// truncateExtend increases file size to the given size by appending
// a "hole" to the file. Return params:
// * newDe: a new directory entry with the EncodedSize cleared.
// * dirtyPtrs: a slice of the BlockPointers that have been dirtied during
//   the truncate.
func (fd *fileData) truncateExtend(ctx context.Context, size uint64,
	topBlock *FileBlock, parentBlocks []parentBlockAndChildIndex,
	oldDe DirEntry, df *dirtyFile) (
	newDe DirEntry, dirtyPtrs []BlockPointer, err error) {
	fd.tree.log.CDebugf(ctx, "truncateExtend: extending file %v to size %d",
		fd.rootBlockPointer(), size)
	switchToIndirect := !topBlock.IsInd
	oldTopBlock := topBlock
	if switchToIndirect {
		fd.tree.log.CDebugf(ctx, "truncateExtend: making block indirect %v",
			fd.rootBlockPointer())
	}

	rightParents, newDirtyPtrs, err := fd.tree.newRightBlock(
		ctx, parentBlocks, Int64Offset(size),
		DefaultNewBlockDataVersion(true), NewFileBlockWithPtrs,
		fd.fileTopBlocker(df))
	if err != nil {
		return DirEntry{}, nil, err
	}
	topBlock = rightParents[0].pblock.(*FileBlock)

	if switchToIndirect {
		topBlock.IPtrs[0].Holes = true
		err = fd.tree.cacher(ctx, topBlock.IPtrs[0].BlockPointer, oldTopBlock)
		if err != nil {
			return DirEntry{}, nil, err
		}
		dirtyPtrs = append(dirtyPtrs, topBlock.IPtrs[0].BlockPointer)
		fd.tree.log.CDebugf(ctx, "truncateExtend: new zero data block %v",
			topBlock.IPtrs[0].BlockPointer)
	}
	dirtyPtrs = append(dirtyPtrs, newDirtyPtrs...)
	newDe = oldDe
	newDe.EncodedSize = 0
	// update the file info
	newDe.Size = size

	// Mark all for presence of holes, one would be enough,
	// but this is more robust and easy.
	for i := range topBlock.IPtrs {
		topBlock.IPtrs[i].Holes = true
	}
	// Always make the top block dirty, so we will sync its
	// indirect blocks.  This has the added benefit of ensuring
	// that any write to a file while it's being sync'd will be
	// deferred, even if it's to a block that's not currently
	// being sync'd, since this top-most block will always be in
	// the fileBlockStates map.
	err = fd.tree.cacher(ctx, fd.rootBlockPointer(), topBlock)
	if err != nil {
		return DirEntry{}, nil, err
	}
	dirtyPtrs = append(dirtyPtrs, fd.rootBlockPointer())
	return newDe, dirtyPtrs, nil
}

// truncateShrink shrinks the file to the given size. Return params:
// * newDe: a new directory entry with the EncodedSize cleared if the file
//   shrunk.
// * dirtyPtrs: a slice of the BlockPointers that have been dirtied during
//   the truncate.  This includes any interior indirect blocks that may not
//   have been changed yet, but which will need to change as part of the
//   sync process because of leaf node changes below it.
// * unrefs: a slice of BlockInfos that must be unreferenced as part of an
//   eventual sync of this write.  May be non-nil even if err != nil.
// * newlyDirtiedChildBytes is the total amount of block data dirtied by this
//   truncate, including the entire size of blocks that have had at least one
//   byte dirtied.  As above, it may be non-zero even if err != nil.
func (fd *fileData) truncateShrink(ctx context.Context, size uint64,
	topBlock *FileBlock, oldDe DirEntry) (
	newDe DirEntry, dirtyPtrs []BlockPointer, unrefs []BlockInfo,
	newlyDirtiedChildBytes int64, err error) {
	iSize := Int64Offset(size) // TODO: deal with overflow

	ptr, parentBlocks, block, nextBlockOff, startOff, wasDirty, err :=
		fd.getFileBlockAtOffset(ctx, topBlock, iSize, blockWrite)
	if err != nil {
		return DirEntry{}, nil, nil, 0, err
	}

	oldLen := len(block.Contents)
	// We need to delete some data (and possibly entire blocks).  Note
	// we make a new slice and copy data in order to make sure the
	// data being truncated can be fully garbage-collected.
	block.Contents = append([]byte(nil), block.Contents[:iSize-startOff]...)

	newlyDirtiedChildBytes = int64(len(block.Contents))
	if wasDirty {
		newlyDirtiedChildBytes -= int64(oldLen) // negative
	}

	// Need to mark the parents dirty before calling
	// `getIndirectBlocksForOffsetRange`, so that function will see
	// the new copies when fetching the blocks.
	newDirtyPtrs, newUnrefs, err := fd.tree.markParentsDirty(ctx, parentBlocks)
	unrefs = append(unrefs, newUnrefs...)
	if err != nil {
		return DirEntry{}, nil, unrefs, newlyDirtiedChildBytes, err
	}
	dirtyMap := make(map[BlockPointer]bool)
	for _, p := range newDirtyPtrs {
		dirtyMap[p] = true
	}

	if nextBlockOff > 0 {
		// TODO: remove any unnecessary levels of indirection if the
		// number of leaf nodes shrinks significantly (KBFS-1824).

		// Get all paths to any leaf nodes following the new
		// right-most block, since those blocks need to be
		// unreferenced, and their parents need to be modified or
		// unreferenced.
		pfr, err := fd.tree.getIndirectBlocksForOffsetRange(
			ctx, topBlock, nextBlockOff, nil)
		if err != nil {
			return DirEntry{}, nil, nil, 0, err
		}

		// A map from a pointer to an indirect block -> that block's
		// original set of block pointers, before they are truncated
		// in the loop below.  It also tracks which pointed-to blocks
		// have already been processed.
		savedChildPtrs := make(map[BlockPointer][]IndirectFilePtr)
		for _, path := range pfr {
			// parentInfo points to pb.pblock in the loop below.  The
			// initial case is the top block, for which we need to
			// fake a block info using just the root block pointer.
			parentInfo := BlockInfo{BlockPointer: fd.rootBlockPointer()}
			leftMost := true
			for i, pb := range path {
				ptrs := savedChildPtrs[parentInfo.BlockPointer]
				if ptrs == nil {
					// Process each block exactly once, removing all
					// now-unnecessary indirect pointers (but caching
					// that list so we can still walk the tree on the
					// next iterations).
					pblock := pb.pblock.(*FileBlock)
					ptrs = pblock.IPtrs
					savedChildPtrs[parentInfo.BlockPointer] = ptrs

					// Remove the first child iptr and everything
					// following it if all the child indices below
					// this level are 0.
					removeStartingFromIndex := pb.childIndex
					for j := i + 1; j < len(path); j++ {
						if path[j].childIndex > 0 {
							removeStartingFromIndex++
							break
						}
					}

					// If we remove iptr 0, this block can be
					// unreferenced (unless it's on the left-most edge
					// of the tree, in which case we keep it around
					// for now -- see above TODO).
					if pb.childIndex == 0 && !leftMost {
						if parentInfo.EncodedSize != 0 {
							unrefs = append(unrefs, parentInfo)
						}
					} else if removeStartingFromIndex < len(pblock.IPtrs) {
						// Make sure we're modifying a copy of the
						// block by fetching it again with blockWrite.
						// We do this instead of calling DeepCopy in
						// case the a copy of the block has already
						// been made and put into the dirty
						// cache. (e.g., in a previous iteration of
						// this loop).
						pblock, _, err = fd.getter(
							ctx, fd.tree.kmd, parentInfo.BlockPointer,
							fd.tree.file, blockWrite)
						if err != nil {
							return DirEntry{}, nil, nil,
								newlyDirtiedChildBytes, err
						}
						pblock.IPtrs = pblock.IPtrs[:removeStartingFromIndex]
						err = fd.tree.cacher(
							ctx, parentInfo.BlockPointer, pblock)
						if err != nil {
							return DirEntry{}, nil, nil,
								newlyDirtiedChildBytes, err
						}
						dirtyMap[parentInfo.BlockPointer] = true
					}
				}

				// Down to the next level.  If we've hit the leaf
				// level, unreference the block.
				parentInfo = ptrs[pb.childIndex].BlockInfo
				if i == len(path)-1 && parentInfo.EncodedSize != 0 {
					unrefs = append(unrefs, parentInfo)
				} else if pb.childIndex > 0 {
					leftMost = false
				}
			}
		}
	}

	if topBlock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any truncate to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the dirtyFiles map.
		err = fd.tree.cacher(ctx, fd.rootBlockPointer(), topBlock)
		if err != nil {
			return DirEntry{}, nil, nil, newlyDirtiedChildBytes, err
		}
		dirtyMap[fd.rootBlockPointer()] = true
	}

	newDe = oldDe
	newDe.EncodedSize = 0
	newDe.Size = size

	// Keep the old block ID while it's dirty.
	if err = fd.tree.cacher(ctx, ptr, block); err != nil {
		return DirEntry{}, nil, nil, newlyDirtiedChildBytes, err
	}
	dirtyMap[ptr] = true

	dirtyPtrs = make([]BlockPointer, 0, len(dirtyMap))
	for p := range dirtyMap {
		dirtyPtrs = append(dirtyPtrs, p)
	}

	return newDe, dirtyPtrs, unrefs, newlyDirtiedChildBytes, nil
}

func (fd *fileData) getNextDirtyFileBlockAtOffset(ctx context.Context,
	topBlock *FileBlock, off Int64Offset, rtype blockReqType,
	dirtyBcache DirtyBlockCache) (
	ptr BlockPointer, parentBlocks []parentBlockAndChildIndex,
	block *FileBlock, nextBlockStartOff, startOff Int64Offset, err error) {
	ptr, parentBlocks, b, nbso, so, err := fd.tree.getNextDirtyBlockAtOffset(
		ctx, topBlock, off, rtype, dirtyBcache)
	if err != nil {
		return zeroPtr, nil, nil, 0, 0, err
	}
	if b != nil {
		block = b.(*FileBlock)
	}
	if nbso != nil {
		nextBlockStartOff = nbso.(Int64Offset)
	} else {
		nextBlockStartOff = -1
	}
	if so != nil {
		startOff = so.(Int64Offset)
	}
	return ptr, parentBlocks, block, nextBlockStartOff, startOff, nil
}

// split, if given an indirect top block of a file, checks whether any
// of the dirty leaf blocks in that file need to be split up
// differently (i.e., if the BlockSplitter is using
// fingerprinting-based boundaries).  It returns the set of blocks
// that now need to be unreferenced.
func (fd *fileData) split(ctx context.Context, id tlf.ID,
	dirtyBcache DirtyBlockCache, topBlock *FileBlock, df *dirtyFile) (
	unrefs []BlockInfo, err error) {
	if !topBlock.IsInd {
		return nil, nil
	}

	// For an indirect file:
	//   1) check if each dirty block is split at the right place.
	//   2) if it needs fewer bytes, prepend the extra bytes to the next
	//      block (making a new one if it doesn't exist), and the next block
	//      gets marked dirty
	//   3) if it needs more bytes, then use copyUntilSplit() to fetch bytes
	//      from the next block (if there is one), remove the copied bytes
	//      from the next block and mark it dirty
	//   4) Then go through once more, and ready and finalize each
	//      dirty block, updating its ID in the indirect pointer list
	off := Int64Offset(0)
	for off >= 0 {
		_, parentBlocks, block, nextBlockOff, startOff, err :=
			fd.getNextDirtyFileBlockAtOffset(
				ctx, topBlock, off, blockWrite, dirtyBcache)
		if err != nil {
			return unrefs, err
		}

		if block == nil {
			// No more dirty blocks.
			break
		}
		off = nextBlockOff // Will be -1 if there are no more blocks.

		splitAt := fd.tree.bsplit.CheckSplit(block)
		switch {
		case splitAt == 0:
			continue
		case splitAt > 0:
			endOfBlock := startOff + Int64Offset(len(block.Contents))
			extraBytes := block.Contents[splitAt:]
			block.Contents = block.Contents[:splitAt]
			// put the extra bytes in front of the next block
			if nextBlockOff < 0 {
				// Need to make a new block.
				if _, _, err := fd.tree.newRightBlock(
					ctx, parentBlocks, endOfBlock,
					DefaultNewBlockDataVersion(false), NewFileBlockWithPtrs,
					fd.fileTopBlocker(df)); err != nil {
					return unrefs, err
				}
			}
			rPtr, rParentBlocks, rblock, _, _, _, err :=
				fd.getFileBlockAtOffset(
					ctx, topBlock, endOfBlock, blockWrite)
			if err != nil {
				return unrefs, err
			}
			rblock.Contents = append(extraBytes, rblock.Contents...)
			if err = fd.tree.cacher(ctx, rPtr, rblock); err != nil {
				return unrefs, err
			}
			endOfBlock = startOff + Int64Offset(len(block.Contents))

			// Mark the old rblock as unref'd.
			pb := rParentBlocks[len(rParentBlocks)-1]
			childInfo, _ := pb.childIPtr()
			unrefs = append(unrefs, childInfo)
			pb.clearEncodedSize()

			// Update parent pointer offsets as needed.
			for i := len(rParentBlocks) - 1; i >= 0; i-- {
				pb := rParentBlocks[i]
				pb.pblock.(*FileBlock).IPtrs[pb.childIndex].Off = endOfBlock
				// If this isn't the leftmost child at this level,
				// there's no need to update the parent.
				if pb.childIndex > 0 {
					break
				}
			}

			_, newUnrefs, err := fd.tree.markParentsDirty(ctx, rParentBlocks)
			unrefs = append(unrefs, newUnrefs...)
			if err != nil {
				return unrefs, err
			}
			off = endOfBlock
		case splitAt < 0:
			if nextBlockOff < 0 {
				// End of the line.
				continue
			}

			endOfBlock := startOff + Int64Offset(len(block.Contents))
			rPtr, rParentBlocks, rblock, _, _, _, err :=
				fd.getFileBlockAtOffset(
					ctx, topBlock, endOfBlock, blockWrite)
			if err != nil {
				return unrefs, err
			}
			// Copy some of that block's data into this block.
			nCopied := fd.tree.bsplit.CopyUntilSplit(block, false,
				rblock.Contents, int64(len(block.Contents)))
			rblock.Contents = rblock.Contents[nCopied:]
			endOfBlock = startOff + Int64Offset(len(block.Contents))

			// Mark the old right block as unref'd.
			pb := rParentBlocks[len(rParentBlocks)-1]
			pblock := pb.pblock.(*FileBlock)
			childInfo, _ := pb.childIPtr()
			unrefs = append(unrefs, childInfo)
			pb.clearEncodedSize()

			// For the right block, adjust offset or delete as needed.
			if len(rblock.Contents) > 0 {
				if err = fd.tree.cacher(ctx, rPtr, rblock); err != nil {
					return unrefs, err
				}

				// Update parent pointer offsets as needed.
				for i := len(rParentBlocks) - 1; i >= 0; i-- {
					pb := rParentBlocks[i]
					pb.pblock.(*FileBlock).IPtrs[pb.childIndex].Off = endOfBlock
					// If this isn't the leftmost child at this level,
					// there's no need to update the parent.
					if pb.childIndex > 0 {
						break
					}
				}
			} else {
				// TODO: If we're down to just one leaf block at this
				// level, remove the layer of indirection (KBFS-1824).
				iptrs := pblock.IPtrs
				pblock.IPtrs =
					append(iptrs[:pb.childIndex], iptrs[pb.childIndex+1:]...)
			}

			// Mark all parents as dirty.
			_, newUnrefs, err := fd.tree.markParentsDirty(ctx, rParentBlocks)
			unrefs = append(unrefs, newUnrefs...)
			if err != nil {
				return unrefs, err
			}

			off = endOfBlock
		}
	}
	return unrefs, nil
}

// ready, if given an indirect top-block, readies all the dirty child
// blocks, and updates their block IDs in their parent block's list of
// indirect pointers.  It returns a map pointing from the new block
// info from any readied block to its corresponding old block pointer.
func (fd *fileData) ready(ctx context.Context, id tlf.ID, bcache BlockCache,
	dirtyBcache isDirtyProvider, bops BlockOps, bps blockPutState,
	topBlock *FileBlock, df *dirtyFile) (map[BlockInfo]BlockPointer, error) {
	return fd.tree.ready(
		ctx, id, bcache, dirtyBcache, bops, bps, topBlock,
		func(ptr BlockPointer) func() error {
			if df != nil {
				return func() error { return df.setBlockSynced(ptr) }
			}
			return nil
		})
}

func (fd *fileData) getIndirectFileBlockInfosWithTopBlock(
	ctx context.Context, topBlock *FileBlock) ([]BlockInfo, error) {
	return fd.tree.getIndirectBlockInfosWithTopBlock(ctx, topBlock)
}

func (fd *fileData) getIndirectFileBlockInfos(ctx context.Context) (
	[]BlockInfo, error) {
	return fd.tree.getIndirectBlockInfos(ctx)
}

// findIPtrsAndClearSize looks for the given set of indirect pointers,
// and returns whether they could be found.  As a side effect, it also
// clears the encoded size for those indirect pointers.
func (fd *fileData) findIPtrsAndClearSize(
	ctx context.Context, topBlock *FileBlock, ptrs map[BlockPointer]bool) (
	found map[BlockPointer]bool, err error) {
	if !topBlock.IsInd || len(ptrs) == 0 {
		return nil, nil
	}

	pfr, err := fd.tree.getIndirectBlocksForOffsetRange(
		ctx, topBlock, Int64Offset(0), nil)
	if err != nil {
		return nil, err
	}

	found = make(map[BlockPointer]bool)

	// Search all paths for the given block pointer, clear its encoded
	// size, and dirty all its parents up to the root.
	infoSeen := make(map[BlockPointer]bool)
	for _, path := range pfr {
		parentPtr := fd.rootBlockPointer()
		for level, pb := range path {
			if infoSeen[parentPtr] {
				parentPtr = pb.childBlockPtr()
				continue
			}
			infoSeen[parentPtr] = true

			for i, iptr := range pb.pblock.(*FileBlock).IPtrs {
				if ptrs[iptr.BlockPointer] {
					// Mark this pointer, and all parent blocks, as dirty.
					parentPtr := fd.rootBlockPointer()
					for i := 0; i <= level; i++ {
						// Get a writeable copy for each block.
						pblock, _, err := fd.getter(
							ctx, fd.tree.kmd, parentPtr, fd.tree.file,
							blockWrite)
						if err != nil {
							return nil, err
						}
						path[i].pblock = pblock
						parentPtr = path[i].childBlockPtr()
					}
					// Because we only check each parent once, the
					// `path` we're using here will be the one with a
					// childIndex of 0.  But, that's not necessarily
					// the one that matches the pointer that needs to
					// be dirty.  So make a new path and set the
					// childIndex to the correct pointer instead.
					newPath := make([]parentBlockAndChildIndex, level+1)
					copy(newPath, path[:level+1])
					newPath[level].childIndex = i
					_, _, err = fd.tree.markParentsDirty(ctx, newPath)
					if err != nil {
						return nil, err
					}

					found[iptr.BlockPointer] = true
					if len(found) == len(ptrs) {
						return found, nil
					}
				}
			}
			parentPtr = pb.childBlockPtr()
		}
	}
	return found, nil
}

// deepCopy makes a complete copy of this file, deduping leaf blocks
// and making new random BlockPointers for all indirect blocks.  It
// returns the new top pointer of the copy, and all the new child
// pointers in the copy.
func (fd *fileData) deepCopy(ctx context.Context, dataVer DataVer) (
	newTopPtr BlockPointer, allChildPtrs []BlockPointer, err error) {
	topBlock, _, err := fd.getter(ctx, fd.tree.kmd, fd.rootBlockPointer(),
		fd.tree.file, blockRead)
	if err != nil {
		return zeroPtr, nil, err
	}

	// Handle the single-level case first.
	if !topBlock.IsInd {
		newTopBlock := topBlock.DeepCopy()
		if err != nil {
			return zeroPtr, nil, err
		}

		newTopPtr = fd.rootBlockPointer()
		newTopPtr.RefNonce, err = fd.tree.crypto.MakeBlockRefNonce()
		if err != nil {
			return zeroPtr, nil, err
		}
		newTopPtr.SetWriter(fd.tree.chargedTo)

		if err = fd.tree.cacher(ctx, newTopPtr, newTopBlock); err != nil {
			return zeroPtr, nil, err
		}

		fd.tree.log.CDebugf(ctx, "Deep copied file %s: %v -> %v",
			fd.tree.file.tailName(), fd.rootBlockPointer(), newTopPtr)

		return newTopPtr, nil, nil
	}

	// For indirect files, get all the paths to leaf blocks.
	pfr, err := fd.tree.getIndirectBlocksForOffsetRange(
		ctx, topBlock, Int64Offset(0), nil)
	if err != nil {
		return zeroPtr, nil, err
	}
	if len(pfr) == 0 {
		return zeroPtr, nil,
			fmt.Errorf("Indirect file %v had no indirect blocks",
				fd.rootBlockPointer())
	}

	// Make a new reference for all leaf blocks first.
	copiedBlocks := make(map[BlockPointer]*FileBlock)
	leafLevel := len(pfr[0]) - 1
	for level := leafLevel; level >= 0; level-- {
		for _, path := range pfr {
			// What is the current ptr for this pblock?
			ptr := fd.rootBlockPointer()
			if level > 0 {
				ptr = path[level-1].childBlockPtr()
			}
			if _, ok := copiedBlocks[ptr]; ok {
				continue
			}

			// Copy the parent block and save it for later (it will be
			// cached below).
			pblock := path[level].pblock.(*FileBlock).DeepCopy()
			if err != nil {
				return zeroPtr, nil, err
			}
			copiedBlocks[ptr] = pblock

			for i, iptr := range pblock.IPtrs {
				if level == leafLevel {
					// Generate a new nonce for each indirect pointer
					// to a leaf.
					iptr.RefNonce, err = fd.tree.crypto.MakeBlockRefNonce()
					if err != nil {
						return zeroPtr, nil, err
					}
					iptr.SetWriter(fd.tree.chargedTo)
					pblock.IPtrs[i] = iptr
					allChildPtrs = append(allChildPtrs, iptr.BlockPointer)
				} else {
					// Generate a new random ID for each indirect
					// pointer to an indirect block.
					newID, err := fd.tree.crypto.MakeTemporaryBlockID()
					if err != nil {
						return zeroPtr, nil, err
					}
					// No need for a new refnonce here, since indirect
					// blocks are guaranteed to get a new block ID
					// when readied, since the child block pointers
					// will have changed.
					newPtr := BlockPointer{
						ID:      newID,
						KeyGen:  fd.tree.kmd.LatestKeyGeneration(),
						DataVer: dataVer,
						Context: kbfsblock.MakeFirstContext(
							fd.tree.chargedTo,
							fd.rootBlockPointer().GetBlockType()),
						DirectType: IndirectBlock,
					}
					pblock.IPtrs[i].BlockPointer = newPtr
					allChildPtrs = append(allChildPtrs, newPtr)
					childBlock, ok := copiedBlocks[iptr.BlockPointer]
					if !ok {
						return zeroPtr, nil, fmt.Errorf(
							"No copied child block found for ptr %v",
							iptr.BlockPointer)
					}
					err = fd.tree.cacher(ctx, newPtr, childBlock)
					if err != nil {
						return zeroPtr, nil, err
					}
				}
			}
		}
	}

	// Finally, make a new ID for the top block and cache it.
	newTopPtr = fd.rootBlockPointer()
	newID, err := fd.tree.crypto.MakeTemporaryBlockID()
	if err != nil {
		return zeroPtr, nil, err
	}
	newTopPtr = BlockPointer{
		ID:      newID,
		KeyGen:  fd.tree.kmd.LatestKeyGeneration(),
		DataVer: dataVer,
		Context: kbfsblock.MakeFirstContext(
			fd.tree.chargedTo, fd.rootBlockPointer().GetBlockType()),
		DirectType: IndirectBlock,
	}
	fd.tree.log.CDebugf(ctx, "Deep copied indirect file %s: %v -> %v",
		fd.tree.file.tailName(), fd.rootBlockPointer(), newTopPtr)

	newTopBlock, ok := copiedBlocks[fd.rootBlockPointer()]
	if !ok {
		return zeroPtr, nil, fmt.Errorf(
			"No copied root block found for ptr %v",
			fd.rootBlockPointer())
	}
	if err = fd.tree.cacher(ctx, newTopPtr, newTopBlock); err != nil {
		return zeroPtr, nil, err
	}

	return newTopPtr, allChildPtrs, nil
}

// undupChildrenInCopy takes a top block that's been copied via
// deepCopy(), and un-deduplicates all leaf children of the block.  It
// adds all child blocks to the provided `bps`, including both the
// ones that were deduplicated and the ones that weren't.  It returns
// the BlockInfos for all children.
func (fd *fileData) undupChildrenInCopy(ctx context.Context,
	bcache BlockCache, bops BlockOps, bps blockPutState,
	topBlock *FileBlock) ([]BlockInfo, error) {
	if !topBlock.IsInd {
		return nil, nil
	}

	// For indirect files, get all the paths to leaf blocks.  Note
	// that because topBlock is a result of `deepCopy`, all of the
	// indirect blocks that will make up the paths are also deep
	// copies, and thus are modifiable.
	pfr, err := fd.tree.getIndirectBlocksForOffsetRange(
		ctx, topBlock, Int64Offset(0), nil)
	if err != nil {
		return nil, err
	}
	if len(pfr) == 0 {
		return nil, fmt.Errorf(
			"Indirect file %v had no indirect blocks", fd.rootBlockPointer())
	}

	// If the number of leaf blocks (len(pfr)) is likely to represent
	// a file greater than 2 GB, abort conflict resolution.  Until
	// disk caching is ready, we'll have to help people deal with this
	// on a case-by-case basis.  // TODO: once the disk-backed cache
	// is ready, make sure we use it here for both the dirty block
	// cache and blockPutState (via some sort of "ready" block cache),
	// so we avoid memory explosion in the case of journaling and
	// multiple devices modifying the same large file or set of files.
	// And then remove this check.
	if len(pfr) > (2*1024*1024*1024)/MaxBlockSizeBytesDefault {
		return nil, FileTooBigForCRError{fd.tree.file}
	}

	// Append the leaf block to each path, since readyHelper expects it.
	// TODO: parallelize these fetches.
	for i, path := range pfr {
		leafPtr := path[len(path)-1].childBlockPtr()
		leafBlock, _, err := fd.getter(
			ctx, fd.tree.kmd, leafPtr, fd.tree.file, blockWrite)
		if err != nil {
			return nil, err
		}

		pfr[i] = append(pfr[i], parentBlockAndChildIndex{leafBlock, -1})
	}

	newInfos, err := fd.tree.readyHelper(
		ctx, fd.tree.file.Tlf, bcache, bops, bps, pfr, nil)
	if err != nil {
		return nil, err
	}

	blockInfos := make([]BlockInfo, 0, len(newInfos))
	for newInfo := range newInfos {
		blockInfos = append(blockInfos, newInfo)
	}
	return blockInfos, nil
}

// readyNonLeafBlocksInCopy takes a top block that's been copied via
// deepCopy(), and readies all the non-leaf children of the top block.
// It adds all readied blocks to the provided `bps`.  It returns the
// BlockInfos for all non-leaf children.
func (fd *fileData) readyNonLeafBlocksInCopy(ctx context.Context,
	bcache BlockCache, bops BlockOps, bps blockPutState,
	topBlock *FileBlock) ([]BlockInfo, error) {
	if !topBlock.IsInd {
		return nil, nil
	}

	// For indirect files, get all the paths to leaf blocks.  Note
	// that because topBlock is a deepCopy, all of the blocks are also
	// deepCopys and thus are modifiable.
	pfr, err := fd.tree.getIndirectBlocksForOffsetRange(
		ctx, topBlock, Int64Offset(0), nil)
	if err != nil {
		return nil, err
	}
	if len(pfr) == 0 {
		return nil, fmt.Errorf(
			"Indirect file %v had no indirect blocks", fd.rootBlockPointer())
	}

	newInfos, err := fd.tree.readyHelper(
		ctx, fd.tree.file.Tlf, bcache, bops, bps, pfr, nil)
	if err != nil {
		return nil, err
	}

	blockInfos := make([]BlockInfo, 0, len(newInfos))
	for newInfo := range newInfos {
		blockInfos = append(blockInfos, newInfo)
	}
	return blockInfos, nil
}
