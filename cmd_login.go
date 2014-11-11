package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdLogin struct{}

func (v *CmdLogin) Run() error {
	if err := libkb.G.LoginState.Login(); err != nil {
		return err
	}

	// We might need to ID ourselves, to load us in here
	arg := libkb.LoadUserArg{
		RequirePublicKey: true,
	}
	u, err := libkb.LoadMe(arg)
	if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else if _, not_selected := err.(libkb.NoSelectedKeyError); not_selected {
		err = u.IdentifySelf()
	}
	return err
}

func NewCmdLogin(cl *CommandLine) cli.Command {
	return cli.Command{
		Name: "login",
		Usage: "Establish a session with the keybase server " +
			"(if necessary)",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogin{}, "login", c)
		},
	}
}

func (v *CmdLogin) UseConfig() bool   { return true }
func (v *CmdLogin) UseKeyring() bool  { return true }
func (v *CmdLogin) UseAPI() bool      { return true }
func (v *CmdLogin) UseTerminal() bool { return true }

func (c *CmdLogin) ParseArgv(*cli.Context) error { return nil }
