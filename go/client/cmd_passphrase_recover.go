// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdPassphraseRecover struct {
	libkb.Contextified
}

func NewCmdPassphraseRecover(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "recover",
		Usage: "Recover your keybase account passphrase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPassphraseRecoverRunner(g), "recover", c)
		},
	}
}

func NewCmdPassphraseRecoverRunner(g *libkb.GlobalContext) *CmdPassphraseRecover {
	return &CmdPassphraseRecover{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPassphraseRecover) confirm() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Password recovery will put your account on probation for 5 days.\n")
	ui.Printf("You won't be able to perform certain actions, like revoking devices.\n")

	hsk, err := hasServerKeys(c.G())
	if err != nil {
		return err
	}
	if hsk.HasServerKeys {
		ui.Printf("You have uploaded an encrypted PGP private key, it will be lost.\n")
	}
	return ui.PromptForConfirmation("Continue with password recovery?")
}

func (c *CmdPassphraseRecover) Run() error {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	loggedIn, err := c.G().LoginState().LoggedInLoad()
	if err != nil {
		c.G().Log.Debug("Passphrase recover couldn't query LoggedInProvisionedLoad: %v", err)
		loggedIn = false
	}
	if !loggedIn {
		ui := c.G().UI.GetTerminalUI()
		ui.Printf("Passphrase recovery requires that you are logged in first.\n")
		ui.Printf("Please run `keybase login` before `keybase passphrase recover`.\n")
		ui.Printf("But don't panic, you can log in with a paper key.\n")
		return fmt.Errorf("Passphrase recovery requires login")
	}

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
