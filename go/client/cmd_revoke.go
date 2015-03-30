package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdRevoke struct {
	id       string
	isDevice bool
}

func (c *CmdRevoke) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("revoke takes exactly one key or device ID")
	}
	c.id = ctx.Args()[0]
	c.isDevice = ctx.Bool("device")

	return nil
}

func (c *CmdRevoke) RunClient() (err error) {
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

	return cli.Revoke(keybase_1.RevokeArg{
		Id:       c.id,
		IsDevice: c.isDevice,
	})
}

func (c *CmdRevoke) Run() error {
	eng := engine.NewRevokeEngine(c.id, c.isDevice)
	ctx := engine.Context{
		LogUI: G_UI.GetLogUI(),
	}
	return engine.RunEngine(eng, &ctx)
}

func NewCmdRevoke(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "revoke",
		Usage:       "keybase revoke",
		Description: "revoke a key or a device",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "device",
				Usage: "interpret the argument as a device ID, and revoke that device and its keys",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdRevoke{}, "revoke", c)
		},
	}
}

func (c *CmdRevoke) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
