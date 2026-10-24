// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin

package keybase

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCodesignVerifyArgs(t *testing.T) {
	args := codesignVerifyArgs("/tmp/x y/Keybase.app")
	require.Equal(t, []string{
		"--verify", "--deep", "--strict", "--all-architectures",
		`--test-requirement==anchor apple generic and (certificate leaf[field.1.2.840.113635.100.6.1.9] /* exists */ or certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = "99229SGT5K") and (identifier "keybase.Keybase" or identifier "keybase.Electron")`,
		"/tmp/x y/Keybase.app",
	}, args)
}

func TestPlanContentsSwap(t *testing.T) {
	p := planContentsSwap("/var/folders/x/T/up/Keybase.zip.unzipped/Keybase.app", "/Applications/Keybase.app", "/var/folders/x/T/up/Keybase.zip.unzipped")
	require.Equal(t, contentsSwap{
		Source:      "/var/folders/x/T/up/Keybase.zip.unzipped/Keybase.app/Contents",
		Destination: "/Applications/Keybase.app/Contents",
		Backup:      "/var/folders/x/T/up/Keybase.zip.unzipped/Contents.previous",
	}, p)

	p = planContentsSwap("/tmp/my updates/u.zip.unzipped/Keybase.app", "/Users/testuser/My Apps/Keybase.app", "/tmp/my updates/u.zip.unzipped")
	require.Equal(t, "/tmp/my updates/u.zip.unzipped/Keybase.app/Contents", p.Source)
	require.Equal(t, "/Users/testuser/My Apps/Keybase.app/Contents", p.Destination)
	require.Equal(t, "/tmp/my updates/u.zip.unzipped/Contents.previous", p.Backup)
	require.False(t, strings.HasPrefix(p.Backup, "/Users/testuser/My Apps/Keybase.app/"))
}

func TestPlanStagedContentsSwap(t *testing.T) {
	stagingDir, stagedBundle, p := planStagedContentsSwap("/Volumes/Ext/Keybase.app")
	require.Equal(t, "/Volumes/Ext/Keybase.app/Contents.incoming", stagingDir)
	require.Equal(t, "/Volumes/Ext/Keybase.app/Contents.incoming/Keybase.app", stagedBundle)
	require.Equal(t, contentsSwap{
		Source:      "/Volumes/Ext/Keybase.app/Contents.incoming/Keybase.app/Contents",
		Destination: "/Volumes/Ext/Keybase.app/Contents",
		Backup:      "/Volumes/Ext/Keybase.app/Contents.incoming/Contents.previous",
	}, p)
}

// fakeRename records renames and fails the calls whose 1-based index is in
// failOn.
type fakeRename struct {
	calls  [][2]string
	failOn map[int]error
}

func (f *fakeRename) rename(oldpath, newpath string) error {
	f.calls = append(f.calls, [2]string{oldpath, newpath})
	return f.failOn[len(f.calls)]
}

var testSwap = contentsSwap{Source: "S/Contents", Destination: "D/Contents", Backup: "U/Contents.previous"}

func TestRunContentsSwap(t *testing.T) {
	moveErr := errors.New("move")
	restoreErr := errors.New("restore")
	backup := [2]string{"D/Contents", "U/Contents.previous"}
	move := [2]string{"S/Contents", "D/Contents"}
	restore := [2]string{"U/Contents.previous", "D/Contents"}

	f := &fakeRename{}
	require.NoError(t, runContentsSwap(testSwap, f.rename))
	require.Equal(t, [][2]string{backup, move}, f.calls)

	f = &fakeRename{failOn: map[int]error{1: moveErr}}
	err := runContentsSwap(testSwap, f.rename)
	require.ErrorIs(t, err, moveErr)
	require.False(t, restoreFailed(err))
	require.Equal(t, [][2]string{backup}, f.calls)

	f = &fakeRename{failOn: map[int]error{2: moveErr}}
	err = runContentsSwap(testSwap, f.rename)
	require.ErrorIs(t, err, moveErr)
	require.False(t, restoreFailed(err))
	require.Equal(t, [][2]string{backup, move, restore}, f.calls)

	f = &fakeRename{failOn: map[int]error{2: moveErr, 3: restoreErr}}
	err = runContentsSwap(testSwap, f.rename)
	require.ErrorIs(t, err, moveErr)
	require.ErrorIs(t, err, restoreErr)
	require.True(t, restoreFailed(err))
	require.Equal(t, "move; restoring the previous Contents also failed: restore", err.Error())
	require.Equal(t, [][2]string{backup, move, restore}, f.calls)

	exdev := &os.LinkError{Op: "rename", Old: "D/Contents", New: "U/Contents.previous", Err: syscall.EXDEV}
	f = &fakeRename{failOn: map[int]error{1: exdev}}
	require.ErrorIs(t, runContentsSwap(testSwap, f.rename), syscall.EXDEV)
}

