// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This engine deletes the user's account.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// AccountDelete is an engine.
type AccountDelete struct {
	libkb.Contextified
}

// NewAccountDelete creates a AccountDelete engine.
func NewAccountDelete(g *libkb.GlobalContext) *AccountDelete {
	return &AccountDelete{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *AccountDelete) Name() string {
	return "AccountDelete"
}

// Prereqs returns the engine prereqs.
func (e *AccountDelete) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *AccountDelete) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *AccountDelete) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *AccountDelete) Run(m libkb.MetaContext) error {
	username := m.G().GetEnv().GetUsername()

	randomPW, err := libkb.LoadHasRandomPw(m, keybase1.LoadHasRandomPwArg{})
	if err != nil {
		return err
	}

	var passphrase *string
	if !randomPW {
		// Passphrase is required to create PDPKA, but that's not required for
		// randomPW users.
		arg := libkb.DefaultPassphrasePromptArg(m, username.String())
		res, err := m.UIs().SecretUI.GetPassphrase(arg, nil)
		if err != nil {
			return err
		}
		passphrase = &res.Passphrase
	}

	err = libkb.DeleteAccount(m, username, passphrase)
	if err != nil {
		return err
	}
	m.Debug("account deleted, logging out")
	m.G().Logout(m.Ctx())

	return nil
}
