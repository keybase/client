// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"fmt"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// CmdSimpleFSSetDebugLevel is the 'fs set-debug-level' command.
type CmdSimpleFSSetDebugLevel struct {
	libkb.Contextified
	level string
}

// NewCmdSimpleFSSetDebugLevel creates a new cli.Command.
func NewCmdSimpleFSSetDebugLevel(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "set-debug-level",
		ArgumentHelp: "<integer_level>",
		Usage:        "Changes the amount of debug logging done by the file system",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSetDebugLevel{
				Contextified: libkb.NewContextified(g)}, "set-debug-level", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSetDebugLevel) Run() error {
	if c.level > libkb.VLog0String {
		ui := c.G().UI.GetTerminalUI()
		ui.Printf("WARNING: this will make file and directory names visible in your logs.\n")
		ui.Printf("If you send the logs to Keybase for debugging, those names will be\n")
		ui.Printf("visible to Keybase employees as well.  File contents will remain private.\n")
	}

	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	return cli.SimpleFSSetDebugLevel(context.TODO(), c.level)
}

// ParseArgv gets and validates the level string.
func (c *CmdSimpleFSSetDebugLevel) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("wrong number of arguments")
	}

	level, err := strconv.Atoi(ctx.Args()[0])
	if err != nil {
		return fmt.Errorf("The log level must be an integer")
	}
	c.level = libkb.VDebugLevel(level).String()
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSSetDebugLevel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
