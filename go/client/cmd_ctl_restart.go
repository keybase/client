// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package client

import (
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	configCli, err := GetConfigClient(s.G())
	if err != nil {
		return err
	}
	config, err := configCli.GetConfig(context.TODO(), 0)
	if err != nil {
		return err
	}

	cli, err := GetCtlClient(s.G())
	if err != nil {
		return err
	}
	if err = cli.Stop(context.TODO(), keybase1.StopArg{ExitCode: keybase1.ExitCode_RESTART}); err != nil {
		s.G().Log.Warning("Stop failed: %s", err)
		return err
	}

	// If the watchdog started this process, it will do the restarting.
	// Otherwise we have to.
	if config.ForkType != keybase1.ForkType_WATCHDOG {
		// Wait a few seconds before the server stops
		s.G().Log.Info("Delaying for shutdown...")
		time.Sleep(2 * time.Second)
		s.G().Log.Info("Restart")
		_, err = ForkServer(s.G(), s.G().Env.GetCommandLine(), config.ForkType)
	}
	return err
}

func (s *CmdCtlRestart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
