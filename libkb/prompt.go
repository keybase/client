package libkb

import (
	"github.com/keybase/go-triplesec"
	"github.com/keybase/protocol/go"
)

func PromptForNewTsec(arg keybase_1.GetNewPassphraseArg, ui SecretUI) (tsec *triplesec.Cipher, err error) {
	var text string
	if text, err = ui.GetNewPassphrase(arg); err != nil {
		return
	}
	tsec, err = triplesec.NewCipher([]byte(text), nil)
	return
}
