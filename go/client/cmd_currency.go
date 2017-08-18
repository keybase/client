// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdCurrencyAdd struct {
	libkb.Contextified
	address string
	force   bool
	wanted  string
}

func NewCmdCurrency(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "currency",
		Usage:        "Manage cryptocurrency addresses",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdCurrencyAdd(cl, g),
		},
	}
}

func NewCmdBTC(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "btc",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdBTCRunner(g), "btc", c)
		},
	}
}

type CmdBTC struct {
	libkb.Contextified
}

func NewCmdBTCRunner(g *libkb.GlobalContext) *CmdBTC {
	return &CmdBTC{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdBTC) Run() (err error) {
	return errors.New("this command is deprecated; use `keybase currency add` instead")
}

func (c *CmdBTC) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (c *CmdBTC) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdCurrencyAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Must provide exactly one address.")
	}
	c.address = ctx.Args()[0]
	c.force = ctx.Bool("force")
	w := ctx.String("type")
	if !(w == "bitcoin" || w == "zcash" || w == "") {
		return fmt.Errorf("Bad address type; can only handle 'zcash' or 'bitcoin")
	}
	c.wanted = w
	return nil
}

func (c *CmdCurrencyAdd) SetAddress(s string) {
	c.address = s
}

func (c *CmdCurrencyAdd) Run() (err error) {
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
		Address:      c.address,
		Force:        c.force,
		WantedFamily: c.wanted,
	})
	if err != nil {
		if _, ok := err.(libkb.ExistsError); ok {
			err = fmt.Errorf("You already have a %s address; use --force to overwrite", err.Error())
		}
		return err
	}
	c.G().UI.GetTerminalUI().Printf("Added %s address %s\n", res.Family, c.address)
	return nil
}

func NewCmdCurrencyAdd(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "add",
		Usage:        "Sign a cryptocurrency (bitcoin or zcash) address into your identity",
		ArgumentHelp: "<address>",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Overwrite an existing address.",
			},
			cli.StringFlag{
				Name:  "t, type",
				Usage: "assert a type of address ('bitcoin' or 'zcash')",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdCurrencyAddRunner(g), "add", c)
		},
	}
}

func NewCmdCurrencyAddRunner(g *libkb.GlobalContext) *CmdCurrencyAdd {
	return &CmdCurrencyAdd{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdCurrencyAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
