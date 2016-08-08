// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewCmdPGPPurge(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "purge",
		Usage: "Purge all PGP keys from Keybase keyring",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPPurge{Contextified: libkb.NewContextified(g)}, "purge", c)
		},
	}
}

type CmdPGPPurge struct {
	libkb.Contextified
}

func (s *CmdPGPPurge) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("pgp purge")
	}

	return nil
}

func (s *CmdPGPPurge) Run() error {
	cli, err := GetPGPClient()
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
		DoPurge: false,
	}

	res, err := cli.PGPPurge(context.TODO(), arg)
	if err != nil {
		return err
	}

	fmt.Printf("res: %+v\n", res)
	return nil
}

func (s *CmdPGPPurge) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
