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

// CmdSimpleFSSyncShow is the 'fs sync show' command.
type CmdSimpleFSSyncShow struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSSyncShow creates a new cli.Command.
func NewCmdSimpleFSSyncShow(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "show",
		ArgumentHelp: "[path-to-folder]",
		Usage:        "shows the sync configuration and status for the given folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSyncShow{
				Contextified: libkb.NewContextified(g)}, "show", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSyncShow) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
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
		switch res.Status.PrefetchStatus {
		case keybase1.PrefetchStatus_COMPLETE:
			ui.Printf("Status: fully synced\n")
		case keybase1.PrefetchStatus_IN_PROGRESS:
			ui.Printf("Status: sync in progress\n")
			// TODO: add progress stats here
		case keybase1.PrefetchStatus_NOT_STARTED:
			ui.Printf("Status: sync not yet started\n")
		default:
			ui.Printf("Status: unknown\n")
		}
		a := res.Status.LocalDiskBytesAvailable
		t := res.Status.LocalDiskBytesTotal
		ui.Printf("%s (%.2f%%) of the local disk available for caching.\n",
			humanizeBytes(a, false), float64(a)/float64(t)*100)
	default:
		return fmt.Errorf("Unknown sync mode: %s", res.Config.Mode)
	}
	return nil
}

// ParseArgv gets the required path.
func (c *CmdSimpleFSSyncShow) ParseArgv(ctx *cli.Context) error {
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
func (c *CmdSimpleFSSyncShow) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
