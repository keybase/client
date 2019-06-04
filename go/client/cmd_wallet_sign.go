// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"io/ioutil"
	"os"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type CmdWalletSign struct {
	libkb.Contextified
	XDR       string
	AccountID stellar1.AccountID
	Submit    bool
}

func newCmdWalletSign(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdWalletSign{
		Contextified: libkb.NewContextified(g),
	}
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "xdr",
			Usage: "Base64-encoded XDR of transaction envelope. If not provided, will be read from stdin.",
		},
		cli.StringFlag{
			Name:  "account",
			Usage: "Account ID to sign with. Optional, if not provided, SourceAccount of the transaction will be used.",
		},
		cli.BoolFlag{
			Name:  "submit",
			Usage: "Submit signed transaction to the network.",
		},
	}
	return cli.Command{
		Name:  "sign",
		Usage: "Sign a Stellar transaction created elsewhere",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "sign", c)
		},
		Flags: flags,
	}
}

func (c *CmdWalletSign) ParseArgv(ctx *cli.Context) error {
	c.XDR = ctx.String("xdr")
	c.AccountID = stellar1.AccountID(ctx.String("account"))
	c.Submit = ctx.Bool("submit")
	return nil
}

func (c *CmdWalletSign) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	if c.XDR == "" {
		bytes, err := ioutil.ReadAll(os.Stdin)
		if err != nil {
			return err
		}
		c.XDR = string(bytes)
	}

	c.XDR = strings.TrimSpace(c.XDR)

	var maybeAccount *stellar1.AccountID
	if !c.AccountID.IsNil() {
		maybeAccount = &c.AccountID
	}
	arg := stellar1.SignTransactionXdrLocalArg{
		EnvelopeXdr: c.XDR,
		AccountID:   maybeAccount,
		Submit:      c.Submit,
	}
	res, err := cli.SignTransactionXdrLocal(context.Background(), arg)
	if err != nil {
		return err
	}
	ui := c.G().UI.GetDumbOutputUI()
	ui.PrintfStderr(ColorString(c.G(), "green", "Signing with account ID: %s\n", res.AccountID.String()))
	ui.Printf("%s\n", res.SingedTx)
	if res.SubmitErr != nil {
		ui.PrintfStderr(ColorString(c.G(), "red", "Failed to submit the transaction: %s\n", *res.SubmitErr))
	} else if res.SubmitTxID != nil {
		ui.PrintfStderr(ColorString(c.G(), "green", "Transaction submitted to the network. Transaction ID: %s\n", res.SubmitTxID.String()))
	}
	return nil
}

func (c *CmdWalletSign) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
