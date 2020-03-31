// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// CmdSimpleFSResetIndex is the 'fs reset-index' command.
type CmdSimpleFSResetIndex struct {
	libkb.Contextified
}

// NewCmdSimpleFSResetIndex creates a new cli.Command.
func NewCmdSimpleFSResetIndex(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "reset-index",
		Usage: "[disabled] delete all local index storage, and resets the indexer",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSResetIndex{
				Contextified: libkb.NewContextified(g)}, "reset-index", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSResetIndex) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	return cli.SimpleFSResetIndex(context.TODO())
}

// ParseArgv gets the optional flags and the query.
func (c *CmdSimpleFSResetIndex) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return fmt.Errorf("wrong number of arguments")
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSResetIndex) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
