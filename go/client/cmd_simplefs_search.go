// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// CmdSimpleFSSearch is the 'fs search' command.
type CmdSimpleFSSearch struct {
	libkb.Contextified
	query string
}

// NewCmdSimpleFSSearch creates a new cli.Command.
func NewCmdSimpleFSSearch(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "search",
		ArgumentHelp: "<path> [<path2> <path3>...]",
		Usage:        "Searches given keybase path",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSearch{
				Contextified: libkb.NewContextified(g)}, "search", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSearch) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	paths, err := cli.SimpleFSSearch(context.TODO(), c.query)
	if err != nil {
		return err
	}
	for _, path := range paths {
		ui.Printf("%s\n", path)
	}
	return nil
}

// ParseArgv gets the paths to search.
func (c *CmdSimpleFSSearch) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("obfuscate requires one query")
	}

	c.query = ctx.Args().Get(0)
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
