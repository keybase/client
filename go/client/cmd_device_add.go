// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Starting `device add`...\n\n")
	dui.Printf("(Please note that you should run `device add` on a computer that is\n")
	dui.Printf("already registered with Keybase)\n")

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

	if err := cli.DeviceAdd(context.TODO(), 0); err != nil {
		if lsErr, ok := err.(libkb.LoginStateTimeoutError); ok {
			c.G().Log.Debug("caught a LoginStateTimeoutError in `device add` command: %s", lsErr)
			c.G().Log.Debug("providing hopefully helpful terminal output...")

			dui.Printf("\n\nSorry, but it looks like there is another login or device provisioning\n")
			dui.Printf("task currently running.\n\n")
			dui.Printf("We only run one at a time to ensure the device is provisioned correctly.\n\n")
			dui.Printf("(Note that this often happens when you run `device add` on a new\n")
			dui.Printf("computer while it is being provisioned. You need to run it on an\n")
			dui.Printf("existing computer that is already registered with Keybase.)\n")
			return nil
		}
		return err
	}

	return nil
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
