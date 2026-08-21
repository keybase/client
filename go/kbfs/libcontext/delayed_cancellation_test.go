// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libcontext

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type testDCKeyType int

const (
	testDCKey testDCKeyType = iota
)

func TestReplayableContext(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ctx = NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, testDCKey, "O_O")
	})
	ctx, cancel := context.WithCancel(ctx)

	ctx, err := NewContextWithReplayFrom(ctx)
	require.NoError(t, err,
		"calling NewContextWithReplayFrom error: %s", err)

	// Test if replay was run properly
	require.Equal(t, "O_O", ctx.Value(testDCKey), "NewContextWithReplayFrom did not replay attached replayFunc")

	// Test if cancellation is disabled
	cancel()
	select {
	case <-ctx.Done():
		require.FailNow(t, "NewContextWithReplayFrom did not disconnect the cancel function")
	default:
	}

	// make sure the new ctx is also replayable
	ctx, err = NewContextWithReplayFrom(ctx)
	require.NoError(t, err,
		"calling NewContextWithReplayFrom error: %s", err)
	require.Equal(t, "O_O", ctx.Value(testDCKey), "NewContextWithReplayFrom did not replay attached replayFunc")
}

func makeContextWithDelayedCancellation(t *testing.T) (
	ctx context.Context, originalCancel context.CancelFunc,
) {
	ctx = context.Background()
	ctx = NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, testDCKey, "O_O")
	})
	ctx, cancel := context.WithCancel(ctx)

	ctx, err := NewContextWithCancellationDelayer(ctx)
	require.NoError(t, err,
		"calling NewContextWithCancellationDelayer error: %s", err)

	// Test NewContextWithCancellationDelayer does replay properly
	require.Equal(t, "O_O", ctx.Value(testDCKey),
		"NewContextWithCancellationDelayer did not replay attached replayFunc")

	return ctx, cancel
}

func TestDelayedCancellationCancelWhileNotEnabled(t *testing.T) {
	t.Parallel()

	ctx, cancel := makeContextWithDelayedCancellation(t)

	cancel()

	select {
	case <-ctx.Done():
	case <-time.After(100 * time.Millisecond):
		require.FailNow(t, fmt.Sprintf("Cancellation did not happen even though "+
			"EnableDelayedCancellationWithGracePeriod has not been called yet"))
	}
}

func TestDelayedCancellationCleanupWhileNotEnabled(t *testing.T) {
	t.Parallel()

	ctx, _ := makeContextWithDelayedCancellation(t)

	if err := CleanupCancellationDelayer(ctx); err != nil {
		require.NoError(t, err,
			"calling CleanupCancellationDelayer error: %s", err)
	}

	select {
	case <-ctx.Done():
	case <-time.After(100 * time.Millisecond):
		require.FailNow(t, fmt.Sprintf("Cancellation did not happen even though "+
			"EnableDelayedCancellationWithGracePeriod has not been called yet"))
	}
}

func TestDelayedCancellationSecondEnable(t *testing.T) {
	t.Parallel()

	ctx, cancel := makeContextWithDelayedCancellation(t)
	defer cancel()

	err := EnableDelayedCancellationWithGracePeriod(ctx, 0)
	require.NoError(t, err,
		"1st EnableDelayedCancellationWithGracePeriod failed: %v", err)
	cancel()
	<-ctx.Done()
	// parent context is not canceled; second "enable" should succeed even it's
	// after grace period
	err = EnableDelayedCancellationWithGracePeriod(ctx, 0)
	require.Error(t, err,
		"2nd EnableDelayedCancellationWithGracePeriod succeeded even "+
			"though more than grace period has passed since parent context was "+
			"canceled")
}

func TestDelayedCancellationEnabled(t *testing.T) {
	t.Parallel()

	ctx, cancel := makeContextWithDelayedCancellation(t)
	err := EnableDelayedCancellationWithGracePeriod(ctx, 50*time.Millisecond)
	require.NoError(t, err,
		"EnableDelayedCancellationWithGracePeriod failed: %v", err)

	cancel()

	select {
	case <-ctx.Done():
		require.FailNow(t, "Cancellation is not delayed")
	case <-time.After(10 * time.Millisecond):
	}

	<-ctx.Done()

	// if test timeouts, then it's a failure: Cancellation did not happen after
	// grace period
}
