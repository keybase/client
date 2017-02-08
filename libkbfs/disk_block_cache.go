package libkbfs

import (
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
)

// DiskBlockCacheStandard is the standard implementation for DiskBlockCache.
type DiskBlockCacheStandard struct {
}

var _ DiskBlockCache = (*DiskBlockCacheStandard)(nil)

// Get implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Get(tlfID tlf.ID, blockID kbfsblock.ID) (
	Block, error) {
	return nil, NoSuchBlockError{blockID}
}

// Put implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Put(tlfID tlf.ID, blockID kbfsblock.ID,
	block Block) error {
	return nil
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Delete(tlfID tlf.ID, blockID kbfsblock.ID,
) error {
	return nil
}
