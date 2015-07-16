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

func (c *CmdPassphraseChange) promptNewPassphrase() (string, error) {
	arg := keybase1.GetNewPassphraseArg{
		TerminalPrompt: "Pick a new strong passphrase",
		PinentryDesc:   "Pick a new strong passphrase (12+ characters)",
		PinentryPrompt: "New Passphrase",
	}
	res, err := G.UI.GetSecretUI().GetNewPassphrase(arg)
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func (c *CmdPassphraseChange) run(ch changer) error {
	pp, err := c.promptNewPassphrase()
	if err != nil {
		return err
	}

	if err := ch.change(pp); err != nil {
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

func newChangeArg(newPassphrase string) keybase1.ChangePassphraseArg {
	return keybase1.ChangePassphraseArg{
		NewPassphrase: newPassphrase,
	}
}

type changer interface {
	change(newPassphrase string) error
}

type changerStandalone struct{}

func (s *changerStandalone) change(newPassphrase string) error {
	arg := newChangeArg(newPassphrase)
	ctx := &engine.Context{
		SecretUI: G.UI.GetSecretUI(),
	}
	eng := engine.NewChangePassphrase(&arg, G)
	return engine.RunEngine(eng, ctx)
}

type changerClient struct{}

func (c *changerClient) change(newPassphrase string) error {
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
	arg := newChangeArg(newPassphrase)
	return cli.ChangePassphrase(arg)
}
