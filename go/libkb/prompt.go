package libkb

import (
	"github.com/keybase/client/protocol/go"
	"github.com/keybase/go-triplesec"
)

func PromptForNewTsec(arg keybase1.GetNewPassphraseArg, ui SecretUI) (tsec *triplesec.Cipher, err error) {
	res, err := ui.GetNewPassphrase(arg)
	if err != nil {
		return
	}
	tsec, err = triplesec.NewCipher([]byte(res.Passphrase), nil)
	return
}
