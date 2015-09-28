package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
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
		g.NoDefPGPUid = ctx.Bool("no-default-pgp-uid")
		v.arg.AllowMulti = ctx.Bool("multi")
		v.arg.DoExport = !ctx.Bool("no-export")
		if g.NoDefPGPUid && len(g.PGPUids) == 0 {
			err = fmt.Errorf("if you don't want the default PGP uid, you must supply a PGP uid with the --pgp-uid option")
		}
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
	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
	}
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	if err = v.arg.Gen.CreatePGPIDs(); err != nil {
		return err
	}
	v.arg.PushSecret, err = GlobUI.PromptYesNo("Push an encrypted copy of the secret key to the server?", PromptDefaultYes)
	if err != nil {
		return err
	}

	err = cli.PGPKeyGen(v.arg.Export())
	err = AddPGPMultiInstructions(err)
	return err
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
				Name:  "no-default-pgp-uid",
				Usage: "Do not include the default PGP uid 'username@keybase.io' in the key.",
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
		Description : `'keybase pgp gen' generates a new PGP key for this account.
   In all cases, it signs the public key with an exising device key,
   and pushes the signature to the server. Thus, the user will have a
   publicly-visible "PGP device" after running this operation.

   The secret half of the PGP key is written by default to the user's
   local Keybase keychain and encrypted with the "local key security"
   (LKS) protocol. (For more information, try 'keybase help keyring').
   Also, by default, the public and secret half of the new PGP key
   is exported to the local GnuPG keyring, if one is found.

   On subsequent secret key accesses --- say for PGP decryption or
   for signing --- access to the local GnuGP keyring is not required.
   Rather, keybase will access the secret PGP key in its own local keychain.

   By default, the secret half of the PGP key is never exported off
   of the local system, but users have a choice via terminal propmpt
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