func TestRollbackContentsSwap(t *testing.T) {
	first := errors.New("first")
	second := errors.New("second")
	undoMove := [2]string{"D/Contents", "S/Contents"}
	undoBackup := [2]string{"U/Contents.previous", "D/Contents"}

	f := &fakeRename{}
	require.NoError(t, rollbackContentsSwap(testSwap, f.rename))
	require.Equal(t, [][2]string{undoMove, undoBackup}, f.calls)

	f = &fakeRename{failOn: map[int]error{1: first}}
	require.ErrorIs(t, rollbackContentsSwap(testSwap, f.rename), first)
	require.Equal(t, [][2]string{undoMove}, f.calls)

	f = &fakeRename{failOn: map[int]error{2: second}}
	require.ErrorIs(t, rollbackContentsSwap(testSwap, f.rename), second)
	require.Equal(t, [][2]string{undoMove, undoBackup}, f.calls)
}

// TestApplyRenameFallbackManual runs the real fallback, including codesign. It
// is skipped unless KEYBASE_APPSWAP_MANUAL_DIR names a work directory (under
// /tmp/appswap-test/) that holds update.zip, a signed release as the updater
// downloads it, and Keybase.app, an older signed copy of the app to update.
// KEYBASE_APPSWAP_FAIL_CHECK=1 makes the check of the updated app fail.
func TestApplyRenameFallbackManual(t *testing.T) {
	dir := os.Getenv("KEYBASE_APPSWAP_MANUAL_DIR")
	if dir == "" {
		t.Skip("KEYBASE_APPSWAP_MANUAL_DIR is not set")
	}
	destinationPath := filepath.Join(dir, "Keybase.app")
	if os.Getenv("KEYBASE_APPSWAP_FAIL_CHECK") == "1" {
		orig := verifyAppSignature
		defer func() { verifyAppSignature = orig }()
		verifyAppSignature = func(path string, log Log) error {
			if path == destinationPath {
				return errors.New("forced check failure")
			}
			return orig(path, log)
		}
	}
	ctx := newContext(&testConfigPlatform{}, testLog)
	err := ctx.applyRenameFallback(filepath.Join(dir, "update.zip"), destinationPath)
	t.Logf("applyRenameFallback: %v", err)
}

func writeBundle(t *testing.T, bundle, version string) {
	require.NoError(t, os.MkdirAll(filepath.Join(bundle, "Contents"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(bundle, "Contents", "version"), []byte(version), 0o600))
}

func bundleVersion(t *testing.T, bundle string) string {
	b, err := os.ReadFile(filepath.Join(bundle, "Contents", "version"))
	require.NoError(t, err)
	return string(b)
}

func TestSwapContentsAsUser(t *testing.T) {
	for _, checkFails := range []bool{false, true} {
		dir := t.TempDir()
		unzipPath := filepath.Join(dir, "update.zip.unzipped")
		sourcePath := filepath.Join(unzipPath, "Keybase.app")
		destinationPath := filepath.Join(dir, "Applications", "Keybase.app")
		writeBundle(t, sourcePath, "new")
		writeBundle(t, destinationPath, "old")

		orig := verifyAppSignature
		var checked []string
		verifyAppSignature = func(path string, _ Log) error {
			checked = append(checked, path)
			if checkFails {
				return errors.New("forced check failure")
			}
			return nil
		}
		ctx := newContext(&testConfigPlatform{}, testLog)
		err := ctx.swapContentsAsUser(sourcePath, destinationPath, unzipPath)
		verifyAppSignature = orig

		require.Equal(t, []string{destinationPath}, checked)
		if checkFails {
			var f *userSwapFailure
			require.ErrorAs(t, err, &f)
			require.Empty(t, f.stranded)
			require.Equal(t, "old", bundleVersion(t, destinationPath))
			require.Equal(t, "new", bundleVersion(t, sourcePath))
		} else {
			require.NoError(t, err)
			require.Equal(t, "new", bundleVersion(t, destinationPath))
			previous, err := os.ReadFile(filepath.Join(unzipPath, "Contents.previous", "version"))
			require.NoError(t, err)
			require.Equal(t, "old", string(previous), "the old Contents waits next to the update, outside the app")
		}
		require.NoDirExists(t, filepath.Join(destinationPath, "Contents.incoming"))
	}
}
