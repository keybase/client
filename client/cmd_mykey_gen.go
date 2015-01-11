package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
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

func (v *CmdMykeyGen) RunClient() (err error) {
	var cli keybase_1.MykeyClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		v.state.NewKeyGenUIProtocol(),
		NewLoginUIProtocol(),
		NewSecretUIProtocol(),
	}
	if cli, err = GetMykeyClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		err = cli.KeyGen(v.state.arg.Export())
	}
	return
}

func (v *CmdMykeyGen) Run() (err error) {
	v.state.arg.KeyGenUI = &v.state
	v.state.arg.SecretUI = G_UI.GetSecretUI()
	gen := libkb.NewKeyGen(&v.state.arg)
	if _, err = gen.Run(); err != nil {
		return
	}
	return nil
}

func NewCmdMykeyGen(cl *libcmdline.CommandLine) cli.Command {
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
