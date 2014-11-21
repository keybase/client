package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type keyGenArg struct {
	arg         libkb.KeyGenArg
	interactive bool
}

var SMALL_KEY int = 1024

func (a *keyGenArg) ParseArgv(ctx *cli.Context) (err error) {
	a.arg.DoSecretPush = ctx.Bool("push-secret")
	a.arg.DoPush = ctx.Bool("push") || a.arg.DoSecretPush
	a.arg.NoPassphrase = ctx.Bool("no-passphrase")
	a.arg.KbPassphrase = ctx.Bool("keybase-passphrase")
	if ctx.Bool("debug") {
		a.arg.PrimaryBits = SMALL_KEY
		a.arg.SubkeyBits = SMALL_KEY
	}
	batch := ctx.Bool("batch")
	a.interactive = (!a.arg.DoPush && !a.arg.NoPassphrase && !batch)

	if a.arg.NoPassphrase && a.arg.DoSecretPush {
		err = fmt.Errorf("Passphrase required for pushing secret key to server")
	}
	return err
}

func (a *keyGenArg) Login() (err error) {
	err = G.LoginState.Login(libkb.LoginArg{})
	return
}

func (a *keyGenArg) Prompt() (err error) {

	if !a.interactive {
		return
	}

	if err = a.PromptPush(); err == nil {
		err = a.PromptSecretPush(true)
	}
	return
}

func (a *keyGenArg) PromptPush() (err error) {

	def := true
	prompt := "Publish your new public key to Keybase.io (strongly recommended)?"
	a.arg.DoPush, err = G_UI.PromptYesNo(prompt, &def)
	return
}

func (a *keyGenArg) PromptSecretPush(def bool) (err error) {

	msg := `
Keybase can host an encrypted copy of your private key on its servers.
It can only be decrypted with your passphrase, which Keybase never knows.
We suggest use of this feature to synchronize your key across your devices.

`
	G_UI.Output(msg)
	prompt := "Push an encrypted copy of your private key to Keybase.io?"
	a.arg.DoSecretPush, err = G_UI.PromptYesNo(prompt, &def)
	return
}

func NewCmdMykey(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "mykey",
		Usage:       "keybase mykey [subcommands...]",
		Description: "Manipulate your primary Keybase key",
		Subcommands: []cli.Command{
			NewCmdMykeySelect(cl),
		},
	}
}
