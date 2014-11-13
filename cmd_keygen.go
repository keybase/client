package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdKeyGen struct {
	push       bool
	pushSecret bool
	debug      bool
	arg        libkb.KeyGenArg
}

func (v *CmdKeyGen) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.push = ctx.Bool("push")
	v.pushSecret = ctx.Bool("push-secret")
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
	if v.arg.Tsec, err = G.LoginState.GetTriplesec(""); err != nil {
		return err
	} else if _, err = libkb.KeyGen(v.arg); err != nil {
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
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdKeyGen{}, "keygen", c)
		},
	}
}

func (v *CmdKeyGen) UseConfig() bool   { return true }
func (v *CmdKeyGen) UseKeyring() bool  { return true }
func (v *CmdKeyGen) UseAPI() bool      { return true }
func (v *CmdKeyGen) UseTerminal() bool { return true }
