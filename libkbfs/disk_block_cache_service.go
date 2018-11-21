// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	kbgitkbfs "github.com/keybase/kbfs/protocol/kbgitkbfs1"
	"github.com/keybase/kbfs/tlf"
)

type diskBlockCacheServiceConfig interface {
	diskBlockCacheGetter
	syncedTlfGetterSetter
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
	// TODO: make sure this isn't remote.
	dbc := cache.config.DiskBlockCache()
	if dbc == nil {
		return kbgitkbfs.GetBlockRes{},
			DiskBlockCacheError{"Disk cache is nil"}
	}
	tlfID := tlf.ID{}
	err := tlfID.UnmarshalBinary(arg.TlfID)
	if err != nil {
		return kbgitkbfs.GetBlockRes{}, newDiskBlockCacheError(err)
	}
	blockID := kbfsblock.ID{}
	err = blockID.UnmarshalBinary(arg.BlockID)
	if err != nil {
		return kbgitkbfs.GetBlockRes{}, newDiskBlockCacheError(err)
	}
	buf, serverHalf, prefetchStatus, err := dbc.Get(
		ctx, tlfID, blockID, DiskBlockAnyCache)
	if err != nil {
		return kbgitkbfs.GetBlockRes{}, newDiskBlockCacheError(err)
	}
	protocolPrefetchStatus := prefetchStatus.ToProtocol()

	return kbgitkbfs.GetBlockRes{
		Buf:            buf,
		ServerHalf:     serverHalf.Bytes(),
		PrefetchStatus: protocolPrefetchStatus,
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
	tlfID := tlf.ID{}
	err := tlfID.UnmarshalBinary(arg.TlfID)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	blockID := kbfsblock.ID{}
	err = blockID.UnmarshalBinary(arg.BlockID)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	serverHalf := kbfscrypto.BlockCryptKeyServerHalf{}
	err = serverHalf.UnmarshalBinary(arg.ServerHalf)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	cacheType := DiskBlockAnyCache
	if cache.config.IsSyncedTlf(tlfID) {
		cacheType = DiskBlockSyncCache
	}
	err = dbc.Put(ctx, tlfID, blockID, arg.Buf, serverHalf, cacheType)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	return nil
}

// DeleteBlocks implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) DeleteBlocks(ctx context.Context,
	blockIDs [][]byte) (kbgitkbfs.DeleteBlocksRes, error) {
	dbc := cache.config.DiskBlockCache()
	if dbc == nil {
		return kbgitkbfs.DeleteBlocksRes{},
			DiskBlockCacheError{"Disk cache is nil"}
	}
	blocks := make([]kbfsblock.ID, 0, len(blockIDs))
	for _, b := range blockIDs {
		blockID := kbfsblock.ID{}
		err := blockID.UnmarshalBinary(b)
		if err != nil {
			return kbgitkbfs.DeleteBlocksRes{}, newDiskBlockCacheError(err)
		}
		blocks = append(blocks, blockID)
	}
	numRemoved, sizeRemoved, err := dbc.Delete(ctx, blocks)
	if err != nil {
		return kbgitkbfs.DeleteBlocksRes{}, newDiskBlockCacheError(err)
	}
	return kbgitkbfs.DeleteBlocksRes{
		NumRemoved:  numRemoved,
		SizeRemoved: sizeRemoved,
	}, nil
}

// UpdateBlockMetadata implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) UpdateBlockMetadata(ctx context.Context,
	arg kbgitkbfs.UpdateBlockMetadataArg) error {
	dbc := cache.config.DiskBlockCache()
	if dbc == nil {
		return DiskBlockCacheError{"Disk cache is nil"}
	}
	blockID := kbfsblock.ID{}
	err := blockID.UnmarshalBinary(arg.BlockID)
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	err = dbc.UpdateMetadata(ctx, blockID, PrefetchStatus(arg.PrefetchStatus))
	if err != nil {
		return newDiskBlockCacheError(err)
	}
	return nil
}
