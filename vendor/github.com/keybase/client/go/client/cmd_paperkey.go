// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

func NewCmdPaperKey(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "paperkey",
		Usage: "Generate paper keys for recovering your account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPaperKey{}, "paperkey", c)
		},
	}
}

type CmdPaperKey struct {
}

func (c *CmdPaperKey) Run() error {
	cli, err := GetLoginClient(G)
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewLoginUIProtocol(G),
		NewSecretUIProtocol(G),
	}
	if err := RegisterProtocols(protocols); err != nil {
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
