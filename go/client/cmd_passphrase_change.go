package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdPassphraseChange struct{}

func NewCmdPassphraseChange(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "change",
		Usage:       "keybase passphrase change",
		Description: "Change your keybase account passphrase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPassphraseChange{}, "change", c)
		},
	}
}

func (c *CmdPassphraseChange) run(ch changer) error {
	pp, err := promptNewPassphrase()
	if err != nil {
		return err
	}

	if err := ch.change(newChangeArg(pp, false)); err != nil {
		fmt.Println()
		fmt.Println("There was a problem during the standard update of your passphrase.")
		fmt.Printf("\n%s\n\n", err)
		fmt.Println("If you have forgotten your existing passphrase, you can recover")
		fmt.Println("your account with the command 'keybase passphrase recover'.")
		fmt.Println()
		return err
	}

	G.Log.Info("Passphrase changed.")
	return nil
}

func (c *CmdPassphraseChange) Run() error {
	return c.run(&changerStandalone{})
}

func (c *CmdPassphraseChange) RunClient() error {
	return c.run(&changerClient{})
}

func (c *CmdPassphraseChange) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdPassphraseChange) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
