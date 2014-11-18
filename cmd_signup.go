package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

func NewCmdSignup(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "sign",
		Usage:       "keybase signup [-u <username>] [-e <email>] [-c <code>]",
		Description: "signup for a new account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSignup{}, "signup", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "u, username",
				Usage: "Specify a username to signup as",
			},
			cli.StringFlag{
				Name:  "e, email",
				Usage: "Specify an email address",
			},
			cli.StringFlag{
				Name:  "c, invite-code",
				Usage: "Specify an invite code",
			},
		},
	}
}

type CmdSignup struct {
	username string
	email    string
	code     string
}

func (s *CmdSignup) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.email = ctx.String("email")
	s.username = ctx.String("username")
	s.code = ctx.String("invite-code")

	if nargs != 0 {
		err = BadArgsError{"signup doesn't take arguments"}
	}
	return err
}

func (s *CmdSignup) CheckRegistered() error {
	return nil
}

func (s *CmdSignup) Prompt() error {
	return nil
}

func (s *CmdSignup) GenPwh() error {
	return nil
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
