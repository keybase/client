// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdSignup(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:  "signup",
		Usage: "Signup for a new account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdSignupRunner(g), "signup", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "c, invite-code",
				Usage: "Specify an invite code.",
			},
			cli.StringFlag{
				Name:  "email",
				Usage: "Specify an account email.",
			},
			cli.StringFlag{
				Name:  "username",
				Usage: "Specify a username.",
			},
			cli.BoolFlag{
				Name:  "no-email",
				Usage: "Do not signup with email.",
			},
			cli.BoolFlag{
				Name:  "set-password",
				Usage: "Ask for password (optional by default).",
			},
			cli.BoolFlag{
				Name:  "force",
				Usage: "(dangerous) Ignore any reasons not to signup right now",
			},
		},
	}

	cmd.Flags = append(cmd.Flags, restrictedSignupFlags...)
	return cmd
}

type PromptFields struct {
	email, code, username, passphraseRetry, deviceName *Field
}

func (pf PromptFields) ToList() []*Field {
	fields := []*Field{pf.email}
	if pf.code.Defval == "" {
		fields = append(fields, pf.code)
	}
	fields = append(fields, pf.username, pf.passphraseRetry, pf.deviceName)
	return fields
}

type CmdSignup struct {
	libkb.Contextified
	fields   *PromptFields
	prompter *Prompter

	scli               keybase1.SignupClient
	ccli               keybase1.ConfigClient
	code               string
	requestedInvite    bool
	fullname           string
	notes              string
	passphrase         string
	storeSecret        bool
	defaultEmail       string
	defaultUsername    string
	defaultPassphrase  string
	doPromptPassphrase bool
	noEmail            bool
	randomPassphrase   bool
	defaultDevice      string
	doPrompt           bool
	skipMail           bool
	genPGP             bool
	genPaper           bool
	force              bool

	// Test option to not call to requestInvitationCode for bypassing
	// invitation code.
	noInvitationCodeBypass bool
}

func NewCmdSignupRunner(g *libkb.GlobalContext) *CmdSignup {
	return &CmdSignup{
		Contextified: libkb.NewContextified(g),
		doPrompt:     true,
	}
}

func (s *CmdSignup) SetTest() {
	s.skipMail = true
	s.genPaper = true
	// Signup test users with passwords by default.
	s.doPromptPassphrase = true
}

func (s *CmdSignup) SetTestWithPaper(b bool) {
	s.skipMail = true
	s.genPaper = b
	// Signup test users with passwords by default.
	s.doPromptPassphrase = true
}

func (s *CmdSignup) SetNoPassphrasePrompt() {
	// Do not prompt for passphrase, for testing.
	s.doPromptPassphrase = false
}

func (s *CmdSignup) SetNoInvitationCodeBypass() {
	// This will result in deterministic invitation code prompt unless it's
	// been provided via command argument or env var. Otherwise prompt is
	// affected by whether API server allows us to skip invite code (see
	// requestInvitationCode).

	// Used in tests. If the test is checking prompts that occurred, it should
	// use this to avoid invitation code bypass behaviour that may differ
	// between testing environments.
	s.noInvitationCodeBypass = true
}

func (s *CmdSignup) SetNoEmail() {
	s.noEmail = true
}

