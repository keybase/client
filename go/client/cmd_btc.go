// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CmdBTC struct {
	libkb.Contextified
	address string
	force   bool
}

func (c *CmdBTC) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Must provide exactly one address.")
	}
	c.address = ctx.Args()[0]
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdBTC) SetAddress(s string) {
	c.address = s
}

func (c *CmdBTC) Run() (err error) {
	cli, err := GetBTCClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	err = cli.RegisterBTC(context.TODO(), keybase1.RegisterBTCArg{
		Address: c.address,
		Force:   c.force,
	})
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("Added bitcoin address %s\n", c.address)
	return nil
}

func NewCmdBTC(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "btc",
		Usage:        "Claim a bitcoin address",
		ArgumentHelp: "<address>",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Overwrite an existing address.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdBTCRunner(g), "btc", c)
		},
	}
}

func NewCmdBTCRunner(g *libkb.GlobalContext) *CmdBTC {
	return &CmdBTC{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdBTC) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
