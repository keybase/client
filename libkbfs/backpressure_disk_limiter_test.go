// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// TestDefaultDoDelayCancel checks that defaultDoDelay respects
// context cancellation.
func TestDefaultDoDelayCancel(t *testing.T) {
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	cancel()

	err := defaultDoDelay(ctx, individualTestTimeout)
	require.Equal(t, ctx.Err(), errors.Cause(err))
}

func TestBackpressureConstructorError(t *testing.T) {
	log := logger.NewTestLogger(t)
	fakeErr := errors.New("Fake error")
	_, err := newBackpressureDiskLimiterWithFunctions(
		log, 0.1, 0.9, 0.25, 100, 8*time.Second, nil,
		func() (int64, error) {
			return 0, fakeErr
		})
	require.Equal(t, fakeErr, err)
}

// TestBackpressureDiskLimiterCounters checks that various counters
// are updated properly for each public method.
func TestBackpressureDiskLimiterCounters(t *testing.T) {
	var lastDelay time.Duration
	delayFn := func(ctx context.Context, delay time.Duration) error {
		lastDelay = delay
		return nil
	}

	var fakeFreeBytes int64 = 200
	log := logger.NewTestLogger(t)
	bdl, err := newBackpressureDiskLimiterWithFunctions(
		log, 0.1, 0.9, 0.25, 100, 8*time.Second, delayFn,
		func() (int64, error) {
			return fakeFreeBytes, nil
		})
	require.NoError(t, err)

	// byteSemaphoreMax = min(k(J+F), L) = min(0.25(0+200), 100) = 50.
	journalBytes, freeBytes, byteSemaphoreMax :=
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(0), journalBytes)
	require.Equal(t, int64(200), freeBytes)
	require.Equal(t, int64(50), byteSemaphoreMax)
	require.Equal(t, int64(50), bdl.byteSemaphore.Count())

	ctx := context.Background()

	// Increase J by 10, so that increases bSM by 0.25*10 = 2.5, so
	// bSM is now 52.

	availBytes, _ := bdl.onJournalEnable(ctx, 10, 0)
	require.Equal(t, int64(42), availBytes)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(10), journalBytes)
	require.Equal(t, int64(200), freeBytes)
	require.Equal(t, int64(52), byteSemaphoreMax)
	require.Equal(t, int64(42), bdl.byteSemaphore.Count())

	// Decrease J by 9, so that decreases bSM by 0.25*9 = 2.25, so
	// bSM is back to 50.

	bdl.onJournalDisable(ctx, 9, 0)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(1), journalBytes)
	require.Equal(t, int64(200), freeBytes)
	require.Equal(t, int64(50), byteSemaphoreMax)
	require.Equal(t, int64(49), bdl.byteSemaphore.Count())

	// Increase J by 440, so that increases bSM by 0.25*110 = 110,
	// so bSM maxes out at 100, and byteSemaphore should do negative.

	availBytes, _ = bdl.onJournalEnable(ctx, 440, 0)
	require.Equal(t, int64(-341), availBytes)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(441), journalBytes)
	require.Equal(t, int64(200), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(-341), bdl.byteSemaphore.Count())

	// Now revert that increase.

	bdl.onJournalDisable(ctx, 440, 0)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(1), journalBytes)
	require.Equal(t, int64(200), freeBytes)
	require.Equal(t, int64(50), byteSemaphoreMax)
	require.Equal(t, int64(49), bdl.byteSemaphore.Count())

	// This should be a no-op.
	availBytes, _ = bdl.onJournalEnable(ctx, 0, 0)
	require.Equal(t, int64(49), availBytes)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(1), journalBytes)
	require.Equal(t, int64(200), freeBytes)
	require.Equal(t, int64(50), byteSemaphoreMax)
	require.Equal(t, int64(49), bdl.byteSemaphore.Count())

	// So should this.
	bdl.onJournalDisable(ctx, 0, 0)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(1), journalBytes)
	require.Equal(t, int64(200), freeBytes)
	require.Equal(t, int64(50), byteSemaphoreMax)
	require.Equal(t, int64(49), bdl.byteSemaphore.Count())

	// Add more free bytes and put a block successfully.

	fakeFreeBytes = 400

	availBytes, _, err = bdl.beforeBlockPut(context.Background(), 10, 0)
	require.NoError(t, err)
	require.Equal(t, int64(89), availBytes)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(1), journalBytes)
	require.Equal(t, int64(400), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(89), bdl.byteSemaphore.Count())

	bdl.afterBlockPut(ctx, 10, 0, true)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(11), journalBytes)
	require.Equal(t, int64(400), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(89), bdl.byteSemaphore.Count())

	// Then try to put a block but fail it.

	availBytes, _, err = bdl.beforeBlockPut(context.Background(), 9, 0)
	require.NoError(t, err)
	require.Equal(t, int64(80), availBytes)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(11), journalBytes)
	require.Equal(t, int64(400), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(80), bdl.byteSemaphore.Count())

	bdl.afterBlockPut(ctx, 9, 0, false)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(11), journalBytes)
	require.Equal(t, int64(400), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(89), bdl.byteSemaphore.Count())

	// Finally, delete a block.

	bdl.onBlockDelete(ctx, 11, 0)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(0), journalBytes)
	require.Equal(t, int64(400), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(100), bdl.byteSemaphore.Count())

	// This should be a no-op.
	bdl.onBlockDelete(ctx, 0, 0)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(0), journalBytes)
	require.Equal(t, int64(400), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(100), bdl.byteSemaphore.Count())
}

