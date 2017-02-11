// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"

	"github.com/keybase/kbfs/kbfssync"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const defaultAvailableFiles = math.MaxInt64

// semaphoreDiskLimiter is an implementation of diskLimiter that uses
// semaphores to limit the byte usage.
//
// TODO: Also do limiting based on file counts.
type semaphoreDiskLimiter struct {
	byteLimit     int64
	byteSemaphore *kbfssync.Semaphore
}

var _ diskLimiter = semaphoreDiskLimiter{}

func newSemaphoreDiskLimiter(byteLimit int64) semaphoreDiskLimiter {
	byteSemaphore := kbfssync.NewSemaphore()
	byteSemaphore.Release(byteLimit)
	return semaphoreDiskLimiter{byteLimit, byteSemaphore}
}

func (sdl semaphoreDiskLimiter) onJournalEnable(
	ctx context.Context, journalBytes, journalFiles int64) (
	availableBytes, availableFiles int64) {
	if journalBytes == 0 {
		return sdl.byteSemaphore.Count(), defaultAvailableFiles
	}
	availableBytes = sdl.byteSemaphore.ForceAcquire(journalBytes)
	return availableBytes, defaultAvailableFiles
}

func (sdl semaphoreDiskLimiter) onJournalDisable(
	ctx context.Context, journalBytes, journalFiles int64) {
	if journalBytes > 0 {
		sdl.byteSemaphore.Release(journalBytes)
	}
}

func (sdl semaphoreDiskLimiter) beforeBlockPut(
	ctx context.Context, blockBytes, blockFiles int64) (
	availableBytes, availableFiles int64, err error) {
	if blockBytes == 0 {
		// Better to return an error than to panic in Acquire.
		return sdl.byteSemaphore.Count(), defaultAvailableFiles, errors.New(
			"semaphore.DiskLimiter.beforeBlockPut called with 0 blockBytes")
	}

	availableBytes, err = sdl.byteSemaphore.Acquire(ctx, blockBytes)
	return availableBytes, defaultAvailableFiles, err
}

func (sdl semaphoreDiskLimiter) afterBlockPut(
	ctx context.Context, blockBytes, blockFiles int64, putData bool) {
	if !putData {
		sdl.byteSemaphore.Release(blockBytes)
	}
}

func (sdl semaphoreDiskLimiter) onBlockDelete(
	ctx context.Context, blockBytes, blockFiles int64) {
	if blockBytes > 0 {
		sdl.byteSemaphore.Release(blockBytes)
	}
}

type semaphoreDiskLimiterStatus struct {
	Type string

	// Derived numbers.
	UsageFrac float64

	// Raw numbers.
	LimitMB     float64
	AvailableMB float64
}

func (sdl semaphoreDiskLimiter) getStatus() interface{} {
	const MB float64 = 1024 * 1024

	limitMB := float64(sdl.byteLimit) / MB
	availableMB := float64(sdl.byteSemaphore.Count()) / MB
	usageFrac := 1 - availableMB/limitMB

	return semaphoreDiskLimiterStatus{
		Type: "SemaphoreDiskLimiter",

		UsageFrac: usageFrac,

		LimitMB:     limitMB,
		AvailableMB: availableMB,
	}
}
