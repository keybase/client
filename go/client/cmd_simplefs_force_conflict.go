// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleForceConflict is the 'fs force-conflict' command.
type CmdSimpleFSForceConflict struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSForceConflict creates a new cli.Command.  Right now
// it just triggers a "stuck" conflict, but maybe in the future we'll
// want to add more types of manual conflicts.
func NewCmdSimpleFSForceConflict(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "force-conflict",
		ArgumentHelp: "<path-to-folder>",
		Usage:        "forces a conflict in the given folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSForceConflict{
				Contextified: libkb.NewContextified(g)}, "force-conflict", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSForceConflict) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	return cli.SimpleFSForceStuckConflict(context.TODO(), c.path)
}

// ParseArgv gets the path.
func (c *CmdSimpleFSForceConflict) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("wrong number of arguments")
	}

	p, err := makeSimpleFSPath(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.path = p
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSForceConflict) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
