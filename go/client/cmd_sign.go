package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdSign(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "sign",
		Usage:       "keybase sign [-a] [-o <outfile>] [<infile>]",
		Description: "sign a clear document",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSign{}, "sign", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "output binary message (armored by default",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "provide the message to sign on the command line",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "specify an outfile (stdout by default)",
			},
			cli.StringFlag{
				Name:  "k, key",
				Usage: "specify a key to use for signing (otherwise most recent PGP key is used)",
			},
		},
	}
}

type CmdSign struct {
	UnixFilter
	binary   bool
	msg      string
	keyQuery string
}

func (s *CmdSign) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.binary = ctx.Bool("binary")
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	var infile string

	if nargs == 1 {
		infile = ctx.Args()[0]
	} else if nargs > 1 {
		err = fmt.Errorf("sign takes at most 1 arg, an infile")
	}

	s.keyQuery = ctx.String("key")

	if err == nil {
		err = s.FilterInit(msg, infile, outfile)
	}

	return err
}

func (s *CmdSign) RunClient() (err error) {
	var cli keybase_1.PgpcmdsClient
	var snk, src keybase_1.Stream
	protocols := []rpc2.Protocol{
		NewStreamUiProtocol(),
		NewSecretUIProtocol(),
	}

	if cli, err = GetPgpcmdsClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else if snk, src, err = s.ClientFilterOpen(); err != nil {
	} else {
		arg := keybase_1.PgpSignArg{
			Source:   src,
			Sink:     snk,
			KeyQuery: s.keyQuery,
			Binary:   s.binary,
		}
		err = cli.PgpSign(arg)
	}
	s.Close(err)
	return err
}

func (s *CmdSign) Run() (err error) {
	if err = s.FilterOpen(); err != nil {
		return
	}
	earg := engine.PGPCmdSignArg{
		Sink:     s.sink,
		Source:   s.source,
		KeyQuery: s.keyQuery,
		Binary:   s.binary,
	}
	ctx := engine.Context{
		SecretUI: G_UI.GetSecretUI(),
	}
	eng := engine.NewPGPCmdSignEngine(&earg)
	err = engine.RunEngine(eng, &ctx, nil, nil)
	s.Close(err)
	return err
}

func (v *CmdSign) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		Terminal:  true,
		KbKeyring: true,
	}
}
