package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdMykeyGen struct {
	state MyKeyState
}

func (v *CmdMykeyGen) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if err = v.state.ParseArgv(ctx); err != nil {
	} else if nargs != 0 {
		err = fmt.Errorf("keygen takes 0 args")
	}
	return err
}

func (v *CmdMykeyGen) Run() (err error) {

	gen := libkb.NewKeyGen(&v.state.arg)

	if err = gen.LoginAndCheckKey(); err != nil {
		return
	}
	if err = v.state.Prompt(); err != nil {
		return
	}
	if _, err = gen.Run(); err != nil {
		return
	}
	return nil
}

func NewCmdMykeyGen(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "gen",
		Usage:       "keybase mykey gen",
		Description: "Generate a new PGP key and write to local secret keychain",
		Flags: append([]cli.Flag{
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
			cli.BoolFlag{
				Name:  "k, keybase-passprhase",
				Usage: "Lock your key with your present Keybase passphrase",
			},
		}, mykeyFlags()...),
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMykeyGen{}, "gen", c)
		},
	}
}

func (v *CmdMykeyGen) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
