package engine

import (
	"bytes"
	"fmt"

	"github.com/agl/ed25519"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/nacl/box"
)

// SelfProof = true: runs the detkey engine and uses the eddsa key as
// the signing key.  This is currently only used for testing to
// generate a fake users who only has a detkey, but perhaps it
// will be useful for something else...
// Device can be passed in to generate DetKey for a different
// device.  Currently used by BackupKeygen to generate backup
// keys.
type DetKeyArgs struct {
	PPStream    *libkb.PassphraseStream
	SelfProof   bool
	Me          *libkb.User
	SigningKey  libkb.GenericKey
	EldestKeyID keybase1.KID
	Device      *libkb.Device // nil to generate standard detkey (with web device)
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

func (d *DetKeyEngine) Prereqs() Prereqs { return Prereqs{} }

// Run runs the detkey engine.
func (d *DetKeyEngine) Run(ctx *Context) error {
	if d.arg.Device != nil {
		d.dev = d.arg.Device
	} else {
		d.dev = libkb.NewWebDevice()
	}

	if err := d.eddsa(ctx, d.arg.PPStream); err != nil {
		return fmt.Errorf("eddsa error: %s", err)
	}

	// turn off self proof
	d.arg.SelfProof = false

	if err := d.dh(ctx, d.arg.PPStream.DHSeed()); err != nil {
		return fmt.Errorf("dh error: %s", err)
	}
	return nil
}

func (d *DetKeyEngine) eddsa(ctx *Context, tpk *libkb.PassphraseStream) error {
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

	return d.push(ctx, newPusher(key, signingKey, serverHalf).EdDSA())
}

func GenSigningDetKey(tpk *libkb.PassphraseStream, serverHalf []byte) (gkey libkb.GenericKey, err error) {
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

func (d *DetKeyEngine) dh(ctx *Context, seed []byte) error {
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

	return d.push(ctx, newPusher(key, d.newEddsaKey, serverHalf).DH())
}

func (d *DetKeyEngine) push(ctx *Context, p *pusher) error {
	return p.push(ctx, d.arg.Me, d.dev)
}

type pusher struct {
	key        libkb.GenericKey
	signing    libkb.GenericKey
	serverHalf []byte
	expire     int
	sibkey     bool
}

func newPusher(key, signing libkb.GenericKey, serverHalf []byte) *pusher {
	return &pusher{
		key:        key,
		signing:    signing,
		serverHalf: serverHalf,
	}
}

func (p *pusher) EdDSA() *pusher {
	p.expire = libkb.NaclEdDSAExpireIn
	p.sibkey = true
	return p
}

func (p *pusher) DH() *pusher {
	p.expire = libkb.NaclDHExpireIn
	p.sibkey = false
	return p
}

func (p *pusher) push(ctx *Context, me *libkb.User, device *libkb.Device) error {
	if device == nil {
		return libkb.ErrCannotGenerateDevice
	}

	g := libkb.Delegator{
		NewKey:      p.key,
		Sibkey:      p.sibkey,
		Expire:      p.expire,
		ExistingKey: p.signing,
		ServerHalf:  p.serverHalf,
		Me:          me,
		Device:      device,
	}

	return g.Run(ctx.LoginContext)
}

func serverSeed(seed, serverHalf []byte) (newseed []byte, err error) {
	newseed = make([]byte, len(seed))
	libkb.XORBytes(newseed, seed, serverHalf)
	return newseed, nil
}
