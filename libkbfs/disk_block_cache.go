// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

const (
	// 10 GB maximum storage by default
	defaultDiskBlockCacheMaxBytes uint64 = 10 * (1 << 30)
	evictionConsiderationFactor   int    = 3
	defaultNumBlocksToEvict       int    = 10
	maxEvictionsPerPut            int    = 4
	blockDbFilename               string = "diskCacheBlocks.leveldb"
	metaDbFilename                string = "diskCacheMetadata.leveldb"
	tlfDbFilename                 string = "diskCacheTLF.leveldb"
	versionFilename               string = "version"
	initialDiskCacheVersion       uint64 = 1
	currentDiskCacheVersion       uint64 = initialDiskCacheVersion
)

// diskBlockCacheConfig specifies the interfaces that a DiskBlockCacheStandard
// needs to perform its functions. This adheres to the standard libkbfs Config
// API.
type diskBlockCacheConfig interface {
	codecGetter
	logMaker
	clockGetter
	diskLimiterGetter
}

// DiskBlockCacheStandard is the standard implementation for DiskBlockCache.
type DiskBlockCacheStandard struct {
	config     diskBlockCacheConfig
	log        logger.Logger
	maxBlockID []byte
	// Track the number of blocks in the cache per TLF and overall.
	tlfCounts map[tlf.ID]int
	numBlocks int
	// Track the aggregate size of blocks in the cache per TLF and overall.
	tlfSizes  map[tlf.ID]uint64
	currBytes uint64
	// This protects the disk caches from being shutdown while they're being
	// accessed.
	lock    sync.RWMutex
	blockDb *leveldb.DB
	metaDb  *leveldb.DB
	tlfDb   *leveldb.DB

	compactCh chan struct{}
}

var _ DiskBlockCache = (*DiskBlockCacheStandard)(nil)

// openLevelDB opens or recovers a leveldb.DB with a passed-in storage.Storage
// as its underlying storage layer.
func openLevelDB(stor storage.Storage) (db *leveldb.DB, err error) {
	db, err = leveldb.Open(stor, leveldbOptions)
	if _, isErrCorrupted := err.(*storage.ErrCorrupted); isErrCorrupted {
		// There's a possibility that if the leveldb wasn't closed properly
		// last time while it was being written, then the manifest is corrupt.
		// This means leveldb must rebuild its manifest, which takes longer
		// than a simple `Open`.
		// TODO: log here
		return leveldb.Recover(stor, leveldbOptions)
	}
	return db, err
}

func diskBlockCacheRootFromStorageRoot(storageRoot string) string {
	return filepath.Join(storageRoot, "kbfs_block_cache")
}

// newDiskBlockCacheStandardFromStorage creates a new *DiskBlockCacheStandard
// with the passed-in storage.Storage interfaces as storage layers for each
// cache.
func newDiskBlockCacheStandardFromStorage(config diskBlockCacheConfig,
	blockStorage, metadataStorage, tlfStorage storage.Storage) (
	cache *DiskBlockCacheStandard, err error) {
	log := config.MakeLogger("KBC")
	blockDb, err := openLevelDB(blockStorage)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			cache.blockDb.Close()
		}
	}()

	metaDb, err := openLevelDB(metadataStorage)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			metaDb.Close()
		}
	}()

	tlfDb, err := openLevelDB(tlfStorage)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			tlfDb.Close()
		}
	}()
	maxBlockID, err := kbfshash.HashFromRaw(kbfshash.DefaultHashType,
		kbfshash.MaxDefaultHash[:])
	if err != nil {
		return nil, err
	}
	compactCh := make(chan struct{}, 1)
	compactCh <- struct{}{}
	cache = &DiskBlockCacheStandard{
		config:     config,
		maxBlockID: maxBlockID.Bytes(),
		tlfCounts:  map[tlf.ID]int{},
		tlfSizes:   map[tlf.ID]uint64{},
		log:        log,
		blockDb:    blockDb,
		metaDb:     metaDb,
		tlfDb:      tlfDb,
		compactCh:  compactCh,
	}
	err = cache.syncBlockCountsFromDb()
	if err != nil {
		return nil, err
	}
	return cache, nil
}

