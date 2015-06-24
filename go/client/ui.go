package client

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"text/tabwriter"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type UI struct {
	Terminal    *Terminal
	SecretEntry *SecretEntry
}

type BaseIdentifyUI struct {
	parent *UI
}

func (ui BaseIdentifyUI) SetStrict(b bool) {}

type IdentifyUI struct {
	BaseIdentifyUI
}

func (ui *IdentifyTrackUI) Start(username string) {
	G.Log.Info("Generating tracking statement for " + ColorString("bold", username))
}

func (ui *IdentifyUI) Start(username string) {
	G.Log.Info("Identifying " + ColorString("bold", username))
}

func (ui BaseIdentifyUI) DisplayTrackStatement(stmt string) error {
	return ui.parent.Output(stmt)
}

func (ui BaseIdentifyUI) Finish() {
}

func (ui BaseIdentifyUI) baseFinishAndPrompt(o *keybase1.IdentifyOutcome) (ret keybase1.FinishAndPromptRes, err error) {
	warnings := libkb.ImportWarnings(o.Warnings)
	if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
	}
	return
}

func (ui BaseIdentifyUI) LaunchNetworkChecks(i *keybase1.Identity, u *keybase1.User) {
	return
}

func (ui IdentifyUI) FinishAndPrompt(o *keybase1.IdentifyOutcome) (keybase1.FinishAndPromptRes, error) {
	return ui.baseFinishAndPrompt(o)
}

type IdentifyTrackUI struct {
	BaseIdentifyUI
	strict bool
}

func (ui IdentifyTrackUI) SetStrict(b bool) {
	ui.strict = b
}

func (ui IdentifyTrackUI) ReportDeleted(del []keybase1.TrackDiff) {
	if len(del) > 0 {
		G.Log.Warning("Some proofs you previously tracked were deleted:")
		for _, d := range del {
			ui.ReportHook(BADX + " " + TrackDiffToColoredString(d))
		}
	}
}

