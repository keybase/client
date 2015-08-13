package engine

import (
	"bytes"
	"fmt"

	"github.com/agl/ed25519"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/nacl/box"
)

// DetKeyArgs SelfProof = true: runs the detkey engine and uses the eddsa key as
// the signing key.  This is currently only used for testing to
// generate a fake users who only has a detkey, but perhaps it
// will be useful for something else...
type DetKeyArgs struct {
	PPStream    *libkb.PassphraseStream
	SelfProof   bool
	Me          *libkb.User
	SigningKey  libkb.GenericKey
	EldestKeyID keybase1.KID
	SkipPush    bool
}

type DetKeyEngine struct {
	arg         *DetKeyArgs
	newEddsaKey libkb.GenericKey
	dhKey       libkb.GenericKey
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

func (d *DetKeyEngine) SigKey() libkb.GenericKey {
	return d.newEddsaKey
}

func (d *DetKeyEngine) EncKey() libkb.GenericKey {
	return d.dhKey
}

// Run runs the detkey engine.
func (d *DetKeyEngine) Run(ctx *Context) (err error) {
	var wasSelfProof = d.arg.SelfProof

	d.dev = libkb.NewWebDevice()

	var delegators []libkb.Delegator
	var delegator libkb.Delegator

	if delegator, err = d.eddsa(ctx, d.arg.PPStream); err != nil {
		err = fmt.Errorf("eddsa error: %s", err)
		return
	}

	delegators = append(delegators, delegator)

	// turn off self proof
	d.arg.SelfProof = false

	if delegator, err = d.dh(ctx, d.arg.PPStream.DHSeed()); err != nil {
		err = fmt.Errorf("dh error: %s", err)
		return
	}

	delegators = append(delegators, delegator)

	// can't support multi in this case
	if wasSelfProof {
		for _, delegator := range delegators {
			err = delegator.Run(ctx.LoginContext)
			if err != nil {
				return
			}
		}
	} else {
		err = libkb.DelegatorAggregator(ctx.LoginContext, delegators)
	}

	return
}

func (d *DetKeyEngine) eddsa(ctx *Context, tpk *libkb.PassphraseStream) (delegator libkb.Delegator, err error) {
	var serverHalf []byte
	serverHalf, err = libkb.RandBytes(len(tpk.EdDSASeed()))
	if err != nil {
		return
	}

	var key libkb.GenericKey
	key, err = GenSigningDetKey(tpk, serverHalf)
	if err != nil {
		return
	}

	var signingKey libkb.GenericKey

	if !d.arg.SelfProof {
		signingKey = d.arg.SigningKey
	}
	d.newEddsaKey = key

	delegator, err = d.push(ctx, newPusher(key, signingKey, serverHalf).EdDSA())
	return
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

func (d *DetKeyEngine) dh(ctx *Context, seed []byte) (delegator libkb.Delegator, err error) {
	var serverHalf []byte
	serverHalf, err = libkb.RandBytes(len(seed))
	if err != nil {
		return
	}

	var xseed []byte
	xseed, err = serverSeed(seed, serverHalf)
	if err != nil {
		return
	}

	var pub *[32]byte
	var priv *[32]byte
	pub, priv, err = box.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return
	}

	var key libkb.NaclDHKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclDHKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	d.dhKey = key

	delegator, err = d.push(ctx, newPusher(key, d.newEddsaKey, serverHalf).DH())
	return
}

func (d *DetKeyEngine) push(ctx *Context, p *pusher) (delegator libkb.Delegator, err error) {
	if d.arg.SkipPush {
		return
	}

	delegator, err = p.push(ctx, d.arg.Me, d.dev)
	return
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

func (p *pusher) push(ctx *Context, me *libkb.User, device *libkb.Device) (delegator libkb.Delegator, err error) {
	if device == nil {
		err = libkb.ErrCannotGenerateDevice
		return
	}

	delegator = libkb.Delegator{
		NewKey:      p.key,
		Sibkey:      p.sibkey,
		Expire:      p.expire,
		ExistingKey: p.signing,
		ServerHalf:  p.serverHalf,
		Me:          me,
		Device:      device,
	}

	return
}

func serverSeed(seed, serverHalf []byte) (newseed []byte, err error) {
	newseed = make([]byte, len(seed))
	libkb.XORBytes(newseed, seed, serverHalf)
	return newseed, nil
}
