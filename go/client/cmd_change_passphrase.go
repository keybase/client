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
		NewPassphrase: newPassphrase,
		Force:         force,
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

func NewCmdChangePassphrase(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "change-passphrase",
		Usage:       "keybase change-passphrase",
		Description: "Change your keybase account passphrase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdChangePassphrase{}, "change-passphrase", c)
		},
	}
}

type CmdChangePassphrase struct {
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
	pp, err := c.promptNewPassphrase()
	if err != nil {
		return err
	}

	err = ch.change(pp, false)
	if err == nil {
		return nil
	}

	fmt.Printf("error with standard password replace: %s\n", err)

	// TODO prompt user here to make sure they want to do this:
	fmt.Printf("force changing password\n")
	return ch.change(pp, true)
}

func (c *CmdChangePassphrase) Run() error {
	return c.run(&changerStandalone{})
}

func (c *CmdChangePassphrase) RunClient() error {
	return c.run(&changerClient{})
}

func (c *CmdChangePassphrase) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdChangePassphrase) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
