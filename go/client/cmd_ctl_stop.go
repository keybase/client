// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package client

import (
	"runtime"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func NewCmdCtlStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop Keybase",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "shutdown",
				Usage: "Only shutdown the background service",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdCtlStop(g), "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

func newCmdCtlStop(g *libkb.GlobalContext) *CmdCtlStop {
	return &CmdCtlStop{
		Contextified: libkb.NewContextified(g),
	}
}

type CmdCtlStop struct {
	libkb.Contextified
	shutdown bool
}

func (s *CmdCtlStop) ParseArgv(ctx *cli.Context) error {
	s.shutdown = ctx.Bool("shutdown")
	return nil
}

func (s *CmdCtlStop) Run() (err error) {
	mctx := libkb.NewMetaContextTODO(s.G())

	switch runtime.GOOS {
	case "windows":
		if !s.shutdown {
			mctx.Info("stopping everything but the keybase service")
			install.StopAllButService(mctx, keybase1.ExitCode_OK)
		}
		cli, err := GetCtlClient(s.G())
		if err != nil {
			mctx.Error("failed to get ctl client for shutdown: %s", err)
			return err
		}
		mctx.Info("stopping the keybase service")
		return cli.StopService(mctx.Ctx(), keybase1.StopServiceArg{ExitCode: keybase1.ExitCode_OK})
	default:
		// On Linux, StopAllButService depends on a running service to tell it
		// what clients to shut down, so we can't call it directly from here,
		// but need to go through the RPC first.
		cli, err := GetCtlClient(s.G())
		if err != nil {
			return err
		}
		if s.shutdown {
			return cli.StopService(mctx.Ctx(), keybase1.StopServiceArg{ExitCode: keybase1.ExitCode_OK})
		}
		return cli.Stop(mctx.Ctx(), keybase1.StopArg{ExitCode: keybase1.ExitCode_OK})
	}
}

func (s *CmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
