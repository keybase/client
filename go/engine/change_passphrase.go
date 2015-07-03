package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// ChangePassphrase engine is used for changing the user's passphrase, either
// by replacement or by force.
type ChangePassphrase struct {
	arg *keybase1.ChangePassphraseArg
	me  *libkb.User
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

func (p *ChangePassphrase) loadMe() (err error) {
	p.me, err = libkb.LoadMe(libkb.LoadUserArg{AllKeys: false, ForceReload: true})
	return
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

	return nil
}
