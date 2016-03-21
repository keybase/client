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

func NewCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the keybase service",
		Flags: []cli.Flag{
			// Using autofork bool instead of enum to be more like other autofork flags?
			// https://github.com/keybase/client/pull/2414
			cli.BoolFlag{
				Name:  "auto-fork",
				Usage: "Use auto forking",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdCtlStartRunner(g), "start", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

type CmdCtlStart struct {
	libkb.Contextified
	autoFork bool
}

func NewCmdCtlStartRunner(g *libkb.GlobalContext) *CmdCtlStart {
	return &CmdCtlStart{Contextified: libkb.NewContextified(g)}
}

func (s *CmdCtlStart) ParseArgv(ctx *cli.Context) error {
	s.autoFork = ctx.Bool("auto-fork")
	return nil
}

func (s *CmdCtlStart) Run() error {
	if s.autoFork {
		_, err := AutoForkServer(s.G(), s.G().Env.GetCommandLine())
		return err
	}

	return StartLaunchdService(s.G(), string(install.AppServiceLabel), true)
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
