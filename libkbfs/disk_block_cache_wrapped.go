// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"path/filepath"
	"sync"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	"golang.org/x/net/context"
)

const (
	workingSetCacheFolderName = "kbfs_block_cache"
	syncCacheFolderName       = "kbfs_sync_cache"
)

// diskBlockCacheConfig specifies the interfaces that a DiskBlockCacheStandard
// needs to perform its functions. This adheres to the standard libkbfs Config
// API.
type diskBlockCacheConfig interface {
	codecGetter
	logMaker
	clockGetter
	diskLimiterGetter
	initModeGetter
}

type diskBlockCacheWrapped struct {
	config      diskBlockCacheConfig
	storageRoot string
	// Protects the caches
	mtx             sync.RWMutex
	workingSetCache *DiskBlockCacheLocal
	syncCache       *DiskBlockCacheLocal
}

var _ DiskBlockCache = (*diskBlockCacheWrapped)(nil)

func (cache *diskBlockCacheWrapped) enableCache(
	typ diskLimitTrackerType, cacheFolder string) (err error) {
	cache.mtx.Lock()
	defer cache.mtx.Unlock()
	var cachePtr **DiskBlockCacheLocal
	switch typ {
	case syncCacheLimitTrackerType:
		cachePtr = &cache.syncCache
	case workingSetCacheLimitTrackerType:
		cachePtr = &cache.workingSetCache
	default:
		return errors.New("invalid disk cache type")
	}
	if *cachePtr != nil {
		// We already have a cache of the desired type. Thus, this method is
		// idempotent.
		return nil
	}
	if cache.config.IsTestMode() {
		*cachePtr, err = newDiskBlockCacheLocalForTest(
			cache.config, typ)
	} else {
		cacheStorageRoot := filepath.Join(cache.storageRoot, cacheFolder)
		*cachePtr, err = newDiskBlockCacheLocal(cache.config, typ,
			cacheStorageRoot)
	}
	return err
}

func newDiskBlockCacheWrapped(config diskBlockCacheConfig,
	storageRoot string) (cache *diskBlockCacheWrapped, err error) {
	cache = &diskBlockCacheWrapped{
		config:      config,
		storageRoot: storageRoot,
	}
	err = cache.enableCache(workingSetCacheLimitTrackerType,
		workingSetCacheFolderName)
	if err != nil {
		return nil, err
	}
	syncCacheErr := cache.enableCache(syncCacheLimitTrackerType,
		syncCacheFolderName)
	if syncCacheErr != nil {
		log := config.MakeLogger("KBC")
		log.Warning("Could not initialize sync block cache.")
		// We still return success because the working set cache successfully
		// initialized.
	}
	return cache, nil
}

// DoesSyncCacheHaveSpace returns true if we have more than 1% of space left in
// the sync cache.
func (cache *diskBlockCacheWrapped) DoesSyncCacheHaveSpace(
	ctx context.Context) bool {
	if !cache.IsSyncCacheEnabled() {
		return false
	}
	return cache.syncCache.DoesSyncCacheHaveSpace(ctx)
}

// IsSyncCacheEnabled returns true if the sync cache is enabled.
func (cache *diskBlockCacheWrapped) IsSyncCacheEnabled() bool {
	return cache.syncCache != nil
}

// Get implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Get(
	ctx context.Context, tlfID tlf.ID, blockID kbfsblock.ID,
	preferredCacheType DiskBlockCacheType) (
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	prefetchStatus PrefetchStatus, err error) {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	primaryCache := cache.workingSetCache
	secondaryCache := cache.syncCache
	if preferredCacheType == DiskBlockSyncCache && cache.syncCache != nil {
		primaryCache, secondaryCache = secondaryCache, primaryCache
	}
	// Check both caches if the primary cache doesn't have the block.
	buf, serverHalf, prefetchStatus, err =
		primaryCache.Get(ctx, tlfID, blockID, preferredCacheType)
	if _, isNoSuchBlockError := err.(NoSuchBlockError); isNoSuchBlockError &&
		secondaryCache != nil {
		buf, serverHalf, prefetchStatus, err = secondaryCache.Get(
			ctx, tlfID, blockID, preferredCacheType)
		if err != nil {
			return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
		}
		if preferredCacheType != DiskBlockAnyCache {
			// Move the block into its preferred cache.
			err := primaryCache.Put(
				ctx, tlfID, blockID, buf, serverHalf, preferredCacheType)
			if err != nil {
				// The cache will log the non-fatal error, so just return nil.
				return buf, serverHalf, prefetchStatus, nil
			}
			err = primaryCache.UpdateMetadata(ctx, blockID, prefetchStatus)
			if err != nil {
				// The cache will log the non-fatal error, so just return nil.
				return buf, serverHalf, prefetchStatus, nil
			}
			go secondaryCache.Delete(ctx, []kbfsblock.ID{blockID})
		}
	}
	return buf, serverHalf, prefetchStatus, err
}

