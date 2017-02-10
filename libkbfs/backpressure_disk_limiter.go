// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// backpressureDiskLimiter is an implementation of diskLimiter that
// uses backpressure to slow down block puts before they hit the disk
// limit.
//
// Let J be the (approximate) byte usage of the journal and F be the
// free bytes on disk. Then we want to enforce
//
//   J <= min(k(J+F), L),
//
// where 0 < k <= 1 is some fraction, and L > 0 is the absolute byte
// usage limit. But in addition to that, we want to set thresholds 0
// <= m <= M <= 1 such that we apply proportional backpressure (with a
// given maximum delay) when
//
//   m <= max(J/(k(J+F)), J/L) <= M,
//
// which is equivalent to
//
//   m <= J/min(k(J+F), L) <= M.
type backpressureDiskLimiter struct {
	log logger.Logger
	// backpressureMinThreshold is m in the above.
	backpressureMinThreshold float64
	// backpressureMaxThreshold is M in the above.
	backpressureMaxThreshold float64
	// maxJournalByteFrac is k in the above.
	maxJournalByteFrac float64
	// maxJournalBytes is L in the above.
	maxJournalBytes int64
	maxDelay        time.Duration
	delayFn         func(context.Context, time.Duration) error
	freeBytesFn     func() (int64, error)

	// bytesLock protects freeBytes, journalBytes,
	// bytesSemaphoreMax, and the (implicit) maximum value of
	// bytesSemaphore (== bytesSemaphoreMax).
	bytesLock         sync.Mutex
	journalBytes      int64
	freeBytes         int64
	bytesSemaphoreMax int64
	bytesSemaphore    *kbfssync.Semaphore
}

var _ diskLimiter = (*backpressureDiskLimiter)(nil)

