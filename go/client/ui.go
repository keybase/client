package client

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"text/tabwriter"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type UI struct {
	Terminal    *Terminal
	SecretEntry *SecretEntry
}

// The UI class also fulfills the TerminalUI interface from libkb
var _ libkb.TerminalUI = (*UI)(nil)

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

func (ui BaseIdentifyUI) baseConfirm(o *keybase1.IdentifyOutcome) (bool, error) {
	warnings := libkb.ImportWarnings(o.Warnings)
	if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
	}
	if o.TrackOptions.BypassConfirm {
		return true, nil
	}
	return false, nil
}

func (ui BaseIdentifyUI) LaunchNetworkChecks(i *keybase1.Identity, u *keybase1.User) {
	return
}

func (ui IdentifyUI) Confirm(o *keybase1.IdentifyOutcome) (confirmed bool, err error) {
	return ui.baseConfirm(o)
}

type IdentifyTrackUI struct {
	BaseIdentifyUI
	strict bool
}

func (ui IdentifyTrackUI) SetStrict(b bool) {
	ui.strict = b
}

func (ui IdentifyTrackUI) ReportRevoked(del []keybase1.TrackDiff) {
	if len(del) > 0 {
		G.Log.Warning("Some proofs you previously tracked were revoked:")
		for _, d := range del {
			ui.ReportHook(BADX + " " + TrackDiffToColoredString(d))
		}
	}
}

func (ui IdentifyTrackUI) Confirm(o *keybase1.IdentifyOutcome) (confirmed bool, err error) {
	confirmed = false
	var prompt string
	username := o.Username

	// Whether we used a tracking statement when checking the identity
	// this time...
	tracked := o.TrackUsed != nil
	trackedRemote := tracked && o.TrackUsed.IsRemote

	// If we are tracking remotely, and we we're asked to track local only then error.
	if trackedRemote && o.TrackOptions.LocalOnly {
		err = fmt.Errorf("Can't locally track if you are already tracking remotely")
		return
	}

	ui.ReportRevoked(o.Revoked)

	promptDefault := libkb.PromptDefaultYes
	trackChanged := true
	switch o.TrackStatus {
	case keybase1.TrackStatus_UPDATE_BROKEN:
		prompt = "Your tracking statement of " + username + " is broken; fix it?"
		promptDefault = libkb.PromptDefaultNo
	case keybase1.TrackStatus_UPDATE_NEW_PROOFS:
		prompt = "Your tracking statement of " + username +
			" is still valid; update it to reflect new proofs?"
		promptDefault = libkb.PromptDefaultYes
	case keybase1.TrackStatus_UPDATE_OK:
		G.Log.Info("Your tracking statement is up-to-date")
		trackChanged = false
	case keybase1.TrackStatus_NEW_ZERO_PROOFS:
		prompt = "We found an account for " + username +
			", but they haven't proven their identity. Still track them?"
		promptDefault = libkb.PromptDefaultNo
	case keybase1.TrackStatus_NEW_FAIL_PROOFS:
		prompt = "Some proofs failed; still track " + username + "?"
		promptDefault = libkb.PromptDefaultNo
	default:
		prompt = "Is this the " + ColorString("bold", username) + " you wanted?"
		promptDefault = libkb.PromptDefaultYes
	}

	// Tracking statement exists and is unchanged, nothing to do
	if !trackChanged {
		confirmed = true
		return
	}

	// Tracking statement doesn't exist or changed, lets prompt them with the details
	if confirmed, err = ui.parent.PromptYesNo(PromptDescriptorTrackAction, prompt, promptDefault); err != nil {
		return
	}
	if !confirmed {
		return
	}

	// If we want to track remote, lets confirm (unless bypassing)
	if !o.TrackOptions.LocalOnly {
		if o.TrackOptions.BypassConfirm {
			confirmed = true
			return
		}
		prompt = "Publicly write tracking statement to server?"
		if confirmed, err = ui.parent.PromptYesNo(PromptDescriptorTrackPublic, prompt, promptDefault); err != nil {
			return
		}
		if !confirmed {
			return
		}
	}

	confirmed = true
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
	return w.p.DisplayMarkup
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
	case keybase1.TrackDiffType_ERROR, keybase1.TrackDiffType_CLASH, keybase1.TrackDiffType_REVOKED:
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
	return NewLoginUI(ui.GetTerminalUI(), false)
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
	return NewGPGUI(ui.GetTerminalUI(), false)
}

