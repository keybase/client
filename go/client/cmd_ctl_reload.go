package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlReload(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "reload",
		Usage: "Reload config file",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlReload{}, "reload", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlReload struct{}

func (s *CmdCtlReload) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlReload) Run() (err error) {
	cli, err := GetCtlClient()
	if err != nil {
		return err
	}
	return cli.Reload()
}

func (s *CmdCtlReload) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
