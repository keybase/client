package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdDeviceRemove struct {
	id keybase1.DeviceID
}

func (c *CmdDeviceRemove) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("device remove takes exactly one key or device ID")
	}
	id, err := keybase1.DeviceIDFromString(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.id = id
	return nil
}

func (c *CmdDeviceRemove) RunClient() (err error) {
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
		DeviceID: c.id,
	})
}

func (c *CmdDeviceRemove) Run() error {
	eng := engine.NewRevokeDeviceEngine(c.id, G)
	ctx := engine.Context{
		LogUI:    GlobUI.GetLogUI(),
		SecretUI: GlobUI.GetSecretUI(),
	}
	return engine.RunEngine(eng, &ctx)
}

func NewCmdDeviceRemove(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "remove",
		Usage:       "keybase device remove <id>",
		Description: "remove a device from your account, and revoke its keys",
		Flags:       []cli.Flag{},
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
