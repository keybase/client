package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdKeyGen struct {
	pushSecret   bool
	debug        bool
	batch        bool
	noPassphrase bool
	push         bool
	interactive  bool

	arg libkb.KeyGenArg
}

func (v *CmdKeyGen) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	v.pushSecret = ctx.Bool("push-secret")
	v.push = ctx.Bool("push")
	v.noPassphrase = ctx.Bool("no-passphrase")
	v.batch = ctx.Bool("batch")
	v.interactive = (!v.pushSecret && !v.push && !v.batch && !v.noPassphrase)

	if v.noPassphrase && v.pushSecret {
		err = fmt.Errorf("Passphrase required for pushing secret key")
	} else if nargs != 0 {
		err = fmt.Errorf("keygen takes 0 args")
	} else {
		v.debug = ctx.Bool("debug")
		if v.debug {
			// Speed up keygen to speed up debugging
			v.arg.PrimaryBits = 1024
			v.arg.SubkeyBits = 1024
		}
	}
	return err
}

func (v *CmdKeyGen) Configure() error {

	v.arg.DoPush = v.push || v.pushSecret
	v.arg.DoSecretPush = v.pushSecret
	v.arg.NoPassphrase = v.noPassphrase
	if !v.arg.NoPassphrase || v.arg.DoSecretPush {
		v.arg.KbPassphrase = true
	}

	return nil
}

func (v *CmdKeyGen) Prompt() (err error) {

	def := true
	prompt := "Publish your new public key to Keybase.io (strongly recommended)?"
	if v.push, err = G_UI.PromptYesNo(prompt, &def); err != nil || !v.push {
		return
	}

	msg := `
Keybase can host an encrypted copy of your private key on its servers.
It can only be decrypted with your passphrase, which Keybase never knows.
We suggest use of this feature to synchronize your key across your devices.

`
	G_UI.Output(msg)
	prompt = "Push an encrypted copy of your private key to Keybase.io?"
	v.pushSecret, err = G_UI.PromptYesNo(prompt, &def)

	return
}

func (v *CmdKeyGen) Run() (err error) {

	if v.interactive {
		if err = v.Prompt(); err != nil {
			return
		}
	}
	if err = v.Configure(); err != nil {
		return
	}

	if _, err = libkb.KeyGen(v.arg); err != nil {
		return
	}
	return nil
}

func NewCmdKeyGen(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "keygen",
		Usage:       "keybase keygen",
		Description: "Generate a new PGP key and write to local secret keychain",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, push",
				Usage: "Push to server",
			},
			cli.BoolFlag{
				Name:  "push-secret",
				Usage: "Also push secret key to server (protected by passphrase)",
			},
			cli.BoolFlag{
				Name:  "d, debug",
				Usage: "Generate small keys for debugging",
			},
			cli.BoolFlag{
				Name:  "P, no-passphrase",
				Usage: "Don't protect the key with a passphrase",
			},
			cli.BoolFlag{
				Name:  "b, batch",
				Usage: "Don't go into interactive mode",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdKeyGen{}, "keygen", c)
		},
	}
}

func (v *CmdKeyGen) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
