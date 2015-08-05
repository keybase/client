package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
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
	GlobUI.Println("Password recovery will put your account on probation for 5 days.")
	GlobUI.Println("You won't be able to perform certain actions, like revoking devices.")
	return GlobUI.PromptForConfirmation("Continue with password recovery?")
}

func (c *CmdPassphraseRecover) Run() error {
	if err := c.confirm(); err != nil {
		return err
	}
	pp, err := promptNewPassphrase()
	if err != nil {
		return err
	}
	return passphraseChange(newChangeArg(pp, true))
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
