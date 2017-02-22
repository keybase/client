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

// CmdSimpleFSMove is the 'fs list' command.
type CmdSimpleFSMove struct {
	libkb.Contextified
	src  []keybase1.Path
	dest keybase1.Path
}

// NewCmdSimpleFSMove creates a new cli.Command.
func NewCmdSimpleFSMove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mv",
		ArgumentHelp: "<source> [source] <dest>",
		Usage:        "copy one or more directory elements to dest",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSMove{Contextified: libkb.NewContextified(g)}, "mv", c)
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSMove) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	for _, src := range c.src {
		opid, err := cli.SimpleFSMakeOpid(ctx)
		if err != nil {
			return err
		}
		defer cli.SimpleFSClose(ctx, opid)

		err = cli.SimpleFSMove(ctx, keybase1.SimpleFSMoveArg{
			OpID: opid,
			Src:  src,
			Dest: c.dest,
		})
		if err != nil {
			break
		}
	}
	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSMove) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	var srcType, destType keybase1.PathType

	if nargs < 2 {
		return errors.New("mv requires one or more source arguments and a destination argument")
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
			return errors.New("mv requires all sources to be the same type")
		}
		c.src = append(c.src, argPath)
	}

	if srcType == keybase1.PathType_LOCAL && destType == keybase1.PathType_LOCAL {
		return errors.New("cp reaquires KBFS source and/or destination")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSMove) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
