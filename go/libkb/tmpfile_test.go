// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTempFile(t *testing.T) {
	name, file, err := OpenTempFile("test", "", 0o700)
	require.NoError(t, err, "%s", err)
	defer file.Close()
	require.NotNil(t, file,
		"No file")
	defer os.Remove(name)
	require.True(t, strings.HasPrefix(name, "test."), "Bad temp file name: %s", name)
	require.False(t, len(name) < 37, "Bad temp file name length: %s", name)
}
