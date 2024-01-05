// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin
// +build darwin

package keybase

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/process"
	"github.com/keybase/client/go/updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppBundleForPath(t *testing.T) {
	assert.Equal(t, "", appBundleForPath(""))
	assert.Equal(t, "", appBundleForPath("foo"))
	assert.Equal(t, "/Applications/Keybase.app", appBundleForPath("/Applications/Keybase.app"))
	assert.Equal(t, "/Applications/Keybase.app", appBundleForPath("/Applications/Keybase.app/Contents/SharedSupport/bin/keybase"))
	assert.Equal(t, "/Applications/Keybase.app", appBundleForPath("/Applications/Keybase.app/Contents/Resources/Foo.app/Contents/MacOS/Foo"))
	assert.Equal(t, "", appBundleForPath("/Applications/Keybase.ap"))
	assert.Equal(t, "/Applications/Keybase.app", appBundleForPath("/Applications/Keybase.app/"))
}

type testConfigDarwin struct {
	testConfigPlatform
}

func (c testConfigDarwin) destinationPath() string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "../test/Test.app")
}

func TestUpdatePrompt(t *testing.T) {
	config := &testConfigPlatform{
		Args: []string{"echo", `{
      "action": "apply",
      "autoUpdate": true
    }`},
	}
	ctx := newContext(config, testLog)
	resp, err := ctx.UpdatePrompt(testUpdate, testOptions, updater.UpdatePromptOptions{})
	assert.NoError(t, err)
	assert.NotNil(t, resp)
}

func TestOpenDarwin(t *testing.T) {
	_, filename, _, _ := runtime.Caller(0)
	appPath := filepath.Join(filepath.Dir(filename), "../test/Test.app")
	matcher := process.NewMatcher(appPath, process.PathPrefix, testLog)
	defer process.TerminateAll(matcher, 200*time.Millisecond, testLog)
	err := OpenAppDarwin(appPath, testLog)
	assert.NoError(t, err)
}

func TestOpenDarwinError(t *testing.T) {
	_, filename, _, _ := runtime.Caller(0)
	binErr := filepath.Join(filepath.Dir(filename), "../test/err.sh")
	appPath := filepath.Join(filepath.Dir(filename), "../test/Test.app")
	err := openAppDarwin(binErr, appPath, time.Millisecond, testLog)
	assert.Error(t, err)
}

func TestFindPIDsLaunchd(t *testing.T) {
	procPath := "/sbin/launchd"
	matcher := process.NewMatcher(procPath, process.PathEqual, testLog)
	pids, err := process.FindPIDsWithMatchFn(matcher.Fn(), testLog)
	assert.NoError(t, err)
	t.Logf("Pids: %#v", pids)
	require.True(t, len(pids) >= 1)
}

func TestApplyNoAsset(t *testing.T) {
	ctx := newContext(&testConfigPlatform{}, testLog)
	tmpDir, err := util.MakeTempDir("TestApplyNoAsset.", 0700)
	defer util.RemoveFileAtPath(tmpDir)
	require.NoError(t, err)
	err = ctx.Apply(testUpdate, testOptions, tmpDir)
	require.EqualError(t, err, "No asset")
}

func TestApplyAsset(t *testing.T) {
	ctx := newContext(&testConfigPlatform{}, testLog)
	tmpDir, err := util.MakeTempDir("TestApplyAsset.", 0700)
	defer util.RemoveFileAtPath(tmpDir)
	require.NoError(t, err)

	_, filename, _, _ := runtime.Caller(0)
	zipPath := filepath.Join(filepath.Dir(filename), "../test/Test.app.zip")
	update := updater.Update{
		Asset: &updater.Asset{
			LocalPath: zipPath,
		},
	}

	options := updater.UpdateOptions{DestinationPath: filepath.Join(os.TempDir(), "Test.app")}

	err = ctx.Apply(update, options, tmpDir)
	require.NoError(t, err)
}

func cleanupProc(appPath string) {
	process.TerminateAll(process.NewMatcher(appPath, process.PathPrefix, testLog), 200*time.Millisecond, testLog)
}

func TestStop(t *testing.T) {
	ctx := newContext(&testConfigDarwin{}, testLog)
	appPath := ctx.config.destinationPath()

	err := OpenAppDarwin(appPath, testLog)
	defer cleanupProc(appPath)
	require.NoError(t, err)

	err = ctx.stop()
	require.NoError(t, err)
}

func TestStartReportError(t *testing.T) {
	ctx := newContext(&testConfigDarwin{}, testLog)
	appPath := ctx.config.destinationPath()
	defer cleanupProc(appPath)

	err := ctx.start(0, 0)
	assert.True(t, strings.Contains(err.Error(), "There were multiple errors: No process found for Test.app/Contents/SharedSupport/bin/keybase; No process found for Test.app/Contents/SharedSupport/bin/kbfs"))

}
