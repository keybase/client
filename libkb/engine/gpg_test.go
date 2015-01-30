package engine

import (
	"github.com/keybase/go/libkb"
	"testing"
)

func TestGPGRun(t *testing.T) {
	tc := libkb.SetupTest(t, "gpg")
	defer tc.Cleanup()

	g := NewGPG()
	if err := g.Run(); err != nil {
		t.Fatal(err)
	}
}
