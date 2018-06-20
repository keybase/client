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

type cmdWalletFixup struct {
	libkb.Contextified
}

func newCmdWalletFixup(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletFixup{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "fixup",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "fixup", c)
		},
		Description: "Fix up for CORE-8135",
	}
}

func (c *cmdWalletFixup) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 0 {
		return errors.New("expected no arguments")
	}
	return nil
}

func (c *cmdWalletFixup) Run() (err error) {
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	wasAlreadyFixed, err := cli.FixupBundleCLILocal(context.TODO())
	if err != nil {
		return err
	}
	ui := c.G().UI.GetTerminalUI()
	if wasAlreadyFixed {
		ui.Printf("Wallet bundle was already fixed\n")
	} else {
		ui.Printf("Wallet bundle was busted... but now it is fixed\n")
	}
	ui.Printf("✔ Success\n")
	return nil
}

func (c *cmdWalletFixup) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