func versionPathFromVersion(dirPath string, version uint64) string {
	return filepath.Join(dirPath, fmt.Sprintf("v%d", version))
}

func getVersionedPathForDiskCache(dirPath string) (versionedDirPath string,
	err error) {
	// Read the version file
	versionFilepath := filepath.Join(dirPath, versionFilename)
	versionBytes, err := ioutil.ReadFile(versionFilepath)
	// We expect the file to open successfully or not exist. Anything else is a
	// problem.
	version := currentDiskCacheVersion
	if ioutil.IsNotExist(err) {
		// Do nothing, meaning that we will create the version file below.
	} else if err != nil {
		return "", err
	} else {
		// We expect a successfully opened version file to parse a single
		// unsigned integer representing the version. Anything else is a
		// corrupted version file. However, this we can solve by deleting
		// everything in the cache.  TODO: Eventually delete the whole disk
		// cache if we have an out of date version.
		version, err = strconv.ParseUint(string(versionBytes), 10,
			strconv.IntSize)
		if err != nil {
			return "", err
		}
		if version < currentDiskCacheVersion {
			return "", errors.WithStack(
				InvalidVersionError{fmt.Sprintf("New disk cache version."+
					" Delete the existing disk cache at path: %s", dirPath)})
		}
		// Existing disk cache version is newer than we expect for this client.
		// This is an error since our client won't understand its format.
		if version > currentDiskCacheVersion {
			return "", errors.WithStack(OutdatedVersionError{})
		}
	}
	err = os.MkdirAll(dirPath, 0700)
	if err != nil {
		return "", err
	}
	versionString := strconv.FormatUint(version, 10)
	err = ioutil.WriteFile(versionFilepath, []byte(versionString), 0600)
	if err != nil {
		return "", err
	}
	return versionPathFromVersion(dirPath, version), nil
}

// newDiskBlockCacheStandard creates a new *DiskBlockCacheStandard with a
// specified directory on the filesystem as storage.
func newDiskBlockCacheStandard(config diskBlockCacheConfig, dirPath string) (
	cache *DiskBlockCacheStandard, err error) {
	versionPath, err := getVersionedPathForDiskCache(dirPath)
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
	return newDiskBlockCacheStandardFromStorage(config, blockStorage,
		metadataStorage, tlfStorage)
}

