// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This engine deletes the user's account.

package engine

import (
	"fmt"

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
func (e *AccountDelete) Run(ctx *Context) error {
	username := e.G().GetEnv().GetUsername().String()
	arg := libkb.DefaultPassphraseArg(e.G())
	arg.WindowTitle = "Keybase passphrase"
	arg.Type = keybase1.PassphraseType_PASS_PHRASE
	arg.Username = username
	arg.Prompt = fmt.Sprintf("Please enter the Keybase passphrase for %s", username)
	res, err := ctx.SecretUI.GetPassphrase(arg, nil)
	if err != nil {
		return err
	}
	_, err = e.G().LoginState().VerifyPlaintextPassphrase(res.Passphrase, func(lctx libkb.LoginContext) error {
		return libkb.DeleteAccountWithContext(e.G(), lctx, username)
	})

	if err != nil {
		return err
	}

	e.G().Log.Debug("account deleted, logging out")
	e.G().Logout()

	return nil
}
