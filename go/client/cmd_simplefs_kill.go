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

// CmdSimpleFSKill is the 'fs kill' command.
type CmdSimpleFSKill struct {
	libkb.Contextified
	opid keybase1.OpID
}

// NewCmdSimpleFSKill creates a new cli.Command.
func NewCmdSimpleFSKill(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "kill",
		ArgumentHelp: "<opid>",
		Usage:        "kill operation",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSKill{Contextified: libkb.NewContextified(g)}, "kill", c)
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSKill) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	err = cli.SimpleFSClose(context.TODO(), c.opid)

	return err
}

// ParseArgv gets the opid argument for this command.
func (c *CmdSimpleFSKill) ParseArgv(ctx *cli.Context) error {
	var err error
	nargs := len(ctx.Args())
	if nargs == 1 {
		c.opid, err = stringToOpID(ctx.Args()[0])
	} else {
		err = fmt.Errorf("close requires an opid argument.")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSKill) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
