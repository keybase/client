// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin

package install

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

func TestInstallAutoComponents(t *testing.T) {
	components := installAutoComponents()
	require.Equal(t, []string{"cli", "updater", "service", "kbfs"}, components)
	seen := map[string]bool{}
	for _, c := range components {
		require.False(t, seen[c], "duplicate component %s", c)
		seen[c] = true
	}
	for _, c := range []string{"helper", "fuse", "redirector", "mountdir", "app"} {
		require.False(t, seen[c], "install-auto must not install %s", c)
	}
}

func TestShouldMountKBFS(t *testing.T) {
	statuses := []struct {
		name  string
		st    keybase1.FuseStatus
		ready bool
	}{
		{"not installed", keybase1.FuseStatus{InstallStatus: keybase1.InstallStatus_NOT_INSTALLED, InstallAction: keybase1.InstallAction_INSTALL}, false},
		{"error", keybase1.FuseStatus{InstallStatus: keybase1.InstallStatus_ERROR, InstallAction: keybase1.InstallAction_REINSTALL}, false},
		{"outdated", keybase1.FuseStatus{InstallStatus: keybase1.InstallStatus_INSTALLED, InstallAction: keybase1.InstallAction_UPGRADE}, false},
		{"kext error", keybase1.FuseStatus{InstallStatus: keybase1.InstallStatus_ERROR, InstallAction: keybase1.InstallAction_NONE}, false},
		{"ready, kext not loaded", keybase1.FuseStatus{InstallStatus: keybase1.InstallStatus_INSTALLED, InstallAction: keybase1.InstallAction_NONE}, true},
		{"ready, kext loaded", keybase1.FuseStatus{InstallStatus: keybase1.InstallStatus_INSTALLED, InstallAction: keybase1.InstallAction_NONE, KextStarted: true}, true},
	}
	for _, tc := range statuses {
		require.False(t, shouldMountKBFS(false, tc.st), tc.name)
		require.Equal(t, tc.ready, shouldMountKBFS(true, tc.st), tc.name)
	}
}

type testConfigDirContext struct {
	configDir string
}

func (c testConfigDirContext) GetConfigDir() string         { return c.configDir }
func (c testConfigDirContext) GetCacheDir() string          { return "" }
func (c testConfigDirContext) GetRuntimeDir() string        { return "" }
func (c testConfigDirContext) GetMountDir() (string, error) { return "", nil }
func (c testConfigDirContext) GetLogDir() string            { return "" }
func (c testConfigDirContext) GetRunMode() libkb.RunMode    { return libkb.DevelRunMode }
func (c testConfigDirContext) GetServiceInfoPath() string   { return "" }
func (c testConfigDirContext) GetKBFSInfoPath() string      { return "" }

func TestMountOptInRoundTrip(t *testing.T) {
	ctx := testConfigDirContext{configDir: filepath.Join(t.TempDir(), "missing", "config")}
	require.False(t, MountOptIn(ctx))
	require.NoError(t, SetMountOptIn(ctx, false), "clearing an absent marker is fine")
	require.NoError(t, SetMountOptIn(ctx, true))
	require.True(t, MountOptIn(ctx))
	require.FileExists(t, filepath.Join(ctx.configDir, "kbfs_finder_enabled"))
	require.NoError(t, SetMountOptIn(ctx, true), "setting twice is fine")
	require.NoError(t, SetMountOptIn(ctx, false))
	require.False(t, MountOptIn(ctx))
}

func TestInstallCLIPathsCommand(t *testing.T) {
	bins := []string{
		"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase",
		"/Applications/Keybase.app/Contents/SharedSupport/bin/git-remote-keybase",
	}
	links := []string{"/usr/local/bin/keybase", "/usr/local/bin/git-remote-keybase"}
	require.Equal(t,
		"/bin/mkdir -p '/usr/local/bin'"+
			" && /bin/ln -sfn '/Applications/Keybase.app/Contents/SharedSupport/bin/keybase' '/usr/local/bin/keybase'"+
			" && /bin/ln -sfn '/Applications/Keybase.app/Contents/SharedSupport/bin/git-remote-keybase' '/usr/local/bin/git-remote-keybase'",
		installCLIPathsCommand(bins, links))

	bins = []string{"/Users/testuser/My Apps/Keybase.app/bin/keybase", "/Users/testuser/it's/git-remote-keybase"}
	require.Equal(t,
		"/bin/mkdir -p '/usr/local/bin'"+
			" && /bin/ln -sfn '/Users/testuser/My Apps/Keybase.app/bin/keybase' '/usr/local/bin/keybase'"+
			` && /bin/ln -sfn '/Users/testuser/it'\''s/git-remote-keybase' '/usr/local/bin/git-remote-keybase'`,
		installCLIPathsCommand(bins, links))
}

func TestRemovePathsCommand(t *testing.T) {
	require.Equal(t, "/bin/rm -f '/usr/local/bin/keybase' '/etc/paths.d/Keybase'",
		removePathsCommand([]string{"/usr/local/bin/keybase", "/etc/paths.d/Keybase"}))
}

func TestLinkPointsInto(t *testing.T) {
	bundle := "/Applications/Keybase.app"
	cases := []struct {
		target, linkDir, bundleDir string
		want                       bool
	}{
		{"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase", "/usr/local/bin", bundle, true},
		{"../../../Applications/Keybase.app/Contents/SharedSupport/bin/keybase", "/usr/local/bin", bundle, true},
		{"/Applications/Keybase.app", "/usr/local/bin", bundle, false},
		{"/Applications/Keybase.app2/bin/keybase", "/usr/local/bin", bundle, false},
		{"/opt/homebrew/bin/keybase", "/usr/local/bin", bundle, false},
		{"/Applications/Keybase.app/../Other.app/keybase", "/usr/local/bin", bundle, false},
		{"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase", "/usr/local/bin", "", false},
	}
	for _, tc := range cases {
		require.Equal(t, tc.want, linkPointsInto(tc.target, tc.linkDir, tc.bundleDir), tc.target)
	}
}

func TestBundleDirForPath(t *testing.T) {
	cases := []struct{ path, want string }{
		{"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase", "/Applications/Keybase.app"},
		{"/Users/testuser/My Apps/Keybase.app/Contents/SharedSupport/bin/keybase", "/Users/testuser/My Apps/Keybase.app"},
		{"/Applications/Keybase.app", "/Applications/Keybase.app"},
		// Only a path element named exactly Keybase.app counts.
		{"/Applications/Other.app/Contents/MacOS/keybase", ""},
		{"/Applications/Keybase.app2/bin/keybase", ""},
		{"/Applications/MyKeybase.app/bin/keybase", ""},
		{"/usr/local/bin/keybase", ""},
		{"", ""},
	}
	for _, tc := range cases {
		require.Equal(t, tc.want, bundleDirForPath(tc.path), tc.path)
	}
}
