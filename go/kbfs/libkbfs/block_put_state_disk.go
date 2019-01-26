// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
)

type blockPutStateDiskConfig interface {
	codecGetter
	cryptoPureGetter
	keyGetterGetter
}

// blockPutStateDisk tracks block info while making a revision, by
// using a disk-based block cache.
type blockPutStateDisk struct {
	*blockPutStateMemory // won't store actual block data

	config    blockPutStateDiskConfig
	diskCache *DiskBlockCacheLocal
	kmd       KeyMetadata
	isDir     map[BlockPointer]bool
}

var _ blockPutState = (*blockPutStateDisk)(nil)

func newBlockPutStateDisk(
	length int, config blockPutStateDiskConfig,
	diskCache *DiskBlockCacheLocal, kmd KeyMetadata) *blockPutStateDisk {
	return &blockPutStateDisk{
		blockPutStateMemory: newBlockPutStateMemory(length),
		config:              config,
		diskCache:           diskCache,
		kmd:                 kmd,
		isDir:               make(map[BlockPointer]bool),
	}
}

// addNewBlock implements the blockPutState interface for blockPutStateDisk.
func (bps *blockPutStateDisk) addNewBlock(
	ctx context.Context, blockPtr BlockPointer, block Block,
	readyBlockData ReadyBlockData, syncedCb func() error) error {
	// Add the pointer and the cb to the memory-based put state, and
	// put the ready data directly into the disk cache.
	err := bps.diskCache.Put(
		ctx, bps.kmd.TlfID(), blockPtr.ID, readyBlockData.buf,
		readyBlockData.serverHalf)
	if err != nil {
		return err
	}

	if _, isDir := block.(*DirBlock); isDir {
		bps.isDir[blockPtr] = true
	}

	return bps.blockPutStateMemory.addNewBlock(
		ctx, blockPtr, nil, ReadyBlockData{}, syncedCb)
}

func (bps *blockPutStateDisk) mergeOtherBps(
	_ context.Context, other blockPutState) error {
	panic("unimplemented")
}

func (bps *blockPutStateDisk) removeOtherBps(
	ctx context.Context, other blockPutState) error {
	panic("unimplemented")
}

func (bps *blockPutStateDisk) getBlock(
	ctx context.Context, blockPtr BlockPointer) (Block, error) {
	data, serverHalf, _, err := bps.diskCache.Get(
		ctx, bps.kmd.TlfID(), blockPtr.ID)
	if err != nil {
		return nil, err
	}

	var block Block
	if bps.isDir[blockPtr] {
		block = NewDirBlock()
	} else {
		block = NewFileBlock()
	}
	err = assembleBlock(
		ctx, bps.config.keyGetter(), bps.config.Codec(),
		bps.config.cryptoPure(), bps.kmd, blockPtr, block, data, serverHalf)
	if err != nil {
		return nil, err
	}
	return block, nil
}

func (bps *blockPutStateDisk) getReadyBlockData(
	ctx context.Context, blockPtr BlockPointer) (ReadyBlockData, error) {
	data, serverHalf, _, err := bps.diskCache.Get(
		ctx, bps.kmd.TlfID(), blockPtr.ID)
	if err != nil {
		return ReadyBlockData{}, err
	}
	return ReadyBlockData{
		buf:        data,
		serverHalf: serverHalf,
	}, nil
}

func (bps *blockPutStateDisk) deepCopy(
	_ context.Context) (blockPutState, error) {
	panic("unimplemented")
}

func (bps *blockPutStateDisk) deepCopyWithBlacklist(
	_ context.Context, blacklist map[BlockPointer]bool) (blockPutState, error) {
	panic("unimplemented")
}