// newBackpressureDiskLimiterWithFunctions constructs a new
// backpressureDiskLimiter with the given parameters, and also the
// given delay function, which is overridden in tests.
func newBackpressureDiskLimiterWithFunctions(
	log logger.Logger,
	backpressureMinThreshold, backpressureMaxThreshold, maxJournalByteFrac float64,
	maxJournalBytes int64, maxDelay time.Duration,
	delayFn func(context.Context, time.Duration) error,
	freeBytesFn func() (int64, error)) (
	*backpressureDiskLimiter, error) {
	if backpressureMinThreshold < 0.0 {
		return nil, errors.Errorf("backpressureMinThreshold=%f < 0.0",
			backpressureMinThreshold)
	}
	if backpressureMaxThreshold < backpressureMinThreshold {
		return nil, errors.Errorf(
			"backpressureMaxThreshold=%f < backpressureMinThreshold=%f",
			backpressureMaxThreshold, backpressureMinThreshold)
	}
	if 1.0 < backpressureMaxThreshold {
		return nil, errors.Errorf("1.0 < backpressureMaxThreshold=%f",
			backpressureMaxThreshold)
	}
	if maxJournalByteFrac < 0.01 {
		return nil, errors.Errorf("maxJournalByteFrac=%f < 0.01",
			maxJournalByteFrac)
	}
	if maxJournalByteFrac > 1.0 {
		return nil, errors.Errorf("maxJournalByteFrac=%f > 1.0",
			maxJournalByteFrac)
	}
	freeBytes, err := freeBytesFn()
	if err != nil {
		return nil, err
	}
	bdl := &backpressureDiskLimiter{
		log, backpressureMinThreshold, backpressureMaxThreshold,
		maxJournalByteFrac, maxJournalBytes, maxDelay,
		delayFn, freeBytesFn, sync.Mutex{}, 0,
		freeBytes, 0, kbfssync.NewSemaphore(),
	}
	func() {
		bdl.bytesLock.Lock()
		defer bdl.bytesLock.Unlock()
		bdl.updateBytesSemaphoreMaxLocked()
	}()
	return bdl, nil
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

func defaultGetFreeBytes(path string) (int64, error) {
	// getDiskLimits returns availableBytes, but we want to avoid
	// confusing that with availBytes in the sense of the
	// semaphore value.
	freeBytes, err := getDiskLimits(path)
	if err != nil {
		return 0, err
	}

	if freeBytes > uint64(math.MaxInt64) {
		return math.MaxInt64, nil
	}
	return int64(freeBytes), nil
}

// newBackpressureDiskLimiter constructs a new backpressureDiskLimiter
// with the given parameters.
func newBackpressureDiskLimiter(
	log logger.Logger,
	backpressureMinThreshold, backpressureMaxThreshold, maxJournalByteFrac float64,
	maxJournalBytes int64, maxDelay time.Duration,
	journalPath string) (*backpressureDiskLimiter, error) {
	return newBackpressureDiskLimiterWithFunctions(
		log, backpressureMinThreshold, backpressureMaxThreshold,
		maxJournalByteFrac, maxJournalBytes, maxDelay,
		defaultDoDelay, func() (int64, error) {
			return defaultGetFreeBytes(journalPath)
		})
}

func (bdl *backpressureDiskLimiter) getLockedVarsForTest() (
	journalBytes int64, freeBytes int64, bytesSemaphoreMax int64) {
	bdl.bytesLock.Lock()
	defer bdl.bytesLock.Unlock()
	return bdl.journalBytes, bdl.freeBytes, bdl.bytesSemaphoreMax
}

// getMaxJournalBytes returns the byte limit for the journal, taking
// into account the amount of free space left. This is min(k(J+F), L).
func (bdl *backpressureDiskLimiter) getMaxJournalBytes(
	journalBytes, freeBytes int64) float64 {
	// Calculate k(J+F), converting to float64 first to avoid
	// overflow, although losing some precision in the process.
	journalBytesFloat := float64(journalBytes)
	freeBytesFloat := float64(freeBytes)
	maxJournalBytes :=
		bdl.maxJournalByteFrac * (journalBytesFloat + freeBytesFloat)
	return math.Min(maxJournalBytes, float64(bdl.maxJournalBytes))
}

// updateBytesSemaphoreMaxLocked must be called (under s.bytesLock)
// whenever s.journalBytes or s.freeBytes changes.
func (bdl *backpressureDiskLimiter) updateBytesSemaphoreMaxLocked() {
	newMax := int64(bdl.getMaxJournalBytes(bdl.journalBytes, bdl.freeBytes))
	delta := newMax - bdl.bytesSemaphoreMax
	// These operations are adjusting the *maximum* value of
	// bdl.bytesSemaphore.
	if delta > 0 {
		bdl.bytesSemaphore.Release(delta)
	} else if delta < 0 {
		bdl.bytesSemaphore.ForceAcquire(-delta)
	}
	bdl.bytesSemaphoreMax = newMax
}

func (bdl *backpressureDiskLimiter) onJournalEnable(
	ctx context.Context, journalBytes int64) int64 {
	bdl.bytesLock.Lock()
	defer bdl.bytesLock.Unlock()
	bdl.journalBytes += journalBytes
	bdl.updateBytesSemaphoreMaxLocked()
	if journalBytes > 0 {
		bdl.bytesSemaphore.ForceAcquire(journalBytes)
	}
	return bdl.bytesSemaphore.Count()
}

func (bdl *backpressureDiskLimiter) onJournalDisable(
	ctx context.Context, journalBytes int64) {
	bdl.bytesLock.Lock()
	defer bdl.bytesLock.Unlock()
	bdl.journalBytes -= journalBytes
	bdl.updateBytesSemaphoreMaxLocked()
	if journalBytes > 0 {
		bdl.bytesSemaphore.Release(journalBytes)
	}
}

func (bdl *backpressureDiskLimiter) calculateDelay(
	ctx context.Context, journalBytes, freeBytes int64,
	now time.Time) time.Duration {
	journalBytesFloat := float64(journalBytes)
	r := journalBytesFloat / bdl.getMaxJournalBytes(journalBytes, freeBytes)

	// We want the delay to be 0 if r <= m and the max delay if r
	// >= M, so linearly interpolate the delay based on r.
	m := bdl.backpressureMinThreshold
	M := bdl.backpressureMaxThreshold
	scale := math.Min(1.0, math.Max(0.0, (r-m)/(M-m)))

	// Set maxDelay to min(bdl.maxDelay, time until deadline - 1s).
	maxDelay := bdl.maxDelay
	if deadline, ok := ctx.Deadline(); ok {
		// Subtract a second to allow for some slack.
		remainingTime := deadline.Sub(now) - time.Second
		if remainingTime < maxDelay {
			maxDelay = remainingTime
		}
	}

	return time.Duration(scale * float64(maxDelay))
}

func (bdl *backpressureDiskLimiter) beforeBlockPut(
	ctx context.Context, blockBytes int64) (int64, error) {
	if blockBytes == 0 {
		// Better to return an error than to panic in Acquire.
		return bdl.bytesSemaphore.Count(), errors.New(
			"backpressureDiskLimiter.beforeBlockPut called with 0 blockBytes")
	}

	journalBytes, freeBytes, err := func() (int64, int64, error) {
		bdl.bytesLock.Lock()
		defer bdl.bytesLock.Unlock()

		freeBytes, err := bdl.freeBytesFn()
		if err != nil {
			return 0, 0, err
		}

		bdl.freeBytes = freeBytes
		bdl.updateBytesSemaphoreMaxLocked()
		return bdl.journalBytes, bdl.freeBytes, nil
	}()
	if err != nil {
		return bdl.bytesSemaphore.Count(), err
	}

	delay := bdl.calculateDelay(ctx, journalBytes, freeBytes, time.Now())
	if delay > 0 {
		bdl.log.CDebugf(ctx, "Delaying block put of %d bytes by %f s",
			blockBytes, delay.Seconds())
	}
	// TODO: Update delay if any variables change (i.e., we
	// suddenly free up a lot of space).
	err = bdl.delayFn(ctx, delay)
	if err != nil {
		return bdl.bytesSemaphore.Count(), err
	}

	return bdl.bytesSemaphore.Acquire(ctx, blockBytes)
}

func (bdl *backpressureDiskLimiter) afterBlockPut(
	ctx context.Context, blockBytes int64, putData bool) {
	if putData {
		bdl.bytesLock.Lock()
		defer bdl.bytesLock.Unlock()
		bdl.journalBytes += blockBytes
		bdl.updateBytesSemaphoreMaxLocked()
	} else {
		bdl.bytesSemaphore.Release(blockBytes)
	}
}

func (bdl *backpressureDiskLimiter) onBlockDelete(
	ctx context.Context, blockBytes int64) {
	if blockBytes == 0 {
		return
	}

	bdl.bytesSemaphore.Release(blockBytes)

	bdl.bytesLock.Lock()
	defer bdl.bytesLock.Unlock()
	bdl.journalBytes -= blockBytes
	bdl.updateBytesSemaphoreMaxLocked()
}
