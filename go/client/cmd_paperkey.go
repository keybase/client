// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func NewCmdPaperKey(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "paperkey",
		Usage: "Generate paper keys for recovering your account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPaperKeyRunner(g), "paperkey", c)
		},
	}
}

type CmdPaperKey struct {
	libkb.Contextified
}

func NewCmdPaperKeyRunner(g *libkb.GlobalContext) *CmdPaperKey {
	return &CmdPaperKey{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPaperKey) Run() error {
	cli, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewLoginUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	return cli.PaperKey(context.TODO(), 0)
}

func (c *CmdPaperKey) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdPaperKey) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
