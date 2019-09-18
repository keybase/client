// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"io"
	"math"
	"math/rand"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfshash"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/filter"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

const (
	defaultBlockCacheTableSize      int    = 50 * opt.MiB
	defaultBlockCacheBlockSize      int    = 4 * opt.MiB
	defaultBlockCacheCapacity       int    = 8 * opt.MiB
	evictionConsiderationFactor     int    = 3
	defaultNumBlocksToEvict         int    = 10
	defaultNumBlocksToEvictOnClear  int    = 100
	defaultNumUnmarkedBlocksToCheck int    = 100
	defaultClearTickerDuration             = 1 * time.Second
	maxEvictionsPerPut              int    = 100
	blockDbFilename                 string = "diskCacheBlocks.leveldb"
	metaDbFilename                  string = "diskCacheMetadata.leveldb"
	tlfDbFilename                   string = "diskCacheTLF.leveldb"
	lastUnrefDbFilename             string = "diskCacheLastUnref.leveldb"
	initialDiskBlockCacheVersion    uint64 = 1
	currentDiskBlockCacheVersion    uint64 = initialDiskBlockCacheVersion
	syncCacheName                   string = "SyncBlockCache"
	workingSetCacheName             string = "WorkingSetBlockCache"
	crDirtyBlockCacheName           string = "DirtyBlockCache"
	minDiskBlockWriteBufferSize            = 3 * data.MaxBlockSizeBytesDefault // ~ 1 MB
)

var errTeamOrUnknownTLFAddedAsHome = errors.New(
	"Team or Unknown TLF added to disk block cache as home TLF")

type evictionPriority int

const (
	priorityNotHome evictionPriority = iota
	priorityPublicHome
	priorityPrivateHome
)

// DiskBlockCacheLocal is the standard implementation for DiskBlockCache.
type DiskBlockCacheLocal struct {
	config     diskBlockCacheConfig
	log        logger.Logger
	maxBlockID []byte
	dirPath    string

	clearTickerDuration      time.Duration
	numBlocksToEvictOnClear  int
	numUnmarkedBlocksToCheck int

	// Track the cache hit rate and eviction rate
	hitMeter         *CountMeter
	missMeter        *CountMeter
	putMeter         *CountMeter
	updateMeter      *CountMeter
	evictCountMeter  *CountMeter
	evictSizeMeter   *CountMeter
	deleteCountMeter *CountMeter
	deleteSizeMeter  *CountMeter

	// Protect the disk caches from being shutdown while they're being
	// accessed, and mutable data.
	lock        sync.RWMutex
	blockDb     *LevelDb
	metaDb      *LevelDb
	tlfDb       *LevelDb
	lastUnrefDb *LevelDb
	cacheType   diskLimitTrackerType
	// Track the number of blocks in the cache per TLF and overall.
	tlfCounts map[tlf.ID]int
	numBlocks int
	// Track the number of blocks in the cahce per eviction priority,
	// for easy eviction counting.
	priorityBlockCounts map[evictionPriority]int
	priorityTlfMap      map[evictionPriority]map[tlf.ID]int
	// Track the aggregate size of blocks in the cache per TLF and overall.
	tlfSizes map[tlf.ID]uint64
	// Track the last unref'd revisions for each TLF.
	tlfLastUnrefs map[tlf.ID]kbfsmd.Revision
	// Don't evict files from the user's private or public home directory.
	// Higher numbers are more important not to evict.
	homeDirs map[tlf.ID]evictionPriority

	// currBytes gets its own lock, since tests need to access it
	// directly and taking the full lock causes deadlocks under some
	// situations.
	currBytesLock sync.RWMutex
	currBytes     uint64

	startedCh  chan struct{}
	startErrCh chan struct{}
	shutdownCh chan struct{}

	closer func()
}

// DiskBlockCacheStartState represents whether this disk block cache has
// started or failed.
type DiskBlockCacheStartState int

// String allows DiskBlockCacheStartState to be output as a string.
func (s DiskBlockCacheStartState) String() string {
	switch s {
	case DiskBlockCacheStartStateStarting:
		return "starting"
	case DiskBlockCacheStartStateStarted:
		return "started"
	case DiskBlockCacheStartStateFailed:
		return "failed"
	default:
		return "unknown"
	}
}

const (
	// DiskBlockCacheStartStateStarting represents when the cache is starting.
	DiskBlockCacheStartStateStarting DiskBlockCacheStartState = iota
	// DiskBlockCacheStartStateStarted represents when the cache has started.
	DiskBlockCacheStartStateStarted
	// DiskBlockCacheStartStateFailed represents when the cache has failed to
	// start.
	DiskBlockCacheStartStateFailed
)

// DiskBlockCacheStatus represents the status of the disk cache.
type DiskBlockCacheStatus struct {
	StartState      DiskBlockCacheStartState
	NumBlocks       uint64
	BlockBytes      uint64
	CurrByteLimit   uint64
	LastUnrefCount  uint64
	Hits            MeterStatus
	Misses          MeterStatus
	Puts            MeterStatus
	MetadataUpdates MeterStatus
	NumEvicted      MeterStatus
	SizeEvicted     MeterStatus
	NumDeleted      MeterStatus
	SizeDeleted     MeterStatus

	LocalDiskBytesAvailable uint64
	LocalDiskBytesTotal     uint64

	BlockDBStats        []string `json:",omitempty"`
	MetaDBStats         []string `json:",omitempty"`
	TLFDBStats          []string `json:",omitempty"`
	LastUnrefStats      []string `json:",omitempty"`
	MemCompActive       bool     `json:",omitempty"`
	TableCompActive     bool     `json:",omitempty"`
	MetaMemCompActive   bool     `json:",omitempty"`
	MetaTableCompActive bool     `json:",omitempty"`
}

type lastUnrefEntry struct {
	Rev   kbfsmd.Revision
	Ctime time.Time // Not used yet, but save it in case we ever need it.
}

