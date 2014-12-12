package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
	"os"
)

func NewCmdSignup(cl *CommandLine) cli.Command {
	return cli.Command{
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
		},
	}
}

type PromptFields struct {
	email, code, username, passphraseRetry *Field
}

func (pf PromptFields) ToList() []*Field {
	return []*Field{pf.email, pf.code, pf.username, pf.passphraseRetry}
}

type CmdSignup struct {
	code     string
	fields   *PromptFields
	prompter *Prompter
	engine   *libkb.SignupEngine

	passphrase string
	fullname   string
	notes      string
}

func (s *CmdSignup) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.code = ctx.String("invite-code")

	if nargs != 0 {
		err = BadArgsError{"signup doesn't take arguments"}
	}
	return err
}

func (s *CmdSignup) CheckRegistered() (err error) {
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

func (s *CmdSignup) Prompt() (err error) {

	if s.prompter == nil {
		s.MakePrompter()
	}

	if err = s.prompter.Run(); err != nil {
		return
	}
	arg := libkb.PromptArg{
		TerminalPrompt: "Pick a strong passphrase",
		PinentryDesc:   "Pick a strong passphrase (12+ characters)",
		PinentryPrompt: "Passphrase",
	}

	f := s.fields.passphraseRetry
	if f.Disabled || libkb.IsYes(f.GetValue()) {
		s.passphrase, err = G_UI.PromptForNewPassphrase(arg)
	}

	return
}

func (s *CmdSignup) GenPwh() (err error) {
	if err = s.engine.GenPwh(s.passphrase); err == nil {
		s.fields.passphraseRetry.Disabled = false
	}
	return
}

func (s *CmdSignup) Post() (retry bool, err error) {
	err = s.engine.Post(libkb.SignupEnginePostArg{
		Username:     s.fields.username.GetValue(),
		Email:        s.fields.email.GetValue(),
		InvitationId: s.fields.code.GetValue(),
	})
	retry = false
	if err == nil {
	} else if ase, ok := err.(libkb.AppStatusError); ok {
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

func (s *CmdSignup) WriteOut() error {
	return s.engine.WriteOut()
}

func (s *CmdSignup) SuccessMessage() error {
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

func (s *CmdSignup) RunSignup() (err error) {
	retry := true

	err = s.CheckRegistered()

	for retry && err == nil {
		if err = s.Prompt(); err != nil {
		} else if err = s.GenPwh(); err != nil {
		} else {
			retry, err = s.Post()
		}
	}
	if err == nil {
		err = s.WriteOut()
	}
	if err == nil {
		s.SuccessMessage()
	}

	return err
}

func (s *CmdSignup) RequestInvitePromptForOk() (err error) {
	prompt := "Would you like to be added to the invite request list?"
	def := true
	var invite bool
	if invite, err = G_UI.PromptYesNo(prompt, &def); err != nil {
	} else if !invite {
		err = NotConfirmedError{}
	}
	return err
}

func (s *CmdSignup) RequestInvitePromptForData() (err error) {

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

func (s *CmdSignup) RequestInvitePost() (err error) {
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

func (s *CmdSignup) RequestInvite() (err error) {
	if err = s.RequestInvitePromptForOk(); err != nil {
	} else if err = s.RequestInvitePromptForData(); err != nil {
	} else {
		err = s.RequestInvitePost()
	}
	return err
}

func (s *CmdSignup) Run() (err error) {
	s.engine = libkb.NewSignupEngine()
	if err = s.RunSignup(); err == nil {
	} else if _, cce := err.(CleanCancelError); cce {
		err = s.RequestInvite()
	}
	return
}

func (v *CmdSignup) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:   true,
		API:      true,
		Terminal: true,
	}
}
