package libkbfs

import (
	"context"
	"errors"

	"github.com/keybase/kbfs/kbfsblock"
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

	return kbgitkbfs.GetBlockRes{
		buf, serverHalf.String(), kbgitkbfs.PrefetchStatus(prefetchStatus),
	}, nil
}

// PutBlock implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) PutBlock(ctx context.Context,
	arg kbgitkbfs.PutBlockArg) error {
	return errors.New("not implemented")
}

// DeleteBlocks implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) DeleteBlocks(ctx context.Context,
	blockIDs []string) (kbgitkbfs.DeleteBlocksRes, error) {
	return kbgitkbfs.DeleteBlocksRes{}, errors.New("not implemented")
}

// UpdateBlockMetadata implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) UpdateBlockMetadata(ctx context.Context,
	arg kbgitkbfs.UpdateBlockMetadataArg) error {
	return errors.New("not implemented")
}
