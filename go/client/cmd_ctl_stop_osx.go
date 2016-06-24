// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdCtlStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop the app and services",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdCtlStopRunner(g), "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetNoStandalone()
		},
	}
}

type cmdCtlStop struct {
	libkb.Contextified
}

func newCmdCtlStopRunner(g *libkb.GlobalContext) *cmdCtlStop {
	return &cmdCtlStop{libkb.NewContextified(g)}
}

func (s *cmdCtlStop) ParseArgv(ctx *cli.Context) error {
	return nil
}

func ctlBrewStop(g *libkb.GlobalContext) error {
	return launchd.Stop(install.DefaultServiceLabel(), defaultLaunchdWait, g.Log)
}

func ctlStop(g *libkb.GlobalContext) error {
	if libkb.IsBrewBuild {
		return ctlBrewStop(g)
	}
	appStopErr := install.TerminateApp(g, g.Log)
	serviceStopErr := launchd.Stop(install.DefaultServiceLabel(), defaultLaunchdWait, g.Log)
	kbfsStopErr := launchd.Stop(install.DefaultKBFSLabel(), defaultLaunchdWait, g.Log)
	updaterStopErr := launchd.Stop(install.DefaultUpdaterLabel(), defaultLaunchdWait, g.Log)
	return libkb.CombineErrors(appStopErr, serviceStopErr, kbfsStopErr, updaterStopErr)
}

func (s *cmdCtlStop) Run() error {
	return ctlStop(s.G())
}

func (s *cmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
