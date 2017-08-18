// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func NewCmdCtlAppExit(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "app-exit",
		Usage: "Exit the Keybase app",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdCtlAppExit(g), "app-exit", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

func newCmdCtlAppExit(g *libkb.GlobalContext) *CmdCtlAppExit {
	return &CmdCtlAppExit{
		Contextified: libkb.NewContextified(g),
	}
}

type CmdCtlAppExit struct {
	libkb.Contextified
}

func (s *CmdCtlAppExit) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlAppExit) Run() (err error) {
	cli, err := GetCtlClient(s.G())
	if err != nil {
		return err
	}
	return cli.AppExit(context.TODO(), 0)
}

func (s *CmdCtlAppExit) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
