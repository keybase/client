// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"time"

	"golang.org/x/net/context"

	"encoding/hex"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSRemove is the 'simplefs rm' command.
type CmdSimpleFSRemove struct {
	libkb.Contextified
	opid    keybase1.OpID
	path    keybase1.Path
	argOpid bool // set when -o is used
}

// NewCmdSimpleFSRemove creates a new cli.Command.
func NewCmdSimpleFSRemove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "rm",
		ArgumentHelp: "<path>",
		Usage:        "remove directory elements",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "rm", c)
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
func (c *CmdSimpleFSRemove) Run() error {
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
		err = cli.SimpleFSRemove(context.TODO(), keybase1.SimpleFSRemoveArg{
			OpID: c.opid,
			Path: c.path,
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
func (c *CmdSimpleFSRemove) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

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

	if nargs == 1 {
		c.path = MakeSimpleFSPath(ctx.Args()[0])
	}

	if pathType, _ := c.path.PathType(); pathType != keybase1.PathType_KBFS {
		err = errors.New("rm requires a KBFS path argument")
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
