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

// CmdSimpleFSConflicts is the 'fs clear-conflicts' command.
type CmdSimpleFSClearConflicts struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSClearConflicts creates a new cli.Command.
func NewCmdSimpleFSClearConflicts(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "clear-conflicts",
		ArgumentHelp: "<path-to-folder>",
		Usage:        "moves the conflict state of the given folder out of the way",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSClearConflicts{
				Contextified: libkb.NewContextified(g)}, "clear-conflicts", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSClearConflicts) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	return cli.SimpleFSClearConflictState(context.TODO(), c.path)
}

// ParseArgv gets the path.
func (c *CmdSimpleFSClearConflicts) ParseArgv(ctx *cli.Context) error {
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
func (c *CmdSimpleFSClearConflicts) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
