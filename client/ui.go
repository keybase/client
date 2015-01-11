package main

import (
	"fmt"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
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

func (ui BaseIdentifyUI) baseFinishAndPrompt(o *keybase_1.IdentifyOutcome) (ret keybase_1.FinishAndPromptRes, err error) {
	warnings := libkb.ImportWarnings(o.Warnings)
	if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
	}
	return
}

func (ui BaseIdentifyUI) LaunchNetworkChecks(i *keybase_1.Identity) {
	return
}

func (ui IdentifyLubaUI) FinishAndPrompt(o *keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error) {
	return ui.baseFinishAndPrompt(o)
}
func (ui IdentifyUI) FinishAndPrompt(o *keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error) {
	return ui.baseFinishAndPrompt(o)
}

func (ui IdentifySelfUI) FinishAndPrompt(o *keybase_1.IdentifyOutcome) (ret keybase_1.FinishAndPromptRes, err error) {
	err = libkb.ImportStatusAsError(o.Status)
	warnings := libkb.ImportWarnings(o.Warnings)
	var prompt string
	if err != nil {
		return
	} else if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
		prompt = "Do you still accept these credentials to be your own?"
	} else if o.NumProofSuccesses == 0 {
		prompt = "We found your account, but you have no hosted proofs. Check your fingerprint carefully. Is this you?"
	} else {
		prompt = "Is this you?"
	}

	err = ui.PromptForConfirmation(prompt)
	return
}

type IdentifyTrackUI struct {
	BaseIdentifyUI
	strict bool
}

func (ui IdentifyTrackUI) ReportDeleted(del []keybase_1.TrackDiff) {
	if len(del) > 0 {
		G.Log.Warning("Some proofs you previously tracked were deleted:")
		for _, d := range del {
			ui.ReportHook(BADX + " " + TrackDiffToColoredString(d))
		}
	}
}

