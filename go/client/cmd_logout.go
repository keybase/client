package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
)

type CmdLogout struct{}

func (v *CmdLogout) RunClient() (err error) {
	var cli keybase_1.LoginClient
	if cli, err = GetLoginClient(); err != nil {
	} else {
		err = cli.Logout()
	}
	return
}

func (v *CmdLogout) Run() (err error) {
	err = libkb.G.LoginState.Logout()
	return
}

func NewCmdLogout(cl *libcmdline.CommandLine) cli.Command {
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
