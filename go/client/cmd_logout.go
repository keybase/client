package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdLogout struct{}

func (v *CmdLogout) Run() error {
	cli, err := GetLoginClient()
	if err != nil {
		return err
	}
	return cli.Logout(context.TODO(), 0)
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
