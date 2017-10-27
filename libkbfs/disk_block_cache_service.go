// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	kbgitkbfs "github.com/keybase/kbfs/protocol/kbgitkbfs"
	"github.com/keybase/kbfs/tlf"
)

type diskBlockCacheServiceConfig interface {
	diskBlockCacheGetter
}

// DiskBlockCacheService delegates requests for blocks to this KBFS
// instance's disk cache.
type DiskBlockCacheService struct {
	config diskBlockCacheServiceConfig
}

var _ kbgitkbfs.DiskBlockCacheInterface = (*DiskBlockCacheService)(nil)

// NewDiskBlockCacheService creates a new DiskBlockCacheService.
func NewDiskBlockCacheService(config diskBlockCacheServiceConfig) *DiskBlockCacheService {
	return &DiskBlockCacheService{
		config: config,
	}
}

// GetBlock implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) GetBlock(ctx context.Context,
	arg kbgitkbfs.GetBlockArg) (kbgitkbfs.GetBlockRes, error) {
	dbc := cache.config.DiskBlockCache()
	if dbc == nil {
		return kbgitkbfs.GetBlockRes{},
			DiskBlockCacheError{"Disk cache is nil"}
	}
	tlfID, err := tlf.ParseID(arg.TlfID.String())
	if err != nil {
		return kbgitkbfs.GetBlockRes{}, newDiskBlockCacheError(err)
	}
	blockID, err := kbfsblock.IDFromString(arg.BlockID)
	if err != nil {
		return kbgitkbfs.GetBlockRes{}, newDiskBlockCacheError(err)
	}
	buf, serverHalf, prefetchStatus, err := dbc.Get(ctx, tlfID, blockID)
	if err != nil {
		return kbgitkbfs.GetBlockRes{}, newDiskBlockCacheError(err)
	}
	protocolPrefetchStatus := prefetchStatus.ToProtocol()

	return kbgitkbfs.GetBlockRes{
		buf, serverHalf.String(), protocolPrefetchStatus,
	}, nil
}

// PutBlock implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) PutBlock(ctx context.Context,
	arg kbgitkbfs.PutBlockArg) error {
	dbc := cache.config.DiskBlockCache()
	if dbc == nil {
		return DiskBlockCacheError{"Disk cache is nil"}
	}
	tlfID, err := tlf.ParseID(arg.TlfID.String())
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	blockID, err := kbfsblock.IDFromString(arg.BlockID)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	serverHalf, err := kbfscrypto.ParseBlockCryptKeyServerHalf(arg.ServerHalf)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	err = dbc.Put(ctx, tlfID, blockID, arg.Buf, serverHalf)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	return nil
}

// DeleteBlocks implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) DeleteBlocks(ctx context.Context,
	blockIDs []string) (kbgitkbfs.DeleteBlocksRes, error) {
	dbc := cache.config.DiskBlockCache()
	if dbc == nil {
		return kbgitkbfs.DeleteBlocksRes{},
			DiskBlockCacheError{"Disk cache is nil"}
	}
	blocks := make([]kbfsblock.ID, 0, len(blockIDs))
	for _, b := range blockIDs {
		blockID, err := kbfsblock.IDFromString(b)
		if err != nil {
			return kbgitkbfs.DeleteBlocksRes{}, newDiskBlockCacheError(err)
		}
		blocks = append(blocks, blockID)
	}
	numRemoved, sizeRemoved, err := dbc.Delete(ctx, blocks)
	if err != nil {
		return kbgitkbfs.DeleteBlocksRes{}, newDiskBlockCacheError(err)
	}
	return kbgitkbfs.DeleteBlocksRes{numRemoved, sizeRemoved}, nil
}

// UpdateBlockMetadata implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) UpdateBlockMetadata(ctx context.Context,
	arg kbgitkbfs.UpdateBlockMetadataArg) error {
	dbc := cache.config.DiskBlockCache()
	if dbc == nil {
		return DiskBlockCacheError{"Disk cache is nil"}
	}
	blockID, err := kbfsblock.IDFromString(arg.BlockID)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	err = dbc.UpdateMetadata(ctx, blockID, PrefetchStatus(arg.PrefetchStatus))
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	return nil
}
