// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/kbfs/kbfssync"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type quotaSimpleTracker struct {
	quotaLock      sync.RWMutex
	unflushedBytes int64
	quotaBytes     int64
}

func (qst *quotaSimpleTracker) getQuotaInfo() (
	usedQuotaBytes, quotaBytes int64) {
	qst.quotaLock.RLock()
	defer qst.quotaLock.RUnlock()
	usedQuotaBytes = qst.unflushedBytes
	quotaBytes = qst.quotaBytes
	return usedQuotaBytes, quotaBytes
}

func (qst *quotaSimpleTracker) onJournalEnable(unflushedBytes int64) {
	qst.quotaLock.Lock()
	defer qst.quotaLock.Unlock()
	qst.unflushedBytes += unflushedBytes
}

func (qst *quotaSimpleTracker) onJournalDisable(unflushedBytes int64) {
	qst.quotaLock.Lock()
	defer qst.quotaLock.Unlock()
	qst.unflushedBytes -= unflushedBytes
}

func (qst *quotaSimpleTracker) afterBlockPut(
	blockBytes int64, putData bool) {
	qst.quotaLock.Lock()
	defer qst.quotaLock.Unlock()
	if putData {
		qst.unflushedBytes += blockBytes
	}
}

func (qst *quotaSimpleTracker) onBlocksFlush(blockBytes int64) {
	qst.quotaLock.Lock()
	defer qst.quotaLock.Unlock()
	qst.unflushedBytes -= blockBytes
}

// semaphoreDiskLimiter is an implementation of diskLimiter that uses
// semaphores to limit the byte, file, and quota usage.
type semaphoreDiskLimiter struct {
	byteLimit     int64
	byteSemaphore *kbfssync.Semaphore
	fileLimit     int64
	fileSemaphore *kbfssync.Semaphore
	quotaTracker  *quotaSimpleTracker
}

var _ DiskLimiter = semaphoreDiskLimiter{}

func newSemaphoreDiskLimiter(
	byteLimit, fileLimit, quotaLimit int64) semaphoreDiskLimiter {
	byteSemaphore := kbfssync.NewSemaphore()
	byteSemaphore.Release(byteLimit)
	fileSemaphore := kbfssync.NewSemaphore()
	fileSemaphore.Release(fileLimit)
	return semaphoreDiskLimiter{
		byteLimit, byteSemaphore, fileLimit, fileSemaphore,
		&quotaSimpleTracker{
			quotaBytes: quotaLimit,
		},
	}
}

func (sdl semaphoreDiskLimiter) onJournalEnable(
	ctx context.Context,
	journalStoredBytes, journalUnflushedBytes, journalFiles int64) (
	availableBytes, availableFiles int64) {
	if journalStoredBytes != 0 {
		availableBytes = sdl.byteSemaphore.ForceAcquire(journalStoredBytes)
	} else {
		availableBytes = sdl.byteSemaphore.Count()
	}
	// storedBytes should be >= unflushedBytes. But it's not too
	// bad to let it go through.
	if journalFiles != 0 {
		availableFiles = sdl.fileSemaphore.ForceAcquire(journalFiles)
	} else {
		availableFiles = sdl.fileSemaphore.Count()
	}
	sdl.quotaTracker.onJournalEnable(journalUnflushedBytes)
	return availableBytes, availableFiles
}

func (sdl semaphoreDiskLimiter) onJournalDisable(
	ctx context.Context,
	journalStoredBytes, journalUnflushedBytes, journalFiles int64) {
	if journalStoredBytes != 0 {
		sdl.byteSemaphore.Release(journalStoredBytes)
	}
	// As above, storedBytes should be >= unflushedBytes. Let it
	// go through here, too.
	if journalFiles != 0 {
		sdl.fileSemaphore.Release(journalFiles)
	}
	sdl.quotaTracker.onJournalDisable(journalUnflushedBytes)
}

func (sdl semaphoreDiskLimiter) onDiskBlockCacheEnable(
	ctx context.Context, diskCacheBytes int64) {
	if diskCacheBytes != 0 {
		sdl.byteSemaphore.ForceAcquire(diskCacheBytes)
	}
}

func (sdl semaphoreDiskLimiter) onDiskBlockCacheDisable(
	ctx context.Context, diskCacheBytes int64) {
	if diskCacheBytes != 0 {
		sdl.byteSemaphore.Release(diskCacheBytes)
	}
}

