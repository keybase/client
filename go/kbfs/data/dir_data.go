// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// dirBlockGetter is a function that gets a block suitable for
// reading or writing, and also returns whether the block was already
// dirty.  It may be called from new goroutines, and must handle any
// required locks accordingly.
type dirBlockGetter func(context.Context, libkey.KeyMetadata, BlockPointer,
	Path, BlockReqType) (dblock *DirBlock, wasDirty bool, err error)

// DirData is a helper struct for accessing and manipulating data
// within a directory.  It's meant for use within a single scope, not
// for long-term storage.  The caller must ensure goroutine-safety.
type DirData struct {
	getter dirBlockGetter
	tree   *blockTree
}

// NewDirData creates a new DirData instance.
func NewDirData(
	dir Path, chargedTo keybase1.UserOrTeamID, bsplit BlockSplitter,
	kmd libkey.KeyMetadata, getter dirBlockGetter, cacher dirtyBlockCacher,
	log logger.Logger, vlog *libkb.VDebugLog) *DirData {
	dd := &DirData{
		getter: getter,
	}
	dd.tree = &blockTree{
		file:      dir,
		chargedTo: chargedTo,
		kmd:       kmd,
		bsplit:    bsplit,
		getter:    dd.blockGetter,
		cacher:    cacher,
		log:       log,
		vlog:      vlog,
	}
	return dd
}

func (dd *DirData) rootBlockPointer() BlockPointer {
	return dd.tree.file.TailPointer()
}

func (dd *DirData) blockGetter(
	ctx context.Context, kmd libkey.KeyMetadata, ptr BlockPointer,
	dir Path, rtype BlockReqType) (
	block BlockWithPtrs, wasDirty bool, err error) {
	return dd.getter(ctx, kmd, ptr, dir, rtype)
}

var hiddenEntries = map[string]bool{
	".kbfs_git":           true,
	".kbfs_autogit":       true,
	".kbfs_deleted_repos": true,
}

// GetTopBlock returns the top-most block in this directory block tree.
func (dd *DirData) GetTopBlock(ctx context.Context, rtype BlockReqType) (
	*DirBlock, error) {
	topBlock, _, err := dd.getter(
		ctx, dd.tree.kmd, dd.rootBlockPointer(), dd.tree.file, rtype)
	if err != nil {
		return nil, err
	}
	return topBlock, nil
}

func (dd *DirData) obfuscator() Obfuscator {
	return dd.tree.file.Obfuscator()
}

// GetChildren returns a map of all the child EntryInfos in this
// directory.
func (dd *DirData) GetChildren(ctx context.Context) (
	children map[PathPartString]EntryInfo, err error) {
	topBlock, err := dd.GetTopBlock(ctx, BlockRead)
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
	children = make(map[PathPartString]EntryInfo, numEntries)
	for _, b := range blocks {
		for k, de := range b.(*DirBlock).Children {
			if hiddenEntries[k] {
				continue
			}
			children[NewPathPartString(k, dd.obfuscator())] = de.EntryInfo
		}
	}
	return children, nil
}

// GetEntries returns a map of all the child DirEntrys in this
// directory.
func (dd *DirData) GetEntries(ctx context.Context) (
	children map[PathPartString]DirEntry, err error) {
	topBlock, err := dd.GetTopBlock(ctx, BlockRead)
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
	children = make(map[PathPartString]DirEntry, numEntries)
	for _, b := range blocks {
		for k, de := range b.(*DirBlock).Children {
			children[NewPathPartString(k, dd.obfuscator())] = de
		}
	}
	return children, nil
}

// Lookup returns the DirEntry for the given entry named by `name` in
// this directory.
func (dd *DirData) Lookup(ctx context.Context, name PathPartString) (
	DirEntry, error) {
	topBlock, err := dd.GetTopBlock(ctx, BlockRead)
	if err != nil {
		return DirEntry{}, err
	}

	namePlain := name.Plaintext()
	off := StringOffset(namePlain)
	_, _, block, _, _, _, err := dd.tree.getBlockAtOffset(
		ctx, topBlock, &off, BlockLookup)
	if err != nil {
		return DirEntry{}, err
	}

	de, ok := block.(*DirBlock).Children[namePlain]
	if !ok {
		return DirEntry{}, idutil.NoSuchNameError{Name: name.String()}
	}
	return de, nil
}

// createIndirectBlock creates a new indirect block and pick a new id
// for the existing block, and use the existing block's ID for the new
// indirect block that becomes the parent.
func (dd *DirData) createIndirectBlock(ctx context.Context, dver Ver) (
	BlockWithPtrs, error) {
	newID, err := kbfsblock.MakeTemporaryID()
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

	dd.tree.vlog.CLogf(
		ctx, libkb.VLog1, "Creating new level of indirection for dir %v, "+
			"new block id for old top level is %v",
		dd.rootBlockPointer(), newID)

	err = dd.tree.cacher(ctx, dd.rootBlockPointer(), dblock)
	if err != nil {
		return nil, err
	}

	return dblock, nil
}

