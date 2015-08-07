package client

import (
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdSignup(cl *libcmdline.CommandLine) cli.Command {
	cmd := cli.Command{
		Name:        "signup",
		Usage:       "keybase signup [-c <code>]",
		Description: "signup for a new account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSignup{}, "signup", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "c, invite-code",
				Usage: "Specify an invite code",
			},
			cli.StringFlag{
				Name:  "email",
				Usage: "Specify an account email",
			},
		},
	}
	cmd.Flags = append(cmd.Flags, extraSignupFlags...)
	return cmd
}

type PromptFields struct {
	email, code, username, passphraseRetry, deviceName *Field
}

func (pf PromptFields) ToList() []*Field {
	return []*Field{pf.email, pf.code, pf.username, pf.passphraseRetry, pf.deviceName}
}

type CmdSignup struct {
	fields   *PromptFields
	prompter *Prompter

	scli              keybase1.SignupClient
	ccli              keybase1.ConfigClient
	code              string
	requestedInvite   bool
	fullname          string
	notes             string
	passphrase        string
	storeSecret       bool
	defaultEmail      string
	defaultUsername   string
	defaultPassphrase string
	defaultDevice     string
	doPrompt          bool
}

func (s *CmdSignup) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.code = ctx.String("invite-code")
	if s.code == "" {
		// For development convenience.
		s.code = os.Getenv("KEYBASE_INVITATION_CODE")
	}

	s.defaultEmail = ctx.String("email")

	s.defaultUsername = ctx.String("username")
	if s.defaultUsername == "" {
		cl := G.Env.GetCommandLine()
		s.defaultUsername = cl.GetUsername().String()
	}

	s.defaultPassphrase = ctx.String("passphrase")
	if s.defaultPassphrase == "" {
		s.defaultPassphrase = "home computer"
	}

	s.defaultDevice = ctx.String("device")
	if s.defaultDevice == "" {
		s.defaultDevice = "home computer"
	}

	if ctx.Bool("batch") {
		s.fields = &PromptFields{
			email:           &Field{Value: &s.defaultEmail},
			code:            &Field{Value: &s.code},
			username:        &Field{Value: &s.defaultUsername},
			deviceName:      &Field{Value: &s.defaultDevice},
			passphraseRetry: &Field{},
		}

		s.passphrase = s.defaultPassphrase
		s.prompter = NewPrompter(s.fields.ToList())
		s.doPrompt = false
	} else {
		s.doPrompt = true
	}

	if nargs != 0 {
		err = BadArgsError{"signup doesn't take arguments"}
	}
	return err
}

func (s *CmdSignup) successMessage() error {
	msg := `
Welcome to keybase.io!

    (need new instructions here...)

Enjoy!
`
	os.Stdout.Write([]byte(msg))
	return nil
}

