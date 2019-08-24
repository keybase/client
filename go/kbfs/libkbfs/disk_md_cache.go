// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"io"
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/filter"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

const (
	headsDbFilename           string = "diskCacheMDHeads.leveldb"
	initialDiskMDCacheVersion uint64 = 1
	currentDiskMDCacheVersion uint64 = initialDiskMDCacheVersion
	defaultMDCacheTableSize   int    = 50 * opt.MiB
	mdCacheFolderName         string = "kbfs_md_cache"
)

// diskMDCacheConfig specifies the interfaces that a DiskMDCacheStandard
// needs to perform its functions. This adheres to the standard libkbfs Config
// API.
type diskMDCacheConfig interface {
	codecGetter
	logMaker
}

type diskMDBlock struct {
	// Exported only for serialization.
	Buf      []byte
	Ver      kbfsmd.MetadataVer
	Time     time.Time
	Revision kbfsmd.Revision
}

// DiskMDCacheLocal is the standard implementation for DiskMDCache.
type DiskMDCacheLocal struct {
	config diskMDCacheConfig
	log    logger.Logger

	// Track the cache hit rate and eviction rate
	hitMeter  *CountMeter
	missMeter *CountMeter
	putMeter  *CountMeter
	// Protect the disk caches from being shutdown while they're being
	// accessed, and mutable data.
	lock       sync.RWMutex
	headsDb    *LevelDb // tlfID -> metadata block
	tlfsCached map[tlf.ID]kbfsmd.Revision
	tlfsStaged map[tlf.ID][]diskMDBlock

	startedCh  chan struct{}
	startErrCh chan struct{}
	shutdownCh chan struct{}

	closer func()
}

var _ DiskMDCache = (*DiskMDCacheLocal)(nil)

// DiskMDCacheStartState represents whether this disk MD cache has
// started or failed.
type DiskMDCacheStartState int

// String allows DiskMDCacheStartState to be output as a string.
func (s DiskMDCacheStartState) String() string {
	switch s {
	case DiskMDCacheStartStateStarting:
		return "starting"
	case DiskMDCacheStartStateStarted:
		return "started"
	case DiskMDCacheStartStateFailed:
		return "failed"
	default:
		return "unknown"
	}
}

const (
	// DiskMDCacheStartStateStarting represents when the cache is starting.
	DiskMDCacheStartStateStarting DiskMDCacheStartState = iota
	// DiskMDCacheStartStateStarted represents when the cache has started.
	DiskMDCacheStartStateStarted
	// DiskMDCacheStartStateFailed represents when the cache has failed to
	// start.
	DiskMDCacheStartStateFailed
)

// DiskMDCacheStatus represents the status of the MD cache.
type DiskMDCacheStatus struct {
	StartState DiskMDCacheStartState
	NumMDs     uint64
	NumStaged  uint64
	Hits       MeterStatus
	Misses     MeterStatus
	Puts       MeterStatus
	DBStats    []string `json:",omitempty"`
}

// newDiskMDCacheLocalFromStorage creates a new *DiskMDCacheLocal
// with the passed-in storage.Storage interfaces as storage layers for each
// cache.
func newDiskMDCacheLocalFromStorage(
	config diskMDCacheConfig, headsStorage storage.Storage, mode InitMode) (
	cache *DiskMDCacheLocal, err error) {
	log := config.MakeLogger("DMC")
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
	mdDbOptions := leveldbOptionsFromMode(mode)
	mdDbOptions.CompactionTableSize = defaultMDCacheTableSize
	mdDbOptions.Filter = filter.NewBloomFilter(16)
	headsDb, err := openLevelDBWithOptions(headsStorage, mdDbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, headsDb)

	startedCh := make(chan struct{})
	startErrCh := make(chan struct{})
	cache = &DiskMDCacheLocal{
		config:     config,
		hitMeter:   NewCountMeter(),
		missMeter:  NewCountMeter(),
		putMeter:   NewCountMeter(),
		log:        log,
		headsDb:    headsDb,
		tlfsStaged: make(map[tlf.ID][]diskMDBlock),
		startedCh:  startedCh,
		startErrCh: startErrCh,
		shutdownCh: make(chan struct{}),
		closer:     closer,
	}
	// Sync the MD counts asynchronously so syncing doesn't block init.
	// Since this method blocks, any Get or Put requests to the disk MD
	// cache will block until this is done. The log will contain the beginning
	// and end of this sync.
	go func() {
		err := cache.syncMDCountsFromDb()
		if err != nil {
			close(startErrCh)
			closer()
			log.Warning("Disabling disk MD cache due to error syncing the "+
				"MD counts from DB: %+v", err)
			return
		}
		close(startedCh)
	}()
	return cache, nil
}

