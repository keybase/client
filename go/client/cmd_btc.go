package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdBTC struct {
	address string
	force   bool
}

func (c *CmdBTC) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Must provide exactly one address.")
	}
	c.address = ctx.Args()[0]
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdBTC) Run() (err error) {
	cli, err := GetBTCClient()
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

	return cli.RegisterBTC(keybase1.RegisterBTCArg{
		Address: c.address,
		Force:   c.force,
	})
}

func NewCmdBTC(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "btc",
		Usage:       "keybase btc [-f] <addr>",
		Description: "claim a bitcoin address",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "overwrite an existing address",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdBTC{}, "btc", c)
		},
	}
}

func (c *CmdBTC) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
