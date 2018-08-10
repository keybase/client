// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"golang.org/x/sync/errgroup"
)

// blockGetterFn is a function that gets a block suitable for reading
// or writing, and also returns whether the block was already dirty.
// It may be called from new goroutines, and must handle any required
// locks accordingly.
type blockGetterFn func(context.Context, KeyMetadata, BlockPointer,
	path, blockReqType) (block Block, wasDirty bool, err error)

// dirtyBlockCacher writes dirty blocks to a cache.
type dirtyBlockCacher func(ptr BlockPointer, block Block) error

type blockTree struct {
	file   path
	kmd    KeyMetadata
	getter blockGetterFn
}

// parentBlockAndChildIndex is a node on a path down the tree to a
// particular leaf node.  `pblock` is an indirect block corresponding
// to one of that leaf node's parents, and `childIndex` is an index
// into `pblock.IPtrs` to the next node along the path.
type parentBlockAndChildIndex struct {
	pblock     Block
	childIndex int
}

func (pbci parentBlockAndChildIndex) childIPtr() (BlockInfo, Offset) {
	return pbci.pblock.IndirectPtr(pbci.childIndex)
}

func (pbci parentBlockAndChildIndex) childBlockPtr() BlockPointer {
	info, _ := pbci.pblock.IndirectPtr(pbci.childIndex)
	return info.BlockPointer
}

func (bt *blockTree) rootBlockPointer() BlockPointer {
	return bt.file.tailPointer()
}

// getBlockAtOffset returns the leaf block containing the given
// `off`, along with the set of indirect blocks leading to that leaf
// (if any).
func (bt *blockTree) getBlockAtOffset(ctx context.Context,
	topBlock Block, off Offset, rtype blockReqType) (
	ptr BlockPointer, parentBlocks []parentBlockAndChildIndex,
	block Block, nextBlockStartOff, startOff Offset,
	wasDirty bool, err error) {
	// Find the block matching the offset, if it exists.
	ptr = bt.rootBlockPointer()
	block = topBlock
	nextBlockStartOff = nil
	startOff = topBlock.FirstOffset()

	if !topBlock.IsIndirect() {
		// If it's not an indirect block, we just need to figure out
		// if it's dirty.
		_, wasDirty, err = bt.getter(ctx, bt.kmd, ptr, bt.file, rtype)
		if err != nil {
			return zeroPtr, nil, nil, nil, nil, false, err
		}
		return ptr, nil, block, nextBlockStartOff, startOff, wasDirty, nil
	}

	// Search until it's not an indirect block.
	for block.IsIndirect() {
		nextIndex := block.NumIndirectPtrs() - 1
		for i := 0; i < block.NumIndirectPtrs(); i++ {
			_, iptrOff := block.IndirectPtr(i)
			if iptrOff.Equals(off) {
				// Small optimization to avoid iterating past the correct ptr.
				nextIndex = i
				break
			} else if off.Less(iptrOff) {
				// Use the previous block.  i can never be 0, because
				// the first ptr always has an offset at the beginning
				// of the range.
				nextIndex = i - 1
				break
			}
		}
		var info BlockInfo
		info, startOff = block.IndirectPtr(nextIndex)
		parentBlocks = append(parentBlocks,
			parentBlockAndChildIndex{block, nextIndex})
		// There is more to read if we ever took a path through a
		// ptr that wasn't the final ptr in its respective list.
		if nextIndex != block.NumIndirectPtrs()-1 {
			_, nextBlockStartOff = block.IndirectPtr(nextIndex + 1)
		}
		ptr = info.BlockPointer
		block, wasDirty, err = bt.getter(
			ctx, bt.kmd, info.BlockPointer, bt.file, rtype)
		if err != nil {
			return zeroPtr, nil, nil, nil, nil, false, err
		}
	}

	return ptr, parentBlocks, block, nextBlockStartOff, startOff, wasDirty, nil
}