func (s *CmdSignup) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())

	s.code = ctx.String("invite-code")
	if s.code == "" {
		// For development convenience.
		s.code = os.Getenv("KEYBASE_INVITATION_CODE")
	}

	s.defaultUsername = ctx.String("username")
	s.defaultPassphrase = ctx.String("passphrase")
	s.defaultDevice = ctx.String("device")
	if s.defaultDevice == "" {
		s.defaultDevice = "home computer"
	}
	// If using prompter mode (non-batch), we do not ask for password by
	// default and user is signing up in no-passphrase mode - that is unless
	// --set-password flag is used. Only then we are prompting for password.
	s.doPromptPassphrase = ctx.Bool("set-password")

	s.defaultEmail = ctx.String("email")
	s.noEmail = ctx.Bool("no-email")
	if (s.defaultEmail != "") && s.noEmail {
		return fmt.Errorf("cannot pass --no-email and non-empty --email")
	}

	s.force = ctx.Bool("force")

	if ctx.Bool("batch") {
		s.fields = &PromptFields{
			email:           &Field{Value: &s.defaultEmail},
			code:            &Field{Value: &s.code},
			username:        &Field{Value: &s.defaultUsername},
			deviceName:      &Field{Value: &s.defaultDevice},
			passphraseRetry: &Field{},
		}

		s.passphrase = s.defaultPassphrase
		s.genPGP = ctx.Bool("pgp")
		s.genPaper = true
		s.doPrompt = false
		s.storeSecret = true
		s.randomPassphrase = ctx.Bool("no-passphrase")
		if s.randomPassphrase && s.defaultPassphrase != "" {
			return fmt.Errorf("cannot pass both --no-passphrase and --passphrase")
		}
	} else {
		s.doPrompt = true
	}

	if nargs != 0 {
		err = BadArgsError{"Signup doesn't take arguments."}
	}
	return err
}

func (s *CmdSignup) successMessage() error {
	username := s.fields.username.GetValue()
	msg := fmt.Sprintf(`
Welcome to keybase.io!

   - you are now logged in as %s
   - your profile on keybase is https://keybase.io/%s
   - type 'keybase help' for more instructions

Found a bug? Please report it with %skeybase log send%s

Enjoy!
`, username, username, "`", "`")
	return s.G().UI.GetTerminalUI().Output(msg)
}

func (s *CmdSignup) Run() (err error) {
	s.G().Log.Debug("| Client mode")

	if err = s.initClient(); err != nil {
		return err
	}

	if !s.force {
		if err = s.checkRegistered(); err != nil {
			return err
		}
	}

	if s.code == "" && !s.noInvitationCodeBypass {
		// Eat the error here - we prompt the user in that case
		s.requestInvitationCode()
	}

	if err = s.trySignup(); err != nil {
		if _, cce := err.(CleanCancelError); cce {
			s.requestedInvite = true
			return s.requestInvite()
		}
		return err
	}

	s.successMessage()
	return nil
}

func (s *CmdSignup) checkRegistered() (err error) {

	s.G().Log.Debug("+ clientModeSignupEngine::CheckRegistered")
	defer s.G().Log.Debug("- clientModeSignupEngine::CheckRegistered -> %s", libkb.ErrToOk(err))

	var rres keybase1.CurrentStatus

	if rres, err = s.ccli.GetCurrentStatus(context.TODO(), 0); err != nil {
		return err
	}
	if !rres.Registered {
		return
	}

	err = ensureSetPassphraseFromRemote(libkb.NewMetaContextTODO(s.G()))
	if err != nil {
		return err
	}

	if !s.doPrompt {
		return nil
	}
	prompt := "Already registered; do you want to reregister?"
	if rereg, err := s.G().UI.GetTerminalUI().PromptYesNo(PromptDescriptorReregister, prompt, libkb.PromptDefaultNo); err != nil {
		return err
	} else if !rereg {
		return NotConfirmedError{}
	}
	return nil
}

func (s *CmdSignup) prompt() (err error) {
	s.G().Log.Debug("+ prompt")
	defer func() {
		s.G().Log.Debug("- prompt -> %s", libkb.ErrToOk(err))
	}()

	if !s.doPrompt {
		return nil
	}
	if s.prompter == nil {
		s.MakePrompter()
	}

	if err = s.prompter.Run(); err != nil {
		s.G().Log.Debug("| Prompter failed\n")
		return
	}

	if s.doPromptPassphrase {
		f := s.fields.passphraseRetry
		if f.Disabled || libkb.IsYes(f.GetValue()) {
			var res keybase1.GetPassphraseRes
			res, err = PromptPassphrase(s.G())
			if err != nil {
				return
			}
			s.passphrase = res.Passphrase
			s.storeSecret = res.StoreSecret
		}
	} else {
		s.randomPassphrase = true
	}

	return
}