// newDiskBlockCacheLocalFromStorage creates a new *DiskBlockCacheLocal
// with the passed-in storage.Storage interfaces as storage layers for each
// cache.
func newDiskBlockCacheLocalFromStorage(
	config diskBlockCacheConfig, cacheType diskLimitTrackerType,
	blockStorage, metadataStorage, tlfStorage,
	lastUnrefStorage storage.Storage, mode InitMode) (
	cache *DiskBlockCacheLocal, err error) {
	log := config.MakeLogger("KBC")
	closers := make([]io.Closer, 0, 3)
	closer := func() {
		for _, c := range closers {
			closeErr := c.Close()
			if closeErr != nil {
				log.Warning("Error closing leveldb or storage: %+v", closeErr)
			}
		}
	}
	defer func() {
		if err != nil {
			err = errors.WithStack(err)
			closer()
		}
	}()
	blockDbOptions := leveldbOptionsFromMode(mode)
	blockDbOptions.CompactionTableSize = defaultBlockCacheTableSize
	blockDbOptions.BlockSize = defaultBlockCacheBlockSize
	blockDbOptions.BlockCacheCapacity = defaultBlockCacheCapacity
	blockDbOptions.Filter = filter.NewBloomFilter(16)
	if blockDbOptions.WriteBuffer < minDiskBlockWriteBufferSize {
		blockDbOptions.WriteBuffer = minDiskBlockWriteBufferSize
	}
	blockDb, err := openLevelDBWithOptions(blockStorage, blockDbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, blockDb)

	metaDb, err := openLevelDB(metadataStorage, mode)
	if err != nil {
		return nil, err
	}
	closers = append(closers, metaDb)

	tlfDb, err := openLevelDB(tlfStorage, mode)
	if err != nil {
		return nil, err
	}
	closers = append(closers, tlfDb)

	lastUnrefDb, err := openLevelDB(lastUnrefStorage, mode)
	if err != nil {
		return nil, err
	}
	closers = append(closers, lastUnrefDb)

	maxBlockID, err := kbfshash.HashFromRaw(
		kbfshash.MaxHashType, kbfshash.MaxDefaultHash[:])
	if err != nil {
		return nil, err
	}
	startedCh := make(chan struct{})
	startErrCh := make(chan struct{})
	cache = &DiskBlockCacheLocal{
		config:                   config,
		maxBlockID:               maxBlockID.Bytes(),
		clearTickerDuration:      defaultClearTickerDuration,
		numBlocksToEvictOnClear:  defaultNumBlocksToEvictOnClear,
		numUnmarkedBlocksToCheck: defaultNumUnmarkedBlocksToCheck,
		cacheType:                cacheType,
		hitMeter:                 NewCountMeter(),
		missMeter:                NewCountMeter(),
		putMeter:                 NewCountMeter(),
		updateMeter:              NewCountMeter(),
		evictCountMeter:          NewCountMeter(),
		evictSizeMeter:           NewCountMeter(),
		deleteCountMeter:         NewCountMeter(),
		deleteSizeMeter:          NewCountMeter(),
		homeDirs:                 map[tlf.ID]evictionPriority{},
		log:                      log,
		blockDb:                  blockDb,
		metaDb:                   metaDb,
		tlfDb:                    tlfDb,
		lastUnrefDb:              lastUnrefDb,
		tlfCounts:                map[tlf.ID]int{},
		priorityBlockCounts:      map[evictionPriority]int{},
		priorityTlfMap: map[evictionPriority]map[tlf.ID]int{
			priorityPublicHome:  {},
			priorityPrivateHome: {},
			priorityNotHome:     {},
		},
		tlfSizes:      map[tlf.ID]uint64{},
		tlfLastUnrefs: map[tlf.ID]kbfsmd.Revision{},
		startedCh:     startedCh,
		startErrCh:    startErrCh,
		shutdownCh:    make(chan struct{}),
		closer:        closer,
	}
	// Sync the block counts asynchronously so syncing doesn't block init.
	// Since this method blocks, any Get or Put requests to the disk block
	// cache will block until this is done. The log will contain the beginning
	// and end of this sync.
	go func() {
		err := cache.syncBlockCountsAndUnrefsFromDb()
		if err != nil {
			close(startErrCh)
			closer()
			log.Warning("Disabling disk block cache due to error syncing the "+
				"block counts from DB: %+v", err)
			return
		}
		diskLimiter := cache.config.DiskLimiter()
		if diskLimiter != nil && cache.useLimiter() {
			// Notify the disk limiter of the disk cache's size once we've
			// determined it.
			ctx := context.Background()
			cache.config.DiskLimiter().onSimpleByteTrackerEnable(ctx,
				cache.cacheType, int64(cache.getCurrBytes()))
		}
		close(startedCh)
	}()
	return cache, nil
}

// newDiskBlockCacheLocal creates a new *DiskBlockCacheLocal with a
// specified directory on the filesystem as storage.
func newDiskBlockCacheLocal(config diskBlockCacheConfig,
	cacheType diskLimitTrackerType, dirPath string, mode InitMode) (
	cache *DiskBlockCacheLocal, err error) {
	log := config.MakeLogger("DBC")
	defer func() {
		if err != nil {
			log.Error("Error initializing disk cache: %+v", err)
		}
	}()
	versionPath, err := getVersionedPathForDiskCache(
		log, dirPath, "block", currentDiskBlockCacheVersion)
	if err != nil {
		return nil, err
	}
	blockDbPath := filepath.Join(versionPath, blockDbFilename)
	blockStorage, err := storage.OpenFile(blockDbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			blockStorage.Close()
		}
	}()
	metaDbPath := filepath.Join(versionPath, metaDbFilename)
	metadataStorage, err := storage.OpenFile(metaDbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			metadataStorage.Close()
		}
	}()
	tlfDbPath := filepath.Join(versionPath, tlfDbFilename)
	tlfStorage, err := storage.OpenFile(tlfDbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			tlfStorage.Close()
		}
	}()
	lastUnrefDbPath := filepath.Join(versionPath, lastUnrefDbFilename)
	lastUnrefStorage, err := storage.OpenFile(lastUnrefDbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			lastUnrefStorage.Close()
		}
	}()
	cache, err = newDiskBlockCacheLocalFromStorage(config, cacheType,
		blockStorage, metadataStorage, tlfStorage, lastUnrefStorage, mode)
	if err != nil {
		return nil, err
	}
	cache.dirPath = dirPath
	return cache, nil
}

func newDiskBlockCacheLocalForTest(config diskBlockCacheConfig,
	cacheType diskLimitTrackerType) (*DiskBlockCacheLocal, error) {
	return newDiskBlockCacheLocalFromStorage(
		config, cacheType, storage.NewMemStorage(),
		storage.NewMemStorage(), storage.NewMemStorage(),
		storage.NewMemStorage(), &modeTest{modeDefault{}})
}

func (cache *DiskBlockCacheLocal) useLimiter() bool {
	return cache.cacheType != crDirtyBlockCacheLimitTrackerType
}

func (cache *DiskBlockCacheLocal) getCurrBytes() uint64 {
	cache.currBytesLock.RLock()
	defer cache.currBytesLock.RUnlock()
	return cache.currBytes
}

func (cache *DiskBlockCacheLocal) setCurrBytes(b uint64) {
	cache.currBytesLock.Lock()
	defer cache.currBytesLock.Unlock()
	cache.currBytes = b
}

func (cache *DiskBlockCacheLocal) addCurrBytes(b uint64) {
	cache.currBytesLock.Lock()
	defer cache.currBytesLock.Unlock()
	cache.currBytes += b
}

func (cache *DiskBlockCacheLocal) subCurrBytes(b uint64) {
	cache.currBytesLock.Lock()
	defer cache.currBytesLock.Unlock()
	if b <= cache.currBytes {
		cache.currBytes -= b
	}
}

// WaitUntilStarted waits until this cache has started.
func (cache *DiskBlockCacheLocal) WaitUntilStarted() error {
	select {
	case <-cache.startedCh:
		return nil
	case <-cache.startErrCh:
		return DiskBlockCacheError{"error starting channel"}
	}
}

func (cache *DiskBlockCacheLocal) decodeLastUnref(buf []byte) (
	rev kbfsmd.Revision, err error) {
	var entry lastUnrefEntry
	err = cache.config.Codec().Decode(buf, &entry)
	if err != nil {
		return kbfsmd.RevisionUninitialized, err
	}
	return entry.Rev, nil
}

func (cache *DiskBlockCacheLocal) encodeLastUnref(rev kbfsmd.Revision) (
	[]byte, error) {
	entry := lastUnrefEntry{
		Rev:   rev,
		Ctime: cache.config.Clock().Now(),
	}
	return cache.config.Codec().Encode(&entry)
}