func (cache *DiskBlockCacheStandard) syncBlockCountsFromDb() error {
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
		metadata := diskBlockCacheMetadata{}
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

// compactCachesLocked manually forces the disk cache databases to compact
// their underlying data.
func (cache *DiskBlockCacheStandard) compactCachesLocked(ctx context.Context) {
	// Execute these in a goroutine so we don't block reads or the completion
	// of the delete that called this. Use a sentinel channel to make sure only
	// one compaction can happen at once.
	select {
	case <-cache.compactCh:
		blockDb := cache.blockDb
		metaDb := cache.metaDb
		tlfDb := cache.tlfDb
		go func() {
			cache.log.CDebugf(ctx, "+ Disk cache compaction starting.")
			cache.log.CDebugf(ctx, "Compacting metadata db.")
			metaDb.CompactRange(util.Range{})
			cache.log.CDebugf(ctx, "Compacting TLF db.")
			tlfDb.CompactRange(util.Range{})
			cache.log.CDebugf(ctx, "Compacting block db.")
			blockDb.CompactRange(util.Range{})
			cache.log.CDebugf(ctx, "- Disk cache compaction complete.")
			// Give back the sentinel.
			cache.compactCh <- struct{}{}
		}()
	default:
		// Don't try to compact if one is already happening
	}
}

// tlfKey generates a TLF cache key from a tlf.ID and a binary-encoded block
// ID.
func (*DiskBlockCacheStandard) tlfKey(tlfID tlf.ID, blockKey []byte) []byte {
	return append(tlfID.Bytes(), blockKey...)
}

// updateMetadataLocked updates the LRU time of a block in the LRU cache to
// the current time.
func (cache *DiskBlockCacheStandard) updateMetadataLocked(ctx context.Context,
	tlfID tlf.ID, blockKey []byte, encodeLen int) error {
	metadata := diskBlockCacheMetadata{
		TlfID:     tlfID,
		LRUTime:   cache.config.Clock().Now(),
		BlockSize: uint32(encodeLen),
	}
	encodedMetadata, err := cache.config.Codec().Encode(&metadata)
	if err != nil {
		return err
	}
	err = cache.metaDb.Put(blockKey, encodedMetadata, nil)
	if err != nil {
		cache.log.CWarningf(ctx, "Error writing to LRU cache database: %+v",
			err)
	}
	return err
}

// getMetadata retrieves the metadata for a block in the cache, or returns
// leveldb.ErrNotFound and a zero-valued metadata otherwise.
func (cache *DiskBlockCacheStandard) getMetadata(blockID kbfsblock.ID) (
	metadata diskBlockCacheMetadata, err error) {
	metadataBytes, err := cache.metaDb.Get(blockID.Bytes(), nil)
	if err != nil {
		return metadata, err
	}
	err = cache.config.Codec().Decode(metadataBytes, &metadata)
	return metadata, err
}

// getLRU retrieves the LRU time for a block in the cache, or returns
// leveldb.ErrNotFound and a zero-valued time.Time otherwise.
func (cache *DiskBlockCacheStandard) getLRU(blockID kbfsblock.ID) (
	time.Time, error) {
	metadata, err := cache.getMetadata(blockID)
	if err != nil {
		return time.Time{}, err
	}
	return metadata.LRUTime, nil
}

// decodeBlockCacheEntry decodes a disk block cache entry buffer into an
// encoded block and server half.
func (cache *DiskBlockCacheStandard) decodeBlockCacheEntry(buf []byte) ([]byte,
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
	blockID kbfsblock.ID) (buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.blockDb == nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			errors.WithStack(DiskCacheClosedError{"Get"})
	}
	defer func() {
		cache.log.CDebugf(ctx, "Cache Get id=%s tlf=%s bSize=%d err=%+v",
			blockID, tlfID, len(buf), err)
	}()
	blockKey := blockID.Bytes()
	entry, err := cache.blockDb.Get(blockKey, nil)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			NoSuchBlockError{blockID}
	}
	err = cache.updateMetadataLocked(ctx, tlfID, blockKey, len(entry))
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return cache.decodeBlockCacheEntry(entry)
}

