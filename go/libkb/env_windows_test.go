// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build windows

package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEnvWindows(t *testing.T) {
	env := newEnv(nil, nil, "windows", makeLogGetter(t))

	mountDir, err := env.GetMountDir()
	require.NoError(t, err)

	require.Empty(t, mountDir, "Windows needs an empty default mount dir")
}
