// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdPGPDrop struct {
	libkb.Contextified
	id keybase1.KID
}

func (c *CmdPGPDrop) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("drop takes exactly one key")
	}
	c.id, err = keybase1.KIDFromStringChecked(ctx.Args()[0])
	if err != nil {
		return fmt.Errorf("bad key: %v", err)
	}
	return nil
}

func (c *CmdPGPDrop) Run() (err error) {
	cli, err := GetRevokeClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	return cli.RevokeKey(context.TODO(), keybase1.RevokeKeyArg{
		KeyID: c.id,
	})
}

func NewCmdPGPDrop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "drop",
		ArgumentHelp: "<key-id>",
		Usage:        "Drop Keybase's use of a PGP key",
		Flags:        []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPDrop{}, "drop", c)
		},
		Description: `"keybase pgp drop" signs a statement saying the given PGP
   key should no longer be associated with this account. It will **not** sign a PGP-style
   revocation cert for this key; you'll have to do that on your own.`,
	}
}

func (c *CmdPGPDrop) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
