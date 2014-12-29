package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go-libkb"
)

type CmdLogin struct {
}

func (v *CmdLogin) RunClient() (err error) {
	return nil
}

func (v *CmdLogin) Run() error {
	return libkb.LoginAndIdentify(nil, nil)
}

func NewCmdLogin(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "login",
		Usage: "Establish a session with the keybase server " +
			"(if necessary)",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogin{}, "login", c)
		},
	}
}

func (c *CmdLogin) ParseArgv(*cli.Context) error { return nil }

func (v *CmdLogin) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
