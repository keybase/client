// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

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

func (c *CmdPassphraseRecover) Run() error {
	ui := c.G().UI.GetTerminalUI()
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	// Check that there is a UID.
	// This a proxy for whether this device has been provisioned for the recoverer.
	uid := c.G().GetMyUID()
	if !uid.Exists() {
		return c.errNoUID()
	}

	// Login with unlocked keys or a prompted paper key.
	err := c.loginWithPaperKey(context.TODO())
	switch err.(type) {
	case libkb.InputCanceledError:
		return c.errLockedKeys()
	case libkb.NoPaperKeysError:
		return c.errNoPaperKeys()
	}
	if err != nil {
		return err
	}

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

	// Ask for the new passphase.
	pp, err := PromptNewPassphrase(c.G())
	if err != nil {
		return err
	}

	// Run the main recovery engine. At this point the user should be logged in with
	// unlocked keys. This has the potential to issue all sorts of prompts
	// but given that we should now be logged in and unlocked, it shouldn't
	// issue any prompts.
	return passphraseChange(c.G(), newChangeArg(pp, true))

	// BUG the user sometimes ends up recovered and unlocked, but logged out after all this.
	// Running `keybase login` or restarting the service both effortlessly log them in.
}

func (c *CmdPassphraseRecover) loginWithPaperKey(ctx context.Context) error {
	// TODO How can we be sure here that a missing SecretUI isn't going to cause a panic?
	client, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	err = client.LoginWithPaperKey(ctx, 0)
	if err != nil {
		return err
	}
	return err
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

func (c *CmdPassphraseRecover) errNoUID() error {
	return errors.New(`Can't recover without a UID.

If you have not provisioned this device before but do have
your paper key, try running: keybase login
`)
}

func (c *CmdPassphraseRecover) errLockedKeys() error {
	return errors.New(`Cannot unlock device keys.

These device keys are locked and you did not enter a paper key.
To change your forgotten passphrase you will need either a device
with unlocked keys or your paper key.

If you'd like to reset your account:  https://keybase.io/#account-reset
`)
}

func (c *CmdPassphraseRecover) errNoPaperKeys() error {
	return errors.New(`Your account has no paper keys.

To change your forgotten passphrase you will need a device with unlocked keys.
Otherwise, an account reset will be required.

If you'd like to reset your account:  https://keybase.io/#account-reset
`)
}
