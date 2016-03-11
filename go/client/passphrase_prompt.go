// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// promptPassphrase asks the user for a passphrase.
// Used during signup.
func PromptPassphrase(g *libkb.GlobalContext) (keybase1.GetPassphraseRes, error) {
	arg := libkb.DefaultPassphraseArg(g.SecretStoreAll != nil)
	arg.WindowTitle = "Passphrase"
	arg.Prompt = "Pick a strong passphrase (12+ characters)"
	arg.Type = keybase1.PassphraseType_PASS_PHRASE
	return promptPassphraseWithArg(g, arg, "Please reenter your passphrase for confirmation")
}

// promptNewPassphrase asks the user for a new passphrase.
// Used when changing passphrases.
func PromptNewPassphrase(g *libkb.GlobalContext) (string, error) {
	arg := libkb.DefaultPassphraseArg(g.SecretStoreAll != nil)
	arg.WindowTitle = "Pick a new passphrase"
	arg.Prompt = "Pick a new strong passphrase (12+ characters)"
	arg.Type = keybase1.PassphraseType_VERIFY_PASS_PHRASE
	arg.Features.StoreSecret.Allow = false
	res, err := promptPassphraseWithArg(g, arg, "Please reenter your new passphrase for confirmation")
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func promptPassphraseWithArg(g *libkb.GlobalContext, arg keybase1.GUIEntryArg, promptConfirm string) (keybase1.GetPassphraseRes, error) {
	prompter := newClientPrompter(g)

	firstPrompt := arg.Prompt

	for i := 0; i < 10; i++ {
		// get the first passphrase
		res, err := libkb.GetPassphraseUntilCheck(arg, prompter, &libkb.CheckPassphraseNew)
		if err != nil {
			return keybase1.GetPassphraseRes{}, err
		}

		// get confirmation passphrase
		arg.RetryLabel = ""
		arg.Prompt = promptConfirm
		confirm, err := libkb.GetPassphraseUntilCheck(arg, prompter, &libkb.CheckPassphraseNew)
		if err != nil {
			return keybase1.GetPassphraseRes{}, err
		}

		if res.Passphrase == confirm.Passphrase {
			// success
			return res, nil
		}

		// setup the prompt, label for new first attempt
		arg.Prompt = firstPrompt
		arg.RetryLabel = "Passphrase mismatch"
	}

	return keybase1.GetPassphraseRes{}, libkb.RetryExhaustedError{}
}

type clientPrompter struct {
	libkb.Contextified
}

var _ libkb.PassphrasePrompter = &clientPrompter{}

func newClientPrompter(g *libkb.GlobalContext) *clientPrompter {
	return &clientPrompter{Contextified: libkb.NewContextified(g)}
}

func (c *clientPrompter) Prompt(arg keybase1.GUIEntryArg) (keybase1.GetPassphraseRes, error) {
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}
	promptArg := keybase1.PassphrasePromptArg{
		GuiArg: arg,
	}
	return cli.PassphrasePrompt(context.TODO(), promptArg)
}
