// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// dirBlockGetter is a function that gets a block suitable for
// reading or writing, and also returns whether the block was already
// dirty.  It may be called from new goroutines, and must handle any
// required locks accordingly.
type dirBlockGetter func(context.Context, KeyMetadata, BlockPointer,
	path, blockReqType) (dblock *DirBlock, wasDirty bool, err error)

// dirData is a helper struct for accessing and manipulating data
// within a directory.  It's meant for use within a single scope, not
// for long-term storage.  The caller must ensure goroutine-safety.
type dirData struct {
	getter dirBlockGetter
	tree   *blockTree
}

func newDirData(dir path, chargedTo keybase1.UserOrTeamID,
	crypto cryptoPure, bsplit BlockSplitter, kmd KeyMetadata,
	getter dirBlockGetter, cacher dirtyBlockCacher,
	log logger.Logger) *dirData {
	dd := &dirData{
		getter: getter,
	}
	dd.tree = &blockTree{
		file:      dir,
		chargedTo: chargedTo,
		crypto:    crypto,
		kmd:       kmd,
		bsplit:    bsplit,
		getter:    dd.blockGetter,
		cacher:    cacher,
		log:       log,
	}
	return dd
}

func (dd *dirData) rootBlockPointer() BlockPointer {
	return dd.tree.file.tailPointer()
}

func (dd *dirData) blockGetter(
	ctx context.Context, kmd KeyMetadata, ptr BlockPointer,
	dir path, rtype blockReqType) (
	block BlockWithPtrs, wasDirty bool, err error) {
	return dd.getter(ctx, kmd, ptr, dir, rtype)
}

var hiddenEntries = map[string]bool{
	".kbfs_git":     true,
	".kbfs_autogit": true,
}

func (dd *dirData) getTopBlock(ctx context.Context, rtype blockReqType) (
	*DirBlock, error) {
	topBlock, _, err := dd.getter(
		ctx, dd.tree.kmd, dd.rootBlockPointer(), dd.tree.file, rtype)
	if err != nil {
		return nil, err
	}
	return topBlock, nil
}

func (dd *dirData) getChildren(ctx context.Context) (
	children map[string]EntryInfo, err error) {
	topBlock, err := dd.getTopBlock(ctx, blockRead)
	if err != nil {
		return nil, err
	}

	_, blocks, _, err := dd.tree.getBlocksForOffsetRange(
		ctx, dd.rootBlockPointer(), topBlock, topBlock.FirstOffset(), nil,
		false, true)
	if err != nil {
		return nil, err
	}

	numEntries := 0
	for _, b := range blocks {
		numEntries += len(b.(*DirBlock).Children)
	}
	children = make(map[string]EntryInfo, numEntries)
	for _, b := range blocks {
		for k, de := range b.(*DirBlock).Children {
			if hiddenEntries[k] {
				continue
			}
			children[k] = de.EntryInfo
		}
	}
	return children, nil
}

func (dd *dirData) getEntries(ctx context.Context) (
	children map[string]DirEntry, err error) {
	topBlock, err := dd.getTopBlock(ctx, blockRead)
	if err != nil {
		return nil, err
	}

	_, blocks, _, err := dd.tree.getBlocksForOffsetRange(
		ctx, dd.rootBlockPointer(), topBlock, topBlock.FirstOffset(), nil,
		false, true)
	if err != nil {
		return nil, err
	}

	numEntries := 0
	for _, b := range blocks {
		numEntries += len(b.(*DirBlock).Children)
	}
	children = make(map[string]DirEntry, numEntries)
	for _, b := range blocks {
		for k, de := range b.(*DirBlock).Children {
			children[k] = de
		}
	}
	return children, nil
}

func (dd *dirData) lookup(ctx context.Context, name string) (DirEntry, error) {
	topBlock, err := dd.getTopBlock(ctx, blockRead)
	if err != nil {
		return DirEntry{}, err
	}

	off := StringOffset(name)
	_, _, block, _, _, _, err := dd.tree.getBlockAtOffset(
		ctx, topBlock, &off, blockLookup)
	if err != nil {
		return DirEntry{}, err
	}

	de, ok := block.(*DirBlock).Children[name]
	if !ok {
		return DirEntry{}, NoSuchNameError{name}
	}
	return de, nil
}

