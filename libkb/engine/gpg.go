package engine

import (
	"github.com/keybase/go/libkb"
	"os"
)

type GPG struct {
}

func NewGPG() *GPG {
	return &GPG{}
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

	return nil
}
