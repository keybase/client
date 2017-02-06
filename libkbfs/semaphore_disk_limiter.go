// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/logger"
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

func (s semaphoreDiskLimiter) onJournalEnable(journalBytes int64) int64 {
	if journalBytes == 0 {
		// TODO: This is a bit weird. Add a function to get
		// the current semaphore count, or let ForceAcquire
		// take 0.
		return 0
	}
	return s.s.ForceAcquire(journalBytes)
}

func (s semaphoreDiskLimiter) onJournalDisable(journalBytes int64) {
	if journalBytes > 0 {
		s.s.Release(journalBytes)
	}
}

func (s semaphoreDiskLimiter) beforeBlockPut(
	ctx context.Context, blockBytes int64,
	log logger.Logger) (int64, error) {
	if blockBytes == 0 {
		// Better to return an error than to panic in Acquire.
		//
		// TODO: Return current semaphore count.
		return 0, errors.New("beforeBlockPut called with 0 blockBytes")
	}

	return s.s.Acquire(ctx, blockBytes)
}

func (s semaphoreDiskLimiter) onBlockPutFail(blockBytes int64) {
	s.s.Release(blockBytes)
}

func (s semaphoreDiskLimiter) onBlockDelete(blockBytes int64) {
	if blockBytes > 0 {
		s.s.Release(blockBytes)
	}
}
