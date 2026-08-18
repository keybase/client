// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build !windows

package libkb

import (
	"os"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPosix(t *testing.T) {
	hf := NewHomeFinder("tester", nil, nil, nil, "posix", func() RunMode { return ProductionRunMode },
		makeLogGetter(t), nil)
	d := hf.CacheDir()
	require.Contains(t, d, ".cache/tester", "Bad Cache dir: %s", d)
	d = hf.DataDir()
	require.Contains(t, d, ".local/share/tester", "Bad Data dir: %s", d)
	d = hf.ConfigDir()
	require.Contains(t, d, ".config/tester", "Bad Config dir: %s", d)
}

func TestDarwinHomeFinder(t *testing.T) {
	for _, osname := range []string{"darwin", "ios"} {
		hf := NewHomeFinder("keybase", nil, nil, nil, osname, func() RunMode { return ProductionRunMode }, makeLogGetter(t), nil)
		d := hf.ConfigDir()
		require.True(t, strings.HasSuffix(d, "Library/Application Support/Keybase"), "Bad config dir: %s", d)
		d = hf.CacheDir()
		require.True(t, strings.HasSuffix(d, "Library/Caches/Keybase"), "Bad cache dir: %s", d)
		hfInt := NewHomeFinder("keybase", func() string { return "home" }, nil, func() string { return "mobilehome" },
			osname, func() RunMode { return ProductionRunMode }, makeLogGetter(t), nil)
		hfDarwin := hfInt.(Darwin)
		hfDarwin.forceIOS = true
		hf = hfDarwin
		d = hf.ConfigDir()
		require.True(t, strings.HasSuffix(d, "Library/Application Support/Keybase"))
		require.True(t, strings.HasPrefix(d, "mobilehome"))
		d = hf.DataDir()
		require.True(t, strings.HasSuffix(d, "Library/Application Support/Keybase"))
		require.False(t, strings.HasPrefix(d, "mobilehome"))
		require.True(t, strings.HasPrefix(d, "home"))
	}
}

func TestDarwinHomeFinderInDev(t *testing.T) {
	devHomeFinder := NewHomeFinder("keybase", nil, nil, nil, "darwin", func() RunMode { return DevelRunMode }, makeLogGetter(t), nil)
	configDir := devHomeFinder.ConfigDir()
	require.True(t, strings.HasSuffix(configDir, "Library/Application Support/KeybaseDevel"), "Bad config dir: %s", configDir)
	cacheDir := devHomeFinder.CacheDir()
	require.True(t, strings.HasSuffix(cacheDir, "Library/Caches/KeybaseDevel"), "Bad cache dir: %s", cacheDir)
}

func TestPosixRuntimeDir(t *testing.T) {
	var cmdHome string
	env := make(map[string]string)
	ge := func(s string) string { return env[s] }
	hf := NewHomeFinder("tester", func() string { return cmdHome }, nil, nil, "posix", func() RunMode { return ProductionRunMode }, makeLogGetter(t), ge)

	origHomeEnv := os.Getenv("HOME")

	// Custom env, custom cmd, XDG set
	cmdHome = "/footown"
	env["HOME"] = "/yoyo"
	env["XDG_RUNTIME_DIR"] = "/barland"
	require.Equal(t, "/footown/.config/tester", hf.RuntimeDir(), "expect custom cmd to win")

	// Custom env, no cmd, XDG set
	cmdHome = ""
	env["HOME"] = "/yoyo"
	env["XDG_RUNTIME_DIR"] = "/barland"
	require.Equal(t, "/yoyo/.config/tester", hf.RuntimeDir(), "expect custom env to win")

	// Standard env, no cmd, XDG set
	cmdHome = ""
	env["HOME"] = origHomeEnv
	env["XDG_RUNTIME_DIR"] = "/barland"
	require.Equal(t, "/barland/tester", hf.RuntimeDir(), "expect xdg to win")

	// Standard env, no cmd, XDG unset
	cmdHome = ""
	env["HOME"] = origHomeEnv
	delete(env, "XDG_RUNTIME_DIR")
	require.Equal(t, path.Join(origHomeEnv, ".config", "tester"), hf.RuntimeDir(), "expect home to win")
}
