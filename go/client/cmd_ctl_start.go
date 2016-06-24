// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the background keybase service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdCtlStart{libkb.NewContextified(g)}, "start", c)
			cl.SetForkCmd(libcmdline.ForceFork)
			cl.SetNoStandalone()
		},
	}
}

type cmdCtlStart struct {
	libkb.Contextified
}

func (s *cmdCtlStart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *cmdCtlStart) Run() (err error) {
	return nil
}

func (s *cmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
