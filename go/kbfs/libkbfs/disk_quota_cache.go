// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"io"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb/filter"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

const (
	quotaDbFilename              string = "diskCacheQuota.leveldb"
	initialDiskQuotaCacheVersion uint64 = 1
	currentDiskQuotaCacheVersion uint64 = initialDiskQuotaCacheVersion
	defaultQuotaCacheTableSize   int    = 50 * opt.MiB
	quotaCacheFolderName         string = "kbfs_quota_cache"
)

// diskQuotaCacheConfig specifies the interfaces that a DiskQuotaCacheLocal
// needs to perform its functions. This adheres to the standard libkbfs Config
// API.
type diskQuotaCacheConfig interface {
	codecGetter
	logMaker
}

// DiskQuotaCacheLocal is the standard implementation for DiskQuotaCache.
type DiskQuotaCacheLocal struct {
	config diskQuotaCacheConfig
	log    logger.Logger

	// Track the cache hit rate and eviction rate
	hitMeter  *CountMeter
	missMeter *CountMeter
	putMeter  *CountMeter
	// Protect the disk caches from being shutdown while they're being
	// accessed, and mutable data.
	lock         sync.RWMutex
	db           *LevelDb // id -> quota info
	quotasCached map[keybase1.UserOrTeamID]bool

	startedCh  chan struct{}
	startErrCh chan struct{}
	shutdownCh chan struct{}

	closer func()
}

var _ DiskQuotaCache = (*DiskQuotaCacheLocal)(nil)

// DiskQuotaCacheStartState represents whether this disk Quota cache has
// started or failed.
type DiskQuotaCacheStartState int

// String allows DiskQuotaCacheStartState to be output as a string.
func (s DiskQuotaCacheStartState) String() string {
	switch s {
	case DiskQuotaCacheStartStateStarting:
		return "starting"
	case DiskQuotaCacheStartStateStarted:
		return "started"
	case DiskQuotaCacheStartStateFailed:
		return "failed"
	default:
		return "unknown"
	}
}

const (
	// DiskQuotaCacheStartStateStarting represents when the cache is starting.
	DiskQuotaCacheStartStateStarting DiskQuotaCacheStartState = iota
	// DiskQuotaCacheStartStateStarted represents when the cache has started.
	DiskQuotaCacheStartStateStarted
	// DiskQuotaCacheStartStateFailed represents when the cache has failed to
	// start.
	DiskQuotaCacheStartStateFailed
)

// DiskQuotaCacheStatus represents the status of the Quota cache.
type DiskQuotaCacheStatus struct {
	StartState DiskQuotaCacheStartState
	NumQuotas  uint64
	Hits       MeterStatus
	Misses     MeterStatus
	Puts       MeterStatus
	DBStats    []string `json:",omitempty"`
}

// newDiskQuotaCacheLocalFromStorage creates a new *DiskQuotaCacheLocal
// with the passed-in storage.Storage interfaces as storage layers for each
// cache.
func newDiskQuotaCacheLocalFromStorage(
	config diskQuotaCacheConfig, quotaStorage storage.Storage, mode InitMode) (
	cache *DiskQuotaCacheLocal, err error) {
	log := config.MakeLogger("DQC")
	closers := make([]io.Closer, 0, 1)
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
	quotaDbOptions := leveldbOptionsFromMode(mode)
	quotaDbOptions.CompactionTableSize = defaultQuotaCacheTableSize
	quotaDbOptions.Filter = filter.NewBloomFilter(16)
	db, err := openLevelDBWithOptions(quotaStorage, quotaDbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, db)

	startedCh := make(chan struct{})
	startErrCh := make(chan struct{})
	cache = &DiskQuotaCacheLocal{
		config:       config,
		hitMeter:     NewCountMeter(),
		missMeter:    NewCountMeter(),
		putMeter:     NewCountMeter(),
		log:          log,
		db:           db,
		quotasCached: make(map[keybase1.UserOrTeamID]bool),
		startedCh:    startedCh,
		startErrCh:   startErrCh,
		shutdownCh:   make(chan struct{}),
		closer:       closer,
	}
	// Sync the quota counts asynchronously so syncing doesn't block init.
	// Since this method blocks, any Get or Put requests to the disk Quota
	// cache will block until this is done. The log will contain the beginning
	// and end of this sync.
	go func() {
		err := cache.syncQuotaCountsFromDb()
		if err != nil {
			close(startErrCh)
			closer()
			log.Warning("Disabling disk quota cache due to error syncing the "+
				"quota counts from DB: %+v", err)
			return
		}
		close(startedCh)
	}()
	return cache, nil
}

// newDiskQuotaCacheLocal creates a new *DiskQuotaCacheLocal with a
// specified directory on the filesystem as storage.
func newDiskQuotaCacheLocal(
	config diskBlockCacheConfig, dirPath string, mode InitMode) (
	cache *DiskQuotaCacheLocal, err error) {
	log := config.MakeLogger("DQC")
	defer func() {
		if err != nil {
			log.Error("Error initializing quota cache: %+v", err)
		}
	}()
	cachePath := filepath.Join(dirPath, quotaCacheFolderName)
	versionPath, err := getVersionedPathForDiskCache(
		log, cachePath, "quota", currentDiskQuotaCacheVersion)
	if err != nil {
		return nil, err
	}
	dbPath := filepath.Join(versionPath, quotaDbFilename)
	quotaStorage, err := storage.OpenFile(dbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			quotaStorage.Close()
		}
	}()
	return newDiskQuotaCacheLocalFromStorage(config, quotaStorage, mode)
}

