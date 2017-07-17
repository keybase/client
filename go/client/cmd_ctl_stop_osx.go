// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdCtlStop constructs ctl start command
func NewCmdCtlStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop the app and services",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "include",
				Usage: fmt.Sprintf("Stop only specified components, comma separated. Specify %v.", availableCtlComponents),
			},
			cli.StringFlag{
				Name:  "exclude",
				Usage: fmt.Sprintf("Stop all except excluded components, comma separated. Specify %v.", availableCtlComponents),
			},
			// TODO(gabriel): Remove this un-used option
			cli.BoolFlag{
				Name:  "no-wait",
				Usage: "Deprecated",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdCtlStop(g), "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlStop struct {
	libkb.Contextified
	components map[string]bool
}

func newCmdCtlStop(g *libkb.GlobalContext) *CmdCtlStop {
	return &CmdCtlStop{
		Contextified: libkb.NewContextified(g),
	}
}

func (s *CmdCtlStop) ParseArgv(ctx *cli.Context) error {
	s.components = ctlParseArgv(ctx)
	return nil
}

func ctlBrewStop(g *libkb.GlobalContext) error {
	_, err := launchd.Stop(install.DefaultServiceLabel(g.Env.GetRunMode()), defaultLaunchdWait, g.Log)
	return err
}

func ctlStop(g *libkb.GlobalContext, components map[string]bool) error {
	if libkb.IsBrewBuild {
		return ctlBrewStop(g)
	}
	runMode := g.Env.GetRunMode()
	g.Log.Debug("Components: %v", components)
	errs := []error{}
	if ok := components[install.ComponentNameApp.String()]; ok {
		if err := install.TerminateApp(g, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameService.String()]; ok {
		if err := install.UninstallKeybaseServices(runMode, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameKBFS.String()]; ok {
		if err := install.UninstallKBFSOnStop(g, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameUpdater.String()]; ok {
		if err := install.UninstallUpdaterService(runMode, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	return libkb.CombineErrors(errs...)
}

func (s *CmdCtlStop) Run() error {
	return ctlStop(s.G(), s.components)
}

func (s *CmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
