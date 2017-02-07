// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// backpressureDiskLimiter is an implementation of diskLimiter that
// uses backpressure.
type backpressureDiskLimiter struct {
	backpressureMinThreshold int64
	backpressureMaxThreshold int64
	byteLimit                int64
	maxDelay                 time.Duration
	delayFn                  func(context.Context, time.Duration) error
	s                        *kbfssync.Semaphore
}

var _ diskLimiter = backpressureDiskLimiter{}

// newBackpressureDiskLimiterWithDelayFunction constructs a new
// backpressureDiskLimiter with the given parameters, and also the
// given delay function, which is overridden in tests.
func newBackpressureDiskLimiterWithDelayFunction(
	backpressureMinThreshold, backpressureMaxThreshold, byteLimit int64,
	maxDelay time.Duration,
	delayFn func(context.Context, time.Duration) error) backpressureDiskLimiter {
	if backpressureMinThreshold < 0 {
		panic("backpressureMinThreshold < 0")
	}
	if backpressureMaxThreshold < backpressureMinThreshold {
		panic("backpressureMaxThreshold < backpressureMinThreshold")
	}
	if byteLimit < backpressureMaxThreshold {
		panic("byteLimit < backpressureMaxThreshold")
	}
	s := kbfssync.NewSemaphore()
	s.Release(byteLimit)
	return backpressureDiskLimiter{
		backpressureMinThreshold, backpressureMaxThreshold,
		byteLimit, maxDelay, delayFn, s,
	}
}

// defaultDoDelay uses a timer to delay by the given duration.
func defaultDoDelay(ctx context.Context, delay time.Duration) error {
	if delay == 0 {
		return nil
	}

	timer := time.NewTimer(delay)
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		timer.Stop()
		return errors.WithStack(ctx.Err())
	}
}

// newBackpressureDiskLimiter constructs a new backpressureDiskLimiter
// with the given parameters.
func newBackpressureDiskLimiter(
	backpressureMinThreshold, backpressureMaxThreshold, byteLimit int64,
	maxDelay time.Duration) backpressureDiskLimiter {
	return newBackpressureDiskLimiterWithDelayFunction(
		backpressureMinThreshold, backpressureMaxThreshold,
		byteLimit, maxDelay, defaultDoDelay)
}

func (s backpressureDiskLimiter) onJournalEnable(journalBytes int64) int64 {
	if journalBytes == 0 {
		return s.s.Count()
	}
	return s.s.ForceAcquire(journalBytes)
}

func (s backpressureDiskLimiter) onJournalDisable(journalBytes int64) {
	if journalBytes > 0 {
		s.s.Release(journalBytes)
	}
}

func (s backpressureDiskLimiter) getDelay() time.Duration {
	availBytes := s.s.Count()
	usedBytes := s.byteLimit - availBytes
	if usedBytes <= s.backpressureMinThreshold {
		return 0
	}

	if usedBytes >= s.backpressureMaxThreshold {
		return s.maxDelay
	}

	scale := float64(usedBytes-s.backpressureMinThreshold) /
		float64(s.backpressureMaxThreshold-s.backpressureMinThreshold)
	delayNs := int64(float64(s.maxDelay.Nanoseconds()) * scale)
	return time.Duration(delayNs) * time.Nanosecond
}

func (s backpressureDiskLimiter) beforeBlockPut(
	ctx context.Context, blockBytes int64,
	log logger.Logger) (int64, error) {
	if blockBytes == 0 {
		// Better to return an error than to panic in Acquire.
		return s.s.Count(), errors.New(
			"beforeBlockPut called with 0 blockBytes")
	}

	delay := s.getDelay()
	if delay > 0 {
		log.CDebugf(ctx, "Delaying block put of %d bytes by %f s",
			blockBytes, delay.Seconds())
	}
	err := s.delayFn(ctx, delay)
	if err != nil {
		return s.s.Count(), err
	}

	return s.s.Acquire(ctx, blockBytes)
}

func (s backpressureDiskLimiter) onBlockPutFail(blockBytes int64) {
	s.s.Release(blockBytes)
}

func (s backpressureDiskLimiter) onBlockDelete(blockBytes int64) {
	if blockBytes > 0 {
		s.s.Release(blockBytes)
	}
}
