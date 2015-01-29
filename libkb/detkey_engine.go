package libkb

import (
	"bytes"
	"github.com/agl/ed25519"
	"golang.org/x/crypto/nacl/box"
)

type DetKeyEngine struct{}

func NewDetKeyEngine() *DetKeyEngine {
	return &DetKeyEngine{}
}

func (d *DetKeyEngine) Run(eddsaSeed, dhSeed []byte) error {
	if err := d.eddsa(eddsaSeed); err != nil {
		return err
	}
	if err := d.dh(dhSeed); err != nil {
		return err
	}
	return nil
}

func (d *DetKeyEngine) eddsa(seed []byte) error {
	xseed, serverHalf, err := d.serverSeed(seed)
	if err != nil {
		return err
	}
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return err
	}

	G.Log.Info("detkey[eddsa] serverHalf: %x", serverHalf)
	G.Log.Info("detkey[eddsa] pub:        %x", *pub)
	G.Log.Info("detkey[eddsa] priv:       %x", *priv)

	return nil
}

func (d *DetKeyEngine) dh(seed []byte) error {
	xseed, serverHalf, err := d.serverSeed(seed)
	if err != nil {
		return err
	}
	pub, priv, err := box.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return err
	}

	G.Log.Info("detkey[dh] serverHalf: %x", serverHalf)
	G.Log.Info("detkey[dh] pub:        %x", *pub)
	G.Log.Info("detkey[dh] priv:       %x", *priv)

	return nil
}

func (d *DetKeyEngine) serverSeed(seed []byte) (newseed, serverHalf []byte, err error) {
	serverHalf, err = RandBytes(len(seed))
	if err != nil {
		return
	}
	newseed = make([]byte, len(seed))
	XORBytes(newseed, seed, serverHalf)
	return newseed, serverHalf, nil
}
