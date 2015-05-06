package engine

import (
	"bytes"
	"fmt"

	"github.com/agl/ed25519"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/box"
)

// SelfProof = true: runs the detkey engine and uses the eddsa key as
// the signing key.  This is currently only used for testing to
// generate a fake users who only has a detkey, but perhaps it
// will be useful for something else...
type DetKeyArgs struct {
	Tsp         libkb.PassphraseStream
	SelfProof   bool
	Me          *libkb.User
	SigningKey  libkb.GenericKey
	EldestKeyID libkb.KID
}

type DetKeyEngine struct {
	arg         *DetKeyArgs
	newEddsaKey libkb.GenericKey
	dev         *libkb.Device
	libkb.Contextified
}

func NewDetKeyEngine(arg *DetKeyArgs, g *libkb.GlobalContext) *DetKeyEngine {
	return &DetKeyEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (d *DetKeyEngine) Name() string {
	return "DetKey"
}

func (d *DetKeyEngine) RequiredUIs() []libkb.UIKind {
	return nil
}

func (d *DetKeyEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (d *DetKeyEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

// Run runs the detkey engine.
func (d *DetKeyEngine) Run(ctx *Context) error {

	d.dev = libkb.NewWebDevice()

	if err := d.eddsa(d.arg.Tsp); err != nil {
		return fmt.Errorf("eddsa error: %s", err)
	}

	// turn off self proof
	d.arg.SelfProof = false

	if err := d.dh(d.arg.Tsp.DHSeed()); err != nil {
		return fmt.Errorf("dh error: %s", err)
	}
	return nil
}

func (d *DetKeyEngine) eddsa(tpk libkb.PassphraseStream) error {
	serverHalf, err := libkb.RandBytes(len(tpk.EdDSASeed()))
	if err != nil {
		return err
	}
	key, err := GenSigningDetKey(tpk, serverHalf)
	if err != nil {
		return err
	}

	var signingKey libkb.GenericKey

	if !d.arg.SelfProof {
		signingKey = d.arg.SigningKey
	}
	d.newEddsaKey = key

	return d.push(key, signingKey, serverHalf, libkb.NACL_EDDSA_EXPIRE_IN, true)
}

func GenSigningDetKey(tpk libkb.PassphraseStream, serverHalf []byte) (gkey libkb.GenericKey, err error) {
	xseed, err := serverSeed(tpk.EdDSASeed(), serverHalf)
	if err != nil {
		return nil, err
	}
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return nil, err
	}

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

	var key libkb.NaclDHKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclDHKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	return d.push(key, d.newEddsaKey, serverHalf, libkb.NACL_DH_EXPIRE_IN, false)
}

func serverSeed(seed, serverHalf []byte) (newseed []byte, err error) {
	newseed = make([]byte, len(seed))
	libkb.XORBytes(newseed, seed, serverHalf)
	return newseed, nil
}

func (d *DetKeyEngine) push(key libkb.GenericKey, signing libkb.GenericKey, serverHalf []byte, expire int, sibkey bool) error {
	if d.dev == nil {
		return libkb.ErrCannotGenerateDevice
	}
	g := libkb.Delegator{
		NewKey:      key,
		Sibkey:      sibkey,
		Expire:      expire,
		ExistingKey: signing,
		ServerHalf:  serverHalf,
		Me:          d.arg.Me,
		Device:      d.dev,
	}
	return g.Run()
}
