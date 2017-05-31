// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"

	"golang.org/x/net/context"

	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/spotty"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type UI struct {
	libkb.Contextified
	Terminal    *Terminal
	SecretEntry *SecretEntry

	// ttyMutex protects the TTY variable, which may be accessed from
	// multiple goroutines
	ttyMutex sync.Mutex
	tty      *string
}

// The UI class also fulfills the TerminalUI interface from libkb
var _ libkb.TerminalUI = (*UI)(nil)

type BaseIdentifyUI struct {
	libkb.Contextified
	parent *UI
}

func (ui BaseIdentifyUI) DisplayUserCard(keybase1.UserCard) error {
	return nil
}

type IdentifyUI struct {
	BaseIdentifyUI
}

func (ui BaseIdentifyUI) Start(username string, reason keybase1.IdentifyReason, forceDisplay bool) error {
	msg := "Identifying "
	switch reason.Type {
	case keybase1.IdentifyReasonType_TRACK:
		msg = "Generating follower statement for "
	case keybase1.IdentifyReasonType_ENCRYPT:
		msg = "Identifying recipient "
	case keybase1.IdentifyReasonType_DECRYPT:
		ui.G().Log.Info("Message authored by " + ColorString("bold", username) + "; identifying...")
		return nil
	}
	ui.G().Log.Info(msg + ColorString("bold", username))
	return nil
}

func (ui BaseIdentifyUI) DisplayTrackStatement(stmt string) error {
	return ui.parent.Output(stmt)
}

func (ui BaseIdentifyUI) ReportTrackToken(_ keybase1.TrackToken) error {
	return nil
}

func (ui BaseIdentifyUI) Cancel() error {
	return nil
}

func (ui BaseIdentifyUI) Finish() error {
	return nil
}

func (ui BaseIdentifyUI) Dismiss(_ string, _ keybase1.DismissReason) error {
	return nil
}

func (ui BaseIdentifyUI) Confirm(o *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	warnings := libkb.ImportWarnings(o.Warnings)
	if !warnings.IsEmpty() {
		ui.ShowWarnings(warnings)
	}

	if o.TrackOptions.BypassConfirm {
		return keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}, nil
	}

	if len(o.Revoked) > 0 {
		ui.ReportRevoked(o.Revoked)
		ui.G().ExitCode = keybase1.ExitCode_NOTOK
	}

	return keybase1.ConfirmResult{IdentityConfirmed: false, RemoteConfirmed: false}, nil
}

func (ui BaseIdentifyUI) LaunchNetworkChecks(i *keybase1.Identity, u *keybase1.User) error {
	return nil
}

func (ui BaseIdentifyUI) ReportRevoked(del []keybase1.TrackDiff) {
	if len(del) == 0 {
		return
	}
	ui.G().Log.Warning("Some proofs were revoked:")
	for _, d := range del {
		ui.ReportHook(BADX + " " + trackDiffToColoredString(d))
	}
}

func (ui BaseIdentifyUI) DisplayTLFCreateWithInvite(arg keybase1.DisplayTLFCreateWithInviteArg) error {
	// this will only happen via `keybase favorite add` w/ no gui running:
	if arg.IsPrivate {
		ui.parent.Printf("Success! You created a private folder with %s\n", arg.Assertion)
	} else {
		ui.parent.Printf("Success! You created a public folder with %s\n", arg.Assertion)
	}
	if arg.Throttled {
		ui.parent.Printf("Since you are out of invites, %s will need to request an invitation on keybase.io\n", arg.Assertion)
	} else {
		ui.parent.Printf("Here's an invitation link you can send to %s:\n", arg.Assertion)
		ui.parent.Printf("\n   %s\n\nWith this link, they will be able to sign up immediately.\n", arg.InviteLink)
	}

	return nil
}

type IdentifyTrackUI struct {
	BaseIdentifyUI
}

