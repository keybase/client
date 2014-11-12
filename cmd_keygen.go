package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdKeyGen struct {
	push       bool
	pushSecret bool
}

func (v *CmdKeyGen) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.push = ctx.Bool("push")
	v.pushSecret = ctx.Bool("push-secret")
	if nargs != 0 {
		err = fmt.Errorf("keygen takes 0 args")
	}
	return err
}

func (v *CmdKeyGen) Run() error {
	if tsec, err := G.LoginState.GetTriplesec(); err != nil {
		return err
	} else if _, err := libkb.KeyGen(tsec); err != nil {
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
