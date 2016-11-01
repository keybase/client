// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdCurrency struct {
	libkb.Contextified
	address string
	force   bool
}

func (c *CmdCurrency) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Must provide exactly one address.")
	}
	c.address = ctx.Args()[0]
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdCurrency) SetAddress(s string) {
	c.address = s
}

func (c *CmdCurrency) Run() (err error) {
	cli, err := GetCryptocurrencyClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	res, err := cli.RegisterAddress(context.TODO(), keybase1.RegisterAddressArg{
		Address: c.address,
		Force:   c.force,
	})
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("Added %s address %s\n", res.Family, c.address)
	return nil
}

func NewCmdCurrency(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "currency",
		Usage:        "Claim a bitcoin or zcash address",
		ArgumentHelp: "<address>",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Overwrite an existing address.",
			},
		},
		Aliases: []string{"btc"},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdCurrencyRunner(g), "currency", c)
		},
	}
}

func NewCmdCurrencyRunner(g *libkb.GlobalContext) *CmdCurrency {
	return &CmdCurrency{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdCurrency) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
