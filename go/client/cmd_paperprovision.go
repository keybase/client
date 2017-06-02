// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdPaperProvision(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:         "paperprovision",
		ArgumentHelp: "[username] [devicename] [paperkey]",
		Usage:        "Establish a session with the keybase server and provision a device",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPaperProvisionRunner(g), "paperprovision", c)
		},
		Flags: []cli.Flag{},
	}
	return cmd
}

type CmdPaperProvision struct {
	libkb.Contextified
	username   string
	deviceName string
	paperKey   string
	SessionID  int
}

func NewCmdPaperProvisionRunner(g *libkb.GlobalContext) *CmdPaperProvision {
	return &CmdPaperProvision{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPaperProvision) Run() (err error) {

	client, err := GetPaperProvisionClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewProvisionUIProtocol(c.G(), libkb.KexRoleProvisionee),
		NewLoginUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
		NewGPGUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	err = client.PaperProvision(context.TODO(),
		keybase1.PaperProvisionArg{
			Username:   c.username,
			DeviceName: c.deviceName,
			PaperKey:   c.paperKey,
			SessionID:  c.SessionID,
		})

	return
}

func (c *CmdPaperProvision) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs != 3 {
		return errors.New("Username, devicename and paperkey arguments required")
	}

	c.username = ctx.Args()[0]
	c.deviceName = ctx.Args()[1]
	c.paperKey = ctx.Args()[2]

	if c.username == "" || c.deviceName == "" || c.paperKey == "" {
		return errors.New("Username, devicename and paperkey arguments required")
	}

	return nil
}

func (c *CmdPaperProvision) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
