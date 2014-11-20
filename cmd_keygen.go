package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdKeyGen struct {
	arg keyGenArg
}

func (v *CmdKeyGen) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if err = v.arg.ParseArgv(ctx); err != nil {
	} else if nargs != 0 {
		err = fmt.Errorf("keygen takes 0 args")
	}
	return err
}

func (v *CmdKeyGen) Run() (err error) {

	if err = v.arg.Prompt(); err != nil {
		return
	}
	if err = v.arg.Configure(); err != nil {
		return
	}
	if _, err = libkb.KeyGen(v.arg.arg); err != nil {
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
