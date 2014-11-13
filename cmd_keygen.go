package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdKeyGen struct {
	pushSecret bool
	debug      bool
	arg        libkb.KeyGenArg
}

func (v *CmdKeyGen) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.arg.DoPush = ctx.Bool("push")
	v.pushSecret = ctx.Bool("push-secret")
	v.arg.NoPassphrase = ctx.Bool("no-passphrase")
	if nargs != 0 {
		err = fmt.Errorf("keygen takes 0 args")
	}
	v.debug = ctx.Bool("debug")
	if v.debug {
		// Speed up keygen to speed up debugging
		v.arg.PrimaryBits = 1024
		v.arg.SubkeyBits = 1024
	}
	return err
}

func (v *CmdKeyGen) Run() error {
	var err error
	if _, err = libkb.KeyGen(v.arg); err != nil {
		return err
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
