// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

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
	id    keybase1.DeviceID
	force bool
	libkb.Contextified
}

func (c *CmdDeviceRemove) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Device remove only takes one argument, the device ID.")
	}
	id, err := keybase1.DeviceIDFromString(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.id = id
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDeviceRemove) Run() (err error) {
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
		DeviceID: c.id,
	})
}

func NewCmdDeviceRemove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "remove",
		ArgumentHelp: "<id>",
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
