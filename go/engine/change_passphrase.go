package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// ChangePassphrase engine is used for changing the user's passphrase, either
// by replacement or by force.
type ChangePassphrase struct {
	arg      *keybase1.ChangePassphraseArg
	me       *libkb.User
	ppStream *libkb.PassphraseStream
	libkb.Contextified
}

// NewChangePassphrase creates a new engine for changing user passphrases,
// either if the current passphrase is known, or in "force" mode
func NewChangePassphrase(a *keybase1.ChangePassphraseArg, g *libkb.GlobalContext) *ChangePassphrase {
	return &ChangePassphrase{
		arg:          a,
		Contextified: libkb.NewContextified(g),
	}
}

// Name provides the name of the engine for the engine interface
func (c *ChangePassphrase) Name() string {
	return "ChangePassphrase"
}

// Prereqs returns engine prereqs
func (c *ChangePassphrase) Prereqs() Prereqs {
	if c.arg.Force {
		return Prereqs{}
	}

	return Prereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (c *ChangePassphrase) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers requires the other UI consumers of this engine
func (c *ChangePassphrase) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run the engine
func (c *ChangePassphrase) Run(ctx *Context) (err error) {

	c.G().Log.Debug("+ ChangePassphrase.Run")
	defer func() {
		c.G().Log.Debug("- ChangePassphrase.Run -> %s", libkb.ErrToOk(err))
	}()

	if err = c.loadMe(); err != nil {
		return
	}
	if c.arg.Force {
		err = c.runForcedUpdate(ctx)
	} else {
		err = c.runStandardUpdate(ctx)
	}
	return
}

func (c *ChangePassphrase) runForcedUpdate(ctx *Context) (err error) {
	// Strategy:
	//  1. Get unlocked device for decryption and signing
	return
}

func (c *ChangePassphrase) runStandardUpdate(ctx *Context) (err error) {

	c.G().Log.Debug("+ ChangePassphrase.runStandardUpdate")
	defer func() {
		c.G().Log.Debug("- ChangePassphrase.runStandardUpdate -> %s", libkb.ErrToOk(err))
	}()

	if len(c.arg.OldPassphrase) == 0 {
		err = c.getVerifiedPassphraseHash(ctx)
	} else {
		err = c.verifySuppliedPassphrase(ctx)
	}

	if err != nil {
		return err
	}

	return nil
}

func (c *ChangePassphrase) loadMe() (err error) {
	c.me, err = libkb.LoadMe(libkb.LoadUserArg{AllKeys: false, ForceReload: true})
	return
}

func (c *ChangePassphrase) getVerifiedPassphraseHash(ctx *Context) (err error) {
	c.ppStream, err = c.G().LoginState().GetPassphraseStream(ctx.SecretUI)
	return
}

func (c *ChangePassphrase) verifySuppliedPassphrase(ctx *Context) (err error) {
	c.ppStream, err = c.G().LoginState().VerifyPlaintextPassphrase(c.arg.OldPassphrase)
	return
}