func (cache *DiskBlockCacheLocal) syncBlockCountsAndUnrefsFromDb() error {
	cache.log.Debug("+ syncBlockCountsAndUnrefsFromDb begin")
	defer cache.log.Debug("- syncBlockCountsAndUnrefsFromDb end")
	// We take a write lock for this to prevent any reads from happening while
	// we're syncing the block counts.
	cache.lock.Lock()
	defer cache.lock.Unlock()

	tlfCounts := make(map[tlf.ID]int)
	tlfSizes := make(map[tlf.ID]uint64)
	priorityBlockCounts := make(map[evictionPriority]int)
	priorityTlfMap := map[evictionPriority]map[tlf.ID]int{
		priorityNotHome:     {},
		priorityPublicHome:  {},
		priorityPrivateHome: {},
	}
	numBlocks := 0
	totalSize := uint64(0)
	iter := cache.metaDb.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		metadata := DiskBlockCacheMetadata{}
		err := cache.config.Codec().Decode(iter.Value(), &metadata)
		if err != nil {
			return err
		}
		size := uint64(metadata.BlockSize)
		tlfCounts[metadata.TlfID]++
		tlfSizes[metadata.TlfID] += size
		priorityBlockCounts[cache.homeDirs[metadata.TlfID]]++
		priorityTlfMap[cache.homeDirs[metadata.TlfID]][metadata.TlfID]++
		numBlocks++
		totalSize += size
	}
	cache.tlfCounts = tlfCounts
	cache.numBlocks = numBlocks
	cache.tlfSizes = tlfSizes
	cache.setCurrBytes(totalSize)
	cache.priorityTlfMap = priorityTlfMap
	cache.priorityBlockCounts = priorityBlockCounts

	cache.log.Debug("| syncBlockCountsAndUnrefsFromDb block counts done")

	tlfLastUnrefs := make(map[tlf.ID]kbfsmd.Revision)
	lastUnrefIter := cache.lastUnrefDb.NewIterator(nil, nil)
	defer lastUnrefIter.Release()
	for lastUnrefIter.Next() {
		var tlfID tlf.ID
		err := tlfID.UnmarshalBinary(lastUnrefIter.Key())
		if err != nil {
			return err
		}

		rev, err := cache.decodeLastUnref(lastUnrefIter.Value())
		if err != nil {
			return err
		}
		tlfLastUnrefs[tlfID] = rev
	}
	cache.tlfLastUnrefs = tlfLastUnrefs

	return nil
}

// tlfKey generates a TLF cache key from a tlf.ID and a binary-encoded block
// ID.
func (*DiskBlockCacheLocal) tlfKey(tlfID tlf.ID, blockKey []byte) []byte {
	return append(tlfID.Bytes(), blockKey...)
}

// updateMetadataLocked updates the LRU time of a block in the LRU cache to
// the current time.
func (cache *DiskBlockCacheLocal) updateMetadataLocked(ctx context.Context,
	blockKey []byte, metadata DiskBlockCacheMetadata, metered bool) error {
	metadata.LRUTime.Time = cache.config.Clock().Now()
	encodedMetadata, err := cache.config.Codec().Encode(&metadata)
	if err != nil {
		return err
	}
	var putMeter *CountMeter
	if metered {
		putMeter = cache.updateMeter
	}
	err = cache.metaDb.PutWithMeter(blockKey, encodedMetadata, putMeter)
	if err != nil {
		cache.log.CWarningf(ctx, "Error writing to disk cache meta "+
			"database: %+v", err)
	}
	return err
}

// getMetadataLocked retrieves the metadata for a block in the cache, or
// returns leveldb.ErrNotFound and a zero-valued metadata otherwise.
func (cache *DiskBlockCacheLocal) getMetadataLocked(
	blockID kbfsblock.ID, metered bool) (
	metadata DiskBlockCacheMetadata, err error) {
	var hitMeter, missMeter *CountMeter
	if metered {
		hitMeter = cache.hitMeter
		missMeter = cache.missMeter
	}

	metadataBytes, err := cache.metaDb.GetWithMeter(
		blockID.Bytes(), hitMeter, missMeter)
	if err != nil {
		return DiskBlockCacheMetadata{}, err
	}
	err = cache.config.Codec().Decode(metadataBytes, &metadata)
	return metadata, err
}

// getLRULocked retrieves the LRU time for a block in the cache, or returns
// leveldb.ErrNotFound and a zero-valued time.Time otherwise.
func (cache *DiskBlockCacheLocal) getLRULocked(blockID kbfsblock.ID) (
	time.Time, error) {
	metadata, err := cache.getMetadataLocked(blockID, false)
	if err != nil {
		return time.Time{}, err
	}
	return metadata.LRUTime.Time, nil
}

// decodeBlockCacheEntry decodes a disk block cache entry buffer into an
// encoded block and server half.
func (cache *DiskBlockCacheLocal) decodeBlockCacheEntry(buf []byte) ([]byte,
	kbfscrypto.BlockCryptKeyServerHalf, error) {
	entry := diskBlockCacheEntry{}
	err := cache.config.Codec().Decode(buf, &entry)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return entry.Buf, entry.ServerHalf, nil
}

// encodeBlockCacheEntry encodes an encoded block and serverHalf into a single
// buffer.
func (cache *DiskBlockCacheLocal) encodeBlockCacheEntry(buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) ([]byte, error) {
	entry := diskBlockCacheEntry{
		Buf:        buf,
		ServerHalf: serverHalf,
	}
	return cache.config.Codec().Encode(&entry)
}

// checkAndLockCache checks whether the cache is started.
func (cache *DiskBlockCacheLocal) checkCacheLocked(method string) error {
	select {
	case <-cache.startedCh:
	case <-cache.startErrCh:
		// The cache will never be started. No need for a stack here since this
		// could happen anywhere.
		return DiskCacheStartingError{method}
	default:
		// If the cache hasn't started yet, return an error.  No need for a
		// stack here since this could happen anywhere.
		return DiskCacheStartingError{method}
	}
	// shutdownCh has to be checked under lock, otherwise we can race.
	select {
	case <-cache.shutdownCh:
		return errors.WithStack(DiskCacheClosedError{method})
	default:
	}
	if cache.blockDb == nil {
		return errors.WithStack(DiskCacheClosedError{method})
	}
	return nil
}

// Get implements the DiskBlockCache interface for DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) Get(
	ctx context.Context, tlfID tlf.ID, blockID kbfsblock.ID) (buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	prefetchStatus PrefetchStatus, err error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	err = cache.checkCacheLocked("Block(Get)")
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}

	blockKey := blockID.Bytes()
	entry, err := cache.blockDb.Get(blockKey, nil)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch,
			data.NoSuchBlockError{ID: blockID}
	}
	md, err := cache.getMetadataLocked(blockID, true)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}
	err = cache.updateMetadataLocked(ctx, blockKey, md, unmetered)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}
	buf, serverHalf, err = cache.decodeBlockCacheEntry(entry)
	return buf, serverHalf, md.PrefetchStatus(), err
}

