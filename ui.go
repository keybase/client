package main

import (
	"fmt"
	"github.com/keybase/go-libkb"
	"os"
	"strconv"
	"strings"
)

type UI struct {
	Terminal    *Terminal
	SecretEntry *SecretEntry
}

type BaseIdentifyUI struct {
	parent *UI
}

type IdentifySelfUI struct {
	BaseIdentifyUI
}

func (u IdentifySelfUI) Start() {
	G.Log.Info("Verifying your key fingerprint....")
}

func (ui IdentifySelfUI) FinishAndPrompt(ires *libkb.IdentifyRes) (i libkb.TrackInstructions, err error) {
	var warnings libkb.Warnings
	err, warnings = ires.GetErrorLax()
	var prompt string
	if err != nil {
		return
	} else if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
		prompt = "Do you still accept these credentials to be your own?"
	} else if len(ires.ProofChecks) == 0 {
		prompt = "We found your account, but you have no hosted proofs. Check your fingerprint carefully. Is this you?"
	} else {
		prompt = "Is this you?"
	}

	err = ui.PromptForConfirmation(prompt)
	if err != nil {
		return
	}
	return
}

type IdentifyTrackUI struct {
	BaseIdentifyUI
	them   *libkb.User
	strict bool
}

func (ui IdentifyTrackUI) FinishAndPrompt(res *libkb.IdentifyRes) (i libkb.TrackInstructions, err error) {
	var prompt string
	un := ui.them.GetName()
	var warnings libkb.Warnings

	if err, warnings = res.GetErrorAndWarnings(ui.strict); err != nil {
		return
	} else if !warnings.IsEmpty() {
		tracker.ShowWarnings(warnings)
		prompt = "Some proofs failed; still track " + un + "?"
	} else if len(res.ProofChecks) == 0 {
		prompt = "We found an account for " + un +
			", but they haven't proven their identity. Still track them?"
	} else {
		prompt = "Is this the " + un + "you wanted?"
	}

	if err = tracker.PromptForConfirmation(prompt); err != nil {
		return err
	}
	return nil
}

func (u BaseIdentifyUI) ReportHook(s string) {
	os.Stdout.Write([]byte(s))
}

func (u BaseIdentifyUI) ShowWarnings(w libkb.Warnings) {
	w.Warn()
}

func (u BaseIdentifyUI) PromptForConfirmation(s string) error {
	return u.parent.PromptForConfirmation(s)
}

func (u BaseIdentifyUI) FinishSocialProofCheck(s *libkb.SocialProofChainLink, lcr libkb.LinkCheckResult) {
	var msg, lcrs string

	if lcr.diff != nil {
		lcrs = TrackDiffToColoredString(lcr.diff) + " "
	}

	if lcr.err == nil {
		msg += (CHECK + " " + lcrs + `"` +
			ColorString("green", s.username) + `" on ` + s.service +
			": " + lcr.hint.humanUrl)
	} else {
		msg += (BADX + " " + lcrs +
			ColorString("red", `"`+s.username+`" on `+s.service+" "+
				ColorString("bold", "failed")+": "+
				lcr.err.Error()))
	}
	if lcr.cached != nil {
		msg += " " + ColorString("magenta", lcr.cached.ToDisplayString())
	}
	u.ReportHook(msg)
}

func TrackDiffToColoredString(t TrackDiff) string {
	s := t.ToDisplayString()
	var color string
	switch t.(type) {
	case TrackDiffError, TrackDiffClash, TrackDiffLost:
		color = "red"
	case TrackDiffUpgraded:
		color = "orange"
	case TrackDiffNew:
		color = "blue"
	case TrackDiffNone:
		color = "green"
	}
	if len(color) == 0 {
		s = ColorString(color, s)
	}
	return s
}

func (u BaseIdentifyUI) TrackDiffErrorToString(libkb.TrackDiffError) string {
	return ColorString("red", "<error>")
}
func (u BaseIdentifyUI) TrackDiffUpgradedToString(t libkb.TrackDiffUpgraded) string {
	return ColorString("orange", "<Upgraded from "+t.prev+" to "+t.curr+">")
}

func (u BaseIdentifyUI) FinishWebProofCheck(s *libkb.WebProofChainLink, lcr libkb.LinkCheckResult) {
	var msg, lcrs string

	if lcr.diff != nil {
		lcrs = TrackDiffToColoredString(lcr.diff) + " "
	}

	if lcr.err == nil {
		if s.protocol == "dns" {
			msg += (CHECK + " " + lcrs + "admin of DNS zone " +
				ColorString("green", s.hostname) +
				": found TXT entry " + lcr.hint.checkText)
		} else {
			var color string
			if s.protocol == "https" {
				color = "green"
			} else {
				color = "yellow"
			}
			msg += (CHECK + " " + lcrs + "admin of " +
				ColorString(color, s.hostname) + " via " +
				ColorString(color, strings.ToUpper(s.protocol)) +
				": " + lcr.hint.humanUrl)
		}
	} else {
		msg = (BADX + " " + lcrs +
			ColorString("red", "Proof for "+s.ToDisplayString()+" "+
				ColorString("bold", "failed")+": "+
				lcr.err.Error()))
	}

	if lcr.cached != nil {
		msg += " " + ColorString("magenta", lcr.cached.ToDisplayString())
	}
	u.ReportHook(msg)
}

func (u *BaseIdentifyUI) DisplayCryptocurrency(l *libkb.CryptocurrencyChainlink) {
	msg := (BTC + " bitcoin " + ColorString("green", l.GetAddress()))
	u.ReportHook(msg)
}

func (u *BaseIdentifyUI) DisplayKey(fp *libkb.PgpFingerprint) {
	msg := CHECK + " " + ds +
		ColorString("green", "public key fingerprint: "+fp.ToQuads())
	u.ReportHook(msg)
}

func (u *BaseIdentifyUI) DisplayLastTrack(t *libkb.TrackLookup) {
	if t != nil {
		msg := ColorString("bold", fmt.Sprintf("You last tracked %s on %s",
			u.name, FormatTime(t.GetCTime())))
		u.ReportHook(msg)
	}
}

func (u *UI) GetIdentifySelfUI() libkb.IdentifyUI {
	return IdentifySelfUI{BaseIdentifyUI{u}}
}

func (u *UI) GetIdentifyTrackUI(them *libkb.User, strict bool) libkb.IdentifyUI {
	return IdentifyTrackUI{BaseIdentifyUI{u}, them, strict}
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

func (ui *UI) PromptSelection(prompt string, low, hi int) (ret int, err error) {
	field := &Field{
		Name:   "selection",
		Prompt: prompt,
		Checker: &libkb.Checker{
			F: func(s string) bool {
				v, e := strconv.Atoi(s)
				return (e == nil && v >= low && v <= hi)
			},
			Hint: fmt.Sprintf("%d-%d", low, hi),
		},
	}
	err = NewPrompter([]*Field{field}).Run()
	if p := field.Value; p == nil {
		err = InputCanceledError{}
	} else {
		ret, err = strconv.Atoi(*p)
	}
	return
}

func (ui *UI) Output(s string) error {
	_, err := os.Stdout.Write([]byte(s))
	return err
}
