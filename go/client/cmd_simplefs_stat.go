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

// CmdSimpleFSStat is the 'fs stat' command.
type CmdSimpleFSStat struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSStat creates a new cli.Command.
func NewCmdSimpleFSStat(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "stat",
		ArgumentHelp: "<path>",
		Usage:        "stat directory element",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSStat{Contextified: libkb.NewContextified(g)}, "stat", c)
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSStat) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	e, err := cli.SimpleFSStat(context.TODO(), c.path)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("%s\t%s\t%d\t%s\n", keybase1.FormatTime(e.Time), keybase1.DirentTypeRevMap[e.DirentType], e.Size, e.Name)

	return err
}

// ParseArgv gets the required path argument for this command.
func (c *CmdSimpleFSStat) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if nargs != 1 {
		err = errors.New("stat requires a KBFS path argument")
	} else {
		c.path = makeSimpleFSPath(c.G(), ctx.Args()[0])
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSStat) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
