package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
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

type CmdSignup struct {
	code                       string
	prompter                   *Prompter
	passphrase, passphraseLast string
	loginState                 *libkb.LoginState
	passphraseRetry            Field
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

func (s *CmdSignup) Prompt() (err error) {

	if s.prompter == nil {

		code := Field{
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

		s.passphraseRetry = Field{
			Defval:   "n",
			Disabled: true,
			Name:     "passphraseRetry",
			Checker:  &libkb.CheckYesNo,
			Prompt:   "Reenter passphrase",
		}

		fields := []Field{{
			Defval:  G.Env.GetEmail(),
			Name:    "email",
			Prompt:  "Your email address",
			Checker: &libkb.CheckEmail,
		}, code, {
			Defval:  G.Env.GetUsername(),
			Name:    "username",
			Prompt:  "Your desired username",
			Checker: &libkb.CheckUsername,
		}, s.passphraseRetry}

		s.prompter = NewPrompter(fields)
	}

	if err = s.prompter.Run(); err != nil {
		return
	}
	arg := libkb.PromptArg{
		TerminalPrompt: "Pick a strong passphrase",
		PinentryDesc:   "Pick a strong passphrase (12+ characters)",
		PinentryPrompt: "Passphrase",
	}
	if libkb.IsYes(s.passphraseRetry.Value) {
		s.passphrase, err = G_UI.PromptForNewPassphrase(arg)
	}
	return
}

func (s *CmdSignup) GenPwh() (err error) {
	if s.loginState != nil && s.passphrase == s.passphraseLast {
		return
	}

	state := libkb.NewLoginState()
	if err = state.GenerateNewSalt(); err != nil {
	} else if err = state.StretchKey(s.passphrase); err != nil {
	} else {
		s.loginState = state
		s.passphraseLast = s.passphrase
		s.passphraseRetry.Disabled = false
	}
	return err
}

func (s *CmdSignup) Post() (retry bool, err error) {
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
