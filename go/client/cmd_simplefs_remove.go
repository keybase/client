// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSRemove is the 'fs rm' command.
type CmdSimpleFSRemove struct {
	libkb.Contextified
	paths   []keybase1.Path
	recurse bool
}

// NewCmdSimpleFSRemove creates a new cli.Command.
func NewCmdSimpleFSRemove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "rm",
		ArgumentHelp: "<path> [path...]",
		Usage:        "remove one or more directory elements",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSRemove{Contextified: libkb.NewContextified(g)}, "rm", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, recursive",
				Usage: "Recursively delete everything in a directory",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSRemove) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	paths, err := doSimpleFSGlob(ctx, c.G(), cli, c.paths)
	if err != nil {
		return err
	}

	for _, path := range paths {
		opid, err2 := cli.SimpleFSMakeOpid(ctx)
		if err2 != nil {
			return err2
		}
		defer cli.SimpleFSClose(ctx, opid)
		c.G().Log.Debug("SimpleFSRemove %s", path.Kbfs())
		err = cli.SimpleFSRemove(ctx, keybase1.SimpleFSRemoveArg{
			OpID:      opid,
			Path:      path,
			Recursive: c.recurse,
		})
		if err != nil {
			break
		}
		err = cli.SimpleFSWait(ctx, opid)
		if err != nil {
			break
		}
	}
	return err
}

// ParseArgv gets the required path argument for this command.
func (c *CmdSimpleFSRemove) ParseArgv(ctx *cli.Context) error {
	c.recurse = ctx.Bool("recursive")

	nargs := len(ctx.Args())
	var err error

	if nargs < 1 {
		return errors.New("rm requires at least one KBFS path argument")
	}

	for _, src := range ctx.Args() {
		argPath, err := makeSimpleFSPath(src)
		if err != nil {
			return err
		}
		pathType, err := argPath.PathType()
		if err != nil {
			return err
		}
		if pathType != keybase1.PathType_KBFS {
			return errors.New("rm requires KBFS path arguments")
		}
		c.paths = append(c.paths, argPath)
	}
	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSRemove) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
