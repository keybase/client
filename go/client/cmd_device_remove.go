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

type CmdDeviceRemove struct {
	idOrName string
	force    bool
	libkb.Contextified
}

func (c *CmdDeviceRemove) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Device remove only takes one argument: the device ID or name.")
	}
	c.idOrName = ctx.Args()[0]
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDeviceRemove) Run() (err error) {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	var id keybase1.DeviceID
	id, err = keybase1.DeviceIDFromString(c.idOrName)
	if err != nil {
		id, err = c.lookup(c.idOrName)
		if err != nil {
			return err
		}
	}

	cli, err := GetRevokeClient()
	if err != nil {
		return err
	}

	return cli.RevokeDevice(context.TODO(), keybase1.RevokeDeviceArg{
		Force:    c.force,
		DeviceID: id,
	})
}

func (c *CmdDeviceRemove) lookup(name string) (keybase1.DeviceID, error) {
	cli, err := GetDeviceClient()
	if err != nil {
		return "", err
	}
	devs, err := cli.DeviceList(context.TODO(), 0)
	if err != nil {
		return "", err
	}

	for _, dev := range devs {
		if dev.Name == name {
			return dev.DeviceID, nil
		}
	}
	return "", fmt.Errorf("Invalid Device ID or Unknown Device Name")
}

func NewCmdDeviceRemove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "remove",
		ArgumentHelp: "<id|name>",
		Usage:        "Remove a device",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Override warning about removing the current device.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceRemove{Contextified: libkb.NewContextified(g)}, "remove", c)
		},
	}
}

func (c *CmdDeviceRemove) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
