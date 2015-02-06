package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

func TestGPGRun(t *testing.T) {
	tc := libkb.SetupTest(t, "gpg")
	defer tc.Cleanup()

	if err := tc.GenerateGPGKeyring("xxx@xxx.com"); err != nil {
		t.Fatal(err)
	}

	g := NewGPG(&gpgcanceltestui{}, nil)
	if err := g.Run(nil, ""); err != nil {
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

func (g *gpgtestui) WantToAddGPGKey() (bool, error) {
	return true, nil
}

type gpgcanceltestui struct {
	*gpgtestui
}

func (g *gpgcanceltestui) SelectKey(arg keybase_1.SelectKeyArg) (keybase_1.SelectKeyRes, error) {
	return keybase_1.SelectKeyRes{}, nil
}
