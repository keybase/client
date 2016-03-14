package libkb

import (
	"errors"
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
)

func GetKeybasePassphrase(ui SecretUI, username, retryMsg string, allowSecretStore bool) (keybase1.GetPassphraseRes, error) {
	arg := DefaultPassphraseArg(allowSecretStore)
	arg.WindowTitle = "Keybase passphrase"
	arg.Type = keybase1.PassphraseType_PASS_PHRASE
	arg.Prompt = fmt.Sprintf("Please enter the Keybase passphrase for %s (12+ characters)", username)
	arg.RetryLabel = retryMsg
	return GetPassphraseUntilCheck(arg, newUIPrompter(ui), &CheckPassphraseSimple)
}

func GetSecret(ui SecretUI, title, prompt, retryMsg string, allowSecretStore bool) (keybase1.GetPassphraseRes, error) {
	arg := DefaultPassphraseArg(allowSecretStore)
	arg.WindowTitle = title
	arg.Type = keybase1.PassphraseType_PASS_PHRASE
	arg.Prompt = prompt
	arg.RetryLabel = retryMsg
	// apparently allowSecretStore can be true even though HasSecretStore()
	// is false (in the case of mocked secret store tests on linux, for
	// example). So, pass this through:
	arg.Features.StoreSecret.Allow = allowSecretStore
	return GetPassphraseUntilCheck(arg, newUIPrompter(ui), &CheckPassphraseSimple)
}

func GetPaperKeyPassphrase(ui SecretUI, username string) (string, error) {
	arg := DefaultPassphraseArg(false)
	arg.WindowTitle = "Paper backup key passphrase"
	arg.Type = keybase1.PassphraseType_PAPER_KEY
	if len(username) == 0 {
		username = "your account"
	}
	arg.Prompt = fmt.Sprintf("Please enter a paper backup key passphrase for %s", username)
	arg.Features.StoreSecret.Allow = false
	arg.Features.StoreSecret.Readonly = true
	arg.Features.ShowTyping.Allow = true
	arg.Features.ShowTyping.DefaultValue = true
	res, err := GetPassphraseUntilCheck(arg, newUIPrompter(ui), &CheckPassphraseSimple)
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func GetPaperKeyForCryptoPassphrase(ui SecretUI, reason string, devices []*Device) (string, error) {
	if len(devices) == 0 {
		return "", errors.New("empty device list")
	}
	arg := DefaultPassphraseArg(false)
	arg.WindowTitle = "Paper backup key passphrase"
	arg.Type = keybase1.PassphraseType_PAPER_KEY
	arg.Features.StoreSecret.Allow = false
	arg.Features.StoreSecret.Readonly = true
	if len(devices) == 1 {
		arg.Prompt = fmt.Sprintf("%s: please enter the paper key '%s...'", reason, *devices[0].Description)
	} else {
		descs := make([]string, len(devices))
		for i, dev := range devices {
			descs[i] = fmt.Sprintf("'%s...'", *dev.Description)
		}
		paperOpts := strings.Join(descs, " or ")
		arg.Prompt = fmt.Sprintf("%s: please enter one of the following paper keys %s", reason, paperOpts)
	}

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

func DefaultPassphraseArg(allowSecretStore bool) keybase1.GUIEntryArg {
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
				Allow:        allowSecretStore,
				DefaultValue: false,
				Readonly:     false,
				Label:        "Save in Keychain",
			},
		},
	}
}