func (ui IdentifyTrackUI) confirmFailedTrackProofs(o *keybase1.IdentifyOutcome) (result keybase1.ConfirmResult, err error) {

	ignorePrompt := ""
	inputChecker := libkb.CheckMember{Set: []string{"A", "C"}}

	// Status should be either keybase1.TrackStatus_UPDATE_BROKEN_REVOKED or keybase1.TrackStatus_UPDATE_BROKEN_FAILED_PROOFS here
	if o.TrackStatus == keybase1.TrackStatus_UPDATE_BROKEN_FAILED_PROOFS {
		trackMaxAge := fmt.Sprintf("%v", ui.G().Env.GetLocalTrackMaxAge())
		ignorePrompt = "[I]gnore for " + trackMaxAge + ", "
		inputChecker.Set = append(inputChecker.Set, "I")
	}

	prompt := "Some proofs are failing. " + ignorePrompt + "[A]ccept these changes or [C]ancel?"

	choice, err := PromptWithChecker(PromptDescriptorTrackPublic, ui.parent, prompt, false, inputChecker.Checker())
	if libkb.Cicmp(choice, "C") {
		err = ErrInputCanceled
	}
	if err != nil {
		return
	}

	result.IdentityConfirmed = true

	if libkb.Cicmp(choice, "I") {
		result.ExpiringLocal = true
		return
	}

	// This means they accepted
	if !o.TrackOptions.LocalOnly {
		// If we want to track remote, lets confirm (unless bypassing)
		if o.TrackOptions.BypassConfirm {
			result.RemoteConfirmed = true
			return
		}
		prompt = "Publish these changes publicly to keybase.io?"
		if result.RemoteConfirmed, err = ui.parent.PromptYesNo(PromptDescriptorTrackAction, prompt, libkb.PromptDefaultYes); err != nil {
			return
		}
	}
	return
}

func (ui IdentifyTrackUI) Confirm(o *keybase1.IdentifyOutcome) (result keybase1.ConfirmResult, err error) {
	var prompt string
	username := o.Username

	// Whether we used a tracking statement when checking the identity
	// this time...
	tracked := o.TrackUsed != nil
	trackedRemote := tracked && o.TrackUsed.IsRemote

	// If we are tracking remotely, and we we're asked to track local only then error.
	if trackedRemote && o.TrackOptions.LocalOnly {
		err = fmt.Errorf("Can't locally follow if you are already following remotely")
		return
	}

	ui.ReportRevoked(o.Revoked)

	promptDefault := libkb.PromptDefaultYes
	trackChanged := true
	switch o.TrackStatus {
	case keybase1.TrackStatus_UPDATE_BROKEN_REVOKED, keybase1.TrackStatus_UPDATE_BROKEN_FAILED_PROOFS:
		return ui.confirmFailedTrackProofs(o)
	case keybase1.TrackStatus_UPDATE_NEW_PROOFS:
		prompt = "Your view of " + username +
			" is still valid; update it to reflect new proofs?"
		promptDefault = libkb.PromptDefaultYes
	case keybase1.TrackStatus_UPDATE_OK:
		ui.G().Log.Info("Your view is up-to-date")
		trackChanged = false
	case keybase1.TrackStatus_NEW_ZERO_PROOFS:
		prompt = "We found an account for " + username +
			", but they haven't proven their identity. Still follow them?"
		promptDefault = libkb.PromptDefaultNo
	case keybase1.TrackStatus_NEW_FAIL_PROOFS:
		verb := "follow"
		if o.TrackOptions.ForPGPPull {
			verb = "pull PGP key for"
		}
		prompt = "Some proofs failed; still " + verb + " " + username + "?"
		promptDefault = libkb.PromptDefaultNo
	default:
		prompt = "Is this the " + ColorString("bold", username) + " you wanted?"
		promptDefault = libkb.PromptDefaultYes
	}

	// Tracking statement exists and is unchanged, nothing to do
	if !trackChanged {
		result.IdentityConfirmed = true
		return
	}

	// Tracking statement doesn't exist or changed, lets prompt them with the details
	if o.TrackOptions.BypassConfirm && promptDefault == libkb.PromptDefaultYes {
		result.IdentityConfirmed = true
		result.AutoConfirmed = true
		ui.G().Log.Info("Identity auto-confirmed via command-line flag")
	} else {
		if result.IdentityConfirmed, err = ui.parent.PromptYesNo(PromptDescriptorTrackAction, prompt, promptDefault); err != nil {
			return
		}
	}

	if !result.IdentityConfirmed {
		return
	}

	// If we want to track remote, lets confirm (unless bypassing)
	if !o.TrackOptions.LocalOnly {
		if o.TrackOptions.BypassConfirm {
			result.RemoteConfirmed = true
			result.AutoConfirmed = true
			ui.G().Log.Info("User auto-remote-followed via command-line flag")
			return
		}
		prompt = "Publicly follow?"
		if result.RemoteConfirmed, err = ui.parent.PromptYesNo(PromptDescriptorTrackPublic, prompt, promptDefault); err != nil {
			return
		}
	}
	return
}

