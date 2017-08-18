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

type CmdPGPSelect struct {
	query      string
	multi      bool
	skipImport bool
	onlyImport bool
	libkb.Contextified
}

func (v *CmdPGPSelect) ParseArgv(ctx *cli.Context) (err error) {
	if nargs := len(ctx.Args()); nargs == 1 {
		v.query = ctx.Args()[0]
	} else if nargs != 0 {
		err = fmt.Errorf("PGP select takes 0 or 1 arguments")
	}
	if err == nil {
		v.multi = ctx.Bool("multi")
		v.skipImport = ctx.Bool("no-import")
		v.onlyImport = ctx.Bool("only-import")
		if v.onlyImport && v.skipImport {
			err = fmt.Errorf("Can specify only one of --no-import OR --only-import")
		}
	}
	return err
}

func (v *CmdPGPSelect) Run() error {
	c, err := GetPGPClient(v.G())
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewGPGUIProtocol(v.G()),
		NewSecretUIProtocol(v.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	err = c.PGPSelect(context.TODO(), keybase1.PGPSelectArg{
		FingerprintQuery: v.query,
		AllowMulti:       v.multi,
		SkipImport:       v.skipImport,
		OnlyImport:       v.onlyImport,
	})
	err = AddPGPMultiInstructions(err)
	return err
}

func NewCmdPGPSelect(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "select",
		ArgumentHelp: "[key query]",
		Usage:        "Select a key as your own and register the public half with the server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPSelect{Contextified: libkb.NewContextified(g)}, "select", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "multi",
				Usage: "Allow multiple PGP keys.",
			},
			cli.BoolFlag{
				Name:  "no-import",
				Usage: "Don't import private key to the local Keybase keyring.",
			},
			cli.BoolFlag{
				Name:  "only-import",
				Usage: "only import the secret key into the local Keybase keyring.",
			},
		},
		Description: `"keybase pgp select" looks at the local GnuPG keychain for all
   available secret keys. It then makes those keys available for use with keybase.
   The steps involved are: (1) sign a signature chain link with the selected PGP
   key and the existing device key; (2) push this signature and the public PGP
   key to the server; (3) copy the PGP secret half into your local Keybase keyring;
   and (4) encrypt this secret key with Keybase's local key security
   mechanism.

   By default, Keybase suggests only one PGP public key, but if you want to,
   you can supply the "--multi" flag to override this restriction. If you don't
   want your secret key imported into the local Keybase keyring, then use
   the "--no-import" flag.

   This operation will never push your secret key, encrypted or otherwise,
   to the Keybase server.`,
	}
}

func (v *CmdPGPSelect) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
