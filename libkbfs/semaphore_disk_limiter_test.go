// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

// TestSemaphoreDiskLimiterBeforeBlockPutError checks that
// semaphoreDiskLimiter.beforeBlockPut handles errors correctly; in
// particular, that we don't leak either bytes or files if either
// semaphore times out.
func TestSemaphoreDiskLimiterBeforeBlockPutError(t *testing.T) {
	sdl := newSemaphoreDiskLimiter(10, 1)

	ctx, cancel := context.WithTimeout(
		context.Background(), 3*time.Millisecond)
	defer cancel()

	availBytes, availFiles, err := sdl.beforeBlockPut(ctx, 10, 2)
	require.Equal(t, ctx.Err(), errors.Cause(err))
	require.Equal(t, int64(10), availBytes)
	require.Equal(t, int64(1), availFiles)

	require.Equal(t, int64(10), sdl.byteSemaphore.Count())
	require.Equal(t, int64(1), sdl.fileSemaphore.Count())
}
