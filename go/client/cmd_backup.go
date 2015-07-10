package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
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
	return nil
}

func (c *CmdBackup) RunClient() error {
	return nil
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
