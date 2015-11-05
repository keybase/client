// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdShowNotifications struct {
	libkb.Contextified
}

func (c *CmdShowNotifications) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdShowNotifications) Run() error {
	_, err := GlobUI.Println("Showing notifications:")
	return err
}

func NewCmdShowNotifications(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "show-notifications",
		Usage: "Display all notifications sent by daemon in real-time",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdShowNotifications{Contextified: libkb.NewContextified(g)}, "show-notifications", c)
		},
		Flags: []cli.Flag{},
	}
}

func (c *CmdShowNotifications) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
