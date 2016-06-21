// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	//	"golang.org/x/net/context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	//	keybase1 "github.com/keybase/client/go/protocol"
	//	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CmdPGPProvision struct {
	libkb.Contextified
	username       string
	deviceName     string
	pgpFingerprint string
}

func NewCmdPGPProvision(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "pgpprovision",
		Usage:        "Provision a device via PGP",
		ArgumentHelp: "[username] [devicename] [pgp fingerprint]",
		Action: func(c *cli.Context) {
			cmd := &CmdPGPProvision{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "paper", c)
		},
	}
}

func (c *CmdPGPProvision) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 3 {
		return fmt.Errorf("expected 3 args [username] [devicename] [pgp fingerprint]")
	}

	c.username = ctx.Args()[0]
	c.deviceName = ctx.Args()[1]
	c.pgpFingerprint = ctx.Args()[2]

	return nil
}

func (c *CmdPGPProvision) Run() error {
	/*
		protocols := []rpc.Protocol{
			NewSecretUIProtocol(c.G()),
		}
		if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
			return err
		}

		phrase, err := PromptPaperPhrase(c.G())
		if err != nil {
			return err
		}

		cli, err := GetLoginClient(c.G())
		if err != nil {
			return err
		}
		arg := keybase1.PaperKeySubmitArg{
			PaperPhrase: phrase,
		}
		return cli.PaperKeySubmit(context.Background(), arg)
	*/
	return nil
}

func (c *CmdPGPProvision) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
