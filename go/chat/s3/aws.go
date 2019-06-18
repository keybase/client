package s3

import "github.com/keybase/client/go/libkb"

type AWS struct{}

func (a *AWS) New(g *libkb.GlobalContext, signer Signer, region Region) Connection {
	return New(g, signer, region)
}
