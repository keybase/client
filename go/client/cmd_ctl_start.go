// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func NewCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the background keybase service",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "t, type",
				Usage: fmt.Sprintf("Service type (%s, %s), default is %q", keybase1.ForkType_AUTO.String(), keybase1.ForkType_LAUNCHD.String(), defaultForkType.String()),
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
	forkType keybase1.ForkType
}

func NewCmdCtlStartRunner(g *libkb.GlobalContext) *CmdCtlStart {
	return &CmdCtlStart{Contextified: libkb.NewContextified(g)}
}

func (s *CmdCtlStart) ParseArgv(ctx *cli.Context) error {
	forkTypeStr := ctx.String("type")
	switch forkTypeStr {
	case "", "launchd":
		s.forkType = keybase1.ForkType_LAUNCHD
	case "auto":
		s.forkType = keybase1.ForkType_AUTO
	default:
		return fmt.Errorf("Invalid type: %s", forkTypeStr)
	}
	return nil
}

func (s *CmdCtlStart) runAutoFork() error {
	_, err := AutoForkServer(s.G(), s.G().Env.GetCommandLine())
	return err
}

func (s *CmdCtlStart) runLaunchd() error {
	return StartLaunchdService(s.G(), string(install.AppServiceLabel), true)
}

func (s *CmdCtlStart) Run() error {
	switch s.forkType {
	case keybase1.ForkType_LAUNCHD:
		return s.runLaunchd()
	case keybase1.ForkType_AUTO:
		return s.runAutoFork()
	default:
		return fmt.Errorf("Unsupported service type")
	}
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
