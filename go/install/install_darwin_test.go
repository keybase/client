// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin

package install

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/blang/semver"
	"github.com/stretchr/testify/require"
)

func TestOSVersion(t *testing.T) {
	ver, err := OSVersion()
	require.NoError(t, err)
	t.Logf("Version: %s", ver)
	require.True(t, ver.GTE(semver.MustParse("10.0.0")))
}

func TestRemoveLegacyKBNMManifests(t *testing.T) {
	homeDir := t.TempDir()
	paths, err := legacyKBNMManifestPaths(homeDir, false)
	require.NoError(t, err)

	for _, path := range paths {
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o700))
		require.NoError(t, os.WriteFile(path, []byte("legacy manifest"), 0o600))
	}
	unrelatedPath := filepath.Join(filepath.Dir(paths[0]), "keep.json")
	require.NoError(t, os.WriteFile(unrelatedPath, []byte("keep"), 0o600))

	require.NoError(t, removeLegacyKBNMManifests(paths))
	for _, path := range paths {
		_, err := os.Lstat(path)
		require.ErrorIs(t, err, os.ErrNotExist)
	}
	_, err = os.Lstat(unrelatedPath)
	require.NoError(t, err)

	// A second cleanup should be a no-op.
	require.NoError(t, removeLegacyKBNMManifests(paths))
}

func TestRemoveLegacyKBNMManifestsContinuesAfterError(t *testing.T) {
	homeDir := t.TempDir()
	paths, err := legacyKBNMManifestPaths(homeDir, false)
	require.NoError(t, err)

	// A non-empty directory at the first manifest path makes its removal fail.
	require.NoError(t, os.MkdirAll(filepath.Join(paths[0], "child"), 0o700))
	for _, path := range paths[1:] {
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o700))
		require.NoError(t, os.WriteFile(path, []byte("legacy manifest"), 0o600))
	}

	require.Error(t, removeLegacyKBNMManifests(paths))
	for _, path := range paths[1:] {
		_, err := os.Lstat(path)
		require.ErrorIs(t, err, os.ErrNotExist)
	}
}

func TestLegacyKBNMManifestPathsRejectsUnsafeHome(t *testing.T) {
	_, err := legacyKBNMManifestPaths("relative", false)
	require.Error(t, err)
	_, err = legacyKBNMManifestPaths(string(filepath.Separator), false)
	require.Error(t, err)
}

func TestLegacyKBNMManifestPathsForAdmin(t *testing.T) {
	paths, err := legacyKBNMManifestPaths("", true)
	require.NoError(t, err)
	require.Equal(t, []string{
		"/Library/Google/Chrome/NativeMessagingHosts/io.keybase.kbnm.json",
		"/Library/Application Support/Chromium/NativeMessagingHosts/io.keybase.kbnm.json",
		"/Library/Application Support/Mozilla/NativeMessagingHosts/io.keybase.kbnm.json",
	}, paths)
}
