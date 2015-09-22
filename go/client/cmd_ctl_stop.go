package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlStop(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlStop{}, "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlStop struct{}

func (s *CmdCtlStop) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlStop) Run() (err error) {
	cli, err := GetCtlClient()
	if err != nil {
		return err
	}
	return cli.Stop(0)
}

func (s *CmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
