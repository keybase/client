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
	them   *libkb.User
}

type IdentifySelfUI struct {
	BaseIdentifyUI
}

type IdentifyLubaUI struct {
	BaseIdentifyUI
}

type IdentifyUI struct {
	BaseIdentifyUI
}

func (u IdentifySelfUI) Start() {
	G.Log.Info("Verifying your key fingerprint....")
}
func (u IdentifyTrackUI) Start() {
	G.Log.Info("Generating tracking statement for " + ColorString("bold", u.them.GetName()))
}
func (u IdentifyLubaUI) Start() {
	G.Log.Info("LoadUserByAssertion: Verifying identify for " + ColorString("bold", u.them.GetName()))
}
func (u IdentifyUI) Start() {
	G.Log.Info("Identifying " + ColorString("bold", u.them.GetName()))
}

func (ui BaseIdentifyUI) baseFinishAndPrompt(ires *libkb.IdentifyRes) (i libkb.TrackInstructions, err error) {
	var warnings libkb.Warnings
	err, warnings = ires.GetErrorLax()
	if err != nil {
		return
	} else if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
	}
	return
}

func (ui IdentifyLubaUI) FinishAndPrompt(ires *libkb.IdentifyRes) (i libkb.TrackInstructions, err error) {
	return ui.baseFinishAndPrompt(ires)
}
func (ui IdentifyUI) FinishAndPrompt(ires *libkb.IdentifyRes) (i libkb.TrackInstructions, err error) {
	return ui.baseFinishAndPrompt(ires)
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
	strict bool
}

func (ui IdentifyTrackUI) ReportDeleted(del []libkb.TrackDiffDeleted) {
	if len(del) > 0 {
		G.Log.Warning("Some proofs you previous tracked were deleted:")
		for _, d := range del {
			ui.ReportHook(BADX + " " + TrackDiffToColoredString(d))
		}
	}
}

func (ui IdentifyTrackUI) FinishAndPrompt(res *libkb.IdentifyRes) (i libkb.TrackInstructions, err error) {
	var prompt string
	un := ui.them.GetName()

	// A "Track Failure" is when we previously tracked this user, and
	// some aspect of their proof changed.  Like their key changed, or
	// they changed Twitter names
	ntf := res.NumTrackFailures()

	// A "Track Change" isn't necessary a failure, maybe they upgraded
	// a proof from HTTP to HTTPS.  But we still should retrack if we can.
	ntc := res.NumTrackChanges()

	// The number of proofs that failed.
	npf := res.NumProofFailures()

	// Deleted proofs are those we used to look for but are gone!
	nd := res.NumDeleted()

	// The number of proofs that actually worked
	nps := res.NumProofSuccesses()

	// Whether we used a tracking statement when checking the identity
	// this time...
	tracked := res.TrackUsed != nil
	is_remote := false
	if tracked {
		is_remote = res.TrackUsed.IsRemote()
	}

	ui.ReportDeleted(res.Deleted)

	def := true
	is_equal := false
	if npf > 0 {
		prompt = "Some proofs failed; still track " + un + "?"
		def = false
	} else if nps == 0 {
		prompt = "We found an account for " + un +
			", but they haven't proven their identity. Still track them?"
		def = false
	} else if ntf > 0 || nd > 0 {
		prompt = "Your tracking statement of " + un + " is broken; fix it?"
		def = false
	} else if ntc > 0 {
		prompt = "Your tracking statement of " + un +
			"is still valid; update it to reflect new proofs?"
		def = true
	} else if tracked && ntc == 0 {
		G.Log.Info("Your tracking statement is up-to-date")
		is_equal = true
	} else {
		prompt = "Is this the " + ColorString("bold", un) + " you wanted?"
		def = true
	}

	if !is_equal {
		var ok bool
		if ok, err = ui.parent.PromptYesNo(prompt, &def); err != nil {
			return
		} else if !ok {
			err = NotConfirmedError{}
			return
		}
		i.Local = true
	} else if is_remote {
		i.Local = false
	}

	if !is_equal || !is_remote {
		def = true
		prompt = "Publicly write tracking statement to server?"
		if i.Remote, err = ui.parent.PromptYesNo(prompt, &def); err != nil {
			return
		}
	}

	return
}

func (u BaseIdentifyUI) ReportHook(s string) {
	os.Stdout.Write([]byte(s + "\n"))
}

func (u BaseIdentifyUI) ShowWarnings(w libkb.Warnings) {
	w.Warn()
}

func (u BaseIdentifyUI) PromptForConfirmation(s string) error {
	return u.parent.PromptForConfirmation(s)
}

