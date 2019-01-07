// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/tlf"
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
	blockCacher
}

type diskBlockCacheWrapped struct {
	config      diskBlockCacheConfig
	storageRoot string
	// Protects the caches
	mtx             sync.RWMutex
	workingSetCache *DiskBlockCacheLocal
	syncCache       *DiskBlockCacheLocal
	deleteGroup     kbfssync.RepeatedWaitGroup
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
		log := config.MakeLogger("DBC")
		log.Warning("Could not initialize sync block cache.")
		// We still return success because the working set cache successfully
		// initialized.
	}
	return cache, nil
}

func (cache *diskBlockCacheWrapped) getCacheLocked(
	cacheType DiskBlockCacheType) (*DiskBlockCacheLocal, error) {
	if cacheType == DiskBlockSyncCache {
		if cache.syncCache == nil {
			return nil, errors.New("Sync cache not enabled")
		}
		return cache.syncCache, nil
	}
	return cache.workingSetCache, nil
}

// DoesCacheHaveSpace implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) DoesCacheHaveSpace(
	ctx context.Context, cacheType DiskBlockCacheType) (bool, error) {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	c, err := cache.getCacheLocked(cacheType)
	if err != nil {
		return false, err
	}
	return c.DoesCacheHaveSpace(ctx), nil
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
	if preferredCacheType == DiskBlockSyncCache {
		if cache.syncCache != nil {
			primaryCache, secondaryCache =
				cache.syncCache, cache.workingSetCache
		} else {
			log := cache.config.MakeLogger("DBC")
			log.Warning("Sync cache is preferred, but there is no sync cache")
		}
	}
	// Check both caches if the primary cache doesn't have the block.
	buf, serverHalf, prefetchStatus, err = primaryCache.Get(ctx, tlfID, blockID)
	if _, isNoSuchBlockError := err.(NoSuchBlockError); isNoSuchBlockError &&
		secondaryCache != nil {
		buf, serverHalf, prefetchStatus, err = secondaryCache.Get(
			ctx, tlfID, blockID)
		if err != nil {
			return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
		}
		if preferredCacheType != DiskBlockAnyCache {
			// Move the block into its preferred cache.
			err := primaryCache.Put(ctx, tlfID, blockID, buf, serverHalf)
			if err != nil {
				// The cache will log the non-fatal error, so just return nil.
				return buf, serverHalf, prefetchStatus, nil
			}

			if prefetchStatus == FinishedPrefetch {
				// Don't propagate a finished status to the primary
				// cache, since the status needs to be with respect to
				// that particular cache (i.e., if the primary cache
				// is the sync cache, all the child blocks must be in
				// the sync cache, for this block to be considered
				// synced, and we can't verify that here).
				prefetchStatus = TriggeredPrefetch
			}
			if prefetchStatus != NoPrefetch {
				_ = primaryCache.UpdateMetadata(ctx, blockID, prefetchStatus)
			}

			// Remove the block from the non-preferred cache (which is
			// set to be the secondary cache at this point).
			cache.deleteGroup.Add(1)
			go func() {
				defer cache.deleteGroup.Done()
				secondaryCache.Delete(ctx, []kbfsblock.ID{blockID})
			}()
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
		err := cache.syncCache.Put(ctx, tlfID, blockID, buf, serverHalf)
		if err == nil {
			cache.deleteGroup.Add(1)
			go func() {
				defer cache.deleteGroup.Done()
				workingSetCache.Delete(ctx, []kbfsblock.ID{blockID})
			}()
			return nil
		}
		// Otherwise drop through and put it into the working set cache.
	}
	// No need to put it in the working cache if it's already in the
	// sync cache.
	if cache.syncCache != nil {
		_, _, _, err := cache.syncCache.Get(ctx, tlfID, blockID)
		if err == nil {
			return nil
		}
	}
	return cache.workingSetCache.Put(ctx, tlfID, blockID, buf, serverHalf)
}

// Delete implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID, cacheType DiskBlockCacheType) (
	numRemoved int, sizeRemoved int64, err error) {
	// This is a write operation but we are only reading the pointers to the
	// caches. So we use a read lock.
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	if cacheType == DiskBlockAnyCache || cacheType == DiskBlockSyncCache {
		numRemoved, sizeRemoved, err = cache.syncCache.Delete(ctx, blockIDs)
		if err != nil {
			return 0, 0, err
		}
		if cacheType == DiskBlockSyncCache {
			return numRemoved, sizeRemoved, err
		}
	}

	wsNumRemoved, wsSizeRemoved, err := cache.workingSetCache.Delete(
		ctx, blockIDs)
	if err != nil {
		return 0, 0, err
	}
	return wsNumRemoved + numRemoved, wsSizeRemoved + sizeRemoved, nil
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
	ctx context.Context, tlfID tlf.ID, cacheType DiskBlockCacheType) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	c, err := cache.getCacheLocked(cacheType)
	if err != nil {
		return err
	}
	return c.ClearAllTlfBlocks(ctx, tlfID)
}

// GetLastUnrefRev implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) GetLastUnrefRev(
	ctx context.Context, tlfID tlf.ID, cacheType DiskBlockCacheType) (
	kbfsmd.Revision, error) {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	c, err := cache.getCacheLocked(cacheType)
	if err != nil {
		return kbfsmd.RevisionUninitialized, err
	}
	return c.GetLastUnrefRev(ctx, tlfID)
}

// PutLastUnrefRev implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) PutLastUnrefRev(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision,
	cacheType DiskBlockCacheType) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	c, err := cache.getCacheLocked(cacheType)
	if err != nil {
		return err
	}
	return c.PutLastUnrefRev(ctx, tlfID, rev)
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

// Mark implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Mark(
	ctx context.Context, blockID kbfsblock.ID, tag string,
	cacheType DiskBlockCacheType) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	c, err := cache.getCacheLocked(cacheType)
	if err != nil {
		return err
	}
	return c.Mark(ctx, blockID, tag)
}

// DeleteUnmarked implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) DeleteUnmarked(
	ctx context.Context, tlfID tlf.ID, tag string,
	cacheType DiskBlockCacheType) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	c, err := cache.getCacheLocked(cacheType)
	if err != nil {
		return err
	}
	return c.DeleteUnmarked(ctx, tlfID, tag)
}

func (cache *diskBlockCacheWrapped) waitForDeletes(ctx context.Context) error {
	return cache.deleteGroup.Wait(ctx)
}

// AddHomeTLF implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) AddHomeTLF(ctx context.Context,
	tlfID tlf.ID) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	if cache.syncCache == nil {
		return errors.New("Sync cache not enabled")
	}
	return cache.syncCache.AddHomeTLF(ctx, tlfID)
}

// ClearHomeTLFs implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) ClearHomeTLFs(ctx context.Context) error {
	cache.mtx.RLock()
	defer cache.mtx.RUnlock()
	if cache.syncCache == nil {
		return errors.New("Sync cache not enabled")
	}
	return cache.syncCache.ClearHomeTLFs(ctx)
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
