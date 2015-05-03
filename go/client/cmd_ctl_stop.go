package client

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

func NewCmdCtlStop(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "stop",
		Usage:       "keybase ctl stop",
		Description: "Stop the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlStop{}, "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
		},
	}
}

type CmdCtlStop struct{}

func (s *CmdCtlStop) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlStop) RunClient() (err error) {
	var cli keybase_1.CtlClient
	if cli, err = GetCtlClient(); err != nil {
	} else {
		err = cli.Stop()
	}
	return err
}

func (s *CmdCtlStop) Run() error {
	return fmt.Errorf("Can't run `ctl stop` in standalone mode")
}

func (v *CmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