func (ui *UI) GetLocksmithUI() libkb.LocksmithUI {
	return LocksmithUI{ui}
}

func (ui *UI) GetDoctorUI() libkb.DoctorUI {
	return DoctorUI{parent: ui}
}

func (ui *UI) GetProvisionUI(provisioner bool) libkb.ProvisionUI {
	return ProvisionUI{parent: ui, provisioner: provisioner}
}

//============================================================

type ProveUI struct {
	parent     *UI
	outputHook func(string) error
}

func (p ProveUI) PromptOverwrite(_ context.Context, arg keybase1.PromptOverwriteArg) (bool, error) {
	var prompt string
	switch arg.Typ {
	case keybase1.PromptOverwriteType_SOCIAL:
		prompt = "You already have a proof for " + ColorString("bold", arg.Account) + "; overwrite?"
	case keybase1.PromptOverwriteType_SITE:
		prompt = "You already have claimed ownership of " + ColorString("bold", arg.Account) + "; overwrite?"
	default:
		prompt = "Overwrite " + arg.Account + "?"
	}
	return p.parent.PromptYesNo(PromptDescriptorProveOverwriteOK, prompt, libkb.PromptDefaultNo)
}

func (p ProveUI) PromptUsername(_ context.Context, arg keybase1.PromptUsernameArg) (string, error) {
	err := libkb.ImportStatusAsError(arg.PrevError)
	if err != nil {
		G.Log.Error(err.Error())
	}
	return p.parent.Terminal.Prompt(arg.Prompt + ": ")
}

func (p ProveUI) render(txt keybase1.Text) {
	RenderText(p.parent.OutputWriter(), txt)
}

func (p ProveUI) OutputPrechecks(_ context.Context, arg keybase1.OutputPrechecksArg) error {
	p.render(arg.Text)
	return nil
}

func (p ProveUI) PreProofWarning(_ context.Context, arg keybase1.PreProofWarningArg) (bool, error) {
	p.render(arg.Text)
	return p.parent.PromptYesNo(PromptDescriptorProvePreWarning, "Proceed?", libkb.PromptDefaultNo)
}

func (p ProveUI) OutputInstructions(_ context.Context, arg keybase1.OutputInstructionsArg) (err error) {
	p.render(arg.Instructions)
	if p.outputHook != nil {
		err = p.outputHook(arg.Proof)
	} else {
		p.parent.Output("\n" + arg.Proof + "\n")
	}
	return
}

func (p ProveUI) OkToCheck(_ context.Context, arg keybase1.OkToCheckArg) (bool, error) {
	var agn string
	if arg.Attempt > 0 {
		agn = "again "
	}
	prompt := "Check " + arg.Name + " " + agn + "now?"
	return p.parent.PromptYesNo(PromptDescriptorProveOKToCheck, prompt, libkb.PromptDefaultYes)
}

func (p ProveUI) DisplayRecheckWarning(_ context.Context, arg keybase1.DisplayRecheckWarningArg) error {
	p.render(arg.Text)
	return nil
}

//============================================================

type LocksmithUI struct {
	parent *UI
}

func (d LocksmithUI) PromptDeviceName(_ context.Context, _ int) (string, error) {
	return PromptWithChecker(PromptDescriptorLocksmithDeviceName, d.parent, "Enter a public name for this device", false, libkb.CheckDeviceName)
}

func (d LocksmithUI) DeviceNameTaken(_ context.Context, arg keybase1.DeviceNameTakenArg) error {
	d.parent.Output(fmt.Sprintf("Device name %q is already in use.  Please enter a unique device name.\n", arg.Name))
	return nil
}

