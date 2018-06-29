// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSHistory is the 'fs history' command.
type CmdSimpleFSHistory struct {
	libkb.Contextified
	path keybase1.Path
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
		if len(w.Edits) == 0 {
			continue
		}

		ui.Printf("\n%s (%s)\n", h.Folder.ToString(), w.WriterName)
		for _, e := range w.Edits {
			ui.Printf("\t%s (%s)\n", e.Filename, keybase1.FromTime(e.ServerTime))
		}
	}
}

// ParseArgv gets the optional path, if any.
func (c *CmdSimpleFSHistory) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return fmt.Errorf("wrong number of arguments")
	} else if len(ctx.Args()) == 1 {
		c.path = makeSimpleFSPath(c.G(), ctx.Args()[0])
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