// newDiskMDCacheLocal creates a new *DiskMDCacheLocal with a
// specified directory on the filesystem as storage.
func newDiskMDCacheLocal(
	config diskBlockCacheConfig, dirPath string, mode InitMode) (
	cache *DiskMDCacheLocal, err error) {
	log := config.MakeLogger("DMC")
	defer func() {
		if err != nil {
			log.Error("Error initializing MD cache: %+v", err)
		}
	}()
	cachePath := filepath.Join(dirPath, mdCacheFolderName)
	versionPath, err := getVersionedPathForDiskCache(
		log, cachePath, "md", currentDiskMDCacheVersion)
	if err != nil {
		return nil, err
	}
	headsDbPath := filepath.Join(versionPath, headsDbFilename)
	headsStorage, err := storage.OpenFile(headsDbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			headsStorage.Close()
		}
	}()
	return newDiskMDCacheLocalFromStorage(config, headsStorage, mode)
}

// WaitUntilStarted waits until this cache has started.
func (cache *DiskMDCacheLocal) WaitUntilStarted() error {
	select {
	case <-cache.startedCh:
		return nil
	case <-cache.startErrCh:
		return DiskMDCacheError{"error starting channel"}
	}
}

func (cache *DiskMDCacheLocal) syncMDCountsFromDb() error {
	cache.log.Debug("+ syncMDCountsFromDb begin")
	defer cache.log.Debug("- syncMDCountsFromDb end")
	// We take a write lock for this to prevent any reads from happening while
	// we're syncing the MD counts.
	cache.lock.Lock()
	defer cache.lock.Unlock()

	tlfsCached := make(map[tlf.ID]kbfsmd.Revision)
	iter := cache.headsDb.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		var tlfID tlf.ID
		err := tlfID.UnmarshalBinary(iter.Key())
		if err != nil {
			return err
		}

		var md diskMDBlock
		err = cache.config.Codec().Decode(iter.Value(), &md)
		if err != nil {
			return err
		}

		tlfsCached[tlfID] = md.Revision
	}
	cache.tlfsCached = tlfsCached
	return nil
}

// getMetadataLocked retrieves the metadata for a block in the cache, or
// returns leveldb.ErrNotFound and a zero-valued metadata otherwise.
func (cache *DiskMDCacheLocal) getMetadataLocked(
	tlfID tlf.ID, metered bool) (metadata diskMDBlock, err error) {
	var hitMeter, missMeter *CountMeter
	if metered {
		hitMeter = cache.hitMeter
		missMeter = cache.missMeter
	}

	metadataBytes, err := cache.headsDb.GetWithMeter(
		tlfID.Bytes(), hitMeter, missMeter)
	if err != nil {
		return diskMDBlock{}, err
	}
	err = cache.config.Codec().Decode(metadataBytes, &metadata)
	if err != nil {
		return diskMDBlock{}, err
	}
	return metadata, nil
}

// checkAndLockCache checks whether the cache is started.
func (cache *DiskMDCacheLocal) checkCacheLocked(
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
	if cache.headsDb == nil {
		return errors.WithStack(DiskCacheClosedError{method})
	}
	return nil
}

// Get implements the DiskMDCache interface for DiskMDCacheLocal.
func (cache *DiskMDCacheLocal) Get(
	ctx context.Context, tlfID tlf.ID) (
	buf []byte, ver kbfsmd.MetadataVer, timestamp time.Time, err error) {
	cache.lock.RLock()
	defer cache.lock.RUnlock()
	err = cache.checkCacheLocked(ctx, "MD(Get)")
	if err != nil {
		return nil, -1, time.Time{}, err
	}

	if _, ok := cache.tlfsCached[tlfID]; !ok {
		cache.missMeter.Mark(1)
		return nil, -1, time.Time{}, errors.WithStack(ldberrors.ErrNotFound)
	}

	md, err := cache.getMetadataLocked(tlfID, metered)
	if err != nil {
		return nil, -1, time.Time{}, err
	}
	return md.Buf, md.Ver, md.Time, nil
}

