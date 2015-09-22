package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlLogRotate(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "log-rotate",
		Usage: "Close and open the keybase service's log file",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlLogRotate{}, "log-rotate", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlLogRotate struct{}

func (s *CmdCtlLogRotate) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlLogRotate) Run() (err error) {
	cli, err := GetCtlClient()
	if err != nil {
		return err
	}
	return cli.LogRotate(0)
}

func (s *CmdCtlLogRotate) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
