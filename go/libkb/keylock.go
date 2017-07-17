// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "fmt"

type PassphraseType string

const (
	PassphraseTypeKeybase PassphraseType = "Keybase"
	PassphraseTypePGP     PassphraseType = "PGP"
)

type UnlockerFunc func(pw string, storeSecret bool) (ret GenericKey, err error)

type KeyUnlocker struct {
	Contextified
	tries          int
	reason         string
	keyDesc        string
	which          PassphraseType
	useSecretStore bool
	ui             SecretUI
	unlocker       UnlockerFunc
}

func NewKeyUnlocker(g *GlobalContext, tries int, reason string, keyDesc string, which PassphraseType, useSecretStore bool, ui SecretUI, unlocker UnlockerFunc) KeyUnlocker {
	return KeyUnlocker{
		Contextified:   NewContextified(g),
		tries:          tries,
		reason:         reason,
		keyDesc:        keyDesc,
		which:          which,
		useSecretStore: useSecretStore,
		ui:             ui,
		unlocker:       unlocker,
	}
}

func (arg KeyUnlocker) Run() (ret GenericKey, err error) {
	var emsg string

	if arg.ui == nil {
		err = NoUIError{"secret"}
		return nil, err
	}

	prompt := "Please enter your " + string(arg.which) + " passphrase to unlock the secret key for:\n" +
		arg.keyDesc + "\n"
	if len(arg.reason) > 0 {
		prompt = prompt + "\nReason: " + arg.reason
	}

	title := "Your " + string(arg.which) + " passphrase"

	for i := 0; arg.tries <= 0 || i < arg.tries; i++ {
		res, err := GetSecret(arg.G(), arg.ui, title, prompt, emsg, arg.useSecretStore)
		if err != nil {
			// probably canceled
			return nil, err
		}
		ret, err = arg.unlocker(res.Passphrase, res.StoreSecret)
		if err == nil {
			// success
			return ret, nil
		}
		if _, ok := err.(PassphraseError); ok {
			// keep trying
			emsg = "Failed to unlock key; bad passphrase"
		} else {
			// unretryable error
			return nil, err
		}
	}

	return nil, fmt.Errorf("Too many failures; giving up")
}
