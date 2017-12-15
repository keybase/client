// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	metrics "github.com/rcrowley/go-metrics"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

const (
	// 10 GB maximum storage by default
	defaultDiskBlockCacheMaxBytes uint64 = 10 * (1 << 30)
	defaultBlockCacheTableSize    int    = 50 * opt.MiB
	evictionConsiderationFactor   int    = 3
	defaultNumBlocksToEvict       int    = 10
	maxEvictionsPerPut            int    = 4
	blockDbFilename               string = "diskCacheBlocks.leveldb"
	metaDbFilename                string = "diskCacheMetadata.leveldb"
	tlfDbFilename                 string = "diskCacheTLF.leveldb"
	versionFilename               string = "version"
	initialDiskCacheVersion       uint64 = 1
	currentDiskCacheVersion       uint64 = initialDiskCacheVersion
	syncCacheName                 string = "SyncBlockCache"
	workingSetCacheName           string = "WorkingSetBlockCache"
)

// DiskBlockCacheLocal is the standard implementation for DiskBlockCache.
type DiskBlockCacheLocal struct {
	config     diskBlockCacheConfig
	log        logger.Logger
	maxBlockID []byte
	cacheType  diskLimitTrackerType
	// Track the number of blocks in the cache per TLF and overall.
	tlfCounts map[tlf.ID]int
	numBlocks int
	// Track the aggregate size of blocks in the cache per TLF and overall.
	tlfSizes  map[tlf.ID]uint64
	currBytes uint64
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
	// accessed.
	lock    sync.RWMutex
	blockDb *levelDb
	metaDb  *levelDb
	tlfDb   *levelDb

	startedCh  chan struct{}
	startErrCh chan struct{}
	shutdownCh chan struct{}

	closer func()
}

var _ DiskBlockCache = (*DiskBlockCacheLocal)(nil)

// MeterStatus represents the status of a rate meter.
type MeterStatus struct {
	Minutes1  float64
	Minutes5  float64
	Minutes15 float64
	Count     int64
}

func rateMeterToStatus(m metrics.Meter) MeterStatus {
	s := m.Snapshot()
	return MeterStatus{
		s.Rate1(),
		s.Rate5(),
		s.Rate15(),
		s.Count(),
	}
}

// DiskBlockCacheStatus represents the status of the disk cache.
type DiskBlockCacheStatus struct {
	IsStarting      bool
	NumBlocks       uint64
	BlockBytes      uint64
	CurrByteLimit   uint64
	Hits            MeterStatus
	Misses          MeterStatus
	Puts            MeterStatus
	MetadataUpdates MeterStatus
	NumEvicted      MeterStatus
	SizeEvicted     MeterStatus
	NumDeleted      MeterStatus
	SizeDeleted     MeterStatus
}

// newDiskBlockCacheStandardFromStorage creates a new *DiskBlockCacheStandard
// with the passed-in storage.Storage interfaces as storage layers for each
// cache.
func newDiskBlockCacheStandardFromStorage(
	config diskBlockCacheConfig, cacheType diskLimitTrackerType,
	blockStorage, metadataStorage, tlfStorage storage.Storage) (
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
	blockDbOptions := *leveldbOptions
	blockDbOptions.CompactionTableSize = defaultBlockCacheTableSize
	blockDb, err := openLevelDBWithOptions(blockStorage, &blockDbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, blockDb)

	metaDb, err := openLevelDB(metadataStorage)
	if err != nil {
		return nil, err
	}
	closers = append(closers, metaDb)

	tlfDb, err := openLevelDB(tlfStorage)
	if err != nil {
		return nil, err
	}
	closers = append(closers, tlfDb)

	maxBlockID, err := kbfshash.HashFromRaw(kbfshash.DefaultHashType,
		kbfshash.MaxDefaultHash[:])
	if err != nil {
		return nil, err
	}
	startedCh := make(chan struct{})
	startErrCh := make(chan struct{})
	cache = &DiskBlockCacheLocal{
		config:           config,
		maxBlockID:       maxBlockID.Bytes(),
		cacheType:        cacheType,
		tlfCounts:        map[tlf.ID]int{},
		tlfSizes:         map[tlf.ID]uint64{},
		hitMeter:         NewCountMeter(),
		missMeter:        NewCountMeter(),
		putMeter:         NewCountMeter(),
		updateMeter:      NewCountMeter(),
		evictCountMeter:  NewCountMeter(),
		evictSizeMeter:   NewCountMeter(),
		deleteCountMeter: NewCountMeter(),
		deleteSizeMeter:  NewCountMeter(),
		log:              log,
		blockDb:          blockDb,
		metaDb:           metaDb,
		tlfDb:            tlfDb,
		startedCh:        startedCh,
		startErrCh:       startErrCh,
		shutdownCh:       make(chan struct{}),
		closer:           closer,
	}
	// Sync the block counts asynchronously so syncing doesn't block init.
	// Since this method blocks, any Get or Put requests to the disk block
	// cache will block until this is done. The log will contain the beginning
	// and end of this sync.
	go func() {
		err := cache.syncBlockCountsFromDb()
		if err != nil {
			close(startErrCh)
			closer()
			log.Warning("Disabling disk block cache due to error syncing the "+
				"block counts from DB: %+v", err)
			return
		}
		diskLimiter := cache.config.DiskLimiter()
		if diskLimiter != nil {
			// Notify the disk limiter of the disk cache's size once we've
			// determined it.
			ctx := context.Background()
			cache.config.DiskLimiter().onSimpleByteTrackerEnable(ctx,
				cache.cacheType, int64(cache.currBytes))
		}
		close(startedCh)
	}()
	return cache, nil
}

