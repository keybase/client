// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"golang.org/x/net/context"
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
	if err != nil {
		t.Fatalf("calling NewContextWithReplayFrom error: %s", err)
	}

	// Test if replay was run properly
	if ctx.Value(testDCKey) != "O_O" {
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
	if ctx.Value(testDCKey) != "O_O" {
		t.Fatalf("NewContextWithReplayFrom did not replay attached replayFunc")
	}
}

func makeContextWithDelayedCancellation(t *testing.T) (
	ctx context.Context, originalCancel context.CancelFunc) {
	ctx = context.Background()
	ctx = NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, testDCKey, "O_O")
	})
	ctx, cancel := context.WithCancel(ctx)

	ctx, err := NewContextWithCancellationDelayer(ctx)
	if err != nil {
		t.Fatalf("calling NewContextWithCancellationDelayer error: %s", err)
	}

	// Test NewContextWithCancellationDelayer does replay properly
	if ctx.Value(testDCKey) != "O_O" {
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

func TestDelayedCancellationSecondEnable(t *testing.T) {
	t.Parallel()

	ctx, cancel := makeContextWithDelayedCancellation(t)
	defer cancel()

	err := EnableDelayedCancellationWithGracePeriod(ctx, 0)
	if err != nil {
		t.Fatalf("1st EnableDelayedCancellationWithGracePeriod failed: %v", err)
	}
	cancel()
	<-ctx.Done()
	// parent context is not canceled; second "enable" should succeed even it's
	// after grace period
	err = EnableDelayedCancellationWithGracePeriod(ctx, 0)
	if err == nil {
		t.Fatalf("2nd EnableDelayedCancellationWithGracePeriod succeeded even " +
			"though more than grace period has passed since parent context was " +
			"canceled")
	}
}

func TestDelayedCancellationEnabled(t *testing.T) {
	t.Parallel()

	ctx, cancel := makeContextWithDelayedCancellation(t)
	EnableDelayedCancellationWithGracePeriod(ctx, 50*time.Millisecond)

	cancel()

	select {
	case <-ctx.Done():
		t.Fatalf("Cancellation is not delayed")
	case <-time.After(10 * time.Millisecond):
	}

	<-ctx.Done()

	// if test timeouts, then it's a failure: Cancellation did not happen after
	// grace period
}