func (cache *DiskBlockCacheLocal) evictUntilBytesAvailable(
	ctx context.Context, encodedLen int64) (hasEnoughSpace bool, err error) {
	if !cache.useLimiter() {
		return true, nil
	}
	for i := 0; i < maxEvictionsPerPut; i++ {
		select {
		// Ensure we don't loop infinitely
		case <-ctx.Done():
			return false, ctx.Err()
		default:
		}
		bytesAvailable, err := cache.config.DiskLimiter().reserveBytes(
			ctx, cache.cacheType, encodedLen)
		if err != nil {
			cache.log.CWarningf(ctx, "Error obtaining space for the disk "+
				"block cache: %+v", err)
			return false, err
		}
		if bytesAvailable >= 0 {
			return true, nil
		}
		cache.log.CDebugf(ctx, "Need more bytes. Available: %d", bytesAvailable)
		numRemoved, _, err := cache.evictLocked(ctx, defaultNumBlocksToEvict)
		if err != nil {
			return false, err
		}
		if numRemoved == 0 {
			return false, errors.New("couldn't evict any more blocks from " +
				"the disk block cache")
		}
	}
	return false, nil
}

// Put implements the DiskBlockCache interface for DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) Put(
	ctx context.Context, tlfID tlf.ID, blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked("Block(Put)")
	if err != nil {
		return err
	}

	blockLen := len(buf)
	entry, err := cache.encodeBlockCacheEntry(buf, serverHalf)
	if err != nil {
		return err
	}
	encodedLen := int64(len(entry))
	defer func() {
		cache.log.CDebugf(ctx, "Cache Put id=%s tlf=%s bSize=%d entrySize=%d "+
			"cacheType=%s err=%+v", blockID, tlfID, blockLen, encodedLen,
			cache.cacheType, err)
	}()
	blockKey := blockID.Bytes()
	hasKey, err := cache.blockDb.Has(blockKey, nil)
	if err != nil {
		cache.log.CDebugf(ctx, "Cache Put failed due to error from "+
			"blockDb.Has: %+v", err)
		return err
	}
	if !hasKey {
		if cache.cacheType == syncCacheLimitTrackerType {
			bytesAvailable, err := cache.config.DiskLimiter().reserveBytes(
				ctx, cache.cacheType, encodedLen)
			if err != nil {
				cache.log.CWarningf(ctx, "Error obtaining space for the disk "+
					"block cache: %+v", err)
				return err
			}
			if bytesAvailable < 0 {
				return data.CachePutCacheFullError{BlockID: blockID}
			}
		} else {
			hasEnoughSpace, err := cache.evictUntilBytesAvailable(ctx, encodedLen)
			if err != nil {
				return err
			}
			if !hasEnoughSpace {
				return data.CachePutCacheFullError{BlockID: blockID}
			}
		}
		err = cache.blockDb.PutWithMeter(blockKey, entry, cache.putMeter)
		if err != nil {
			if cache.useLimiter() {
				cache.config.DiskLimiter().commitOrRollback(ctx,
					cache.cacheType, encodedLen, 0, false, "")
			}
			return err
		}
		if cache.useLimiter() {
			cache.config.DiskLimiter().commitOrRollback(ctx, cache.cacheType,
				encodedLen, 0, true, "")
		}
		cache.tlfCounts[tlfID]++
		cache.priorityBlockCounts[cache.homeDirs[tlfID]]++
		cache.priorityTlfMap[cache.homeDirs[tlfID]][tlfID]++
		cache.numBlocks++
		encodedLenUint := uint64(encodedLen)
		cache.tlfSizes[tlfID] += encodedLenUint
		cache.addCurrBytes(encodedLenUint)
	}
	tlfKey := cache.tlfKey(tlfID, blockKey)
	hasKey, err = cache.tlfDb.Has(tlfKey, nil)
	if err != nil {
		cache.log.CWarningf(ctx, "Error reading from TLF cache database: %+v",
			err)
	}
	if !hasKey {
		err = cache.tlfDb.Put(tlfKey, []byte{}, nil)
		if err != nil {
			cache.log.CWarningf(ctx,
				"Error writing to TLF cache database: %+v", err)
		}
	}
	md, err := cache.getMetadataLocked(blockID, false)
	if err != nil {
		// Only set the relevant fields if we had trouble getting the metadata.
		// Initially leave TriggeredPrefetch and FinishedPrefetch as false;
		// rely on the later-called UpdateMetadata to fix it.
		md.TlfID = tlfID
		md.BlockSize = uint32(encodedLen)
		err = nil
	}
	return cache.updateMetadataLocked(ctx, blockKey, md, unmetered)
}

// GetMetadata implements the DiskBlockCache interface for
// DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) GetMetadata(ctx context.Context,
	blockID kbfsblock.ID) (DiskBlockCacheMetadata, error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	err := cache.checkCacheLocked("Block(GetMetadata)")
	if err != nil {
		return DiskBlockCacheMetadata{}, err
	}
	return cache.getMetadataLocked(blockID, false)
}

// UpdateMetadata implements the DiskBlockCache interface for
// DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, prefetchStatus PrefetchStatus) (err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked("Block(UpdateMetadata)")
	if err != nil {
		return err
	}

	md, err := cache.getMetadataLocked(blockID, false)
	if err != nil {
		return data.NoSuchBlockError{ID: blockID}
	}
	if md.FinishedPrefetch {
		// Don't update md that's already completed.
		return nil
	}
	md.TriggeredPrefetch = false
	md.FinishedPrefetch = false
	switch prefetchStatus {
	case TriggeredPrefetch:
		md.TriggeredPrefetch = true
	case FinishedPrefetch:
		md.TriggeredPrefetch = true
		md.FinishedPrefetch = true
	}
	return cache.updateMetadataLocked(ctx, blockID.Bytes(), md, metered)
}

func (cache *DiskBlockCacheLocal) decCacheCountsLocked(
	tlfID tlf.ID, numBlocks int, totalSize uint64) {
	if numBlocks <= cache.tlfCounts[tlfID] {
		cache.tlfCounts[tlfID] -= numBlocks
	}
	if numBlocks <= cache.priorityBlockCounts[cache.homeDirs[tlfID]] {
		cache.priorityBlockCounts[cache.homeDirs[tlfID]] -= numBlocks
	}
	if numBlocks <= cache.priorityTlfMap[cache.homeDirs[tlfID]][tlfID] {
		cache.priorityTlfMap[cache.homeDirs[tlfID]][tlfID] -= numBlocks
	}
	if numBlocks <= cache.numBlocks {
		cache.numBlocks -= numBlocks
	}
	if totalSize <= cache.tlfSizes[tlfID] {
		cache.tlfSizes[tlfID] -= totalSize
	}
	cache.subCurrBytes(totalSize)
}

