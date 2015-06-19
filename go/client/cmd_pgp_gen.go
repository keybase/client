package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdPGPGen struct {
	arg engine.PGPKeyImportEngineArg
}

var SmallKey = 1024

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
			err = fmt.Errorf("if you don't want the default PGP uid, you must supply a PGP uid with the --pgp-uid option")
		}
		if ctx.Bool("debug") {
			g.PrimaryBits = SmallKey
			g.SubkeyBits = SmallKey
		}
		v.arg.Gen = &g
	}
	return err
}

// XXX is there a reason this uses CreatePgpIDs and the standalone
// Run below uses MakeAllIds?
func (v *CmdPGPGen) RunClient() (err error) {
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	if err = v.arg.Gen.CreatePgpIDs(); err != nil {
		return err
	}
	err = cli.PgpKeyGen(v.arg.Export())
	PGPMultiWarn(err)
	return err
}

func (v *CmdPGPGen) Run() (err error) {
	ctx := &engine.Context{SecretUI: GlobUI.GetSecretUI(), LogUI: GlobUI.GetLogUI()}
	if err = v.arg.Gen.MakeAllIds(); err != nil {
		return
	}
	eng := engine.NewPGPKeyImportEngine(v.arg)
	err = engine.RunEngine(eng, ctx)
	PGPMultiWarn(err)
	return
}

func PGPMultiWarn(err error) {
	if err == nil {
		return
	}
	if kee, ok := err.(libkb.KeyExistsError); ok {
		G.Log.Warning("You already have a PGP key registered (%s)", kee.Key.ToQuads())
		G.Log.Info("Specify the `--multi` flag to override this check")
	}
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
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
