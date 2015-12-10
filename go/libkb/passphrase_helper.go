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
	return getPassphraseUntilCheck(ui, arg, &CheckPassphraseSimple)
}

func GetSecret(ui SecretUI, title, prompt, retryMsg string, allowSecretStore bool) (keybase1.GetPassphraseRes, error) {
	arg := defaultPassphraseArg()
	arg.WindowTitle = title
	arg.Prompt = prompt
	arg.RetryLabel = retryMsg
	// apparently allowSecretStore can be true even though HasSecretStore()
	// is false (in the case of mocked secret store tests on linux, for
	// example). So, pass this through:
	arg.Features.StoreSecret.Allow = allowSecretStore
	return getPassphraseUntilCheck(ui, arg, &CheckPassphraseSimple)
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
	res, err := getPassphraseUntilCheck(ui, arg, &CheckPassphraseSimple)
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func GetSignupPassphrase(ui SecretUI) (keybase1.GetPassphraseRes, error) {
	arg := defaultPassphraseArg()
	arg.WindowTitle = "Passphrase"
	arg.Prompt = "Pick a strong passphrase (12+ characters)"
	res, err := getPassphraseUntilCheck(ui, arg, &CheckPassphraseNew)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}

	// get confirmation
	match := &Checker{
		F: func(s string) bool {
			return s == res.Passphrase
		},
		Hint: "Passphrase mismatch",
	}
	arg.RetryLabel = ""
	arg.Prompt = "Please reenter your passphrase for confirmation"
	_, err = getPassphraseUntilCheck(ui, arg, match)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}

	return res, nil
}

func getPassphraseUntilCheck(ui SecretUI, arg keybase1.GUIEntryArg, checker *Checker) (keybase1.GetPassphraseRes, error) {
	for {
		res, err := ui.GetPassphrase(arg, nil)
		if err != nil {
			return keybase1.GetPassphraseRes{}, err
		}
		if checker == nil {
			return res, nil
		}
		if checker.F(res.Passphrase) {
			return res, nil
		}
		arg.RetryLabel = checker.Hint
	}
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
				Allow:        HasSecretStore(),
				DefaultValue: false,
				Readonly:     false,
				Label:        "Store secret",
			},
		},
	}
}
