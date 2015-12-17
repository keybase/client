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
	arg := libkb.DefaultPassphraseArg()
	arg.WindowTitle = "Passphrase"
	arg.Prompt = "Pick a strong passphrase (12+ characters)"
	return promptPassphraseWithArg(g, arg, "Please reenter your passphrase for confirmation")
}

// promptNewPassphrase asks the user for a new passphrase.
// Used when changing passphrases.
func PromptNewPassphrase(g *libkb.GlobalContext) (string, error) {
	arg := libkb.DefaultPassphraseArg()
	arg.WindowTitle = "Pick a new passphrase"
	arg.Prompt = "Pick a new strong passphrase (12+ characters)"
	arg.Features.StoreSecret.Allow = false
	res, err := promptPassphraseWithArg(g, arg, "Please reenter your new passphrase for confirmation")
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func promptPassphraseWithArg(g *libkb.GlobalContext, arg keybase1.GUIEntryArg, promptConfirm string) (keybase1.GetPassphraseRes, error) {
	res, err := promptPassphraseUntilCheck(g, arg, &libkb.CheckPassphraseNew)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}

	// get confirmation
	match := &libkb.Checker{
		F: func(s string) bool {
			return s == res.Passphrase
		},
		Hint: "Passphrase mismatch",
	}
	arg.RetryLabel = ""
	arg.Prompt = promptConfirm
	_, err = promptPassphraseUntilCheck(g, arg, match)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}

	return res, nil
}

func promptPassphraseUntilCheck(g *libkb.GlobalContext, arg keybase1.GUIEntryArg, checker *libkb.Checker) (keybase1.GetPassphraseRes, error) {
	cli, err := GetAccountClient(g)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}
	promptArg := keybase1.PassphrasePromptArg{
		GuiArg: arg,
	}
	for i := 0; i < 10; i++ {
		res, err := cli.PassphrasePrompt(context.TODO(), promptArg)
		if err != nil {
			return keybase1.GetPassphraseRes{}, err
		}
		if checker.F(res.Passphrase) {
			return res, nil
		}
		promptArg.GuiArg.RetryLabel = checker.Hint
	}

	return keybase1.GetPassphraseRes{}, libkb.RetryExhaustedError{}
}
