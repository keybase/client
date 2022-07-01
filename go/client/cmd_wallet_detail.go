// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type cmdWalletDetail struct {
	libkb.Contextified
	TxID string
}

func newCmdWalletDetail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletDetail{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "detail",
		Aliases:      []string{"details"},
		Usage:        "Show payment details",
		ArgumentHelp: "<transaction ID>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "detail", c)
		},
	}
}

func (c *cmdWalletDetail) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) == 0 {
		return errors.New("expected a tx ID (run 'keybase wallet history -v' to find one)")
	}
	if len(ctx.Args()) != 1 {
		return errors.New("expected one argument")
	}
	c.TxID = ctx.Args()[0]
	return nil
}

func (c *cmdWalletDetail) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	detail, err := cli.PaymentDetailCLILocal(context.TODO(), c.TxID)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	printPayment(c.G(), detail, true /* verbose */, true /* details */, dui)
	return nil
}

func (c *cmdWalletDetail) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