func (d LocksmithUI) SelectSigner(_ context.Context, arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	d.parent.Output("How would you like to sign this install of Keybase?\n\n")
	w := new(tabwriter.Writer)
	w.Init(d.parent.OutputWriter(), 5, 0, 3, ' ', 0)

	optcount := 0
	for i, dev := range arg.Devices {
		var req string
		switch dev.Type {
		case libkb.DeviceTypeDesktop:
			req = "requires access to that device"
		case libkb.DeviceTypeMobile:
			req = "requires your device"
		default:
			return res, fmt.Errorf("unknown device type: %q", dev.Type)
		}

		fmt.Fprintf(w, "(%d) with your device named %q\t(%s)\n", i+1, dev.Name, req)
		optcount++
	}

	if arg.HasPGP {
		fmt.Fprintf(w, "(%d) using PGP\t(requires access to your PGP key)\n", optcount+1)
		optcount++
	}

	if arg.HasPaperBackupKey {
		fmt.Fprintf(w, "(%d) using a paper backup key\t(that you wrote down during signup/login)\n", optcount+1)
		optcount++
	}

	w.Flush()

	ret, err := PromptSelectionOrCancel(PromptDescriptorLocksmithSigningOption, d.parent, "Choose a signing option", 1, optcount)
	if err != nil {
		if err == ErrInputCanceled {
			res.Action = keybase1.SelectSignerAction_CANCEL
			return res, nil
		}
		return res, err
	}

	res.Action = keybase1.SelectSignerAction_SIGN
	res.Signer = &keybase1.DeviceSigner{}
	if ret <= len(arg.Devices) {
		res.Signer.Kind = keybase1.DeviceSignerKind_DEVICE
		res.Signer.DeviceID = &(arg.Devices[ret-1].DeviceID)
		res.Signer.DeviceName = &(arg.Devices[ret-1].Name)
	} else if ret == len(arg.Devices)+1 {
		if arg.HasPGP {
			res.Signer.Kind = keybase1.DeviceSignerKind_PGP
		} else {
			res.Signer.Kind = keybase1.DeviceSignerKind_PAPER_BACKUP_KEY
		}
	} else if ret == len(arg.Devices)+2 {
		res.Signer.Kind = keybase1.DeviceSignerKind_PAPER_BACKUP_KEY
	}

	return res, nil
}

func (d LocksmithUI) DeviceSignAttemptErr(_ context.Context, arg keybase1.DeviceSignAttemptErrArg) error {
	return nil
}

func (d LocksmithUI) DisplaySecretWords(_ context.Context, arg keybase1.DisplaySecretWordsArg) error {
	d.parent.Printf("\nUsing the terminal at %q, type this:\n\n", arg.DeviceNameExisting)
	d.parent.Printf("\tkeybase device add \"%s\"\n\n", arg.Secret)
	return nil
}

func (d LocksmithUI) KexStatus(_ context.Context, arg keybase1.KexStatusArg) error {
	G.Log.Debug("kex status: %s (%d)", arg.Msg, arg.Code)
	return nil
}

func (d LocksmithUI) DisplayProvisionSuccess(_ context.Context, arg keybase1.DisplayProvisionSuccessArg) error {

	d.parent.Printf(CHECK + " Success! You are logged in as " + ColorString("bold", arg.Username) + "\n")
	// turn on when kbfs active:
	if false {
		d.parent.Printf("  - your keybase public directory is available at /keybase/public/%s\n", arg.Username)
		d.parent.Printf("  - your keybase encrypted directory is available at /keybase/private/%s\n", arg.Username)
	}

	d.parent.Printf("  - type `keybase help` for more info.\n")
	return nil
}

//============================================================

type LoginUI struct {
	parent   libkb.TerminalUI
	noPrompt bool
}

func NewLoginUI(t libkb.TerminalUI, noPrompt bool) LoginUI {
	return LoginUI{t, noPrompt}
}

func (l LoginUI) GetEmailOrUsername(_ context.Context, _ int) (string, error) {
	return PromptWithChecker(PromptDescriptorLoginUsername, l.parent, "Your keybase username or email", false,
		libkb.CheckEmailOrUsername)
}

