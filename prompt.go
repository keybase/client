package libkb

import (
	"github.com/keybase/go-triplesec"
)

func PromptForNewTsec(arg PromptArg) (tsec *triplesec.Cipher, err error) {
	var text string
	if text, err = G.UI.PromptForNewPassphrase(arg); err != nil {
		return
	}
	tsec, err = triplesec.NewCipher([]byte(text), nil)
	return
}
