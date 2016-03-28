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
	id    string
	force bool
	libkb.Contextified
}

func (c *CmdDeviceRemove) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Device remove only takes one argument: the device ID or name.")
	}
	c.id = ctx.Args()[0]
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDeviceRemove) Run() (err error) {
	id, err := keybase1.DeviceIDFromString(c.id)
	if err != nil {
		id, err = c.lookup(c.id)
		if err != nil {
			return err
		}
	}

	cli, err := GetRevokeClient()
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocols(protocols); err != nil {
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
	if err := RegisterProtocols(nil); err != nil {
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
	return "", fmt.Errorf("Unknown Device ID or Name")
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
