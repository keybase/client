package libkbfs

import (
	"errors"

	kbgitkbfs "github.com/keybase/kbfs/protocol/kbgitkbfs"
	"golang.org/x/net/context"
)

type diskBlockCacheServiceConfig interface {
	diskBlockCacheGetter
}

type DiskBlockCacheService struct {
	config diskBlockCacheServiceConfig
}

var _ kbgitkbfs.DiskBlockCacheInterface = (*DiskBlockCacheService)(nil)

func NewDiskBlockCacheService(config diskBlockCacheServiceConfig) *DiskBlockCacheService {
	return &DiskBlockCacheService{
		config: config,
	}
}

// GetBlock implements the DiskBlockCacheInterface interface for
// DiskBlockCacheService.
func (cache *DiskBlockCacheService) GetBlock(ctx context.Context,
	arg kbgitkbfs.GetBlockArg) (kbgitkbfs.GetBlockRes, error) {
	return kbgitkbfs.GetBlockRes{}, errors.New("not implemented")
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
