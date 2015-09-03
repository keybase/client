package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlConfigReload(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "config-reload",
		Usage:       "keybase ctl config-reload",
		Description: "Reload config file",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlConfigReload{}, "config-reload", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlConfigReload struct{}

func (s *CmdCtlConfigReload) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlConfigReload) Run() (err error) {
	cli, err := GetCtlClient()
	if err != nil {
		return err
	}
	return cli.ConfigReload()
}

func (s *CmdCtlConfigReload) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
