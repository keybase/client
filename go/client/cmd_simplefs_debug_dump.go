// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// CmdSimpleFSDebugDump is the 'fs debug dump' command.
type CmdSimpleFSDebugDump struct {
	libkb.Contextified
}

// NewCmdSimpleFSDebugDump creates a new cli.Command.
func NewCmdSimpleFSDebugDump(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "dump",
		Usage: "Dump debugging info to the file system log",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSDebugDump{
				Contextified: libkb.NewContextified(g)}, "dump", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSDebugDump) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	return cli.SimpleFSDumpDebuggingInfo(context.TODO())
}

// ParseArgv gets the optional -r switch
func (c *CmdSimpleFSDebugDump) ParseArgv(ctx *cli.Context) error {
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSDebugDump) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
