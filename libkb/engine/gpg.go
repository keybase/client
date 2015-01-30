package engine

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"os"
)

type GPGUI interface {
	keybase_1.GpgUiInterface
}

type GPG struct {
	ui GPGUI
}

func NewGPG(ui GPGUI) *GPG {
	return &GPG{ui: ui}
}

func (g *GPG) Run() error {
	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		return err
	}
	index, err, warns := gpg.Index(true, "")
	if err != nil {
		return err
	}
	warns.Warn()

	headings := []string{
		"#",
		"Algo",
		"Key Id",
		"Expires",
		"Email",
	}
	libkb.Tablify(os.Stdout, headings, index.GetRowFunc())

	var set keybase_1.GPGKeySet
	set.Keys = []keybase_1.GPGKey{
		{Algorithm: "algo", KeyID: "key id", Expiration: "never", Identities: []string{"pc@pc.com"}},
	}
	res, err := g.ui.SelectKey(keybase_1.SelectKeyArg{Keyset: set})
	if err != nil {
		return err
	}
	G.Log.Info("SelectKey result: %+v", res)

	return nil
}
