// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type CmdPassphraseChange struct {
	libkb.Contextified
	ForceArg bool
}

func NewCmdPassphraseChange(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:    "change",
		Aliases: []string{"set"},
		Usage:   "Change your keybase account passphrase.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPassphraseChangeRunner(g), "change", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name: "force",
				Usage: `Change password without entering the current one. This will set
   new password but will not be able to re-encrypt server-synced PGP keys.`,
			},
		},
	}
}

func NewCmdPassphraseChangeRunner(g *libkb.GlobalContext) *CmdPassphraseChange {
	return &CmdPassphraseChange{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPassphraseChange) Run() error {
	ui := c.G().UI.GetTerminalUI()
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	cliUser, err := GetUserClient(c.G())
	if err != nil {
		return err
	}

	forcePassphraseChange := c.ForceArg

	// If the user has a randompw, we force the password change since we cannot
	// prompt them for the old one.
	passphraseState, err := cliUser.LoadPassphraseState(context.Background(), 0)
	if err != nil {
		return err
	}
	if passphraseState == keybase1.PassphraseState_RANDOM {
		forcePassphraseChange = true
	}

	if forcePassphraseChange {
		// Check whether the user would lose server-stored encrypted PGP keys.
		// (bug) This will return true even if those keys are already lost.
		hsk, err := hasServerKeys(c.G())
		if err != nil {
			return err
		}

		// Confirm with the user.
		if hsk.HasServerKeys {
			ui.Printf("You have uploaded an encrypted PGP private key, it will be lost.\n")
			if err = ui.PromptForConfirmation("Continue with password recovery?"); err != nil {
				return err
			}
		}
	}

	pp, err := PromptNewPassphrase(c.G())
	if err != nil {
		return err
	}

	if err := passphraseChange(c.G(), newChangeArg(pp, forcePassphraseChange)); err != nil {
		ui.Printf("\nThere was a problem during the standard update of your passphrase.")
		ui.Printf("\n%s\n\n", err)
		ui.Printf("You can attempt to recover your account with the command\n")
		ui.Printf("'keybase passphrase recover'.\n\n")
		return err
	}

	c.G().Log.Info("Passphrase changed.")
	return nil
}

func (c *CmdPassphraseChange) ParseArgv(ctx *cli.Context) error {
	c.ForceArg = ctx.Bool("force")
	return nil
}

func (c *CmdPassphraseChange) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
