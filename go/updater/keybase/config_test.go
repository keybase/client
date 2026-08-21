// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testConfigWithIgnoreSnooze(t *testing.T, ignoreSnooze bool) (*config, error) {
	testPathToKeybase := filepath.Join(os.Getenv("GOPATH"), "bin", "test")
	appName, err := util.RandomID("KeybaseTest.")
	require.NoError(t, err)
	return newConfig(appName, testPathToKeybase, testLog, ignoreSnooze)
}

func testConfig(t *testing.T) (*config, error) {
	return testConfigWithIgnoreSnooze(t, false)
}

func TestConfig(t *testing.T) {
	cfg, err := testConfig(t) // Will error since load fails on first newConfig
	require.Error(t, err, "%s", err)
	path, err := cfg.path()
	require.NoError(t, err)
	assert.NotEmpty(t, path, "No config path")

	configDir, err := Dir(cfg.appName)
	defer util.RemoveFileAtPath(configDir)
	require.NoError(t, err)
	assert.NotEmpty(t, configDir, "Config dir empty")
	defer util.RemoveFileAtPath(configDir)

	err = cfg.SetUpdateAuto(false)
	require.NoError(t, err)
	auto, autoSet := cfg.GetUpdateAuto()
	assert.True(t, autoSet, "Auto should be set")
	assert.False(t, auto, "Auto should be false")
	err = cfg.SetUpdateAuto(true)
	require.NoError(t, err)
	auto, autoSet = cfg.GetUpdateAuto()
	assert.True(t, autoSet, "Auto should be set")
	assert.True(t, auto, "Auto should be true")

	err = cfg.SetInstallID("deadbeef")
	require.NoError(t, err)
	assert.Equal(t, "deadbeef", cfg.GetInstallID())

	err = cfg.save()
	require.NoError(t, err)

	override := cfg.GetUpdateAutoOverride()
	assert.False(t, override, "AutoOverride should be false")
	err = cfg.SetUpdateAutoOverride(true)
	require.NoError(t, err)
	override = cfg.GetUpdateAutoOverride()
	assert.True(t, override, "AutoOverride should be set")

	options := cfg.updaterOptions()
	t.Logf("Options: %#v", options)

	expectedOptions := updater.UpdateOptions{
		Version:         "1.2.3-400+cafebeef",
		Platform:        runtime.GOOS,
		DestinationPath: options.DestinationPath,
		Channel:         "",
		Env:             "prod",
		IgnoreSnooze:    false,
		Arch:            cfg.osArch(),
		Force:           false,
		OSVersion:       cfg.osVersion(),
		UpdaterVersion:  updater.Version,
	}

	assert.Equal(t, expectedOptions, options)

	// Load new config and make sure it has the same values
	cfg2, err := newConfig(cfg.appName, cfg.pathToKeybase, testLog, true)
	require.NoError(t, err)
	path, err = cfg2.path()
	require.NoError(t, err)
	assert.NotEmpty(t, path, "No config path")

	expectedOptions2 := expectedOptions
	expectedOptions2.IgnoreSnooze = true

	options2 := cfg2.updaterOptions()
	assert.Equal(t, expectedOptions2, options2)

	auto2, autoSet2 := cfg2.GetUpdateAuto()
	assert.True(t, autoSet2, "Auto should be set")
	assert.True(t, auto2, "Auto should be true")
	assert.Equal(t, "deadbeef", cfg2.GetInstallID())
}

func TestConfigBadPath(t *testing.T) {
	cfg := newDefaultConfig("", "", testLog, false)

	var badPath string
	if runtime.GOOS == "windows" {
		badPath = `x:\updater.json` // Shouldn't be writable
	} else {
		badPath = filepath.Join("/testdir", "updater.json") // Shouldn't be writable
	}

	err := cfg.loadFromPath(badPath)
	t.Logf("Error: %#v", err)
	require.Error(t, err, "Expected error")

	saveErr := cfg.saveToPath(badPath)
	t.Logf("Error: %#v", saveErr)
	require.Error(t, saveErr, "Expected error")

	auto, autoSet := cfg.GetUpdateAuto()
	assert.False(t, autoSet, "Auto should not be set")
	assert.False(t, auto, "Auto should be false")
	assert.Empty(t, cfg.GetInstallID())
}

func TestConfigExtra(t *testing.T) {
	data := `{
	"extra": "extrafield",
	"installId": "deadbeef",
	"auto": false,
	"autoSet": true
	}`
	path := filepath.Join(os.TempDir(), "TestConfigExtra")
	defer util.RemoveFileAtPath(path)
	err := os.WriteFile(path, []byte(data), 0o600)
	require.NoError(t, err)

	cfg := newDefaultConfig("", "", testLog, false)
	err = cfg.loadFromPath(path)
	require.NoError(t, err)

	t.Logf("Config: %#v", cfg.store)
	assert.Equal(t, "deadbeef", cfg.GetInstallID())
	auto, autoSet := cfg.GetUpdateAuto()
	assert.False(t, auto)
	assert.True(t, autoSet)
}

// TestConfigBadType tests that if a parsing error occurs, we have the default
// config
func TestConfigBadType(t *testing.T) {
	// installId has wrong type
	data := `{
	"auto": true,
	"installId": 1
	}`
	path := filepath.Join(os.TempDir(), "TestConfigBadType")
	defer util.RemoveFileAtPath(path)
	err := os.WriteFile(path, []byte(data), 0o600)
	require.NoError(t, err)

	cfg := newDefaultConfig("", "", testLog, false)
	err = cfg.loadFromPath(path)
	require.Error(t, err)
	auto, autoSet := cfg.GetUpdateAuto()
	assert.False(t, auto)
	assert.False(t, autoSet)
}

func TestKeybaseVersionInvalid(t *testing.T) {
	_, filename, _, _ := runtime.Caller(0)
	testPathToKeybase := filepath.Join(filepath.Dir(filename), "../test/err.sh")
	cfg, _ := newConfig("KeybaseTest", testPathToKeybase, testLog, false)
	version := cfg.keybaseVersion()
	assert.Empty(t, version)
}
