// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdPGPGen struct {
	libkb.Contextified
	arg engine.PGPKeyImportEngineArg
}

var SmallKey = 1024

func (v *CmdPGPGen) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		err = fmt.Errorf("pgp gen takes 0 args")
	} else {
		g := libkb.PGPGenArg{}
		g.PGPUids = ctx.StringSlice("pgp-uid")
		v.arg.DoExport = !ctx.Bool("no-export")
		v.arg.AllowMulti = ctx.Bool("multi")
		if ctx.Bool("debug") {
			g.PrimaryBits = SmallKey
			g.SubkeyBits = SmallKey
		}
		v.arg.Gen = &g
	}
	return err
}

// Why use CreatePGPIDs rather than MakeAllIds?
func (v *CmdPGPGen) Run() (err error) {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(v.G()),
	}
	cli, err := GetPGPClient(v.G())
	if err != nil {
		return err
	}
	if err = RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	// Prompt for user IDs if none given on command line
	if len(v.arg.Gen.PGPUids) == 0 {
		if err = v.propmptPGPIDs(); err != nil {
			return err
		}
	} else if err = v.arg.Gen.CreatePGPIDs(); err != nil {
		return err
	}
	v.arg.PushSecret, err = v.G().UI.GetTerminalUI().PromptYesNo(PromptDescriptorPGPGenPushSecret, "Push an encrypted copy of your new secret key to the Keybase.io server?", libkb.PromptDefaultYes)
	if err != nil {
		return err
	}

	err = cli.PGPKeyGen(context.TODO(), v.arg.Export())
	err = AddPGPMultiInstructions(err)
	return err
}

var CheckRealName = libkb.Checker{
	F: func(s string) bool {
		nameID, err := libkb.ParseIdentity(s)
		if err != nil {
			return false
		}
		return len(nameID.Username) > 0 && len(nameID.Comment) == 0 && len(nameID.Email) == 0
	},
	Hint: "for example: \"Ned Snowben\"",
}

var CheckOptionalEmail = libkb.Checker{
	F: func(s string) bool {
		if len(s) == 0 {
			return true
		}
		return libkb.CheckEmail.F(s)
	},
	Hint: libkb.CheckEmail.Hint,
}

func (v *CmdPGPGen) propmptPGPIDs() (err error) {
	id := libkb.Identity{}
	prompt := "Enter your real name, which will be publicly visible in your new key"
	id.Username, err = PromptWithChecker(PromptDescriptorPGPGenEnterID, v.G().UI.GetTerminalUI(), prompt, false, CheckRealName)
	if err != nil {
		return
	}
	// Email required for primary ID
	prompt = "Enter a public email address for your key"
	id.Email, err = PromptWithChecker(PromptDescriptorPGPGenEnterID, v.G().UI.GetTerminalUI(), prompt, false, libkb.CheckEmail)
	if err != nil {
		return
	}
	v.arg.Gen.Ids = append(v.arg.Gen.Ids, id)

	emailsSeen := make(map[string]struct{})

	emailsSeen[id.Email] = struct{}{}

	idAdditional := libkb.Identity{
		Username: id.Username,
	}
	prompt = "Enter another email address (or <enter> when done)"
	for {
		idAdditional.Email, err = PromptWithChecker(PromptDescriptorPGPGenEnterID, v.G().UI.GetTerminalUI(), prompt, false, CheckOptionalEmail)
		if err != nil || len(idAdditional.Email) == 0 {
			break
		}

		// Make sure it hasn't been added already
		if _, ok := emailsSeen[idAdditional.Email]; ok {
			v.G().Log.Warning("Email already applied to this key")
			continue
		}

		emailsSeen[idAdditional.Email] = struct{}{}
		v.arg.Gen.Ids = append(v.arg.Gen.Ids, idAdditional)
	}

	return
}

func AddPGPMultiInstructions(err error) error {
	if err == nil {
		return nil
	}
	if kee, ok := err.(libkb.KeyExistsError); ok {
		return fmt.Errorf("You already have a PGP key registered (%s)\n"+
			"Specify the `--multi` flag to override this check",
			kee.Key.ToQuads())
	}
	// Not the right type. Return it as is.
	return err
}

func NewCmdPGPGen(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "gen",
		Usage: "Generate a new PGP key and write to local secret keychain",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "d, debug",
				Usage: "Generate small keys for debugging.",
			},
			cli.StringSliceFlag{
				Name:  "pgp-uid",
				Usage: "Specify custom PGP uid(s).",
				Value: &cli.StringSlice{},
			},
			cli.BoolFlag{
				Name:  "multi",
				Usage: "Allow multiple PGP keys.",
			},
			cli.BoolFlag{
				Name:  "no-export",
				Usage: "Disable exporting of new keys to GPG keychain.",
			},
		},
		Description: `"keybase pgp gen" generates a new PGP key for this account.
   In all cases, it signs the public key with an exising device key,
   and pushes the signature to the server. Thus, the user will have a
   publicly-visible "PGP device" after running this operation.

   The secret half of the PGP key is written by default to the user's
   local Keybase keychain and encrypted with the "local key security"
   (LKS) protocol. (For more information, try 'keybase help keyring').
   Also, by default, the public half of the new PGP key
   is exported to the local GnuPG keyring, if one is found.  (For now,
   you must export the secret half to gpg manually with a command like
   'keybase pgp export -s | gpg --import'.)

   On subsequent secret key accesses --- say for PGP decryption or
   for signing --- access to the local GnuPG keyring is not required.
   Rather, keybase will access the secret PGP key in its own local keychain.

   By default, the secret half of the PGP key is never exported off
   of the local system, but users have a choice via terminal prompt
   to select storage of their encrypted secret PGP key on the Keybase
   servers.`,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPGen{Contextified: libkb.NewContextified(g)}, "gen", c)
		},
	}
}

func (v *CmdPGPGen) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
