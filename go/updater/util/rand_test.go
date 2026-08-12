// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRandString(t *testing.T) {
	s, err := RandomID("prefix=")
	t.Logf("Rand string: %s", s)
	require.NoError(t, err)
	if !strings.HasPrefix(s, "prefix=") {
		require.Fail(t, "Invalid prefix: %s", s)
	}
	if len(s)-len("prefix.") != 52 {
		require.Fail(t, "Invalid length: %s (%d)", s, len(s))
	}
}
