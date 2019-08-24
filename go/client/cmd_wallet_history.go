// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletHistory struct {
	libkb.Contextified
	accountID *stellar1.AccountID
	verbose   bool
}

func newCmdWalletHistory(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletHistory{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "history",
		Usage:        "List recent payments to and from a stellar account",
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

func (c *cmdWalletHistory) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 0 {
		return errors.New("expected no arguments")
	}
	accountIDStr := ctx.String("account")
	if len(accountIDStr) > 0 {
		accountID, err := libkb.ParseStellarAccountID(accountIDStr)
		if err != nil {
			return err
		}
		c.accountID = &accountID
	}
	c.verbose = ctx.Bool("verbose")
	return nil
}

func (c *cmdWalletHistory) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	payments, err := cli.RecentPaymentsCLILocal(context.TODO(), c.accountID)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	lineUnescaped := func(format string, args ...interface{}) {
		dui.PrintfUnescaped(format+"\n", args...)
	}
	// `payments` is sorted most recent first.
	// Print most recent at the bottom.
	for i := len(payments) - 1; i >= 0; i-- {
		p := payments[i]
		if p.Payment != nil {
			printPayment(c.G(), *p.Payment, c.verbose, false /* details */, dui)
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

// Pare down the note so that it's less likely to contain tricks.
// Such as newlines and fake transactions.
// Shows only the first line.
func (c *cmdWalletHistory) filterNote(note string) string {
	lines := strings.Split(strings.TrimSpace(note), "\n")
	if len(lines) < 1 {
		return ""
	}
	return strings.TrimSpace(lines[0])
}

func (c *cmdWalletHistory) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
