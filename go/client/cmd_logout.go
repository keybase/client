package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type CmdLogout struct{}

func (v *CmdLogout) RunClient() (err error) {
	var cli keybase1.LoginClient
	if cli, err = GetLoginClient(); err != nil {
	} else {
		err = cli.Logout()
	}
	return
}

func (v *CmdLogout) Run() (err error) {
	return libkb.G.Logout()
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

func (v *CmdLogout) ParseArgv(*cli.Context) error { return nil }
