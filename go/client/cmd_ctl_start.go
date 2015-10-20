package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlStart{libkb.NewContextified(g)}, "start", c)
			cl.SetForkCmd(libcmdline.ForceFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlStart struct {
	libkb.Contextified
}

func (s *CmdCtlStart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlStart) Run() (err error) {
	return nil
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
