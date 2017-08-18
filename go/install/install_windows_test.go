// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"io/ioutil"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"os"
	"path/filepath"
)

func TestIsInUse(t *testing.T) {
	tc := libkb.SetupTest(t, "TestIsInUse", 1)

	// Should be false if no special file is present
	require.False(t, IsInUse("", tc.G.Log))

	tmpdir, err := ioutil.TempDir("", "TestIsInUse")
	assert.Nil(t, err, "can't create temp tmpdir")

	signalFileName := filepath.Join(tmpdir, ".kbfs_number_of_handles")

	// Should be false if special file is empty
	require.False(t, IsInUse(tmpdir, tc.G.Log))

	d := []byte("5")
	assert.Nil(t, ioutil.WriteFile(signalFileName, d, 0644))
	defer os.Remove(signalFileName)

	// Should be true if special file has a number
	require.True(t, IsInUse(tmpdir, tc.G.Log))

	d = []byte("0")
	assert.Nil(t, ioutil.WriteFile(signalFileName, d, 0644))

	// Should be false if special file has a zero
	require.False(t, IsInUse(tmpdir, tc.G.Log))
}
