// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"fmt"
	"strings"
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
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "exclude",
				Usage: fmt.Sprintf("Start all except excluded components, comma separated. Specify %v.", availableCtlComponents),
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
		components:   defaultCtlComponents,
	}
}

func (s *cmdCtlStart) ParseArgv(ctx *cli.Context) error {
	excluded := strings.Split(ctx.String("exclude"), ",")
	for _, exclude := range excluded {
		s.components[exclude] = false
	}
	return nil
}

func ctlBrewStart(g *libkb.GlobalContext) error {
	return StartLaunchdService(g, install.DefaultServiceLabel(), g.Env.GetServiceInfoPath(), true)
}

func ctlStart(g *libkb.GlobalContext, components map[string]bool) error {
	if libkb.IsBrewBuild {
		return ctlBrewStart(g)
	}
	errs := []error{}
	if ok := components[install.ComponentNameService.String()]; ok {
		if err := StartLaunchdService(g, install.DefaultServiceLabel(), g.Env.GetServiceInfoPath(), true); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameKBFS.String()]; ok {
		if err := StartLaunchdService(g, install.DefaultKBFSLabel(), g.Env.GetKBFSInfoPath(), true); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameUpdater.String()]; ok {
		if err := launchd.Start(install.DefaultUpdaterLabel(), 5*time.Second, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameApp.String()]; ok {
		if err := install.RunApp(g, g.Log); err != nil {
			errs = append(errs, err)
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
