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
	if err := d.eddsa(tpk.EdDSASeed()); err != nil {
		return fmt.Errorf("eddsa error: %s", err)
	}

	// turn off self proof
	d.selfProof = false

	if err := d.dh(tpk.DHSeed()); err != nil {
		return fmt.Errorf("dh error: %s", err)
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

	G.Log.Debug("detkey[eddsa] serverHalf: %x", serverHalf)
	G.Log.Debug("detkey[eddsa] pub:        %x", *pub)
	G.Log.Debug("detkey[eddsa] priv:       %x", *priv)

	var key libkb.NaclSigningKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclSigningKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	if d.selfProof {
		d.signingKey = key
	}

	return d.push(key, serverHalf, libkb.NACL_EDDSA_EXPIRE_IN, libkb.SIBKEY_TYPE)
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

	G.Log.Debug("detkey[dh] serverHalf: %x", serverHalf)
	G.Log.Debug("detkey[dh] pub:        %x", *pub)
	G.Log.Debug("detkey[dh] priv:       %x", *priv)

	var key libkb.NaclDHKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclDHKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	return d.push(key, serverHalf, libkb.NACL_DH_EXPIRE_IN, libkb.SUBKEY_TYPE)
}

func (d *DetKeyEngine) serverSeed(seed []byte) (newseed, serverHalf []byte, err error) {
	serverHalf, err = libkb.RandBytes(len(seed))
	if err != nil {
		return
	}
	newseed = make([]byte, len(seed))
	libkb.XORBytes(newseed, seed, serverHalf)
	return newseed, serverHalf, nil
}

func (d *DetKeyEngine) push(key libkb.GenericKey, serverHalf []byte, expire int, typ string) error {
	var jw *jsonw.Wrapper
	var err error

	if d.selfProof {
		fokid := libkb.GenericKeyToFOKID(key)
		jw, err = d.me.SelfProof(key, &fokid, nil)
	} else {
		jw, err = d.me.KeyProof(key, d.signingKey, typ, expire, nil)
	}
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
		Type:       typ,
		PublicKey:  key,
		SigningKey: d.signingKey,
		EldestKey:  d.signingKey,
		ServerHalf: hex.EncodeToString(serverHalf),
	}

	if d.selfProof {
		arg.EldestKey = nil
		arg.IsPrimary = true
		arg.Type = "generic_binding"
	}

	if err := libkb.PostNewKey(arg); err != nil {
		return err
	}

	d.me.SigChainBump(linkid, sigid)

	return nil
}
