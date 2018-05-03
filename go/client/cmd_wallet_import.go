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
	"golang.org/x/net/context"
)

type cmdWalletImport struct {
	libkb.Contextified
	makePrimary bool
}

func newCmdWalletImport(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletImport{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "import",
		Description:  "Import a stellar account",
		Usage:        "Import stellar account keys",
		ArgumentHelp: "[--primary]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "import", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "primary",
				Usage: "make this your main public account",
			},
		},
	}
}

func (c *cmdWalletImport) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 0 {
		return errors.New("expected no arguments")
	}
	c.makePrimary = ctx.Bool("primary")
	return nil
}

func (c *cmdWalletImport) Run() (err error) {
	secKey, accountID, err := c.promptSecretKey()
	if err != nil {
		return err
	}

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	own, err := cli.OwnAccountLocal(context.TODO(), accountID)
	if err != nil {
		return err
	}
	if own {
		return fmt.Errorf("account has already been imported: %v", accountID)
	}
	err = c.confirm(accountID)
	if err != nil {
		return err
	}
	err = cli.ImportSecretKeyLocal(context.TODO(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   secKey,
		MakePrimary: c.makePrimary,
	})
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("✓ Account imported\n")
	return err
}

func (c *cmdWalletImport) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func (c *cmdWalletImport) promptSecretKey() (stellar1.SecretKey, stellar1.AccountID, error) {
	secStr, err := c.G().UI.GetTerminalUI().PromptPassword(PromptDescriptorImportStellarSecretKey, "Enter a stellar secret key to import")
	if err != nil {
		return "", "", err
	}
	if len(secStr) == 0 {
		return "", "", libkb.InputCanceledError{}
	}
	secKey, accountID, _, err := libkb.ParseStellarSecretKey(secStr)
	return secKey, accountID, err
}

func (c *cmdWalletImport) confirm(accountID stellar1.AccountID) error {
	promptText := fmt.Sprintf(`
Ready to import account: %v
The stellar secret key will be encrypted, uploaded, and made available on all of your devices.
Ready to import?`, accountID)
	doIt, err := c.G().UI.GetTerminalUI().PromptYesNo(PromptDescriptorConfirmStellarImport, promptText, libkb.PromptDefaultYes)
	if err != nil {
		return err
	}
	if !doIt {
		return libkb.NewCanceledError("import canceled")
	}
	return nil
}
