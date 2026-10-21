// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin

package install

import (
	"os"
	"os/exec"
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

func runShell(t *testing.T, cmd string) (string, error) {
	t.Helper()
	out, err := exec.Command("/bin/sh", "-c", cmd).CombinedOutput()
	return string(out), err
}

func TestCLILinks(t *testing.T) {
	bins, links := cliLinks()
	require.Equal(t, []string{
		"/Applications/Keybase.app/Contents/SharedSupport/bin/keybase",
		"/Applications/Keybase.app/Contents/SharedSupport/bin/git-remote-keybase",
	}, bins)
	require.Equal(t, []string{"/usr/local/bin/keybase", "/usr/local/bin/git-remote-keybase"}, links)
}

func TestInstallCLIPathsCommand(t *testing.T) {
	tmp, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	bins := []string{filepath.Join(tmp, "it's app", "keybase"), filepath.Join(tmp, "it's app", "git-remote-keybase")}
	linkDir := filepath.Join(tmp, "link dir")

	// A missing link dir is not created.
	out, err := runShell(t, installCLIPathsCommand(linkDir, bins))
	require.Error(t, err, out)
	require.NoDirExists(t, linkDir)

	require.NoError(t, os.Mkdir(linkDir, 0o755))
	out, err = runShell(t, installCLIPathsCommand(linkDir, bins))
	require.NoError(t, err, out)
	for i, name := range cliBinNames {
		target, err := os.Readlink(filepath.Join(linkDir, name))
		require.NoError(t, err)
		require.Equal(t, bins[i], target)
	}

	// A link to a directory and an empty directory are replaced, and nothing
	// is created inside either.
	other := filepath.Join(tmp, "other")
	require.NoError(t, os.Mkdir(other, 0o755))
	require.NoError(t, os.Remove(filepath.Join(linkDir, "keybase")))
	require.NoError(t, os.Symlink(other, filepath.Join(linkDir, "keybase")))
	require.NoError(t, os.Remove(filepath.Join(linkDir, "git-remote-keybase")))
	require.NoError(t, os.Mkdir(filepath.Join(linkDir, "git-remote-keybase"), 0o755))
	out, err = runShell(t, installCLIPathsCommand(linkDir, bins))
	require.NoError(t, err, out)
	for i, name := range cliBinNames {
		target, err := os.Readlink(filepath.Join(linkDir, name))
		require.NoError(t, err)
		require.Equal(t, bins[i], target)
	}
	entries, err := os.ReadDir(other)
	require.NoError(t, err)
	require.Empty(t, entries)

	// A directory with contents is left alone and fails the command.
	require.NoError(t, os.Remove(filepath.Join(linkDir, "keybase")))
	require.NoError(t, os.MkdirAll(filepath.Join(linkDir, "keybase", "child"), 0o755))
	out, err = runShell(t, installCLIPathsCommand(linkDir, bins))
	require.Error(t, err, out)
	require.DirExists(t, filepath.Join(linkDir, "keybase", "child"))
	entries, err = os.ReadDir(filepath.Join(linkDir, "keybase"))
	require.NoError(t, err)
	require.Len(t, entries, 1)
}

func TestInstallCLIPathsCommandLinkedDir(t *testing.T) {
	tmp, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	realDir := filepath.Join(tmp, "real")
	require.NoError(t, os.Mkdir(realDir, 0o755))
	linkDir := filepath.Join(tmp, "linked")
	require.NoError(t, os.Symlink(realDir, linkDir))

	out, err := runShell(t, installCLIPathsCommand(linkDir, []string{"/a/keybase", "/a/git-remote-keybase"}))
	require.Error(t, err, out)
	entries, err := os.ReadDir(realDir)
	require.NoError(t, err)
	require.Empty(t, entries, "nothing is linked into the directory a link dir points at")
}

func TestInstallCLIPathsFileCommand(t *testing.T) {
	tmp, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	pathsDir := filepath.Join(tmp, "paths.d")
	file := filepath.Join(pathsDir, "Keybase")

	// Creates the missing dir, and replaces whatever is at the name.
	out, err := runShell(t, installCLIPathsFileCommand(pathsDir, "Keybase", "/it's app/bin"))
	require.NoError(t, err, out)
	b, err := os.ReadFile(file)
	require.NoError(t, err)
	require.Equal(t, "/it's app/bin\n", string(b))
	elsewhere := filepath.Join(tmp, "elsewhere")
	require.NoError(t, os.WriteFile(elsewhere, []byte("kept"), 0o600))
	require.NoError(t, os.Remove(file))
	require.NoError(t, os.Symlink(elsewhere, file))
	out, err = runShell(t, installCLIPathsFileCommand(pathsDir, "Keybase", "/app/bin"))
	require.NoError(t, err, out)
	b, err = os.ReadFile(elsewhere)
	require.NoError(t, err)
	require.Equal(t, "kept", string(b))
	b, err = os.ReadFile(file)
	require.NoError(t, err)
	require.Equal(t, "/app/bin\n", string(b))

	// A paths dir that is a link is refused.
	linked := filepath.Join(tmp, "linked")
	require.NoError(t, os.Symlink(pathsDir, linked))
	require.NoError(t, os.Remove(file))
	out, err = runShell(t, installCLIPathsFileCommand(linked, "Keybase", "/app/bin"))
	require.Error(t, err, out)
	require.NoFileExists(t, file)
}

func TestUninstallCLIPathsCommand(t *testing.T) {
	tmp, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	linkDir := filepath.Join(tmp, "link dir")
	require.NoError(t, os.Mkdir(linkDir, 0o755))
	links := []cliLink{
		{name: "keybase", target: "/it's app/keybase"},
		{name: "git-remote-keybase", target: "/it's app/git-remote-keybase"},
		{name: "changed", target: "/it's app/changed"},
	}
	for _, l := range links[:2] {
		require.NoError(t, os.Symlink(l.target, filepath.Join(linkDir, l.name)))
	}
	// Replaced since it was checked: kept.
	require.NoError(t, os.Symlink("/elsewhere", filepath.Join(linkDir, "changed")))
	require.NoError(t, os.Symlink("/nowhere", filepath.Join(linkDir, "other")))
	pathsFile := filepath.Join(tmp, "it's paths")
	require.NoError(t, os.WriteFile(pathsFile, nil, 0o600))

	out, err := runShell(t, uninstallCLIPathsCommand(linkDir, links, pathsFile))
	require.NoError(t, err, out)
	entries, err := os.ReadDir(linkDir)
	require.NoError(t, err)
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	require.Equal(t, []string{"changed", "other"}, names)
	require.NoFileExists(t, pathsFile)

	require.Equal(t, "/bin/rm -f '/etc/paths.d/Keybase'", uninstallCLIPathsCommand(cliLinkDir, nil, "/etc/paths.d/Keybase"))
}

func TestUninstallCLIPathsCommandLinkedDir(t *testing.T) {
	tmp, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	realDir := filepath.Join(tmp, "real")
	require.NoError(t, os.Mkdir(realDir, 0o755))
	require.NoError(t, os.Symlink("/target", filepath.Join(realDir, "keybase")))
	linkDir := filepath.Join(tmp, "linked")
	require.NoError(t, os.Symlink(realDir, linkDir))

	out, err := runShell(t, uninstallCLIPathsCommand(linkDir, []cliLink{{name: "keybase", target: "/target"}}, ""))
	require.Error(t, err, out)
	_, err = os.Lstat(filepath.Join(realDir, "keybase"))
	require.NoError(t, err)
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
