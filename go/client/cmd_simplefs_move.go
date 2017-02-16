// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSMove is the 'simplefs list' command.
type CmdSimpleFSMove struct {
	libkb.Contextified
	src  keybase1.Path
	dest keybase1.Path
}

// NewCmdSimpleFSMove creates a new cli.Command.
func NewCmdSimpleFSMove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mv",
		ArgumentHelp: "<source> [dest]",
		Usage:        "move directory elements",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSMove{Contextified: libkb.NewContextified(g)}, "mv", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSMove) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	opid, err := cli.SimpleFSMakeOpid(ctx)
	defer cli.SimpleFSClose(ctx, opid)
	if err != nil {
		return err
	}

	err = cli.SimpleFSMove(ctx, keybase1.SimpleFSMoveArg{
		OpID: opid,
		Dest: c.src,
	})

	if err != nil {
		return err
	}

	err = cli.SimpleFSWait(ctx, opid)

	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSMove) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if nargs < 1 || nargs > 2 {
		return errors.New("mv requires a source path (and optional destination) argument")
	}

	c.src = makeSimpleFSPath(c.G(), ctx.Args()[0])
	if nargs == 2 {
		c.dest = makeSimpleFSPath(c.G(), ctx.Args()[1])
	} else {
		// use the current local directory as a default
		wd, _ := os.Getwd()
		c.dest = makeSimpleFSPath(c.G(), wd)
	}
	srcType, _ := c.src.PathType()
	destType, _ := c.dest.PathType()
	if srcType == keybase1.PathType_LOCAL && destType == keybase1.PathType_LOCAL {
		return errors.New("mv requires KBFS source and/or destination")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSMove) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
