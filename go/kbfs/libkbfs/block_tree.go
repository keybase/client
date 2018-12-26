// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"fmt"
	"github.com/gammazero/workerpool"
	"sort"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
)

// maxBlockFetchWorkers specifies the number of parallel goroutines allowed
// when fetching blocks recursively in parallel.
const maxBlockFetchWorkers = 100

// blockGetterFn is a function that gets a block suitable for reading
// or writing, and also returns whether the block was already dirty.
// It may be called from new goroutines, and must handle any required
// locks accordingly.
type blockGetterFn func(context.Context, KeyMetadata, BlockPointer,
	path, blockReqType) (block BlockWithPtrs, wasDirty bool, err error)

// dirtyBlockCacher writes dirty blocks to a cache.
type dirtyBlockCacher func(
	ctx context.Context, ptr BlockPointer, block Block) error

type blockTree struct {
	file      path
	chargedTo keybase1.UserOrTeamID
	crypto    cryptoPure
	kmd       KeyMetadata
	bsplit    BlockSplitter
	getter    blockGetterFn
	cacher    dirtyBlockCacher
	log       logger.Logger
}

// parentBlockAndChildIndex is a node on a path down the tree to a
// particular leaf node.  `pblock` is an indirect block corresponding
// to one of that leaf node's parents, and `childIndex` is an index
// into `pblock.IPtrs` to the next node along the path.
type parentBlockAndChildIndex struct {
	pblock     BlockWithPtrs
	childIndex int
}

func (pbci parentBlockAndChildIndex) childIPtr() (BlockInfo, Offset) {
	return pbci.pblock.IndirectPtr(pbci.childIndex)
}

func (pbci parentBlockAndChildIndex) childBlockPtr() BlockPointer {
	info, _ := pbci.pblock.IndirectPtr(pbci.childIndex)
	return info.BlockPointer
}

func (pbci parentBlockAndChildIndex) clearEncodedSize() {
	pbci.pblock.ClearIndirectPtrSize(pbci.childIndex)
}

func (pbci parentBlockAndChildIndex) setChildBlockInfo(info BlockInfo) {
	pbci.pblock.SetIndirectPtrInfo(pbci.childIndex, info)
}

func (bt *blockTree) rootBlockPointer() BlockPointer {
	return bt.file.tailPointer()
}

