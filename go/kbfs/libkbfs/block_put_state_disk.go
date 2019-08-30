// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkey"
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
	kmd       libkey.KeyMetadata
	isDir     map[data.BlockPointer]bool
}

var _ blockPutState = (*blockPutStateDisk)(nil)

func newBlockPutStateDisk(
	length int, config blockPutStateDiskConfig,
	diskCache *DiskBlockCacheLocal, kmd libkey.KeyMetadata) *blockPutStateDisk {
	return &blockPutStateDisk{
		blockPutStateMemory: newBlockPutStateMemory(length),
		config:              config,
		diskCache:           diskCache,
		kmd:                 kmd,
		isDir:               make(map[data.BlockPointer]bool),
	}
}

// AddNewBlock implements the blockPutState interface for blockPutStateDisk.
func (bps *blockPutStateDisk) AddNewBlock(
	ctx context.Context, blockPtr data.BlockPointer, block data.Block,
	readyBlockData data.ReadyBlockData, syncedCb func() error) error {
	// Add the pointer and the cb to the memory-based put state, and
	// put the ready data directly into the disk cache.
	err := bps.diskCache.Put(
		ctx, bps.kmd.TlfID(), blockPtr.ID, readyBlockData.Buf,
		readyBlockData.ServerHalf)
	if err != nil {
		return err
	}

	if _, isDir := block.(*data.DirBlock); isDir {
		bps.isDir[blockPtr] = true
	}

	return bps.blockPutStateMemory.AddNewBlock(
		ctx, blockPtr, nil, data.ReadyBlockData{}, syncedCb)
}

func (bps *blockPutStateDisk) GetBlock(
	ctx context.Context, blockPtr data.BlockPointer) (data.Block, error) {
	blockData, serverHalf, _, err := bps.diskCache.Get(
		ctx, bps.kmd.TlfID(), blockPtr.ID)
	if err != nil {
		return nil, err
	}

	var block data.Block
	if bps.isDir[blockPtr] {
		block = data.NewDirBlock()
	} else {
		block = data.NewFileBlock()
	}
	err = assembleBlock(
		ctx, bps.config.keyGetter(), bps.config.Codec(),
		bps.config.cryptoPure(), bps.kmd, blockPtr, block, blockData,
		serverHalf)
	if err != nil {
		return nil, err
	}
	return block, nil
}

func (bps *blockPutStateDisk) getReadyBlockData(
	ctx context.Context, blockPtr data.BlockPointer) (data.ReadyBlockData, error) {
	blockData, serverHalf, _, err := bps.diskCache.Get(
		ctx, bps.kmd.TlfID(), blockPtr.ID)
	if err != nil {
		return data.ReadyBlockData{}, err
	}
	return data.ReadyBlockData{
		Buf:        blockData,
		ServerHalf: serverHalf,
	}, nil
}