func (l LoginUI) PromptRevokePaperKeys(_ context.Context, arg keybase1.PromptRevokePaperKeysArg) (bool, error) {
	if l.noPrompt {
		return false, nil
	}
	// doing this here because there is currently no way for the daemon to do
	// a simple printf to the client, just via UI interfaces.
	// If we add something later, then we can move this.
	if arg.Index == 0 {
		l.parent.Printf("Generating a new paper key.\n")
	}
	prompt := fmt.Sprintf("Also revoke existing paper key \"%s...\" ?", arg.Device.Name)

	// XXX not sure if we need to support our existing paper keys, but without this
	// someone is surely going to complain:
	if strings.HasPrefix(arg.Device.Name, "Paper Key") {
		prompt = fmt.Sprintf("Also revoke existing %q ?", arg.Device.Name)
	}

	return l.parent.PromptYesNo(PromptDescriptorRevokePaperKeys, prompt, libkb.PromptDefaultNo)
}

func (l LoginUI) DisplayPaperKeyPhrase(_ context.Context, arg keybase1.DisplayPaperKeyPhraseArg) error {
	if l.noPrompt {
		return nil
	}
	l.parent.Printf("Here is your secret paper key phrase:\n\n")
	l.parent.Printf("\t%s\n\n", arg.Phrase)
	l.parent.Printf("Write it down and keep somewhere safe.\n")
	return nil
}

func (l LoginUI) DisplayPrimaryPaperKey(_ context.Context, arg keybase1.DisplayPrimaryPaperKeyArg) error {
	if l.noPrompt {
		return nil
	}
	l.parent.Printf("\n")
	l.parent.Printf("===============================\n")
	l.parent.Printf("IMPORTANT: PAPER KEY GENERATION\n")
	l.parent.Printf("===============================\n\n")
	l.parent.Printf("During Keybase's alpha, everyone gets a paper key. This is a private key.\n")
	l.parent.Printf("  1. you must write it down\n")
	l.parent.Printf("  2. the first two words are a public label\n")
	l.parent.Printf("  3. it can be used to recover data\n")
	l.parent.Printf("  4. it can provision new keys/devices, so put it in your wallet\n")
	l.parent.Printf("  5. just like any other device, it'll be revokable/replaceable if you lose it\n\n")
	l.parent.Printf("Your paper key is\n\n")
	l.parent.Printf("\t%s\n\n", arg.Phrase)
	l.parent.Printf("Write it down....now!\n\n")

	confirmed, err := l.parent.PromptYesNo(PromptDescriptorLoginWritePaper, "Have you written down the above paper key?", libkb.PromptDefaultNo)
	if err != nil {
		return err
	}
	for !confirmed {
		l.parent.Printf("\nPlease write down your paper key\n\n")
		l.parent.Printf("\t%s\n\n", arg.Phrase)
		confirmed, err = l.parent.PromptYesNo(PromptDescriptorLoginWritePaper, "Now have you written it down?", libkb.PromptDefaultNo)
		if err != nil {
			return err
		}
	}

	confirmed, err = l.parent.PromptYesNo(PromptDescriptorLoginWallet, "Excellent! Is it in your wallet?", libkb.PromptDefaultNo)
	if err != nil {
		return err
	}
	for !confirmed {
		l.parent.Printf("\nPlease put it in your wallet.\n\n")
		confirmed, err = l.parent.PromptYesNo(PromptDescriptorLoginWallet, "Now is it in your wallet?", libkb.PromptDefaultNo)
		if err != nil {
			return err
		}
	}
	return nil
}

type SecretUI struct {
	parent *UI
}

func (ui SecretUI) GetSecret(pinentry keybase1.SecretEntryArg, term *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	return ui.parent.SecretEntry.Get(pinentry, term, ui.parent)
}