func versionPathFromVersion(dirPath string, version uint64) string {
	return filepath.Join(dirPath, fmt.Sprintf("v%d", version))
}

func getVersionedPathForDiskCache(log logger.Logger, dirPath string) (
	versionedDirPath string, err error) {
	// Read the version file
	versionFilepath := filepath.Join(dirPath, versionFilename)
	versionBytes, err := ioutil.ReadFile(versionFilepath)
	// We expect the file to open successfully or not exist. Anything else is a
	// problem.
	version := currentDiskCacheVersion
	if ioutil.IsNotExist(err) {
		// Do nothing, meaning that we will create the version file below.
		log.Debug("Creating new version file for the disk block cache.")
	} else if err != nil {
		log.Debug("An error occurred while reading the disk block cache "+
			"version file. Using %d as the version and creating a new file "+
			"to record it.", version)
		// TODO: when we increase the version of the disk cache, we'll have
		// to make sure we wipe all previous versions of the disk cache.
	} else {
		// We expect a successfully opened version file to parse a single
		// unsigned integer representing the version. Anything else is a
		// corrupted version file. However, this we can solve by deleting
		// everything in the cache.  TODO: Eventually delete the whole disk
		// cache if we have an out of date version.
		version, err = strconv.ParseUint(string(versionBytes), 10,
			strconv.IntSize)
		if err == nil && version == currentDiskCacheVersion {
			// Success case, no need to write the version file again.
			log.Debug("Loaded the disk block cache version file successfully."+
				" Version: %d", version)
			return versionPathFromVersion(dirPath, version), nil
		}
		if err != nil {
			log.Debug("An error occurred while parsing the disk block cache "+
				"version file. Using %d as the version.",
				currentDiskCacheVersion)
			// TODO: when we increase the version of the disk cache, we'll have
			// to make sure we wipe all previous versions of the disk cache.
			version = currentDiskCacheVersion
		} else if version < currentDiskCacheVersion {
			log.Debug("The disk block cache version file contained an old "+
				"version: %d. Updating to the new version: %d.", version,
				currentDiskCacheVersion)
			// TODO: when we increase the version of the disk cache, we'll have
			// to make sure we wipe all previous versions of the disk cache.
			version = currentDiskCacheVersion
		} else if version > currentDiskCacheVersion {
			log.Debug("The disk block cache version file contained a newer "+
				"version (%d) than this client knows how to read. Switching "+
				"to this client's newest known version: %d.", version,
				currentDiskCacheVersion)
			version = currentDiskCacheVersion
		}
	}
	// Ensure the disk cache directory exists.
	err = os.MkdirAll(dirPath, 0700)
	if err != nil {
		// This does actually need to be fatal.
		return "", err
	}
	versionString := strconv.FormatUint(version, 10)
	err = ioutil.WriteFile(versionFilepath, []byte(versionString), 0600)
	if err != nil {
		// This also needs to be fatal.
		return "", err
	}
	return versionPathFromVersion(dirPath, version), nil
}

// newDiskBlockCacheStandard creates a new *DiskBlockCacheStandard with a
// specified directory on the filesystem as storage.
func newDiskBlockCacheStandard(config diskBlockCacheConfig,
	cacheType diskLimitTrackerType, dirPath string) (
	cache *DiskBlockCacheLocal, err error) {
	log := config.MakeLogger("DBC")
	defer func() {
		if err != nil {
			log.Error("Error initializing disk cache: %+v", err)
		}
	}()
	versionPath, err := getVersionedPathForDiskCache(log, dirPath)
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
	return newDiskBlockCacheStandardFromStorage(config, cacheType,
		blockStorage, metadataStorage, tlfStorage)
}

