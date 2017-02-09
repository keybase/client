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
// a semaphore.
type semaphoreDiskLimiter struct {
	s *kbfssync.Semaphore
}

var _ diskLimiter = semaphoreDiskLimiter{}

func newSemaphoreDiskLimiter(byteLimit int64) semaphoreDiskLimiter {
	s := kbfssync.NewSemaphore()
	s.Release(byteLimit)
	return semaphoreDiskLimiter{s}
}

func (s semaphoreDiskLimiter) onJournalEnable(
	ctx context.Context, journalBytes int64) int64 {
	if journalBytes == 0 {
		return s.s.Count()
	}
	return s.s.ForceAcquire(journalBytes)
}

func (s semaphoreDiskLimiter) onJournalDisable(
	ctx context.Context, journalBytes int64) {
	if journalBytes > 0 {
		s.s.Release(journalBytes)
	}
}

func (s semaphoreDiskLimiter) beforeBlockPut(
	ctx context.Context, blockBytes int64) (int64, error) {
	if blockBytes == 0 {
		// Better to return an error than to panic in Acquire.
		return s.s.Count(), errors.New(
			"beforeBlockPut called with 0 blockBytes")
	}

	return s.s.Acquire(ctx, blockBytes)
}

func (s semaphoreDiskLimiter) afterBlockPut(
	ctx context.Context, blockBytes int64, putData bool) {
	if !putData {
		s.s.Release(blockBytes)
	}
}

func (s semaphoreDiskLimiter) onBlockDelete(
	ctx context.Context, blockBytes int64) {
	if blockBytes > 0 {
		s.s.Release(blockBytes)
	}
}
