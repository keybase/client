package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"time"
)

func NewCmdCtlRestart(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "restart",
		Usage:       "keybase ctl restart",
		Description: "Restart the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlRestart{}, "restart", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlRestart struct{}

func (s *CmdCtlRestart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlRestart) Run() error {
	cli, err := GetCtlClient()
	if err != nil {
		return err
	}
	if err = cli.Stop(); err != nil {
		G.Log.Warning("Stop failed: %s", err)
		return err
	}

	// Wait a few seconds before the server stops
	G.Log.Info("Delaying for shutdown...")
	time.Sleep(2 * time.Second)
	G.Log.Info("Restart")
	return ForkServerNix(G.Env.GetCommandLine())
}

func (s *CmdCtlRestart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
