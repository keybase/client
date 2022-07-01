// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletCancel struct {
	libkb.Contextified
	TxID string
}

func newCmdWalletCancel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletCancel{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "cancel",
		Aliases:      []string{"reclaim"},
		Usage:        "Cancel a payment",
		ArgumentHelp: "<transaction ID>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "cancel", c)
		},
	}
}

func (c *cmdWalletCancel) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) == 0 {
		return errors.New("expected a tx ID (run 'keybase wallet history -v' to find one)")
	}
	if len(ctx.Args()) != 1 {
		return errors.New("expected one argument")
	}
	c.TxID = ctx.Args()[0]
	return nil
}

func (c *cmdWalletCancel) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	_, err = cli.ClaimCLILocal(context.TODO(), stellar1.ClaimCLILocalArg{TxID: c.TxID})
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Funds claimed!\n")
	return nil
}

func (c *cmdWalletCancel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
