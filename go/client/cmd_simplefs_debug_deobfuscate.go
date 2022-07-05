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

// CmdSimpleFSDebugDeobfuscate is the 'fs debug deobfuscate' command.
type CmdSimpleFSDebugDeobfuscate struct {
	libkb.Contextified
	paths []keybase1.Path
}

// NewCmdSimpleFSDebugDeobfuscate creates a new cli.Command.
func NewCmdSimpleFSDebugDeobfuscate(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "deobfuscate",
		ArgumentHelp: "<path> [<path2> <path3>...]",
		Usage:        "Returns the possible plaintext paths for a given keybase path",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSDebugDeobfuscate{
				Contextified: libkb.NewContextified(g)}, "deobfuscate", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSDebugDeobfuscate) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	var errors []error
	for i, p := range c.paths {
		res, err := cli.SimpleFSDeobfuscatePath(context.TODO(), p)
		if err != nil {
			if len(c.paths) == 0 {
				return err
			}
			errors = append(errors, err)
		}

		tab := ""
		if len(c.paths) > 1 {
			ui.Printf("%s:\n", path.Join(mountDir, p.String()))
			tab = "  "
			if err != nil {
				ui.Printf("%sError: %v\n\n", tab, err)
				continue
			}
		}
		for _, r := range res {
			ui.Printf("%s%s\n", tab, r)
		}
		if i+1 != len(c.paths) {
			ui.Printf("\n")
		}
	}
	if len(errors) == len(c.paths) && len(errors) > 0 {
		return errors[0]
	}
	return nil
}

// ParseArgv gets the optional -r switch
func (c *CmdSimpleFSDebugDeobfuscate) ParseArgv(ctx *cli.Context) error {
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
func (c *CmdSimpleFSDebugDeobfuscate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