// Put implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	if cache.blockDb == nil {
		return errors.WithStack(DiskCacheClosedError{"Put"})
	}
	blockLen := len(buf)
	entry, err := cache.encodeBlockCacheEntry(buf, serverHalf)
	if err != nil {
		return err
	}
	encodedLen := int64(len(entry))
	defer func() {
		cache.log.CDebugf(ctx, "Cache Put id=%s tlf=%s bSize=%d entrySize=%d "+
			"err=%+v", blockID, tlfID, blockLen, encodedLen, err)
	}()
	blockKey := blockID.Bytes()
	hasKey, err := cache.blockDb.Has(blockKey, nil)
	if err != nil {
		return err
	}
	if !hasKey {
		i := 0
		for ; i < maxEvictionsPerPut; i++ {
			select {
			// Ensure we don't loop infinitely
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			bytesAvailable, err :=
				cache.config.DiskLimiter().beforeDiskBlockCachePut(ctx,
					encodedLen)
			if err != nil {
				cache.log.CWarningf(ctx, "Error obtaining space for the disk "+
					"block cache: %+v", err)
				return err
			}
			if bytesAvailable >= 0 {
				break
			}
			numRemoved, _, err := cache.evictLocked(ctx,
				defaultNumBlocksToEvict)
			if err != nil {
				return err
			}
			if numRemoved == 0 {
				return errors.New("couldn't evict any more blocks from the " +
					"disk block cache")
			}
		}
		if i == maxEvictionsPerPut {
			return cachePutCacheFullError{blockID}
		}
		err = cache.blockDb.Put(blockKey, entry, nil)
		if err != nil {
			cache.config.DiskLimiter().afterDiskBlockCachePut(ctx, encodedLen,
				false)
			return err
		}
		cache.config.DiskLimiter().afterDiskBlockCachePut(ctx, encodedLen, true)
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
	return cache.updateMetadataLocked(ctx, tlfID, blockKey, int(encodedLen))
}

// UpdateLRUTime implements the DiskBlockCache interface for
// DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) UpdateLRUTime(ctx context.Context,
	blockID kbfsblock.ID) (err error) {
	var md diskBlockCacheMetadata
	defer func() {
		cache.log.CDebugf(ctx, "Cache UpdateLRUTime id=%s entrySize=%d "+
			"err=%+v", blockID, md.BlockSize, err)
	}()
	// Only obtain a read lock because this happens on Get, not on Put.
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	md, err = cache.getMetadata(blockID)
	if err != nil {
		return NoSuchBlockError{blockID}
	}
	return cache.updateMetadataLocked(ctx, md.TlfID, blockID.Bytes(),
		int(md.BlockSize))
}

// Size implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Size() int64 {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	return int64(cache.currBytes)
}

// deleteLocked deletes a set of blocks from the disk block cache.
func (cache *DiskBlockCacheStandard) deleteLocked(ctx context.Context,
	blockEntries []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	if len(blockEntries) == 0 {
		return 0, 0, nil
	}
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
		metadata := diskBlockCacheMetadata{}
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

	cache.compactCachesLocked(ctx)

	// Update the cache's totals.
	for k, v := range removalCounts {
		cache.tlfCounts[k] -= v
		cache.numBlocks -= v
		cache.tlfSizes[k] -= removalSizes[k]
		cache.currBytes -= removalSizes[k]
	}
	cache.config.DiskLimiter().onDiskBlockCacheDelete(ctx, sizeRemoved)

	return numRemoved, sizeRemoved, nil
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	if cache.blockDb == nil {
		return 0, 0, errors.WithStack(DiskCacheClosedError{"Delete"})
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
func (*DiskBlockCacheStandard) getRandomBlockID(numElements,
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

func (cache *DiskBlockCacheStandard) evictSomeBlocks(ctx context.Context,
	numBlocks int, blockIDs blockIDsByTime) (numRemoved int, sizeRemoved int64,
	err error) {
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
func (cache *DiskBlockCacheStandard) evictFromTLFLocked(ctx context.Context,
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
		lru, err := cache.getLRU(blockID)
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
func (cache *DiskBlockCacheStandard) evictLocked(ctx context.Context,
	numBlocks int) (numRemoved int, sizeRemoved int64, err error) {
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
		metadata := diskBlockCacheMetadata{}
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

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Shutdown(ctx context.Context) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	// Receive from the compactCh sentinel to wait for pending compactions.
	<-cache.compactCh
	if cache.blockDb == nil {
		return
	}
	err := cache.blockDb.Close()
	if err != nil {
		cache.log.CWarningf(ctx, "Error closing blockDb: %+v", err)
	}
	cache.blockDb = nil
	err = cache.metaDb.Close()
	if err != nil {
		cache.log.CWarningf(ctx, "Error closing blockDb: %+v", err)
	}
	cache.metaDb = nil
	cache.config.DiskLimiter().onDiskBlockCacheDisable(ctx,
		int64(cache.currBytes))
}