func newDiskBlockCacheStandardForTest(config diskBlockCacheConfig,
	cacheType diskLimitTrackerType) (*DiskBlockCacheLocal, error) {
	return newDiskBlockCacheStandardFromStorage(
		config, cacheType, storage.NewMemStorage(),
		storage.NewMemStorage(), storage.NewMemStorage())
}

// WaitUntilStarted waits until this cache has started.
func (cache *DiskBlockCacheLocal) WaitUntilStarted() {
	<-cache.startedCh
}

func (cache *DiskBlockCacheLocal) syncBlockCountsFromDb() error {
	cache.log.Debug("+ syncBlockCountsFromDb begin")
	defer cache.log.Debug("- syncBlockCountsFromDb end")
	// We take a write lock for this to prevent any reads from happening while
	// we're syncing the block counts.
	cache.lock.Lock()
	defer cache.lock.Unlock()

	tlfCounts := make(map[tlf.ID]int)
	tlfSizes := make(map[tlf.ID]uint64)
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
		numBlocks++
		totalSize += size
	}
	cache.tlfCounts = tlfCounts
	cache.numBlocks = numBlocks
	cache.tlfSizes = tlfSizes
	cache.currBytes = totalSize
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
	blockKey []byte, metadata DiskBlockCacheMetadata) error {
	metadata.LRUTime = cache.config.Clock().Now()
	encodedMetadata, err := cache.config.Codec().Encode(&metadata)
	if err != nil {
		return err
	}
	err = cache.metaDb.Put(blockKey, encodedMetadata, nil)
	if err != nil {
		cache.log.CWarningf(ctx, "Error writing to disk cache meta "+
			"database: %+v", err)
	}
	return err
}

// getMetadataLocked retrieves the metadata for a block in the cache, or
// returns leveldb.ErrNotFound and a zero-valued metadata otherwise.
func (cache *DiskBlockCacheLocal) getMetadataLocked(blockID kbfsblock.ID) (
	metadata DiskBlockCacheMetadata, err error) {
	metadataBytes, err := cache.metaDb.Get(blockID.Bytes(), nil)
	if err != nil {
		return metadata, err
	}
	err = cache.config.Codec().Decode(metadataBytes, &metadata)
	if cache.cacheType == workingSetCacheLimitTrackerType {
		// KBFS-2402: a bug in a previous master caused the wrong prefetch
		// status to be saved in the working set cache.
		if metadata.FinishedPrefetch == true {
			metadata.TriggeredPrefetch = true
		}
		metadata.FinishedPrefetch = false
	}
	return metadata, err
}

// getLRULocked retrieves the LRU time for a block in the cache, or returns
// leveldb.ErrNotFound and a zero-valued time.Time otherwise.
func (cache *DiskBlockCacheLocal) getLRULocked(blockID kbfsblock.ID) (
	time.Time, error) {
	metadata, err := cache.getMetadataLocked(blockID)
	if err != nil {
		return time.Time{}, err
	}
	return metadata.LRUTime, nil
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

// checkAndLockCache checks whether the cache is started, then locks it based
// on the provided flag, leaving the cache locked.
func (cache *DiskBlockCacheLocal) checkCacheLocked(method string) error {
	select {
	case <-cache.startedCh:
	default:
		// If the cache hasn't started yet, return an error.
		return errors.WithStack(DiskCacheStartingError{method})
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

// Get implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheLocal) Get(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID) (buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	prefetchStatus PrefetchStatus, err error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	err = cache.checkCacheLocked("Get")
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}

	defer func() {
		if err == nil {
			cache.hitMeter.Mark(1)
		} else {
			cache.missMeter.Mark(1)
		}
	}()
	blockKey := blockID.Bytes()
	entry, err := cache.blockDb.Get(blockKey, nil)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch,
			NoSuchBlockError{blockID}
	}
	md, err := cache.getMetadataLocked(blockID)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}
	err = cache.updateMetadataLocked(ctx, blockKey, md)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}
	buf, serverHalf, err = cache.decodeBlockCacheEntry(entry)
	prefetchStatus = NoPrefetch
	if md.FinishedPrefetch {
		prefetchStatus = FinishedPrefetch
	} else if md.TriggeredPrefetch {
		prefetchStatus = TriggeredPrefetch
	}
	return buf, serverHalf, prefetchStatus, err
}

