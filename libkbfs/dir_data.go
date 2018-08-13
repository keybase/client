// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
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
	crypto cryptoPure, kmd KeyMetadata, bsplit BlockSplitter,
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

func (dd *dirData) getChildren(ctx context.Context) (
	children map[string]EntryInfo, err error) {
	topBlock, _, err := dd.getter(
		ctx, dd.tree.kmd, dd.rootBlockPointer(), dd.tree.file, blockRead)
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
			// TODO(KBFS-3302): move `hidden` into this file once
			// `folderBlockOps` uses this function.
			if hiddenEntries[k] {
				continue
			}
			children[k] = de.EntryInfo
		}
	}
	return children, nil
}

func (dd *dirData) lookup(ctx context.Context, name string) (DirEntry, error) {
	topBlock, _, err := dd.getter(
		ctx, dd.tree.kmd, dd.rootBlockPointer(), dd.tree.file, blockRead)
	if err != nil {
		return DirEntry{}, err
	}

	off := StringOffset(name)
	_, _, block, _, _, _, err := dd.tree.getBlockAtOffset(
		ctx, topBlock, &off, blockRead)
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
func (dd *dirData) createIndirectBlock(ctx context.Context) (*DirBlock, error) {
	newID, err := dd.crypto.MakeTemporaryBlockID()
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
						KeyGen:  dd.kmd.LatestKeyGeneration(),
						DataVer: IndirectDirsDataVer,
						Context: kbfsblock.MakeFirstContext(
							dd.chargedTo, dd.rootBlockPointer().GetBlockType()),
						DirectType: dd.rootBlockPointer().DirectType,
					},
					EncodedSize: 0,
				},
				Off: "",
			},
		},
	}

	dd.log.CDebugf(ctx, "Creating new level of indirection for dir %v, "+
		"new block id for old top level is %v", dd.rootBlockPointer(), newID)

	err = dd.cacher(dd.rootBlockPointer(), dblock)
	if err != nil {
		return nil, err
	}

	return dblock, nil
}
