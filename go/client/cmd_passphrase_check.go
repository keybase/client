// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdPassphraseCheck struct {
	libkb.Contextified
	passphrase string
}

func NewCmdPassphraseCheck(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{}
	if develUsage {
		flags = append(flags, cli.StringFlag{
			Name:  "passphrase",
			Usage: "[DEVEL ONLY DO NOT USE] pass passphrase through argument instead of invoking pinentry",
		})
	}
	return cli.Command{
		Name:  "check",
		Usage: "Check account passphrase.",
		Flags: flags,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPassphraseCheckRunner(g), "check", c)
		},
	}
}

func NewCmdPassphraseCheckRunner(g *libkb.GlobalContext) *CmdPassphraseCheck {
	return &CmdPassphraseCheck{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPassphraseCheck) Run() error {
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}
	cliUser, err := GetUserClient(c.G())
	if err != nil {
		return err
	}

	randomPW, err := cliUser.LoadHasRandomPw(context.Background(), keybase1.LoadHasRandomPwArg{})
	if err != nil {
		return err
	}

	if randomPW {
		c.G().Log.Error("Your account does not have a passphrase, so there is nothing to check.")
		c.G().Log.Info("You should set a passphrase using `keybase passphrase recover`.")
		return nil
	}

	var arg keybase1.PassphraseCheckArg
	if c.passphrase != "" {
		arg.Passphrase = c.passphrase
	} else {
		protocols := []rpc.Protocol{
			NewSecretUIProtocol(c.G()),
		}
		if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
			return err
		}
	}

	ret, err := cli.PassphraseCheck(context.TODO(), arg)
	if err != nil {
		return err
	}

	if !ret {
		return errors.New("Invalid password")
	}
	c.G().Log.Info("Passphrase confirmed.")
	return nil
}

func (c *CmdPassphraseCheck) ParseArgv(ctx *cli.Context) error {
	c.passphrase = ctx.String("passphrase")
	return nil
}

func (c *CmdPassphraseCheck) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
