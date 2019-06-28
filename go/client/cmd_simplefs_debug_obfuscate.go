// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"path"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSDebugObfuscate is the 'fs debug obfuscate' command.
type CmdSimpleFSDebugObfuscate struct {
	libkb.Contextified
	paths []keybase1.Path
}

// NewCmdSimpleFSDebugObfuscate creates a new cli.Command.
func NewCmdSimpleFSDebugObfuscate(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "obfuscate",
		ArgumentHelp: "<path> [<path2> <path3>...]",
		Usage:        "Returns the obfuscated path for a given keybase path",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSDebugObfuscate{
				Contextified: libkb.NewContextified(g)}, "obfuscate", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSDebugObfuscate) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	for _, p := range c.paths {
		res, err := cli.SimpleFSObfuscatePath(context.TODO(), p)
		if err != nil {
			return err
		}

		if len(c.paths) == 1 {
			ui.Printf("%s\n", res)
		} else {
			ui.Printf("%s: %s\n", path.Join(mountDir, p.String()), res)
		}
	}
	return nil
}

// ParseArgv gets the optional -r switch
func (c *CmdSimpleFSDebugObfuscate) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return errors.New("obfuscate requires at least one KBFS path argument")
	}

	for _, p := range ctx.Args() {
		kp, err := makeSimpleFSPath(p)
		if err != nil {
			return err
		}
		c.paths = append(c.paths, kp)
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSDebugObfuscate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
