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
	passphrase *string
}

// NewAccountDelete creates a AccountDelete engine.
func NewAccountDelete(g *libkb.GlobalContext, passphrase *string) *AccountDelete {
	return &AccountDelete{
		Contextified: libkb.NewContextified(g),
		passphrase:   passphrase,
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

	passphraseState, err := libkb.LoadPassphraseState(m)
	if err != nil {
		return err
	}

	var passphrase *string
	if e.passphrase == nil && passphraseState == keybase1.PassphraseState_KNOWN {
		// Passphrase is required to create PDPKA, but that's not required for
		// randomPW users.
		arg := libkb.DefaultPassphrasePromptArg(m, username.String())
		res, err := m.UIs().SecretUI.GetPassphrase(arg, nil)
		if err != nil {
			return err
		}
		passphrase = &res.Passphrase
	} else if passphraseState == keybase1.PassphraseState_KNOWN {
		passphrase = e.passphrase
	}

	err = libkb.DeleteAccount(m, username, passphrase)
	if err != nil {
		return err
	}
	m.Debug("account deleted, logging out")
	return m.LogoutWithOptions(libkb.LogoutOptions{KeepSecrets: false, Force: true})
}
