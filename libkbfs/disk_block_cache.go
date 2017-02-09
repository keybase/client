package libkbfs

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/syndtr/goleveldb/leveldb"
	"golang.org/x/net/context"
)

const (
	evictionConsiderationFactor uint   = 3
	blockDbFilename             string = "diskCacheBlocks.leveldb"
	lruDbFilename               string = "diskCacheLRU.leveldb"
)

type diskBlockCacheEntry struct {
	buf        []byte
	serverHalf kbfscrypto.BlockCryptKeyServerHalf
}

type diskBlockCacheConfig interface {
	codecGetter
}

// DiskBlockCacheStandard is the standard implementation for DiskBlockCache.
type DiskBlockCacheStandard struct {
	config   diskBlockCacheConfig
	maxBytes uint64
	// protects everything below
	lock     sync.RWMutex
	isClosed bool
	blockDb  *leveldb.DB
	lruDb    *leveldb.DB
}

var _ DiskBlockCache = (*DiskBlockCacheStandard)(nil)

func newDiskBlockCacheStandard(config diskBlockCacheConfig, dirPath string,
	maxBytes uint64) (*DiskBlockCacheStandard, error) {
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
		config:   config,
		maxBytes: maxBytes,
		blockDb:  blockDb,
		lruDb:    lruDb,
	}, nil
}

func (cache *DiskBlockCacheStandard) updateLruLocked(tlfID tlf.ID,
	blockBytes []byte) error {
	key := append(tlfID.Bytes(), blockBytes...)
	val, err := time.Now().MarshalBinary()
	if err != nil {
		return err
	}
	cache.lruDb.Put(key, val, nil)
	return nil
}

func (cache *DiskBlockCacheStandard) decodeBlockCacheEntry(buf []byte) ([]byte,
	kbfscrypto.BlockCryptKeyServerHalf, error) {
	entry := diskBlockCacheEntry{}
	err := cache.config.Codec().Decode(buf, &entry)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return entry.buf, entry.serverHalf, nil
}

func (cache *DiskBlockCacheStandard) encodeBlockCacheEntry(buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) ([]byte, error) {
	entry := diskBlockCacheEntry{
		buf:        buf,
		serverHalf: serverHalf,
	}
	return cache.config.Codec().Encode(&entry)
}

// Get implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Get(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID) ([]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			DiskCacheClosedError{"Get"}
	}
	var entry []byte
	err := runUnlessCanceled(ctx, func() error {
		blockBytes := blockID.Bytes()
		buf, err := cache.blockDb.Get(blockBytes, nil)
		if err != nil {
			return NoSuchBlockError{blockID}
		}
		err = cache.updateLruLocked(tlfID, blockBytes)
		if err != nil {
			return err
		}
		entry = buf
		return nil
	})
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	if entry == nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoSuchBlockError{blockID}
	}
	return cache.decodeBlockCacheEntry(entry)
}

// Put implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return DiskCacheClosedError{"Put"}
	}
	entry, err := cache.encodeBlockCacheEntry(buf, serverHalf)
	blockBytes := blockID.Bytes()
	err = cache.blockDb.Put(blockBytes, entry, nil)
	if err != nil {
		return err
	}
	return cache.updateLruLocked(tlfID, blockBytes)
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Delete(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return DiskCacheClosedError{"Delete"}
	}
	blockBytes := blockID.Bytes()
	err := cache.blockDb.Delete(blockBytes, nil)
	if err != nil {
		return err
	}
	lruKey := append(tlfID.Bytes(), blockBytes...)
	return cache.lruDb.Delete(lruKey, nil)
}

// Evict implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Evict(ctx context.Context, tlfID tlf.ID,
	numBlocks int) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return DiskCacheClosedError{"Evict"}
	}
	// Use kbfscrypto.MakeTemporaryID() to create a random hash ID. Then begin
	// an interator into cache.lruDb.Range(b, nil) and iterate from there to
	// get numBlocks * evictionConsiderationFactor block IDs.  We sort the
	// resulting blocks by value (LRU time) and pick the minimum numBlocks. We
	// put those block IDs into a leveldb.Batch for cache.blockDb via
	// Batch.Delete(), then Write() that batch.
	// NOTE: It is important that we store LRU times using a monotonic clock
	// for this device. Use runtime.nanotime() for now.
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
