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

// CmdSimpleFSReset is the 'fs reset' command.
type CmdSimpleFSReset struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSReset creates a new cli.Command.
func NewCmdSimpleFSReset(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "reset",
		ArgumentHelp: "[path-to-folder]",
		Usage:        "resets the given TLF after asking for confirmation",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSReset{
				Contextified: libkb.NewContextified(g)}, "reset", c)
			cl.SetNoStandalone()
		},
	}
}

func (c *CmdSimpleFSReset) confirm() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("This command will reset the entire folder %s\n", c.path)
	ui.Printf("You will completely lose access to all data in that folder\n")
	ui.Printf("You should probably only do this if someone at Keybase told you to.\n")
	ui.Printf("Before resetting, contact Keybase admins for a server-side reset by:\n")
	ui.Printf("  1) Filing an issue at https://github.com/keybase/client; or\n")
	ui.Printf("  2) Running `keybase log send` and describing the problem.)\n")
	return ui.PromptForConfirmation("Continue resetting the folder?")
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSReset) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	err = c.confirm()
	if err != nil {
		return err
	}

	err = cli.SimpleFSReset(context.TODO(), c.path)
	if err != nil {
		return err
	}

	return err
}

// ParseArgv gets the optional path, if any.
func (c *CmdSimpleFSReset) ParseArgv(ctx *cli.Context) error {
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
func (c *CmdSimpleFSReset) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