// GetMetadata implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) GetMetadata(ctx context.Context,
	blockID kbfsblock.ID) (metadata DiskBlockCacheMetadata, err error) {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	if cache.syncCache != nil {
		md, err := cache.syncCache.GetMetadata(ctx, blockID)
		switch errors.Cause(err) {
		case nil:
			return md, nil
		case ldberrors.ErrNotFound:
		default:
			return md, err
		}
	}
	return cache.workingSetCache.GetMetadata(ctx, blockID)
}

// Put implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	cacheType DiskBlockCacheType) error {
	// This is a write operation but we are only reading the pointers to the
	// caches. So we use a read lock.
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	if cacheType == DiskBlockSyncCache && cache.syncCache != nil {
		workingSetCache := cache.workingSetCache
		err := cache.syncCache.Put(
			ctx, tlfID, blockID, buf, serverHalf, cacheType)
		if err == nil {
			go workingSetCache.Delete(ctx, []kbfsblock.ID{blockID})
			return nil
		}
		// Otherwise drop through and put it into the working set cache.
	}
	// TODO: Allow more intelligent transitioning from the sync cache to
	// the working set cache.
	if cache.syncCache != nil {
		syncCache := cache.syncCache
		go syncCache.Delete(ctx, []kbfsblock.ID{blockID})
	}
	return cache.workingSetCache.Put(
		ctx, tlfID, blockID, buf, serverHalf, cacheType)
}

// Delete implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	// This is a write operation but we are only reading the pointers to the
	// caches. So we use a read lock.
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	numRemoved, sizeRemoved, err = cache.workingSetCache.Delete(ctx, blockIDs)
	if cache.syncCache == nil || err != nil {
		return numRemoved, sizeRemoved, err
	}
	syncNumRemoved, syncSizeRemoved, err :=
		cache.syncCache.Delete(ctx, blockIDs)
	return numRemoved + syncNumRemoved, sizeRemoved + syncSizeRemoved, err
}

// UpdateMetadata implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, prefetchStatus PrefetchStatus) error {
	// This is a write operation but we are only reading the pointers to the
	// caches. So we use a read lock.
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	// Try to update metadata for both caches.
	if cache.syncCache != nil {
		err := cache.syncCache.UpdateMetadata(ctx, blockID, prefetchStatus)
		_, isNoSuchBlockError := err.(NoSuchBlockError)
		if !isNoSuchBlockError {
			return err
		}
	}
	return cache.workingSetCache.UpdateMetadata(ctx, blockID, prefetchStatus)
}

// ClearAllTlfBlocks implements the DiskBlockCache interface for
// diskBlockCacheWrapper.
func (cache *diskBlockCacheWrapped) ClearAllTlfBlocks(
	ctx context.Context, tlfID tlf.ID) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	// We only clear blocks from the sync cache.
	if cache.syncCache == nil {
		return nil
	}
	return cache.syncCache.ClearAllTlfBlocks(ctx, tlfID)
}

// GetLastUnrefRev implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) GetLastUnrefRev(
	ctx context.Context, tlfID tlf.ID) (kbfsmd.Revision, error) {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	if cache.syncCache == nil {
		return kbfsmd.RevisionUninitialized,
			errors.New("Sync cache not enabled")
	}
	return cache.syncCache.GetLastUnrefRev(ctx, tlfID)
}

// PutLastUnrefRev implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) PutLastUnrefRev(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	if cache.syncCache == nil {
		return errors.New("Sync cache not enabled")
	}
	return cache.syncCache.PutLastUnrefRev(ctx, tlfID, rev)
}

// Status implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Status(
	ctx context.Context) map[string]DiskBlockCacheStatus {
	// This is a write operation but we are only reading the pointers to the
	// caches. So we use a read lock.
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	statuses := make(map[string]DiskBlockCacheStatus, 2)
	if cache.workingSetCache != nil {
		for name, status := range cache.workingSetCache.Status(ctx) {
			statuses[name] = status
		}
	}
	if cache.syncCache == nil {
		return statuses
	}
	for name, status := range cache.syncCache.Status(ctx) {
		statuses[name] = status
	}
	return statuses
}

// Shutdown implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Shutdown(ctx context.Context) {
	cache.mtx.Lock()
	defer cache.mtx.Unlock()
	cache.workingSetCache.Shutdown(ctx)
	if cache.syncCache != nil {
		cache.syncCache.Shutdown(ctx)
	}
}
