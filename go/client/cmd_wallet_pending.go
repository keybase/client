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

type CmdWalletPending struct {
	libkb.Contextified
	AccountID *stellar1.AccountID
	Verbose   bool
}

func newCmdWalletPending(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdWalletPending{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "pending",
		Usage:        "List pending payments to and from a stellar account",
		ArgumentHelp: "[--account G...] [--verbose]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "history", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "account",
				Usage: "account to look at",
			},
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "show transaction IDs and other tidbits",
			},
		},
	}
}

func (c *CmdWalletPending) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 0 {
		return errors.New("expected no arguments")
	}
	accountIDStr := ctx.String("account")
	if len(accountIDStr) > 0 {
		accountID, err := libkb.ParseStellarAccountID(accountIDStr)
		if err != nil {
			return err
		}
		c.AccountID = &accountID
	}
	c.Verbose = ctx.Bool("verbose")
	return nil
}

func (c *CmdWalletPending) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	payments, err := cli.PendingPaymentsCLILocal(context.TODO(), c.AccountID)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	lineUnescaped := func(format string, args ...interface{}) {
		_, _ = dui.PrintfUnescaped(format+"\n", args...)
	}
	// `payments` is sorted most recent first.
	// Print most recent at the bottom.
	for i := len(payments) - 1; i >= 0; i-- {
		p := payments[i]
		if p.Payment != nil {
			printPayment(c.G(), *p.Payment, c.Verbose, false /* details */, dui)
			dui.Printf(">>>> p = %+v", p.Payment)
		} else {
			lineUnescaped(ColorString(c.G(), "red", "error in payment: %v", p.Err))
		}
		lineUnescaped("")
	}
	if len(payments) == 0 {
		lineUnescaped("No recent activity")
	}
	return err
}

func (c *CmdWalletPending) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
