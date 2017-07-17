// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"encoding/hex"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSPs is the 'fs ps' command.
type CmdSimpleFSPs struct {
	libkb.Contextified
	path    keybase1.Path
	recurse bool
}

// NewCmdSimpleFSPs creates a new cli.Command.
func NewCmdSimpleFSPs(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "ps",
		Usage: "list running operations",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSPs{Contextified: libkb.NewContextified(g)}, "ps", c)
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSPs) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ops, err := cli.SimpleFSGetOps(context.TODO())

	c.output(ops)

	return err
}

func getPathString(path keybase1.Path) string {
	pathType, err := path.PathType()
	if err != nil {
		return ""
	}
	if pathType == keybase1.PathType_KBFS {
		return path.Kbfs()
	}
	return path.Local()
}

func outputOp(ui libkb.TerminalUI, o keybase1.OpDescription) {
	op, err := o.AsyncOp()
	if err != nil {
		ui.Printf("%s", err)
		return
	}
	switch op {
	case keybase1.AsyncOps_LIST:
		list := o.List()
		ui.Printf("%s\t%s\t%s\n", hex.EncodeToString(list.OpID[:]), op.String(), getPathString(list.Path))
	case keybase1.AsyncOps_LIST_RECURSIVE:
		list := o.ListRecursive()
		ui.Printf("%s\t%s\t%s\n", hex.EncodeToString(list.OpID[:]), op.String(), getPathString(list.Path))
	case keybase1.AsyncOps_READ:
		read := o.Read()
		ui.Printf("%s\t%s\t%s\t%d\t%d\n", hex.EncodeToString(read.OpID[:]), op.String(), getPathString(read.Path), read.Offset, read.Size)
	case keybase1.AsyncOps_WRITE:
		write := o.Write()
		ui.Printf("%s\t%s\t%s\t%d\n", hex.EncodeToString(write.OpID[:]), op.String(), getPathString(write.Path), write.Offset)
	case keybase1.AsyncOps_COPY:
		copy := o.Copy()
		ui.Printf("%s\t%s\t%s\t%s\n", hex.EncodeToString(copy.OpID[:]), op.String(), getPathString(copy.Src), getPathString(copy.Dest))
	case keybase1.AsyncOps_MOVE:
		move := o.Move()
		ui.Printf("%s\t%s\t%s\t%s\n", hex.EncodeToString(move.OpID[:]), op.String(), getPathString(move.Src), getPathString(move.Dest))
	case keybase1.AsyncOps_REMOVE:
		remove := o.Remove()
		ui.Printf("%s\t%s\t%s\n", hex.EncodeToString(remove.OpID[:]), op.String(), getPathString(remove.Path))
	}
}

func (c *CmdSimpleFSPs) output(ops []keybase1.OpDescription) {
	ui := c.G().UI.GetTerminalUI()
	for _, e := range ops {
		outputOp(ui, e)
	}
}

// ParseArgv gets the optional -r switch
func (c *CmdSimpleFSPs) ParseArgv(ctx *cli.Context) error {

	c.recurse = ctx.Bool("recurse")

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSPs) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
