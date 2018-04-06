// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
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
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	payments, err := cli.RecentPaymentsCLILocal(context.TODO(), c.accountID)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	line := func(format string, args ...interface{}) {
		dui.Printf(format+"\n", args...)
	}
	for _, p := range payments {
		timeStr := p.Time.Time().Format("2006/01/02 15:04")
		line("%v", timeStr)
		amount := fmt.Sprintf("%v XLM", libkb.StellarSimplifyAmount(p.Amount))
		if !p.Asset.IsNativeXLM() {
			amount = fmt.Sprintf("%v %v/%v", p.Amount, p.Asset.Code, p.Asset.Issuer)
		}
		if p.DisplayAmount != nil && p.DisplayCurrency != nil && len(*p.DisplayAmount) > 0 && len(*p.DisplayAmount) > 0 {
			amount = fmt.Sprintf("%v %v (%v)", *p.DisplayAmount, *p.DisplayCurrency, amount)
		}
		line("%v", amount)
		// Show sender and recipient. Prefer keybase form, fall back to stellar abbreviations.
		from := p.FromStellar.LossyAbbreviation()
		to := p.ToStellar.LossyAbbreviation()
		if p.FromUsername != nil {
			from = *p.FromUsername
		}
		if p.ToUsername != nil {
			to = *p.ToUsername
		}
		showedAbbreviation := true
		if p.FromUsername != nil && p.ToUsername != nil {
			showedAbbreviation = false
		}
		line("%v -> %v", from, to)
		// If an abbreviation was shown, show the full addresses
		if showedAbbreviation || c.verbose {
			line("From: %v", p.FromStellar.String())
			line("To:   %v", p.ToStellar.String())
		}
		if len(p.Note) > 0 {
			line("Note: %v", c.filterNote(p.Note))
		}
		if len(p.NoteErr) > 0 {
			line("Note Error: %v", p.NoteErr)
		}
		if c.verbose {
			line("Transaction Hash: %v", p.StellarTxID)
		}
		if len(p.Status) > 0 && p.Status != "completed" {
			line("Status: %v", p.Status)
			if c.verbose {
				line("        %v", p.StatusDetail)
			}
		}
		line("")
	}
	if len(payments) == 0 {
		line("No recent activity")
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
