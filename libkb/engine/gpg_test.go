package engine

import (
	"fmt"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"testing"
)

func TestGPGRun(t *testing.T) {
	tc := libkb.SetupTest(t, "gpg")
	defer tc.Cleanup()

	g := NewGPG(&gpgtestui{})
	if err := g.Run(); err != nil {
		t.Fatal(err)
	}
}

type gpgtestui struct{}

func (g *gpgtestui) SelectKey(arg keybase_1.SelectKeyArg) (keybase_1.SelectKeyRes, error) {
	if len(arg.Keyset.Keys) == 0 {
		return keybase_1.SelectKeyRes{}, fmt.Errorf("no keys in arg")
	}
	key := arg.Keyset.Keys[0]
	return keybase_1.SelectKeyRes{KeyID: key.KeyID}, nil
}
