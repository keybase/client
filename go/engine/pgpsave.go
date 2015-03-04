package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPSave is an engine to submit pgp keys to keyring and
// optionally to keybase.io.
type PGPSave struct {
	libkb.Contextified
	armored     bool
	key         []byte
	pushPublic  bool
	pushPrivate bool
}

// NewPGPSaveArmored creates a PGPSave engine that will save an
// armored pgp key.
func NewPGPSaveArmored(key string, pushPublic, pushPrivate bool) *PGPSave {
	return &PGPSave{
		armored:     true,
		key:         []byte(key),
		pushPublic:  pushPublic,
		pushPrivate: pushPrivate,
	}
}

// NewPGPSaveRaw creates a PGPSave engine that will save a raw
// pgp key.
func NewPGPSaveRaw(key []byte, pushPublic, pushPrivate bool) *PGPSave {
	return &PGPSave{
		armored:     false,
		key:         key,
		pushPublic:  pushPublic,
		pushPrivate: pushPrivate,
	}
}

// Name is engine name.
func (p *PGPSave) Name() string {
	return "PGPSave"
}

// GetPrereqs returns any requirements for this engine to run.
func (p *PGPSave) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns any ui requirements.
func (p *PGPSave) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind, libkb.SecretUIKind}
}

// SubConsumers returns and ui consumers that this engine uses.
func (p *PGPSave) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run executes the engine.
func (p *PGPSave) Run(ctx *Context, args, reply interface{}) error {
	if p.armored {
		return p.runArmored(ctx)
	}

	return p.runRaw(ctx)
}

func (p *PGPSave) runArmored(ctx *Context) error {
	bundle, err := libkb.ReadOneKeyFromString(string(p.key))
	if err != nil {
		return err
	}

	return p.store(ctx, bundle)
}

func (p *PGPSave) runRaw(ctx *Context) error {
	bundle, err := libkb.ReadOneKeyFromBytes(p.key)
	if err != nil {
		return err
	}

	return p.store(ctx, bundle)
}

// store saves bundle to the local key storage, then calls push.
func (p *PGPSave) store(ctx *Context, bundle *libkb.PgpKeyBundle) error {
	if err := bundle.CheckSecretKey(); err != nil {
		return err
	}

	user, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	lks, err := libkb.NewLKSForEncrypt(ctx.SecretUI)
	if err != nil {
		return err
	}
	if _, err := libkb.WriteLksSKBToKeyring(user.GetName(), bundle, lks, ctx.LogUI); err != nil {
		return err
	}

	return p.push(ctx, bundle, user)
}

// push saves bundle to keybase.io based on pushPublic and
// pushPrivate.
func (p *PGPSave) push(ctx *Context, bundle *libkb.PgpKeyBundle, user *libkb.User) error {
	if !p.pushPublic && !p.pushPrivate {
		return nil
	}

	delg := &libkb.Delegator{
		Me:     user,
		Expire: libkb.KEY_EXPIRE_IN,
		Sibkey: true,
	}
	if err := delg.LoadSigningKey(ctx.SecretUI); err != nil {
		return err
	}

	// this will return "", nil if p.pushPrivate is false
	epk, err := p.privEncode(ctx, bundle)
	if err != nil {
		return err
	}

	delg.NewKey = bundle
	delg.EncodedPrivateKey = epk
	if err := delg.Run(); err != nil {
		return err
	}

	return nil
}

// privEncode encodes the private key in bundle.  It's safe to
// call this if pushPrivate is false as it will just return "",
// nil.
func (p *PGPSave) privEncode(ctx *Context, bundle *libkb.PgpKeyBundle) (string, error) {
	if !p.pushPrivate {
		return "", nil
	}

	tsec, err := p.G().LoginState.GetVerifiedTriplesec(ctx.SecretUI)
	if err != nil {
		return "", err
	}
	skb, err := bundle.ToSKB(tsec)
	if err != nil {
		return "", err
	}
	return skb.ArmoredEncode()
}
