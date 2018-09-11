// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdAccountDelete struct {
	libkb.Contextified
}

func NewCmdAccountDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "delete",
		Usage: "Permanently delete account",
		Action: func(c *cli.Context) {
			cmd := NewCmdAccountDeleteRunner(g)
			cl.ChooseCommand(cmd, "delete", c)
		},
	}
}

func (c *CmdAccountDelete) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("delete takes no arguments")
	}
	return nil
}

func NewCmdAccountDeleteRunner(g *libkb.GlobalContext) *CmdAccountDelete {
	return &CmdAccountDelete{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdAccountDelete) Run() error {
	ui := c.G().UI.GetTerminalUI()
	err := ui.PromptForConfirmation("Are you sure you want to " + ColorString(c.G(), "red", "permanently delete") + " your account?")
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	return cli.AccountDelete(context.Background(), 0)
}

func (c *CmdAccountDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
