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
}

func NewCmdPassphraseChange(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "change",
		Usage: "Change your keybase account passphrase.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPassphraseChangeRunner(g), "change", c)
		},
	}
}

func NewCmdPassphraseChangeRunner(g *libkb.GlobalContext) *CmdPassphraseChange {
	return &CmdPassphraseChange{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPassphraseChange) Run() error {
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

	// If the user has a randompw, we force the password change since we cannot
	// prompt them for the old one.
	forcePassphraseChange, err := cliUser.LoadHasRandomPw(context.Background(), keybase1.LoadHasRandomPwArg{})
	if err != nil {
		return err
	}

	pp, err := PromptNewPassphrase(c.G())
	if err != nil {
		return err
	}

	if err := passphraseChange(c.G(), newChangeArg(pp, forcePassphraseChange)); err != nil {
		dui := c.G().UI.GetDumbOutputUI()
		dui.Printf("\nThere was a problem during the standard update of your passphrase.")
		dui.Printf("\n%s\n\n", err)
		dui.Printf("You can attempt to recover your account with the command\n")
		dui.Printf("'keybase passphrase recover'.\n\n")
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
