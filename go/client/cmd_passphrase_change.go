package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdPassphraseChange struct{}

func NewCmdPassphraseChange(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "change",
		Usage: "Change your keybase account passphrase.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPassphraseChange{}, "change", c)
		},
	}
}

func (c *CmdPassphraseChange) Run() error {
	pp, err := promptNewPassphrase()
	if err != nil {
		return err
	}

	if err := passphraseChange(newChangeArg(pp, false)); err != nil {
		GlobUI.Println()
		GlobUI.Println("There was a problem during the standard update of your passphrase.")
		GlobUI.Printf("\n%s\n\n", err)
		GlobUI.Println("If you have forgotten your existing passphrase, you can recover")
		GlobUI.Println("your account with the command 'keybase passphrase recover'.")
		GlobUI.Println()
		return err
	}

	G.Log.Info("Passphrase changed.")
	return nil
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
