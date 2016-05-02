// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "fmt"

const WhichPassphraseKeybase = "your Keybase"

type KeyUnlocker struct {
	Tries          int
	Reason         string
	KeyDesc        string
	Which          string
	UseSecretStore bool
	UI             SecretUI
	Unlocker       func(pw string, storeSecret bool) (ret GenericKey, err error)
	Contextified
}

func (arg KeyUnlocker) Run() (ret GenericKey, err error) {
	var emsg string

	which := arg.Which
	if len(which) == 0 {
		which = "the"
	}
	prompt := "Please enter " + which + " passphrase to unlock the secret key for:\n" +
		arg.KeyDesc + "\n"
	if len(arg.Reason) > 0 {
		prompt = prompt + "\nReason: " + arg.Reason
	}

	if arg.UI == nil {
		err = NoUIError{"secret"}
		return
	}

	title := "Your Keybase Passphrase"

	for i := 0; arg.Tries <= 0 || i < arg.Tries; i++ {
		res, err := GetSecret(arg.G(), arg.UI, title, prompt, emsg, arg.UseSecretStore)
		if err != nil {
			// probably canceled
			return nil, err
		}
		ret, err = arg.Unlocker(res.Passphrase, res.StoreSecret)
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
