// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSDebug is the 'fs debug' command.
type CmdSimpleFSDebug struct {
	libkb.Contextified
	path    keybase1.Path
	recurse bool
}

// NewCmdSimpleFSDebug creates a new cli.Command.
func NewCmdSimpleFSDebug(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "debug",
		Usage: "Dump debugging info to the file system log",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSDebug{
				Contextified: libkb.NewContextified(g)}, "debug", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSDebug) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	return cli.SimpleFSDumpDebuggingInfo(context.TODO())
}

// ParseArgv gets the optional -r switch
func (c *CmdSimpleFSDebug) ParseArgv(ctx *cli.Context) error {
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSDebug) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
