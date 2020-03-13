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

type CmdWalletYank struct {
	libkb.Contextified
	TxID string
}

func newCmdWalletYank(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdWalletYank{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "yank",
		Aliases:      []string{"reclaim"},
		Usage:        "Yank pending payment",
		ArgumentHelp: "<transaction ID>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "cancel", c)
		},
	}
}

func (c *CmdWalletYank) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) == 0 {
		return errors.New("expected a tx ID (run 'keybase wallet history -v' to find one)")
	}
	if len(ctx.Args()) != 1 {
		return errors.New("expected one argument")
	}
	c.TxID = ctx.Args()[0]
	return nil
}

func (c *CmdWalletYank) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	_, err = cli.CancelCLILocal(context.TODO(), stellar1.CancelCLILocalArg{TxID: c.TxID})
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Funds claimed!\n")
	return nil
}

func (c *CmdWalletYank) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