// createIndirectBlock creates a new indirect block and pick a new id
// for the existing block, and use the existing block's ID for the new
// indirect block that becomes the parent.
func (dd *dirData) createIndirectBlock(ctx context.Context, dver DataVer) (
	BlockWithPtrs, error) {
	newID, err := dd.tree.crypto.MakeTemporaryBlockID()
	if err != nil {
		return nil, err
	}
	dblock := &DirBlock{
		CommonBlock: CommonBlock{
			IsInd: true,
		},
		IPtrs: []IndirectDirPtr{
			{
				BlockInfo: BlockInfo{
					BlockPointer: BlockPointer{
						ID:      newID,
						KeyGen:  dd.tree.kmd.LatestKeyGeneration(),
						DataVer: dver,
						Context: kbfsblock.MakeFirstContext(
							dd.tree.chargedTo,
							dd.rootBlockPointer().GetBlockType()),
						DirectType: dd.rootBlockPointer().DirectType,
					},
					EncodedSize: 0,
				},
				Off: "",
			},
		},
	}

	dd.tree.log.CDebugf(ctx, "Creating new level of indirection for dir %v, "+
		"new block id for old top level is %v", dd.rootBlockPointer(), newID)

	err = dd.tree.cacher(ctx, dd.rootBlockPointer(), dblock)
	if err != nil {
		return nil, err
	}

	return dblock, nil
}

func (dd *dirData) processModifiedBlock(
	ctx context.Context, ptr BlockPointer,
	parentBlocks []parentBlockAndChildIndex, block *DirBlock) (
	unrefs []BlockInfo, err error) {
	newBlocks, newOffset := dd.tree.bsplit.SplitDirIfNeeded(block)

	err = dd.tree.cacher(ctx, ptr, block)
	if err != nil {
		return nil, err
	}

	_, newUnrefs, err := dd.tree.markParentsDirty(ctx, parentBlocks)
	if err != nil {
		return nil, err
	}
	unrefs = append(unrefs, newUnrefs...)

	if len(newBlocks) > 1 {
		dd.tree.log.CDebugf(ctx, "Making new right block for %v",
			dd.rootBlockPointer())

		rightParents, _, err := dd.tree.newRightBlock(
			ctx, parentBlocks, newOffset, FirstValidDataVer,
			NewDirBlockWithPtrs, dd.createIndirectBlock)
		if err != nil {
			return nil, err
		}

		if len(parentBlocks) == 0 {
			// We just created the first level of indirection. In that
			// case `newRightBlock` doesn't cache the old top block,
			// so we should do it here.
			err = dd.tree.cacher(
				ctx, rightParents[0].pblock.(*DirBlock).IPtrs[0].BlockPointer,
				newBlocks[0])
			if err != nil {
				return nil, err
			}
		}

		// Cache the split block in place of the blank one made by
		// `newRightBlock`.
		pb := rightParents[len(rightParents)-1]
		err = dd.tree.cacher(ctx, pb.childBlockPtr(), newBlocks[1])
		if err != nil {
			return nil, err
		}

		// Shift it over if needed.
		topBlock := rightParents[0].pblock
		_, newUnrefs, _, err :=
			dd.tree.shiftBlocksToFillHole(ctx, topBlock, rightParents)
		if err != nil {
			return nil, err
		}
		unrefs = append(unrefs, newUnrefs...)
	}

	return unrefs, nil
}

