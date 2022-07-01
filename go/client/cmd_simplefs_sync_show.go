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
	path   keybase1.Path
	getAll bool
}

// NewCmdSimpleFSSyncShow creates a new cli.Command.
func NewCmdSimpleFSSyncShow(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "show",
		ArgumentHelp: "<path-to-folder>",
		Usage:        "shows the sync configuration and status for the given folder, or all folders if none is specified",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSyncShow{
				Contextified: libkb.NewContextified(g)}, "show", c)
			cl.SetNoStandalone()
		},
	}
}

func printBytesStored(ui libkb.TerminalUI, bytes int64, tab string) {
	if bytes >= 0 {
		ui.Printf("%s%s bytes stored\n", tab, humanizeBytes(bytes, false))
	}
}

func printPrefetchStatus(
	ui libkb.TerminalUI, status keybase1.FolderSyncStatus, tab string) {
	switch status.PrefetchStatus {
	case keybase1.PrefetchStatus_COMPLETE:
		ui.Printf("%sStatus: fully synced\n", tab)
	case keybase1.PrefetchStatus_IN_PROGRESS:
		ui.Printf("%sStatus: sync in progress\n", tab)
		progress := status.PrefetchProgress
		if progress.BytesTotal > 0 {
			ui.Printf("%s%s/%s (%.2f%%)\n",
				tab, humanizeBytes(progress.BytesFetched, false),
				humanizeBytes(progress.BytesTotal, false),
				100*float64(progress.BytesFetched)/
					float64(progress.BytesTotal))
		}
		if progress.EndEstimate > 0 && !status.OutOfSyncSpace {
			timeRemaining := time.Until(keybase1.FromTime(progress.EndEstimate))
			ui.Printf("%sEstimated time remaining: %s\n",
				tab, timeRemaining.Round(1*time.Second))
		} else if status.OutOfSyncSpace {
			ui.Printf("%sError: out of disk space\n", tab)
		}
	case keybase1.PrefetchStatus_NOT_STARTED:
		ui.Printf("%sStatus: sync not yet started\n", tab)
	default:
		ui.Printf("%sStatus: unknown\n", tab)
	}
	printBytesStored(ui, status.StoredBytesTotal, tab)
}

func appendToTlfPath(tlfPath keybase1.Path, p string) (keybase1.Path, error) {
	return makeSimpleFSPath(
		path.Join([]string{mountDir, tlfPath.String(), p}...))
}

func printLocalStats(
	ui libkb.TerminalUI, status keybase1.FolderSyncStatus) {
	a := status.LocalDiskBytesAvailable
	t := status.LocalDiskBytesTotal
	ui.Printf("%s (%.2f%%) of the local disk is available for caching.\n",
		humanizeBytes(a, false), float64(a)/float64(t)*100)
}

func printFolderStatus(
	ctx context.Context, cli keybase1.SimpleFSClient, ui libkb.TerminalUI,
	config keybase1.FolderSyncConfig, status keybase1.FolderSyncStatus,
	tab string, tlfPath keybase1.Path, doPrintLocalStats bool) error {
	switch config.Mode {
	case keybase1.FolderSyncMode_DISABLED:
		ui.Printf("%sSyncing disabled\n", tab)
	case keybase1.FolderSyncMode_ENABLED:
		ui.Printf("%sSyncing enabled\n", tab)
		printPrefetchStatus(ui, status, tab)
		if doPrintLocalStats {
			printLocalStats(ui, status)
		}
	case keybase1.FolderSyncMode_PARTIAL:
		// Show all the paths for the TLF, even if a more specific
		// path was passed in.
		paths := "these subpaths"
		if len(config.Paths) == 1 {
			paths = "this subpath"
		}
		ui.Printf("%sSyncing configured for %s:\n", tab, paths)
		for _, p := range config.Paths {
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

			ui.Printf("%s\t%s\n", tab, p)
			pathStatus := keybase1.FolderSyncStatus{
				PrefetchStatus:   e.PrefetchStatus,
				PrefetchProgress: e.PrefetchProgress,
				StoredBytesTotal: -1,
				OutOfSyncSpace:   status.OutOfSyncSpace,
			}
			printPrefetchStatus(ui, pathStatus, tab+"\t\t")
		}
		printBytesStored(ui, status.StoredBytesTotal, tab)
		if doPrintLocalStats {
			printLocalStats(ui, status)
		}
	default:
		return fmt.Errorf("Unknown sync mode: %s", config.Mode)
	}
	return nil
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSyncShow) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
	ui := c.G().UI.GetTerminalUI()
	if c.getAll {
		res, err := cli.SimpleFSSyncConfigAndStatus(ctx, nil)
		if err != nil {
			return err
		}

		for _, folder := range res.Folders {
			p, err := makeSimpleFSPath(mountDir + "/" + folder.Folder.String())
			if err != nil {
				return err
			}
			ui.Printf("%s\n", folder.Folder)
			err = printFolderStatus(
				ctx, cli, ui, folder.Config, folder.Status, "  ", p, false)
			if err != nil {
				return err
			}
			ui.Printf("\n")
		}

		printPrefetchStatus(ui, res.OverallStatus, "")
		printLocalStats(ui, res.OverallStatus)
	} else {
		res, err := cli.SimpleFSFolderSyncConfigAndStatus(ctx, c.path)
		if err != nil {
			return err
		}
		tlfPath, err := toTlfPath(c.path)
		if err != nil {
			return err
		}
		return printFolderStatus(
			ctx, cli, ui, res.Config, res.Status, "", tlfPath, true)
	}

	return nil
}

// ParseArgv gets the required path.
func (c *CmdSimpleFSSyncShow) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return fmt.Errorf("wrong number of arguments")
	}

	if len(ctx.Args()) == 1 {
		p, err := makeSimpleFSPath(ctx.Args()[0])
		if err != nil {
			return err
		}
		c.path = p
	} else {
		c.getAll = true
	}
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
