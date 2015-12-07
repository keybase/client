package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol"
)

func GetKeybasePassphrase(ui SecretUI, username, retryMsg string) (keybase1.GetPassphraseRes, error) {
	arg := defaultPassphraseArg()
	arg.WindowTitle = "Keybase passphrase"
	arg.Prompt = fmt.Sprintf("Please enter the Keybase passphrase for %s (12+ characters)", username)
	arg.RetryLabel = retryMsg
	// Checker -> libkb.CheckPassphraseSimple
	return ui.GetPassphrase(arg, nil)
}

func GetSecret(ui SecretUI, title, prompt, retryMsg string, allowSecretStore bool) (keybase1.GetPassphraseRes, error) {
	arg := defaultPassphraseArg()
	arg.WindowTitle = title
	arg.Prompt = prompt
	arg.RetryLabel = retryMsg
	return ui.GetPassphrase(arg, nil)
}

func GetPaperKeyPassphrase(ui SecretUI, username string) (string, error) {
	arg := defaultPassphraseArg()
	arg.WindowTitle = "Paper backup key passphrase"
	if len(username) == 0 {
		username = "your account"
	}
	arg.Prompt = fmt.Sprintf("Please enter a paper backup key passphrase for %s", username)
	arg.Features.StoreSecret.Allow = false
	arg.Features.StoreSecret.Readonly = true
	// Checker -> libkb.CheckPassphraseSimple
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
