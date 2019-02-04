// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdPGPPushPrivate struct {
	libkb.Contextified
	fingerprints []keybase1.PGPFingerprint
	force        bool
}

func (v *CmdPGPPushPrivate) ParseArgv(ctx *cli.Context) (err error) {
	v.force = ctx.Bool("force")
	v.fingerprints, err = parsePGPFingerprints(ctx)
	return err
}

func parsePGPFingerprints(ctx *cli.Context) ([]keybase1.PGPFingerprint, error) {
	all := ctx.Bool("all")
	fps := ctx.Args()
	if (all && len(fps) > 0) || (!all && len(fps) == 0) {
		return nil, errors.New("You must specify either the --all flag, or pass individual PGP fingerprints")
	}
	if all {
		return nil, nil
	}
	var ret []keybase1.PGPFingerprint
	for _, x := range fps {
		if len(x) != 40 {
			return nil, errors.New("need full PGP fingerprints")
		}
		fp, err := keybase1.PGPFingerprintFromString(x)
		if err != nil {
			return nil, err
		}
		ret = append(ret, fp)
	}
	return ret, nil
}

func (v *CmdPGPPushPrivate) Run() (err error) {

	if !v.force {
		dui := v.G().UI.GetDumbOutputUI()
		dui.Printf(
			ColorString(v.G(), "bold", "PLEASE READ THIS CAREFULLY -- PRIVATE KEYS ARE AT STAKE!") + "\n" +
				`
  This command will export PGP ` + ColorString(v.G(), "bold", "private") + ` keys from GnuPG and write them
  to KBFS, in your private directory under .keys/pgp. After the operation
  completes, they will be available on all of your Keybase devices, on which
  you can run ` + ColorString(v.G(), "blue", "keybase pgp pull-private") + ` to sync them to your GnuPG keychain.
  The goal is to securely move your PGP private key across your devices. Note
  all uploads are encrypted for all of your devices using device keys and therefore
  are not susceptible to brute-force passphrase guessing attacks. An attacker
  would need access to one of your unlocked Keybase devices to access your PGP
  private key.` + "\n\n")
		err = v.G().UI.GetTerminalUI().PromptForConfirmation("Really push your PGP private key to KBFS?")
		if err != nil {
			return err
		}
	}

	cli, err := GetPGPClient(v.G())
	if err != nil {
		return err
	}
	ctx := context.Background()
	protocols := []rpc.Protocol{
		NewGPGUIProtocol(v.G()),
		NewSecretUIProtocol(v.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}
	err = cli.PGPPushPrivate(ctx, keybase1.PGPPushPrivateArg{Fingerprints: v.fingerprints})
	return err
}

func NewCmdPGPPushPrivate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "push-private",
		ArgumentHelp: "[<fingerprints...>]",
		Usage:        "Export PGP keys from GnuPG keychain, and write them to KBFS.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "all",
				Usage: "push all PGP private keys currently proven in Keybase identity",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "force push, and don't prompt for confirmation",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPPushPrivate{Contextified: libkb.NewContextified(g)}, "push-private", c)
			cl.SetNoStandalone()
		},
		Description: `"keybase pgp push-private" exports the given private keys from the GnuPG
   keychain and pushes them to KBFS, at /keybase/private/<you>/.keys/pgp. Here,
   they are protected with your Keybase device keys, and cannot be broken
   via brute-force passphrase guessing.`,
	}
}

func (v *CmdPGPPushPrivate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
