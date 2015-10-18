package client

import (
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlRestart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "restart",
		Usage: "Restart the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlRestart{libkb.NewContextified(g)}, "restart", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlRestart struct {
	libkb.Contextified
}

func (s *CmdCtlRestart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlRestart) Run() error {
	cli, err := GetCtlClient(s.G())
	if err != nil {
		return err
	}
	if err = cli.Stop(context.TODO(), 0); err != nil {
		G.Log.Warning("Stop failed: %s", err)
		return err
	}

	// Wait a few seconds before the server stops
	G.Log.Info("Delaying for shutdown...")
	time.Sleep(2 * time.Second)
	G.Log.Info("Restart")
	return ForkServerNix(s.G().Env.GetCommandLine(), s.G())
}

func (s *CmdCtlRestart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