// getBlockAtOffset returns the leaf block containing the given
// `off`, along with the set of indirect blocks leading to that leaf
// (if any).
func (bt *blockTree) getBlockAtOffset(ctx context.Context,
	topBlock BlockWithPtrs, off Offset, rtype blockReqType) (
	ptr BlockPointer, parentBlocks []parentBlockAndChildIndex,
	block BlockWithPtrs, nextBlockStartOff, startOff Offset,
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

// getNextDirtyBlockAtOffsetAtLevel does the same thing as
// `getNextDirtyBlockAtOffset` (see the comments on that function)
// on a subsection of the block tree (not necessarily starting from
// the top block).
func (bt *blockTree) getNextDirtyBlockAtOffsetAtLevel(ctx context.Context,
	pblock BlockWithPtrs, off Offset, rtype blockReqType,
	dirtyBcache isDirtyProvider, parentBlocks []parentBlockAndChildIndex) (
	ptr BlockPointer, newParentBlocks []parentBlockAndChildIndex,
	block BlockWithPtrs, nextBlockStartOff, startOff Offset, err error) {
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
	topBlock BlockWithPtrs, off Offset, rtype blockReqType,
	dirtyBcache isDirtyProvider) (
	ptr BlockPointer, parentBlocks []parentBlockAndChildIndex,
	block BlockWithPtrs, nextBlockStartOff, startOff Offset, err error) {
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

// getBlocksForOffsetRangeTask is used for passing data to
// getBlocksForOffsetRange tasks.
type getBlocksForOffsetRangeTask struct {
	ptr        BlockPointer
	pblock     BlockWithPtrs
	pathPrefix []parentBlockAndChildIndex
	startOff   Offset
	endOff     Offset
	prefixOk   bool
	getDirect  bool
	// firstBlock is true if this is the first block in the range being fetched.
	firstBlock bool
}

func (task *getBlocksForOffsetRangeTask) subTask(
	childPtr BlockPointer, childPath []parentBlockAndChildIndex,
	firstBlock bool) getBlocksForOffsetRangeTask {
	subTask := *task
	subTask.ptr = childPtr
	subTask.pblock = nil
	subTask.pathPrefix = childPath
	subTask.firstBlock = firstBlock
	return subTask
}

// getBlocksForOffsetRangeResult is used for passing data back from
// getBlocksForOffsetRange tasks.
type getBlocksForOffsetRangeResult struct {
	pathFromRoot    []parentBlockAndChildIndex
	ptr             BlockPointer
	block           Block
	nextBlockOffset Offset
	firstBlock      bool
	err             error
}

// processGetBlocksTask examines the block it is passed, enqueueing any children
// in range into wp, and passing data back through results.
func (bt *blockTree) processGetBlocksTask(ctx context.Context,
	wg *sync.WaitGroup, wp *workerpool.WorkerPool,
	job getBlocksForOffsetRangeTask,
	results chan<- getBlocksForOffsetRangeResult) {
	defer wg.Done()

	select {
	case <-ctx.Done():
		results <- getBlocksForOffsetRangeResult{err: ctx.Err()}
		return
	default:
	}

	// We may have been passed just a pointer and need to fetch the block here.
	var pblock BlockWithPtrs
	if job.pblock == nil {
		var err error
		pblock, _, err = bt.getter(ctx, bt.kmd, job.ptr, bt.file, blockReadParallel)
		if err != nil {
			results <- getBlocksForOffsetRangeResult{
				firstBlock: job.firstBlock,
				err:        err,
			}
			return
		}
	} else {
		pblock = job.pblock
	}

	if !pblock.IsIndirect() {
		// Return this block, under the assumption that the
		// caller already checked the range for this block.
		if job.getDirect {
			results <- getBlocksForOffsetRangeResult{
				pathFromRoot:    job.pathPrefix,
				ptr:             job.ptr,
				block:           pblock,
				nextBlockOffset: nil,
				firstBlock:      job.firstBlock,
				err:             nil,
			}
		}
		return
	}

	// Search all of the in-range child blocks, and their child
	// blocks, etc, in parallel.
	childIsFirstBlock := job.firstBlock
	for i := 0; i < pblock.NumIndirectPtrs(); i++ {
		info, iptrOff := pblock.IndirectPtr(i)
		// Some byte of this block is included in the left side of the
		// range if `job.startOff` is less than the largest byte offset in
		// the block.
		inRangeLeft := true
		if i < pblock.NumIndirectPtrs()-1 {
			_, off := pblock.IndirectPtr(i + 1)
			inRangeLeft = job.startOff.Less(off)
		}
		if !inRangeLeft {
			continue
		}
		// Some byte of this block is included in the right side of
		// the range if `job.endOff` is bigger than the smallest byte
		// offset in the block (or if we're explicitly reading all the
		// data to the end).
		inRangeRight := job.endOff == nil || iptrOff.Less(job.endOff)
		if !inRangeRight {
			// This block is the first one past the offset range
			// amount the children.
			results <- getBlocksForOffsetRangeResult{nextBlockOffset: iptrOff}
			return
		}

		childPtr := info.BlockPointer
		childIndex := i

		childPath := make([]parentBlockAndChildIndex, len(job.pathPrefix)+1)
		copy(childPath, job.pathPrefix)
		childPath[len(childPath)-1] = parentBlockAndChildIndex{
			pblock:     pblock,
			childIndex: childIndex,
		}

		// We only need to fetch direct blocks if we've been asked
		// to do so.  If the direct type of the pointer is
		// unknown, we can assume all the children are direct
		// blocks, since there weren't multiple levels of
		// indirection before the introduction of the flag.
		if job.getDirect || childPtr.DirectType == IndirectBlock {
			subTask := job.subTask(childPtr, childPath, childIsFirstBlock)

			// Enqueue the subTask with the WorkerPool.
			wg.Add(1)
			wp.Submit(func() {
				bt.processGetBlocksTask(ctx, wg, wp, subTask, results)
			})
		} else {
			results <- getBlocksForOffsetRangeResult{
				pathFromRoot: childPath,
				firstBlock:   childIsFirstBlock,
			}
		}
		childIsFirstBlock = false
	}
}

func checkForHolesAndTruncate(
	pathsFromRoot [][]parentBlockAndChildIndex) [][]parentBlockAndChildIndex {
	var prevPath []parentBlockAndChildIndex
	for pathIdx, path := range pathsFromRoot {
		// Each path after the first must immediately follow the preceding path.
		if pathIdx == 0 {
			prevPath = path
			continue
		}
		// Find the first place the 2 paths differ.
		// Verify that path is immediately after prevPath.
		if len(path) != len(prevPath) {
			return pathsFromRoot[:pathIdx]
		}

		foundIncrement := false
		for idx := range path {
			prevChild := prevPath[idx].childIndex
			thisChild := path[idx].childIndex
			if foundIncrement {
				if thisChild != 0 || prevChild != prevPath[idx-1].
					pblock.NumIndirectPtrs()-1 {
					return pathsFromRoot[:pathIdx]
				}
			} else {
				if prevChild+1 == thisChild {
					foundIncrement = true
				} else if prevChild != thisChild {
					return pathsFromRoot[:pathIdx]
				}
			}
		}
		// If we never found where the two paths differ,
		// then something has gone wrong.
		if !foundIncrement {
			return pathsFromRoot[:pathIdx]
		}
		prevPath = path
	}
	return pathsFromRoot
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
	ptr BlockPointer, pblock BlockWithPtrs, startOff, endOff Offset,
	prefixOk bool, getDirect bool) (pathsFromRoot [][]parentBlockAndChildIndex,
	blocks map[BlockPointer]Block, nextBlockOffset Offset,
	err error) {
	// Make a WaitGroup to keep track of whether there's still work to be done.
	var wg sync.WaitGroup

	// Make a workerpool to limit the number of concurrent goroutines.
	wp := workerpool.New(maxBlockFetchWorkers)

	// Make a context to cancel all the jobs if something goes wrong.
	groupCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Make a queue for results coming back from workers.
	results := make(chan getBlocksForOffsetRangeResult)

	// Enqueue the top-level task. Increment the task counter by one.
	rootTask := getBlocksForOffsetRangeTask{
		ptr:        ptr,
		pblock:     pblock,
		pathPrefix: nil,
		startOff:   startOff,
		endOff:     endOff,
		prefixOk:   prefixOk,
		getDirect:  getDirect,
		firstBlock: true,
	}
	wg.Add(1)
	wp.Submit(func() {
		bt.processGetBlocksTask(groupCtx, &wg, wp, rootTask, results)
	})

	// Once all the work is done, stop the WorkerPool and close `results` so
	// that the loop below exits
	go func() {
		wg.Wait()
		wp.Stop()
		close(results)
	}()

	// Reduce all the results coming in over the results channel.
	var minNextBlockOffset Offset
	blocks = make(map[BlockPointer]Block)
	pathsFromRoot = [][]parentBlockAndChildIndex{}
	mustCheckForHoles := false
	gotFirstBlock := false
	var errors []error
	for res := range results {
		if res.err != nil {
			// If we are ok with just getting the prefix, don't treat a
			// deadline exceeded error as fatal.
			if prefixOk && res.err == context.DeadlineExceeded &&
				!res.firstBlock && len(errors) == 0 {
				mustCheckForHoles = true
			} else {
				errors = append(errors, res.err)
			}
			cancel()
		}
		if res.pathFromRoot != nil {
			pathsFromRoot = append(pathsFromRoot, res.pathFromRoot)
		}
		if res.block != nil {
			blocks[res.ptr] = res.block
		}
		if res.nextBlockOffset != nil &&
			(minNextBlockOffset == nil ||
				res.nextBlockOffset.Less(minNextBlockOffset)) {
			minNextBlockOffset = res.nextBlockOffset
		}
		if res.firstBlock {
			gotFirstBlock = true
		}
	}
	nextBlockOffset = minNextBlockOffset

	if len(errors) == 1 {
		return nil, nil, nil, errors[0]
	} else if len(errors) > 1 {
		return nil, nil, nil, fmt.Errorf("multiple errors: %v", errors)
	}

	// Out-of-order traversal means the paths come back from workers unsorted.
	// Sort them before returning them to the caller.
	sort.Slice(pathsFromRoot, func(i, j int) bool {
		pathI := pathsFromRoot[i]
		pathJ := pathsFromRoot[j]
		lastChildI := pathI[len(pathI)-1]
		lastChildJ := pathJ[len(pathJ)-1]

		_, offsetI := lastChildI.pblock.IndirectPtr(lastChildI.childIndex)
		_, offsetJ := lastChildJ.pblock.IndirectPtr(lastChildJ.childIndex)

		return offsetI.Less(offsetJ)
	})

	// If we are returning data even though not all the goroutines completed,
	// we may need to return only some of the data we gathered in order to
	// return a correct prefix of the data. Thus, we find the longest prefix of
	// the data without any holes.
	if !gotFirstBlock {
		pathsFromRoot = [][]parentBlockAndChildIndex{}
	} else if mustCheckForHoles {
		pathsFromRoot = checkForHolesAndTruncate(pathsFromRoot)
	}

	return pathsFromRoot, blocks, nextBlockOffset, nil
}

type createTopBlockFn func(context.Context, DataVer) (BlockWithPtrs, error)
type makeNewBlockWithPtrs func(isIndirect bool) BlockWithPtrs

// newRightBlock creates space for a new rightmost block, creating
// parent blocks and a new level of indirection in the tree as needed.
// If there's no new level of indirection, it modifies the blocks in
// `parentBlocks` to include the new right-most pointers
// (`parentBlocks` must consist of blocks copied for writing).  It
// also returns the set of parents pointing to the new block (whether
// or not there is a new level of indirection), and also returns any
// newly-dirtied block pointers.
//
// The new block is pointed to using offset `off`, and doesn't have to
// represent the right-most block in a tree.  In particular, if `off`
// is less than the offset of its leftmost neighbor, it's the caller's
// responsibility to move the new right block into the correct place
// in the tree (e.g., using `shiftBlocksToFillHole()`).
func (bt *blockTree) newRightBlock(
	ctx context.Context, parentBlocks []parentBlockAndChildIndex, off Offset,
	dver DataVer, newBlock makeNewBlockWithPtrs, topBlocker createTopBlockFn) (
	[]parentBlockAndChildIndex, []BlockPointer, error) {
	// Find the lowest block that can accommodate a new right block.
	lowestAncestorWithRoom := -1
	for i := len(parentBlocks) - 1; i >= 0; i-- {
		pb := parentBlocks[i]
		if pb.pblock.NumIndirectPtrs() < bt.bsplit.MaxPtrsPerBlock() {
			lowestAncestorWithRoom = i
			break
		}
	}

	var newTopBlock BlockWithPtrs
	var newDirtyPtrs []BlockPointer
	if lowestAncestorWithRoom < 0 {
		// Create a new level of indirection at the top.
		var err error
		newTopBlock, err = topBlocker(ctx, dver)
		if err != nil {
			return nil, nil, err
		}

		// The old top block needs to be cached under its new ID if it
		// was indirect.
		if len(parentBlocks) > 0 {
			dType := DirectBlock
			if parentBlocks[0].pblock.IsIndirect() {
				dType = IndirectBlock
			}
			newTopBlock.SetIndirectPtrType(0, dType)
			info, _ := newTopBlock.IndirectPtr(0)
			ptr := info.BlockPointer
			err = bt.cacher(ctx, ptr, parentBlocks[0].pblock)
			if err != nil {
				return nil, nil, err
			}
			newDirtyPtrs = append(newDirtyPtrs, ptr)
		}

		parentBlocks = append([]parentBlockAndChildIndex{{newTopBlock, 0}},
			parentBlocks...)
		lowestAncestorWithRoom = 0
	}
	rightParentBlocks := make([]parentBlockAndChildIndex, len(parentBlocks))

	bt.log.CDebugf(ctx, "Making new right block at off %s for entry %v, "+
		"lowestAncestor at level %d", off, bt.rootBlockPointer(),
		lowestAncestorWithRoom)

	// Make a new right block for every parent, starting with the
	// lowest ancestor with room.  Note that we're not iterating over
	// the actual parent blocks here; we're only using its length to
	// figure out how many levels need new blocks.
	pblock := parentBlocks[lowestAncestorWithRoom].pblock
	for i := lowestAncestorWithRoom; i < len(parentBlocks); i++ {
		newRID, err := bt.crypto.MakeTemporaryBlockID()
		if err != nil {
			return nil, nil, err
		}

		newPtr := BlockPointer{
			ID:      newRID,
			KeyGen:  bt.kmd.LatestKeyGeneration(),
			DataVer: dver,
			Context: kbfsblock.MakeFirstContext(
				bt.chargedTo, bt.rootBlockPointer().GetBlockType()),
			DirectType: IndirectBlock,
		}

		if i == len(parentBlocks)-1 {
			newPtr.DirectType = DirectBlock
		}

		bt.log.CDebugf(ctx, "New right block for entry %v, level %d, ptr %v",
			bt.rootBlockPointer(), i, newPtr)

		pblock.AppendNewIndirectPtr(newPtr, off)
		rightParentBlocks[i].pblock = pblock
		rightParentBlocks[i].childIndex = pblock.NumIndirectPtrs() - 1

		isInd := i != len(parentBlocks)-1
		rblock := newBlock(isInd)
		if isInd {
			pblock = rblock
		}

		err = bt.cacher(ctx, newPtr, rblock)
		if err != nil {
			return nil, nil, err
		}

		newDirtyPtrs = append(newDirtyPtrs, newPtr)
	}

	// All parents up to and including the lowest ancestor with room
	// will have to change, so mark them as dirty.
	ptr := bt.rootBlockPointer()
	for i := 0; i <= lowestAncestorWithRoom; i++ {
		pb := parentBlocks[i]
		if err := bt.cacher(ctx, ptr, pb.pblock); err != nil {
			return nil, nil, err
		}
		newDirtyPtrs = append(newDirtyPtrs, ptr)
		ptr = pb.childBlockPtr()
		rightParentBlocks[i].pblock = pb.pblock
		rightParentBlocks[i].childIndex = pb.pblock.NumIndirectPtrs() - 1
	}

	return rightParentBlocks, newDirtyPtrs, nil
}

// setParentOffsets updates the parent offsets for a newly-moved
// block, all the way up to its common ancestor (which is the one that
// doesn't have a childIndex of 0).
func (bt *blockTree) setParentOffsets(
	ctx context.Context, newOff Offset,
	parents []parentBlockAndChildIndex, currIndex int) (
	newDirtyPtrs []BlockPointer, newUnrefs []BlockInfo, err error) {
	for level := len(parents) - 2; level >= 0; level-- {
		// Cache the block below this level, which was just
		// modified.
		childInfo, _ := parents[level].childIPtr()
		if err := bt.cacher(
			ctx, childInfo.BlockPointer, parents[level+1].pblock); err != nil {
			return nil, nil, err
		}
		newDirtyPtrs = append(newDirtyPtrs, childInfo.BlockPointer)
		// Remember the size of the dirtied child.
		if childInfo.EncodedSize != 0 {
			newUnrefs = append(newUnrefs, childInfo)
			parents[level].clearEncodedSize()
		}

		// If we've reached a level where the child indirect
		// offset wasn't affected, we're done.  If not, update the
		// offset at this level and move up the tree.
		if currIndex > 0 {
			break
		}
		currIndex = parents[level].childIndex
		parents[level].pblock.SetIndirectPtrOff(currIndex, newOff)
	}
	return newDirtyPtrs, newUnrefs, nil
}

func (bt *blockTree) String() string {
	block, _, err := bt.getter(
		nil, bt.kmd, bt.rootBlockPointer(), bt.file, blockRead)
	if err != nil {
		return "ERROR: " + err.Error()
	}

	level := []BlockWithPtrs{block}
	// TODO: use a `bytes.Buffer` instead of a regular string here if
	// we ever use this function from real code.
	res := "\n---------------\n"
	for len(level) > 0 {
		var nextLevel []BlockWithPtrs
		for i, block := range level {
			if !block.IsIndirect() {
				continue
			}
			for j := 0; j < block.NumIndirectPtrs(); j++ {
				info, off := block.IndirectPtr(j)
				res += fmt.Sprintf("\"%s\" ", off)
				if info.DirectType == DirectBlock {
					continue
				}
				child, _, err := bt.getter(
					nil, bt.kmd, info.BlockPointer, bt.file, blockRead)
				if err != nil {
					return "ERROR: " + err.Error()
				}
				nextLevel = append(nextLevel, child)
			}
			if i+1 < len(level) {
				res += "| "
			}
		}
		res += "\n"
		level = nextLevel
	}
	res += "---------------\n"
	return res
}

// shiftBlocksToFillHole should be called after newRightBlock when the
// offset for the new block is smaller than the final offset of the
// tree.  This happens when there is a hole in the file, or when
// expanding an internal leaf for a directory, and the user is now
// writing data into that expanded area.  This function moves the new
// block into the correct place, and rearranges all the indirect
// pointers in the file as needed.  It returns any block pointers that
// were dirtied in the process.
func (bt *blockTree) shiftBlocksToFillHole(
	ctx context.Context, newTopBlock BlockWithPtrs,
	parents []parentBlockAndChildIndex) (
	newDirtyPtrs []BlockPointer, newUnrefs []BlockInfo,
	newlyDirtiedChildBytes int64, err error) {
	// `parents` should represent the right side of the tree down to
	// the new rightmost indirect pointer, the offset of which should
	// match `newHoleStartOff`.  Keep swapping it with its sibling on
	// the left until its offset would be lower than that child's
	// offset.  If there are no children to the left, continue on with
	// the children in the cousin block to the left.  If we swap a
	// child between cousin blocks, we must update the offset in the
	// right cousin's parent block.  If *that* updated pointer is the
	// leftmost pointer in its parent block, update that one as well,
	// up to the root.
	//
	// We are guaranteed at least one level of indirection because
	// `newRightBlock` should have been called before
	// `shiftBlocksToFillHole`.
	immedParent := parents[len(parents)-1]
	currIndex := immedParent.childIndex
	_, newBlockStartOff := immedParent.childIPtr()

	bt.log.CDebugf(ctx, "Shifting block with offset %s for entry %v into "+
		"position", newBlockStartOff, bt.rootBlockPointer())

	// Swap left as needed.
	for loopedOnce := false; ; loopedOnce = true {
		var leftOff Offset
		var newParents []parentBlockAndChildIndex
		immedPblock := immedParent.pblock
		if currIndex > 0 {
			_, leftOff = immedPblock.IndirectPtr(currIndex - 1)
		} else {
			if loopedOnce {
				// Now update the left side if needed, before looking into
				// swapping across blocks.
				bt.log.CDebugf(ctx, "Updating on left side")
				_, newOff := immedPblock.IndirectPtr(currIndex)
				ndp, nu, err := bt.setParentOffsets(
					ctx, newOff, parents, currIndex)
				if err != nil {
					return nil, nil, 0, err
				}
				newDirtyPtrs = append(newDirtyPtrs, ndp...)
				newUnrefs = append(newUnrefs, nu...)
			}

			// Construct the new set of parents for the shifted block,
			// by looking for the next left cousin.
			newParents = make([]parentBlockAndChildIndex, len(parents))
			copy(newParents, parents)
			var level int
			for level = len(newParents) - 2; level >= 0; level-- {
				// The parent at the level being evaluated has a left
				// sibling, so we use that sibling.
				if newParents[level].childIndex > 0 {
					break
				}
				// Keep going up until we find a way back down a left branch.
			}

			if level < 0 {
				// We are already all the way on the left, we're done!
				return newDirtyPtrs, newUnrefs, newlyDirtiedChildBytes, nil
			}
			newParents[level].childIndex--

			// Walk back down, shifting the new parents into position.
			for ; level < len(newParents)-1; level++ {
				nextPtr := newParents[level].childBlockPtr()
				childBlock, _, err := bt.getter(
					ctx, bt.kmd, nextPtr, bt.file, blockWrite)
				if err != nil {
					return nil, nil, 0, err
				}

				newParents[level+1].pblock = childBlock
				newParents[level+1].childIndex =
					childBlock.NumIndirectPtrs() - 1
				_, leftOff = childBlock.IndirectPtr(
					childBlock.NumIndirectPtrs() - 1)
			}
		}

		// We're done!
		if leftOff.Less(newBlockStartOff) {
			return newDirtyPtrs, newUnrefs, newlyDirtiedChildBytes, nil
		}

		// Otherwise, we need to swap the indirect file pointers.
		if currIndex > 0 {
			immedPblock.SwapIndirectPtrs(currIndex-1, immedPblock, currIndex)
			currIndex--
			continue
		}

		// Swap block pointers across cousins at the lowest level of
		// indirection.
		newImmedParent := newParents[len(newParents)-1]
		newImmedPblock := newImmedParent.pblock
		newCurrIndex := newImmedPblock.NumIndirectPtrs() - 1
		newImmedPblock.SwapIndirectPtrs(newCurrIndex, immedPblock, currIndex)

		// Cache the new immediate parent as dirty.  Also cache the
		// old immediate parent's right-most leaf child as dirty, to
		// make sure this path is captured in
		// getNextDirtyBlockAtOffset calls.  TODO: this is inefficient
		// since it might end up re-encoding and re-uploading a leaf
		// block that wasn't actually dirty; we should find a better
		// way to make sure ready() sees these parent blocks.
		if len(newParents) > 1 {
			i := len(newParents) - 2
			childPtr := newParents[i].childBlockPtr()
			if err := bt.cacher(
				ctx, childPtr, newImmedPblock); err != nil {
				return nil, nil, 0, err
			}
			newDirtyPtrs = append(newDirtyPtrs, childPtr)

			// Fetch the old parent's right leaf for writing, and mark
			// it as dirty.
			rightLeafInfo, _ := immedPblock.IndirectPtr(
				immedPblock.NumIndirectPtrs() - 1)
			leafBlock, _, err := bt.getter(
				ctx, bt.kmd, rightLeafInfo.BlockPointer, bt.file, blockWrite)
			if err != nil {
				return nil, nil, 0, err
			}
			if err := bt.cacher(
				ctx, rightLeafInfo.BlockPointer, leafBlock); err != nil {
				return nil, nil, 0, err
			}
			newDirtyPtrs = append(newDirtyPtrs, rightLeafInfo.BlockPointer)
			// Remember the size of the dirtied leaf.
			if rightLeafInfo.EncodedSize != 0 {
				newlyDirtiedChildBytes += leafBlock.BytesCanBeDirtied()
				newUnrefs = append(newUnrefs, rightLeafInfo)
				immedPblock.ClearIndirectPtrSize(
					immedPblock.NumIndirectPtrs() - 1)
			}
		}

		// Now we need to update the parent offsets on the right side,
		// all the way up to the common ancestor (which is the one
		// with the one that doesn't have a childIndex of 0).
		_, newRightOff := immedPblock.IndirectPtr(currIndex)
		ndp, nu, err := bt.setParentOffsets(
			ctx, newRightOff, parents, currIndex)
		if err != nil {
			return nil, nil, 0, err
		}
		newDirtyPtrs = append(newDirtyPtrs, ndp...)
		newUnrefs = append(newUnrefs, nu...)

		immedParent = newImmedParent
		currIndex = newCurrIndex
		parents = newParents
	}
	// The loop above must exit via one of the returns.
}

// markParentsDirty caches all the blocks in `parentBlocks` as dirty,
// and returns the dirtied block pointers as well as any block infos
// with non-zero encoded sizes that will now need to be unreferenced.
func (bt *blockTree) markParentsDirty(
	ctx context.Context, parentBlocks []parentBlockAndChildIndex) (
	dirtyPtrs []BlockPointer, unrefs []BlockInfo, err error) {
	parentPtr := bt.rootBlockPointer()
	for _, pb := range parentBlocks {
		if err := bt.cacher(ctx, parentPtr, pb.pblock); err != nil {
			return nil, unrefs, err
		}
		dirtyPtrs = append(dirtyPtrs, parentPtr)
		childInfo, _ := pb.childIPtr()
		parentPtr = childInfo.BlockPointer

		// Remember the size of each newly-dirtied child.
		if childInfo.EncodedSize != 0 {
			unrefs = append(unrefs, childInfo)
			pb.clearEncodedSize()
		}
	}
	return dirtyPtrs, unrefs, nil
}

type makeSyncFunc func(ptr BlockPointer) func() error

// readyHelper takes a set of paths from a root down to a child block,
// and readies all the blocks represented in those paths.  If the
// caller wants leaf blocks readied, then the last element of each
// slice in `pathsFromRoot` should contain a leaf block, with a child
// index of -1.  It's assumed that all slices in `pathsFromRoot` have
// the same size. This function returns a map pointing from the new
// block info from any readied block to its corresponding old block
// pointer.
func (bt *blockTree) readyHelper(
	ctx context.Context, id tlf.ID, bcache BlockCache, bops BlockOps,
	bps blockPutState, pathsFromRoot [][]parentBlockAndChildIndex,
	makeSync makeSyncFunc) (map[BlockInfo]BlockPointer, error) {
	oldPtrs := make(map[BlockInfo]BlockPointer)
	newPtrs := make(map[BlockPointer]bool)

	// Starting from the leaf level, ready each block at each level,
	// and put the new BlockInfo into the parent block at the level
	// above.  At each level, only ready each block once. Don't ready
	// the root block though; the folderUpdatePrepper code will do
	// that.
	for level := len(pathsFromRoot[0]) - 1; level > 0; level-- {
		for i := 0; i < len(pathsFromRoot); i++ {
			// Ready the dirty block.
			pb := pathsFromRoot[i][level]

			parentPB := pathsFromRoot[i][level-1]
			ptr := parentPB.childBlockPtr()
			// If this is already a new pointer, skip it.
			if newPtrs[ptr] {
				continue
			}

			newInfo, _, readyBlockData, err := ReadyBlock(
				ctx, bcache, bops, bt.crypto, bt.kmd, pb.pblock,
				bt.chargedTo, bt.rootBlockPointer().GetBlockType())
			if err != nil {
				return nil, err
			}

			err = bcache.Put(
				newInfo.BlockPointer, id, pb.pblock, PermanentEntry)
			if err != nil {
				return nil, err
			}

			// Only the leaf level need to be tracked by the dirty file.
			var syncFunc func() error
			if makeSync != nil && level == len(pathsFromRoot[0])-1 {
				syncFunc = makeSync(ptr)
			}

			err = bps.addNewBlock(
				ctx, newInfo.BlockPointer, pb.pblock, readyBlockData, syncFunc)
			if err != nil {
				return nil, err
			}
			err = bps.saveOldPtr(ctx, ptr)
			if err != nil {
				return nil, err
			}

			parentPB.setChildBlockInfo(newInfo)
			oldPtrs[newInfo] = ptr
			newPtrs[newInfo.BlockPointer] = true
		}
	}
	return oldPtrs, nil
}

// ready, if given an indirect top-block, readies all the dirty child
// blocks, and updates their block IDs in their parent block's list of
// indirect pointers.  It returns a map pointing from the new block
// info from any readied block to its corresponding old block pointer.
func (bt *blockTree) ready(
	ctx context.Context, id tlf.ID, bcache BlockCache,
	dirtyBcache isDirtyProvider, bops BlockOps, bps blockPutState,
	topBlock BlockWithPtrs, makeSync makeSyncFunc) (
	map[BlockInfo]BlockPointer, error) {
	if !topBlock.IsIndirect() {
		return nil, nil
	}

	// This will contain paths to all dirty leaf paths.  The final
	// entry index in each path will be the leaf node block itself
	// (with a -1 child index).
	var dirtyLeafPaths [][]parentBlockAndChildIndex

	// Gather all the paths to all dirty leaf blocks first.
	off := topBlock.FirstOffset()
	for off != nil {
		_, parentBlocks, block, nextBlockOff, _, err :=
			bt.getNextDirtyBlockAtOffset(
				ctx, topBlock, off, blockWrite, dirtyBcache)
		if err != nil {
			return nil, err
		}

		if block == nil {
			// No more dirty blocks.
			break
		}
		off = nextBlockOff // Will be `nil` if there are no more blocks.

		dirtyLeafPaths = append(dirtyLeafPaths,
			append(parentBlocks, parentBlockAndChildIndex{block, -1}))
	}

	// No dirty blocks means nothing to do.
	if len(dirtyLeafPaths) == 0 {
		return nil, nil
	}

	return bt.readyHelper(ctx, id, bcache, bops, bps, dirtyLeafPaths, makeSync)
}

func (bt *blockTree) getIndirectBlocksForOffsetRange(
	ctx context.Context, pblock BlockWithPtrs, startOff, endOff Offset) (
	pathsFromRoot [][]parentBlockAndChildIndex, err error) {
	// Fetch the paths of indirect blocks, without getting the direct
	// blocks.
	pfr, _, _, err := bt.getBlocksForOffsetRange(
		ctx, bt.rootBlockPointer(), pblock, startOff, endOff, false,
		false /* no direct blocks */)
	if err != nil {
		return nil, err
	}

	return pfr, nil
}

func (bt *blockTree) getIndirectBlockInfosWithTopBlock(
	ctx context.Context, topBlock BlockWithPtrs) ([]BlockInfo, error) {
	if !topBlock.IsIndirect() {
		return nil, nil
	}

	pfr, err := bt.getIndirectBlocksForOffsetRange(
		ctx, topBlock, topBlock.FirstOffset(), nil)
	if err != nil {
		return nil, err
	}

	var blockInfos []BlockInfo
	infoSeen := make(map[BlockPointer]bool)
	for _, path := range pfr {
	pathLoop:
		for _, pb := range path {
			for i := 0; i < pb.pblock.NumIndirectPtrs(); i++ {
				info, _ := pb.pblock.IndirectPtr(i)
				if infoSeen[info.BlockPointer] {
					// No need to iterate through this whole block
					// again if we've already seen one of its children
					// before.
					continue pathLoop
				}

				infoSeen[info.BlockPointer] = true
				blockInfos = append(blockInfos, info)
			}
		}
	}
	return blockInfos, nil
}

func (bt *blockTree) getIndirectBlockInfos(ctx context.Context) (
	[]BlockInfo, error) {
	if bt.rootBlockPointer().DirectType == DirectBlock {
		return nil, nil
	}

	topBlock, _, err := bt.getter(
		ctx, bt.kmd, bt.rootBlockPointer(), bt.file, blockRead)
	if err != nil {
		return nil, err
	}
	return bt.getIndirectBlockInfosWithTopBlock(ctx, topBlock)
}
