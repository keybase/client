// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// CmdDeviceAdd is the 'device add' command.  It is used for
// device provisioning on the provisioner/device X/C1.
type CmdDeviceAdd struct {
	libkb.Contextified
}

const cmdDevAddDesc = `When you are adding a new device to your account and you have an
existing device, you will be prompted to use this command on your
existing device to authorize the new device.`

// NewCmdDeviceAdd creates a new cli.Command.
func NewCmdDeviceAdd(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:        "add",
		Usage:       "Authorize a new device",
		Description: cmdDevAddDesc,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceAdd{Contextified: libkb.NewContextified(g)}, "add", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdDeviceAdd) Run() error {
	var err error
	cli, err := GetDeviceClient(c.G())
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewProvisionUIProtocol(c.G(), libkb.KexRoleProvisioner),
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.DeviceAdd(context.TODO(), 0)
}

// ParseArgv gets the secret phrase from the command args.
func (c *CmdDeviceAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return fmt.Errorf("device add takes zero arguments")
	}
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdDeviceAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