// getNextDirtyFileBlockAtOffsetAtLevel does the same thing as
// `getNextDirtyFileBlockAtOffset` (see the comments on that function)
// on a subsection of the block tree (not necessarily starting from
// the top block).
func (bt *blockTree) getNextDirtyBlockAtOffsetAtLevel(ctx context.Context,
	pblock Block, off Offset, rtype blockReqType,
	dirtyBcache DirtyBlockCache, parentBlocks []parentBlockAndChildIndex) (
	ptr BlockPointer, newParentBlocks []parentBlockAndChildIndex,
	block Block, nextBlockStartOff, startOff Offset, err error) {
	// Search along paths of dirty blocks until we find a dirty leaf
	// block with an offset equal or greater than `off`.
	checkedPrevBlock := false
	for i := 0; i < pblock.NumIndirectPtrs(); i++ {
		info, iptrOff := pblock.IndirectPtr(i)
		iptrLess := iptrOff.Less(off)
		if iptrLess && i != pblock.NumIndirectPtrs()-1 {
			continue
		}

		// No need to check the previous block if we align exactly
		// with `off`, or this is the right-most leaf block.
		if iptrLess || iptrOff.Equals(off) {
			checkedPrevBlock = true
		}

		// If we haven't checked the previous block yet, do so now
		// since it contains `off`.
		index := -1
		nextBlockStartOff = nil
		startOff = pblock.FirstOffset()
		var prevPtr BlockPointer
		if !checkedPrevBlock && i > 0 {
			prevInfo, _ := pblock.IndirectPtr(i - 1)
			prevPtr = prevInfo.BlockPointer
		}
		if prevPtr.IsValid() && dirtyBcache.IsDirty(
			bt.file.Tlf, prevPtr, bt.file.Branch) {
			// Since we checked the previous block, stay on this
			// index for the next iteration.
			i--
			index = i
		} else if dirtyBcache.IsDirty(
			bt.file.Tlf, info.BlockPointer, bt.file.Branch) {
			// Now check the current block.
			index = i
		}
		checkedPrevBlock = true

		// Try the next child.
		if index == -1 {
			continue
		}

		indexInfo, indexOff := pblock.IndirectPtr(index)
		ptr = indexInfo.BlockPointer
		block, _, err = bt.getter(ctx, bt.kmd, ptr, bt.file, rtype)
		if err != nil {
			return zeroPtr, nil, nil, nil, nil, err
		}

		newParentBlocks = append(parentBlocks,
			parentBlockAndChildIndex{pblock, index})
		// If this is a leaf block, we're done.
		if !block.IsIndirect() {
			// There is more to read if we ever took a path through a
			// ptr that wasn't the final ptr in its respective list.
			if index != pblock.NumIndirectPtrs()-1 {
				_, nextBlockStartOff = pblock.IndirectPtr(index + 1)
			}
			return ptr, newParentBlocks, block, nextBlockStartOff, indexOff, nil
		}

		// Recurse to the next lower level.
		ptr, newParentBlocks, block, nextBlockStartOff, startOff, err =
			bt.getNextDirtyBlockAtOffsetAtLevel(
				ctx, block, off, rtype, dirtyBcache, newParentBlocks)
		if err != nil {
			return zeroPtr, nil, nil, nil, nil, err
		}
		// If we found a block, we're done.
		if block != nil {
			// If the block didn't have an immediate sibling to the
			// right, set the next offset to the parent block's
			// sibling's offset.
			if nextBlockStartOff == nil && index != pblock.NumIndirectPtrs()-1 {
				_, nextBlockStartOff = pblock.IndirectPtr(index + 1)
			}
			return ptr, newParentBlocks, block, nextBlockStartOff, startOff, nil
		}
	}

	// There's no dirty block at or after `off`.
	return zeroPtr, nil, nil, pblock.FirstOffset(), pblock.FirstOffset(), nil
}

