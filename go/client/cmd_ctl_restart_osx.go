// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdCtlRestart constructs ctl restart command
func NewCmdCtlRestart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "restart",
		Usage: "Restart the keybase services",
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
			cl.ChooseCommand(&cmdCtlRestart{Contextified: libkb.NewContextified(g)}, "restart", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetNoStandalone()
		},
	}
}

type cmdCtlRestart struct {
	libkb.Contextified
	components map[string]bool
}

func (s *cmdCtlRestart) ParseArgv(ctx *cli.Context) error {
	s.components = ctlParseArgv(ctx)
	return nil
}

func (s *cmdCtlRestart) Run() error {
	err := ctlStop(s.G(), s.components)
	if err != nil {
		return err
	}
	return ctlStart(s.G(), s.components)
}

func (s *cmdCtlRestart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
