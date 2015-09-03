package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPaperKey(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "paperkey",
		Usage:       "keybase paperkey",
		Description: "Generate paper keys for recovering your account.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPaperKey{}, "paperkey", c)
		},
	}
}

type CmdPaperKey struct {
}

func (c *CmdPaperKey) Run() error {
	cli, err := GetLoginClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewLoginUIProtocol(),
		NewSecretUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	return cli.PaperKey(0)
}

func (c *CmdPaperKey) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdPaperKey) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