// deleteLocked deletes a set of blocks from the disk block cache.
func (cache *DiskBlockCacheLocal) deleteLocked(ctx context.Context,
	blockEntries []kbfsblock.ID) (numRemoved int, sizeRemoved int64,
	err error) {
	if len(blockEntries) == 0 {
		return 0, 0, nil
	}
	defer func() {
		if err == nil {
			cache.deleteCountMeter.Mark(int64(numRemoved))
			cache.deleteSizeMeter.Mark(sizeRemoved)
		}
	}()
	blockBatch := new(leveldb.Batch)
	metadataBatch := new(leveldb.Batch)
	tlfBatch := new(leveldb.Batch)
	removalCounts := make(map[tlf.ID]int)
	removalSizes := make(map[tlf.ID]uint64)
	for _, entry := range blockEntries {
		blockKey := entry.Bytes()
		metadataBytes, err := cache.metaDb.Get(blockKey, nil)
		if err != nil {
			// If we can't retrieve the block, don't try to delete it, and
			// don't account for its non-presence.
			continue
		}
		metadata := DiskBlockCacheMetadata{}
		err = cache.config.Codec().Decode(metadataBytes, &metadata)
		if err != nil {
			return 0, 0, err
		}
		blockBatch.Delete(blockKey)
		metadataBatch.Delete(blockKey)
		tlfDbKey := cache.tlfKey(metadata.TlfID, blockKey)
		tlfBatch.Delete(tlfDbKey)
		removalCounts[metadata.TlfID]++
		removalSizes[metadata.TlfID] += uint64(metadata.BlockSize)
		sizeRemoved += int64(metadata.BlockSize)
		numRemoved++
	}
	// TODO: more gracefully handle non-atomic failures here.
	if err := cache.metaDb.Write(metadataBatch, nil); err != nil {
		return 0, 0, err
	}
	if err := cache.tlfDb.Write(tlfBatch, nil); err != nil {
		return 0, 0, err
	}
	if err := cache.blockDb.Write(blockBatch, nil); err != nil {
		return 0, 0, err
	}

	// Update the cache's totals.
	for k, v := range removalCounts {
		cache.decCacheCountsLocked(k, v, removalSizes[k])
	}
	if cache.useLimiter() {
		cache.config.DiskLimiter().release(
			ctx, cache.cacheType, sizeRemoved, 0)
	}

	return numRemoved, sizeRemoved, nil
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked("Block(Delete)")
	if err != nil {
		return 0, 0, err
	}

	cache.log.CDebugf(ctx, "Cache Delete numBlocks=%d", len(blockIDs))
	defer func() {
		cache.log.CDebugf(ctx, "Deleted numRequested=%d numRemoved=%d sizeRemoved=%d err=%+v", len(blockIDs), numRemoved, sizeRemoved, err)
	}()
	if cache.config.IsTestMode() {
		for _, bID := range blockIDs {
			cache.log.CDebugf(ctx, "Cache type=%d delete block ID %s",
				cache.cacheType, bID)
		}
	}
	return cache.deleteLocked(ctx, blockIDs)
}

// getRandomBlockID gives us a pivot block ID for picking a random range of
// blocks to consider deleting.  We pick a point to start our range based on
// the proportion of the TLF space taken up by numElements/totalElements. E.g.
// if we need to consider 100 out of 400 blocks, and we assume that the block
// IDs are uniformly distributed, then our random start point should be in the
// [0,0.75) interval on the [0,1.0) block ID space.
func (cache *DiskBlockCacheLocal) getRandomBlockID(numElements,
	totalElements int) (kbfsblock.ID, error) {
	if totalElements == 0 {
		return kbfsblock.ID{}, errors.New("")
	}
	// Return a 0 block ID pivot if we require more elements than the total
	// number available.
	if numElements >= totalElements {
		return kbfsblock.ID{}, nil
	}
	// Generate a random block ID to start the range.
	pivot := 1.0 - (float64(numElements) / float64(totalElements))
	if cache.config.IsTestMode() {
		return kbfsblock.MakeRandomIDInRange(0, pivot,
			kbfsblock.UseMathRandForTest)
	}
	return kbfsblock.MakeRandomIDInRange(0, pivot, kbfsblock.UseRealRandomness)
}

// evictSomeBlocks tries to evict `numBlocks` blocks from the cache. If
// `blockIDs` doesn't have enough blocks, we evict them all and report how many
// we evicted.
func (cache *DiskBlockCacheLocal) evictSomeBlocks(ctx context.Context,
	numBlocks int, blockIDs blockIDsByTime) (numRemoved int, sizeRemoved int64,
	err error) {
	defer func() {
		cache.log.CDebugf(ctx, "Cache evictSomeBlocks numBlocksRequested=%d "+
			"numBlocksEvicted=%d sizeBlocksEvicted=%d err=%+v", numBlocks,
			numRemoved, sizeRemoved, err)
	}()
	if len(blockIDs) <= numBlocks {
		numBlocks = len(blockIDs)
	} else {
		// Only sort if we need to grab a subset of blocks.
		sort.Sort(blockIDs)
	}

	blocksToDelete := blockIDs.ToBlockIDSlice(numBlocks)
	return cache.deleteLocked(ctx, blocksToDelete)
}

func (cache *DiskBlockCacheLocal) removeBrokenBlock(
	ctx context.Context, tlfID tlf.ID, blockID kbfsblock.ID) int64 {
	cache.log.CDebugf(ctx, "Removing broken block %s from the cache", blockID)
	blockKey := blockID.Bytes()
	entry, err := cache.blockDb.Get(blockKey, nil)
	if err != nil {
		cache.log.CDebugf(ctx, "Couldn't get %s: %+v", blockID, err)
		return 0
	}

	err = cache.blockDb.Delete(blockKey, nil)
	if err != nil {
		cache.log.CDebugf(ctx, "Couldn't delete %s from block cache: %+v",
			blockID, err)
		return 0
	}

	tlfKey := cache.tlfKey(tlfID, blockKey)
	err = cache.tlfDb.Delete(tlfKey, nil)
	if err != nil {
		cache.log.CWarningf(ctx,
			"Couldn't delete from TLF cache database: %+v", err)
	}

	size := int64(len(entry))
	// It's tough to know whether the block actually made it into the
	// block stats or not.  If the block was added during this run of
	// KBFS, it will be in there; if it was loaded from disk, it
	// probably won't be in there, since the stats are loaded by
	// iterating over the metadata db.  So it's very possible that
	// this will make the stats incorrect. ‾\_(ツ)_/‾.
	cache.decCacheCountsLocked(tlfID, 1, uint64(size))
	if cache.useLimiter() {
		cache.config.DiskLimiter().release(ctx, cache.cacheType, size, 0)
	}

	// Attempt to clean up corrupted metadata, if any.
	_ = cache.metaDb.Delete(blockKey, nil)
	return size
}

