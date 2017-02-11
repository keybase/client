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

// CmdSimpleFSStat is the 'simplefs srar' command.
type CmdSimpleFSStat struct {
	libkb.Contextified
	opid keybase1.OpID
	path keybase1.Path
}

// NewCmdSimpleFSStat creates a new cli.Command.
func NewCmdSimpleFSStat(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stat",
		Usage: "stat directory elements",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "stat", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSStat) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	e, err := cli.SimpleFSStat(context.TODO(), c.path)
	if err != nil {
		return err
	}

	w := GlobUI.DefaultTabWriter()
	fmt.Fprintf(w, "%s\t%s\t%d\t%s\n", keybase1.FormatTime(e.Time), keybase1.DirentTypeRevMap[e.DirentType], e.Size, e.Name)
	w.Flush()

	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSStat) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if nargs != 1 {
		err = fmt.Errorf("stat requires a KBFS path argument.")
	} else {
		c.path = MakeSimpleFSPath(ctx.Args()[0])
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
