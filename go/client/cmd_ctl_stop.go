// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!windows

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtlStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop the background keybase service",

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
}

func (s *CmdCtlStop) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlStop) Run() (err error) {
	return CtlServiceStop(s.G())

}

func (s *CmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
