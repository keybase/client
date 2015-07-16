package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func newChangeArg(newPassphrase string, force bool) keybase1.ChangePassphraseArg {
	return keybase1.ChangePassphraseArg{
		Passphrase: newPassphrase,
		Force:      force,
	}
}

type changer interface {
	change(newPassphrase string, force bool) error
}

type changerStandalone struct{}

func (s *changerStandalone) change(newPassphrase string, force bool) error {
	arg := newChangeArg(newPassphrase, force)
	ctx := &engine.Context{
		SecretUI: G.UI.GetSecretUI(),
	}
	eng := engine.NewChangePassphrase(&arg, G)
	return engine.RunEngine(eng, ctx)
}

type changerClient struct{}

func (c *changerClient) change(newPassphrase string, force bool) error {
	cli, err := GetAccountClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	arg := newChangeArg(newPassphrase, force)
	return cli.ChangePassphrase(arg)
}

type CmdChangePassphrase struct {
	force bool
}

func NewCmdChangePassphrase(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "change-passphrase",
		Usage:       "keybase change-passphrase",
		Description: "Change your keybase account passphrase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdChangePassphrase{}, "change-passphrase", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "force passphrase change",
			},
		},
	}
}

func (c *CmdChangePassphrase) promptNewPassphrase() (string, error) {
	arg := keybase1.GetNewPassphraseArg{
		TerminalPrompt: "Pick a new strong passphrase",
		PinentryDesc:   "Pick a new strong passphrase (12+ characters)",
		PinentryPrompt: "Passphrase",
	}
	res, err := G.UI.GetSecretUI().GetNewPassphrase(arg)
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func (c *CmdChangePassphrase) run(ch changer) error {
	if c.force {
		fmt.Println("Keybase can forcefully update your passphrase without your")
		fmt.Println("current passphrase.  However, your account will be placed on")
		fmt.Println("probation for 5 days for your protection.")
		fmt.Println()
		err := GlobUI.PromptForConfirmation("Are you sure you want to force-update your passphrase?")
		if err != nil {
			return err
		}
	}

	pp, err := c.promptNewPassphrase()
	if err != nil {
		return err
	}

	if c.force {
		return ch.change(pp, true)
	}

	// standard update:
	err = ch.change(pp, false)
	if err == nil {
		G.Log.Info("Passphrase changed.")
		return nil
	}

	// originally, this was automatically trying a force update of the
	// passphrase if a (known) error occurred in the standard update.
	// But since we want to *strongly* encorage standard updates, I think
	// requiring users to run the command with a flag to force is ok.
	// The user will still need to confirm they want to do that.

	fmt.Println()
	fmt.Println("There was a problem during the standard update of your passphrase.")
	fmt.Println("If you have forgotten your existing passphrase, you can force")
	fmt.Println("a passphrase update with the -f flag to this command.")
	fmt.Println()

	return err
}

func (c *CmdChangePassphrase) Run() error {
	return c.run(&changerStandalone{})
}

func (c *CmdChangePassphrase) RunClient() error {
	return c.run(&changerClient{})
}

func (c *CmdChangePassphrase) ParseArgv(ctx *cli.Context) error {
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdChangePassphrase) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