// evictFromTLFLocked evicts a number of blocks from the cache for a given TLF.
// We choose a pivot variable b randomly. Then begin an iterator into
// cache.tlfDb.Range(tlfID + b, tlfID + MaxBlockID) and iterate from there to
// get numBlocks * evictionConsiderationFactor block IDs.  We sort the
// resulting blocks by value (LRU time) and pick the minimum numBlocks. We then
// call cache.Delete() on that list of block IDs.
func (cache *DiskBlockCacheLocal) evictFromTLFLocked(ctx context.Context,
	tlfID tlf.ID, numBlocks int) (numRemoved int, sizeRemoved int64, err error) {
	tlfBytes := tlfID.Bytes()
	numElements := numBlocks * evictionConsiderationFactor
	blockID, err := cache.getRandomBlockID(numElements, cache.tlfCounts[tlfID])
	if err != nil {
		return 0, 0, err
	}
	rng := &util.Range{
		Start: append(tlfBytes, blockID.Bytes()...),
		Limit: append(tlfBytes, cache.maxBlockID...),
	}
	iter := cache.tlfDb.NewIterator(rng, nil)
	defer iter.Release()

	blockIDs := make(blockIDsByTime, 0, numElements)
	var brokenIDs []kbfsblock.ID

	for i := 0; i < numElements; i++ {
		if !iter.Next() {
			break
		}
		key := iter.Key()

		blockIDBytes := key[len(tlfBytes):]
		blockID, err := kbfsblock.IDFromBytes(blockIDBytes)
		if err != nil {
			cache.log.CWarningf(
				ctx, "Error decoding block ID %x: %+v", blockIDBytes, err)
			brokenIDs = append(brokenIDs, blockID)
			continue
		}
		lru, err := cache.getLRULocked(blockID)
		if err != nil {
			cache.log.CWarningf(
				ctx, "Error decoding LRU time for block %s: %+v", blockID, err)
			brokenIDs = append(brokenIDs, blockID)
			continue
		}
		blockIDs = append(blockIDs, lruEntry{blockID, lru})
	}

	numRemoved, sizeRemoved, err = cache.evictSomeBlocks(
		ctx, numBlocks, blockIDs)
	if err != nil {
		return 0, 0, err
	}

	for _, id := range brokenIDs {
		// Assume that a block that is in `tlfDB`, but for which the
		// metadata is missing or busted,
		size := cache.removeBrokenBlock(ctx, tlfID, id)
		if size > 0 {
			numRemoved++
			sizeRemoved += size
		}
	}
	return numRemoved, sizeRemoved, nil
}

// weightedByCount is used to shuffle TLF IDs, weighting by per-TLF block count.
type weightedByCount struct {
	key   float64
	value tlf.ID
}

// shuffleTLFsAtPriorityWeighted shuffles the TLFs at a given priority,
// weighting by per-TLF block count.
func (cache *DiskBlockCacheLocal) shuffleTLFsAtPriorityWeighted(
	priority evictionPriority) []weightedByCount {
	weightedSlice := make([]weightedByCount, 0,
		len(cache.priorityTlfMap[priority]))
	idx := 0
	// Use an exponential distribution to ensure the weights are
	// correctly used.
	// See http://utopia.duth.gr/~pefraimi/research/data/2007EncOfAlg.pdf
	for tlfID, count := range cache.priorityTlfMap[priority] {
		if count == 0 {
			continue
		}
		weightedSlice = append(weightedSlice, weightedByCount{
			key:   math.Pow(rand.Float64(), 1.0/float64(count)),
			value: tlfID,
		})
		idx++
	}
	sort.Slice(weightedSlice, func(i, j int) bool {
		return weightedSlice[i].key > weightedSlice[j].key
	})
	return weightedSlice
}

// evictLocked evicts a number of blocks from the cache. We search the lowest
// eviction priority level for blocks to evict first, then the next highest
// priority and so on until enough blocks have been evicted. Within each
// priority, we first shuffle the TLFs, weighting by how many blocks they
// contain, and then we take the top TLFs from that shuffle and evict the
// least recently used blocks from them.
func (cache *DiskBlockCacheLocal) evictLocked(ctx context.Context,
	numBlocks int) (numRemoved int, sizeRemoved int64, err error) {
	numRemoved = 0
	sizeRemoved = 0
	defer func() {
		cache.evictCountMeter.Mark(int64(numRemoved))
		cache.evictSizeMeter.Mark(sizeRemoved)
	}()
	for priorityToEvict := priorityNotHome; (priorityToEvict <= priorityPrivateHome) && (numRemoved < numBlocks); priorityToEvict++ {
		// Shuffle the TLFs of this priority, weighting by block count.
		shuffledSlice := cache.shuffleTLFsAtPriorityWeighted(priorityToEvict)
		// Select some TLFs to evict from.
		numElements := (numBlocks - numRemoved) * evictionConsiderationFactor

		// blockIDs is a slice of blocks from which evictions will be selected.
		blockIDs := make(blockIDsByTime, 0, numElements)

		// For each TLF until we get enough elements to select among,
		// add its blocks to the eviction slice.
		for _, tlfIDStruct := range shuffledSlice {
			tlfID := tlfIDStruct.value
			if cache.tlfCounts[tlfID] == 0 {
				cache.log.CDebugf(ctx, "No blocks to delete in TLF %s", tlfID)
				continue
			}
			tlfBytes := tlfID.Bytes()

			blockID, err := cache.getRandomBlockID(numElements,
				cache.tlfCounts[tlfID])
			if err != nil {
				return 0, 0, err
			}
			rng := &util.Range{
				Start: append(tlfBytes, blockID.Bytes()...),
				Limit: append(tlfBytes, cache.maxBlockID...),
			}

			// Extra func exists to make defers work.
			func() {
				iter := cache.tlfDb.NewIterator(rng, nil)
				defer iter.Release()

				var brokenIDs []kbfsblock.ID
				for i := 0; i < numElements; i++ {
					if !iter.Next() {
						break
					}
					key := iter.Key()

					blockIDBytes := key[len(tlfBytes):]
					blockID, err := kbfsblock.IDFromBytes(blockIDBytes)
					if err != nil {
						cache.log.CWarningf(
							ctx, "Error decoding block ID %x", blockIDBytes)
						brokenIDs = append(brokenIDs, blockID)
						continue
					}
					lru, err := cache.getLRULocked(blockID)
					if err != nil {
						cache.log.CWarningf(
							ctx, "Error decoding LRU time for block %s",
							blockID)
						brokenIDs = append(brokenIDs, blockID)
						continue
					}
					blockIDs = append(blockIDs, lruEntry{blockID, lru})
				}

				for _, id := range brokenIDs {
					// Assume that a block that is in `tlfDB`, but for which the
					// metadata is missing or busted,
					size := cache.removeBrokenBlock(ctx, tlfID, id)
					if size > 0 {
						numRemoved++
						sizeRemoved += size
					}
				}
			}()
			if len(blockIDs) == numElements {
				break
			}
		}
		// Evict some of the selected blocks.
		currNumRemoved, currSizeRemoved, err := cache.evictSomeBlocks(ctx,
			numBlocks-numRemoved, blockIDs)
		if err != nil {
			return numRemoved, sizeRemoved, err
		}
		// Update the evicted count.
		numRemoved += currNumRemoved
		sizeRemoved += currSizeRemoved
	}

	return numRemoved, sizeRemoved, nil
}

func (cache *DiskBlockCacheLocal) deleteNextBatchFromClearedTlf(
	ctx context.Context, tlfID tlf.ID) (numLeft int, err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked("Block(deleteNextBatchFromClearedTlf)")
	if err != nil {
		return 0, err
	}

	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	default:
	}

	_, _, err = cache.evictFromTLFLocked(
		ctx, tlfID, cache.numBlocksToEvictOnClear)
	if err != nil {
		return 0, err
	}
	return cache.tlfCounts[tlfID], nil
}

