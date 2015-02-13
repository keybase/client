package libkb

import (
	"fmt"

	jsonw "github.com/keybase/go-jsonw"
)

// "github.com/agl/ed25519"
// "golang.org/x/crypto/nacl/box"
// "golang.org/x/crypto/nacl/secretbox"

type NaclKeyGenArg struct {
	Signer      GenericKey // who is going to sign us into the Chain
	ExpiresIn   int
	Generator   func() (NaclKeyPair, error)
	Me          *User
	Sibkey      bool
	ExpireIn    int // how long it lasts
	EldestKeyID KID // the eldest KID for this epoch
	LogUI       LogUI
	Device      *Device
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
	_, err = WriteTsecSKBToKeyring(g.arg.Me.name, g.pair, nil, g.arg.LogUI)
	return
}

func (g *NaclKeyGen) SaveLKS(lks *LKSec) error {
	_, err := WriteLksSKBToKeyring(g.arg.Me.name, g.pair, lks, g.arg.LogUI)
	return err
}

func (g *NaclKeyGen) Push() (err error) {
	var jw *jsonw.Wrapper
	var pushType string
	eldest := g.arg.Signer == nil && g.arg.EldestKeyID == nil

	kpArg := KeyProofArg{
		NewKey: g.pair,
		Sibkey: g.arg.Sibkey,
		Device: g.arg.Device,
		Expire: g.arg.ExpireIn,
	}

	if !eldest {
		kpArg.ExistingKey = g.arg.Signer
	}

	jw, pushType, err = g.arg.Me.KeyProof(kpArg)

	if err != nil {
		return err
	}

	signer := g.arg.Signer
	if eldest {
		// eldest key signs itself
		signer = g.pair
	}

	var sig string
	var id *SigId
	var lid LinkId
	if sig, id, lid, err = SignJson(jw, signer); err != nil {
		return fmt.Errorf("sign json err: %s", err)
	}
	arg := PostNewKeyArg{
		Sig:          sig,
		Id:           *id,
		Type:         pushType,
		EldestKeyID:  g.arg.EldestKeyID,
		SigningKeyID: signer.GetKid(),
		PublicKey:    g.pair,
		IsPrimary:    eldest,
	}
	if err = PostNewKey(arg); err != nil {
		return
	}
	g.arg.Me.sigChain.Bump(MerkleTriple{linkId: lid, sigId: id})
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

// RunLKS uses local key security to save the generated keys.
func (g *NaclKeyGen) RunLKS(lks *LKSec) (err error) {
	if err = g.Generate(); err != nil {
		return
	}
	if err = g.SaveLKS(lks); err != nil {
		return
	}
	if err = g.Push(); err != nil {
		G.Log.Info("push error: %s", err)
		return
	}
	return
}

func (g *NaclKeyGen) GetKeyPair() NaclKeyPair {
	return g.pair
}
