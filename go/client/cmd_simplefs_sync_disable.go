// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSSyncDisable is the 'fs sync disable' command.
type CmdSimpleFSSyncDisable struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSSyncDisable creates a new cli.Command.
func NewCmdSimpleFSSyncDisable(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "disable",
		ArgumentHelp: "[path-to-folder]",
		Usage:        "Stops syncing the given folder to local storage",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSyncDisable{
				Contextified: libkb.NewContextified(g)}, "disable", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSyncDisable) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
	arg := keybase1.SimpleFSSetFolderSyncConfigArg{
		Config: keybase1.FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_DISABLED,
		},
		Path: c.path,
	}
	return cli.SimpleFSSetFolderSyncConfig(ctx, arg)
}

// ParseArgv gets the required path.
func (c *CmdSimpleFSSyncDisable) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("wrong number of arguments")
	}

	p, err := makeSimpleFSPath(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.path = p
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSSyncDisable) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
