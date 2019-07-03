// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSIndex is the 'fs index' command.
type CmdSimpleFSIndex struct {
	libkb.Contextified
	paths []keybase1.Path
}

// NewCmdSimpleFSIndex creates a new cli.Command.
func NewCmdSimpleFSIndex(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "index",
		ArgumentHelp: "<path> [<path2> <path3>...]",
		Usage:        "Indexes given keybase path",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSIndex{
				Contextified: libkb.NewContextified(g)}, "index", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSIndex) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	for _, p := range c.paths {
		err := cli.SimpleFSDoIndex(context.TODO(), p)
		if err != nil {
			return err
		}
	}
	return nil
}

// ParseArgv gets the paths to index.
func (c *CmdSimpleFSIndex) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return errors.New("index requires at least one KBFS path argument")
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
func (c *CmdSimpleFSIndex) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