func (cache *DiskBlockCacheLocal) evictUntilBytesAvailable(
	ctx context.Context, encodedLen int64) (hasEnoughSpace bool, err error) {
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

// Put implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheLocal) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err := cache.checkCacheLocked("Put")
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
		if err == nil {
			cache.putMeter.Mark(1)
		} else {
			err = errors.WithStack(err)
		}
		cache.log.CDebugf(ctx, "Cache Put id=%s tlf=%s bSize=%d entrySize=%d "+
			"err=%+v", blockID, tlfID, blockLen, encodedLen, err)
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
			if !cache.config.IsSyncedTlf(tlfID) {
				// TODO: Make better error type
				return errors.New("Attempted to add a block of an unsynced " +
					"TLF to the sync disk cache.")
			}
			bytesAvailable, err := cache.config.DiskLimiter().reserveBytes(
				ctx, cache.cacheType, encodedLen)
			if err != nil {
				cache.log.CWarningf(ctx, "Error obtaining space for the disk "+
					"block cache: %+v", err)
				return err
			}
			if bytesAvailable < 0 {
				return cachePutCacheFullError{blockID}
			}
		} else {
			if cache.config.IsSyncedTlf(tlfID) {
				// TODO: Make better error type
				return errors.New("Attempted to add a block of a synced " +
					"TLF to the working set disk cache.")
			}
			hasEnoughSpace, err := cache.evictUntilBytesAvailable(ctx, encodedLen)
			if err != nil {
				return err
			}
			if !hasEnoughSpace {
				return cachePutCacheFullError{blockID}
			}
		}
		err = cache.blockDb.Put(blockKey, entry, nil)
		if err != nil {
			cache.config.DiskLimiter().commitOrRollback(ctx,
				cache.cacheType, encodedLen, 0, false, "")
			return err
		}
		cache.config.DiskLimiter().commitOrRollback(ctx, cache.cacheType,
			encodedLen, 0, true, "")
		cache.tlfCounts[tlfID]++
		cache.numBlocks++
		encodedLenUint := uint64(encodedLen)
		cache.tlfSizes[tlfID] += encodedLenUint
		cache.currBytes += encodedLenUint
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
	md, err := cache.getMetadataLocked(blockID)
	if err != nil {
		// Only set the relevant fields if we had trouble getting the metadata.
		// Initially leave TriggeredPrefetch and FinishedPrefetch as false;
		// rely on the later-called UpdateMetadata to fix it.
		md.TlfID = tlfID
		md.BlockSize = uint32(encodedLen)
		err = nil
	}
	return cache.updateMetadataLocked(ctx, blockKey, md)
}

// GetMetadata implements the DiskBlockCache interface for
// DiskBlockCacheStandard.
func (cache *DiskBlockCacheLocal) GetMetadata(ctx context.Context,
	blockID kbfsblock.ID) (DiskBlockCacheMetadata, error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	return cache.getMetadataLocked(blockID)
}

// UpdateMetadata implements the DiskBlockCache interface for
// DiskBlockCacheStandard.
func (cache *DiskBlockCacheLocal) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, prefetchStatus PrefetchStatus) (err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked("UpdateMetadata")
	if err != nil {
		return err
	}

	defer func() {
		if err == nil {
			cache.updateMeter.Mark(1)
		}
	}()
	md, err := cache.getMetadataLocked(blockID)
	if err != nil {
		return NoSuchBlockError{blockID}
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
	return cache.updateMetadataLocked(ctx, blockID.Bytes(), md)
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
		cache.tlfCounts[k] -= v
		cache.numBlocks -= v
		cache.tlfSizes[k] -= removalSizes[k]
		cache.currBytes -= removalSizes[k]
	}
	cache.config.DiskLimiter().release(ctx, cache.cacheType,
		sizeRemoved, 0)

	return numRemoved, sizeRemoved, nil
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheLocal) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked("Delete")
	if err != nil {
		return 0, 0, err
	}

	cache.log.CDebugf(ctx, "Cache Delete numBlocks=%d", len(blockIDs))
	return cache.deleteLocked(ctx, blockIDs)
}