// TestBackpressureDiskLimiterCalculateDelay tests the delay
// calculation, and makes sure it takes into account the context
// deadline.
func TestBackpressureDiskLimiterCalculateDelay(t *testing.T) {
	log := logger.NewTestLogger(t)
	bdl, err := newBackpressureDiskLimiterWithFunctions(
		log, 0.1, 0.9, 0.25, math.MaxInt64, 8*time.Second,
		func(ctx context.Context, delay time.Duration) error {
			return nil
		},
		func() (int64, error) {
			return math.MaxInt64, nil
		})
	require.NoError(t, err)

	now := time.Now()

	ctx := context.Background()
	delay := bdl.calculateDelay(ctx, 50, 350, now)
	require.InEpsilon(t, float64(4), delay.Seconds(), 0.01)

	deadline := now.Add(5 * time.Second)
	ctx2, cancel2 := context.WithDeadline(ctx, deadline)
	defer cancel2()

	delay = bdl.calculateDelay(ctx2, 50, 350, now)
	require.InEpsilon(t, float64(2), delay.Seconds(), 0.01)
}

// TestBackpressureDiskLimiterLargeDiskDelay checks the delays when
// pretending to have a large disk.
func TestBackpressureDiskLimiterLargeDiskDelay(t *testing.T) {
	var lastDelay time.Duration
	delayFn := func(ctx context.Context, delay time.Duration) error {
		lastDelay = delay
		return nil
	}

	// Set up parameters so that byteSemaphoreMax always has
	// value 100 when called in beforeBlockPut, and every block
	// put (of size 0.1 * 100 = 10) beyond the min threshold leads
	// to an increase in timeout of 1 second up to the max.

	const blockSize = 10

	log := logger.NewTestLogger(t)
	bdl, err := newBackpressureDiskLimiterWithFunctions(
		log, 0.1, 0.9, 0.25, 10*blockSize, 8*time.Second, delayFn,
		func() (int64, error) {
			return math.MaxInt64, nil
		})
	require.NoError(t, err)

	journalBytes, freeBytes, byteSemaphoreMax :=
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(0), journalBytes)
	require.Equal(t, int64(math.MaxInt64), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(100), bdl.byteSemaphore.Count())

	ctx := context.Background()

	var bytesPut int

	checkCountersAfterBeforeBlockPut := func() {
		journalBytes, freeBytes, byteSemaphoreMax =
			bdl.getLockedVarsForTest()
		require.Equal(t, int64(bytesPut), journalBytes)
		require.Equal(t, int64(math.MaxInt64), freeBytes)
		require.Equal(t, int64(100), byteSemaphoreMax)
		require.Equal(t, int64(100-bytesPut-blockSize),
			bdl.byteSemaphore.Count())
	}

	checkCountersAfterBlockPut := func() {
		journalBytes, freeBytes, byteSemaphoreMax =
			bdl.getLockedVarsForTest()
		require.Equal(t, int64(bytesPut), journalBytes)
		require.Equal(t, int64(math.MaxInt64), freeBytes)
		require.Equal(t, int64(100), byteSemaphoreMax)
		require.Equal(t, int64(100-bytesPut),
			bdl.byteSemaphore.Count())
	}

	// The first two puts shouldn't encounter any backpressure...

	for i := 0; i < 2; i++ {
		_, _, err = bdl.beforeBlockPut(ctx, blockSize, 0)
		require.NoError(t, err)
		require.Equal(t, 0*time.Second, lastDelay)
		checkCountersAfterBeforeBlockPut()

		bdl.afterBlockPut(ctx, blockSize, 0, true)
		bytesPut += blockSize
		checkCountersAfterBlockPut()
	}

	// ...but the next eight should encounter increasing
	// backpressure...

	for i := 1; i < 9; i++ {
		_, _, err := bdl.beforeBlockPut(ctx, blockSize, 0)
		require.NoError(t, err)
		require.InEpsilon(t, float64(i), lastDelay.Seconds(),
			0.01, "i=%d", i)
		checkCountersAfterBeforeBlockPut()

		bdl.afterBlockPut(ctx, 10, 0, true)
		bytesPut += blockSize
		checkCountersAfterBlockPut()
	}

	// ...and the last one should stall completely, if not for the
	// cancelled context.

	ctx2, cancel2 := context.WithCancel(ctx)
	cancel2()
	_, _, err = bdl.beforeBlockPut(ctx2, blockSize, 0)
	require.Equal(t, ctx2.Err(), errors.Cause(err))
	require.Equal(t, 8*time.Second, lastDelay)

	// This does the same thing as checkCountersAfterBlockPut(),
	// but only by coincidence; contrast with similar block in
	// TestBackpressureDiskLimiterSmallDisk below.
	journalBytes, freeBytes, byteSemaphoreMax = bdl.getLockedVarsForTest()
	require.Equal(t, int64(bytesPut), journalBytes)
	require.Equal(t, int64(math.MaxInt64), freeBytes)
	require.Equal(t, int64(100), byteSemaphoreMax)
	require.Equal(t, int64(100-bytesPut), bdl.byteSemaphore.Count())
}

