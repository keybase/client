package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol"
)

func GetKeybasePassphrase(ui SecretUI, username, retryMsg string) (keybase1.GetPassphraseRes, error) {
	arg := DefaultPassphraseArg()
	arg.WindowTitle = "Keybase passphrase"
	arg.Prompt = fmt.Sprintf("Please enter the Keybase passphrase for %s (12+ characters)", username)
	arg.RetryLabel = retryMsg
	return GetPassphraseUntilCheck(arg, newUIPrompter(ui), &CheckPassphraseSimple)
}

func GetSecret(ui SecretUI, title, prompt, retryMsg string, allowSecretStore bool) (keybase1.GetPassphraseRes, error) {
	arg := DefaultPassphraseArg()
	arg.WindowTitle = title
	arg.Prompt = prompt
	arg.RetryLabel = retryMsg
	// apparently allowSecretStore can be true even though HasSecretStore()
	// is false (in the case of mocked secret store tests on linux, for
	// example). So, pass this through:
	arg.Features.StoreSecret.Allow = allowSecretStore
	return GetPassphraseUntilCheck(arg, newUIPrompter(ui), &CheckPassphraseSimple)
}

func GetPaperKeyPassphrase(ui SecretUI, username string) (string, error) {
	arg := DefaultPassphraseArg()
	arg.WindowTitle = "Paper backup key passphrase"
	if len(username) == 0 {
		username = "your account"
	}
	arg.Prompt = fmt.Sprintf("Please enter a paper backup key passphrase for %s", username)
	arg.Features.StoreSecret.Allow = false
	arg.Features.StoreSecret.Readonly = true
	res, err := GetPassphraseUntilCheck(arg, newUIPrompter(ui), &CheckPassphraseSimple)
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

type PassphrasePrompter interface {
	Prompt(keybase1.GUIEntryArg) (keybase1.GetPassphraseRes, error)
}

type uiPrompter struct {
	ui SecretUI
}

var _ PassphrasePrompter = &uiPrompter{}

func newUIPrompter(ui SecretUI) *uiPrompter {
	return &uiPrompter{ui: ui}
}

func (u *uiPrompter) Prompt(arg keybase1.GUIEntryArg) (keybase1.GetPassphraseRes, error) {
	return u.ui.GetPassphrase(arg, nil)
}

func GetPassphraseUntilCheck(arg keybase1.GUIEntryArg, prompter PassphrasePrompter, checker *Checker) (keybase1.GetPassphraseRes, error) {
	for i := 0; i < 10; i++ {
		res, err := prompter.Prompt(arg)
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

	return keybase1.GetPassphraseRes{}, RetryExhaustedError{}
}

func DefaultPassphraseArg() keybase1.GUIEntryArg {
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
