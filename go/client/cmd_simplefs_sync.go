// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSSync is the 'fs sync' command.
type CmdSimpleFSSync struct {
	libkb.Contextified
	path    keybase1.Path
	disable bool
	show    bool
}

// NewCmdSimpleFSSync creates a new cli.Command.
func NewCmdSimpleFSSync(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "sync",
		ArgumentHelp: "[path-to-folder]",
		Usage:        "syncs the given folder to local storage, for offline access",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSync{
				Contextified: libkb.NewContextified(g)}, "sync", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "d, disable",
				Usage: "Disable syncing for an already-synced folder",
			},
			cli.BoolFlag{
				Name:  "s, show",
				Usage: "Shows the sync configuration for the given folder",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSync) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
	if c.show {
		res, err := cli.SimpleFSFolderSyncConfigAndStatus(ctx, c.path)
		if err != nil {
			return err
		}

		ui := c.G().UI.GetTerminalUI()
		switch res.Config.Mode {
		case keybase1.FolderSyncMode_DISABLED:
			ui.Printf("Syncing disabled\n")
		case keybase1.FolderSyncMode_ENABLED:
			ui.Printf("Syncing enabled\n")
		default:
			return fmt.Errorf("Unknown sync mode: %s", res.Config.Mode)
		}
		return nil
	}

	arg := keybase1.SimpleFSSetFolderSyncConfigArg{
		Config: keybase1.FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		},
		Path: c.path,
	}
	if c.disable {
		arg.Config.Mode = keybase1.FolderSyncMode_DISABLED
	}
	return cli.SimpleFSSetFolderSyncConfig(ctx, arg)
}

// ParseArgv gets the optional path, if any.
func (c *CmdSimpleFSSync) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("wrong number of arguments")
	}

	p, err := makeSimpleFSPath(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.path = p

	c.disable = ctx.Bool("disable")
	c.show = ctx.Bool("show")
	if c.disable && c.show {
		return errors.New("disable and show are incompatible")
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSSync) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
