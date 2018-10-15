// Copyright 2018 Keybase, Inc. All rights reserved. Use of
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

// CmdSimpleFSSymlink is the 'fs ln' command.
type CmdSimpleFSSymlink struct {
	libkb.Contextified
	target string
	link   keybase1.Path
}

// NewCmdSimpleFSSymlink creates a new cli.Command.
func NewCmdSimpleFSSymlink(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "ln",
		ArgumentHelp: "<target> <link>",
		Usage:        "create a symlink from link to target",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSymlink{Contextified: libkb.NewContextified(g)}, "ln", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSymlink) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
	arg := keybase1.SimpleFSSymlinkArg{
		Target: c.target,
		Link:   c.link,
	}

	return cli.SimpleFSSymlink(ctx, arg)
}

// ParseArgv gets the required path argument for this command.
func (c *CmdSimpleFSSymlink) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs != 2 {
		return errors.New("ln requires exactly 2 arguments")
	}
	targetStr := ctx.Args()[0]
	linkStr := ctx.Args()[1]

	rev := int64(0)
	timeString := ""
	relTimeString := ""
	linkPath, err := makeSimpleFSPathWithArchiveParams(
		linkStr, rev, timeString, relTimeString)
	if err != nil {
		return err
	}

	linkPathType, err := linkPath.PathType()
	if err != nil {
		return err
	}
	if linkPathType != keybase1.PathType_KBFS {
		return errors.New("keybase fs ln: link must be a KBFS path")
	}
	c.link = linkPath

	c.target = targetStr

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSSymlink) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
