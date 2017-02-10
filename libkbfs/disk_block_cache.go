package libkbfs

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

const (
	defaultDiskBlockCacheMaxBytes uint64 = 10 * (1 << 30)
	evictionConsiderationFactor   uint   = 3
	blockDbFilename               string = "diskCacheBlocks.leveldb"
	lruDbFilename                 string = "diskCacheLRU.leveldb"
)

type diskBlockCacheEntry struct {
	Buf        []byte
	ServerHalf kbfscrypto.BlockCryptKeyServerHalf
}

type diskBlockCacheConfig interface {
	codecGetter
	logMaker
}

// DiskBlockCacheStandard is the standard implementation for DiskBlockCache.
type DiskBlockCacheStandard struct {
	config   diskBlockCacheConfig
	maxBytes uint64
	log      logger.Logger
	// protects everything below
	lock     sync.RWMutex
	isClosed bool
	blockDb  *leveldb.DB
	lruDb    *leveldb.DB
}

var _ DiskBlockCache = (*DiskBlockCacheStandard)(nil)

func newDiskBlockCacheStandard(config diskBlockCacheConfig, dirPath string,
	maxBytes uint64) (*DiskBlockCacheStandard, error) {
	log := config.MakeLogger("KBC")
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
		log:      log,
		blockDb:  blockDb,
		lruDb:    lruDb,
	}, nil
}

// TODO: Fix getSizes(), where leveldb.DB.SizeOf() currently doesn't work for
// the full range.
func (cache *DiskBlockCacheStandard) getSizes() (blockSize int64, lruSize int64, err error) {
	blockSizes, err := cache.blockDb.SizeOf([]util.Range{{}})
	if err != nil {
		return -1, -1, err
	}
	lruSizes, err := cache.lruDb.SizeOf([]util.Range{{}})
	if err != nil {
		return -1, -1, err
	}
	return blockSizes[0], lruSizes[0], nil
}

func (cache *DiskBlockCacheStandard) compactCaches(ctx context.Context) {
	cache.blockDb.CompactRange(util.Range{})
	cache.lruDb.CompactRange(util.Range{})
	bSize, lruSize, err := cache.getSizes()
	cache.log.CDebugf(ctx, "Disk Cache bSize=%d lruSize=%d err=%+v", bSize, lruSize, err)
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
	return entry.Buf, entry.ServerHalf, nil
}

func (cache *DiskBlockCacheStandard) encodeBlockCacheEntry(buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) ([]byte, error) {
	entry := diskBlockCacheEntry{
		Buf:        buf,
		ServerHalf: serverHalf,
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
	cache.log.CDebugf(ctx, "Cache Get id=%s tlf=%s", blockID, tlfID)
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
	blockLen := len(buf)
	// TODO: accounting
	entry, err := cache.encodeBlockCacheEntry(buf, serverHalf)
	encodeLen := len(entry)
	cache.log.CDebugf(ctx, "Cache Put id=%s tlf=%s bSize=%d entrySize=%d err=%+v", blockID, tlfID, blockLen, encodeLen, err)
	if err != nil {
		return err
	}
	blockBytes := blockID.Bytes()
	err = cache.blockDb.Put(blockBytes, entry, nil)
	if err != nil {
		return err
	}
	return cache.updateLruLocked(tlfID, blockBytes)
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Delete(ctx context.Context, tlfID tlf.ID,
	blockIDs []kbfsblock.ID) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.isClosed {
		return DiskCacheClosedError{"Delete"}
	}
	if len(blockIDs) == 0 {
		return nil
	}
	cache.log.CDebugf(ctx, "Cache Delete tlf=%s numBlocks=%d", tlfID, len(blockIDs))
	blockBatch := new(leveldb.Batch)
	lruBatch := new(leveldb.Batch)
	for _, id := range blockIDs {
		blockKey := id.Bytes()
		blockBatch.Delete(blockKey)
		lruKey := append(tlfID.Bytes(), blockKey...)
		lruBatch.Delete(lruKey)
	}
	if err := cache.blockDb.Write(blockBatch, nil); err != nil {
		return err
	}
	if err := cache.lruDb.Write(lruBatch, nil); err != nil {
		return err
	}

	cache.compactCaches(ctx)

	return nil
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
