// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdPassphraseChange struct {
	libkb.Contextified
}

func NewCmdPassphraseChange(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "change",
		Usage: "Change your keybase account passphrase.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPassphraseChange{Contextified: libkb.NewContextified(g)}, "change", c)
		},
	}
}

func (c *CmdPassphraseChange) Run() error {
	pp, err := PromptNewPassphrase(c.G())
	if err != nil {
		return err
	}

	if err := passphraseChange(c.G(), newChangeArg(pp, false)); err != nil {
		dui := c.G().UI.GetDumbOutputUI()
		dui.Printf("\nThere was a problem during the standard update of your passphrase.")
		dui.Printf("\n%s\n\n", err)
		dui.Printf("If you have forgotten your existing passphrase, you can recover\n")
		dui.Printf("your account with the command 'keybase passphrase recover'.\n\n")
		return err
	}

	c.G().Log.Info("Passphrase changed.")
	return nil
}

func (c *CmdPassphraseChange) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdPassphraseChange) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
