package client

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlStart(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "start",
		Usage:       "keybase ctl start",
		Description: "Start the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlStart{}, "start", c)
			cl.SetForkCmd(libcmdline.ForceFork)
		},
	}
}

type CmdCtlStart struct{}

func (s *CmdCtlStart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlStart) RunClient() (err error) {
	return nil
}

func (s *CmdCtlStart) Run() error {
	return fmt.Errorf("Can't run `ctl start` in standalone mode")
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
