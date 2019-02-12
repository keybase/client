// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"path"
	"time"

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

func printPrefetchStatus(
	ui libkb.TerminalUI, status keybase1.PrefetchStatus,
	progress keybase1.PrefetchProgress, tab string) {
	switch status {
	case keybase1.PrefetchStatus_COMPLETE:
		ui.Printf("%sStatus: fully synced\n", tab)
	case keybase1.PrefetchStatus_IN_PROGRESS:
		ui.Printf("%sStatus: sync in progress\n", tab)
		if progress.BytesTotal > 0 {
			ui.Printf("%s%s/%s (%.2f%%)\n",
				tab, humanizeBytes(progress.BytesFetched, false),
				humanizeBytes(progress.BytesTotal, false),
				100*float64(progress.BytesFetched)/
					float64(progress.BytesTotal))
		}
		if progress.EndEstimate > 0 {
			timeRemaining := time.Until(keybase1.FromTime(progress.EndEstimate))
			ui.Printf("%sEstimated time remaining: %s\n",
				tab, timeRemaining.Round(1*time.Second))
		}
	case keybase1.PrefetchStatus_NOT_STARTED:
		ui.Printf("%sStatus: sync not yet started\n", tab)
	default:
		ui.Printf("%sStatus: unknown\n", tab)
	}
}

func appendToTlfPath(tlfPath keybase1.Path, p string) (keybase1.Path, error) {
	return makeSimpleFSPath(
		path.Join([]string{mountDir, tlfPath.String(), p}...))
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
		printPrefetchStatus(
			ui, res.Status.PrefetchStatus, res.Status.PrefetchProgress, "")
		a := res.Status.LocalDiskBytesAvailable
		t := res.Status.LocalDiskBytesTotal
		ui.Printf("%s (%.2f%%) of the local disk available for caching.\n",
			humanizeBytes(a, false), float64(a)/float64(t)*100)
	case keybase1.FolderSyncMode_PARTIAL:
		// Show all the paths for the TLF, even if a more specific
		// path was passed in.
		tlfPath, err := toTlfPath(c.path)
		if err != nil {
			return err
		}
		paths := "these subpaths"
		if len(res.Config.Paths) == 1 {
			paths = "this subpath"
		}
		ui.Printf("Syncing configured for %s:\n", paths)
		for _, p := range res.Config.Paths {
			fullPath, err := appendToTlfPath(tlfPath, p)
			if err != nil {
				ui.Printf("\tError: %v", err)
				continue
			}
			e, err := cli.SimpleFSStat(
				ctx, keybase1.SimpleFSStatArg{Path: fullPath})
			if err != nil {
				ui.Printf("\tError: %v", err)
				continue
			}

			ui.Printf("\t%s\n", p)
			printPrefetchStatus(
				ui, e.PrefetchStatus, e.PrefetchProgress, "\t\t")
		}
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
