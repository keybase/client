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

type CmdPGPPullPrivate struct {
	libkb.Contextified
	fingerprints []keybase1.PGPFingerprint
	force        bool
}

func (v *CmdPGPPullPrivate) ParseArgv(ctx *cli.Context) (err error) {
	v.force = ctx.Bool("force")
	v.fingerprints, err = parsePGPFingerprints(ctx)
	return err
}

func (v *CmdPGPPullPrivate) Run() (err error) {

	if !v.force {
		dui := v.G().UI.GetDumbOutputUI()
		dui.Printf(
			ColorString(v.G(), "bold", "PLEASE READ THIS CAREFULLY -- PRIVATE KEYS ARE AT STAKE!") + "\n" +
				`
  This command will import PGP ` + ColorString(v.G(), "bold", "private") + ` keys from KBFS
  (found in .keys/pgp), and export them to the local GnuPG keychain. They might have been
  put there via ` + ColorString(v.G(), "blue", "keybase pgp push-private") + `. After this
  operation, these keys will be available for local GnuPG operations.` + "\n\n")
		err = v.G().UI.GetTerminalUI().PromptForConfirmation("Really pull your PGP private key from KBFS?")
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
	err = cli.PGPPullPrivate(ctx, keybase1.PGPPullPrivateArg{Fingerprints: v.fingerprints})
	return err
}

func NewCmdPGPPullPrivate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "pull-private",
		ArgumentHelp: "[<fingerprints...>]",
		Usage:        "Export PGP from KBFS and write them to the GnuPG keychain",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "all",
				Usage: "pull all PGP private keys currently proven in Keybase identity",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "force pull, and don't prompt for confirmation",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPPullPrivate{Contextified: libkb.NewContextified(g)}, "pull-private", c)
			cl.SetNoStandalone()
		},
		Description: `"keybase pgp pull-private" pulls PGP secret keys from /keybase/private/<you>/.keys/pgp,
  and imports them into your local GnuPG keychain. See "keybase pgp push-private" for the command
  that pushes keys to that KBFS location.`,
	}
}

func (v *CmdPGPPullPrivate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
