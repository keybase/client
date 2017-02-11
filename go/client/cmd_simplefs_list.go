// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"encoding/hex"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSList is the 'simplefs list' command.
type CmdSimpleFSList struct {
	libkb.Contextified
	opid    keybase1.OpID
	path    keybase1.Path
	recurse bool
	argOpid bool // set when -o is used
}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdSimpleFSList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "ls",
		ArgumentHelp: "<path>",
		Usage:        "list directory contents",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "ls", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, recursive",
				Usage: "recurse into subdirectories",
			},
			cli.StringFlag{
				Name:  "o, opid",
				Usage: "retrieve results",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSList) Run() error {
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
			err = cli.SimpleFSListRecursive(context.TODO(), keybase1.SimpleFSListRecursiveArg{
				OpID: c.opid,
				Path: c.path,
			})
		} else {
			err = cli.SimpleFSList(context.TODO(), keybase1.SimpleFSListArg{
				OpID: c.opid,
				Path: c.path,
			})
		}
		if err != nil {
			return err
		}
	}

	for {
		listResult, err := cli.SimpleFSReadList(context.TODO(), c.opid)
		if err != nil {
			break
		}
		c.output(listResult)
		// break if we're done or the async opid was provided
		if listResult.Progress == 100 || c.argOpid {
			break // TODO: ???
		}
	}

	return err
}

func (c *CmdSimpleFSList) output(listResult keybase1.SimpleFSListResult) {
	w := GlobUI.DefaultTabWriter()
	for _, e := range listResult.Entries {
		fmt.Fprintf(w, "%s\t%s\t%d\t%s\n", keybase1.FormatTime(e.Time), keybase1.DirentTypeRevMap[e.DirentType], e.Size, e.Name)
	}
	w.Flush()
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSList) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.recurse = ctx.Bool("recurse")
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

	if nargs == 1 {
		c.path = MakeSimpleFSPath(ctx.Args()[0])
	} else {
		err = fmt.Errorf("List requires a path argument.")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
