// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"os"
	"time"

	"golang.org/x/net/context"

	"encoding/hex"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSCopy is the 'simplefs list' command.
type CmdSimpleFSCopy struct {
	libkb.Contextified
	opid    keybase1.OpID
	src     keybase1.Path
	dest    keybase1.Path
	recurse bool
	argOpid bool // set when -o is used
}

// NewCmdSimpleFSCopy creates a new cli.Command.
func NewCmdSimpleFSCopy(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "cp",
		ArgumentHelp: "<source> [dest]",
		Usage:        "copy directory elements",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "cp", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, recursive",
				Usage: "Recurse into subdirectories",
			},
			cli.StringFlag{
				Name:  "o, opid",
				Usage: "retrieve results",
			},
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSCopy) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	if !c.argOpid {
		c.opid, err = cli.SimpleFSMakeOpid(context.TODO())
		defer cli.SimpleFSClose(context.TODO(), c.opid)
		if err != nil {
			return err
		}
		if c.recurse {
			err = cli.SimpleFSCopyRecursive(context.TODO(), keybase1.SimpleFSCopyRecursiveArg{
				OpID: c.opid,
				Src:  c.src,
				Dest: c.src,
			})
		} else {
			err = cli.SimpleFSCopy(context.TODO(), keybase1.SimpleFSCopyArg{
				OpID: c.opid,
				Dest: c.src,
			})
		}
		if err != nil {
			return err
		}
	}

	for {
		progress, err := cli.SimpleFSCheck(context.TODO(), c.opid)
		if err != nil {
			break
		}
		// break if we're done or the opid was provided
		if progress == 100 || c.argOpid {
			break // TODO: ???
		}
		time.Sleep(100 * time.Millisecond)
	}

	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSCopy) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.recurse = ctx.Bool("recurse")
	if ctx.String("opid") != "" {
		opid, err := hex.DecodeString(ctx.String("opid"))
		if err != nil {
			return err
		}
		if copy(c.opid[:], opid) != len(c.opid) {
			return errors.New("bad opid")
		}
		c.argOpid = true
	}

	if nargs < 1 || nargs > 2 {
		return errors.New("cp requires a source path (and optional destination) argument")
	}

	c.src = MakeSimpleFSPath(ctx.Args()[0])
	if nargs == 2 {
		c.dest = MakeSimpleFSPath(ctx.Args()[1])
	} else {
		// use the current local directory as a default
		wd, _ := os.Getwd()
		c.dest = MakeSimpleFSPath(wd)
	}
	srcType, _ := c.src.PathType()
	destType, _ := c.dest.PathType()
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
