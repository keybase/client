// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"sync"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/pkg/errors"
)

type dirtyBlockCacheDiskConfig interface {
	codecGetter
	cryptoPureGetter
	keyGetterGetter
	blockOpsGetter
}

type dirtyBlockCacheDiskInfo struct {
	tmpPtr data.BlockPointer
	isDir  bool
}

func (dbcdi dirtyBlockCacheDiskInfo) newBlock() data.Block {
	if dbcdi.isDir {
		return data.NewDirBlock()
	}
	return data.NewFileBlock()
}

// DirtyBlockCacheDisk stores dirty blocks in a local disk block
// cache, rather than keeping them in memory.
type DirtyBlockCacheDisk struct {
	config    dirtyBlockCacheDiskConfig
	diskCache *DiskBlockCacheLocal
	kmd       libkey.KeyMetadata
	branch    data.BranchName

	lock   sync.RWMutex
	blocks map[data.BlockPointer]dirtyBlockCacheDiskInfo
}

var _ data.DirtyBlockCacheSimple = (*DirtyBlockCacheDisk)(nil)

func newDirtyBlockCacheDisk(
	config dirtyBlockCacheDiskConfig,
	diskCache *DiskBlockCacheLocal, kmd libkey.KeyMetadata,
	branch data.BranchName) *DirtyBlockCacheDisk {
	return &DirtyBlockCacheDisk{
		config:    config,
		diskCache: diskCache,
		kmd:       kmd,
		branch:    branch,
		blocks:    make(map[data.BlockPointer]dirtyBlockCacheDiskInfo),
	}
}

func (d *DirtyBlockCacheDisk) getInfo(ptr data.BlockPointer) (
	dirtyBlockCacheDiskInfo, bool) {
	d.lock.RLock()
	defer d.lock.RUnlock()
	info, ok := d.blocks[ptr]
	return info, ok
}

func (d *DirtyBlockCacheDisk) saveInfo(
	ptr data.BlockPointer, info dirtyBlockCacheDiskInfo) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.blocks[ptr] = info
}

// Get implements the DirtyBlockCache interface for
// DirtyBlockCacheDisk.
func (d *DirtyBlockCacheDisk) Get(
	ctx context.Context, tlfID tlf.ID, ptr data.BlockPointer, branch data.BranchName) (
	data.Block, error) {
	if branch != d.branch {
		return nil, errors.Errorf(
			"Branch %s doesn't match branch %s", branch, d.branch)
	}

	info, ok := d.getInfo(ptr)
	if !ok {
		return nil, data.NoSuchBlockError{ID: ptr.ID}
	}

	// Look it up under the temp ID, which is an actual hash that can
	// be verified.
	data, serverHalf, _, err := d.diskCache.Get(ctx, tlfID, info.tmpPtr.ID)
	if err != nil {
		return nil, err
	}

	block := info.newBlock()
	err = assembleBlock(
		ctx, d.config.keyGetter(), d.config.Codec(),
		d.config.cryptoPure(), d.kmd, info.tmpPtr, block, data, serverHalf)
	if err != nil {
		return nil, err
	}
	return block, nil
}

// Put implements the DirtyBlockCache interface for
// DirtyBlockCacheDisk.  Note than any modifications made to `block`
// after the `Put` will require another `Put` call, in order for them
// to be reflected in the next `Get` call for that block pointer.
func (d *DirtyBlockCacheDisk) Put(
	ctx context.Context, tlfID tlf.ID, ptr data.BlockPointer,
	branch data.BranchName, block data.Block) error {
	if branch != d.branch {
		return errors.Errorf(
			"Branch %s doesn't match branch %s", branch, d.branch)
	}

	// Need to ready the block, since the disk cache expects encrypted
	// data and a block ID that can be verified against that data.
	id, _, readyBlockData, err := d.config.BlockOps().Ready(ctx, d.kmd, block)
	if err != nil {
		return err
	}

	err = d.diskCache.Put(
		ctx, tlfID, id, readyBlockData.Buf, readyBlockData.ServerHalf)
	if err != nil {
		return err
	}

	directType := data.DirectBlock
	if block.IsIndirect() {
		directType = data.IndirectBlock
	}
	_, isDir := block.(*data.DirBlock)

	info := dirtyBlockCacheDiskInfo{
		tmpPtr: data.BlockPointer{
			ID:         id,
			KeyGen:     d.kmd.LatestKeyGeneration(),
			DataVer:    block.DataVersion(),
			DirectType: directType,
		},
		isDir: isDir,
	}
	d.saveInfo(ptr, info)

	// TODO: have an in-memory LRU cache of limited size to optimize
	// frequent block access?
	return nil
}
