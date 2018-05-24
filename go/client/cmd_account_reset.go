// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdAccountReset struct {
	libkb.Contextified
}

func NewCmdAccountReset(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "reset",
		Usage: "Reset account",
		Action: func(c *cli.Context) {
			cmd := NewCmdAccountResetRunner(g)
			cl.ChooseCommand(cmd, "reset", c)
		},
	}
}

func NewCmdAccountResetRunner(g *libkb.GlobalContext) *CmdAccountReset {
	return &CmdAccountReset{Contextified: libkb.NewContextified(g)}
}

func (c *CmdAccountReset) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("reset takes no arguments")
	}
	return nil
}

func (c *CmdAccountReset) Run() error {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}
	return cli.ResetAccount(context.Background(), keybase1.ResetAccountArg{})
}

func (c *CmdAccountReset) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
