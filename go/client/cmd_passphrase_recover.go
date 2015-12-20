// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdPassphraseRecover struct {
	libkb.Contextified
}

func NewCmdPassphraseRecover(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "recover",
		Usage: "Recover your keybase account passphrase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPassphraseRecover{Contextified: libkb.NewContextified(g)}, "recover", c)
		},
	}
}

func (c *CmdPassphraseRecover) confirm() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Password recovery will put your account on probation for 5 days.\n")
	ui.Printf("You won't be able to perform certain actions, like revoking devices.\n")
	return ui.PromptForConfirmation("Continue with password recovery?")
}

func (c *CmdPassphraseRecover) Run() error {
	if err := c.confirm(); err != nil {
		return err
	}
	pp, err := PromptNewPassphrase(c.G())
	if err != nil {
		return err
	}
	return passphraseChange(c.G(), newChangeArg(pp, true))
}

func (c *CmdPassphraseRecover) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdPassphraseRecover) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
