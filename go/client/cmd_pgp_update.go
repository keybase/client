package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdPGPUpdate struct {
	fingerprints []string
	all          bool
}

func (v *CmdPGPUpdate) ParseArgv(ctx *cli.Context) error {
	v.fingerprints = ctx.Args()
	v.all = ctx.Bool("all")
	return nil
}

func (v *CmdPGPUpdate) RunClient() (err error) {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.PgpUpdate(keybase_1.PgpUpdateArg{
		Fingerprints: v.fingerprints,
		All:          v.all,
	})
}

func (v *CmdPGPUpdate) Run() error {
	eng := engine.NewPGPUpdateEngine(v.fingerprints, v.all)
	ctx := engine.Context{
		LogUI: G_UI.GetLogUI(),
	}
	return engine.RunEngine(eng, &ctx)
}
func NewCmdPGPUpdate(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "update",
		Usage:       "keybase pgp update",
		Description: "Upload the latest PGP metadata for your keys",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "all",
				Usage: "update all available keys",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPUpdate{}, "update", c)
		},
	}
}

func (v *CmdPGPUpdate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
