// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestFetchDecider(t *testing.T) {
	errCh := make(chan error, 1)
	fetcher := func(ctx context.Context) error {
		return <-errCh
	}

	log := logger.NewTestLogger(t)
	clock := newTestClockNow()
	fd := newFetchDecider(log, fetcher, "", "", &testClockGetter{clock})
	ctx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	defer cancel()

	t.Log("Blocking fetch")
	errCh <- nil
	err := fd.Do(ctx, 2*time.Second, 4*time.Second, time.Time{})
	require.NoError(t, err)

	t.Log("Use cached value (`fetcher` isn't called)")
	err = fd.Do(
		ctx, 2*time.Second, 4*time.Second, clock.Now().Add(-1*time.Second))
	require.NoError(t, err)

	t.Log("Use cached value, but launch bg fetcher (will return before " +
		"`fetcher` completes)")
	err = fd.Do(
		ctx, 2*time.Second, 4*time.Second, clock.Now().Add(-3*time.Second))
	require.NoError(t, err)

	errCh <- nil // Let the background fetcher complete.

	// Once we can put a new value in the sized-1 `errCh`, we know the
	// bg fetch has finished.
	errCh <- nil
	<-errCh

	t.Log("Use cached value, and subsequent blocking call will wait for " +
		"the background fetcher")
	err = fd.Do(
		ctx, 2*time.Second, 4*time.Second, clock.Now().Add(-3*time.Second))
	require.NoError(t, err)

	checkBlocking := make(chan struct{})
	fd.blockingForTest = checkBlocking
	blockingCh := make(chan error, 1)
	go func() {
		blockingCh <- fd.Do(ctx, 2*time.Second, 4*time.Second, time.Time{})
	}()

	// Wait for the previous call to start blocking.
	select {
	case <-checkBlocking:
	case <-ctx.Done():
		require.NoError(t, ctx.Err())
	}

	errCh <- nil
	select {
	case err = <-blockingCh:
		require.NoError(t, err)
	case <-ctx.Done():
		require.NoError(t, ctx.Err())
	}
}
