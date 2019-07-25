// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfssync

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

var testTimeout = 10 * time.Second

type acquireCall struct {
	n     int64
	count int64
	err   error
}

func callAcquire(ctx context.Context, s *Semaphore, n int64) acquireCall {
	count, err := s.Acquire(ctx, n)
	return acquireCall{n, count, err}
}

// requireNoCall checks that there is nothing to read from
// callCh. This is a racy check since it doesn't distinguish between
// the goroutine with the call not having run yet, and the goroutine
// with the call having run but being blocked on the semaphore.
func requireNoCall(t *testing.T, callCh <-chan acquireCall) {
	select {
	case call := <-callCh:
		t.Fatalf("Unexpected call: %+v", call)
	default:
	}
}

// TestSimple tests that Acquire and Release work in a simple
// two-goroutine scenario.
func TestSimple(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	var n int64 = 10

	s := NewSemaphore()
	require.Equal(t, int64(0), s.Count())

	callCh := make(chan acquireCall, 1)
	go func() {
		callCh <- callAcquire(ctx, s, n)
	}()

	requireNoCall(t, callCh)

	count := s.Release(n - 1)
	require.Equal(t, n-1, count)
	require.Equal(t, n-1, s.Count())

	requireNoCall(t, callCh)

	count = s.Release(1)
	require.Equal(t, n, count)

	select {
	case call := <-callCh:
		require.Equal(t, acquireCall{n, 0, nil}, call)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	require.Equal(t, int64(0), s.Count())
}

// TestForceAcquire tests that ForceAcquire works in a simple two-goroutine
// scenario.
func TestForceAcquire(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	var n int64 = 10

	s := NewSemaphore()
	require.Equal(t, int64(0), s.Count())

	callCh := make(chan acquireCall, 1)
	go func() {
		callCh <- callAcquire(ctx, s, n)
	}()

	requireNoCall(t, callCh)

	count := s.Release(n - 1)
	require.Equal(t, n-1, count)
	require.Equal(t, n-1, s.Count())

	requireNoCall(t, callCh)

	count = s.ForceAcquire(n)
	require.Equal(t, int64(-1), count)
	require.Equal(t, int64(-1), s.Count())

	count = s.Release(n + 1)
	require.Equal(t, n, count)

	select {
	case call := <-callCh:
		require.Equal(t, acquireCall{n, 0, nil}, call)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	require.Equal(t, int64(0), s.Count())
}

// TestCancel tests that cancelling the context passed into Acquire
// causes it to return an error.
func TestCancel(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	ctx2, cancel2 := context.WithCancel(ctx)
	defer cancel2()

	var n int64 = 10

	s := NewSemaphore()
	require.Equal(t, int64(0), s.Count())

	// Do this before spawning the goroutine, so that
	// callAcquire() will always return a count of n-1.
	count := s.Release(n - 1)
	require.Equal(t, n-1, count)
	require.Equal(t, n-1, s.Count())

	callCh := make(chan acquireCall, 1)
	go func() {
		callCh <- callAcquire(ctx2, s, n)
	}()

	requireNoCall(t, callCh)

	cancel2()
	require.Equal(t, n-1, s.Count())

	select {
	case call := <-callCh:
		call.err = errors.Cause(call.err)
		require.Equal(t, acquireCall{n, n - 1, context.Canceled}, call)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	require.Equal(t, n-1, s.Count())
}

// TestSerialRelease tests that Release(1) causes exactly one waiting
// Acquire(1) to wake up at a time.
func TestSerialRelease(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	acquirerCount := 100

	s := NewSemaphore()
	acquireCount := 0
	callCh := make(chan acquireCall, acquirerCount)
	for i := 0; i < acquirerCount; i++ {
		go func() {
			call := callAcquire(ctx, s, 1)
			acquireCount++
			callCh <- call
		}()
	}

	for i := 0; i < acquirerCount; i++ {
		requireNoCall(t, callCh)

		count := s.Release(1)
		require.Equal(t, int64(1), count)

		select {
		case call := <-callCh:
			require.Equal(t, acquireCall{1, 0, nil}, call)
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		}

		requireNoCall(t, callCh)

		require.Equal(t, int64(0), s.Count())
	}

	// acquireCount should have been incremented race-free.
	require.Equal(t, acquirerCount, acquireCount)
}

// TestAcquireDifferentSizes tests the scenario where there are
// multiple acquirers for different sizes, and we release each size in
// increasing order.
func TestAcquireDifferentSizes(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	acquirerCount := 10

	s := NewSemaphore()
	acquireCount := 0
	callCh := make(chan acquireCall, acquirerCount)
	for i := 0; i < acquirerCount; i++ {
		go func(i int) {
			call := callAcquire(ctx, s, int64(i+1))
			acquireCount++
			callCh <- call
		}(i)
	}

	for i := 0; i < acquirerCount; i++ {
		requireNoCall(t, callCh)

		if i == 0 {
			require.Equal(t, int64(0), s.Count())
		} else {
			count := s.Release(int64(i))
			require.Equal(t, int64(i), count)
			require.Equal(t, int64(i), s.Count())
		}

		requireNoCall(t, callCh)

		count := s.Release(1)
		require.Equal(t, int64(i+1), count)

		select {
		case call := <-callCh:
			require.Equal(t, acquireCall{int64(i + 1), 0, nil}, call)
		case <-ctx.Done():
			t.Fatalf("err=%+v, i=%d", ctx.Err(), i)
		}

		requireNoCall(t, callCh)

		require.Equal(t, int64(0), s.Count())
	}

	// acquireCount should have been incremented race-free.
	require.Equal(t, acquirerCount, acquireCount)
}

func TestAcquirePanic(t *testing.T) {
	s := NewSemaphore()
	ctx := context.Background()
	require.Panics(t, func() {
		_, _ = s.Acquire(ctx, 0)
	})
	require.Panics(t, func() {
		_, _ = s.Acquire(ctx, -1)
	})
}

func TestForceAcquirePanic(t *testing.T) {
	s := NewSemaphore()
	require.Panics(t, func() {
		s.ForceAcquire(0)
	})
	require.Panics(t, func() {
		s.ForceAcquire(-1)
	})
	s.ForceAcquire(2)
	require.Panics(t, func() {
		s.ForceAcquire(math.MaxInt64)
	})
}

func TestReleasePanic(t *testing.T) {
	s := NewSemaphore()
	require.Panics(t, func() {
		s.Release(0)
	})
	require.Panics(t, func() {
		s.Release(-1)
	})
	s.Release(1)
	require.Panics(t, func() {
		s.Release(math.MaxInt64)
	})
}
