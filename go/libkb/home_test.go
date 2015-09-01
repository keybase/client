package libkb

import (
	"strings"
	"testing"
)

func TestPosix(t *testing.T) {
	hf := NewHomeFinder("tester", nil, "posix", func() string { return string(ProductionRunMode) })
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
	hf := NewHomeFinder("keybase", nil, "darwin", func() string { return string(ProductionRunMode) })
	d := hf.ConfigDir()
	if !strings.HasSuffix(d, "Library/Application Support/Keybase") {
		t.Errorf("Bad config dir: %s", d)
	}
	d = hf.CacheDir()
	if !strings.HasSuffix(d, "Library/Caches/Keybase") {
		t.Errorf("Bad cache dir: %s", d)
	}
}

func TestDarwinHomeFinderInDev(t *testing.T) {
	devHomeFinder := NewHomeFinder("keybase", nil, "darwin", func() string { return string(DevelRunMode) })
	configDir := devHomeFinder.ConfigDir()
	if !strings.HasSuffix(configDir, "Library/Application Support/KeybaseDevel") {
		t.Errorf("Bad config dir: %s", configDir)
	}
	cacheDir := devHomeFinder.CacheDir()
	if !strings.HasSuffix(cacheDir, "Library/Caches/KeybaseDevel") {
		t.Errorf("Bad cache dir: %s", cacheDir)
	}
}
