// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSRead is the 'simplefs read' command.
type CmdSimpleFSRead struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdSimpleFSRead(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "read",
		ArgumentHelp: "<path>",
		Usage:        "output file contents",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "read", c)
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSRead) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	opid, err := cli.SimpleFSMakeOpid(context.TODO())
	if err != nil {
		return err
	}
	err = cli.SimpleFSOpen(context.TODO(), keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  c.path,
		Flags: keybase1.OpenFlags_READ,
	})
	defer cli.SimpleFSClose(context.TODO(), opid)
	if err != nil {
		return err
	}
	var offset = 0
	for {
		content, err := cli.SimpleFSRead(context.TODO(), keybase1.SimpleFSReadArg{
			OpID:   opid,
			Offset: offset,
			Size:   1024,
		})
		if err != nil {
			return err
		}
		if len(content.Data) > 0 {
			offset += len(content.Data)
			c.output(content.Data)
		} else {
			break
		}
	}

	return err
}

func (c *CmdSimpleFSRead) output(data []byte) {
	w := GlobUI.DefaultTabWriter()
	io.WriteString(w, string(data))
	w.Flush()
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSRead) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if nargs == 1 {
		c.path = MakeSimpleFSPath(c.G(), ctx.Args()[0])
	} else {
		err = fmt.Errorf("read requires a path argument.")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSRead) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
