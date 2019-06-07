package s3

import "github.com/keybase/client/go/libkb"

type AWS struct{}

func (a *AWS) New(signer Signer, region Region, env *libkb.Env) Connection {
	return New(signer, region, env)
}
