
package libkbgo

import (
	"testing"
	"strings"
)

func TestPosix(t *testing.T) {
	hf := NewHomeFinder( "tester", nil )
	d, err := hf.CacheDir()
	if err != nil {
		t.Errorf("problem w/ Cache dir: %s", err.Error())
	} else if ! strings.Contains(d, ".cache/tester") {
		t.Errorf("Bad Cache dir: %s", d)
	}
	d, err = hf.DataDir()
	if err != nil {
		t.Errorf("problem w/ Data dir: %s", err.Error())
	} else if ! strings.Contains(d, ".local/share/tester") {
		t.Errorf("Bad Data dir: %s", d)
	}
	d, err = hf.ConfigDir()
	if err != nil {
		t.Errorf("problem w/ Config dir: %s", err.Error())
	} else if ! strings.Contains(d, ".config/tester") {
		t.Errorf("Bad Config dir: %s", d)
	}
}
