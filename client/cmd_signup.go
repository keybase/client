package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"os"
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
	email, code, username, passphraseRetry *Field
}

func (pf PromptFields) ToList() []*Field {
	return []*Field{pf.email, pf.code, pf.username, pf.passphraseRetry}
}

type SignupEngine interface {
	CheckRegistered() error
	Run(libkb.SignupEngineRunArg) libkb.SignupEngineRunRes
	PostInviteRequest(libkb.InviteRequestArg) error
	Init() error
}

type RemoteSignupEngine struct {
	scli keybase_1.SignupClient
	ccli keybase_1.ConfigClient
}

func (e *RemoteSignupEngine) CheckRegistered() (err error) {
	G.Log.Debug("+ RemoteSignupEngine::CheckRegistered")
	var rres keybase_1.GetCurrentStatusRes
	if rres, err = e.ccli.GetCurrentStatus(); err != nil {
	} else if rres.Registered {
		err = libkb.AlreadyRegisteredError{}
	}
	G.Log.Debug("- RemoteSignupEngine::CheckRegistered -> %s", libkb.ErrToOk(err))
	return
}

func (e *RemoteSignupEngine) Init() (err error) {
	e.scli, err = GetSignupClient()
	if err == nil {
		e.ccli, err = GetConfigClient()
	}
	return
}

func (e *RemoteSignupEngine) Run(arg libkb.SignupEngineRunArg) (res libkb.SignupEngineRunRes) {
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

func (e *RemoteSignupEngine) PostInviteRequest(arg libkb.InviteRequestArg) (err error) {
	rarg := keybase_1.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	}
	err = e.scli.InviteRequest(rarg)
	return
}

type CmdSignupState struct {
	code     string
	fields   *PromptFields
	prompter *Prompter
	engine   SignupEngine

	passphrase string
	fullname   string
	notes      string
}

func (s *CmdSignupState) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.code = ctx.String("invite-code")

	if nargs != 0 {
		err = BadArgsError{"signup doesn't take arguments"}
	}
	return err
}

func (s *CmdSignupState) CheckRegistered() (err error) {
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

	s.fields = &PromptFields{
		email:           email,
		code:            code,
		username:        username,
		passphraseRetry: passphraseRetry,
	}

	s.prompter = NewPrompter(s.fields.ToList())
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

func (s *CmdSignupState) RunEngine() (retry bool, err error) {
	arg := libkb.SignupEngineRunArg{
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

func (s *CmdSignupState) HandlePostError(inerr error) (retry bool, err error) {
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

func (s *CmdSignupState) SuccessMessage() error {
	msg := `
Welcome to keybase.io! You now need to associate a public key with your
account.  If you have a key already then:

    keybase mykey select <key-id>  # if you know the ID of the key --- OR ---
    keybase mykey select           # to select from a menu

If you need a public key, we'll happily generate one for you:

    keybase mykey gen # Generate a new key and push public part to server

Enjoy!
`
	os.Stdout.Write([]byte(msg))
	return nil
}

func (s *CmdSignupState) RunSignup() (err error) {
	retry := true

	if err = s.engine.Init(); err == nil {
		err = s.CheckRegistered()
	}

	for retry && err == nil {
		if err = s.Prompt(); err == nil {
			retry, err = s.RunEngine()
		}
	}
	if err == nil {
		s.SuccessMessage()
	}

	return err
}

func (s *CmdSignupState) RequestInvitePromptForOk() (err error) {
	prompt := "Would you like to be added to the invite request list?"
	def := true
	var invite bool
	if invite, err = G_UI.PromptYesNo(prompt, &def); err != nil {
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

func (s *CmdSignupState) RunClient() (err error) {
	G.Log.Debug("| Remote mode")
	s.engine = &RemoteSignupEngine{}
	return s.run()
}

func (s *CmdSignupState) Run() (err error) {
	G.Log.Debug("| Standalone mode")
	s.engine = libkb.NewSignupEngine()
	return s.run()
}

func (s *CmdSignupState) run() (err error) {
	G.Log.Debug("+ CmdSignupState::Run")
	if err = s.RunSignup(); err == nil {
	} else if _, cce := err.(CleanCancelError); cce {
		err = s.RequestInvite()
	}
	G.Log.Debug("- CmdSignupState::Run")
	return
}

func (v *CmdSignupState) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:   true,
		API:      true,
		Terminal: true,
	}
}