func (sdl semaphoreDiskLimiter) beforeBlockPut(
	ctx context.Context, blockBytes, blockFiles int64) (
	availableBytes, availableFiles int64, err error) {
	// Better to return an error than to panic in Acquire.
	if blockBytes == 0 {
		return sdl.byteSemaphore.Count(), sdl.fileSemaphore.Count(), errors.New(
			"semaphore.DiskLimiter.beforeBlockPut called with 0 blockBytes")
	}
	if blockFiles == 0 {
		return sdl.byteSemaphore.Count(), sdl.fileSemaphore.Count(), errors.New(
			"semaphore.DiskLimiter.beforeBlockPut called with 0 blockFiles")
	}

	availableBytes, err = sdl.byteSemaphore.Acquire(ctx, blockBytes)
	if err != nil {
		return availableBytes, sdl.fileSemaphore.Count(), err
	}
	defer func() {
		if err != nil {
			sdl.byteSemaphore.Release(blockBytes)
			availableBytes = sdl.byteSemaphore.Count()
		}
	}()

	availableFiles, err = sdl.fileSemaphore.Acquire(ctx, blockFiles)
	return availableBytes, availableFiles, err
}

func (sdl semaphoreDiskLimiter) afterBlockPut(
	ctx context.Context, blockBytes, blockFiles int64, putData bool) {
	if !putData {
		sdl.byteSemaphore.Release(blockBytes)
		sdl.fileSemaphore.Release(blockFiles)
	}
	sdl.quotaTracker.afterBlockPut(blockBytes, putData)
}

func (sdl semaphoreDiskLimiter) onBlocksFlush(
	ctx context.Context, blockBytes int64) {
	sdl.quotaTracker.onBlocksFlush(blockBytes)
}

func (sdl semaphoreDiskLimiter) onBlocksDelete(
	ctx context.Context, blockBytes, blockFiles int64) {
	if blockBytes != 0 {
		sdl.byteSemaphore.Release(blockBytes)
	}
	if blockFiles != 0 {
		sdl.fileSemaphore.Release(blockFiles)
	}
}

func (sdl semaphoreDiskLimiter) onDiskBlockCacheDelete(ctx context.Context,
	blockBytes int64) {
	sdl.onBlocksDelete(ctx, blockBytes, 0)
}

func (sdl semaphoreDiskLimiter) beforeDiskBlockCachePut(ctx context.Context,
	blockBytes int64) (availableBytes int64, err error) {
	if blockBytes == 0 {
		return 0, errors.New("semaphoreDiskLimiter.beforeDiskBlockCachePut" +
			" called with 0 blockBytes")
	}
	return sdl.byteSemaphore.ForceAcquire(blockBytes), nil
}

func (sdl semaphoreDiskLimiter) afterDiskBlockCachePut(ctx context.Context,
	blockBytes int64, putData bool) {
	if !putData {
		sdl.byteSemaphore.Release(blockBytes)
	}
}

func (sdl semaphoreDiskLimiter) getQuotaInfo() (
	usedQuotaBytes, quotaBytes int64) {
	return sdl.quotaTracker.getQuotaInfo()
}

func (sdl semaphoreDiskLimiter) getDiskLimitInfo() (
	usedBytes int64, limitBytes float64, usedFiles int64, limitFiles float64) {
	return sdl.byteSemaphore.Count(), float64(sdl.byteLimit),
		sdl.fileSemaphore.Count(), float64(sdl.fileLimit)
}

type semaphoreDiskLimiterStatus struct {
	Type string

	// Derived numbers.
	ByteUsageFrac  float64
	FileUsageFrac  float64
	QuotaUsageFrac float64

	// Raw numbers.
	ByteLimit  int64
	ByteFree   int64
	FileLimit  int64
	FileFree   int64
	QuotaLimit int64
	QuotaUsed  int64
}

func (sdl semaphoreDiskLimiter) getStatus() interface{} {
	byteFree := sdl.byteSemaphore.Count()
	fileFree := sdl.fileSemaphore.Count()
	usedQuotaBytes, quotaBytes := sdl.quotaTracker.getQuotaInfo()

	byteUsageFrac := 1 - float64(byteFree)/float64(sdl.byteLimit)
	fileUsageFrac := 1 - float64(fileFree)/float64(sdl.fileLimit)
	quotaUsageFrac := float64(usedQuotaBytes) / float64(quotaBytes)

	return semaphoreDiskLimiterStatus{
		Type: "SemaphoreDiskLimiter",

		ByteUsageFrac:  byteUsageFrac,
		FileUsageFrac:  fileUsageFrac,
		QuotaUsageFrac: quotaUsageFrac,

		ByteLimit: sdl.byteLimit,
		ByteFree:  byteFree,

		FileLimit: sdl.fileLimit,
		FileFree:  fileFree,

		QuotaLimit: quotaBytes,
		QuotaUsed:  usedQuotaBytes,
	}
}
