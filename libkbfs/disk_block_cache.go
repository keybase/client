// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding/hex"
	"fmt"
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
	blockDbFilename               string = "diskCacheBlocks.leveldb"
	lruDbFilename                 string = "diskCacheLRU.leveldb"
	versionFilename               string = "version"
	initialDiskCacheVersion       uint64 = 1
	currentDiskCacheVersion       uint64 = initialDiskCacheVersion
)

// diskBlockCacheEntry packages an encoded block and serverHalf into one data
// structure, allowing us to encode it as one set of bytes.
type diskBlockCacheEntry struct {
	Buf        []byte
	ServerHalf kbfscrypto.BlockCryptKeyServerHalf
}

// diskBlockCacheConfig specifies the interfaces that a DiskBlockCacheStandard
// needs to perform its functions. This adheres to the standard libkbfs Config
// API.
type diskBlockCacheConfig interface {
	codecGetter
	logMaker
	clockGetter
}

// DiskBlockCacheStandard is the standard implementation for DiskBlockCache.
type DiskBlockCacheStandard struct {
	config     diskBlockCacheConfig
	maxBytes   uint64
	maxBlockID []byte
	tlfCounts  map[tlf.ID]int
	log        logger.Logger
	// protects the disk caches from being shutdown while they're being
	// accessed
	lock    sync.RWMutex
	blockDb *leveldb.DB
	lruDb   *leveldb.DB
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

// newDiskBlockCacheStandardFromStorage creates a new *DiskBlockCacheStandard
// with the passed-in storage.Storage interfaces as storage layers for each
// cache.
func newDiskBlockCacheStandardFromStorage(config diskBlockCacheConfig,
	blockStorage, lruStorage storage.Storage, maxBytes uint64) (
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

	lruDb, err := openLevelDB(lruStorage)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			lruDb.Close()
		}
	}()
	maxBlockID, err := kbfshash.HashFromRaw(kbfshash.DefaultHashType,
		kbfshash.MaxDefaultHash[:])
	if err != nil {
		return nil, err
	}
	return &DiskBlockCacheStandard{
		config:     config,
		maxBytes:   maxBytes,
		maxBlockID: maxBlockID.Bytes(),
		tlfCounts:  map[tlf.ID]int{},
		log:        log,
		blockDb:    blockDb,
		lruDb:      lruDb,
	}, nil
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
		// We expect a successfully opened version file to parse a single unsigned
		// integer representing the version. Anything else is a corrupted version
		// file. However, this we can solve by deleting everything in the cache.
		// TODO: Eventually delete the whole disk cache if we have an out of
		// date version.
		version, err = strconv.ParseUint(string(versionBytes), 10, strconv.IntSize)
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
	versionString := strconv.FormatUint(version, 10)
	err = ioutil.WriteFile(versionFilepath, []byte(versionString), 0600)
	if err != nil {
		return "", err
	}
	return versionPathFromVersion(dirPath, version), nil
}

// newDiskBlockCacheStandard creates a new *DiskBlockCacheStandard with a
// specified directory on the filesystem as storage.
func newDiskBlockCacheStandard(config diskBlockCacheConfig, dirPath string,
	maxBytes uint64) (*DiskBlockCacheStandard, error) {
	versionPath, err := getVersionedPathForDiskCache(dirPath)
	if err != nil {
		return nil, err
	}
	blockDbPath := filepath.Join(versionPath, blockDbFilename)
	blockStorage, err := storage.OpenFile(blockDbPath, false)
	if err != nil {
		return nil, err
	}
	lruDbPath := filepath.Join(versionPath, lruDbFilename)
	lruStorage, err := storage.OpenFile(lruDbPath, false)
	if err != nil {
		blockStorage.Close()
		return nil, err
	}
	cache, err := newDiskBlockCacheStandardFromStorage(config, blockStorage,
		lruStorage, maxBytes)
	if err != nil {
		return nil, err
	}
	err = cache.syncBlockCountsFromDb()
	if err != nil {
		return nil, err
	}
	return cache, nil
}

