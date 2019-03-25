// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PassphraseCheck is an engine that checks if given passphrase matches current
// user's passphrase.
type PassphraseCheck struct {
	arg    *keybase1.PassphraseCheckArg
	result bool
	libkb.Contextified
}

func NewPassphraseCheck(g *libkb.GlobalContext, a *keybase1.PassphraseCheckArg) *PassphraseCheck {
	return &PassphraseCheck{
		arg:          a,
		Contextified: libkb.NewContextified(g),
	}
}

// Name provides the name of the engine for the engine interface
func (c *PassphraseCheck) Name() string {
	return "PassphraseCheck"
}

// Prereqs returns engine prereqs
func (c *PassphraseCheck) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (c *PassphraseCheck) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers requires the other UI consumers of this engine
func (c *PassphraseCheck) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run the engine
func (c *PassphraseCheck) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("PassphraseCheck#Run", func() error { return err })()

	passphrase := c.arg.Passphrase
	if passphrase == "" {
		username := c.G().GetEnv().GetUsername().String()
		promptArg := libkb.DefaultPassphrasePromptArg(mctx, username)
		if !mctx.UIs().HasUI(libkb.SecretUIKind) {
			return errors.New("Passphrase was not passed in arguments and SecretUI is not available")
		}
		res, err := mctx.UIs().SecretUI.GetPassphrase(promptArg, nil)
		if err != nil {
			return err
		}
		passphrase = res.Passphrase
	}

	_, err = libkb.VerifyPassphraseForLoggedInUser(mctx, passphrase)
	if err != nil {
		if _, ok := err.(libkb.PassphraseError); ok {
			// Swallow passphrase errors, return `false` that the passphrase
			// provided was incorrect.
			c.result = false
			return nil
		}
		// There was some other error.
		return err
	}
	// No error, passphrase was correct.
	c.result = true
	return nil
}

// GetResult returns result of passphrase check, if Run() ran without errors.
// False means passphrase was incorrect, true means it was correct.
func (c *PassphraseCheck) GetResult() bool {
	return c.result
}