func (s *CmdSignup) Run() (err error) {
	G.Log.Debug("| Client mode")

	if err = s.initClient(); err != nil {
		return err
	}

	if err = s.checkRegistered(); err != nil {
		return err
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

	G.Log.Debug("+ clientModeSignupEngine::CheckRegistered")
	defer G.Log.Debug("- clientModeSignupEngine::CheckRegistered -> %s", libkb.ErrToOk(err))

	var rres keybase1.GetCurrentStatusRes

	if rres, err = s.ccli.GetCurrentStatus(0); err != nil {
		return err
	}
	if !rres.Registered {
		return
	}

	prompt := "Already registered; do you want to reregister?"
	if rereg, err := GlobUI.PromptYesNo(prompt, PromptDefaultNo); err != nil {
		return err
	} else if !rereg {
		return NotConfirmedError{}
	}
	return nil
}

func (s *CmdSignup) prompt() (err error) {
	if !s.doPrompt {
		return nil
	}
	if s.prompter == nil {
		s.MakePrompter()
	}

	if err = s.prompter.Run(); err != nil {
		return
	}
	arg := keybase1.GetNewPassphraseArg{
		TerminalPrompt: "Pick a strong passphrase",
		PinentryDesc:   "Pick a strong passphrase (12+ characters)",
		PinentryPrompt: "Passphrase",
		UseSecretStore: libkb.HasSecretStore(),
	}

	f := s.fields.passphraseRetry
	if f.Disabled || libkb.IsYes(f.GetValue()) {
		var res keybase1.GetNewPassphraseRes
		res, err = GlobUI.GetSecretUI().GetNewPassphrase(arg)
		if err != nil {
			return
		}
		s.passphrase = res.Passphrase
		s.storeSecret = res.StoreSecret
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

	rarg := keybase1.SignupArg{
		Username:   s.fields.username.GetValue(),
		Email:      s.fields.email.GetValue(),
		InviteCode: s.fields.code.GetValue(),
		Passphrase: s.passphrase,
		DeviceName: s.fields.deviceName.GetValue(),
	}
	res, err := s.scli.Signup(rarg)
	if err == nil {
		return false, nil
	}
	G.Log.Debug("error: %q, type: %T", err, err)
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
	if invite, err = GlobUI.PromptYesNo(prompt, PromptDefaultYes); err != nil {
		return err
	}
	if !invite {
		return NotConfirmedError{}
	}
	return nil
}

func (s *CmdSignup) requestInvitePromptForData() error {

	fullname := &Field{
		Name:   "fullname",
		Prompt: "Your name",
	}
	notes := &Field{
		Name:   "notes",
		Prompt: "Any comments for the team",
	}

	fields := []*Field{fullname, notes}
	prompter := NewPrompter(fields)
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
		Defval:  s.code,
		Name:    "code",
		Prompt:  "Your invite code",
		Checker: &libkb.CheckInviteCode,
	}

	if len(s.code) == 0 {
		code.Prompt += " (leave blank if you don't have one)"
		code.Thrower = func(k, v string) error {
			if len(v) == 0 {
				return CleanCancelError{}
			}
			return nil
		}
	}

	passphraseRetry := &Field{
		Defval:   "n",
		Disabled: true,
		Name:     "passphraseRetry",
		Checker:  &libkb.CheckYesNo,
		Prompt:   "Reenter passphrase",
	}

	email := &Field{
		Defval:  s.defaultEmail,
		Name:    "email",
		Prompt:  "Your email address",
		Checker: &libkb.CheckEmail,
	}

	username := &Field{
		Defval:  s.defaultUsername,
		Name:    "username",
		Prompt:  "Your desired username",
		Checker: &libkb.CheckUsername,
	}

	deviceName := &Field{
		Defval:  s.defaultDevice,
		Name:    "devname",
		Prompt:  "A public name for this device",
		Checker: &libkb.CheckNotEmpty,
	}

	s.fields = &PromptFields{
		email:           email,
		code:            code,
		username:        username,
		passphraseRetry: passphraseRetry,
		deviceName:      deviceName,
	}

	s.prompter = NewPrompter(s.fields.ToList())
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
	if s.scli, err = GetSignupClient(); err != nil {
		return err
	}

	if s.ccli, err = GetConfigClient(); err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	if s.doPrompt {
		protocols = append(protocols, NewGPGUIProtocol())
	} else {
		ui := GlobUI.GetGPGUI().(GPGUI)
		ui.noPrompt = true
		protocols = append(protocols, keybase1.GpgUiProtocol(ui))
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	return nil
}

func (s *CmdSignup) postInviteRequest() (err error) {
	rarg := keybase1.InviteRequestArg{
		Email:    s.fields.email.GetValue(),
		Fullname: s.fullname,
		Notes:    s.notes,
	}
	err = s.scli.InviteRequest(rarg)
	if err == nil {
		G.Log.Info("Success! You're on our list, thanks for your interest.")
	}
	return
}

func (s *CmdSignup) handlePostError(inerr error) (retry bool, err error) {
	retry = false
	err = inerr
	if ase, ok := inerr.(libkb.AppStatusError); ok {
		switch ase.Name {
		case "BAD_SIGNUP_EMAIL_TAKEN":
			v := s.fields.email.Clear()
			G.Log.Errorf("Email address '%s' already taken", v)
			retry = true
			err = nil
		case "BAD_SIGNUP_USERNAME_TAKEN":
			v := s.fields.username.Clear()
			G.Log.Errorf("Username '%s' already taken", v)
			retry = true
			err = nil
		case "INPUT_ERROR":
			if ase.IsBadField("username") {
				v := s.fields.username.Clear()
				G.Log.Errorf("Username '%s' rejected by server", v)
				retry = true
				err = nil
			}
		case "BAD_INVITATION_CODE":
			v := s.fields.code.Clear()
			G.Log.Errorf("Bad invitation code '%s' given", v)
			retry = true
			err = nil
		}
	}

	if !s.doPrompt {
		retry = false
	}

	return
}