func (ui IdentifyTrackUI) FinishAndPrompt(o *keybase1.IdentifyOutcome) (ret keybase1.FinishAndPromptRes, err error) {
	var prompt string
	un := o.Username

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
	switch {
	case ntf > 0 || nd > 0:
		prompt = "Your tracking statement of " + un + " is broken; fix it?"
		def = PromptDefaultNo
	case tracked && ntc > 0:
		prompt = "Your tracking statement of " + un +
			" is still valid; update it to reflect new proofs?"
		def = PromptDefaultYes
	case tracked && ntc == 0:
		G.Log.Info("Your tracking statement is up-to-date")
		isEqual = true
	case nps == 0:
		prompt = "We found an account for " + un +
			", but they haven't proven their identity. Still track them?"
		def = PromptDefaultNo
	case npf > 0:
		prompt = "Some proofs failed; still track " + un + "?"
		def = PromptDefaultNo
	default:
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
	p keybase1.RemoteProof
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
	lcr keybase1.LinkCheckResult
}

func (w LinkCheckResultWrapper) GetDiff() *keybase1.TrackDiff {
	return w.lcr.Diff
}

func (w LinkCheckResultWrapper) GetError() error {
	return libkb.ImportProofError(w.lcr.ProofResult)
}

type SigHintWrapper struct {
	hint *keybase1.SigHint
}

func (shw SigHintWrapper) GetHumanURL() (ret string) {
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
	cr *keybase1.CheckResult
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

func (ui BaseIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) {
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
			": " + lcr.GetHint().GetHumanURL())
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

func TrackDiffToColoredString(t keybase1.TrackDiff) string {
	s := "<" + t.DisplayMarkup + ">"
	var color string
	switch t.Type {
	case keybase1.TrackDiffType_ERROR, keybase1.TrackDiffType_CLASH, keybase1.TrackDiffType_DELETED:
		color = "red"
	case keybase1.TrackDiffType_UPGRADED:
		color = "orange"
	case keybase1.TrackDiffType_NEW:
		color = "blue"
	case keybase1.TrackDiffType_NONE:
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

func (ui BaseIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) {
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
				": " + lcr.GetHint().GetHumanURL())
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

func (ui BaseIdentifyUI) DisplayCryptocurrency(l keybase1.Cryptocurrency) {
	msg := (BTC + " bitcoin " + ColorString("green", l.Address))
	ui.ReportHook(msg)
}

// func (ui BaseIdentifyUI) DisplayKey(f keybase1.FOKID, diff *keybase1.TrackDiff) {
func (ui BaseIdentifyUI) DisplayKey(key keybase1.IdentifyKey) {
	var ds string
	if key.TrackDiff != nil {
		ds = TrackDiffToColoredString(*key.TrackDiff) + " "
	}
	var s string
	if fp := libkb.ImportPGPFingerprintSlice(key.PGPFingerprint); fp != nil {
		s = fp.ToQuads()
	} else {
		s = "<none>"
	}
	msg := CHECK + " " + ds + ColorString("green", "public key fingerprint: "+s)
	ui.ReportHook(msg)
}

func (ui BaseIdentifyUI) ReportLastTrack(tl *keybase1.TrackSummary) {
	if t := libkb.ImportTrackSummary(tl); t != nil {
		locally := ""
		if !t.IsRemote() {
			locally = "locally "
		}
		msg := ColorString("bold", fmt.Sprintf("You last %stracked %s on %s",
			locally, t.Username(), libkb.FormatTime(t.GetCTime())))
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
	return GPGUI{ui, false}
}

func (ui *UI) GetLocksmithUI() libkb.LocksmithUI {
	return LocksmithUI{ui}
}

func (ui *UI) GetDoctorUI() libkb.DoctorUI {
	return DoctorUI{parent: ui}
}

//============================================================

type ProveUI struct {
	parent     *UI
	outputHook func(string) error
}

func (p ProveUI) PromptOverwrite(arg keybase1.PromptOverwriteArg) (bool, error) {
	var prompt string
	switch arg.Typ {
	case keybase1.PromptOverwriteType_SOCIAL:
		prompt = "You already have a proof for " + ColorString("bold", arg.Account) + "; overwrite?"
	case keybase1.PromptOverwriteType_SITE:
		prompt = "You already have claimed ownership of " + ColorString("bold", arg.Account) + "; overwrite?"
	default:
		prompt = "Overwrite " + arg.Account + "?"
	}
	return p.parent.PromptYesNo(prompt, PromptDefaultNo)
}

func (p ProveUI) PromptUsername(arg keybase1.PromptUsernameArg) (string, error) {
	err := libkb.ImportStatusAsError(arg.PrevError)
	if err != nil {
		G.Log.Error(err.Error())
	}
	return p.parent.Terminal.Prompt(arg.Prompt + ": ")
}

func (p ProveUI) render(txt keybase1.Text) {
	RenderText(os.Stdout, txt)
}

func (p ProveUI) OutputPrechecks(arg keybase1.OutputPrechecksArg) error {
	p.render(arg.Text)
	return nil
}

func (p ProveUI) PreProofWarning(arg keybase1.PreProofWarningArg) (bool, error) {
	p.render(arg.Text)
	return p.parent.PromptYesNo("Proceed?", PromptDefaultNo)
}

func (p ProveUI) OutputInstructions(arg keybase1.OutputInstructionsArg) (err error) {
	p.render(arg.Instructions)
	if p.outputHook != nil {
		err = p.outputHook(arg.Proof)
	} else {
		p.parent.Output("\n" + arg.Proof + "\n")
	}
	return
}

func (p ProveUI) OkToCheck(arg keybase1.OkToCheckArg) (bool, error) {
	var agn string
	if arg.Attempt > 0 {
		agn = "again "
	}
	prompt := "Check " + arg.Name + " " + agn + "now?"
	return p.parent.PromptYesNo(prompt, PromptDefaultYes)
}

func (p ProveUI) DisplayRecheckWarning(arg keybase1.DisplayRecheckWarningArg) error {
	p.render(arg.Text)
	return nil
}

//============================================================

type LocksmithUI struct {
	parent *UI
}

func (d LocksmithUI) PromptDeviceName(dummy int) (string, error) {
	return d.parent.Prompt("Enter a name for this device", false,
		libkb.CheckNotEmpty)
}

func (d LocksmithUI) SelectSigner(arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	d.parent.Output("How would you like to sign this install of Keybase?\n\n")
	w := new(tabwriter.Writer)
	w.Init(d.parent.OutputWriter(), 5, 0, 3, ' ', 0)

	optcount := 0
	for i, dev := range arg.Devices {
		var req string
		switch dev.Type {
		case libkb.DeviceTypeDesktop:
			req = "requires access to that computer"
		case libkb.DeviceTypeMobile:
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
			res.Action = keybase1.SelectSignerAction_CANCEL
			return res, nil
		}
		return res, err
	}

	if ret == 999 {
		res.Action = keybase1.SelectSignerAction_CANCEL
		return res, nil
	}

	if ret == 666 {
		G.Log.Warning("account reset not yet implemented.")
		res.Action = keybase1.SelectSignerAction_CANCEL
		return res, nil
	}

	if ret < 1 || ret > len(arg.Devices)+1 {
		res.Action = keybase1.SelectSignerAction_CANCEL
		return res, nil
	}

	res.Action = keybase1.SelectSignerAction_SIGN
	res.Signer = &keybase1.DeviceSigner{}
	if ret == len(arg.Devices)+1 {
		res.Signer.Kind = keybase1.DeviceSignerKind_PGP
	} else {
		res.Signer.Kind = keybase1.DeviceSignerKind_DEVICE
		res.Signer.DeviceID = &(arg.Devices[ret-1].DeviceID)
		res.Signer.DeviceName = &(arg.Devices[ret-1].Name)
	}
	return res, nil
}

func (d LocksmithUI) DeviceSignAttemptErr(arg keybase1.DeviceSignAttemptErrArg) error {
	return nil
}

func (d LocksmithUI) DisplaySecretWords(arg keybase1.DisplaySecretWordsArg) error {
	d.parent.Printf("On your %q computer, a window should have appeared. Type this in it:\n\n", arg.DeviceNameExisting)
	d.parent.Printf("\t%s\n\n", arg.Secret)
	d.parent.Printf("Alternatively, if you're using the terminal at %q, type this:\n\n", arg.DeviceNameExisting)
	d.parent.Printf("\tkeybase device add \"%s\"\n\n", arg.Secret)
	return nil
}

func (d LocksmithUI) KexStatus(arg keybase1.KexStatusArg) error {
	G.Log.Debug("kex status: %s (%d)", arg.Msg, arg.Code)
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

func (ui SecretUI) GetSecret(pinentry keybase1.SecretEntryArg, term *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	return ui.parent.SecretEntry.Get(pinentry, term)
}

func (ui *UI) Configure() error {
	t, err := NewTerminal()
	if err != nil {
		return err
	}
	ui.Terminal = t
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

func (ui SecretUI) GetNewPassphrase(earg keybase1.GetNewPassphraseArg) (eres keybase1.GetNewPassphraseRes, err error) {

	arg := libkb.PromptArg{
		TerminalPrompt: earg.TerminalPrompt,
		PinentryDesc:   earg.PinentryDesc,
		PinentryPrompt: earg.PinentryPrompt,
		RetryMessage:   earg.RetryMessage,
		Checker:        &libkb.CheckPassphraseNew,
		UseSecretStore: earg.UseSecretStore,
	}

	orig := arg
	var rm string
	var text string

	for {
		text = ""
		var text2 string
		arg = orig
		if len(rm) > 0 {
			arg.RetryMessage = rm
			rm = ""
		}

		if text, eres.StoreSecret, err = ui.ppprompt(arg); err != nil {
			return
		}

		arg.TerminalPrompt = "confirm " + arg.TerminalPrompt
		arg.PinentryDesc = "Please reenter your passphase for confirmation"
		arg.RetryMessage = ""
		arg.Checker = nil

		arg2 := arg
		arg2.UseSecretStore = false
		if text2, _, err = ui.ppprompt(arg2); err != nil {
			return
		}
		if text == text2 {
			break
		} else {
			rm = "Password mismatch"
		}
	}

	eres.Passphrase = text
	return
}

func (ui SecretUI) GetKeybasePassphrase(arg keybase1.GetKeybasePassphraseArg) (text string, err error) {
	desc := fmt.Sprintf("Please enter the Keybase passphrase for %s (12+ characters)", arg.Username)
	text, _, err = ui.ppprompt(libkb.PromptArg{
		TerminalPrompt: "keybase passphrase",
		PinentryPrompt: "Your passphrase",
		PinentryDesc:   desc,
		Checker:        &libkb.CheckPassphraseSimple,
		RetryMessage:   arg.Retry,
		UseSecretStore: false,
	})
	return
}

func (ui SecretUI) ppprompt(arg libkb.PromptArg) (text string, storeSecret bool, err error) {

	first := true
	var res *keybase1.SecretEntryRes

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

		res, err = ui.GetSecret(keybase1.SecretEntryArg{
			Err:            emp,
			Desc:           arg.PinentryDesc,
			Prompt:         arg.PinentryPrompt,
			UseSecretStore: arg.UseSecretStore,
		}, &keybase1.SecretEntryArg{
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
			storeSecret = res.StoreSecret
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
	return ui.Terminal.PromptYesNo(p, def)
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
