// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build !production

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdRekeyTrigger struct {
	libkb.Contextified
}

func NewCmdRekeyTrigger(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "trigger",
		Usage: "Trigger a fake rekey status window",
		Action: func(c *cli.Context) {
			cmd := &CmdRekeyTrigger{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "trigger", c)
		},
	}
}

func (c *CmdRekeyTrigger) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("trigger")
	}
	return nil
}

func (c *CmdRekeyTrigger) Run() error {
	cli, err := GetRekeyClient(c.G())
	if err != nil {
		return err
	}
	return cli.DebugShowRekeyStatus(context.Background(), 0)
}

func (c *CmdRekeyTrigger) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}
