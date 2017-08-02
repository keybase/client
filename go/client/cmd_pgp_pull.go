// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdPGPPull struct {
	libkb.Contextified
	userAsserts []string
}

func (v *CmdPGPPull) ParseArgv(ctx *cli.Context) error {
	v.userAsserts = ctx.Args()
	return nil
}

func (v *CmdPGPPull) Run() (err error) {
	cli, err := GetPGPClient(v.G())
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewIdentifyTrackUIProtocol(v.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	return cli.PGPPull(context.TODO(), keybase1.PGPPullArg{
		UserAsserts: v.userAsserts,
	})
}

func NewCmdPGPPull(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "pull",
		ArgumentHelp: "[<usernames...>]",
		Usage:        "Download the latest PGP keys for people you track.",
		Flags:        []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPPull{Contextified: libkb.NewContextified(g)}, "pull", c)
		},
		Description: `"keybase pgp pull" pulls down all of the PGP keys for the people
   you track. On success, it imports those keys into your local GnuPG keychain.
   For existing keys, this means the local GnuPG keyring will get an updated,
   merged copy, via GnuPG's default key merging strategy. For new keys, it
   will be a plain import.

   If usernames (or user assertions) are supplied, only those tracked users
   are pulled. Without arguments, all tracked users are pulled.`,
	}
}

func (v *CmdPGPPull) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
