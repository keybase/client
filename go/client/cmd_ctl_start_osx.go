// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"fmt"

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
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "include",
				Usage: fmt.Sprintf("Stop only specified components, comma separated. Specify %v.", availableCtlComponents),
			},
			cli.StringFlag{
				Name:  "exclude",
				Usage: fmt.Sprintf("Stop all except excluded components, comma separated. Specify %v.", availableCtlComponents),
			},
		},
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
	components map[string]bool
}

func newCmdCtlStart(g *libkb.GlobalContext) *cmdCtlStart {
	return &cmdCtlStart{
		Contextified: libkb.NewContextified(g),
	}
}

func (s *cmdCtlStart) ParseArgv(ctx *cli.Context) error {
	s.components = ctlParseArgv(ctx)
	return nil
}

func ctlBrewStart(g *libkb.GlobalContext) error {
	return startLaunchdService(g, install.DefaultServiceLabel(g.Env.GetRunMode()), g.Env.GetServiceInfoPath(), true)
}

func ctlStart(g *libkb.GlobalContext, components map[string]bool) error {
	if libkb.IsBrewBuild {
		return ctlBrewStart(g)
	}
	g.Log.Debug("Components: %v", components)
	errs := []error{}
	if ok := components[install.ComponentNameService.String()]; ok {
		if err := install.InstallService(g, "", false, defaultLaunchdWait, g.Log); err != nil {
			errs = append(errs, err)
			g.Log.Errorf("%s", err)
		}
	}
	if ok := components[install.ComponentNameKBFS.String()]; ok {
		if err := install.InstallKBFS(g, "", false, defaultLaunchdWait, g.Log); err != nil {
			errs = append(errs, err)
			g.Log.Errorf("%s", err)
		}
	}
	if ok := components[install.ComponentNameUpdater.String()]; ok {
		if err := install.InstallUpdater(g, "", false, defaultLaunchdWait, g.Log); err != nil {
			errs = append(errs, err)
			g.Log.Errorf("%s", err)
		}
	}
	if ok := components[install.ComponentNameApp.String()]; ok {
		if err := install.RunApp(g, g.Log); err != nil {
			errs = append(errs, err)
			g.Log.Errorf("%s", err)
		}
	}
	return libkb.CombineErrors(errs...)
}

func (s *cmdCtlStart) Run() error {
	return ctlStart(s.G(), s.components)
}

func (s *cmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
