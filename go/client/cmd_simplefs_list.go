// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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

// CmdSimpleFSList is the 'simplefs list' command.
type CmdSimpleFSList struct {
	libkb.Contextified
	opid    keybase1.OpID
	path    keybase1.Path
	recurse bool
}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdSimpleFSList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "ls",
		ArgumentHelp: "<path>",
		Usage:        "list directory contents",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSList{Contextified: libkb.NewContextified(g)}, "ls", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, recursive",
				Usage: "recurse into subdirectories",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSList) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	c.opid, err = cli.SimpleFSMakeOpid(ctx)
	defer cli.SimpleFSClose(ctx, c.opid)
	if err != nil {
		return err
	}
	if c.recurse {
		err = cli.SimpleFSListRecursive(ctx, keybase1.SimpleFSListRecursiveArg{
			OpID: c.opid,
			Path: c.path,
		})
	} else {
		err = cli.SimpleFSList(ctx, keybase1.SimpleFSListArg{
			OpID: c.opid,
			Path: c.path,
		})
	}
	if err != nil {
		return err
	}

	for {
		listResult, err := cli.SimpleFSReadList(ctx, c.opid)
		if err != nil {
			break
		}
		c.output(listResult)

		// TODO: do we need to wait?
	}

	return err
}

func (c *CmdSimpleFSList) output(listResult keybase1.SimpleFSListResult) {

	ui := c.G().UI.GetTerminalUI()

	for _, e := range listResult.Entries {
		ui.Printf("%s\t%s\t%d\t%s\n", keybase1.FormatTime(e.Time), keybase1.DirentTypeRevMap[e.DirentType], e.Size, e.Name)
	}
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSList) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.recurse = ctx.Bool("recurse")

	if nargs == 1 {
		c.path = makeSimpleFSPath(c.G(), ctx.Args()[0])
	} else {
		err = fmt.Errorf("List requires a path argument.")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
