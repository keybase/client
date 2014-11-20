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

func (a *keyGenArg) Prompt() (err error) {

	if !a.interactive {
		return
	}

	def := true
	prompt := "Publish your new public key to Keybase.io (strongly recommended)?"
	if a.arg.DoPush, err = G_UI.PromptYesNo(prompt, &def); err != nil || !a.arg.DoPush {
		return
	}

	msg := `
Keybase can host an encrypted copy of your private key on its servers.
It can only be decrypted with your passphrase, which Keybase never knows.
We suggest use of this feature to synchronize your key across your devices.

`
	G_UI.Output(msg)
	prompt = "Push an encrypted copy of your private key to Keybase.io?"
	a.arg.DoSecretPush, err = G_UI.PromptYesNo(prompt, &def)

	return
}

func (v *keyGenArg) Configure() (err error) {
	if !v.arg.NoPassphrase || v.arg.DoSecretPush {
		v.arg.KbPassphrase = true
	}
	return nil
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
