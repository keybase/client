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

	g := NewGPG()
	ctx := NewContext(&gpgcanceltestui{})
	if err := g.run(ctx, nil, ""); err != nil {
		t.Fatal(err)
	}
}

type gpgtestui struct {
	index int
}

func (g *gpgtestui) SelectKeyAndPushOption(arg keybase_1.SelectKeyAndPushOptionArg) (keybase_1.SelectKeyRes, error) {
	if len(arg.Keys) == 0 {
		return keybase_1.SelectKeyRes{}, fmt.Errorf("no keys in arg")
	}
	if g.index >= len(arg.Keys) {
		return keybase_1.SelectKeyRes{}, fmt.Errorf("test index %d outside bounds (num keys = %d)", g.index, len(arg.Keys))
	}
	key := arg.Keys[g.index]
	return keybase_1.SelectKeyRes{KeyID: key.KeyID, DoSecretPush: true}, nil
}

func (g *gpgtestui) SelectKey(arg keybase_1.SelectKeyArg) (string, error) {
	if len(arg.Keys) == 0 {
		return "", fmt.Errorf("no keys in arg")
	}
	if g.index >= len(arg.Keys) {
		return "", fmt.Errorf("test index %d outside bounds (num keys = %d)", g.index, len(arg.Keys))
	}
	key := arg.Keys[g.index]
	return key.KeyID, nil
}

func (g *gpgtestui) WantToAddGPGKey() (bool, error) {
	return true, nil
}

type gpgcanceltestui struct {
	*gpgtestui
}

func (g *gpgcanceltestui) SelectKeyAndPushOption(arg keybase_1.SelectKeyAndPushOptionArg) (keybase_1.SelectKeyRes, error) {
	return keybase_1.SelectKeyRes{}, nil
}

// doesn't push secret to api server
type gpgPubOnlyTestUI struct {
	*gpgtestui
}

func (g *gpgPubOnlyTestUI) SelectKeyAndPushOption(arg keybase_1.SelectKeyAndPushOptionArg) (keybase_1.SelectKeyRes, error) {
	if len(arg.Keys) == 0 {
		return keybase_1.SelectKeyRes{}, fmt.Errorf("no keys in arg")
	}
	key := arg.Keys[0]
	return keybase_1.SelectKeyRes{KeyID: key.KeyID, DoSecretPush: false}, nil
}