func (ui IdentifyTrackUI) FinishAndPrompt(o *keybase_1.IdentifyOutcome) (ret keybase_1.FinishAndPromptRes, err error) {

	var prompt string
	un := ui.them.GetName()

	// A "Track Failure" is when we previously tracked this user, and
	// some aspect of their proof changed.  Like their key changed, or
	// they changed Twitter names
	ntf := o.NumTrackFailures

	// A "Track Change" isn't necessary a failure, maybe they upgraded
	// a proof from HTTP to HTTPS.  But we still should retrack if we can.
	ntc := o.NumTrackChanges

	// The number of proofs that failed.
	npf := o.NumProofFailures

	// Deleted proofs are those we used to look for but are gone!
	nd := o.NumDeleted

	// The number of proofs that actually worked
	nps := o.NumProofSuccesses

	// Whether we used a tracking statement when checking the identity
	// this time...
	tracked := o.TrackUsed != nil
	is_remote := false
	if tracked {
		is_remote = o.TrackUsed.IsRemote
	}

	G.Log.Debug("| Status for track(%s): ntf=%d; ntc=%d; nd=%d; nps=%d; tracked=%v; is_remote=%v",
		un, ntf, ntc, npf, nd, nps, tracked, is_remote)

	ui.ReportDeleted(o.Deleted)

	def := true
	is_equal := false
	if ntf > 0 || nd > 0 {
		prompt = "Your tracking statement of " + un + " is broken; fix it?"
		def = false
	} else if ntc > 0 {
		prompt = "Your tracking statement of " + un +
			"is still valid; update it to reflect new proofs?"
		def = true
	} else if nps == 0 {
		prompt = "We found an account for " + un +
			", but they haven't proven their identity. Still track them?"
		def = false
	} else if tracked && ntc == 0 {
		G.Log.Info("Your tracking statement is up-to-date")
		is_equal = true
	} else if npf > 0 {
		prompt = "Some proofs failed; still track " + un + "?"
		def = false
	} else {
		prompt = "Is this the " + ColorString("bold", un) + " you wanted?"
		def = true
	}

	if !is_equal {
		var ok bool
		if ok, err = ui.parent.PromptYesNo(prompt, &def); err != nil {
		} else if !ok {
			err = NotConfirmedError{}
		}
		ret.TrackLocal = true
	} else if is_remote {
		ret.TrackLocal = false
	}

	if err == nil && (!is_equal || !is_remote) {
		def = true
		prompt = "publicly write tracking statement to server?"
		ret.TrackRemote, err = ui.parent.PromptYesNo(prompt, &def)
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

type RemoteProofWrapper struct {
	p keybase_1.RemoteProof
}

func (w RemoteProofWrapper) GetRemoteUsername() string { return w.p.Value }
func (w RemoteProofWrapper) GetService() string        { return w.p.Value }
func (w RemoteProofWrapper) GetProtocol() string       { return w.p.Key }
func (w RemoteProofWrapper) GetHostname() string       { return w.p.Value }
func (w RemoteProofWrapper) GetDomain() string         { return w.p.Value }

func (w RemoteProofWrapper) ToDisplayString() string {
	return libkb.NewMarkup(w.p.DisplayMarkup).GetRaw()
}

type LinkCheckResultWrapper struct {
	lcr keybase_1.LinkCheckResult
}

func (w LinkCheckResultWrapper) GetDiff() *keybase_1.TrackDiff {
	return w.lcr.Diff
}

func (w LinkCheckResultWrapper) GetError() error {
	return libkb.ImportProofError(w.lcr.ProofStatus)
}

type SigHintWrapper struct {
	hint *keybase_1.SigHint
}

func (shw SigHintWrapper) GetHumanUrl() (ret string) {
	if shw.hint == nil {
		ret = "nil"
	} else {
		ret = shw.hint.HumanUrl
	}
	return
}

func (shw SigHintWrapper) GetCheckText() (ret string) {
	if shw.hint == nil {
		ret = "nil"
	} else {
		ret = shw.hint.CheckText
	}
	return
}

func (w LinkCheckResultWrapper) GetHint() SigHintWrapper {
	return SigHintWrapper{w.lcr.Hint}
}

type CheckResultWrapper struct {
	cr *keybase_1.CheckResult
}

func (crw CheckResultWrapper) ToDisplayString() string {
	return crw.cr.DisplayMarkup
}

func (w LinkCheckResultWrapper) GetCached() *CheckResultWrapper {
	if o := w.lcr.Cached; o == nil {
		return nil
	} else {
		return &CheckResultWrapper{o}
	}
}

func (u BaseIdentifyUI) FinishSocialProofCheck(p keybase_1.RemoteProof, l keybase_1.LinkCheckResult) {
	var msg, lcrs string

	s := RemoteProofWrapper{p}
	lcr := LinkCheckResultWrapper{l}

	if diff := lcr.GetDiff(); diff != nil {
		lcrs = TrackDiffToColoredString(*diff) + " "
	}
	run := s.GetRemoteUsername()

	if err := lcr.GetError(); err == nil {
		msg += (CHECK + " " + lcrs + `"` +
			ColorString("green", run) + `" on ` + s.GetService() +
			": " + lcr.GetHint().GetHumanUrl())
	} else {
		msg += (BADX + " " + lcrs +
			ColorString("red", `"`+run+`" on `+s.GetService()+" "+
				ColorString("bold", "failed")+": "+
				err.Error()))
	}
	if cached := lcr.GetCached(); cached != nil {
		msg += " " + ColorString("magenta", cached.ToDisplayString())
	}
	u.ReportHook(msg)
}

func TrackDiffToColoredString(t keybase_1.TrackDiff) string {
	s := "<" + t.DisplayMarkup + ">"
	var color string
	switch t.Type {
	case keybase_1.TrackDiffType_ERROR, keybase_1.TrackDiffType_CLASH, keybase_1.TrackDiffType_DELETED:
		color = "red"
	case keybase_1.TrackDiffType_UPGRADED:
		color = "orange"
	case keybase_1.TrackDiffType_NEW:
		color = "blue"
	case keybase_1.TrackDiffType_NONE:
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

func (u BaseIdentifyUI) FinishWebProofCheck(p keybase_1.RemoteProof, l keybase_1.LinkCheckResult) {
	var msg, lcrs string

	s := RemoteProofWrapper{p}
	lcr := LinkCheckResultWrapper{l}

	if diff := lcr.GetDiff(); diff != nil {
		lcrs = TrackDiffToColoredString(*diff) + " "
	}

	great_color := "green"
	ok_color := "yellow"

	if err := lcr.GetError(); err == nil {
		if s.GetProtocol() == "dns" {
			msg += (CHECK + " " + lcrs + "admin of " +
				ColorString(ok_color, "DNS") + " zone " +
				ColorString(ok_color, s.GetDomain()) +
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

func (u BaseIdentifyUI) DisplayCryptocurrency(l keybase_1.Cryptocurrency) {
	msg := (BTC + " bitcoin " + ColorString("green", l.Address))
	u.ReportHook(msg)
}

func (u BaseIdentifyUI) DisplayKey(f keybase_1.FOKID, diff *keybase_1.TrackDiff) {
	var ds string
	if diff != nil {
		ds = TrackDiffToColoredString(*diff) + " "
	}
	var s string
	if fp := libkb.ImportPgpFingerprint(f); fp != nil {
		s = fp.ToQuads()
	} else {
		s = "<none>"
	}
	msg := CHECK + " " + ds + ColorString("green", "public key fingerprint: "+s)
	u.ReportHook(msg)
}

func (u BaseIdentifyUI) ReportLastTrack(tl *keybase_1.TrackSummary) {
	if t := libkb.ImportTrackSummary(tl); t != nil {
		locally := ""
		if !t.IsRemote() {
			locally = "locally "
		}
		msg := ColorString("bold", fmt.Sprintf("You last %stracked %s on %s",
			locally, u.them.GetName(), libkb.FormatTime(t.GetCTime())))
		u.ReportHook(msg)
	}
}

func (u BaseIdentifyUI) Warning(m string) {
	G.Log.Warning(m)
}

func (u *UI) GetIdentifySelfUI() libkb.IdentifyUI {
	return IdentifySelfUI{BaseIdentifyUI{u, nil}}
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

func (u *UI) GetLoginUI() libkb.LoginUI {
	return LoginUI{u}
}

func (u *UI) GetSecretUI() libkb.SecretUI {
	return SecretUI{u}
}

func (u *UI) GetProveUI() libkb.ProveUI {
	return ProveUI{parent: u}
}

func (u *UI) GetLogUI() libkb.LogUI {
	return G.Log
}

//============================================================

type ProveUI struct {
	parent     *UI
	outputHook func(string) error
}

func (p ProveUI) PromptOverwrite1(a string) (bool, error) {
	prompt := "You already have a proof for " + ColorString("bold", a) + "; overwrite?"
	def := false
	return p.parent.PromptYesNo(prompt, &def)
}

func (p ProveUI) PromptOverwrite2(o string) (bool, error) {
	prompt := "You already have claimed ownership of " + ColorString("bold", o) + "; overwrite? "
	def := false
	return p.parent.PromptYesNo(prompt, &def)
}

func (p ProveUI) PromptUsername(prompt string, prevError error) (string, error) {
	if prevError != nil {
		G.Log.Error(prevError.Error())
	}
	return p.parent.Terminal.Prompt(prompt + ": ")
}

func (p ProveUI) Render(txt keybase_1.Text) {
	RenderText(os.Stdout, txt)
}

func (p ProveUI) OutputPrechecks(txt keybase_1.Text) {
	p.Render(txt)
}

func (p ProveUI) PreProofWarning(txt keybase_1.Text) (bool, error) {
	p.Render(txt)
	def := false
	return p.parent.PromptYesNo("Proceed?", &def)
}

func (p ProveUI) OutputInstructions(instructions keybase_1.Text, proof string) (err error) {
	p.Render(instructions)
	if p.outputHook != nil {
		err = p.outputHook(proof)
	} else {
		p.parent.Output("\n" + proof + "\n")
	}
	return
}

func (p ProveUI) OkToCheck(name string, attempt int) (bool, error) {
	var agn string
	if attempt > 0 {
		agn = "again "
	}
	prompt := "Check " + name + " " + agn + "now?"
	def := true
	return p.parent.PromptYesNo(prompt, &def)
}

func (p ProveUI) DisplayRecheckWarning(txt keybase_1.Text) {
	p.Render(txt)
}

//============================================================

type LoginUI struct {
	parent *UI
}

func (l LoginUI) GetEmailOrUsername() (string, error) {
	return l.parent.Prompt("Your keybase username or email", false,
		libkb.CheckEmailOrUsername)
}

type SecretUI struct {
	parent *UI
}

func (u SecretUI) GetSecret(pinentry keybase_1.SecretEntryArg, term *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	return u.parent.SecretEntry.Get(pinentry, term)
}

func (u *UI) Configure() error {
	u.Terminal = NewTerminal()
	u.SecretEntry = NewSecretEntry(u.Terminal)
	return nil
}

func (u *UI) GetTerminalSize() (int, int) {
	return u.Terminal.GetSize()
}

func (u *UI) Shutdown() error {
	var err error
	if u.Terminal != nil {
		err = u.Terminal.Shutdown()
	}
	return err
}

func (u SecretUI) GetNewPassphrase(earg keybase_1.GetNewPassphraseArg) (text string, err error) {

	arg := libkb.PromptArg{
		TerminalPrompt: earg.TerminalPrompt,
		PinentryDesc:   earg.PinentryDesc,
		PinentryPrompt: earg.PinentryPrompt,
		RetryMessage:   earg.RetryMessage,
		Checker:        &libkb.CheckPassphraseNew,
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

		if text, err = u.ppprompt(arg); err != nil {
			return
		}

		arg.TerminalPrompt = "confirm " + arg.TerminalPrompt
		arg.PinentryDesc = "Please reenter your passphase for confirmation"
		arg.RetryMessage = ""
		arg.Checker = nil

		if text2, err = u.ppprompt(arg); err != nil {
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

func (u SecretUI) GetKeybasePassphrase(arg keybase_1.GetKeybasePassphraseArg) (text string, err error) {
	desc := fmt.Sprintf("Please enter the Keybase passphrase for %s (12+ characters)", arg.Username)
	return u.ppprompt(libkb.PromptArg{
		TerminalPrompt: "keybase passphrase",
		PinentryPrompt: "Your passphrase",
		PinentryDesc:   desc,
		Checker:        &libkb.CheckPassphraseSimple,
		RetryMessage:   arg.Retry,
	})
}

func (u SecretUI) ppprompt(arg libkb.PromptArg) (text string, err error) {

	first := true
	var res *keybase_1.SecretEntryRes

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

		res, err = u.GetSecret(keybase_1.SecretEntryArg{
			Err:    emp,
			Desc:   arg.PinentryDesc,
			Prompt: arg.PinentryPrompt,
		}, &keybase_1.SecretEntryArg{
			Err:    emt,
			Prompt: tp,
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
