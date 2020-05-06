// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSUploads is the 'fs uploads' command.
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

func printUploads(
	g *libkb.GlobalContext, filter keybase1.ListFilter, mustHavePrefix string) (
	areUploads bool, err error) {
	cli, err := GetSimpleFSClient(g)
	if err != nil {
		return false, err
	}

	status, err := cli.SimpleFSSyncStatus(context.TODO(), filter)
	if err != nil {
		return false, err
	}

	ui := g.UI.GetTerminalUI()
	if len(status.SyncingPaths) == 0 && status.TotalSyncingBytes == 0 {
		ui.Printf("There are currently no uploads in progress\n")
		return false, nil
	}

	sort.Strings(status.SyncingPaths)
	printed := false
	for _, p := range status.SyncingPaths {
		if !strings.HasPrefix(p, mustHavePrefix) {
			continue
		}
		printed = true
		ui.Printf("%s\n", p)
	}
	if printed {
		ui.Printf("\n")
	} else {
		return false, nil
	}

	ui.Printf(
		"%s left to upload\n", humanizeBytes(status.TotalSyncingBytes, false))
	if status.EndEstimate != nil {
		timeRemaining := time.Until(keybase1.FromTime(*status.EndEstimate))
		ui.Printf("Estimated time remaining: %s\n",
			timeRemaining.Round(1*time.Second))
	}
	return true, nil
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSUploads) Run() error {
	_, err := printUploads(c.G(), c.filter, "")
	return err
}

// ParseArgv gets the optional -a switch.
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
