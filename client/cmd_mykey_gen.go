package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
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
		err = fmt.Errorf("mykey gen takes 0 args")
	} else {
		v.state.arg.PGPUids = ctx.StringSlice("pgp-uid")
		v.state.arg.NoDefPGPUid = ctx.Bool("no-default-pgp-uid")
		if v.state.arg.NoDefPGPUid && len(v.state.arg.PGPUids) == 0 {
			err = fmt.Errorf("if you don't want the default PGP uid, you must supply a PGP uid with the --pgp-uid option.")
		}
	}
	return err
}

func (v *CmdMykeyGen) RunClient() (err error) {
	var cli keybase_1.MykeyClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewKeyGenUIProtocol(),
		NewLoginUIProtocol(),
		NewSecretUIProtocol(),
	}
	if cli, err = GetMykeyClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {

	} else if err = v.state.arg.CreatePgpIDs(); err != nil {
	} else {
		err = cli.KeyGen(v.state.arg.Export())
	}
	return
}

func (v *CmdMykeyGen) Run() (err error) {
	v.state.arg.KeyGenUI = G_UI.GetKeyGenUI()
	v.state.arg.SecretUI = G_UI.GetSecretUI()
	v.state.arg.LogUI = G_UI.GetLogUI()
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
				Name:  "skip-push",
				Usage: "No push to server (on by default)",
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
				Name:  "k, keybase-passphrase",
				Usage: "Lock your key with your present Keybase passphrase",
			},
			cli.StringSliceFlag{
				Name:  "pgp-uid",
				Usage: "Specify custom PGP uid(s)",
				Value: &cli.StringSlice{},
			},
			cli.BoolFlag{
				Name:  "no-default-pgp-uid",
				Usage: "Do not include the default PGP uid 'username@keybase.io' in the key",
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