func (s *CmdSignup) trySignup() (err error) {
	retry := true
	for retry && err == nil {
		if err = s.prompt(); err == nil {
			retry, err = s.runEngine()
		}
	}

	return err
}

func (s *CmdSignup) runEngine() (retry bool, err error) {
	if s.randomPassphrase && s.passphrase != "" {
		return false, fmt.Errorf("Requested random passphrase but passphrase was provided")
	}

	rarg := keybase1.SignupArg{
		Username:    s.fields.username.GetValue(),
		InviteCode:  s.fields.code.GetValue(),
		Passphrase:  s.passphrase,
		RandomPw:    s.randomPassphrase,
		StoreSecret: true,
		DeviceName:  s.fields.deviceName.GetValue(),
		DeviceType:  keybase1.DeviceType_DESKTOP,
		SkipMail:    s.skipMail,
		GenPGPBatch: s.genPGP,
		GenPaper:    s.genPaper,
	}
	if s.fields.email != nil {
		email := s.fields.email.GetValue()
		if email != "" {
			rarg.Email = email
		}
	}
	res, err := s.scli.Signup(context.TODO(), rarg)
	if err == nil {
		return false, nil
	}
	s.G().Log.Debug("error: %q, type: %T", err, err)
	// check to see if the error is a join engine run result:
	if res.PassphraseOk {
		s.fields.passphraseRetry.Disabled = false
	}
	if !res.PostOk {
		retry, err = s.handlePostError(err)
	}
	return retry, err
}

func (s *CmdSignup) requestInvitePromptForOk() (err error) {
	prompt := "Would you like to be added to the invite request list?"
	var invite bool
	if invite, err = s.G().UI.GetTerminalUI().PromptYesNo(PromptDescriptorInviteOK, prompt, libkb.PromptDefaultYes); err != nil {
		return err
	}
	if !invite {
		return NotConfirmedError{}
	}
	return nil
}

func (s *CmdSignup) requestInvitePromptForData() error {

	fullname := &Field{
		Name:             "fullname",
		Prompt:           "Your name",
		PromptDescriptor: PromptDescriptorSignupFullName,
	}
	notes := &Field{
		Name:             "notes",
		Prompt:           "Any comments for the team",
		PromptDescriptor: PromptDescriptorSignupNotes,
	}

	fields := []*Field{fullname, notes}
	prompter := NewPrompter(fields, s.G().UI.GetTerminalUI())
	if err := prompter.Run(); err != nil {
		return err
	}
	s.fullname = fullname.GetValue()
	s.notes = notes.GetValue()
	return nil
}

func (s *CmdSignup) requestInvite() error {
	if err := s.requestInvitePromptForOk(); err != nil {
		return err
	}
	if err := s.requestInvitePromptForData(); err != nil {
		return err
	}
	return s.postInviteRequest()
}

func (s *CmdSignup) MakePrompter() {
	code := &Field{
		Defval:           s.code,
		Name:             "code",
		Prompt:           "Your invite code",
		Checker:          &libkb.CheckInviteCode,
		PromptDescriptor: PromptDescriptorSignupCode,
	}

	if len(s.code) == 0 {
		code.Prompt += " (leave blank if you don't have one)"
		code.Thrower = func(k, v string) error {
			if len(v) == 0 {
				return CleanCancelError{}
			}
			return nil
		}
	} else {
		// we omit this prompt if populated
		code.Value = &s.code
	}

	passphraseRetry := &Field{
		Defval:           "n",
		Disabled:         true,
		Name:             "passphraseRetry",
		Checker:          &libkb.CheckYesNo,
		Prompt:           "Re-enter passphrase",
		PromptDescriptor: PromptDescriptorSignupReenterPassphrase,
	}

	email := &Field{
		Disabled:         s.noEmail,
		Defval:           s.defaultEmail,
		Name:             "email",
		Prompt:           "Your email address",
		Checker:          &libkb.CheckEmail,
		PromptDescriptor: PromptDescriptorSignupEmail,
	}

	username := &Field{
		Defval:           s.defaultUsername,
		Name:             "username",
		Prompt:           "Your desired username",
		Checker:          &libkb.CheckUsername,
		PromptDescriptor: PromptDescriptorSignupUsername,
	}

	deviceName := &Field{
		Defval:           s.defaultDevice,
		Name:             "devname",
		Prompt:           "A public name for this device",
		Checker:          &libkb.CheckDeviceName,
		PromptDescriptor: PromptDescriptorSignupDevice,
	}

	s.fields = &PromptFields{
		email:           email,
		code:            code,
		username:        username,
		passphraseRetry: passphraseRetry,
		deviceName:      deviceName,
	}

	s.prompter = NewPrompter(s.fields.ToList(), s.G().UI.GetTerminalUI())
}

