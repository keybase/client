
package libkbgo

import (
	"testing"
	"strings"
)

func TestPosix(t *testing.T) {
	hf := NewHomeFinder( "tester", nil )
	d := hf.CacheDir()
	if ! strings.Contains(d, ".cache/tester") {
		t.Errorf("Bad Cache dir: %s", d)
	}
	d = hf.DataDir()
	if ! strings.Contains(d, ".local/share/tester") {
		t.Errorf("Bad Data dir: %s", d)
	}
	d = hf.ConfigDir()
	if ! strings.Contains(d, ".config/tester") {
		t.Errorf("Bad Config dir: %s", d)
	}
}
