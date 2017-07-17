// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSGetStatus is the 'fs get-status' command.
type CmdSimpleFSGetStatus struct {
	libkb.Contextified
	opid keybase1.OpID
}

// NewCmdSimpleFSGetStatus creates a new cli.Command.
func NewCmdSimpleFSGetStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "get-status",
		ArgumentHelp: "<opid>",
		Usage:        "get status of pending operation",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSGetStatus{Contextified: libkb.NewContextified(g)}, "get-status", c)
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSGetStatus) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	progress, err := cli.SimpleFSCheck(context.TODO(), c.opid)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("progress: %d\n", progress)

	return err
}

// ParseArgv gets the rquired path argument for this command.
func (c *CmdSimpleFSGetStatus) ParseArgv(ctx *cli.Context) error {
	var err error

	nargs := len(ctx.Args())
	if nargs == 1 {
		c.opid, err = stringToOpID(ctx.Args()[0])
	} else {
		err = fmt.Errorf("get-status requires a path argument")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSGetStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