func (s *CmdSignup) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}

func (s *CmdSignup) initClient() error {
	var err error
	if s.scli, err = GetSignupClient(s.G()); err != nil {
		return err
	}

	if s.ccli, err = GetConfigClient(s.G()); err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(s.G()),
	}
	if s.doPrompt {
		protocols = append(protocols, NewGPGUIProtocol(s.G()))
		protocols = append(protocols, NewLoginUIProtocol(s.G()))
	} else {
		gpgUI := s.G().UI.GetGPGUI().(GPGUI)
		gpgUI.noPrompt = true
		protocols = append(protocols, keybase1.GpgUiProtocol(gpgUI))

		loginUI := s.G().UI.GetLoginUI().(LoginUI)
		loginUI.noPrompt = true
		protocols = append(protocols, keybase1.LoginUiProtocol(loginUI))
	}
	return RegisterProtocolsWithContext(protocols, s.G())
}

func (s *CmdSignup) postInviteRequest() (err error) {
	rarg := keybase1.InviteRequestArg{
		Email:    s.fields.email.GetValue(),
		Fullname: s.fullname,
		Notes:    s.notes,
	}
	err = s.scli.InviteRequest(context.TODO(), rarg)
	if err == nil {
		s.G().Log.Info("Success! You're on our list, thanks for your interest.")
	}
	return
}

func (s *CmdSignup) requestInvitationCode() error {

	code, err := s.scli.GetInvitationCode(context.TODO(), 0)
	if err != nil {
		s.G().Log.Debug("Error getting new code: %v", err)
	} else {
		s.G().Log.Debug("Success! You got new code %s", code)
	}
	s.code = code
	return err
}

func (s *CmdSignup) handlePostError(inerr error) (retry bool, err error) {
	retry = false
	err = inerr
	if ase, ok := inerr.(libkb.AppStatusError); ok {
		switch ase.Name {
		case "BAD_SIGNUP_EMAIL_TAKEN":
			v := s.fields.email.Clear()
			s.G().Log.Errorf("Email address '%s' already taken", v)
			retry = true
			err = nil
		case "BAD_SIGNUP_USERNAME_RESERVED":
			v := s.fields.username.Clear()
			s.G().Log.Errorf("Username '%s' is reserved! Please email admin@keybase.io for more info.", v)
			retry = true
			err = nil
		case "BAD_SIGNUP_USERNAME_DELETED":
			v := s.fields.username.Clear()
			s.G().Log.Errorf("Username '%s' has been deleted.", v)
			retry = true
			err = nil
		case "BAD_SIGNUP_USERNAME_TAKEN", "BAD_SIGNUP_TEAM_NAME":
			v := s.fields.username.Clear()
			s.G().Log.Errorf("Username '%s' already taken", v)
			retry = true
			err = nil
		case "INPUT_ERROR":
			if ase.IsBadField("username") {
				v := s.fields.username.Clear()
				s.G().Log.Errorf("Username '%s' rejected by server", v)
				retry = true
				err = nil
			}
		case "BAD_INVITATION_CODE":
			v := s.fields.code.Clear()
			s.G().Log.Errorf("Bad invitation code '%s' given", v)
			retry = true
			err = nil
		}
	}

	if !s.doPrompt {
		retry = false
	}

	return
}
