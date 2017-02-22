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

// CmdSimpleFSCopy is the 'fs cp' command.
type CmdSimpleFSCopy struct {
	libkb.Contextified
	src     []keybase1.Path
	dest    keybase1.Path
	recurse bool
}

// NewCmdSimpleFSCopy creates a new cli.Command.
func NewCmdSimpleFSCopy(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "cp",
		ArgumentHelp: "<source> [source] <dest>",
		Usage:        "copy one or more directory elements to dest",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSCopy{Contextified: libkb.NewContextified(g)}, "cp", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, recursive",
				Usage: "Recurse into subdirectories",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSCopy) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	isDestDir, destPathString, err := getDirPathString(ctx, cli, c.dest)

	if err != nil {
		return err
	}

	for _, src := range c.src {

		dest, err := makeDestPath(ctx, cli, src, c.dest, isDestDir, destPathString)
		if err != nil {
			return err
		}

		opid, err := cli.SimpleFSMakeOpid(ctx)
		if err != nil {
			return err
		}
		defer cli.SimpleFSClose(ctx, opid)
		if c.recurse {
			err = cli.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
				OpID: opid,
				Src:  src,
				Dest: dest,
			})
		} else {
			err = cli.SimpleFSCopy(ctx, keybase1.SimpleFSCopyArg{
				OpID: opid,
				Src:  src,
				Dest: dest,
			})
		}
		if err != nil {
			break
		}
	}
	return err
}

// ParseArgv gets the rquired arguments for this command.
func (c *CmdSimpleFSCopy) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.recurse = ctx.Bool("recurse")
	var srcType, destType keybase1.PathType

	if nargs < 2 {
		return errors.New("cp requires one or more source arguments and a destination argument")
	}
	for i, src := range ctx.Args() {
		argPath := makeSimpleFSPath(c.G(), src)
		tempPathType, err := argPath.PathType()
		if err != nil {
			return err
		}
		// Make sure all source paths are the same type
		if i == 0 {
			srcType = tempPathType
		} else if i == nargs-1 {
			c.dest = argPath
			destType = tempPathType
			break
		} else if tempPathType != srcType {
			return errors.New("cp requires all sources to be the same type")
		}
		c.src = append(c.src, argPath)
	}

	if srcType == keybase1.PathType_LOCAL && destType == keybase1.PathType_LOCAL {
		return errors.New("cp reaquires KBFS source and/or destination")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSCopy) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