// ClearAllTlfBlocks implements the DiskBlockCache interface for
// DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) ClearAllTlfBlocks(
	ctx context.Context, tlfID tlf.ID) (err error) {
	defer func() {
		cache.log.CDebugf(ctx,
			"Finished clearing blocks from %s: %+v", tlfID, err)
	}()

	// Delete the blocks in batches, so we don't keep the lock for too
	// long.
	for {
		cache.log.CDebugf(ctx, "Deleting a batch of blocks from %s", tlfID)
		numLeft, err := cache.deleteNextBatchFromClearedTlf(ctx, tlfID)
		if err != nil {
			return err
		}
		if numLeft == 0 {
			cache.log.CDebugf(ctx, "Deleted all blocks from %s", tlfID)
			return nil
		}
		cache.log.CDebugf(
			ctx, "%d blocks left to delete from %s", numLeft, tlfID)

		c := time.After(cache.clearTickerDuration)
		select {
		case <-c:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// GetLastUnrefRev implements the DiskBlockCache interface for
// DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) GetLastUnrefRev(
	ctx context.Context, tlfID tlf.ID) (kbfsmd.Revision, error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	err := cache.checkCacheLocked("Block(GetLastUnrefRev)")
	if err != nil {
		return kbfsmd.RevisionUninitialized, err
	}

	rev, ok := cache.tlfLastUnrefs[tlfID]
	if !ok {
		// No known unref'd revision.
		return kbfsmd.RevisionUninitialized, nil
	}
	return rev, nil
}

// PutLastUnrefRev implements the DiskBlockCache interface for
// DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) PutLastUnrefRev(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err := cache.checkCacheLocked("Block(PutLastUnrefRev)")
	if err != nil {
		return err
	}

	if currRev, ok := cache.tlfLastUnrefs[tlfID]; ok {
		if rev <= currRev {
			// A later revision has already been unref'd, so ignore this.
			return nil
		}
	}

	buf, err := cache.encodeLastUnref(rev)
	if err != nil {
		return err
	}
	err = cache.lastUnrefDb.Put(tlfID.Bytes(), buf, nil)
	if err != nil {
		return err
	}
	cache.tlfLastUnrefs[tlfID] = rev
	return nil
}

// Status implements the DiskBlockCache interface for DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) Status(
	ctx context.Context) map[string]DiskBlockCacheStatus {
	var name string
	var maxLimit uint64
	limiterStatus := cache.config.DiskLimiter().getStatus(
		ctx, keybase1.UserOrTeamID("")).(backpressureDiskLimiterStatus)
	switch cache.cacheType {
	case syncCacheLimitTrackerType:
		name = syncCacheName
		maxLimit = uint64(limiterStatus.SyncCacheByteStatus.Max)
	case workingSetCacheLimitTrackerType:
		name = workingSetCacheName
		maxLimit = uint64(limiterStatus.DiskCacheByteStatus.Max)
	case crDirtyBlockCacheLimitTrackerType:
		name = crDirtyBlockCacheName
	}
	select {
	case <-cache.startedCh:
	case <-cache.startErrCh:
		return map[string]DiskBlockCacheStatus{name: {StartState: DiskBlockCacheStartStateFailed}}
	default:
		return map[string]DiskBlockCacheStatus{name: {StartState: DiskBlockCacheStartStateStarting}}
	}
	availableBytes, totalBytes := uint64(math.MaxInt64), uint64(math.MaxInt64)
	if cache.dirPath != "" {
		var err error
		availableBytes, totalBytes, _, _, err = getDiskLimits(cache.dirPath)
		if err != nil {
			cache.log.CDebugf(ctx, "Couldn't get disk stats: %+v", err)
		}
	}

	cache.lock.RLock()
	defer cache.lock.RUnlock()

	var blockStats, metaStats, tlfStats, lastUnrefStats []string
	var memCompActive, tableCompActive bool
	var metaMemCompActive, metaTableCompActive bool
	if err := cache.checkCacheLocked("Block(Status)"); err == nil {
		blockStats, err = cache.blockDb.StatStrings()
		if err != nil {
			cache.log.CDebugf(ctx, "Couldn't get block db stats: %+v", err)
		}
		metaStats, err = cache.metaDb.StatStrings()
		if err != nil {
			cache.log.CDebugf(ctx, "Couldn't get meta db stats: %+v", err)
		}
		tlfStats, err = cache.tlfDb.StatStrings()
		if err != nil {
			cache.log.CDebugf(ctx, "Couldn't get TLF db stats: %+v", err)
		}
		lastUnrefStats, err = cache.lastUnrefDb.StatStrings()
		if err != nil {
			cache.log.CDebugf(ctx, "Couldn't get last unref db stats: %+v", err)
		}
		var dbStats leveldb.DBStats
		err = cache.blockDb.Stats(&dbStats)
		if err != nil {
			cache.log.CDebugf(
				ctx, "Couldn't get block db compaction stats: %+v", err)
		}
		memCompActive, tableCompActive =
			dbStats.MemCompactionActive, dbStats.TableCompactionActive
		err = cache.metaDb.Stats(&dbStats)
		if err != nil {
			cache.log.CDebugf(
				ctx, "Couldn't get meta db compaction stats: %+v", err)
		}
		metaMemCompActive, metaTableCompActive =
			dbStats.MemCompactionActive, dbStats.TableCompactionActive
	}

	// The disk cache status doesn't depend on the chargedTo ID, and
	// we don't have easy access to the UID here, so pass in a dummy.
	return map[string]DiskBlockCacheStatus{
		name: {
			StartState:              DiskBlockCacheStartStateStarted,
			NumBlocks:               uint64(cache.numBlocks),
			BlockBytes:              cache.getCurrBytes(),
			CurrByteLimit:           maxLimit,
			LastUnrefCount:          uint64(len(cache.tlfLastUnrefs)),
			Hits:                    rateMeterToStatus(cache.hitMeter),
			Misses:                  rateMeterToStatus(cache.missMeter),
			Puts:                    rateMeterToStatus(cache.putMeter),
			MetadataUpdates:         rateMeterToStatus(cache.updateMeter),
			NumEvicted:              rateMeterToStatus(cache.evictCountMeter),
			SizeEvicted:             rateMeterToStatus(cache.evictSizeMeter),
			NumDeleted:              rateMeterToStatus(cache.deleteCountMeter),
			SizeDeleted:             rateMeterToStatus(cache.deleteSizeMeter),
			LocalDiskBytesAvailable: availableBytes,
			LocalDiskBytesTotal:     totalBytes,
			BlockDBStats:            blockStats,
			MetaDBStats:             metaStats,
			MemCompActive:           memCompActive,
			TableCompActive:         tableCompActive,
			MetaMemCompActive:       metaMemCompActive,
			MetaTableCompActive:     metaTableCompActive,
			TLFDBStats:              tlfStats,
			LastUnrefStats:          lastUnrefStats,
		},
	}
}

// DoesCacheHaveSpace returns true if we have more than 1% of space
// left in the cache.
func (cache *DiskBlockCacheLocal) DoesCacheHaveSpace(
	ctx context.Context) (hasSpace bool, howMuch int64, err error) {
	limiterStatus := cache.config.DiskLimiter().getStatus(
		ctx, keybase1.UserOrTeamID("")).(backpressureDiskLimiterStatus)
	switch cache.cacheType {
	case syncCacheLimitTrackerType:
		// The tracker doesn't track sync cache usage because we never
		// want to throttle it, so rely on our local byte usage count
		// instead of the fraction returned by the tracker.
		limit := float64(limiterStatus.SyncCacheByteStatus.Max)
		return float64(cache.getCurrBytes())/limit <= .99,
			limiterStatus.DiskCacheByteStatus.Free, nil
	case workingSetCacheLimitTrackerType:
		return limiterStatus.DiskCacheByteStatus.UsedFrac <= .99,
			limiterStatus.DiskCacheByteStatus.Free, nil
	case crDirtyBlockCacheLimitTrackerType:
		return true, 0, nil
	default:
		panic(fmt.Sprintf("Unknown cache type: %d", cache.cacheType))
	}
}

