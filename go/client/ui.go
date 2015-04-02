package main

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"text/tabwriter"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type UI struct {
	Terminal    *Terminal
	SecretEntry *SecretEntry
}

type BaseIdentifyUI struct {
	parent   *UI
	username string
}

func (ui BaseIdentifyUI) SetStrict(b bool) {}

type IdentifyLubaUI struct {
	BaseIdentifyUI
}

type IdentifyUI struct {
	BaseIdentifyUI
}

func (ui *IdentifyTrackUI) Start(username string) {
	ui.username = username
	G.Log.Info("Generating tracking statement for " + ColorString("bold", ui.username))
}
func (ui *IdentifyLubaUI) Start(username string) {
	ui.username = username
	G.Log.Info("LoadUserByAssertion: Verifying identify for " + ColorString("bold", ui.username))
}
func (ui *IdentifyUI) Start(username string) {
	ui.username = username
	G.Log.Info("Identifying " + ColorString("bold", ui.username))
}

func (ui BaseIdentifyUI) DisplayTrackStatement(stmt string) error {
	return ui.parent.Output(stmt)
}

func (ui BaseIdentifyUI) baseFinishAndPrompt(o *keybase_1.IdentifyOutcome) (ret keybase_1.FinishAndPromptRes, err error) {
	warnings := libkb.ImportWarnings(o.Warnings)
	if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
	}
	return
}

func (ui BaseIdentifyUI) LaunchNetworkChecks(i *keybase_1.Identity, u *keybase_1.User) {
	return
}

func (ui IdentifyLubaUI) FinishAndPrompt(o *keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error) {
	return ui.baseFinishAndPrompt(o)
}
func (ui IdentifyUI) FinishAndPrompt(o *keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error) {
	return ui.baseFinishAndPrompt(o)
}

type IdentifyTrackUI struct {
	BaseIdentifyUI
	strict bool
}

func (ui IdentifyTrackUI) SetStrict(b bool) {
	ui.strict = b
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
	// for refactoring of username out of Get*(), make sure it has one here
	if len(ui.username) == 0 {
		G.Log.Warning("FinishAndPrompt: no username.  Was Start(username) not called?")
	}

	var prompt string
	un := ui.username

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
	isRemote := false
	if tracked {
		isRemote = o.TrackUsed.IsRemote
	}

	G.Log.Debug("| Status for track(%s): ntf=%d; ntc=%d; npf=%d, nd=%d; nps=%d; tracked=%v; isRemote=%v",
		un, ntf, ntc, npf, nd, nps, tracked, isRemote)

	ui.ReportDeleted(o.Deleted)

	def := PromptDefaultYes
	isEqual := false
	if ntf > 0 || nd > 0 {
		prompt = "Your tracking statement of " + un + " is broken; fix it?"
		def = PromptDefaultNo
	} else if tracked && ntc > 0 {
		prompt = "Your tracking statement of " + un +
			" is still valid; update it to reflect new proofs?"
		def = PromptDefaultYes
	} else if tracked && ntc == 0 {
		G.Log.Info("Your tracking statement is up-to-date")
		isEqual = true
	} else if nps == 0 {
		prompt = "We found an account for " + un +
			", but they haven't proven their identity. Still track them?"
		def = PromptDefaultNo
	} else if npf > 0 {
		prompt = "Some proofs failed; still track " + un + "?"
		def = PromptDefaultNo
	} else {
		prompt = "Is this the " + ColorString("bold", un) + " you wanted?"
		def = PromptDefaultYes
	}

	if !isEqual {
		var ok bool
		if ok, err = ui.parent.PromptYesNo(prompt, def); err != nil {
		} else if !ok {
			err = NotConfirmedError{}
		}
		ret.TrackLocal = true
	} else if isRemote {
		ret.TrackLocal = false
	}

	if err == nil && (!isEqual || !isRemote) {
		// check Outcome flags to see if we should show this statement
		if o.LocalOnly {
			return
		}
		if o.ApproveRemote {
			ret.TrackRemote = true
			return
		}
		prompt = "publicly write tracking statement to server?"
		ret.TrackRemote, err = ui.parent.PromptYesNo(prompt, PromptDefaultYes)
	}
	return
}

