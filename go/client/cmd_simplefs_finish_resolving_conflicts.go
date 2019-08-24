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
type CmdSimpleFSFinishResolvingConflicts struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSFinishResolvingConflicts creates a new cli.Command.
func NewCmdSimpleFSFinishResolvingConflicts(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "finish-resolving-conflicts",
		ArgumentHelp: "<path-to-folder>",
		Usage:        "indicate that a conflict has been resolved and its local state may be cleaned",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSFinishResolvingConflicts{
				Contextified: libkb.NewContextified(g)}, "finish-resolving-conflicts", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSFinishResolvingConflicts) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	return cli.SimpleFSFinishResolvingConflict(context.TODO(), c.path)
}

// ParseArgv gets the path.
func (c *CmdSimpleFSFinishResolvingConflicts) ParseArgv(ctx *cli.Context) error {
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
func (c *CmdSimpleFSFinishResolvingConflicts) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