func (ui *UI) Configure() error {
	t, err := NewTerminal()
	if err != nil {
		// XXX this is only temporary so that SecretEntry will still work
		// when this is run without a terminal.
		ui.SecretEntry = NewSecretEntry(nil)
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

		arg.TerminalPrompt = arg.TerminalPrompt + " [confirm]"
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

func (ui SecretUI) GetPaperKeyPassphrase(arg keybase1.GetPaperKeyPassphraseArg) (text string, err error) {
	desc := fmt.Sprintf("Please enter a paper backup key passphrase for %s", arg.Username)
	text, _, err = ui.ppprompt(libkb.PromptArg{
		TerminalPrompt: "paper backup key passphrase",
		PinentryPrompt: "Paper backup key passphrase",
		PinentryDesc:   desc,
		Checker:        &libkb.CheckPassphraseSimple,
		RetryMessage:   "",
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

func (ui *UI) PromptPassword(_ libkb.PromptDescriptor, s string) (string, error) {
	if ui.Terminal == nil {
		return "", NoTerminalError{}
	}
	return ui.Terminal.PromptPassword(s)
}

func (ui *UI) Prompt(_ libkb.PromptDescriptor, s string) (string, error) {
	if ui.Terminal == nil {
		return "", NoTerminalError{}
	}
	return ui.Terminal.Prompt(s)
}

func PromptWithChecker(pd libkb.PromptDescriptor, ui libkb.TerminalUI, prompt string, password bool, checker libkb.Checker) (string, error) {
	var prompter func(string) (string, error)

	if ui == nil {
		return "", NoTerminalError{}
	}

	if password {
		prompter = func(s string) (string, error) {
			return ui.PromptPassword(pd, s)
		}
	} else {
		prompter = func(s string) (string, error) {
			return ui.Prompt(pd, s)
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

// GetTerminalUI returns the main client UI, which happens to be a terminal UI
func (ui *UI) GetTerminalUI() libkb.TerminalUI { return ui }

func (ui *UI) PromptYesNo(_ libkb.PromptDescriptor, p string, def libkb.PromptDefault) (ret bool, err error) {
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
	err = NewPrompter([]*Field{field}, ui.GetTerminalUI()).Run()
	if p := field.Value; p == nil {
		err = ErrInputCanceled
	} else {
		ret, err = strconv.Atoi(*p)
	}
	return
}

func PromptSelectionOrCancel(pd libkb.PromptDescriptor, ui libkb.TerminalUI, prompt string, low, hi int) (ret int, err error) {
	field := &Field{
		Name:   "selection",
		Prompt: prompt,
		Checker: &libkb.Checker{
			F: func(s string) bool {
				if s == "q" {
					return true
				}
				v, e := strconv.Atoi(s)
				return (e == nil && v >= low && v <= hi)
			},
			Hint: fmt.Sprintf("%d-%d, or q to cancel", low, hi),
		},
		PromptDescriptor: pd,
	}
	err = NewPrompter([]*Field{field}, ui).Run()
	if p := field.Value; p == nil || *p == "q" {
		err = ErrInputCanceled
	} else {
		ret, err = strconv.Atoi(*p)
	}
	return
}

func (ui *UI) Tablify(headings []string, rowfunc func() []string) {
	libkb.Tablify(ui.OutputWriter(), headings, rowfunc)
}

func (ui *UI) NewTabWriter(minwidth, tabwidth, padding int, padchar byte, flags uint) *tabwriter.Writer {
	return tabwriter.NewWriter(ui.OutputWriter(), minwidth, tabwidth, padding, padchar, flags)
}

func (ui *UI) DefaultTabWriter() *tabwriter.Writer {
	return ui.NewTabWriter(5, 0, 3, ' ', 0)
}

func (ui *UI) Output(s string) error {
	_, err := ui.OutputWriter().Write([]byte(s))
	return err
}

func (ui *UI) OutputWriter() io.Writer {
	return os.Stdout
}

func (ui *UI) Printf(format string, a ...interface{}) (n int, err error) {
	return fmt.Fprintf(ui.OutputWriter(), format, a...)
}

func (ui *UI) Println(a ...interface{}) (int, error) {
	return fmt.Fprintln(ui.OutputWriter(), a...)
}

//=====================================================
