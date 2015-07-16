package client

import (
	"fmt"

	"github.com/keybase/cli"
	// "github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	// keybase1 "github.com/keybase/client/protocol/go"
	//"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdPassphraseRecover struct{}

func NewCmdPassphraseRecover(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "recover",
		Usage:       "keybase passphrase recover",
		Description: "Recover your keybase account passphrase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPassphraseRecover{}, "recover", c)
		},
	}
}

func (c *CmdPassphraseRecover) confirm() error {
	fmt.Println("Password recovery will put your account on probation for 5 days.")
	fmt.Println("You won't be able to perform certain actions, like revoking devices.")
	return GlobUI.PromptForConfirmation("Continue with password recovery?")
}

func (c *CmdPassphraseRecover) run() error {
	return nil
}

func (c *CmdPassphraseRecover) Run() error {
	return c.run()
}

func (c *CmdPassphraseRecover) RunClient() error {
	return c.run()
}

func (c *CmdPassphraseRecover) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdPassphraseRecover) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
