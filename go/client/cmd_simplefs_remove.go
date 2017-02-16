// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSRemove is the 'simplefs rm' command.
type CmdSimpleFSRemove struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSRemove creates a new cli.Command.
func NewCmdSimpleFSRemove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "rm",
		ArgumentHelp: "<path>",
		Usage:        "remove directory elements",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSRemove{Contextified: libkb.NewContextified(g)}, "rm", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSRemove) Run() error {
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
	err = cli.SimpleFSRemove(ctx, keybase1.SimpleFSRemoveArg{
		OpID: opid,
		Path: c.path,
	})

	if err != nil {
		return err
	}

	err = cli.SimpleFSWait(ctx, opid)

	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSRemove) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if nargs == 1 {
		c.path = makeSimpleFSPath(c.G(), ctx.Args()[0])
	}

	if pathType, _ := c.path.PathType(); pathType != keybase1.PathType_KBFS {
		err = errors.New("rm requires a KBFS path argument")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSRemove) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
