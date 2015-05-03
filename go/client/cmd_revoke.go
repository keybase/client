package client

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
	id string
}

func (c *CmdRevoke) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("revoke takes exactly one key or device ID")
	}
	c.id = ctx.Args()[0]
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

	return cli.RevokeKey(keybase_1.RevokeKeyArg{
		Id: c.id,
	})
}

func (c *CmdRevoke) Run() error {
	eng := engine.NewRevokeEngine(c.id, engine.RevokeKey)
	ctx := engine.Context{
		LogUI:    G_UI.GetLogUI(),
		SecretUI: G_UI.GetSecretUI(),
	}
	return engine.RunEngine(eng, &ctx)
}

func NewCmdRevoke(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "revoke",
		Usage:       "keybase revoke",
		Description: "revoke a key",
		Flags:       []cli.Flag{},
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