func (ui BaseIdentifyUI) ReportHook(s string) {
	ui.parent.ErrorWriter().Write([]byte(s + "\n"))
}

func (ui BaseIdentifyUI) ShowWarnings(w libkb.Warnings) {
	w.Warn(ui.G())
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

func (w LinkCheckResultWrapper) GetTmpTrackExpireTime() time.Time {
	return keybase1.FromTime(w.lcr.TmpTrackExpireTime)
}

func (w LinkCheckResultWrapper) GetTorWarning() bool {
	return w.lcr.TorWarning
}

func (w LinkCheckResultWrapper) GetError() error {
	return libkb.ImportProofError(w.lcr.ProofResult)
}

func (w LinkCheckResultWrapper) GetSnoozedError() error {
	return libkb.ImportProofError(w.lcr.SnoozedResult)
}

func (w LinkCheckResultWrapper) GetBreaksTrackingMark() string {
	if w.lcr.BreaksTracking {
		return BADX
	}
	return CHECK
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

func (w LinkCheckResultWrapper) GetCachedMsg() string {
	var msg string
	if w.GetDiff() != nil && w.GetDiff().Type == keybase1.TrackDiffType_NONE_VIA_TEMPORARY {
		msg = "failure temporarily ignored until " + libkb.FormatTime(w.GetTmpTrackExpireTime())
	} else if o := w.lcr.Cached; o != nil {
		fresh := (o.Freshness == keybase1.CheckResultFreshness_FRESH)
		snze := w.GetSnoozedError()
		snoozed := (o.Freshness == keybase1.CheckResultFreshness_AGED && snze != nil)
		if fresh || snoozed {
			tm := keybase1.FromTime(o.Time)
			msg = "cached " + libkb.FormatTime(tm)
		}
		if snoozed {
			msg += "; but got a retryable error (" + snze.Error() + ") this time around"
		}
	}
	if len(msg) > 0 {
		msg = "[" + msg + "]"

	}
	return msg
}

func (ui BaseIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	var msg, lcrs string

	s := RemoteProofWrapper{p}
	lcr := LinkCheckResultWrapper{l}

	if diff := lcr.GetDiff(); diff != nil {
		lcrs = trackDiffToColoredString(*diff) + " "
	}
	run := s.GetRemoteUsername()
	mark := lcr.GetBreaksTrackingMark()

	if err := lcr.GetError(); err == nil {
		color := "green"
		if lcr.GetSnoozedError() != nil {
			color = "yellow"
		}
		msg += (mark + " " + lcrs + `"` +
			ColorString(color, run) + `" on ` + s.GetService() +
			": " + lcr.GetHint().GetHumanURL())
	} else {
		msg += (mark + " " + lcrs +
			ColorString("red", `"`+run+`" on `+s.GetService()+" "+
				ColorString("bold", "failed")+": "+
				err.Error()))
	}
	if cachedMsg := lcr.GetCachedMsg(); len(cachedMsg) > 0 {
		msg += " " + ColorString("magenta", cachedMsg)
	}
	ui.ReportHook(msg)

	return nil
}

func trackDiffToColor(typ keybase1.TrackDiffType) string {
	var color string
	switch typ {
	case keybase1.TrackDiffType_ERROR, keybase1.TrackDiffType_CLASH, keybase1.TrackDiffType_REVOKED, keybase1.TrackDiffType_NEW_ELDEST:
		color = "red"
	case keybase1.TrackDiffType_UPGRADED:
		color = "orange"
	case keybase1.TrackDiffType_NEW, keybase1.TrackDiffType_NONE_VIA_TEMPORARY:
		color = "blue"
	case keybase1.TrackDiffType_NONE:
		color = "green"
	}
	return color
}

func trackDiffToColoredString(t keybase1.TrackDiff) string {
	s := "<" + t.DisplayMarkup + ">"
	if color := trackDiffToColor(t.Type); len(color) > 0 {
		s = ColorString(color, s)
	}
	return s
}

func (ui BaseIdentifyUI) TrackDiffUpgradedToString(t libkb.TrackDiffUpgraded) string {
	return ColorString("orange", "<Upgraded from "+t.GetPrev()+" to "+t.GetCurr()+">")
}

func (ui BaseIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	var msg, lcrs string

	s := RemoteProofWrapper{p}
	lcr := LinkCheckResultWrapper{l}

	if diff := lcr.GetDiff(); diff != nil {
		lcrs = trackDiffToColoredString(*diff) + " "
	}

	mark := lcr.GetBreaksTrackingMark()

	greatColor := "green"
	okColor := "yellow"

	if err := lcr.GetError(); err == nil {
		torWarning := ""
		if lcr.GetTorWarning() {
			okColor = "red"
			torWarning = ", " + ColorString("bold", "but the result isn't reliable over Tor")
		}

		if s.GetProtocol() == "dns" {
			msg += (mark + " " + lcrs + "admin of " +
				ColorString(okColor, "DNS") + " zone " +
				ColorString(okColor, s.GetDomain()) + torWarning +
				": found TXT entry " + lcr.GetHint().GetCheckText())
		} else {
			var color string
			if s.GetProtocol() == "https" {
				color = greatColor
			} else {
				color = okColor
			}
			msg += (mark + " " + lcrs + "admin of " +
				ColorString(color, s.GetHostname()) + " via " +
				ColorString(color, strings.ToUpper(s.GetProtocol())) + torWarning +
				": " + lcr.GetHint().GetHumanURL())
		}
	} else {
		msg = (mark + " " + lcrs +
			ColorString("red", "Proof for "+s.ToDisplayString()+" "+
				ColorString("bold", "failed")+": "+
				lcr.GetError().Error()))
	}

	if cachedMsg := lcr.GetCachedMsg(); len(cachedMsg) > 0 {
		msg += " " + ColorString("magenta", cachedMsg)
	}
	ui.ReportHook(msg)

	return nil
}

func (ui BaseIdentifyUI) DisplayCryptocurrency(l keybase1.Cryptocurrency) error {
	msg := (BTC + " " + " " + l.Family + " " + ColorString("green", l.Address))
	ui.ReportHook(msg)
	return nil
}

func (ui BaseIdentifyUI) DisplayKey(key keybase1.IdentifyKey) error {
	var fpq string
	if fp := libkb.ImportPGPFingerprintSlice(key.PGPFingerprint); fp != nil {
		fpq = fp.ToQuads()
	}
	if key.TrackDiff != nil {
		mark := CHECK
		if key.TrackDiff.Type == keybase1.TrackDiffType_NEW_ELDEST || key.TrackDiff.Type == keybase1.TrackDiffType_REVOKED {
			mark = BADX
		}
		msg := mark + " " + trackDiffToColoredString(*key.TrackDiff)
		if len(fpq) > 0 {
			msg += " " + ColorString(trackDiffToColor(key.TrackDiff.Type), "public key fingerprint: "+fpq)
		}
		ui.ReportHook(msg)
	} else if len(fpq) > 0 {
		msg := CHECK + " " + ColorString("green", "public key fingerprint: "+fpq)
		ui.ReportHook(msg)
	}

	return nil
}

func (ui BaseIdentifyUI) ReportLastTrack(tl *keybase1.TrackSummary) error {
	if t := libkb.ImportTrackSummary(tl); t != nil {
		locally := ""
		if !t.IsRemote() {
			locally += "locally "
		}
		msg := ColorString("bold", fmt.Sprintf("You last %sfollowed %s on %s",
			locally, t.Username(), libkb.FormatTime(t.GetCTime())))
		ui.ReportHook(msg)
	}

	return nil
}

func (ui BaseIdentifyUI) Warning(m string) {
	ui.G().Log.Warning(m)
}

func (ui *UI) GetIdentifyTrackUI() libkb.IdentifyUI {
	return &IdentifyTrackUI{
		BaseIdentifyUI: BaseIdentifyUI{
			Contextified: libkb.NewContextified(ui.G()),
			parent:       ui,
		},
	}
}

func (ui *UI) GetIdentifyUI() libkb.IdentifyUI {
	return &IdentifyUI{
		BaseIdentifyUI{
			Contextified: libkb.NewContextified(ui.G()),
			parent:       ui,
		},
	}
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
	return ui.G().Log
}

func (ui *UI) getTTY() string {
	ui.ttyMutex.Lock()
	defer ui.ttyMutex.Unlock()

	if ui.tty == nil {
		tty, err := spotty.Discover()
		if err != nil {
			ui.GetLogUI().Notice("Error in looking up TTY for GPG: %s", err.Error())
		} else if tty != "" {
			ui.GetLogUI().Debug("Setting GPG_TTY to %s", tty)
		} else {
			ui.GetLogUI().Debug("Can't set GPG_TTY; discover failed")
		}
		ui.tty = &tty
	}
	ret := *ui.tty

	return ret
}

func (ui *UI) GetGPGUI() libkb.GPGUI {
	return NewGPGUI(ui.G(), ui.GetTerminalUI(), false, ui.getTTY())
}

func (ui *UI) GetProvisionUI(role libkb.KexRole) libkb.ProvisionUI {
	return ProvisionUI{parent: ui, role: role}
}

func (ui *UI) GetPgpUI() libkb.PgpUI {
	// PGPUI goes to stderr so it doesn't munge up stdout
	return PgpUI{w: ui.ErrorWriter()}
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
		// Whitespace is trimmed from proof text before it gets here.
		p.parent.Output("\n" + arg.Proof + "\n\n")
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

type LoginUI struct {
	parent   libkb.TerminalUI
	noPrompt bool
}

func NewLoginUI(t libkb.TerminalUI, noPrompt bool) LoginUI {
	return LoginUI{t, noPrompt}
}

func (l LoginUI) GetEmailOrUsername(_ context.Context, _ int) (string, error) {
	return PromptWithChecker(PromptDescriptorLoginUsername, l.parent, "Your keybase username or email address", false,
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
		l.parent.Printf("Paper key: ")
		l.parent.OutputDesc(OutputDescriptorPrimaryPaperKey, arg.Phrase)
		l.parent.Printf("\n")
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
	l.parent.Printf("\t")
	l.parent.OutputDesc(OutputDescriptorPrimaryPaperKey, arg.Phrase)
	l.parent.Printf("\n\n")
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

func (ui SecretUI) getSecret(pinentry keybase1.SecretEntryArg, term *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	return ui.parent.SecretEntry.Get(pinentry, term, ui.parent.ErrorWriter())
}

func (ui *UI) Configure() error {
	t, err := NewTerminal(ui.G())
	if err != nil {
		// XXX this is only temporary so that SecretEntry will still work
		// when this is run without a terminal.
		ui.SecretEntry = NewSecretEntry(ui.G(), nil, "")
		return err
	}
	ui.Terminal = t
	ui.SecretEntry = NewSecretEntry(ui.G(), ui.Terminal, ui.getTTY())
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

func (ui SecretUI) GetPassphrase(pin keybase1.GUIEntryArg, term *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	res.Passphrase, res.StoreSecret, err = ui.passphrasePrompt(libkb.PromptArg{
		TerminalPrompt: pin.Prompt,
		PinentryPrompt: pin.WindowTitle,
		PinentryDesc:   pin.Prompt,
		Checker:        &libkb.CheckPassphraseSimple,
		RetryMessage:   pin.RetryLabel,
		ShowTyping:     pin.Features.ShowTyping.DefaultValue,
	})
	return res, err
}

func (ui SecretUI) passphrasePrompt(arg libkb.PromptArg) (text string, storeSecret bool, err error) {

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

		res, err = ui.getSecret(keybase1.SecretEntryArg{
			Err:        emp,
			Desc:       arg.PinentryDesc,
			Prompt:     arg.PinentryPrompt,
			ShowTyping: arg.ShowTyping,
		}, &keybase1.SecretEntryArg{
			Err:        emt,
			Prompt:     tp,
			ShowTyping: arg.ShowTyping,
		})

		if err == nil && res.Canceled {
			err = libkb.InputCanceledError{}
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
	if strings.ToLower(res) != "yes" {
		return NotConfirmedError{}
	}
	return nil

}

func sentencePunctuate(s string) string {
	return strings.ToUpper(s[0:1]) + s[1:] + "."
}

// GetTerminalUI returns the main client UI, which happens to be a terminal UI
func (ui *UI) GetTerminalUI() libkb.TerminalUI { return ui }

// GetDumbOutput returns the main client UI, which happens to also be a
// dumb output UI too.
func (ui *UI) GetDumbOutputUI() libkb.DumbOutputUI { return ui }

func (ui *UI) PromptYesNo(_ libkb.PromptDescriptor, p string, def libkb.PromptDefault) (ret bool, err error) {
	return ui.Terminal.PromptYesNo(p, def)
}

var ErrInputCanceled libkb.InputCanceledError

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
	if err != nil {
		return -1, err
	}
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
	if err != nil {
		return -1, err
	}
	if p := field.Value; p == nil || *p == "q" {
		err = ErrInputCanceled
	} else {
		ret, err = strconv.Atoi(*p)
	}
	return
}

func (ui *UI) TerminalSize() (width int, height int) {
	return ui.Terminal.GetSize()
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

func (ui *UI) OutputDesc(_ libkb.OutputDescriptor, s string) error {
	return ui.Output(s)
}

func (ui *UI) OutputWriter() io.Writer {
	return logger.OutputWriter()
}

func (ui *UI) ErrorWriter() io.Writer {
	return logger.ErrorWriter()
}

func (ui *UI) Printf(format string, a ...interface{}) (n int, err error) {
	return fmt.Fprintf(ui.OutputWriter(), format, a...)
}

func (ui *UI) Println(a ...interface{}) (int, error) {
	return fmt.Fprintln(ui.OutputWriter(), a...)
}

func (ui *UI) PrintfStderr(format string, a ...interface{}) (n int, err error) {
	return fmt.Fprintf(os.Stderr, format, a...)
}

//=====================================================

func NewLoginUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.LoginUiProtocol(g.UI.GetLoginUI())
}

//=====================================================
