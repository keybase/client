// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSHistory is the 'fs history' command.
type CmdSimpleFSHistory struct {
	libkb.Contextified
	path    keybase1.Path
	deletes bool
}

// NewCmdSimpleFSHistory creates a new cli.Command.
func NewCmdSimpleFSHistory(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "history",
		ArgumentHelp: "[path-to-folder]",
		Usage:        "output the edit history for a user or folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSHistory{
				Contextified: libkb.NewContextified(g)}, "history", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "d, deletes",
				Usage: "Show the recently-deleted files",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSHistory) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	if c.path == (keybase1.Path{}) {
		history, err := cli.SimpleFSUserEditHistory(context.TODO())
		if err != nil {
			return err
		}
		for _, h := range history {
			c.output(h)
		}
	} else {
		history, err := cli.SimpleFSFolderEditHistory(context.TODO(), c.path)
		if err != nil {
			return err
		}
		c.output(history)
	}

	return err
}

func (c *CmdSimpleFSHistory) output(h keybase1.FSFolderEditHistory) {
	ui := c.G().UI.GetTerminalUI()
	for _, w := range h.History {
		files := w.Edits
		if c.deletes {
			files = w.Deletes
		}

		if len(files) == 0 {
			continue
		}

		ui.Printf("\n%s (%s)\n", h.Folder.ToString(), w.WriterName)
		for _, e := range files {
			ui.Printf("\t%s: %s\n",
				keybase1.FromTime(e.ServerTime).Format(time.UnixDate),
				e.Filename)
		}
	}
}

// ParseArgv gets the optional path, if any.
func (c *CmdSimpleFSHistory) ParseArgv(ctx *cli.Context) error {
	c.deletes = ctx.Bool("deletes")

	if len(ctx.Args()) > 1 {
		return fmt.Errorf("wrong number of arguments")
	} else if len(ctx.Args()) == 1 {
		p, err := makeSimpleFSPath(ctx.Args()[0])
		if err != nil {
			return err
		}
		c.path = p
	}
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSHistory) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
