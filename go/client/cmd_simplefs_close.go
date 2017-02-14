// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSClose is the 'simplefs srar' command.
type CmdSimpleFSClose struct {
	libkb.Contextified
	opid keybase1.OpID
}

// NewCmdSimpleFSClose creates a new cli.Command.
func NewCmdSimpleFSClose(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "close",
		ArgumentHelp: "<opid>",
		Usage:        "close operation",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "close", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSClose) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	err = cli.SimpleFSClose(context.TODO(), c.opid)

	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSClose) ParseArgv(ctx *cli.Context) error {

	opid, err := hex.DecodeString(ctx.String("opid"))
	if err != nil {
		return err
	}
	if copy(c.opid[:], opid) != len(c.opid) {
		return errors.New("bad or missing opid")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSClose) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
