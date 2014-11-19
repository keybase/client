package main

import (
	"github.com/keybase/go-libkb"
	"os"
	"strings"
)

type UI struct {
	Terminal    *Terminal
	SecretEntry *SecretEntry
}

type IdentifyUI struct {
	parent *UI
}

func (u IdentifyUI) ReportHook(s string) {
	os.Stdout.Write([]byte(s))
}

func (u IdentifyUI) ShowWarnings(w libkb.Warnings) {
	w.Warn()
}

func (u IdentifyUI) PromptForConfirmation(s string) error {
	return u.parent.PromptForConfirmation(s)
}

func (u *UI) GetIdentifyUI() libkb.IdentifyUI {
	return IdentifyUI{u}
}

func (u *UI) GetSecret(args []libkb.SecretEntryArg) (*libkb.SecretEntryRes, error) {
	var term_arg *libkb.SecretEntryArg
	if len(args) > 1 {
		term_arg = &args[1]
	}
	return u.SecretEntry.Get(args[0], term_arg)
}

func (u *UI) Configure() error {
	u.Terminal = NewTerminal()
	u.SecretEntry = NewSecretEntry(u.Terminal)
	return nil
}

func (u *UI) Shutdown() error {
	var err error
	if u.Terminal != nil {
		err = u.Terminal.Shutdown()
	}
	return err
}

func (ui *UI) PromptForNewPassphrase(arg libkb.PromptArg) (text string, err error) {

	if arg.Checker == nil {
		arg.Checker = &libkb.CheckNewPassword
	}

	orig := arg
	var rm string

	for {
		text = ""
		var text2 string
		arg = orig
		if len(rm) > 0 {
			arg.RetryMessage = rm
			rm = ""
		}

		if text, err = ui.ppprompt(arg); err != nil {
			return
		}

		arg.TerminalPrompt = "confirm " + arg.TerminalPrompt
		arg.PinentryDesc = "Please reenter your passphase for confirmation"
		arg.RetryMessage = ""
		arg.Checker = nil

		if text2, err = ui.ppprompt(arg); err != nil {
			return
		}
		if text == text2 {
			break
		} else {
			rm = "Password mismatch"
		}
	}
	return
}

func (ui *UI) PromptForKeybasePassphrase(retry string) (text string, err error) {
	return ui.ppprompt(libkb.PromptArg{
		TerminalPrompt: "keybase passphrase",
		PinentryPrompt: "Your passphrase",
		PinentryDesc:   "Please enter your keybase passphrase (12+ characters)",
		Checker:        &libkb.CheckPasswordSimple,
		RetryMessage:   retry,
	})
}

func (ui *UI) ppprompt(arg libkb.PromptArg) (text string, err error) {

	first := true
	var res *libkb.SecretEntryRes

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

		res, err = ui.GetSecret([]libkb.SecretEntryArg{{
			Error:  emp,
			Desc:   arg.PinentryDesc,
			Prompt: arg.PinentryPrompt,
		}, {
			Error:  emt,
			Prompt: tp,
		},
		})

		if err == nil && res.Canceled {
			err = InputCanceledError{}
		}
		if err != nil {
			break
		}
		if arg.Checker == nil || arg.Checker.F(res.Text) {
			text = res.Text
			break
		}
		first = false
	}

	return
}

func (ui *UI) Prompt(prompt string, password bool, checker libkb.Checker) (string, error) {
	var prompter func(string) (string, error)

	if ui.Terminal == nil {
		return "", NoTerminalError{}
	}

	if password {
		prompter = func(s string) (string, error) {
			return ui.Terminal.PromptPassword(s)
		}
	} else {
		prompter = func(s string) (string, error) {
			return ui.Terminal.Prompt(s)
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

func (ui *UI) PromptForConfirmation(prompt string) error {

	if ui.Terminal == nil {
		return NoTerminalError{}
	}

	res, err := ui.Terminal.Prompt(prompt + " (type 'YES' to confirm): ")
	if err != nil {
		return err
	}
	if res != "YES" {
		return NotConfirmedError{}
	}
	return nil

}

func sentencePunctuate(s string) string {
	return strings.ToUpper(s[0:1]) + s[1:] + "."
}

func (ui *UI) PromptYesNo(p string, def *bool) (ret bool, err error) {
	var ch string
	if def == nil {
		ch = "[y/n]"
	} else if *def {
		ch = "[Y/n]"
	} else {
		ch = "[y/N]"
	}
	prompt := p + " " + ch + " "
	done := false
	for !done && err == nil {
		var s string
		if s, err = ui.Terminal.Prompt(prompt); err != nil {
		} else if libkb.IsYes(s) {
			ret = true
			done = true
		} else if libkb.IsNo(s) {
			ret = false
			done = true
		} else if def != nil && libkb.IsEmpty(s) {
			ret = *def
			done = true
		}
	}
	return
}

func (ui *UI) Output(s string) error {
	_, err := os.Stdout.Write([]byte(s))
	return err
}