func (u BaseIdentifyUI) FinishSocialProofCheck(s *libkb.SocialProofChainLink, lcr libkb.LinkCheckResult) {
	var msg, lcrs string

	if diff := lcr.GetDiff(); diff != nil {
		lcrs = TrackDiffToColoredString(diff) + " "
	}

	if err := lcr.GetError(); err == nil {
		msg += (CHECK + " " + lcrs + `"` +
			ColorString("green", s.GetUsername()) + `" on ` + s.GetService() +
			": " + lcr.GetHint().GetHumanUrl())
	} else {
		msg += (BADX + " " + lcrs +
			ColorString("red", `"`+s.GetUsername()+`" on `+s.GetService()+" "+
				ColorString("bold", "failed")+": "+
				lcr.GetError().Error()))
	}
	if cached := lcr.GetCached(); cached != nil {
		msg += " " + ColorString("magenta", cached.ToDisplayString())
	}
	u.ReportHook(msg)
}

func TrackDiffToColoredString(t libkb.TrackDiff) string {
	s := t.ToDisplayString()
	var color string
	switch t.(type) {
	case libkb.TrackDiffError, libkb.TrackDiffClash, libkb.TrackDiffDeleted:
		color = "red"
	case libkb.TrackDiffUpgraded:
		color = "orange"
	case libkb.TrackDiffNew:
		color = "blue"
	case libkb.TrackDiffNone:
		color = "green"
	}
	if len(color) > 0 {
		s = ColorString(color, s)
	}
	return s
}

func (u BaseIdentifyUI) TrackDiffErrorToString(libkb.TrackDiffError) string {
	return ColorString("red", "<error>")
}
func (u BaseIdentifyUI) TrackDiffUpgradedToString(t libkb.TrackDiffUpgraded) string {
	return ColorString("orange", "<Upgraded from "+t.GetPrev()+" to "+t.GetCurr()+">")
}

func (u BaseIdentifyUI) FinishWebProofCheck(s *libkb.WebProofChainLink, lcr libkb.LinkCheckResult) {
	var msg, lcrs string

	if diff := lcr.GetDiff(); diff != nil {
		lcrs = TrackDiffToColoredString(diff) + " "
	}

	great_color := "green"
	ok_color := "yellow"

	if err := lcr.GetError(); err == nil {
		if s.GetProtocol() == "dns" {
			msg += (CHECK + " " + lcrs + "admin of " +
				ColorString(ok_color, "DNS") + " zone " +
				ColorString(ok_color, s.GetHostname()) +
				": found TXT entry " + lcr.GetHint().GetCheckText())
		} else {
			var color string
			if s.GetProtocol() == "https" {
				color = great_color
			} else {
				color = ok_color
			}
			msg += (CHECK + " " + lcrs + "admin of " +
				ColorString(color, s.GetHostname()) + " via " +
				ColorString(color, strings.ToUpper(s.GetProtocol())) +
				": " + lcr.GetHint().GetHumanUrl())
		}
	} else {
		msg = (BADX + " " + lcrs +
			ColorString("red", "Proof for "+s.ToDisplayString()+" "+
				ColorString("bold", "failed")+": "+
				lcr.GetError().Error()))
	}

	if cached := lcr.GetCached(); cached != nil {
		msg += " " + ColorString("magenta", cached.ToDisplayString())
	}
	u.ReportHook(msg)
}

func (u BaseIdentifyUI) DisplayCryptocurrency(l *libkb.CryptocurrencyChainLink) {
	msg := (BTC + " bitcoin " + ColorString("green", l.GetAddress()))
	u.ReportHook(msg)
}

func (u BaseIdentifyUI) DisplayKey(fp *libkb.PgpFingerprint, diff libkb.TrackDiff) {
	var ds string
	if diff != nil {
		ds = TrackDiffToColoredString(diff) + " "
	}
	msg := CHECK + " " + ds +
		ColorString("green", "public key fingerprint: "+fp.ToQuads())
	u.ReportHook(msg)
}

func (u BaseIdentifyUI) ReportLastTrack(t *libkb.TrackLookup) {
	if t != nil {
		locally := ""
		if !t.IsRemote() {
			locally = "locally "
		}
		msg := ColorString("bold", fmt.Sprintf("You last %stracked %s on %s",
			locally, u.them.GetName(), libkb.FormatTime(t.GetCTime())))
		u.ReportHook(msg)
	}
}

func (u *UI) GetIdentifySelfUI(them *libkb.User) libkb.IdentifyUI {
	return IdentifySelfUI{BaseIdentifyUI{u, them}}
}

func (u *UI) GetIdentifyTrackUI(them *libkb.User, strict bool) libkb.IdentifyUI {
	return IdentifyTrackUI{BaseIdentifyUI{u, them}, strict}
}

func (u *UI) GetIdentifyUI(them *libkb.User) libkb.IdentifyUI {
	return IdentifyUI{BaseIdentifyUI{u, them}}
}

func (u *UI) GetIdentifyLubaUI(them *libkb.User) libkb.IdentifyUI {
	return IdentifyLubaUI{BaseIdentifyUI{u, them}}
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