// getRandomBlockID gives us a pivot block ID for picking a random range of
// blocks to consider deleting.  We pick a point to start our range based on
// the proportion of the TLF space taken up by numElements/totalElements. E.g.
// if we need to consider 100 out of 400 blocks, and we assume that the block
// IDs are uniformly distributed, then our random start point should be in the
// [0,0.75) interval on the [0,1.0) block ID space.
func (*DiskBlockCacheLocal) getRandomBlockID(numElements,
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
	pivot := (1.0 - (float64(numElements) / float64(totalElements)))
	return kbfsblock.MakeRandomIDInRange(0, pivot)
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

	for i := 0; i < numElements; i++ {
		if !iter.Next() {
			break
		}
		key := iter.Key()

		blockIDBytes := key[len(tlfBytes):]
		if err != nil {
			cache.log.CWarningf(ctx, "Error decoding block ID %x", blockIDBytes)
			continue
		}
		blockID, err := kbfsblock.IDFromBytes(blockIDBytes)
		lru, err := cache.getLRULocked(blockID)
		if err != nil {
			cache.log.CWarningf(ctx, "Error decoding LRU time for block %s",
				blockID)
			continue
		}
		blockIDs = append(blockIDs, lruEntry{blockID, lru})
	}

	return cache.evictSomeBlocks(ctx, numBlocks, blockIDs)
}

// evictLocked evicts a number of blocks from the cache.  We choose a pivot
// variable b randomly. Then begin an iterator into cache.metaDb.Range(b,
// MaxBlockID) and iterate from there to get numBlocks *
// evictionConsiderationFactor block IDs.  We sort the resulting blocks by
// value (LRU time) and pick the minimum numBlocks. We then call cache.Delete()
// on that list of block IDs.
func (cache *DiskBlockCacheLocal) evictLocked(ctx context.Context,
	numBlocks int) (numRemoved int, sizeRemoved int64, err error) {
	defer func() {
		if err == nil {
			cache.evictCountMeter.Mark(int64(numRemoved))
			cache.evictSizeMeter.Mark(sizeRemoved)
		}
	}()
	numElements := numBlocks * evictionConsiderationFactor
	blockID, err := cache.getRandomBlockID(numElements, cache.numBlocks)
	if err != nil {
		return 0, 0, err
	}
	rng := &util.Range{Start: blockID.Bytes(), Limit: cache.maxBlockID}
	iter := cache.metaDb.NewIterator(rng, nil)
	defer iter.Release()

	blockIDs := make(blockIDsByTime, 0, numElements)

	for i := 0; i < numElements; i++ {
		if !iter.Next() {
			break
		}
		key := iter.Key()

		if err != nil {
			cache.log.CWarningf(ctx, "Error decoding block ID %x", key)
			continue
		}
		blockID, err := kbfsblock.IDFromBytes(key)
		metadata := DiskBlockCacheMetadata{}
		err = cache.config.Codec().Decode(iter.Value(), &metadata)
		if err != nil {
			cache.log.CWarningf(ctx, "Error decoding metadata for block %s",
				blockID)
			continue
		}
		blockIDs = append(blockIDs, lruEntry{blockID, metadata.LRUTime})
	}

	return cache.evictSomeBlocks(ctx, numBlocks, blockIDs)
}

// Status implements the DiskBlockCache interface for DiskBlockCacheStandard.
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
	}
	select {
	case <-cache.startedCh:
	default:
		return map[string]DiskBlockCacheStatus{name: {IsStarting: true}}
	}
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	// The disk cache status doesn't depend on the chargedTo ID, and
	// we don't have easy access to the UID here, so pass in a dummy.
	return map[string]DiskBlockCacheStatus{
		name: {
			NumBlocks:       uint64(cache.numBlocks),
			BlockBytes:      cache.currBytes,
			CurrByteLimit:   maxLimit,
			Hits:            rateMeterToStatus(cache.hitMeter),
			Misses:          rateMeterToStatus(cache.missMeter),
			Puts:            rateMeterToStatus(cache.putMeter),
			MetadataUpdates: rateMeterToStatus(cache.updateMeter),
			NumEvicted:      rateMeterToStatus(cache.evictCountMeter),
			SizeEvicted:     rateMeterToStatus(cache.evictSizeMeter),
			NumDeleted:      rateMeterToStatus(cache.deleteCountMeter),
			SizeDeleted:     rateMeterToStatus(cache.deleteSizeMeter),
		},
	}
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheStandard.
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
	cache.config.DiskLimiter().onSimpleByteTrackerDisable(ctx,
		cache.cacheType, int64(cache.currBytes))
	cache.hitMeter.Shutdown()
	cache.missMeter.Shutdown()
	cache.putMeter.Shutdown()
	cache.updateMeter.Shutdown()
	cache.evictCountMeter.Shutdown()
	cache.evictSizeMeter.Shutdown()
	cache.deleteCountMeter.Shutdown()
	cache.deleteSizeMeter.Shutdown()
}
