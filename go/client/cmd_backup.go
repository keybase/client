package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
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
	ctx := &engine.Context{
		SecretUI: G.UI.GetSecretUI(),
	}
	eng := engine.NewBackupKeygen(G)
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		return err
	}
	c.output(eng.Passphrase())
	return nil
}

func (c *CmdBackup) RunClient() error {
	cli, err := GetLoginClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	phrase, err := cli.Backup(0)
	if err != nil {
		return err
	}
	c.output(phrase)
	return nil
}

func (c *CmdBackup) output(phrase string) {
	fmt.Printf("Here is your secret backup phrase:\n\n")
	fmt.Printf("\t%s\n\n", phrase)
	fmt.Printf("Write it down and keep somewhere safe.\n")
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