// getNextDirtyBlockAtOffset returns the next dirty leaf block with a
// starting offset that is equal or greater than the given `off`.
// This assumes that any code that dirties a leaf block also dirties
// all of its parents, even if those parents haven't yet changed.  It
// can be used iteratively (by feeding `nextBlockStartOff` back in as
// `off`) to find all the dirty blocks.  Note that there is no need to
// parallelize that process, since all the dirty blocks are guaranteed
// to be local.  `nextBlockStartOff` is `nil` if there's no next block.
func (bt *blockTree) getNextDirtyBlockAtOffset(ctx context.Context,
	topBlock Block, off Offset, rtype blockReqType,
	dirtyBcache DirtyBlockCache) (
	ptr BlockPointer, parentBlocks []parentBlockAndChildIndex,
	block Block, nextBlockStartOff, startOff Offset, err error) {
	// Find the block matching the offset, if it exists.
	ptr = bt.rootBlockPointer()
	if !dirtyBcache.IsDirty(bt.file.Tlf, ptr, bt.file.Branch) {
		// The top block isn't dirty, so we know none of the leaves
		// are dirty.
		return zeroPtr, nil, nil, topBlock.FirstOffset(),
			topBlock.FirstOffset(), nil
	} else if !topBlock.IsIndirect() {
		// A dirty, direct block.
		return bt.rootBlockPointer(), nil, topBlock, nil,
			topBlock.FirstOffset(), nil
	}

	ptr, parentBlocks, block, nextBlockStartOff, startOff, err =
		bt.getNextDirtyBlockAtOffsetAtLevel(
			ctx, topBlock, off, rtype, dirtyBcache, nil)
	if err != nil {
		return zeroPtr, nil, nil, nil, nil, err
	}
	if block == nil {
		return zeroPtr, nil, nil, topBlock.FirstOffset(),
			topBlock.FirstOffset(), nil
	}

	// The leaf block doesn't cover this index.  (If the contents
	// length is 0, then this is the start or end of a hole, and it
	// should still count as dirty.)
	if block.OffsetExceedsData(startOff, off) {
		return zeroPtr, nil, nil, nil, topBlock.FirstOffset(), nil
	}

	return ptr, parentBlocks, block, nextBlockStartOff, startOff, nil
}

