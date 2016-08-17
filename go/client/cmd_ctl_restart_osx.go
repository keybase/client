// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdCtlRestart constructs ctl restart command
func NewCmdCtlRestart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "restart",
		Usage: "Restart the keybase services",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdCtlRestart{Contextified: libkb.NewContextified(g)}, "restart", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetNoStandalone()
		},
	}
}

type cmdCtlRestart struct {
	libkb.Contextified
}

func (s *cmdCtlRestart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *cmdCtlRestart) Run() error {
	if err := ctlStop(s.G(), nil, defaultLaunchdWait); err != nil {
		return err
	}
	return ctlStart(s.G())
}

func (s *cmdCtlRestart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
