// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PaperKeyPrimary creates the initial paper backup key for a user.  It
// differs from the PaperKey engine in that it already knows the
// signing key and it doesn't offer to revoke any devices, plus it
// uses a different UI call to display the phrase.
package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// PaperKeyPrimary is an engine.
type PaperKeyPrimary struct {
	passphrase libkb.PaperKeyPhrase
	args       *PaperKeyPrimaryArgs
	libkb.Contextified
}

type PaperKeyPrimaryArgs struct {
	SigningKey    libkb.GenericKey
	EncryptionKey libkb.NaclDHKeyPair
	Me            *libkb.User

	LoginContext    libkb.LoginContext     // optional
	SharedDHKeyring *libkb.SharedDHKeyring // optional
}

// NewPaperKeyPrimary creates a PaperKeyPrimary engine.
func NewPaperKeyPrimary(g *libkb.GlobalContext, args *PaperKeyPrimaryArgs) *PaperKeyPrimary {
	return &PaperKeyPrimary{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PaperKeyPrimary) Name() string {
	return "PaperKeyPrimary"
}

// GetPrereqs returns the engine prereqs.
func (e *PaperKeyPrimary) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PaperKeyPrimary) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PaperKeyPrimary) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&PaperKeyGen{}}
}

// Run starts the engine.
func (e *PaperKeyPrimary) Run(ctx *Context) error {
	var err error
	e.passphrase, err = libkb.MakePaperKeyPhrase(libkb.PaperKeyVersion)
	if err != nil {
		return err
	}

	kgarg := &PaperKeyGenArg{
		Passphrase:      e.passphrase,
		Me:              e.args.Me,
		SigningKey:      e.args.SigningKey,
		EncryptionKey:   e.args.EncryptionKey,
		LoginContext:    e.args.LoginContext,
		SharedDHKeyring: e.args.SharedDHKeyring,
	}
	kgeng := NewPaperKeyGen(kgarg, e.G())
	if err := RunEngine(kgeng, ctx); err != nil {
		return err
	}

	// If they refuse to write down their key, don't kill the login flow, just print an
	// ugly warning, which likely they won't see...
	w := ctx.LoginUI.DisplayPrimaryPaperKey(context.TODO(), keybase1.DisplayPrimaryPaperKeyArg{Phrase: e.passphrase.String()})
	if w != nil {
		e.G().Log.Errorf("Display paper key failure: %s", w.Error())
	}

	return nil
}
