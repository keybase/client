// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
	query        string
	multi        bool
	importSecret bool
	noPublish    bool
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
		v.importSecret = ctx.Bool("import")
		v.noPublish = ctx.Bool("no-publish")
		if v.noPublish && !v.importSecret {
			err = fmt.Errorf("Nothing to do - refused to publish with \"--no-publish\" but did not ask to import secret key (\"--import\")")
		}
	}
	return err
}

const importDisclaimer = `You are selecting a PGP key to sign and publish a statement that you
own said key, effectively making it part of your Keybase.io identity.

You will be prompted by GPG to unlock your private key - it will be
used to make a signature that you are the owner of said key.

What you can also do, is importing the secret key to *local, encrypted*
Keybase keyring, to be able to decrypt or sign using Keybase client.
See more in documentation: "keybase pgp help select".

`

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

	if !v.importSecret && !v.noPublish {
		// The default setting - inform user what's going on and point
		// to documentation for more options.
		dui := v.G().UI.GetDumbOutputUI()
		dui.Printf(importDisclaimer)
	}

	err = c.PGPSelect(context.TODO(), keybase1.PGPSelectArg{
		FingerprintQuery: v.query,
		AllowMulti:       v.multi,
		SkipImport:       !v.importSecret,
		OnlyImport:       v.noPublish,
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
				Name:  "import",
				Usage: "Import private key to the local Keybase keyring.",
			},
			cli.BoolFlag{
				Name:  "no-publish",
				Usage: "Only import to Keybase keyring, do not publish on user profile.",
			},
		},
		Description: `"keybase pgp select" looks at the local GnuPG keychain for all
   available secret keys. It then makes those keys available for use with keybase.
   The steps involved are: (1) sign a signature chain link with the selected PGP
   key and the existing device key; (2) push this signature and the public PGP
   key to the server; and if "--import" flag is passed: (3) copy the PGP secret half
   into your local Keybase keyring; and (4) encrypt this secret key with Keybase's
   local key security mechanism.

   By default, Keybase suggests only one PGP public key, but if you want to,
   you can supply the "--multi" flag to override this restriction. If you
   want your secret key imported into the local Keybase keyring, then use
   the "--import" flag. Importing the secret key to Keybase keyring makes
   it possible to use Keybase PGP like "pgp decrypt" or "pgp sign".

   If you don't want to publish signature chain link to Keybase servers, use
   "--no-publish" flag. It's only valid when both "--no-publish" and "--import"
   flags are used.

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
