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
func NewEmailChange(g *libkb.GlobalContext, a *keybase1.EmailChangeArg) *EmailChange {
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
	return Prereqs{Device: true}
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
func (c *EmailChange) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("EmailChange#Run", func() error { return err })()

	if !libkb.CheckEmail.F(c.arg.NewEmail) {
		return libkb.BadEmailError{}
	}

	var me *libkb.User
	me, err = libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m).WithForceReload())
	if err != nil {
		return err
	}

	// need unlocked signing key
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	arg := m.SecretKeyPromptArg(ska, "tracking signature")
	signingKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, arg)
	if err != nil {
		return err
	}
	if signingKey == nil {
		return libkb.NoSecretKeyError{}
	}
	var proof *jsonw.Wrapper
	proof, err = me.UpdateEmailProof(m, signingKey, c.arg.NewEmail)
	if err != nil {
		return err
	}
	var sig string
	sig, _, _, err = libkb.SignJSON(proof, signingKey)
	if err != nil {
		return err
	}

	_, err = m.G().API.Post(m, libkb.APIArg{
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
