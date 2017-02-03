// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestDiskLimits checks that getDiskLimits() doesn't return an error,
// and returns a non-zero value. This assumes that the partition with
// the root directory actually has free space, which may fail in
// certain weird configs.
func TestDiskLimits(t *testing.T) {
	availableBytes, err := getDiskLimits("/")
	require.NoError(t, err)
	require.NotEqual(t, uint64(0), availableBytes)
}
