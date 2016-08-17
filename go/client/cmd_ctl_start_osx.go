// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdCtlStart constructs ctl start command
func NewCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the app and services",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdCtlStart(g), "start", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetNoStandalone()
		},
	}
}

type cmdCtlStart struct {
	libkb.Contextified
}

func newCmdCtlStart(g *libkb.GlobalContext) *cmdCtlStart {
	return &cmdCtlStart{
		Contextified: libkb.NewContextified(g),
	}
}

func (s *cmdCtlStart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func ctlBrewStart(g *libkb.GlobalContext) error {
	return startLaunchdService(g, install.DefaultServiceLabel(g.Env.GetRunMode()), g.Env.GetServiceInfoPath(), true)
}

func ctlStart(g *libkb.GlobalContext) error {
	if libkb.IsBrewBuild {
		return ctlBrewStart(g)
	}
	return install.RunApp(g, g.Log)
}

func (s *cmdCtlStart) Run() error {
	return ctlStart(s.G())
}

func (s *cmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