// TestBackpressureDiskLimiterSmallDiskDelay checks the delays when
// pretending to have a small disk.
func TestBackpressureDiskLimiterSmallDisk(t *testing.T) {
	var lastDelay time.Duration
	delayFn := func(ctx context.Context, delay time.Duration) error {
		lastDelay = delay
		return nil
	}

	// Set up parameters so that byteSemaphoreMax always has
	// value 80 when called in beforeBlockPut, and every block put
	// (of size 0.1 * 80 = 8) beyond the min threshold leads to an
	// increase in timeout of 1 second up to the max.

	const blockSize = 8
	const diskSize = 320

	var bdl *backpressureDiskLimiter

	getFreeBytesFn := func() (int64, error) {
		// When called for the first time from the
		// constructor, bdl will be nil.
		if bdl == nil {
			return diskSize, nil
		}

		// When called in subsequent times from
		// beforeBlockPut, simulate the journal taking up
		// space.
		return diskSize - bdl.journalBytes, nil
	}

	log := logger.NewTestLogger(t)
	bdl, err := newBackpressureDiskLimiterWithFunctions(
		log, 0.1, 0.9, 0.25, math.MaxInt64, 8*time.Second, delayFn,
		getFreeBytesFn)
	require.NoError(t, err)

	journalBytes, freeBytes, byteSemaphoreMax :=
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(0), journalBytes)
	require.Equal(t, int64(diskSize), freeBytes)
	require.Equal(t, int64(80), byteSemaphoreMax)
	require.Equal(t, int64(80), bdl.byteSemaphore.Count())

	ctx := context.Background()

	var bytesPut int

	checkCountersAfterBeforeBlockPut := func() {
		journalBytes, freeBytes, byteSemaphoreMax =
			bdl.getLockedVarsForTest()
		require.Equal(t, int64(bytesPut), journalBytes)
		require.Equal(t, int64(diskSize-journalBytes), freeBytes)
		require.Equal(t, int64(80), byteSemaphoreMax)
		require.Equal(t, int64(80-bytesPut-blockSize),
			bdl.byteSemaphore.Count())
	}

	checkCountersAfterBlockPut := func() {
		journalBytes, freeBytes, byteSemaphoreMax =
			bdl.getLockedVarsForTest()
		require.Equal(t, int64(bytesPut), journalBytes)
		// freeBytes is only updated on beforeBlockPut, so we
		// have to compensate for that.
		expectedFreeBytes := int64(diskSize - journalBytes + blockSize)
		expectedBytesSemaphoreMax := int64(80) + blockSize/4
		expectedBytesSemaphore := expectedBytesSemaphoreMax - int64(bytesPut)
		require.Equal(t, expectedFreeBytes, freeBytes)
		require.Equal(t, expectedBytesSemaphoreMax, byteSemaphoreMax)
		require.Equal(t, expectedBytesSemaphore, bdl.byteSemaphore.Count())
	}

	// The first two puts shouldn't encounter any backpressure...

	for i := 0; i < 2; i++ {
		_, _, err = bdl.beforeBlockPut(ctx, blockSize, 0)
		require.NoError(t, err)
		require.Equal(t, 0*time.Second, lastDelay)
		checkCountersAfterBeforeBlockPut()

		bdl.afterBlockPut(ctx, blockSize, 0, true)
		bytesPut += blockSize
		checkCountersAfterBlockPut()
	}

	// ...but the next eight should encounter increasing
	// backpressure...

	for i := 1; i < 9; i++ {
		_, _, err := bdl.beforeBlockPut(ctx, blockSize, 0)
		require.NoError(t, err)
		require.InEpsilon(t, float64(i), lastDelay.Seconds(),
			0.01, "i=%d", i)
		checkCountersAfterBeforeBlockPut()

		bdl.afterBlockPut(ctx, blockSize, 0, true)
		bytesPut += blockSize
		checkCountersAfterBlockPut()
	}

	// ...and the last one should stall completely, if not for the
	// cancelled context.

	ctx2, cancel2 := context.WithCancel(ctx)
	cancel2()
	_, _, err = bdl.beforeBlockPut(ctx2, blockSize, 0)
	require.Equal(t, ctx2.Err(), errors.Cause(err))
	require.Equal(t, 8*time.Second, lastDelay)

	journalBytes, freeBytes, byteSemaphoreMax =
		bdl.getLockedVarsForTest()
	require.Equal(t, int64(bytesPut), journalBytes)
	require.Equal(t, int64(diskSize-journalBytes), freeBytes)
	require.Equal(t, int64(80), byteSemaphoreMax)
	require.Equal(t, int64(80-bytesPut), bdl.byteSemaphore.Count())
}
