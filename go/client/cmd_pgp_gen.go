// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CmdPGPGen struct {
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
		NewSecretUIProtocol(G),
	}
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	// Prompt for user IDs if none given on command line
	if len(v.arg.Gen.PGPUids) == 0 {
		if err = v.propmptPGPIDs(); err != nil {
			return err
		}
	}

	if err = v.arg.Gen.CreatePGPIDs(); err != nil {
		return err
	}
	v.arg.PushSecret, err = GlobUI.PromptYesNo(PromptDescriptorPGPGenPushSecret, "Push an encrypted copy of your new secret key to the Keybase.io server?", libkb.PromptDefaultYes)
	if err != nil {
		return err
	}

	err = cli.PGPKeyGen(context.TODO(), v.arg.Export())
	err = AddPGPMultiInstructions(err)
	return err
}

// Duplicates the test in libkb.PGPGenArg.CreatePGPIDs() for interactive input
var CheckPGPID = libkb.Checker{
	F: func(s string) bool {
		if !strings.Contains(s, "<") && libkb.CheckEmail.F(s) {
			return true
		}
		_, err := libkb.ParseIdentity(s)
		return err == nil
	},
	Hint: "2-12 letter id or email, or pgp style id",
}

func (v *CmdPGPGen) propmptPGPIDs() (err error) {
	prompt := "Enter default ID"
	for err == nil {
		id, err := PromptWithChecker(PromptDescriptorPGPGenEnterID, GlobUI, prompt, false, CheckPGPID)
		if len(id) > 0 {
			v.arg.Gen.PGPUids = append(v.arg.Gen.PGPUids, id)
			prompt = "Enter additional ID (optional)"
		} else if len(v.arg.Gen.PGPUids) > 0 {
			return err
		}
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

func NewCmdPGPGen(cl *libcmdline.CommandLine) cli.Command {
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
   for signing --- access to the local GnuGP keyring is not required.
   Rather, keybase will access the secret PGP key in its own local keychain.

   By default, the secret half of the PGP key is never exported off
   of the local system, but users have a choice via terminal prompt
   to select storage of their encrypted secret PGP key on the Keybase
   servers.`,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPGen{}, "gen", c)
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