// WaitUntilStarted waits until this cache has started.
func (cache *DiskQuotaCacheLocal) WaitUntilStarted() error {
	select {
	case <-cache.startedCh:
		return nil
	case <-cache.startErrCh:
		return DiskQuotaCacheError{"error starting channel"}
	}
}

func (cache *DiskQuotaCacheLocal) syncQuotaCountsFromDb() error {
	cache.log.Debug("+ syncQuotaCountsFromDb begin")
	defer cache.log.Debug("- syncQuotaCountsFromDb end")
	// We take a write lock for this to prevent any reads from happening while
	// we're syncing the Quota counts.
	cache.lock.Lock()
	defer cache.lock.Unlock()

	quotasCached := make(map[keybase1.UserOrTeamID]bool)
	iter := cache.db.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		var id keybase1.UserOrTeamID
		id, err := keybase1.UserOrTeamIDFromString(string(iter.Key()))
		if err != nil {
			return err
		}

		quotasCached[id] = true
	}
	cache.quotasCached = quotasCached
	return nil
}

// getQuotaLocked retrieves the quota info for a block in the cache,
// or returns leveldb.ErrNotFound and a zero-valued metadata
// otherwise.
func (cache *DiskQuotaCacheLocal) getQuotaLocked(
	id keybase1.UserOrTeamID, metered bool) (
	info kbfsblock.QuotaInfo, err error) {
	var hitMeter, missMeter *CountMeter
	if metered {
		hitMeter = cache.hitMeter
		missMeter = cache.missMeter
	}

	quotaBytes, err := cache.db.GetWithMeter(
		[]byte(id.String()), hitMeter, missMeter)
	if err != nil {
		return kbfsblock.QuotaInfo{}, err
	}
	err = cache.config.Codec().Decode(quotaBytes, &info)
	if err != nil {
		return kbfsblock.QuotaInfo{}, err
	}
	return info, nil
}

// checkAndLockCache checks whether the cache is started.
func (cache *DiskQuotaCacheLocal) checkCacheLocked(
	ctx context.Context, method string) error {
	// First see if the context has expired since we began.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

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
	if cache.db == nil {
		return errors.WithStack(DiskCacheClosedError{method})
	}
	return nil
}

// Get implements the DiskQuotaCache interface for DiskQuotaCacheLocal.
func (cache *DiskQuotaCacheLocal) Get(
	ctx context.Context, id keybase1.UserOrTeamID) (
	info kbfsblock.QuotaInfo, err error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	err = cache.checkCacheLocked(ctx, "Quota(Get)")
	if err != nil {
		return kbfsblock.QuotaInfo{}, err
	}

	return cache.getQuotaLocked(id, metered)
}

// Put implements the DiskQuotaCache interface for DiskQuotaCacheLocal.
func (cache *DiskQuotaCacheLocal) Put(
	ctx context.Context, id keybase1.UserOrTeamID,
	info kbfsblock.QuotaInfo) (err error) {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err = cache.checkCacheLocked(ctx, "Quota(Put)")
	if err != nil {
		return err
	}

	encodedInfo, err := cache.config.Codec().Encode(&info)
	if err != nil {
		return err
	}

	err = cache.db.PutWithMeter(
		[]byte(id.String()), encodedInfo, cache.putMeter)
	if err != nil {
		return err
	}

	cache.quotasCached[id] = true
	return nil
}

// Status implements the DiskQuotaCache interface for DiskQuotaCacheLocal.
func (cache *DiskQuotaCacheLocal) Status(
	ctx context.Context) DiskQuotaCacheStatus {
	select {
	case <-cache.startedCh:
	case <-cache.startErrCh:
		return DiskQuotaCacheStatus{StartState: DiskQuotaCacheStartStateFailed}
	default:
		return DiskQuotaCacheStatus{StartState: DiskQuotaCacheStartStateStarting}
	}

	cache.lock.RLock()
	defer cache.lock.RUnlock()

	var dbStats []string
	if err := cache.checkCacheLocked(ctx, "Quota(Status)"); err == nil {
		dbStats, err = cache.db.StatStrings()
		if err != nil {
			cache.log.CDebugf(ctx, "Couldn't get db stats: %+v", err)
		}
	}

	return DiskQuotaCacheStatus{
		StartState: DiskQuotaCacheStartStateStarted,
		NumQuotas:  uint64(len(cache.quotasCached)),
		Hits:       rateMeterToStatus(cache.hitMeter),
		Misses:     rateMeterToStatus(cache.missMeter),
		Puts:       rateMeterToStatus(cache.putMeter),
		DBStats:    dbStats,
	}
}

// Shutdown implements the DiskQuotaCache interface for DiskQuotaCacheLocal.
func (cache *DiskQuotaCacheLocal) Shutdown(ctx context.Context) {
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
		return
	default:
	}
	close(cache.shutdownCh)
	if cache.db == nil {
		return
	}
	cache.closer()
	cache.db = nil
	cache.hitMeter.Shutdown()
	cache.missMeter.Shutdown()
	cache.putMeter.Shutdown()
}