func (cache *DiskBlockCacheStandard) syncBlockCountsFromDb() error {
	// This lock is unnecessary because we don't allow concurrent access until
	// it's done. But can't hurt.
	cache.lock.RLock()
	defer cache.lock.RUnlock()

	tlfIDLen := len(tlf.NullID.Bytes())
	tlfCounts := make(map[tlf.ID]int)
	iter := cache.lruDb.NewIterator(nil, nil)
	for iter.Next() {
		key := iter.Key()
		tlfIDBytes := key[:tlfIDLen]
		tlfID := tlf.NullID
		err := tlfID.UnmarshalBinary(tlfIDBytes)
		if err != nil {
			return err
		}
		tlfCounts[tlfID] += 1
	}
	cache.tlfCounts = tlfCounts
	return nil
}

// TODO: Fix getSizesLocked(), where leveldb.DB.SizeOf() currently doesn't work
// for the full range. As it is right now, this is a very cheap operation,
// since it just takes the beginning and end offsets from levelDB and returns
// the difference.
func (cache *DiskBlockCacheStandard) getSizesLocked() (blockSize int64,
	lruSize int64, err error) {
	// a util.Range{nil, nil} is supposed to work for the full range based on
	// other methods, but it appears not to work for SizeOf. Need to implement
	// by querying the files in the LevelDB directory instead. Ugh.
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

// compactCachesLocked manually forces both the block cache and LRU cache to
// compact their underlying data.
func (cache *DiskBlockCacheStandard) compactCachesLocked(ctx context.Context) {
	cache.blockDb.CompactRange(util.Range{})
	cache.lruDb.CompactRange(util.Range{})
	bSize, lruSize, err := cache.getSizesLocked()
	cache.log.CDebugf(ctx, "Disk Cache bSize=%d lruSize=%d err=%+v", bSize, lruSize, err)
}

// lruKey generates an LRU cache key from a tlf.ID and a binary-encoded block
// ID.
func (*DiskBlockCacheStandard) lruKey(tlfID tlf.ID, blockKey []byte) []byte {
	return append(tlfID.Bytes(), blockKey...)
}

// updateLRULocked updates the LRU time of a block in the LRU cache to
// the current time.
func (cache *DiskBlockCacheStandard) updateLRULocked(ctx context.Context,
	tlfID tlf.ID, blockKey []byte) error {
	key := cache.lruKey(tlfID, blockKey)
	val, err := cache.config.Clock().Now().MarshalBinary()
	if err != nil {
		return err
	}
	err = cache.lruDb.Put(key, val, nil)
	if err != nil {
		cache.log.CWarningf(ctx, "Error writing to LRU cache database: %+v", err)
	}
	return nil
}

// timeFromBytes converts a value from the LRU cache into a time.Time.
func (*DiskBlockCacheStandard) timeFromBytes(b []byte) (t time.Time, err error) {
	err = t.UnmarshalBinary(b)
	return t, err
}

// getLRU retrieves the LRU time for a block in the cache, or returns
// leveldb.ErrNotFound and a zero-valued time.Time otherwise.
func (cache *DiskBlockCacheStandard) getLRU(tlfID tlf.ID,
	blockID kbfsblock.ID) (time.Time, error) {
	lruKey := cache.lruKey(tlfID, blockID.Bytes())
	lruBytes, err := cache.lruDb.Get(lruKey, nil)
	if err != nil {
		return time.Time{}, err
	}
	return cache.timeFromBytes(lruBytes)
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
	err = cache.updateLRULocked(ctx, tlfID, blockKey)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return cache.decodeBlockCacheEntry(entry)
}

// Put implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.blockDb == nil {
		return errors.WithStack(DiskCacheClosedError{"Put"})
	}
	blockLen := len(buf)
	// TODO: accounting
	entry, err := cache.encodeBlockCacheEntry(buf, serverHalf)
	if err != nil {
		return err
	}
	encodeLen := len(entry)
	defer func() {
		cache.log.CDebugf(ctx, "Cache Put id=%s tlf=%s bSize=%d entrySize=%d err=%+v", blockID, tlfID, blockLen, encodeLen, err)
	}()
	blockKey := blockID.Bytes()
	hasKey, err := cache.blockDb.Has(blockKey, nil)
	if err != nil {
		return err
	}
	err = cache.blockDb.Put(blockKey, entry, nil)
	if err != nil {
		return err
	}
	if !hasKey {
		cache.tlfCounts[tlfID] += 1
	}
	return cache.updateLRULocked(ctx, tlfID, blockKey)
}

