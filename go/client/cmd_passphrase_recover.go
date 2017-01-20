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

	// loggedIn, err := c.G().LoginState().LoggedInLoad()
	// if err != nil {
	// 	c.G().Log.Debug("Passphrase recover couldn't query LoggedInProvisionedLoad: %v", err)
	// 	loggedIn = false
	// }
	// if !loggedIn {
	// 	ui := c.G().UI.GetTerminalUI()
	// 	ui.Printf("Passphrase recovery requires that you are logged in first.\n")
	// 	ui.Printf("Please run `keybase login` before `keybase passphrase recover`.\n")
	// 	ui.Printf("But don't panic, you can log in with a paper key.\n")
	// 	return fmt.Errorf("Passphrase recovery requires login")
	// }

	// TODO unlock
	// err := login_possibly_with_paper_key()
	// if err != nil {
	// 	return c.errLockedKeys()
	// }
	// eng := engine.NewUnlock(h.G())
	// return engine.RunEngine(eng, ctx)

	// TODO 2 unlock
	// client, err := GetLoginClient(c.G())
	// if err != nil {
	// 	return err
	// }
	// err = client.Unlock(context.TODO(), 0)
	// if err != nil {
	// 	return err
	// }

	// TODO 3 unlock
	// phrase, err := PromptPaperPhrase(c.G())
	// if err != nil {
	// 	return err
	// }
	// cli, err := GetLoginClient(c.G())
	// if err != nil {
	// 	return err
	// }
	// arg := keybase1.PaperKeySubmitArg{
	// 	PaperPhrase: phrase,
	// }
	// return cli.PaperKeySubmit(context.Background(), arg)

	// TODO 4 unlock
	// Log in with backup keys
	err := c.loginWithPaperKey(context.TODO())
	if err != nil {
		return err
	}

	return errors.New("just testing")

	// Check whether the user would lose server-stored encrypted PGP keys.
	hsk, err := hasServerKeys(c.G())
	if err != nil {
		return err
	}

	// Confirm with the user.
	ui.Printf("Password recovery will put your account on probation for 5 days.\n")
	ui.Printf("You won't be able to perform certain actions, like revoking devices.\n")
	if hsk.HasServerKeys {
		ui.Printf("You have uploaded an encrypted PGP private key, it will be lost.\n")
	}
	err = ui.PromptForConfirmation("Continue with password recovery?")
	if err != nil {
		return err
	}

	// Ask for the new passphase.
	pp, err := PromptNewPassphrase(c.G())
	if err != nil {
		return err
	}

	// Run. At this point the user should be logged in with unlocked keys.
	return passphraseChange(c.G(), newChangeArg(pp, true))
}

func (c *CmdPassphraseRecover) loginWithPaperKey(ctx context.Context) error {
	client, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	err = client.LoginWithPaperKey(ctx, 0)
	if err != nil {
		return err
	}
	err = client.Unlock(ctx, 0)
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

These device keys are locked. To change your forgotten passphrase
you will need either a device with unlocked keys or your paper key.

If you'd like to reset your account:  https://keybase.io/#account-reset
`)
}
