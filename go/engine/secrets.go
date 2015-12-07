package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func getPaperKeyPassphrase(ui libkb.SecretUI, username string) (string, error) {
	arg := defaultPassphraseArg()
	arg.WindowTitle = "Paper backup key passphrase"
	if len(username) == 0 {
		username = "your account"
	}
	arg.Prompt = fmt.Sprintf("Please enter a paper backup key passphrase for %s", username)
	arg.Features.StoreSecret.Allow = false
	arg.Features.StoreSecret.Readonly = true
	res, err := ui.GetPassphrase(arg, nil)
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func defaultPassphraseArg() keybase1.GUIEntryArg {
	return keybase1.GUIEntryArg{
		SubmitLabel: "Submit",
		CancelLabel: "Cancel",
		Features: keybase1.GUIEntryFeatures{
			ShowTyping: keybase1.Feature{
				Allow:        true,
				DefaultValue: false,
				Readonly:     true,
				Label:        "Show typing",
			},
			StoreSecret: keybase1.Feature{
				Allow:        true,
				DefaultValue: false,
				Readonly:     false,
				Label:        "Store secret",
			},
		},
	}
}