func (dd *DirData) processModifiedBlock(
	ctx context.Context, ptr BlockPointer,
	parentBlocks []ParentBlockAndChildIndex, block *DirBlock) (
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
		dd.tree.vlog.CLogf(
			ctx, libkb.VLog1, "Making new right block for %v",
			dd.rootBlockPointer())

		rightParents, _, err := dd.tree.newRightBlock(
			ctx, parentBlocks, newOffset, FirstValidVer,
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
		_, newUnrefs, _, err := dd.tree.shiftBlocksToFillHole(ctx, rightParents)
		if err != nil {
			return nil, err
		}
		unrefs = append(unrefs, newUnrefs...)
	}

	return unrefs, nil
}

func (dd *DirData) addEntryHelper(
	ctx context.Context, name PathPartString, newDe DirEntry,
	errorIfExists, errorIfNoMatch bool) (
	unrefs []BlockInfo, err error) {
	topBlock, err := dd.GetTopBlock(ctx, BlockWrite)
	if err != nil {
		return nil, err
	}

	namePlain := name.Plaintext()
	off := StringOffset(namePlain)
	ptr, parentBlocks, block, _, _, _, err := dd.tree.getBlockAtOffset(
		ctx, topBlock, &off, BlockWrite)
	if err != nil {
		return nil, err
	}
	dblock := block.(*DirBlock)

	de, exists := dblock.Children[namePlain]
	if errorIfExists && exists {
		return nil, NameExistsError{name.String()}
	} else if errorIfNoMatch &&
		(!exists || de.BlockPointer != newDe.BlockPointer) {
		return nil, idutil.NoSuchNameError{Name: name.String()}
	}
	dblock.Children[namePlain] = newDe

	return dd.processModifiedBlock(ctx, ptr, parentBlocks, dblock)
}

// AddEntry adds a new entry to this directory.
func (dd *DirData) AddEntry(
	ctx context.Context, newName PathPartString, newDe DirEntry) (
	unrefs []BlockInfo, err error) {
	return dd.addEntryHelper(ctx, newName, newDe, true, false)
}

// UpdateEntry updates an existing entry to this directory.
func (dd *DirData) UpdateEntry(
	ctx context.Context, name PathPartString, newDe DirEntry) (
	unrefs []BlockInfo, err error) {
	return dd.addEntryHelper(ctx, name, newDe, false, true)
}

// SetEntry set an entry to this directory, whether it is new or existing.
func (dd *DirData) SetEntry(
	ctx context.Context, name PathPartString, newDe DirEntry) (
	unrefs []BlockInfo, err error) {
	return dd.addEntryHelper(ctx, name, newDe, false, false)
}

// RemoveEntry removes an entry from this directory.
func (dd *DirData) RemoveEntry(ctx context.Context, name PathPartString) (
	unrefs []BlockInfo, err error) {
	topBlock, err := dd.GetTopBlock(ctx, BlockWrite)
	if err != nil {
		return nil, err
	}

	namePlain := name.Plaintext()
	off := StringOffset(namePlain)
	ptr, parentBlocks, block, _, _, _, err := dd.tree.getBlockAtOffset(
		ctx, topBlock, &off, BlockWrite)
	if err != nil {
		return nil, err
	}
	dblock := block.(*DirBlock)

	if _, exists := dblock.Children[namePlain]; !exists {
		// Nothing to do.
		return nil, nil
	}
	delete(dblock.Children, namePlain)

	// For now, just leave the block empty, at its current place in
	// the tree.  TODO: remove empty blocks all the way up the tree
	// and shift parent pointers around as needed.
	return dd.processModifiedBlock(ctx, ptr, parentBlocks, dblock)
}

// Ready readies all the dirty child blocks for a directory tree with
// an indirect top-block, and updates their block IDs in their parent
// block's list of indirect pointers.  It returns a map pointing from
// the new block info from any readied block to its corresponding old
// block pointer.
func (dd *DirData) Ready(ctx context.Context, id tlf.ID,
	bcache BlockCache, dirtyBcache IsDirtyProvider,
	rp ReadyProvider, bps BlockPutState,
	topBlock *DirBlock) (map[BlockInfo]BlockPointer, error) {
	return dd.tree.ready(
		ctx, id, bcache, dirtyBcache, rp, bps, topBlock, nil)
}

// GetDirtyChildPtrs returns a set of dirty child pointers (not the
// root pointer) for the directory.
func (dd *DirData) GetDirtyChildPtrs(
	ctx context.Context, dirtyBcache IsDirtyProvider) (
	ptrs map[BlockPointer]bool, err error) {
	topBlock, err := dd.GetTopBlock(ctx, BlockRead)
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
				ctx, topBlock, off, BlockWrite, dirtyBcache)
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

// GetIndirectDirBlockInfos returns all of the BlockInfos for blocks
// pointed to by indirect blocks within this directory tree.
func (dd *DirData) GetIndirectDirBlockInfos(ctx context.Context) (
	[]BlockInfo, error) {
	return dd.tree.getIndirectBlockInfos(ctx)
}
