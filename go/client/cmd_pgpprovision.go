// Copyright 2017 Keybase. Inc. All rights reserved. Use of
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

type CmdPGPProvision struct {
	libkb.Contextified
	username   string
	deviceName string
	passphrase string
}

func NewCmdPGPProvision(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "pgpprovision",
		Usage:        "Provision a device via PGP",
		ArgumentHelp: "[username] [passphrase] [devicename]",
		Action: func(c *cli.Context) {
			cmd := &CmdPGPProvision{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "paper", c)
		},
	}
}

func (c *CmdPGPProvision) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 3 {
		return fmt.Errorf("expected 3 args [username] [passphrase] [devicename]")
	}

	c.username = ctx.Args()[0]
	c.passphrase = ctx.Args()[1]
	c.deviceName = ctx.Args()[2]

	return nil
}

func (c *CmdPGPProvision) Run() error {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
		NewLoginUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	cli, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.PGPProvisionArg{
		Username:   c.username,
		Passphrase: c.passphrase,
		DeviceName: c.deviceName,
	}
	return cli.PGPProvision(context.Background(), arg)
}

func (c *CmdPGPProvision) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
