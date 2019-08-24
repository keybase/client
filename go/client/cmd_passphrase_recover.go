// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdPassphraseRecover struct {
	libkb.Contextified
	Username string
}

func NewCmdPassphraseRecover(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "recover",
		ArgumentHelp: "[username]",
		Usage:        "Recover your keybase account passphrase",
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
	protocols := []rpc.Protocol{
		NewProvisionUIProtocol(c.G(), libkb.KexRoleProvisionee),
		NewLoginUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	client, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = client.RecoverPassphrase(ctx, keybase1.RecoverPassphraseArg{
		Username: c.Username,
	})
	switch err.(type) {
	case libkb.NotProvisionedError:
		return c.errNotProvisioned()
	case libkb.NoPaperKeysError:
		return c.errNoPaperKeys()
	case libkb.InputCanceledError, libkb.RetryExhaustedError:
		return c.errLockedKeys()
	}
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdPassphraseRecover) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return errors.New("Invalid arguments.")
	}

	if nargs == 1 {
		c.Username = ctx.Args()[0]
		checker := libkb.CheckUsername
		if !checker.F(c.Username) {
			return fmt.Errorf("Invalid username. Valid usernames are: %s", checker.Hint)
		}
	}
	return nil
}

func (c *CmdPassphraseRecover) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

// TODO CORE-10851: Remove when legacyRecovery is gone
func (c *CmdPassphraseRecover) errNotProvisioned() error {
	return errors.New(`Can't recover without device keys.

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
