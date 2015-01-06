package libkb

import (
	"github.com/keybase/go-jsonw"
	// "github.com/agl/ed25519"
	// "golang.org/x/crypto/nacl/box"
	// "golang.org/x/crypto/nacl/secretbox"
)

type NaclKeyGenArg struct {
	Signer    GenericKey // who is going to sign us into the Chain
	ExpiresIn int
	Generator func() (NaclKeyPair, error)
	Me        *User
	Type      string
	ExpireIn  int        // how long it lasts
	Primary   GenericKey // the primary key for this epoch
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
	_, err = WriteP3SKBToKeyring(g.pair, nil)
	return
}

func (g *NaclKeyGen) Push() (err error) {
	var jw *jsonw.Wrapper
	jw, err = g.arg.Me.KeyProof(g.pair, g.arg.Type, g.arg.ExpireIn)
	if err != nil {
		return
	}
	var sig string
	var id *SigId
	if sig, id, err = SignJson(jw, g.arg.Signer); err != nil {
		return
	}
	arg := PostNewKeyArg{
		Sig:        sig,
		Id:         *id,
		Type:       g.arg.Type,
		PrimaryKey: g.arg.Primary,
		SigningKey: g.arg.Signer,
		PublicKey:  g.pair,
	}
	if err = PostNewKey(arg); err != nil {
		return
	}
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
