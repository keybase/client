// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdPGPPurge(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "purge",
		Usage: "Purge all PGP keys from Keybase keyring",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPPurge{Contextified: libkb.NewContextified(g)}, "purge", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, purge",
				Usage: "After export, purge keys from keyring",
			},
		},
	}
}

type CmdPGPPurge struct {
	libkb.Contextified
	doPurge bool
}

func (s *CmdPGPPurge) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("pgp purge")
	}

	s.doPurge = ctx.Bool("purge")

	return nil
}

func (s *CmdPGPPurge) Run() error {
	cli, err := GetPGPClient(s.G())
	if err != nil {
		return err
	}

	spui := &SaltpackUI{
		Contextified: libkb.NewContextified(s.G()),
		terminal:     s.G().UI.GetTerminalUI(),
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(s.G()),
		NewIdentifyUIProtocol(s.G()),
		keybase1.SaltpackUiProtocol(spui),
	}
	if err := RegisterProtocolsWithContext(protocols, s.G()); err != nil {
		return err
	}

	arg := keybase1.PGPPurgeArg{
		DoPurge: s.doPurge,
	}

	res, err := cli.PGPPurge(context.TODO(), arg)
	if err != nil {
		return err
	}

	dui := s.G().UI.GetDumbOutputUI()
	if len(res.Filenames) == 0 {
		dui.Printf("No PGP keys found in local keyring\n")
		return nil
	}

	dui.Printf("Exported PGP key files:\n")
	for i, name := range res.Filenames {
		dui.Printf("%2d. %s\n", i+1, name)
	}

	dui.Printf("\n")
	if s.doPurge {
		dui.Printf("All PGP keys have been purged from the local Keybase keyring.\n")
	} else {
		dui.Printf("The PGP keys in the local Keybase keyring have been exported.\n")
		dui.Printf("Please check that you have no problems decrypting them with:\n\n")
		dui.Printf("    keybase decrypt --infile <filename>\n\n")
		dui.Printf("and importing them into another keyring (like GPG).\n\n")
		dui.Printf("Once you are confident that you have your keys in a safe place,\n")
		dui.Printf("run this command with the -p flag:\n\n")
		dui.Printf("    keybase pgp purge -p\n\n")
		dui.Printf("to remove the keys from the local Keybase keyring.\n")
	}

	return nil
}

func (s *CmdPGPPurge) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
