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

func TestBackpressureDiskLimiter(t *testing.T) {
	var lastDelay time.Duration
	delayFn := func(ctx context.Context, delay time.Duration) error {
		lastDelay = delay
		return nil
	}

	bdl := newBackpressureDiskLimiterWithDelayFunction(
		10, 100, 110, 9*time.Second, delayFn)
	ctx := context.Background()
	log := logger.NewTestLogger(t)
	_, err := bdl.beforeBlockPut(ctx, 10, log)
	require.NoError(t, err)
	require.Equal(t, 0*time.Second, lastDelay)

	for i := 0; i < 9; i++ {
		_, err = bdl.beforeBlockPut(ctx, 10, log)
		require.NoError(t, err)
		require.Equal(t, time.Duration(i)*time.Second, lastDelay)
	}

	_, err = bdl.beforeBlockPut(ctx, 10, log)
	require.NoError(t, err)
	require.Equal(t, 9*time.Second, lastDelay)
}
