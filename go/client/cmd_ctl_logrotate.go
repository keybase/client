package client

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func NewCmdCtlLogRotate(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "log-rotate",
		Usage:       "keybase ctl log-rotate",
		Description: "Close and open the keybase service's logfile",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlLogRotate{}, "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
		},
	}
}

type CmdCtlLogRotate struct{}

func (s *CmdCtlLogRotate) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlLogRotate) RunClient() (err error) {
	var cli keybase1.CtlClient
	if cli, err = GetCtlClient(); err != nil {
	} else {
		err = cli.LogRotate()
	}
	return err
}

func (s *CmdCtlLogRotate) Run() error {
	return fmt.Errorf("Can't run `ctl log-rotate` in standalone mode")
}

func (s *CmdCtlLogRotate) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