// getBlocksForOffsetRange fetches all the blocks making up paths down
// the block tree to leaf ("direct") blocks that encompass the given
// offset range (half-inclusive) in the data.  If `endOff` is nil, it
// returns blocks until reaching the end of the data.  If `prefixOk`
// is true, the function will ignore context deadline errors and
// return whatever prefix of the data it could fetch within the
// deadine.  Return params:
//
//   * pathsFromRoot is a slice, ordered by offset, of paths from
//     the root to each block that makes up the range.  If the path is
//     empty, it indicates that pblock is a direct block and has no
//     children.
//   * blocks: a map from block pointer to a data-containing leaf node
//     in the given range of offsets, if `getDirect` is true.
//   * nextBlockOff is the offset of the block that follows the last
//     block given in `pathsFromRoot`.  If `pathsFromRoot` contains
//     the last block among the children, nextBlockOff is nil.
func (bt *blockTree) getBlocksForOffsetRange(ctx context.Context,
	ptr BlockPointer, pblock Block, startOff, endOff Offset,
	prefixOk bool, getDirect bool) (pathsFromRoot [][]parentBlockAndChildIndex,
	blocks map[BlockPointer]Block, nextBlockOffset Offset,
	err error) {
	nextBlockOffset = pblock.FirstOffset()
	if !pblock.IsIndirect() {
		// Return a single empty path, under the assumption that the
		// caller already checked the range for this block.
		if getDirect {
			// Return a child map with only this block in it.
			return [][]parentBlockAndChildIndex{nil},
				map[BlockPointer]Block{ptr: pblock}, nil, nil
		}
		// Return an empty child map with no blocks in it (since
		// getDirect is false).
		return [][]parentBlockAndChildIndex{nil}, nil, nil, nil
	}

	type resp struct {
		pathsFromRoot   [][]parentBlockAndChildIndex
		blocks          map[BlockPointer]Block
		nextBlockOffset Offset
	}

	// Search all of the in-range child blocks, and their child
	// blocks, etc, in parallel.
	respChans := make([]<-chan resp, 0, pblock.NumIndirectPtrs())
	eg, groupCtx := errgroup.WithContext(ctx)
	var nextBlockOffsetThisLevel Offset
	for i := 0; i < pblock.NumIndirectPtrs(); i++ {
		info, iptrOff := pblock.IndirectPtr(i)
		// Some byte of this block is included in the left side of the
		// range if `startOff` is less than the largest byte offset in
		// the block.
		inRangeLeft := true
		if i < pblock.NumIndirectPtrs()-1 {
			_, off := pblock.IndirectPtr(i + 1)
			inRangeLeft = startOff.Less(off)
		}
		if !inRangeLeft {
			continue
		}
		// Some byte of this block is included in the right side of
		// the range if `endOff` is bigger than the smallest byte
		// offset in the block (or if we're explicitly reading all the
		// data to the end).
		inRangeRight := endOff == nil || iptrOff.Less(endOff)
		if !inRangeRight {
			// This block is the first one past the offset range
			// amount the children.
			nextBlockOffsetThisLevel = iptrOff
			break
		}

		childPtr := info.BlockPointer
		childIndex := i
		respCh := make(chan resp, 1)
		respChans = append(respChans, respCh)
		// Don't reference the uncaptured `i` variable below.
		eg.Go(func() error {
			var pfr [][]parentBlockAndChildIndex
			var blocks map[BlockPointer]Block
			var nextBlockOffset Offset
			// We only need to fetch direct blocks if we've been asked
			// to do so.  If the direct type of the pointer is
			// unknown, we can assume all the children are direct
			// blocks, since there weren't multiple levels of
			// indirection before the introduction of the flag.
			if getDirect || childPtr.DirectType == IndirectBlock {
				block, _, err := bt.getter(
					groupCtx, bt.kmd, childPtr, bt.file, blockReadParallel)
				if err != nil {
					return err
				}

				// Recurse down to the level of the child.
				pfr, blocks, nextBlockOffset, err = bt.getBlocksForOffsetRange(
					groupCtx, childPtr, block, startOff, endOff, prefixOk,
					getDirect)
				if err != nil {
					return err
				}
			} else {
				// We don't care about direct blocks, so leave the
				// `blocks` map `nil`.
				pfr = [][]parentBlockAndChildIndex{nil}
				nextBlockOffset = nil
			}

			// Append self to the front of every path.
			var r resp
			for _, p := range pfr {
				newPath := append([]parentBlockAndChildIndex{{
					pblock:     pblock,
					childIndex: childIndex,
				}}, p...)
				r.pathsFromRoot = append(r.pathsFromRoot, newPath)
			}
			r.blocks = blocks
			r.nextBlockOffset = nextBlockOffset
			respCh <- r
			return nil
		})
	}

	err = eg.Wait()
	// If we are ok with just getting the prefix, don't treat a
	// deadline exceeded error as fatal.
	if prefixOk && err == context.DeadlineExceeded {
		err = nil
	}
	if err != nil {
		return nil, nil, nil, err
	}

	blocks = make(map[BlockPointer]Block)
	var minNextBlockOffsetChild Offset
outer:
	for _, respCh := range respChans {
		select {
		case r := <-respCh:
			pathsFromRoot = append(pathsFromRoot, r.pathsFromRoot...)
			for ptr, block := range r.blocks {
				blocks[ptr] = block
			}
			// We want to find the leftmost block offset that's to the
			// right of the range, the one immediately following the
			// end of the range.
			if r.nextBlockOffset != nil &&
				(minNextBlockOffsetChild == nil ||
					r.nextBlockOffset.Less(minNextBlockOffsetChild)) {
				minNextBlockOffsetChild = r.nextBlockOffset
			}
		default:
			// There should always be a response ready in every
			// channel, unless prefixOk is true.
			if prefixOk {
				break outer
			} else {
				panic("No response ready when !prefixOk")
			}
		}
	}

	// If this level has no offset, or one of the children has an
	// offset that's smaller than the one at this level, use the child
	// offset instead.
	if nextBlockOffsetThisLevel == nil {
		nextBlockOffset = minNextBlockOffsetChild
	} else if minNextBlockOffsetChild != nil &&
		minNextBlockOffsetChild.Less(nextBlockOffsetThisLevel) {
		nextBlockOffset = minNextBlockOffsetChild
	} else {
		nextBlockOffset = nextBlockOffsetThisLevel
	}

	return pathsFromRoot, blocks, nextBlockOffset, nil
}
