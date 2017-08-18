// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"io/ioutil"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func NewCmdUnlock(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "unlock",
		Description: `"keybase unlock" can be used to restore access to your local key store
   when the keybase service restarts unexpectedly.

   During normal operation, there is no need for this command.

   During our beta testing period, however, there are times where the
   keybase service crashes and restarts itself.  If you are logged in
   when this happens, you are still logged in, but you lose the ability
   to unlock any locally encrypted keys.  Instead of logging out and
   logging back in, the "keybase unlock" command will restore your local
   key store access.`,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdUnlock{}, "unlock", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "stdin",
				Usage: "Read a passphrase from stdin instead of a prompt",
			},
		},
	}
}

type CmdUnlock struct {
	stdin bool
}

func (c *CmdUnlock) Run() error {
	cli, err := GetLoginClient(G)
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(G),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	if c.stdin {
		stdinBytes, err := ioutil.ReadAll(os.Stdin)
		if err != nil {
			return err
		}
		return cli.UnlockWithPassphrase(context.TODO(), keybase1.UnlockWithPassphraseArg{
			Passphrase: string(stdinBytes),
		})
	}
	return cli.Unlock(context.TODO(), 0)
}

func (c *CmdUnlock) ParseArgv(ctx *cli.Context) error {
	c.stdin = ctx.Bool("stdin")
	return nil
}

func (c *CmdUnlock) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
