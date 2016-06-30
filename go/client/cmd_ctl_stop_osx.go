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

// availableComponents specify which components can be included or excluded
var availableCtlComponents = []string{
	install.ComponentNameApp.String(),
	install.ComponentNameService.String(),
	install.ComponentNameKBFS.String(),
	install.ComponentNameUpdater.String(),
}

// defaultComponents specify default components to stop (if true)
var defaultCtlComponents = map[string]bool{
	install.ComponentNameApp.String():     true,
	install.ComponentNameService.String(): true,
	install.ComponentNameKBFS.String():    true,
	install.ComponentNameUpdater.String(): true,
}

// NewCmdCtlStop constructs ctl start command
func NewCmdCtlStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop the app and services",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "exclude",
				Usage: fmt.Sprintf("Stop all except excluded components, comma separated. Specify %v.", availableCtlComponents),
			},
			cli.BoolFlag{
				Name:  "no-wait",
				Usage: "If specified we won't wait for services to exit",
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

type cmdCtlStop struct {
	libkb.Contextified
	components map[string]bool
	noWait     bool
}

func newCmdCtlStop(g *libkb.GlobalContext) *cmdCtlStop {
	return &cmdCtlStop{
		Contextified: libkb.NewContextified(g),
		components:   defaultCtlComponents,
	}
}

func (s *cmdCtlStop) ParseArgv(ctx *cli.Context) error {
	excluded := strings.Split(ctx.String("exclude"), ",")
	for _, exclude := range excluded {
		s.components[exclude] = false
	}
	s.noWait = ctx.Bool("no-wait")
	return nil
}

func ctlBrewStop(g *libkb.GlobalContext) error {
	return launchd.Stop(install.DefaultServiceLabel(), defaultLaunchdWait, g.Log)
}

func ctlStop(g *libkb.GlobalContext, components map[string]bool, wait time.Duration) error {
	if libkb.IsBrewBuild {
		return ctlBrewStop(g)
	}
	g.Log.Debug("Components: %v", components)
	errs := []error{}
	if ok := components[install.ComponentNameApp.String()]; ok {
		if err := install.TerminateApp(g, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameService.String()]; ok {
		if err := launchd.Stop(install.DefaultServiceLabel(), wait, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameKBFS.String()]; ok {
		if err := launchd.Stop(install.DefaultKBFSLabel(), wait, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	if ok := components[install.ComponentNameUpdater.String()]; ok {
		if err := launchd.Stop(install.DefaultUpdaterLabel(), wait, g.Log); err != nil {
			errs = append(errs, err)
		}
	}
	return libkb.CombineErrors(errs...)
}

func (s *cmdCtlStop) Run() error {
	wait := defaultLaunchdWait
	if s.noWait {
		wait = 0
	}
	return ctlStop(s.G(), s.components, wait)
}

func (s *cmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
