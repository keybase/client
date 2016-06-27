// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func newCmdFS(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "fs",
		ArgumentHelp: "[arguments...]",
		Usage:        "File system",
		Subcommands: []cli.Command{
			newCmdFSList(cl, g),
		},
	}
}

type cmdFSList struct {
	libkb.Contextified
	path string
}

func newCmdFSList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list",
		Usage:        "List files",
		ArgumentHelp: "<path>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdFSList{Contextified: libkb.NewContextified(g)}, "list", c)
		},
	}
}

func (c *cmdFSList) Run() error {
	arg := keybase1.ListArg{
		Path: c.path,
	}
	fsClient, err := GetFSClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewIdentifyUIProtocol(c.G()),
	}
	if regErr := RegisterProtocolsWithContext(protocols, c.G()); regErr != nil {
		return regErr
	}

	results, err := fsClient.List(context.TODO(), arg)
	if err != nil {
		return err
	}

	out, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}

func (c *cmdFSList) ParseArgv(ctx *cli.Context) error {
	c.path = ctx.Args().First()
	return nil
}

func (c *cmdFSList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
