package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewCmdXLogin(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "xlogin",
		ArgumentHelp: "[username]",
		Usage:        "Establish a session with the keybase server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdXLogin{}, "xlogin", c)
		},
	}
}

type CmdXLogin struct {
	username string
}

func (c *CmdXLogin) Run() error {
	protocols := []rpc.Protocol{
		NewProvisionUIProtocol(G, false /* not provisioner */),
		NewLoginUIProtocol(G),
		NewSecretUIProtocol(G),
		NewGPGUIProtocol(G),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	client, err := GetLoginClient(G)
	if err != nil {
		return err
	}
	return client.XLogin(context.TODO(), keybase1.XLoginArg{Username: c.username, DeviceType: libkb.DeviceTypeDesktop})
}

func (c *CmdXLogin) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return errors.New("Invalid arguments.")
	}

	if nargs == 1 {
		c.username = ctx.Args()[0]
	}
	return nil
}

func (c *CmdXLogin) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