// Stage implements the DiskMDCache interface for DiskMDCacheLocal.
func (cache *DiskMDCacheLocal) Stage(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision, buf []byte,
	ver kbfsmd.MetadataVer, timestamp time.Time) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err := cache.checkCacheLocked(ctx, "MD(Stage)")
	if err != nil {
		return err
	}

	if cachedRev, ok := cache.tlfsCached[tlfID]; ok && cachedRev >= rev {
		// Ignore stages for older revisions
		return nil
	}

	md := diskMDBlock{
		Buf:      buf,
		Ver:      ver,
		Time:     timestamp,
		Revision: rev,
	}

	cache.tlfsStaged[tlfID] = append(cache.tlfsStaged[tlfID], md)
	return nil
}

// Commit implements the DiskMDCache interface for DiskMDCacheLocal.
func (cache *DiskMDCacheLocal) Commit(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err := cache.checkCacheLocked(ctx, "MD(Commit)")
	if err != nil {
		return err
	}

	stagedMDs := cache.tlfsStaged[tlfID]
	if len(stagedMDs) == 0 {
		// Nothing to do.
		return nil
	}
	newStagedMDs := make([]diskMDBlock, 0, len(stagedMDs)-1)
	foundMD := false
	// The staged MDs list is unordered, so iterate through the whole
	// thing to find what should remain after commiting `rev`.
	for _, md := range stagedMDs {
		switch {
		case md.Revision > rev:
			newStagedMDs = append(newStagedMDs, md)
			continue
		case md.Revision < rev:
			continue
		case foundMD:
			// Duplicate.
			continue
		}
		foundMD = true

		encodedMetadata, err := cache.config.Codec().Encode(&md)
		if err != nil {
			return err
		}

		err = cache.headsDb.PutWithMeter(
			tlfID.Bytes(), encodedMetadata, cache.putMeter)
		if err != nil {
			return err
		}
	}

	if !foundMD {
		// Nothing to do.
		return nil
	}

	cache.tlfsCached[tlfID] = rev
	if len(newStagedMDs) == 0 {
		delete(cache.tlfsStaged, tlfID)
	} else {
		cache.tlfsStaged[tlfID] = newStagedMDs
	}
	return nil
}

// Unstage implements the DiskMDCache interface for DiskMDCacheLocal.
func (cache *DiskMDCacheLocal) Unstage(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error {
	cache.lock.Lock()
	defer cache.lock.Unlock()
	err := cache.checkCacheLocked(ctx, "MD(Unstage)")
	if err != nil {
		return err
	}

	// Just remove the first one matching `rev`.
	stagedMDs := cache.tlfsStaged[tlfID]
	for i, md := range stagedMDs {
		if md.Revision == rev {
			if len(stagedMDs) == 1 {
				delete(cache.tlfsStaged, tlfID)
			} else {
				cache.tlfsStaged[tlfID] = append(
					stagedMDs[:i], stagedMDs[i+1:]...)
			}
			return nil
		}
	}

	return nil
}

// Status implements the DiskMDCache interface for DiskMDCacheLocal.
func (cache *DiskMDCacheLocal) Status(ctx context.Context) DiskMDCacheStatus {
	select {
	case <-cache.startedCh:
	case <-cache.startErrCh:
		return DiskMDCacheStatus{StartState: DiskMDCacheStartStateFailed}
	default:
		return DiskMDCacheStatus{StartState: DiskMDCacheStartStateStarting}
	}

	cache.lock.RLock()
	defer cache.lock.RUnlock()
	numStaged := uint64(0)
	for _, mds := range cache.tlfsStaged {
		numStaged += uint64(len(mds))
	}

	var dbStats []string
	if err := cache.checkCacheLocked(ctx, "MD(Status)"); err == nil {
		dbStats, err = cache.headsDb.StatStrings()
		if err != nil {
			cache.log.CDebugf(ctx, "Couldn't get db stats: %+v", err)
		}
	}

	return DiskMDCacheStatus{
		StartState: DiskMDCacheStartStateStarted,
		NumMDs:     uint64(len(cache.tlfsCached)),
		NumStaged:  numStaged,
		Hits:       rateMeterToStatus(cache.hitMeter),
		Misses:     rateMeterToStatus(cache.missMeter),
		Puts:       rateMeterToStatus(cache.putMeter),
		DBStats:    dbStats,
	}
}

// Shutdown implements the DiskMDCache interface for DiskMDCacheLocal.
func (cache *DiskMDCacheLocal) Shutdown(ctx context.Context) {
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
	if cache.headsDb == nil {
		return
	}
	cache.closer()
	cache.headsDb = nil
	cache.hitMeter.Shutdown()
	cache.missMeter.Shutdown()
	cache.putMeter.Shutdown()
}
