// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPreferredMountSatisfied(t *testing.T) {
	require.True(t, preferredMountSatisfied(false, nil))
	require.False(t, preferredMountSatisfied(true, nil))
	require.True(t, preferredMountSatisfied(true, []string{"/keybase"}))
}
