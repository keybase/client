// +build windows

package libkb

import (
	"testing"
)

func TestWindows(t *testing.T) {
	hf := NewHomeFinder("tester", nil, "windows", func() RunMode { return ProductionRunMode })
	d := hf.CacheDir()

	if !exists(d) {
		t.Errorf("Bad Cache dir: %s", d)
	}
	d = hf.DataDir()
	if !exists(d) {
		t.Errorf("Bad Data dir: %s", d)
	}
	d = hf.ConfigDir()
	if !exists(d) {
		t.Errorf("Bad Config dir: %s", d)
	}
}
