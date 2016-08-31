// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"golang.org/x/net/context"
)

func TestReplayableContext(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ctx = NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, "test", "O_O")
	})
	ctx, cancel := context.WithCancel(ctx)

	ctx, err := NewContextWithReplayFrom(ctx)
	if err != nil {
		t.Fatalf("calling NewContextWithReplayFrom error: %s", err)
	}

	// Test if replay was run properly
	if ctx.Value("test") != "O_O" {
		t.Fatalf("NewContextWithReplayFrom did not replay attached replayFunc")
	}

	// Test if cancellation is disabled
	cancel()
	select {
	case <-ctx.Done():
		t.Fatalf("NewContextWithReplayFrom did not disconnect the cancel function")
	default:
	}

	// make sure the new ctx is also replayable
	ctx, err = NewContextWithReplayFrom(ctx)
	if err != nil {
		t.Fatalf("calling NewContextWithReplayFrom error: %s", err)
	}
	if ctx.Value("test") != "O_O" {
		t.Fatalf("NewContextWithReplayFrom did not replay attached replayFunc")
	}
}

func makeContextWithDelayedCancellation(t *testing.T) (
	ctx context.Context, originalCancel context.CancelFunc) {
	ctx = context.Background()
	ctx = NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, "test", "O_O")
	})
	ctx, cancel := context.WithCancel(ctx)

	ctx, err := NewContextWithCancellationDelayer(ctx)
	if err != nil {
		t.Fatalf("calling NewContextWithCancellationDelayer error: %s", err)
	}

	// Test NewContextWithCancellationDelayer does replay properly
	if ctx.Value("test") != "O_O" {
		t.Fatalf(
			"NewContextWithCancellationDelayer did not replay attached replayFunc")
	}

	return ctx, cancel
}

func TestDelayedCancellationCancelWhileNotEnabled(t *testing.T) {
	t.Parallel()

	ctx, cancel := makeContextWithDelayedCancellation(t)

	cancel()

	select {
	case <-ctx.Done():
	case <-time.After(100 * time.Millisecond):
		t.Fatalf("Cancellation did not happen even though " +
			"EnableDelayedCancellationWithGracePeriod has not been called yet")
	}
}

func TestDelayedCancellationCleanupWhileNotEnabled(t *testing.T) {
	t.Parallel()

	ctx, _ := makeContextWithDelayedCancellation(t)

	if err := CleanupCancellationDelayer(ctx); err != nil {
		t.Fatalf("calling CleanupCancellationDelayer error: %s", err)
	}

	select {
	case <-ctx.Done():
	case <-time.After(100 * time.Millisecond):
		t.Fatalf("Cancellation did not happen even though " +
			"EnableDelayedCancellationWithGracePeriod has not been called yet")
	}
}

func TestDelayedCancellationEnabled(t *testing.T) {
	t.Parallel()

	ctx, cancel := makeContextWithDelayedCancellation(t)
	EnableDelayedCancellationWithGracePeriod(ctx, 15*time.Millisecond)

	cancel()

	select {
	case <-ctx.Done():
		t.Fatalf("Cancellation is not delayed")
	case <-time.After(10 * time.Millisecond):
	}

	select {
	case <-ctx.Done():
	case <-time.After(10 * time.Millisecond):
		t.Fatalf("Cancellation did not happen after grace period")
	}
}
