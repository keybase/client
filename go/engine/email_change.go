// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// EmailChange is an engine that changes a user's email via signed statement.
type EmailChange struct {
	arg *keybase1.EmailChangeArg
	libkb.Contextified
}

// NewEmailChange creates a new engine for changing a user's email
// address via signature (and therefore without passphrase required)
func NewEmailChange(a *keybase1.EmailChangeArg, g *libkb.GlobalContext) *EmailChange {
	return &EmailChange{
		arg:          a,
		Contextified: libkb.NewContextified(g),
	}
}

// Name provides the name of the engine for the engine interface
func (c *EmailChange) Name() string {
	return "EmailChange"
}

// Prereqs returns engine prereqs
func (c *EmailChange) Prereqs() Prereqs {
	return Prereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (c *EmailChange) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers requires the other UI consumers of this engine
func (c *EmailChange) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run the engine
func (c *EmailChange) Run(ctx *Context) (err error) {
	defer c.G().Trace("EmailChange#Run", func() error { return err })()

	if !libkb.CheckEmail.F(c.arg.NewEmail) {
		return libkb.BadEmailError{}
	}

	var me *libkb.User
	me, err = libkb.LoadMe(libkb.NewLoadUserForceArg(c.G()))
	if err != nil {
		return err
	}

	// need unlocked signing key
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	arg := ctx.SecretKeyPromptArg(ska, "tracking signature")
	signingKey, err := c.G().Keyrings.GetSecretKeyWithPrompt(arg)
	if err != nil {
		return err
	}
	if signingKey == nil {
		return libkb.NoSecretKeyError{}
	}
	var proof *jsonw.Wrapper
	proof, err = me.UpdateEmailProof(signingKey, c.arg.NewEmail)
	if err != nil {
		return err
	}
	var sig string
	sig, _, _, err = libkb.SignJSON(proof, signingKey)
	if err != nil {
		return err
	}

	_, err = c.G().API.Post(libkb.APIArg{
		Endpoint:    "account/email_update_signed",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig":         libkb.S{Val: sig},
			"signing_kid": libkb.S{Val: signingKey.GetKID().String()},
		},
	})

	if err != nil {
		return err
	}

	return nil
}