func (dd *dirData) addEntryHelper(
	ctx context.Context, name string, newDe DirEntry,
	errorIfExists, errorIfNoMatch bool) (
	unrefs []BlockInfo, err error) {
	topBlock, err := dd.getTopBlock(ctx, blockWrite)
	if err != nil {
		return nil, err
	}

	off := StringOffset(name)
	ptr, parentBlocks, block, _, _, _, err := dd.tree.getBlockAtOffset(
		ctx, topBlock, &off, blockWrite)
	if err != nil {
		return nil, err
	}
	dblock := block.(*DirBlock)

	de, exists := dblock.Children[name]
	if errorIfExists && exists {
		return nil, NameExistsError{name}
	} else if errorIfNoMatch &&
		(!exists || de.BlockPointer != newDe.BlockPointer) {
		return nil, NoSuchNameError{name}
	}
	dblock.Children[name] = newDe

	return dd.processModifiedBlock(ctx, ptr, parentBlocks, dblock)
}

func (dd *dirData) addEntry(
	ctx context.Context, newName string, newDe DirEntry) (
	unrefs []BlockInfo, err error) {
	return dd.addEntryHelper(ctx, newName, newDe, true, false)
}

func (dd *dirData) updateEntry(
	ctx context.Context, name string, newDe DirEntry) (
	unrefs []BlockInfo, err error) {
	return dd.addEntryHelper(ctx, name, newDe, false, true)
}

func (dd *dirData) setEntry(
	ctx context.Context, name string, newDe DirEntry) (
	unrefs []BlockInfo, err error) {
	return dd.addEntryHelper(ctx, name, newDe, false, false)
}

func (dd *dirData) removeEntry(ctx context.Context, name string) (
	unrefs []BlockInfo, err error) {
	topBlock, err := dd.getTopBlock(ctx, blockWrite)
	if err != nil {
		return nil, err
	}

	off := StringOffset(name)
	ptr, parentBlocks, block, _, _, _, err := dd.tree.getBlockAtOffset(
		ctx, topBlock, &off, blockWrite)
	if err != nil {
		return nil, err
	}
	dblock := block.(*DirBlock)

	if _, exists := dblock.Children[name]; !exists {
		// Nothing to do.
		return nil, nil
	}
	delete(dblock.Children, name)

	// For now, just leave the block empty, at its current place in
	// the tree.  TODO: remove empty blocks all the way up the tree
	// and shift parent pointers around as needed.
	return dd.processModifiedBlock(ctx, ptr, parentBlocks, dblock)
}

// ready, if given an indirect top-block, readies all the dirty child
// blocks, and updates their block IDs in their parent block's list of
// indirect pointers.  It returns a map pointing from the new block
// info from any readied block to its corresponding old block pointer.
func (dd *dirData) ready(ctx context.Context, id tlf.ID, bcache BlockCache,
	dirtyBcache isDirtyProvider, bops BlockOps, bps blockPutState,
	topBlock *DirBlock) (map[BlockInfo]BlockPointer, error) {
	return dd.tree.ready(
		ctx, id, bcache, dirtyBcache, bops, bps, topBlock, nil)
}

// getDirtyChildPtrs returns a set of dirty child pointers (not the
// root pointer) for the directory.
func (dd *dirData) getDirtyChildPtrs(
	ctx context.Context, dirtyBcache isDirtyProvider) (
	ptrs map[BlockPointer]bool, err error) {
	topBlock, err := dd.getTopBlock(ctx, blockRead)
	if err != nil {
		return nil, err
	}

	if !topBlock.IsIndirect() {
		return nil, nil
	}

	ptrs = make(map[BlockPointer]bool)

	// Gather all the paths to all dirty leaf blocks first.
	off := topBlock.FirstOffset()
	for off != nil {
		_, parentBlocks, block, nextBlockOff, _, err :=
			dd.tree.getNextDirtyBlockAtOffset(
				ctx, topBlock, off, blockWrite, dirtyBcache)
		if err != nil {
			return nil, err
		}

		if block == nil {
			// No more dirty blocks.
			break
		}
		off = nextBlockOff // Will be `nil` if there are no more blocks.

		for _, pb := range parentBlocks {
			ptrs[pb.childBlockPtr()] = true
		}
	}
	return ptrs, nil
}

func (dd *dirData) getIndirectDirBlockInfos(ctx context.Context) (
	[]BlockInfo, error) {
	return dd.tree.getIndirectBlockInfos(ctx)
}
