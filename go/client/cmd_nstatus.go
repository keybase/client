// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdNStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "nstatus",
		Usage: "Show information about current user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdNStatus{Contextified: libkb.NewContextified(g)}, "nstatus", c)
		},
	}
}

type CmdNStatus struct {
	libkb.Contextified
}

func (c *CmdNStatus) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("verify")
	}
	return nil
}

func (c *CmdNStatus) Run() error {
	return nil
}

func (c *CmdNStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}
