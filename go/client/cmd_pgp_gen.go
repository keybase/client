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
		v.arg.AllowMulti = ctx.Bool("multi")
		v.arg.DoExport = !ctx.Bool("no-export")
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
		err = cli.KeyGen(v.arg.Export())
	}
	PGPMultiWarn(err)
	return
}

func (v *CmdPGPGen) Run() (err error) {
	ctx := &engine.Context{SecretUI: G_UI.GetSecretUI(), LogUI: G_UI.GetLogUI()}
	v.arg.Gen.MakeAllIds()
	eng := engine.NewPGPEngine(v.arg)
	err = engine.RunEngine(eng, ctx, nil, nil)
	PGPMultiWarn(err)
	return
}

func PGPMultiWarn(err error) {
	if err == nil {
	} else if kee, ok := err.(libkb.KeyExistsError); ok {
		G.Log.Warning("You already have a PGP key registered (%s)",
			kee.Key.ToQuads())
		G.Log.Info("Specify the `--multi` flag to override this check")
	}
	return
}

func NewCmdPGPGen(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "gen",
		Usage:       "keybase pgp gen",
		Description: "Generate a new PGP key and write to local secret keychain",
		Flags: []cli.Flag{
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
			cli.BoolFlag{
				Name:  "multi",
				Usage: "Allow multiple PGP keys",
			},
			cli.BoolFlag{
				Name:  "no-export",
				Usage: "Turn of exporting of new keys to GPG keychain",
			},
		},
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
