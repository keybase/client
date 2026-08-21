// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestRateLimit(t *testing.T) {
	tc := SetupTest(t, "rateLimit", 0)
	defer tc.Cleanup()
	limits := NewRateLimits(tc.G)
	require.True(t, limits.GetPermission(TestEventRateLimit, 1*time.Minute),
		"expected to get permission")
	require.True(t, limits.GetPermission(TestEventRateLimit, 0),
		"expected to get permission again with a zero interval")
	require.False(t, limits.GetPermission(TestEventRateLimit, 1*time.Minute),
		"expected not to get permission with a long interval")
}
