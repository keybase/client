// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package libkb

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPosix(t *testing.T) {
	hf := NewHomeFinder("tester", nil, nil, nil, "posix", func() RunMode { return ProductionRunMode },
		makeLogGetter(t), nil)
	d := hf.CacheDir()
	if !strings.Contains(d, ".cache/tester") {
		t.Errorf("Bad Cache dir: %s", d)
	}
	d = hf.DataDir()
	if !strings.Contains(d, ".local/share/tester") {
		t.Errorf("Bad Data dir: %s", d)
	}
	d = hf.ConfigDir()
	if !strings.Contains(d, ".config/tester") {
		t.Errorf("Bad Config dir: %s", d)
	}
}

func TestDarwinHomeFinder(t *testing.T) {
	hf := NewHomeFinder("keybase", nil, nil, nil, "darwin", func() RunMode { return ProductionRunMode }, makeLogGetter(t), nil)
	d := hf.ConfigDir()
	if !strings.HasSuffix(d, "Library/Application Support/Keybase") {
		t.Errorf("Bad config dir: %s", d)
	}
	d = hf.CacheDir()
	if !strings.HasSuffix(d, "Library/Caches/Keybase") {
		t.Errorf("Bad cache dir: %s", d)
	}
	hfInt := NewHomeFinder("keybase", func() string { return "home" }, nil, func() string { return "mobilehome" },
		"darwin", func() RunMode { return ProductionRunMode }, makeLogGetter(t), nil)
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

func TestDarwinHomeFinderInDev(t *testing.T) {
	devHomeFinder := NewHomeFinder("keybase", nil, nil, nil, "darwin", func() RunMode { return DevelRunMode }, makeLogGetter(t), nil)
	configDir := devHomeFinder.ConfigDir()
	if !strings.HasSuffix(configDir, "Library/Application Support/KeybaseDevel") {
		t.Errorf("Bad config dir: %s", configDir)
	}
	cacheDir := devHomeFinder.CacheDir()
	if !strings.HasSuffix(cacheDir, "Library/Caches/KeybaseDevel") {
		t.Errorf("Bad cache dir: %s", cacheDir)
	}
}

func TestPosixRuntimeDir(t *testing.T) {
	var home string
	env := make(map[string]string)
	ge := func(s string) string { return env[s] }
	hf := NewHomeFinder("tester", func() string { return home }, nil, nil, "posix", func() RunMode { return ProductionRunMode }, makeLogGetter(t), ge)

	// Test the case that the --home flag overrides XDG_RUNTIME_DIR
	home = "/footown"
	env["HOME"] = "/yoyo"
	env["XDG_RUNTIME_DIR"] = "/barland"
	require.Equal(t, "/footown/.config/tester", hf.RuntimeDir())
	home = ""
	require.Equal(t, "/barland/tester", hf.RuntimeDir())
	delete(env, "XDG_RUNTIME_DIR")
	require.Equal(t, "/yoyo/.config/tester", hf.RuntimeDir())
}
