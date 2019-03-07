// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdPassphraseTest struct {
	libkb.Contextified
}

func NewCmdPassphraseTest(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "test",
		Usage: "Test account passphrase.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPassphraseTestRunner(g), "test", c)
		},
	}
}

func NewCmdPassphraseTestRunner(g *libkb.GlobalContext) *CmdPassphraseTest {
	return &CmdPassphraseTest{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPassphraseTest) Run() error {
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
		c.G().Log.Error("Your account does not have a passphrase, so there is nothing to test.")
		c.G().Log.Info("You should set a passphrase using `keybase passphrase recover`.")
		return nil
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	if err := cli.TestPassphrase(context.TODO(), 0); err != nil {
		return err
	}

	c.G().Log.Info("Passphrase confirmed.")
	return nil
}

func (c *CmdPassphraseTest) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdPassphraseTest) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
