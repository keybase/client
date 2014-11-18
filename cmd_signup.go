package main

import (
	"encoding/hex"
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
	"github.com/keybase/go-triplesec"
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

	passphrase, passphraseLast string
	loginState                 *libkb.LoginState
	salt                       []byte
	pwh                        []byte

	uid     libkb.UID
	session string
	csrf    string
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

func (s *CmdSignup) CheckRegistered() error {
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

	passphraseRetry := &Field{
		Defval:   "n",
		Disabled: true,
		Name:     "passphraseRetry",
		Checker:  &libkb.CheckYesNo,
		Prompt:   "Reenter passphrase",
	}

	email := &Field{
		Defval:  G.Env.GetEmail(),
		Name:    "email",
		Prompt:  "Your email address",
		Checker: &libkb.CheckEmail,
	}

	username := &Field{
		Defval:  G.Env.GetUsername(),
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
	if s.loginState != nil && s.passphrase == s.passphraseLast {
		return
	}

	G.Log.Debug("+ GenPwh")
	state := libkb.NewLoginState()
	if err = state.GenerateNewSalt(); err != nil {
	} else if err = state.StretchKey(s.passphrase); err != nil {
	} else {
		s.loginState = state
		s.passphraseLast = s.passphrase
		s.fields.passphraseRetry.Disabled = false
		s.pwh = state.GetSharedSecret()
		s.salt, err = state.GetSalt()
		G.Log.Debug("Shared secret is %v", s.pwh)
	}
	G.Log.Debug("- GenPwh")
	return err
}

func (s *CmdSignup) Post() (retry bool, err error) {
	var res *libkb.ApiRes
	res, err = G.API.Post(libkb.ApiArg{
		Endpoint: "signup",
		Args: libkb.HttpArgs{
			"salt":          libkb.S{hex.EncodeToString(s.salt)},
			"pwh":           libkb.S{hex.EncodeToString(s.pwh)},
			"username":      libkb.S{s.fields.username.GetValue()},
			"email":         libkb.S{s.fields.email.GetValue()},
			"invitation_id": libkb.S{s.fields.code.GetValue()},
			"pwh_version":   libkb.I{int(triplesec.Version)},
		}})

	if err == nil {
		libkb.GetUidVoid(res.Body.AtKey("uid"), &s.uid, &err)
		res.Body.AtKey("session").GetStringVoid(&s.session, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&s.csrf, &err)
	} else if ase, ok := err.(libkb.AppStatusError); ok {
		fmt.Printf("A!!!\n")
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
	} else {
		fmt.Printf("B booooo\n")
	}
	return
}

func (s *CmdSignup) WriteOut() error {
	return nil
}

func (s *CmdSignup) SuccessMessage() error {
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

func (s *CmdSignup) RequestInvite() error {
	return nil
}

func (s *CmdSignup) Run() (err error) {
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
