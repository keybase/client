package engine

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"github.com/agl/ed25519"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/keybase/go/libkb"
	"golang.org/x/crypto/nacl/box"
)

type DetKeyArgs struct {
	Tsp       *libkb.TSPassKey
	SelfProof bool
}

type DetKeyEngine struct {
	me          *libkb.User
	signingKey  libkb.GenericKey
	eldestKeyID libkb.KID
	selfProof   bool
}

func NewDetKeyEngine(me *libkb.User, signingKey libkb.GenericKey, eldestKeyID libkb.KID) *DetKeyEngine {
	return &DetKeyEngine{me: me, signingKey: signingKey, eldestKeyID: eldestKeyID}
}

func (d *DetKeyEngine) Name() string {
	return "DetKey"
}

func (d *DetKeyEngine) RequiredUIs() []libkb.UIName {
	return nil
}

func (d *DetKeyEngine) SubEngines() []Engine {
	return nil
}

// Run runs the detkey engine.
func (d *DetKeyEngine) Run(ctx *Context, args interface{}, reply interface{}) error {
	da, ok := args.(DetKeyArgs)
	if !ok {
		return fmt.Errorf("invalid args type %T", args)
	}

	// d.selfProof = true: runs the detkey engine and uses the eddsa key as
	// the signing key.  This is currently only used for testing to
	// generate a fake users who only has a detkey, but perhaps it
	// will be useful for something else...
	d.selfProof = da.SelfProof

	return d.run(da.Tsp)
}

func (d *DetKeyEngine) run(tpk *libkb.TSPassKey) error {
	if err := d.eddsa(tpk); err != nil {
		return fmt.Errorf("eddsa error: %s", err)
	}

	// turn off self proof
	d.selfProof = false

	if err := d.dh(tpk.DHSeed()); err != nil {
		return fmt.Errorf("dh error: %s", err)
	}
	return nil
}

func (d *DetKeyEngine) eddsa(tpk *libkb.TSPassKey) error {
	serverHalf, err := libkb.RandBytes(len(tpk.EdDSASeed()))
	if err != nil {
		return err
	}
	key, err := GenSigningDetKey(tpk, serverHalf)
	if err != nil {
		return err
	}

	if d.selfProof {
		d.signingKey = key
		d.eldestKeyID = key.GetKid()
	}

	return d.push(key, serverHalf, libkb.NACL_EDDSA_EXPIRE_IN, true)
}

func GenSigningDetKey(tpk *libkb.TSPassKey, serverHalf []byte) (gkey libkb.GenericKey, err error) {
	xseed, err := serverSeed(tpk.EdDSASeed(), serverHalf)
	if err != nil {
		return nil, err
	}
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return nil, err
	}

	G.Log.Debug("detkey[eddsa] pub:        %x", *pub)
	G.Log.Debug("detkey[eddsa] priv:       %x", *priv)

	var key libkb.NaclSigningKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclSigningKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	return key, nil
}

func (d *DetKeyEngine) dh(seed []byte) error {
	serverHalf, err := libkb.RandBytes(len(seed))
	if err != nil {
		return err
	}
	xseed, err := serverSeed(seed, serverHalf)
	if err != nil {
		return err
	}
	pub, priv, err := box.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return err
	}

	G.Log.Debug("detkey[dh] serverHalf: %x", serverHalf)
	G.Log.Debug("detkey[dh] pub:        %x", *pub)
	G.Log.Debug("detkey[dh] priv:       %x", *priv)

	var key libkb.NaclDHKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclDHKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	return d.push(key, serverHalf, libkb.NACL_DH_EXPIRE_IN, false)
}

func serverSeed(seed, serverHalf []byte) (newseed []byte, err error) {
	newseed = make([]byte, len(seed))
	libkb.XORBytes(newseed, seed, serverHalf)
	return newseed, nil
}

func (d *DetKeyEngine) push(key libkb.GenericKey, serverHalf []byte, expire int, sibkey bool) error {
	var jw *jsonw.Wrapper
	var err error
	var pushType string
	kpArg := libkb.KeyProofArg{
		NewKey: key,
		Sibkey: sibkey,
		Expire: expire,
	}

	if !d.selfProof {
		kpArg.ExistingKey = d.signingKey
	}
	jw, pushType, err = d.me.KeyProof(kpArg)

	if err != nil {
		return fmt.Errorf("KeyProof error: %s", err)
	}
	sig, sigid, linkid, err := libkb.SignJson(jw, d.signingKey)
	if err != nil {
		return err
	}

	if d.eldestKeyID == nil {
		efokid := d.me.GetEldestFOKID()
		if efokid != nil {
			d.eldestKeyID = efokid.Kid
		}
	}

	arg := libkb.PostNewKeyArg{
		Sig:          sig,
		Id:           *sigid,
		Type:         pushType,
		PublicKey:    key,
		SigningKeyID: d.signingKey.GetKid(),
		EldestKeyID:  d.eldestKeyID,
		ServerHalf:   hex.EncodeToString(serverHalf),
	}

	//	G.Log.Info("post new key arg: id = %v, type = %v, signing key id = %v, eldest key id = %v", arg.Id, arg.Type, arg.SigningKeyID, arg.EldestKeyID)

	if d.selfProof {
		arg.EldestKeyID = nil
		arg.IsPrimary = true
	}

	if err := libkb.PostNewKey(arg); err != nil {
		return err
	}

	d.me.SigChainBump(linkid, sigid)

	return nil
}
