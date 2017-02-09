package libkbfs

import (
	"path/filepath"
	"sync"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"github.com/syndtr/goleveldb/leveldb"
)

const (
	evictionConsiderationFactor uint   = 3
	blockDbFilename             string = "diskCacheBlocks.leveldb"
	lruDbFilename               string = "diskCacheLRU.leveldb"
)

// DiskBlockCacheStandard is the standard implementation for DiskBlockCache.
type DiskBlockCacheStandard struct {
	maxBytes uint64
	// protects everything below
	lock     sync.RWMutex
	isClosed bool
	blockDb  *leveldb.DB
	lruDb    *leveldb.DB
}

var _ DiskBlockCache = (*DiskBlockCacheStandard)(nil)

func newDiskBlockCacheStandard(dirPath string, maxBytes uint64) (
	*DiskBlockCacheStandard, error) {
	blockDbPath := filepath.Join(dirPath, blockDbFilename)
	blockDb, err := leveldb.OpenFile(blockDbPath, leveldbOptions)
	if err != nil {
		return nil, err
	}

	lruDbPath := filepath.Join(dirPath, lruDbFilename)
	lruDb, err := leveldb.OpenFile(lruDbPath, leveldbOptions)
	if err != nil {
		blockDb.Close()
		return nil, err
	}
	return &DiskBlockCacheStandard{
		blockDb:  blockDb,
		lruDb:    lruDb,
		maxBytes: maxBytes,
	}, nil
}

// Get implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Get(tlfID tlf.ID, blockID kbfsblock.ID) (
	Block, error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return nil, DiskCacheClosedError{"Get"}
	}
	return nil, NoSuchBlockError{blockID}
}

// Put implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Put(tlfID tlf.ID, blockID kbfsblock.ID,
	block Block) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return DiskCacheClosedError{"Put"}
	}
	return nil
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Delete(tlfID tlf.ID, blockID kbfsblock.ID,
) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return DiskCacheClosedError{"Delete"}
	}
	return nil
}

// Evict implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Evict(tlfID tlf.ID, numBlocks int) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return DiskCacheClosedError{"Evict"}
	}
	return nil
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Shutdown() {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	if cache.isClosed {
		return
	}
	cache.isClosed = true
	cache.blockDb.Close()
	cache.lruDb.Close()
}