// Mark updates the metadata of the given block with the tag.
func (cache *DiskBlockCacheLocal) Mark(
	ctx context.Context, blockID kbfsblock.ID, tag string) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err := cache.checkCacheLocked("Block(UpdateMetadata)")
	if err != nil {
		return err
	}

	md, err := cache.getMetadataLocked(blockID, false)
	if err != nil {
		return data.NoSuchBlockError{ID: blockID}
	}
	md.Tag = tag
	return cache.updateMetadataLocked(ctx, blockID.Bytes(), md, false)
}

func (cache *DiskBlockCacheLocal) deleteNextUnmarkedBatchFromTlf(
	ctx context.Context, tlfID tlf.ID, tag string, startingKey []byte) (
	nextKey []byte, err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked("Block(deleteNextUnmarkedBatchFromTlf)")
	if err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	tlfBytes := tlfID.Bytes()
	rng := &util.Range{
		Start: startingKey,
		Limit: append(tlfBytes, cache.maxBlockID...),
	}
	iter := cache.tlfDb.NewIterator(rng, nil)
	defer iter.Release()

	blockIDs := make([]kbfsblock.ID, 0, cache.numUnmarkedBlocksToCheck)
	for i := 0; i < cache.numUnmarkedBlocksToCheck; i++ {
		if !iter.Next() {
			break
		}
		key := iter.Key()

		blockIDBytes := key[len(tlfBytes):]
		blockID, err := kbfsblock.IDFromBytes(blockIDBytes)
		if err != nil {
			cache.log.CWarningf(ctx, "Error decoding block ID %x", blockIDBytes)
			continue
		}
		md, err := cache.getMetadataLocked(blockID, false)
		if err != nil {
			cache.log.CWarningf(
				ctx, "No metadata for %s while checking mark", blockID)
			continue
		}
		if md.Tag != tag {
			blockIDs = append(blockIDs, blockID)
		}
	}

	if iter.Next() {
		nextKey = iter.Key()
	}

	if len(blockIDs) > 0 {
		cache.log.CDebugf(ctx, "Deleting %d unmarked blocks (tag=%s) from %s",
			len(blockIDs), tag, tlfID)
		_, _, err = cache.deleteLocked(ctx, blockIDs)
		if err != nil {
			return nil, err
		}
	}
	return nextKey, nil
}

// DeleteUnmarked deletes all the blocks without the given tag.
func (cache *DiskBlockCacheLocal) DeleteUnmarked(
	ctx context.Context, tlfID tlf.ID, tag string) (err error) {
	defer func() {
		cache.log.CDebugf(ctx,
			"Finished deleting unmarked blocks (tag=%s) from %s: %+v",
			tag, tlfID, err)
	}()

	// Delete the blocks in batches, so we don't keep the lock for too
	// long.
	startingKey := cache.tlfKey(tlfID, nil)
	for {
		cache.log.CDebugf(
			ctx, "Deleting a batch of unmarked blocks (tag=%s) from %s",
			tag, tlfID)
		startingKey, err = cache.deleteNextUnmarkedBatchFromTlf(
			ctx, tlfID, tag, startingKey)
		if err != nil {
			return err
		}
		if startingKey == nil {
			return nil
		}

		c := time.After(cache.clearTickerDuration)
		select {
		case <-c:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// AddHomeTLF implements this DiskBlockCache interace for DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) AddHomeTLF(ctx context.Context, tlfID tlf.ID) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	cache.priorityBlockCounts[cache.homeDirs[tlfID]] -= cache.tlfCounts[tlfID]
	cache.priorityTlfMap[cache.homeDirs[tlfID]][tlfID] -= cache.tlfCounts[tlfID]

	switch tlfID.Type() {
	case tlf.Private:
		cache.homeDirs[tlfID] = priorityPrivateHome
	case tlf.Public:
		cache.homeDirs[tlfID] = priorityPublicHome
	default:
		return errTeamOrUnknownTLFAddedAsHome
	}
	cache.priorityBlockCounts[cache.homeDirs[tlfID]] += cache.tlfCounts[tlfID]
	cache.priorityTlfMap[cache.homeDirs[tlfID]][tlfID] += cache.tlfCounts[tlfID]

	return nil
}

// ClearHomeTLFs implements this DiskBlockCache interace for
// DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) ClearHomeTLFs(ctx context.Context) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	for tlfID, priority := range cache.homeDirs {
		cache.priorityBlockCounts[priority] -= cache.tlfCounts[tlfID]
		cache.priorityTlfMap[priority][tlfID] -= cache.tlfCounts[tlfID]
		cache.priorityBlockCounts[priorityNotHome] += cache.tlfCounts[tlfID]
		cache.priorityTlfMap[priorityNotHome][tlfID] += cache.tlfCounts[tlfID]
	}
	cache.homeDirs = make(map[tlf.ID]evictionPriority)
	return nil
}

// GetTlfSize returns the number of bytes stored for the given TLF in
// the cache.
func (cache *DiskBlockCacheLocal) GetTlfSize(
	_ context.Context, tlfID tlf.ID) (uint64, error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	return cache.tlfSizes[tlfID], nil
}

// GetTlfIDs returns the IDs of all the TLFs with blocks stored in
// the cache.
func (cache *DiskBlockCacheLocal) GetTlfIDs(
	_ context.Context) (tlfIDs []tlf.ID, err error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	tlfIDs = make([]tlf.ID, 0, len(cache.tlfSizes))
	for id := range cache.tlfSizes {
		tlfIDs = append(tlfIDs, id)
	}
	return tlfIDs, nil
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheLocal.
func (cache *DiskBlockCacheLocal) Shutdown(ctx context.Context) {
	// Wait for the cache to either finish starting or error.
	select {
	case <-cache.startedCh:
	case <-cache.startErrCh:
		return
	}
	cache.lock.Lock()
	defer cache.lock.Unlock()
	// shutdownCh has to be checked under lock, otherwise we can race.
	select {
	case <-cache.shutdownCh:
		cache.log.CWarningf(ctx, "Shutdown called more than once")
	default:
	}
	close(cache.shutdownCh)
	if cache.blockDb == nil {
		return
	}
	cache.closer()
	cache.blockDb = nil
	cache.metaDb = nil
	cache.tlfDb = nil
	if cache.useLimiter() {
		cache.config.DiskLimiter().onSimpleByteTrackerDisable(ctx,
			cache.cacheType, int64(cache.getCurrBytes()))
	}
	cache.hitMeter.Shutdown()
	cache.missMeter.Shutdown()
	cache.putMeter.Shutdown()
	cache.updateMeter.Shutdown()
	cache.evictCountMeter.Shutdown()
	cache.evictSizeMeter.Shutdown()
	cache.deleteCountMeter.Shutdown()
	cache.deleteSizeMeter.Shutdown()
}
