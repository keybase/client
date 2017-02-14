// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSWrite is the 'simplefs write' command.
type CmdSimpleFSWrite struct {
	libkb.Contextified
	path   keybase1.Path
	flags  keybase1.OpenFlags
	offset int
}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdSimpleFSWrite(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "write",
		ArgumentHelp: "<path>",
		Usage:        "write input to file",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "write", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "a, append",
				Usage: "add to existing file",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSWrite) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	opid, err := cli.SimpleFSMakeOpid(context.TODO())
	if err != nil {
		return err
	}

	// if we're appending, we'll need the size
	if c.flags|keybase1.OpenFlags_APPEND != 0 {
		e, err := cli.SimpleFSStat(context.TODO(), c.path)
		if err != nil {
			return err
		}
		c.offset = e.Size
	}

	err = cli.SimpleFSOpen(context.TODO(), keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  c.path,
		Flags: c.flags,
	})
	defer cli.SimpleFSClose(context.TODO(), opid)
	if err != nil {
		return err
	}

	bytes, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		return err
	}

	err = cli.SimpleFSWrite(context.TODO(), keybase1.SimpleFSWriteArg{
		OpID:    opid,
		Offset:  c.offset,
		Content: bytes,
	})

	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSWrite) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if ctx.Bool("append") {
		c.flags = keybase1.OpenFlags_WRITE | keybase1.OpenFlags_APPEND
	} else {
		c.flags = keybase1.OpenFlags_WRITE | keybase1.OpenFlags_REPLACE
	}

	if nargs == 1 {
		c.path = MakeSimpleFSPath(c.G(), ctx.Args()[0])
	} else {
		err = fmt.Errorf("write requires a path argument.")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSWrite) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
