package main

import (
	"os"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdSignup(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "signup",
		Usage:       "keybase signup [-c <code>]",
		Description: "signup for a new account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSignupState{}, "signup", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "c, invite-code",
				Usage: "Specify an invite code",
			},
		},
	}
}

type PromptFields struct {
	email, code, username, passphraseRetry, deviceName *Field
}

func (pf PromptFields) ToList() []*Field {
	return []*Field{pf.email, pf.code, pf.username, pf.passphraseRetry, pf.deviceName}
}

type signupProcess interface {
	CheckRegistered() error
	PostInviteRequest(libkb.InviteRequestArg) error
	Init() error
	SetArg(*engine.SignupEngineRunArg)
	engine.Engine
}

type CmdSignupState struct {
	engine   signupProcess
	fields   *PromptFields
	prompter *Prompter

	code            string
	requestedInvite bool
	fullname        string
	notes           string
	passphrase      string
}

func (s *CmdSignupState) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.code = ctx.String("invite-code")
	if s.code == "" {
		// For development convenience.
		s.code = os.Getenv("KEYBASE_INVITATION_CODE")
	}

	if nargs != 0 {
		err = BadArgsError{"signup doesn't take arguments"}
	}
	return err
}

func (s *CmdSignupState) SuccessMessage() error {
	msg := `
Welcome to keybase.io!

    (need new instructions here...)

Enjoy!
`
	os.Stdout.Write([]byte(msg))
	return nil
}

func (s *CmdSignupState) RunClient() error {
	G.Log.Debug("| Client mode")
	s.engine = &ClientModeSignupEngine{}
	return s.run()
}

func (s *CmdSignupState) Run() error {
	G.Log.Debug("| Standalone mode")
	// try to use the localdb right now instead of failing to use it later...
	if err := G.LocalDb.ForceOpen(); err != nil {
		return err
	}
	s.engine = engine.NewSignupEngine(nil)
	return s.run()
}

func (s *CmdSignupState) run() error {
	G.Log.Debug("+ CmdSignupState::Run")
	defer G.Log.Debug("- CmdSignupState::Run")

	err := s.runSignup()
	if err != nil {
		if _, cce := err.(CleanCancelError); cce {
			s.requestedInvite = true
			return s.RequestInvite()
		}
		return err
	}

	s.SuccessMessage()
	return nil
}

func (s *CmdSignupState) CheckRegistered() (err error) {
	if err = s.engine.CheckRegistered(); err == nil {
		return
	} else if _, ok := err.(libkb.AlreadyRegisteredError); !ok {
		return
	}
	prompt := "Already registered; do you want to reregister?"
	if rereg, err := G_UI.PromptYesNo(prompt, PromptDefaultNo); err != nil {
		return err
	} else if !rereg {
		return NotConfirmedError{}
	}
	return nil
}

func (s *CmdSignupState) Prompt() (err error) {
	if s.prompter == nil {
		s.MakePrompter()
	}

	if err = s.prompter.Run(); err != nil {
		return
	}
	arg := keybase_1.GetNewPassphraseArg{
		TerminalPrompt: "Pick a strong passphrase",
		PinentryDesc:   "Pick a strong passphrase (12+ characters)",
		PinentryPrompt: "Passphrase",
	}

	f := s.fields.passphraseRetry
	if f.Disabled || libkb.IsYes(f.GetValue()) {
		s.passphrase, err = G_UI.GetSecretUI().GetNewPassphrase(arg)
	}

	return
}

func (s *CmdSignupState) runSignup() (err error) {
	retry := true

	if err = s.engine.Init(); err == nil {
		err = s.CheckRegistered()
	}

	for retry && err == nil {
		if err = s.Prompt(); err == nil {
			retry, err = s.runEngine()
		}
	}

	return err
}

func (s *CmdSignupState) runEngine() (retry bool, err error) {
	arg := engine.SignupEngineRunArg{
		Username:   s.fields.username.GetValue(),
		Email:      s.fields.email.GetValue(),
		InviteCode: s.fields.code.GetValue(),
		Passphrase: s.passphrase,
		DeviceName: s.fields.deviceName.GetValue(),
	}
	s.engine.SetArg(&arg)
	ctx := &engine.Context{
		LogUI:    G.UI.GetLogUI(),
		GPGUI:    G.UI.GetGPGUI(),
		SecretUI: G.UI.GetSecretUI(),
		LoginUI:  G.UI.GetLoginUI(),
	}
	err = engine.RunEngine(s.engine, ctx)
	if err == nil {
		return false, nil
	}

	// check to see if the error is a join engine run result:
	if e, ok := err.(engine.SignupJoinEngineRunRes); ok {
		if e.PassphraseOk {
			s.fields.passphraseRetry.Disabled = false
		}
		if !e.PostOk {
			retry, err = s.HandlePostError(e.Err)
		} else {
			err = e.Err
		}
		return retry, err
	}

	return false, err
}

