package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdPGPGen struct {
	arg engine.PGPEngineArg
}

var SmallKey int = 1024

func (v *CmdPGPGen) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		err = fmt.Errorf("pgp gen takes 0 args")
	} else {
		g := libkb.PGPGenArg{}
		g.PGPUids = ctx.StringSlice("pgp-uid")
		g.NoDefPGPUid = ctx.Bool("no-default-pgp-uid")
		if g.NoDefPGPUid && len(g.PGPUids) == 0 {
			err = fmt.Errorf("if you don't want the default PGP uid, you must supply a PGP uid with the --pgp-uid option.")
		}
		if ctx.Bool("debug") {
			g.PrimaryBits = SmallKey
			g.SubkeyBits = SmallKey
		}
		v.arg.Gen = &g
	}
	return err
}

func (v *CmdPGPGen) RunClient() (err error) {
	var cli keybase_1.MykeyClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	gen := v.arg.Gen
	if cli, err = GetMykeyClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else if err = gen.CreatePgpIDs(); err != nil {
	} else {
		err = cli.KeyGen(gen.Export())
	}
	return
}

func (v *CmdPGPGen) Run() (err error) {
	ctx := &engine.Context{SecretUI: G_UI.GetSecretUI(), LogUI: G_UI.GetLogUI()}
	v.arg.Gen.MakeAllIds()
	eng := engine.NewPGPEngine(v.arg)
	return engine.RunEngine(eng, ctx, nil, nil)
}

func NewCmdPGPGen(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "gen",
		Usage:       "keybase pgp gen",
		Description: "Generate a new PGP key and write to local secret keychain",
		Flags: append([]cli.Flag{
			cli.BoolFlag{
				Name:  "d, debug",
				Usage: "Generate small keys for debugging",
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
		}),
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPGen{}, "gen", c)
		},
	}
}

func (v *CmdPGPGen) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
