// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

// CmdSimpleFSMkdir is the 'fs mkdir' command.
type CmdSimpleFSMkdir struct {
	libkb.Contextified
	opid keybase1.OpID
	path keybase1.Path
}

// NewCmdSimpleFSMkdir creates a new cli.Command.
func NewCmdSimpleFSMkdir(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mkdir",
		ArgumentHelp: "<path>",
		Usage:        "create directory",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSMkdir{Contextified: libkb.NewContextified(g)}, "mkdir", c)
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSMkdir) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	c.opid, err = cli.SimpleFSMakeOpid(ctx)
	if err != nil {
		return err
	}
	defer cli.SimpleFSClose(ctx, c.opid)
	err = cli.SimpleFSOpen(ctx, keybase1.SimpleFSOpenArg{
		OpID:  c.opid,
		Dest:  c.path,
		Flags: keybase1.OpenFlags_DIRECTORY,
	})
	if err != nil {
		return err
	}

	return err
}

// ParseArgv gets the required path argument for this command.
func (c *CmdSimpleFSMkdir) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if nargs != 1 {
		err = errors.New("mkdir requires a KBFS path argument")
	} else {
		c.path = makeSimpleFSPath(c.G(), ctx.Args()[0])
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSMkdir) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
