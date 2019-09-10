// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"sort"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSUploads is the 'fs ps' command.
type CmdSimpleFSUploads struct {
	libkb.Contextified
	filter keybase1.ListFilter
}

// NewCmdSimpleFSUploads creates a new cli.Command.
func NewCmdSimpleFSUploads(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "uploads",
		Usage: "list current uploads",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSUploads{
				Contextified: libkb.NewContextified(g)}, "uploads", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "a, all",
				Usage: "include entries starting with '.'",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSUploads) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	status, err := cli.SimpleFSSyncStatus(context.TODO(), c.filter)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	if len(status.SyncingPaths) == 0 && status.TotalSyncingBytes == 0 {
		ui.Printf("There are currently no uploads\n")
		return nil
	}

	sort.Strings(status.SyncingPaths)
	for _, p := range status.SyncingPaths {
		ui.Printf("%s\n", p)
	}
	if len(status.SyncingPaths) > 0 {
		ui.Printf("\n")
	}
	ui.Printf(
		"%s left to upload\n", humanizeBytes(status.TotalSyncingBytes, false))
	if status.EndEstimate != nil {
		timeRemaining := time.Until(keybase1.FromTime(*status.EndEstimate))
		ui.Printf("Estimated time remaining: %s\n",
			timeRemaining.Round(1*time.Second))
	}
	return nil
}

// ParseArgv gets the optional -r switch
func (c *CmdSimpleFSUploads) ParseArgv(ctx *cli.Context) error {
	if ctx.Bool("all") {
		c.filter = keybase1.ListFilter_NO_FILTER
	} else {
		c.filter = keybase1.ListFilter_FILTER_ALL_HIDDEN
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSUploads) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
