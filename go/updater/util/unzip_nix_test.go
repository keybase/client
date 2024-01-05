// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build !windows
// +build !windows

package util

import (
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUnzipOtherUser checks to make sure that a zip file created from a
// different uid has the current uid after unpacking.
func TestUnzipOtherUser(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unsupported on windows")
	}
	_, filename, _, _ := runtime.Caller(0)
	testZipOtherUserPath := filepath.Join(filepath.Dir(filename), "../test/test-uid-503.zip")
	destinationPath := TempPath("", "TestUnzipOtherUser.")
	err := Unzip(testZipOtherUserPath, destinationPath, testLog)
	require.NoError(t, err)

	// Get uid, gid of current user
	currentUser, err := user.Current()
	require.NoError(t, err)
	uid, err := strconv.Atoi(currentUser.Uid)
	require.NoError(t, err)

	fileInfo, err := os.Stat(filepath.Join(destinationPath, "test"))
	require.NoError(t, err)
	fileUID := fileInfo.Sys().(*syscall.Stat_t).Uid
	assert.Equal(t, uid, int(fileUID))
}

// TestUnzipFileModTime checks to make sure after unpacking zip file the file
// modification time is "now" and not the original file time.
func TestUnzipFileModTime(t *testing.T) {
	// Fudge now a bit, since the timestamps below on Linux seem
	// to happen a bit *before* now.
	now := time.Now().Add(-time.Second)
	t.Logf("Now: %s", now)
	destinationPath := TempPath("", "TestUnzipFileModTime.")
	err := Unzip(testZipPath, destinationPath, testLog)
	require.NoError(t, err)

	fileInfo, err := os.Stat(filepath.Join(destinationPath, "test"))
	require.NoError(t, err)
	dirMod := fileInfo.ModTime()
	diffDir := dirMod.Sub(now)
	t.Logf("Diff (dir): %s", diffDir)
	assert.True(t, diffDir >= 0, "now=%s, dirtime=%s", now, dirMod)

	fileInfo, err = os.Stat(filepath.Join(destinationPath, "test", "testfile"))
	require.NoError(t, err)
	fileMod := fileInfo.ModTime()
	diffFile := fileMod.Sub(now)
	t.Logf("Diff (file): %s", diffFile)
	assert.True(t, diffFile >= 0, "now=%s, filetime=%s", now, fileMod)
}
