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

type cmdWalletRename struct {
	libkb.Contextified
	AccountID stellar1.AccountID
	Name      string
}

func newCmdWalletRename(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletRename{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "rename",
		Description:  "Rename a Stellar account",
		Usage:        "Rename a Stellar account",
		ArgumentHelp: "<account-id> '<new name>'",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "rename", c)
		},
	}
}

func (c *cmdWalletRename) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		return errors.New("expected two arguments")
	}
	c.AccountID, err = libkb.ParseStellarAccountID(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.Name = ctx.Args()[1]
	return nil
}

func (c *cmdWalletRename) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	_, err = cli.ChangeWalletAccountNameLocal(context.TODO(), stellar1.ChangeWalletAccountNameLocalArg{
		AccountID: c.AccountID,
		NewName:   c.Name,
	})
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("✓ Account renamed\n")
	return err
}

func (c *cmdWalletRename) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
