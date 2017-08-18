// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

type CmdPGPUpdate struct {
	fingerprints []string
	all          bool
	libkb.Contextified
}

func (v *CmdPGPUpdate) ParseArgv(ctx *cli.Context) error {
	v.fingerprints = ctx.Args()
	v.all = ctx.Bool("all")
	return nil
}

func (v *CmdPGPUpdate) Run() (err error) {
	cli, err := GetPGPClient(v.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(v.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	return cli.PGPUpdate(context.TODO(), keybase1.PGPUpdateArg{
		Fingerprints: v.fingerprints,
		All:          v.all,
	})
}

func NewCmdPGPUpdate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "update",
		ArgumentHelp: "[fingerprints...]",
		Usage:        "Update your public PGP keys on keybase with those exported from the local GPG keyring",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "all",
				Usage: "Update all available keys.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPUpdate{Contextified: libkb.NewContextified(g)}, "update", c)
		},
		Description: `'keybase pgp update' pushes updated PGP public keys to the server.
   Public PGP keys are exported from your local GPG keyring and sent
   to the Keybase server, where they will supersede PGP keys that have been
   previously updated. This feature is for updating PGP subkeys, identities,
   and signatures, but cannot be used to change PGP primary keys.

   Only keys with the specified PGP fingerprints will be updated, unless the
   '--all' flag is specified, in which case all PGP keys will be updated.`,
	}
}

func (v *CmdPGPUpdate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
