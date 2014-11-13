package libkb

import (
	"fmt"
	"strings"
)

func sentencePunctuate(s string) string {
	return strings.ToUpper(s[0:1]) + s[1:] + "."
}

func Prompt(prompt string, password bool, checker Checker) (string, error) {
	var prompter func(string) (string, error)

	if G.Terminal == nil {
		return "", fmt.Errorf("Can't prompt; no terminal available")
	}

	if password {
		prompter = func(s string) (string, error) {
			return G.Terminal.PromptPassword(s)
		}
	} else {
		prompter = func(s string) (string, error) {
			return G.Terminal.Prompt(s)
		}
	}

	var res string
	var err error

	first := true
	for {
		p := prompt
		if !first && len(checker.Hint) > 0 {
			p = p + " (" + checker.Hint + ")"
		}
		p = p + ": "
		res, err = prompter(p)
		if err != nil || checker.F(res) {
			break
		}
		res = ""
		first = false
	}

	return res, err
}

func PromptForConfirmation(prompt string) error {

	if G.Terminal == nil {
		return fmt.Errorf("Can't prompt; no terminal available")
	}

	res, err := G.Terminal.Prompt(prompt + " (type 'YES' to confirm): ")
	if err != nil {
		return err
	}
	if res != "YES" {
		return fmt.Errorf("Not confirmed")
	}
	return nil

}

func PromptForNewPassphrase(arg PromptArg) (text string, err error) {

	if arg.Checker == nil {
		arg.Checker = &CheckNewPassword
	}

	for {
		text = ""
		var text2 string

		if text, err = ppprompt(arg); err != nil {
			return
		}

		arg.TerminalPrompt = "confirm " + arg.TerminalPrompt
		arg.PinentryDesc = "Please reenter your passphase for confirmation"

		if text2, err = ppprompt(arg); err != nil {
			return
		}
		if text == text2 {
			break
		} else {
			arg.RetryMessage = "Password mismatch"
		}
	}
	return
}

type PromptArg struct {
	TerminalPrompt string
	PinentryDesc   string
	PinentryPrompt string
	Checker        *Checker
	RetryMessage   string
}

func PromptForKeybasePassphrase(retry string) (text string, err error) {
	return ppprompt(PromptArg{
		TerminalPrompt: "keybase passphrase",
		PinentryPrompt: "Your passphrase",
		PinentryDesc:   "Please enter your keybase passphrase (12+ characters)",
		Checker:        &CheckPasswordSimple,
		RetryMessage:   retry,
	})
}

func ppprompt(arg PromptArg) (text string, err error) {

	first := true
	var res *SecretEntryRes

	for {

		tp := arg.TerminalPrompt
		var emp, emt string
		if !first {
			tp = tp + " (" + arg.Checker.Hint + ")"
			emp = sentencePunctuate(arg.Checker.Hint)
		} else if len(arg.RetryMessage) > 0 {
			emp = arg.RetryMessage
			emt = emp
		}

		tp = tp + ": "

		res, err = G.SecretEntry.Get(
			SecretEntryArg{
				Error:  emp,
				Desc:   arg.PinentryDesc,
				Prompt: arg.PinentryPrompt,
			},
			&SecretEntryArg{
				Error:  emt,
				Prompt: tp,
			},
		)

		if err == nil && res.Canceled {
			err = fmt.Errorf("input canceled")
		}
		if err != nil {
			break
		}
		if arg.Checker.F(res.Text) {
			text = res.Text
			break
		}
		first = false
	}

	return
}
