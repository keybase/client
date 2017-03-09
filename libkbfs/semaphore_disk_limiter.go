// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/kbfs/kbfssync"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// semaphoreDiskLimiter is an implementation of diskLimiter that uses
// semaphores to limit the byte and file usage.
type semaphoreDiskLimiter struct {
	byteLimit     int64
	byteSemaphore *kbfssync.Semaphore
	fileLimit     int64
	fileSemaphore *kbfssync.Semaphore
}

var _ DiskLimiter = semaphoreDiskLimiter{}

func newSemaphoreDiskLimiter(byteLimit, fileLimit int64) semaphoreDiskLimiter {
	byteSemaphore := kbfssync.NewSemaphore()
	byteSemaphore.Release(byteLimit)
	fileSemaphore := kbfssync.NewSemaphore()
	fileSemaphore.Release(fileLimit)
	return semaphoreDiskLimiter{
		byteLimit, byteSemaphore, fileLimit, fileSemaphore,
	}
}

func (sdl semaphoreDiskLimiter) onJournalEnable(
	ctx context.Context, journalBytes, journalFiles int64) (
	availableBytes, availableFiles int64) {
	if journalBytes != 0 {
		availableBytes = sdl.byteSemaphore.ForceAcquire(journalBytes)
	} else {
		availableBytes = sdl.byteSemaphore.Count()
	}
	if journalFiles != 0 {
		availableFiles = sdl.fileSemaphore.ForceAcquire(journalFiles)
	} else {
		availableFiles = sdl.fileSemaphore.Count()
	}
	return availableBytes, availableFiles
}

func (sdl semaphoreDiskLimiter) onJournalDisable(
	ctx context.Context, journalBytes, journalFiles int64) {
	if journalBytes != 0 {
		sdl.byteSemaphore.Release(journalBytes)
	}
	if journalFiles != 0 {
		sdl.fileSemaphore.Release(journalFiles)
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
	blockBytes, diskBlockCacheBytes int64) (bytesAcquired int64, err error) {
	if blockBytes == 0 {
		return 0, nil
	}
	availableBytes, err := sdl.byteSemaphore.Acquire(ctx, blockBytes)
	if err != nil {
		return availableBytes, err
	}
	return availableBytes, nil
}

type semaphoreDiskLimiterStatus struct {
	Type string

	// Derived numbers.
	ByteUsageFrac float64
	FileUsageFrac float64

	// Raw numbers.
	LimitMB        float64
	AvailableMB    float64
	LimitFiles     float64
	AvailableFiles float64
}

func (sdl semaphoreDiskLimiter) getStatus() interface{} {
	const MB float64 = 1024 * 1024

	limitMB := float64(sdl.byteLimit) / MB
	availableMB := float64(sdl.byteSemaphore.Count()) / MB
	byteUsageFrac := 1 - availableMB/limitMB

	limitFiles := float64(sdl.fileLimit) / MB
	availableFiles := float64(sdl.fileSemaphore.Count()) / MB
	fileUsageFrac := 1 - availableFiles/limitFiles

	return semaphoreDiskLimiterStatus{
		Type: "SemaphoreDiskLimiter",

		ByteUsageFrac: byteUsageFrac,
		FileUsageFrac: fileUsageFrac,

		LimitMB:        limitMB,
		AvailableMB:    availableMB,
		LimitFiles:     limitFiles,
		AvailableFiles: availableFiles,
	}
}
