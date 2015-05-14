package client

import (
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func NewCmdCtlRestart(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "restart",
		Usage:       "keybase ctl restart",
		Description: "Restart the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlRestart{}, "restart", c)
			cl.SetForkCmd(libcmdline.NoFork)
		},
	}
}

type CmdCtlRestart struct{}

func (s *CmdCtlRestart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlRestart) RunClient() (err error) {
	var cli keybase1.CtlClient
	if cli, err = GetCtlClient(); err != nil {
	} else if err = cli.Stop(); err != nil {
		G.Log.Warning("Stop failed: %s", err.Error())
	} else {
		// Wait a few seconds before the server stops
		G.Log.Info("Delaying for shutdown...")
		time.Sleep(2 * time.Second)
		G.Log.Info("Restart")
		err = ForkServerNix(G.Env.GetCommandLine())
	}
	return err
}

func (s *CmdCtlRestart) Run() error {
	return fmt.Errorf("Can't run `ctl stop` in standalone mode")
}

func (s *CmdCtlRestart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