func (cache *DiskBlockCacheStandard) deleteLocked(ctx context.Context,
	tlfID tlf.ID, blockIDs []kbfsblock.ID) error {
	if len(blockIDs) == 0 {
		return nil
	}
	cache.log.CDebugf(ctx, "Cache Delete tlf=%s numBlocks=%d", tlfID, len(blockIDs))
	blockBatch := new(leveldb.Batch)
	lruBatch := new(leveldb.Batch)
	for _, id := range blockIDs {
		blockKey := id.Bytes()
		blockBatch.Delete(blockKey)
		lruKey := cache.lruKey(tlfID, blockKey)
		lruBatch.Delete(lruKey)
	}
	if err := cache.blockDb.Write(blockBatch, nil); err != nil {
		return err
	}
	if err := cache.lruDb.Write(lruBatch, nil); err != nil {
		return err
	}

	cache.compactCachesLocked(ctx)
	cache.tlfCounts[tlfID] -= len(blockIDs)

	return nil
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Delete(ctx context.Context, tlfID tlf.ID,
	blockIDs []kbfsblock.ID) error {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	if cache.blockDb == nil {
		return errors.WithStack(DiskCacheClosedError{"Delete"})
	}
	return cache.deleteLocked(ctx, tlfID, blockIDs)
}

// evictLocked evicts a number of blocks from the cache.
func (cache *DiskBlockCacheStandard) evictLocked(ctx context.Context,
	tlfID tlf.ID, numBlocks int) (numRemoved int, err error) {
	// Use kbfscrypto.MakeTemporaryID() to create a random hash ID. Then begin
	// an iterator into cache.lruDb.Range(tlfID + b, tlfID + MaxBlockID) and
	// iterate from there to get numBlocks * evictionConsiderationFactor block
	// IDs.  We sort the resulting blocks by value (LRU time) and pick the
	// minimum numBlocks. We then call cache.Delete() on that list of block
	// IDs.
	tlfBytes := tlfID.Bytes()
	// We actually need a random range, not a random block ID. so, we pick a
	// point to start our range, based on the proportion of the TLF space taken
	// up by numBlocks/cache.tlfCounts[tlfID]. E.g. if we need to remove 100
	// out of 400 blocks, and we assume that the block IDs are uniformly
	// distributed, then our random start point should be in the [0,0.75)
	// interval on the [0,1.0) block ID space. This means that if we need to
	// remove all the blocks for the TLF, we can consider the whole range.
	var rng *util.Range
	if numBlocks > cache.tlfCounts[tlfID] {
		randomBlockID, err := kbfsblock.MakeTemporaryID()
		if err != nil {
			return 0, err
		}
		rng = &util.Range{
			append(tlfBytes, randomBlockID.Bytes()...),
			append(tlfBytes, cache.maxBlockID...),
		}
	}
	iter := cache.lruDb.NewIterator(rng, nil)

	numElements := numBlocks * evictionConsiderationFactor
	blockIDs := make(blockIDsByTime, 0, numElements)

	for i := 0; i < numElements; i++ {
		if !iter.Next() {
			break
		}
		key := iter.Key()
		value := iter.Value()

		blockIDBytes := key[len(tlfBytes):]
		blockID, err := kbfsblock.IDFromBytes(blockIDBytes)
		if err != nil {
			cache.log.CWarningf(ctx, "Error decoding block ID %s", hex.Dump(blockIDBytes))
			continue
		}
		lru, err := cache.timeFromBytes(value)
		if err != nil {
			cache.log.CWarningf(ctx, "Error decoding LRU time for block %s", blockID)
		}
		blockIDs = append(blockIDs, lruEntry{blockID, lru})
	}

	// Remove all blocks in this TLF.
	if len(blockIDs) <= numBlocks {
		cache.deleteLocked(ctx, tlfID, blockIDs.ToBlockIDSlice(len(blockIDs)))
		return len(blockIDs), nil
	}

	// Only sort if we need to grab a subset of blocks.
	sort.Sort(blockIDs)
	// Remove the first numBlocks.
	cache.deleteLocked(ctx, tlfID, blockIDs.ToBlockIDSlice(numBlocks))
	return numBlocks, nil
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheStandard.
func (cache *DiskBlockCacheStandard) Shutdown(ctx context.Context) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	if cache.blockDb == nil {
		return
	}
	err := cache.blockDb.Close()
	if err != nil {
		cache.log.CWarningf(ctx, "Error closing blockDb: %+v", err)
	}
	cache.blockDb = nil
	err = cache.lruDb.Close()
	if err != nil {
		cache.log.CWarningf(ctx, "Error closing blockDb: %+v", err)
	}
	cache.lruDb = nil
}