func (ui BaseIdentifyUI) ReportHook(s string) {
	os.Stderr.Write([]byte(s + "\n"))
}

func (ui BaseIdentifyUI) ShowWarnings(w libkb.Warnings) {
	w.Warn()
}

func (ui BaseIdentifyUI) PromptForConfirmation(s string) error {
	return ui.parent.PromptForConfirmation(s)
}

type RemoteProofWrapper struct {
	p keybase_1.RemoteProof
}

func (w RemoteProofWrapper) GetRemoteUsername() string { return w.p.Value }
func (w RemoteProofWrapper) GetService() string        { return w.p.Key }
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
	if o := w.lcr.Cached; o != nil {
		return &CheckResultWrapper{o}
	}
	return nil
}

func (ui BaseIdentifyUI) FinishSocialProofCheck(p keybase_1.RemoteProof, l keybase_1.LinkCheckResult) {
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
	ui.ReportHook(msg)
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

func (ui BaseIdentifyUI) TrackDiffErrorToString(libkb.TrackDiffError) string {
	return ColorString("red", "<error>")
}
func (ui BaseIdentifyUI) TrackDiffUpgradedToString(t libkb.TrackDiffUpgraded) string {
	return ColorString("orange", "<Upgraded from "+t.GetPrev()+" to "+t.GetCurr()+">")
}

func (ui BaseIdentifyUI) FinishWebProofCheck(p keybase_1.RemoteProof, l keybase_1.LinkCheckResult) {
	var msg, lcrs string

	s := RemoteProofWrapper{p}
	lcr := LinkCheckResultWrapper{l}

	if diff := lcr.GetDiff(); diff != nil {
		lcrs = TrackDiffToColoredString(*diff) + " "
	}

	greatColor := "green"
	okColor := "yellow"

	if err := lcr.GetError(); err == nil {
		if s.GetProtocol() == "dns" {
			msg += (CHECK + " " + lcrs + "admin of " +
				ColorString(okColor, "DNS") + " zone " +
				ColorString(okColor, s.GetDomain()) +
				": found TXT entry " + lcr.GetHint().GetCheckText())
		} else {
			var color string
			if s.GetProtocol() == "https" {
				color = greatColor
			} else {
				color = okColor
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
	ui.ReportHook(msg)
}

func (ui BaseIdentifyUI) DisplayCryptocurrency(l keybase_1.Cryptocurrency) {
	msg := (BTC + " bitcoin " + ColorString("green", l.Address))
	ui.ReportHook(msg)
}

func (ui BaseIdentifyUI) DisplayKey(f keybase_1.FOKID, diff *keybase_1.TrackDiff) {
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
	ui.ReportHook(msg)
}

func (ui BaseIdentifyUI) ReportLastTrack(tl *keybase_1.TrackSummary) {
	if t := libkb.ImportTrackSummary(tl); t != nil {
		locally := ""
		if !t.IsRemote() {
			locally = "locally "
		}
		msg := ColorString("bold", fmt.Sprintf("You last %stracked %s on %s",
			locally, ui.username, libkb.FormatTime(t.GetCTime())))
		ui.ReportHook(msg)
	}
}

func (ui BaseIdentifyUI) Warning(m string) {
	G.Log.Warning(m)
}

func (ui *UI) GetIdentifyTrackUI(strict bool) libkb.IdentifyUI {
	return &IdentifyTrackUI{BaseIdentifyUI{parent: ui}, strict}
}

func (ui *UI) GetIdentifyUI() libkb.IdentifyUI {
	return &IdentifyUI{BaseIdentifyUI{parent: ui}}
}

func (ui *UI) GetIdentifyLubaUI() libkb.IdentifyUI {
	return &IdentifyLubaUI{BaseIdentifyUI{parent: ui}}
}

func (ui *UI) GetLoginUI() libkb.LoginUI {
	return LoginUI{ui}
}

func (ui *UI) GetSecretUI() libkb.SecretUI {
	return SecretUI{ui}
}

func (ui *UI) GetProveUI() libkb.ProveUI {
	return ProveUI{parent: ui}
}

func (ui *UI) GetLogUI() libkb.LogUI {
	return G.Log
}

func (ui *UI) GetGPGUI() libkb.GPGUI {
	return GPGUI{ui}
}

func (ui *UI) GetDoctorUI() libkb.DoctorUI {
	return DoctorUI{ui}
}

//============================================================

type ProveUI struct {
	parent     *UI
	outputHook func(string) error
}

func (p ProveUI) PromptOverwrite(a string, typ keybase_1.PromptOverwriteType) (bool, error) {
	var prompt string
	switch typ {
	case keybase_1.PromptOverwriteType_SOCIAL:
		prompt = "You already have a proof for " + ColorString("bold", a) + "; overwrite?"
	case keybase_1.PromptOverwriteType_SITE:
		prompt = "You already have claimed ownership of " + ColorString("bold", a) + "; overwrite?"
	default:
		prompt = "Overwrite " + a + "?"
	}
	return p.parent.PromptYesNo(prompt, PromptDefaultNo)
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
	return p.parent.PromptYesNo("Proceed?", PromptDefaultNo)
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
	return p.parent.PromptYesNo(prompt, PromptDefaultYes)
}

func (p ProveUI) DisplayRecheckWarning(txt keybase_1.Text) {
	p.Render(txt)
}

//============================================================

type DoctorUI struct {
	parent *UI
}

func (d DoctorUI) PromptDeviceName(dummy int) (string, error) {
	return d.parent.Prompt("Enter a name for this device", false,
		libkb.CheckNotEmpty)
}

func (d DoctorUI) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
	d.parent.Output("How would you like to sign this install of Keybase?\n\n")
	w := new(tabwriter.Writer)
	w.Init(d.parent.OutputWriter(), 5, 0, 3, ' ', 0)

	optcount := 0
	for i, dev := range arg.Devices {
		var req string
		switch dev.Type {
		case libkb.DEVICE_TYPE_DESKTOP:
			req = "requires access to that computer"
		case libkb.DEVICE_TYPE_MOBILE:
			req = "requires your device"
		default:
			return res, fmt.Errorf("unknown device type: %q", dev.Type)
		}

		fmt.Fprintf(w, "(%d) with your key called %q\t(%s)\n", i+1, dev.Name, req)
		optcount++
	}

	if arg.HasPGP {
		fmt.Fprintf(w, "(%d) using PGP\t(requires access to your PGP key)\n", len(arg.Devices)+1)
		optcount++
	}

	fmt.Fprintf(w, "(999) ...nevermind, I'll add this device later\t(logout)\n")
	fmt.Fprintf(w, "(666) ...I have lost all those keys and need to reset my account\t\n")

	w.Flush()

	ret, err := d.parent.PromptSelectionOrCancel("Choose a signing option", 1, 999)
	if err != nil {
		if err == ErrInputCanceled {
			res.Action = keybase_1.SelectSignerAction_CANCEL
			return res, nil
		}
		return res, err
	}

	if ret == 999 {
		res.Action = keybase_1.SelectSignerAction_CANCEL
		return res, nil
	}

	if ret == 666 {
		G.Log.Warning("account reset not yet implemented.")
		res.Action = keybase_1.SelectSignerAction_CANCEL
		return res, nil
	}

	if ret < 1 || ret > len(arg.Devices)+1 {
		res.Action = keybase_1.SelectSignerAction_CANCEL
		return res, nil
	}

	res.Action = keybase_1.SelectSignerAction_SIGN
	res.Signer = &keybase_1.DeviceSigner{}
	if ret == len(arg.Devices)+1 {
		res.Signer.Kind = keybase_1.DeviceSignerKind_PGP
	} else {
		res.Signer.Kind = keybase_1.DeviceSignerKind_DEVICE
		res.Signer.DeviceID = &(arg.Devices[ret-1].DeviceID)
		res.Signer.DeviceName = &(arg.Devices[ret-1].Name)
	}
	return res, nil
}

func (d DoctorUI) DisplaySecretWords(arg keybase_1.DisplaySecretWordsArg) error {
	d.parent.Printf("On your %q computer, a window should have appeared. Type this in it:\n\n", arg.DeviceNameExisting)
	d.parent.Printf("\t%s\n\n", arg.Secret)
	d.parent.Printf("Alternatively, if you're using the terminal at %q, type this:\n\n", arg.DeviceNameExisting)
	d.parent.Printf("\tkeybase sibkey add \"%s\"\n\n", arg.Secret)
	return nil
}

//============================================================

type LoginUI struct {
	parent *UI
}

func (l LoginUI) GetEmailOrUsername(dummy int) (string, error) {
	return l.parent.Prompt("Your keybase username or email", false,
		libkb.CheckEmailOrUsername)
}

type SecretUI struct {
	parent *UI
}

func (ui SecretUI) GetSecret(pinentry keybase_1.SecretEntryArg, term *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	return ui.parent.SecretEntry.Get(pinentry, term)
}

func (ui *UI) Configure() error {
	ui.Terminal = NewTerminal()
	ui.SecretEntry = NewSecretEntry(ui.Terminal)
	return nil
}

func (ui *UI) GetTerminalSize() (int, int) {
	return ui.Terminal.GetSize()
}

func (ui *UI) Shutdown() error {
	var err error
	if ui.Terminal != nil {
		err = ui.Terminal.Shutdown()
	}
	return err
}

func (ui SecretUI) GetNewPassphrase(earg keybase_1.GetNewPassphraseArg) (text string, err error) {

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

func (ui SecretUI) GetKeybasePassphrase(arg keybase_1.GetKeybasePassphraseArg) (text string, err error) {
	desc := fmt.Sprintf("Please enter the Keybase passphrase for %s (12+ characters)", arg.Username)
	return ui.ppprompt(libkb.PromptArg{
		TerminalPrompt: "keybase passphrase",
		PinentryPrompt: "Your passphrase",
		PinentryDesc:   desc,
		Checker:        &libkb.CheckPassphraseSimple,
		RetryMessage:   arg.Retry,
	})
}

func (ui SecretUI) ppprompt(arg libkb.PromptArg) (text string, err error) {

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

		res, err = ui.GetSecret(keybase_1.SecretEntryArg{
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

type PromptDefault int

const (
	PromptDefaultNo PromptDefault = iota
	PromptDefaultYes
	PromptDefaultNeither
)

func (ui *UI) PromptYesNo(p string, def PromptDefault) (ret bool, err error) {
	var ch string
	switch def {
	case PromptDefaultNeither:
		ch = "[y/n]"
	case PromptDefaultYes:
		ch = "[Y/n]"
	case PromptDefaultNo:
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
		} else if libkb.IsEmpty(s) {
			if def == PromptDefaultNo {
				ret = false
				done = true
			} else if def == PromptDefaultYes {
				ret = true
				done = true
			}
		}
	}
	return
}

var ErrInputCanceled InputCanceledError

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
		err = ErrInputCanceled
	} else {
		ret, err = strconv.Atoi(*p)
	}
	return
}

func (ui *UI) PromptSelectionOrCancel(prompt string, low, hi int) (ret int, err error) {
	field := &Field{
		Name:   "selection",
		Prompt: prompt,
		Checker: &libkb.Checker{
			F: func(s string) bool {
				if s == "c" {
					return true
				}
				v, e := strconv.Atoi(s)
				return (e == nil && v >= low && v <= hi)
			},
			Hint: fmt.Sprintf("%d-%d, or c to cancel", low, hi),
		},
	}
	err = NewPrompter([]*Field{field}).Run()
	if p := field.Value; p == nil || *p == "c" {
		err = ErrInputCanceled
	} else {
		ret, err = strconv.Atoi(*p)
	}
	return
}

func (ui *UI) Output(s string) error {
	_, err := os.Stdout.Write([]byte(s))
	return err
}

func (ui *UI) OutputWriter() io.Writer {
	return os.Stdout
}

func (ui *UI) Printf(format string, a ...interface{}) (n int, err error) {
	return fmt.Fprintf(ui.OutputWriter(), format, a...)
}

//=====================================================
