package main

import (
	keybase_1 "github.com/keybase/protocol/go"
)

type KeyGenUI struct {
	parent       *UI
	NoPublicPush bool
	DoSecretPush bool
	Interactive  bool
}

func (a *KeyGenUI) GetPushPreferences() (ret keybase_1.PushPreferences, err error) {
	if err = a.prompt(); err == nil {
		ret.Public = !a.NoPublicPush
		ret.Private = a.DoSecretPush
	}
	return
}

func (a *KeyGenUI) prompt() error {
	if !a.Interactive {
		return nil
	}

	if err := a.promptPush(); err != nil {
		return err
	}
	return a.promptSecretPush(true)
}

func (a *KeyGenUI) promptPush() error {
	prompt := "Publish your new public key to Keybase.io (strongly recommended)?"
	tmp, err := a.parent.PromptYesNo(prompt, PromptDefaultYes)
	a.NoPublicPush = !tmp
	return err
}

func (a *KeyGenUI) promptSecretPush(def bool) (err error) {
	msg := `
Keybase can host an encrypted copy of your PGP private key on its servers.
It can only be decrypted with your passphrase, which Keybase never knows.

`
	a.parent.Output(msg)
	prompt := "Push an encrypted copy of your private key to Keybase.io?"
	a.DoSecretPush, err = a.parent.PromptYesNo(prompt, PromptDefaultYes)
	return
}
