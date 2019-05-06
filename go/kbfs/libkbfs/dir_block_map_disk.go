// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/pkg/errors"
)

// dirBlockMapDisk tracks dir block info while making a revision, by
// using a disk-based block cache.
type dirBlockMapDisk struct {
	dirtyBcache *DirtyBlockCacheDisk
	kmd         libkey.KeyMetadata
	ptrs        map[data.BlockPointer]bool
}

var _ dirBlockMap = (*dirBlockMapDisk)(nil)

func newDirBlockMapDisk(
	dirtyBcache *DirtyBlockCacheDisk, kmd libkey.KeyMetadata) *dirBlockMapDisk {
	return &dirBlockMapDisk{
		dirtyBcache: dirtyBcache,
		kmd:         kmd,
		ptrs:        make(map[data.BlockPointer]bool),
	}
}

func (dbmd *dirBlockMapDisk) putBlock(
	ctx context.Context, ptr data.BlockPointer, block *data.DirBlock) error {
	err := dbmd.dirtyBcache.Put(
		ctx, dbmd.kmd.TlfID(), ptr, data.MasterBranch, block)
	if err != nil {
		return err
	}

	dbmd.ptrs[ptr] = true
	return nil
}

func (dbmd *dirBlockMapDisk) getBlock(
	ctx context.Context, ptr data.BlockPointer) (*data.DirBlock, error) {
	if !dbmd.ptrs[ptr] {
		return nil, errors.Errorf("No such block %s", ptr)
	}
	block, err := dbmd.dirtyBcache.Get(ctx, dbmd.kmd.TlfID(), ptr, data.MasterBranch)
	if err != nil {
		return nil, err
	}
	dblock, ok := block.(*data.DirBlock)
	if !ok {
		return nil, errors.Errorf(
			"Unexpected block type for dir block: %T", block)
	}
	return dblock, nil
}

func (dbmd *dirBlockMapDisk) hasBlock(
	_ context.Context, ptr data.BlockPointer) (bool, error) {
	return dbmd.ptrs[ptr], nil
}

func (dbmd *dirBlockMapDisk) deleteBlock(
	_ context.Context, ptr data.BlockPointer) error {
	delete(dbmd.ptrs, ptr)
	return nil
}

// numBlocks only tracks the blocks that have been put into the dirty
// block cache since `dbdm` was constructed.
func (dbmd *dirBlockMapDisk) numBlocks() int {
	return len(dbmd.ptrs)
}
