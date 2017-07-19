// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"golang.org/x/net/context"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
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

type diskBlockCacheWrapped struct {
	workingSetCache DiskBlockCache
	syncCache       DiskBlockCache
}

func newDiskBlockCacheWrapped(config diskBlockCacheConfig, storageRoot string) (
	cache *diskBlockCacheWrapped, err error) {
	cacheRoot := diskBlockCacheRootFromStorageRoot(storageRoot)
	workingSetCache, err := newDiskBlockCacheStandard(config, cacheRoot)
	if err != nil {
		return nil, err
	}
	return &diskBlockCacheWrapped{
		workingSetCache: workingSetCache,
		syncCache:       nil,
	}, nil
}

// Get implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Get(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID) (
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	hasPrefetched bool, err error) {
	return cache.workingSetCache.Get(ctx, tlfID, blockID)
}

// Put implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	return cache.workingSetCache.Put(ctx, tlfID, blockID, buf, serverHalf)
}

// Delete implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	return cache.workingSetCache.Delete(ctx, blockIDs)
}

// UpdateMetadata implements the DiskBlockCache interface for
// diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, hasPrefetched bool) error {
	return cache.workingSetCache.UpdateMetadata(ctx, blockID, hasPrefetched)
}

// Size implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Size() int64 {
	size := cache.workingSetCache.Size()
	if cache.syncCache != nil {
		size += cache.syncCache.Size()
	}
	return size
}

// Status implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Status(
	ctx context.Context) *DiskBlockCacheStatus {
	return cache.workingSetCache.Status(ctx)
}

// Shutdown implements the DiskBlockCache interface for diskBlockCacheWrapped.
func (cache *diskBlockCacheWrapped) Shutdown(ctx context.Context) {
	cache.workingSetCache.Shutdown(ctx)
	if cache.syncCache != nil {
		cache.syncCache.Shutdown(ctx)
	}
}
