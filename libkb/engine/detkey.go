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

type DetKeyEngine struct {
	me         *libkb.User
	signingKey libkb.GenericKey
	selfProof  bool
	logui      libkb.LogUI
}

func NewDetKeyEngine(me *libkb.User, signingKey libkb.GenericKey, logui libkb.LogUI) *DetKeyEngine {
	return &DetKeyEngine{me: me, signingKey: signingKey, logui: logui}
}

// Run runs the detkey engine.
func (d *DetKeyEngine) Run(tpk *libkb.TSPassKey) error {
	return d.run(tpk)
}

// RunSelfProof runs the detkey engine and uses the eddsa key as
// the signing key.  This is currently only used for testing to
// generate a fake users who only has a detkey, but perhaps it
// will be useful for something else...
func (d *DetKeyEngine) RunSelfProof(tpk *libkb.TSPassKey) error {
	d.selfProof = true
	return d.run(tpk)
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
	/*
		xseed, serverHalf, err := serverSeed(seed)
		if err != nil {
			return err
		}
		pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(xseed))
		if err != nil {
			return err
		}

		G.Log.Debug("detkey[eddsa] serverHalf: %x", serverHalf)
		G.Log.Debug("detkey[eddsa] pub:        %x", *pub)
		G.Log.Debug("detkey[eddsa] priv:       %x", *priv)

		var key libkb.NaclSigningKeyPair
		copy(key.Public[:], (*pub)[:])
		key.Private = &libkb.NaclSigningKeyPrivate{}
		copy(key.Private[:], (*priv)[:])
	*/
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

	arg := libkb.PostNewKeyArg{
		Sig:        sig,
		Id:         *sigid,
		Type:       pushType,
		PublicKey:  key,
		SigningKey: d.signingKey,
		EldestKey:  d.signingKey,
		ServerHalf: hex.EncodeToString(serverHalf),
	}

	if d.selfProof {
		arg.EldestKey = nil
		arg.IsPrimary = true
	}

	if err := libkb.PostNewKey(arg); err != nil {
		return err
	}

	d.me.SigChainBump(linkid, sigid)

	return nil
}
