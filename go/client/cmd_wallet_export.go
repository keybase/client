// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type cmdWalletExport struct {
	libkb.Contextified
	accountID string
}

func newCmdWalletExport(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletExport{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "export",
		Description:  "Export a stellar account's secret key",
		Usage:        "Export a stellar account's secret key",
		ArgumentHelp: "[<account ID>]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "export", c)
		},
		Flags: []cli.Flag{},
	}
}

func (c *cmdWalletExport) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) > 1 {
		return errors.New("expected zero or one arguments")
	}
	if len(ctx.Args()) > 0 {
		c.accountID = ctx.Args()[0]
	}
	return nil
}

func (c *cmdWalletExport) Run() (err error) {
	defer transformStellarCLIError(&err)
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	var accountID stellar1.AccountID
	if len(c.accountID) > 0 {
		accountID, err = libkb.ParseStellarAccountID(c.accountID)
		if err != nil {
			return err
		}
	}
	if len(accountID) == 0 {
		accounts, err := cli.WalletGetAccountsCLILocal(context.Background())
		if err != nil {
			return err
		}
		if len(accounts) == 1 {
			accountID = accounts[0].AccountID
		} else {
			dui.Printf("You have multiple accounts.\n")
			dui.Printf("Run 'keybase wallet balances' to list them.\n")
			dui.Printf("Then run 'keybase wallet export <account ID>' to export one.\n")
			return fmt.Errorf("account selection required")
		}
	}

	secKey, err := cli.ExportSecretKeyLocal(context.TODO(), accountID)
	if err != nil {
		return err
	}
	dui.Printf("This secret key is used to send money and manage your stellar account.\n")
	dui.Printf("Anyone with the secret will have full access to the account.\n")
	dui.Printf("\nAccount ID: %s\n\nKeep it secret.\nSecret Key: %s\nKeep it safe.\n", accountID.String(), secKey.SecureNoLogString())
	return
}

func (c *cmdWalletExport) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