func (s *CmdSignupState) RequestInvitePromptForOk() (err error) {
	prompt := "Would you like to be added to the invite request list?"
	var invite bool
	if invite, err = G_UI.PromptYesNo(prompt, PromptDefaultYes); err != nil {
	} else if !invite {
		err = NotConfirmedError{}
	}
	return err
}

func (s *CmdSignupState) RequestInvitePromptForData() (err error) {

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
	if err = prompter.Run(); err != nil {
	} else {
		s.fullname = fullname.GetValue()
		s.notes = notes.GetValue()
	}
	return
}

func (s *CmdSignupState) RequestInvitePost() (err error) {
	err = s.engine.PostInviteRequest(libkb.InviteRequestArg{
		Email:    s.fields.email.GetValue(),
		Fullname: s.fullname,
		Notes:    s.notes,
	})
	if err == nil {
		G.Log.Info("Success! You're on our list, thanks for your interest.")
	}
	return err
}

func (s *CmdSignupState) RequestInvite() (err error) {
	if err = s.RequestInvitePromptForOk(); err != nil {
	} else if err = s.RequestInvitePromptForData(); err != nil {
	} else {
		err = s.RequestInvitePost()
	}
	return err
}

func (s *CmdSignupState) MakePrompter() {
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
			} else {
				return nil
			}
		}
	}

	cl := G.Env.GetCommandLine()

	passphraseRetry := &Field{
		Defval:   "n",
		Disabled: true,
		Name:     "passphraseRetry",
		Checker:  &libkb.CheckYesNo,
		Prompt:   "Reenter passphrase",
	}

	email := &Field{
		Defval:  cl.GetEmail(),
		Name:    "email",
		Prompt:  "Your email address",
		Checker: &libkb.CheckEmail,
	}

	username := &Field{
		Defval:  cl.GetUsername(),
		Name:    "username",
		Prompt:  "Your desired username",
		Checker: &libkb.CheckUsername,
	}

	deviceName := &Field{
		Defval:  "home computer",
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

func (v *CmdSignupState) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}

type ClientModeSignupEngine struct {
	scli keybase_1.SignupClient
	ccli keybase_1.ConfigClient
	arg  *engine.SignupEngineRunArg
}

func (e *ClientModeSignupEngine) Name() string {
	return "ClientModeSignupEngine"
}

func (e *ClientModeSignupEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.GPGUIKind,
		libkb.SecretUIKind,
	}
}

func (e *ClientModeSignupEngine) SubConsumers() []libkb.UIConsumer {
	// this doesn't use any subengines itself, so nil is ok here.
	// the destination of this will handle it...
	return nil
}

func (e *ClientModeSignupEngine) GetPrereqs() (ret engine.EnginePrereqs) { return }

func (e *ClientModeSignupEngine) CheckRegistered() (err error) {
	G.Log.Debug("+ ClientModeSignupEngine::CheckRegistered")
	var rres keybase_1.GetCurrentStatusRes
	if rres, err = e.ccli.GetCurrentStatus(); err != nil {
	} else if rres.Registered {
		err = libkb.AlreadyRegisteredError{}
	}
	G.Log.Debug("- ClientModeSignupEngine::CheckRegistered -> %s", libkb.ErrToOk(err))
	return
}

func (e *ClientModeSignupEngine) Init() error {
	var err error
	if e.scli, err = GetSignupClient(); err != nil {
		return err
	}

	if e.ccli, err = GetConfigClient(); err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewGPGUIProtocol(),
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	return nil
}

func (e *ClientModeSignupEngine) SetArg(arg *engine.SignupEngineRunArg) {
	e.arg = arg
}

func (e *ClientModeSignupEngine) Run(ctx *engine.Context) error {
	// in case daemon restarted before the last time the connections
	// were established:
	if err := e.Init(); err != nil {
		return err
	}

	rarg := keybase_1.SignupArg{
		Username:   e.arg.Username,
		Email:      e.arg.Email,
		InviteCode: e.arg.InviteCode,
		Passphrase: e.arg.Passphrase,
		DeviceName: e.arg.DeviceName,
	}
	res, err := e.scli.Signup(rarg)
	if err == nil {
		return nil
	}
	G.Log.Debug("error: %q, type: %T", err, err)
	if !res.PassphraseOk || !res.PostOk || !res.WriteOk {
		// problem with the join phase
		return engine.SignupJoinEngineRunRes{
			PassphraseOk: res.PassphraseOk,
			PostOk:       res.PostOk,
			WriteOk:      res.WriteOk,
			Err:          err,
		}
	}
	return err
}

func (e *ClientModeSignupEngine) PostInviteRequest(arg libkb.InviteRequestArg) (err error) {
	rarg := keybase_1.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	}
	err = e.scli.InviteRequest(rarg)
	return
}

func (s *CmdSignupState) HandlePostError(inerr error) (retry bool, err error) {
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
	return
}
