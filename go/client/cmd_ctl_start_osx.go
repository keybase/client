// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdCtlStartRunner(g), "start", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlStart struct {
	libkb.Contextified
}

func NewCmdCtlStartRunner(g *libkb.GlobalContext) *CmdCtlStart {
	return &CmdCtlStart{libkb.NewContextified(g)}
}

func (s *CmdCtlStart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func ctlBrewStart(g *libkb.GlobalContext) error {
	return StartLaunchdService(g, install.DefaultServiceLabel(g.Env.GetRunMode()), g.Env.GetServiceInfoPath(), true)
}

func (s *CmdCtlStart) Run() error {
	if s.G().Env.GetAutoFork() {
		_, err := AutoForkServer(s.G(), s.G().Env.GetCommandLine())
		return err
	}
	serviceStartErr := StartLaunchdService(g, install.DefaultServiceLabel(g.Env.GetRunMode()), g.Env.GetServiceInfoPath(), true)
	kbfsStartErr := StartLaunchdService(g, install.DefaultKBFSLabel(g.Env.GetRunMode()), g.Env.GetKBFSInfoPath(), true)
	updaterStartErr := launchd.Start(install.DefaultUpdaterLabel(g.Env.GetRunMode()), 5*time.Second, g.Log)
	appStartErr := install.RunApp(g, g.Log)
	return libkb.CombineErrors(serviceStartErr, kbfsStartErr, updaterStartErr, appStartErr)
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
