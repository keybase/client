package main

// This isn't a true subcommand.  It is the join (create account) step of
// the signup process.

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
)

type CmdSignupJoinState struct {
	fields   *PromptFields
	prompter *Prompter
	engine   SignupJoinEngine

	code       string
	passphrase string
	fullname   string
	notes      string

	requestedInvite bool
}

func (s *CmdSignupJoinState) CheckRegistered() (err error) {
	if err = s.engine.CheckRegistered(); err == nil {
		return
	} else if _, ok := err.(libkb.AlreadyRegisteredError); !ok {
		return
	}
	prompt := "Already registered; do you want to reregister?"
	def := false
	if rereg, err := G_UI.PromptYesNo(prompt, &def); err != nil {
		return err
	} else if !rereg {
		return NotConfirmedError{}
	}
	return nil
}

func (s *CmdSignupJoinState) MakePrompter() {

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

	/*
		deviceName := &Field{
			Defval:  "home computer",
			Name:    "devname",
			Prompt:  "A public name for this device",
			Checker: &libkb.CheckNotEmpty,
		}
	*/

	s.fields = &PromptFields{
		email:           email,
		code:            code,
		username:        username,
		passphraseRetry: passphraseRetry,
		// deviceName:      deviceName,
	}

	s.prompter = NewPrompter(s.fields.ToList())
}

func (s *CmdSignupJoinState) Prompt() (err error) {

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

type PromptFields struct {
	email, code, username, passphraseRetry *Field
}

func (pf PromptFields) ToList() []*Field {
	return []*Field{pf.email, pf.code, pf.username, pf.passphraseRetry}
}

type SignupJoinEngine interface {
	CheckRegistered() error
	Run(libkb.SignupJoinEngineRunArg) libkb.SignupJoinEngineRunRes
	PostInviteRequest(libkb.InviteRequestArg) error
	Init() error
}

type RemoteSignupJoinEngine struct {
	scli keybase_1.SignupClient
	ccli keybase_1.ConfigClient
}

func (e *RemoteSignupJoinEngine) CheckRegistered() (err error) {
	G.Log.Debug("+ RemoteSignupJoinEngine::CheckRegistered")
	var rres keybase_1.GetCurrentStatusRes
	if rres, err = e.ccli.GetCurrentStatus(); err != nil {
	} else if rres.Registered {
		err = libkb.AlreadyRegisteredError{}
	}
	G.Log.Debug("- RemoteSignupJoinEngine::CheckRegistered -> %s", libkb.ErrToOk(err))
	return
}

func (e *RemoteSignupJoinEngine) Init() (err error) {
	e.scli, err = GetSignupClient()
	if err == nil {
		e.ccli, err = GetConfigClient()
	}
	return
}

func (e *RemoteSignupJoinEngine) Run(arg libkb.SignupJoinEngineRunArg) (res libkb.SignupJoinEngineRunRes) {
	rarg := keybase_1.SignupArg{
		Username:   arg.Username,
		Email:      arg.Email,
		InviteCode: arg.InviteCode,
		Passphrase: arg.Passphrase,
	}
	rres, err := e.scli.Signup(rarg)
	if res.Error = err; err == nil {
		res.PassphraseOk = rres.PassphraseOk
		res.PostOk = rres.PostOk
		res.WriteOk = rres.WriteOk
	}
	return
}

func (e *RemoteSignupJoinEngine) PostInviteRequest(arg libkb.InviteRequestArg) (err error) {
	rarg := keybase_1.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	}
	err = e.scli.InviteRequest(rarg)
	return
}

func (s *CmdSignupJoinState) RunClient() error {
	s.engine = &RemoteSignupJoinEngine{}
	return s.run()
}

func (s *CmdSignupJoinState) Run() error {
	s.engine = libkb.NewSignupJoinEngine()
	return s.run()
}

func (s *CmdSignupJoinState) run() error {
	G.Log.Debug("+ CmdSignupJoinState::Run")
	defer G.Log.Debug("- CmdSignupJoinState::Run")
	err := s.runSignup()
	if err != nil {
		if _, cce := err.(CleanCancelError); cce {
			s.requestedInvite = true
			return s.RequestInvite()
		}
		return err
	}

	return nil
}

func (s *CmdSignupJoinState) RunEngine() (retry bool, err error) {
	arg := libkb.SignupJoinEngineRunArg{
		Username:   s.fields.username.GetValue(),
		Email:      s.fields.email.GetValue(),
		InviteCode: s.fields.code.GetValue(),
		Passphrase: s.passphrase,
	}
	res := s.engine.Run(arg)
	if res.PassphraseOk {
		s.fields.passphraseRetry.Disabled = false
	}
	if !res.PostOk {
		retry, err = s.HandlePostError(res.Error)
	} else {
		err = res.Error
	}
	return
}

func (s *CmdSignupJoinState) HandlePostError(inerr error) (retry bool, err error) {
	retry = false
	err = inerr
	if ase, ok := inerr.(libkb.AppStatusError); ok {
		switch ase.Name {
		case "BAD_SIGNUP_EMAIL_TAKEN":
			v := s.fields.email.Clear()
			G.Log.Error("Email address '%s' already taken", v)
			retry = true
			err = nil
		case "BAD_SIGNUP_USERNAME_TAKEN":
			v := s.fields.username.Clear()
			G.Log.Error("Username '%s' already taken", v)
			retry = true
			err = nil
		case "INPUT_ERROR":
			if ase.IsBadField("username") {
				v := s.fields.username.Clear()
				G.Log.Error("Username '%s' rejected by server", v)
				retry = true
				err = nil
			}
		case "BAD_INVITATION_CODE":
			v := s.fields.code.Clear()
			G.Log.Error("Bad invitation code '%s' given", v)
			retry = true
			err = nil
		}
	}
	return
}

func (s *CmdSignupJoinState) runSignup() (err error) {
	retry := true

	if err = s.engine.Init(); err == nil {
		err = s.CheckRegistered()
	}

	for retry && err == nil {
		if err = s.Prompt(); err == nil {
			retry, err = s.RunEngine()
		}
	}

	return err
}

func (s *CmdSignupJoinState) RequestInvitePromptForOk() (err error) {
	prompt := "Would you like to be added to the invite request list?"
	def := true
	var invite bool
	if invite, err = G_UI.PromptYesNo(prompt, &def); err != nil {
	} else if !invite {
		err = NotConfirmedError{}
	}
	return err
}

func (s *CmdSignupJoinState) RequestInvitePromptForData() (err error) {

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

func (s *CmdSignupJoinState) RequestInvitePost() (err error) {
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

func (s *CmdSignupJoinState) RequestInvite() (err error) {
	if err = s.RequestInvitePromptForOk(); err != nil {
	} else if err = s.RequestInvitePromptForData(); err != nil {
	} else {
		err = s.RequestInvitePost()
	}
	return err
}
