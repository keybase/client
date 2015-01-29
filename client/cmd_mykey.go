package main

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type MyKeyState struct {
	arg         libkb.KeyGenArg
	interactive bool
}

var SmallKey = 1024

func (a *MyKeyState) ParseArgv(ctx *cli.Context) (err error) {
	a.arg.DoSecretPush = ctx.Bool("push-secret")
	a.arg.NoPublicPush = ctx.Bool("skip-push") && !a.arg.DoSecretPush
	a.arg.NoPassphrase = ctx.Bool("no-passphrase")
	a.arg.KbPassphrase = ctx.Bool("keybase-passphrase")
	if ctx.Bool("skip-nacl") {
		a.arg.NoNaclEddsa = true
		a.arg.NoNaclDh = true
	}
	if ctx.Bool("debug") {
		a.arg.PrimaryBits = SmallKey
		a.arg.SubkeyBits = SmallKey
	}
	batch := ctx.Bool("batch")
	a.interactive = (!a.arg.NoPublicPush && !a.arg.NoPassphrase && !batch)

	if a.arg.NoPassphrase && a.arg.DoSecretPush {
		err = fmt.Errorf("Passphrase required for pushing secret key to server")
	}

	return err
}

func (a *MyKeyState) NewKeyGenUIProtocol() rpc2.Protocol {
	return keybase_1.MykeyUiProtocol(a)
}

func (a *MyKeyState) GetPushPreferences() (ret keybase_1.PushPreferences, err error) {
	if err = a.Prompt(); err == nil {
		ret.Public = !a.arg.NoPublicPush
		ret.Private = a.arg.DoSecretPush
	}
	return
}

func (a *MyKeyState) Prompt() (err error) {

	if !a.interactive {
		return
	}

	if err = a.PromptPush(); err == nil {
		err = a.PromptSecretPush(true)
	}
	return
}

func (a *MyKeyState) PromptPush() (err error) {

	def := true
	tmp := false
	prompt := "Publish your new public key to Keybase.io (strongly recommended)?"
	tmp, err = G_UI.PromptYesNo(prompt, &def)
	a.arg.NoPublicPush = !tmp
	return
}

func (a *MyKeyState) PromptSecretPush(def bool) (err error) {

	msg := `
Keybase can host an encrypted copy of your PGP private key on its servers.
It can only be decrypted with your passphrase, which Keybase never knows.

`
	G_UI.Output(msg)
	prompt := "Push an encrypted copy of your private key to Keybase.io?"
	a.arg.DoSecretPush, err = G_UI.PromptYesNo(prompt, &def)
	return
}

func mykeyFlags() []cli.Flag {
	return []cli.Flag{
		cli.BoolFlag{
			Name:  "skip-nacl",
			Usage: "skip generation of NaCl keys",
		},
	}
}

func NewCmdMykey(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "mykey",
		Usage:       "keybase mykey [subcommands...]",
		Description: "Manipulate your primary Keybase key",
		Subcommands: []cli.Command{
			NewCmdMykeyGen(cl),
			NewCmdMykeyDelete(cl),
			NewCmdMykeySelect(cl),
			NewCmdMykeyShow(cl),
		},
	}
}
