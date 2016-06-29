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

// NewCmdCtlStart constructs ctl start command
func NewCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the app and services",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdCtlStartRunner(g), "start", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetNoStandalone()
		},
	}
}

type cmdCtlStart struct {
	libkb.Contextified
}

func newCmdCtlStartRunner(g *libkb.GlobalContext) *cmdCtlStart {
	return &cmdCtlStart{Contextified: libkb.NewContextified(g)}
}

func (s *cmdCtlStart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func ctlBrewStart(g *libkb.GlobalContext) error {
	return StartLaunchdService(g, install.DefaultServiceLabel(), g.Env.GetServiceInfoPath(), true)
}

func ctlStart(g *libkb.GlobalContext) error {
	if libkb.IsBrewBuild {
		return ctlBrewStart(g)
	}
	serviceStartErr := StartLaunchdService(g, install.DefaultServiceLabel(), g.Env.GetServiceInfoPath(), true)
	kbfsStartErr := StartLaunchdService(g, install.DefaultKBFSLabel(), g.Env.GetKBFSInfoPath(), true)
	updaterStartErr := launchd.Start(install.DefaultUpdaterLabel(), 5*time.Second, g.Log)
	appStartErr := install.RunApp(g, g.Log)
	return libkb.CombineErrors(serviceStartErr, kbfsStartErr, updaterStartErr, appStartErr)
}

func (s *cmdCtlStart) Run() error {
	return ctlStart(s.G())
}

func (s *cmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
