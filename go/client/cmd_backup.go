package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdBackup(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "backup",
		Usage:       "keybase backup",
		Description: "Generate backup keys for recovering your account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdBackup{}, "backup", c)
		},
	}
}

type CmdBackup struct {
}

func (c *CmdBackup) Run() error {
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
	return cli.Backup(0)
}

func (c *CmdBackup) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdBackup) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
