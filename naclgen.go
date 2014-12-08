package libkb

import (
// "github.com/agl/ed25519"
// "golang.org/x/crypto/nacl/box"
// "golang.org/x/crypto/nacl/secretbox"
)

type NaclKeyGenArg struct {
	Sibling   GenericKey // who is going to sign us into the Chain
	ExpiresIn int
	Generator func() (NaclKeyPair, error)
}

type NaclKeyGen struct {
	arg  *NaclKeyGenArg
	pair NaclKeyPair
}

func NewNaclKeyGen(arg NaclKeyGenArg) *NaclKeyGen {
	return &NaclKeyGen{arg: &arg}
}

func (g *NaclKeyGen) Generate() (err error) {
	g.pair, err = g.arg.Generator()
	return
}

func (g *NaclKeyGen) Save() (err error) {
	return WriteP3SKBToKeyring(g.pair, nil)
}

func (g *NaclKeyGen) Push() (err error) {
	return
}

func (g *NaclKeyGen) Run() (err error) {
	if err = g.Generate(); err != nil {
	} else if err = g.Save(); err != nil {
	} else {
		err = g.Push()
	}
	return
}

func (g *NaclKeyGen) GetKeyPair() NaclKeyPair {
	return g.pair
}
