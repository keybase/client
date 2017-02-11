// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSCheck is the 'simplefs srar' command.
type CmdSimpleFSCheck struct {
	libkb.Contextified
	opid keybase1.OpID
}

// NewCmdSimpleFSCheck creates a new cli.Command.
func NewCmdSimpleFSCheck(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "check",
		Usage: "check pending operation",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "check", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSimpleFSCheck) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	progress, err := cli.SimpleFSCheck(context.TODO(), c.opid)
	if err != nil {
		return err
	}

	w := GlobUI.DefaultTabWriter()
	fmt.Fprintf(w, "progress: %d\n", progress)
	w.Flush()

	return err
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSCheck) ParseArgv(ctx *cli.Context) error {

	opid, err := hex.DecodeString(ctx.String("opid"))
	if err != nil {
		return err
	}
	if copy(c.opid[:], opid) != len(c.opid) {
		return errors.New("bad opid")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSCheck) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
