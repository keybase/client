package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func NewCmdCtlStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdCtlStopRunner(g), "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlStop struct {
	libkb.Contextified
}

func NewCmdCtlStopRunner(g *libkb.GlobalContext) *CmdCtlStop {
	return &CmdCtlStop{libkb.NewContextified(g)}
}

func (s *CmdCtlStop) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlStop) Run() (err error) {
	cli, err := GetCtlClient(s.G())
	if err != nil {
		return err
	}
	return cli.Stop(context.TODO(), 0)
}

func (s *CmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
