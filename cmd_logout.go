package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdLogout struct{}

func (v *CmdLogout) Run() error {

	err := libkb.G.LoginState.Logout()
	if err != nil {
		return err
	}
	return nil
}

func NewCmdLogout(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:  "logout",
		Usage: "Logout and remove session information",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogout{}, "logout", c)
		},
	}
}

func (v *CmdLogout) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdLogout) ParseArgv(*cli.Context) error { return nil }
