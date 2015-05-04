package libkb

import (
	"github.com/keybase/client/protocol/go"
	"github.com/keybase/go-triplesec"
)

func PromptForNewTsec(arg keybase1.GetNewPassphraseArg, ui SecretUI) (tsec *triplesec.Cipher, err error) {
	var text string
	if text, err = ui.GetNewPassphrase(arg); err != nil {
		return
	}
	tsec, err = triplesec.NewCipher([]byte(text), nil)
	return
}
