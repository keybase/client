// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSGetStatus is the 'fs get-status' command.
type CmdSimpleFSGetStatus struct {
	libkb.Contextified
	opid keybase1.OpID
}

// NewCmdSimpleFSGetStatus creates a new cli.Command.
func NewCmdSimpleFSGetStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "get-status",
		ArgumentHelp: "<opid>",
		Usage:        "get status of pending operation",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSGetStatus{Contextified: libkb.NewContextified(g)}, "get-status", c)
			cl.SetNoStandalone()
		},
	}
}

func (c *CmdSimpleFSGetStatus) printOpProgress(
	ui libkb.TerminalUI, progress keybase1.OpProgress,
	files, written, first bool) (wroteFirst bool) {
	var n, d int64
	var label string
	if files {
		d = progress.FilesTotal
		label = "files "
		if written {
			n = progress.FilesWritten
			if progress.OpType == keybase1.AsyncOps_REMOVE {
				label += "removed"
			} else {
				label += "written"
			}
		} else {
			n = progress.FilesRead
			label += "read"
		}
	} else {
		d = progress.BytesTotal
		label = "bytes "
		if written {
			n = progress.BytesWritten
			label += "written"
		} else {
			n = progress.BytesRead
			label += "read"
		}
	}
	if d <= 0 {
		return false
	}
	header := "Progress: "
	if !first {
		header = "          "
	}

	ui.Printf("%s%d/%d %s (%.2f%%)\n",
		header, n, d, label, 100*float64(n)/float64(d))
	return true
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSGetStatus) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	progress, err := cli.SimpleFSCheck(context.TODO(), c.opid)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Op type: %s\n", progress.OpType)

	// TODO: humanize the larger numbers into KB, MB, GB, etc.
	switch progress.OpType {
	case keybase1.AsyncOps_LIST, keybase1.AsyncOps_LIST_RECURSIVE:
		c.printOpProgress(ui, progress, true, false, true)
	case keybase1.AsyncOps_READ:
		c.printOpProgress(ui, progress, false, false, true)
	case keybase1.AsyncOps_WRITE:
		c.printOpProgress(ui, progress, false, true, true)
	case keybase1.AsyncOps_COPY, keybase1.AsyncOps_MOVE:
		wroteFirst := c.printOpProgress(ui, progress, false, false, true)
		c.printOpProgress(ui, progress, false, true, !wroteFirst)
		c.printOpProgress(ui, progress, true, false, !wroteFirst)
		c.printOpProgress(ui, progress, true, true, !wroteFirst)
	case keybase1.AsyncOps_REMOVE:
		c.printOpProgress(ui, progress, true, true, true)
	}
	if progress.EndEstimate > 0 {
		timeRemaining := time.Until(keybase1.FromTime(progress.EndEstimate))
		ui.Printf("Estimated time remaining: %s\n", timeRemaining)
	}
	return err
}

// ParseArgv gets the rquired path argument for this command.
func (c *CmdSimpleFSGetStatus) ParseArgv(ctx *cli.Context) error {
	var err error

	nargs := len(ctx.Args())
	if nargs == 1 {
		c.opid, err = stringToOpID(ctx.Args()[0])
	} else {
		err = fmt.Errorf("get-status requires a path argument")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSGetStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
