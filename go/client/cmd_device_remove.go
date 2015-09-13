package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdDeviceRemove struct {
	id    keybase1.DeviceID
	force bool
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

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.RevokeDevice(keybase1.RevokeDeviceArg{
		Force:    c.force,
		DeviceID: c.id,
	})
}

func NewCmdDeviceRemove(cl *libcmdline.CommandLine) cli.Command {
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
			cl.ChooseCommand(&CmdDeviceRemove{}, "remove", c)
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
