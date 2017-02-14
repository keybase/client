// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"os"
	"time"

	"golang.org/x/net/context"

	"encoding/hex"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSMove is the 'simplefs list' command.
type CmdSimpleFSMove struct {
	libkb.Contextified
	opid    keybase1.OpID
	src     keybase1.Path
	dest    keybase1.Path
	argOpid bool // set when -o is used
}

// NewCmdSimpleFSMove creates a new cli.Command.
func NewCmdSimpleFSMove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mv",
		ArgumentHelp: "<source> [dest]",
		Usage:        "move directory elements",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "mv", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "o, opid",
				Usage: "retrieve results",
			},
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSMove) Run() error {
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

		err = cli.SimpleFSMove(context.TODO(), keybase1.SimpleFSMoveArg{
			OpID: c.opid,
			Dest: c.src,
		})

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
func (c *CmdSimpleFSMove) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if ctx.String("opid") != "" {
		opid, err := hex.DecodeString(ctx.String("opid"))
		if err != nil {
			return err
		}
		if copy(c.opid[:], opid) != len(c.opid) {
			return fmt.Errorf("bad opid")
		}
		c.argOpid = true
	}

	if nargs < 1 || nargs > 2 {
		return errors.New("mv requires a source path (and optional destination) argument")
	}

	c.src = MakeSimpleFSPath(c.G(), ctx.Args()[0])
	if nargs == 2 {
		c.dest = MakeSimpleFSPath(c.G(), ctx.Args()[1])
	} else {
		// use the current local directory as a default
		wd, _ := os.Getwd()
		c.dest = MakeSimpleFSPath(c.G(), wd)
	}
	srcType, _ := c.src.PathType()
	destType, _ := c.dest.PathType()
	if srcType == keybase1.PathType_LOCAL && destType == keybase1.PathType_LOCAL {
		return errors.New("mv requires KBFS source and/or destination")
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
