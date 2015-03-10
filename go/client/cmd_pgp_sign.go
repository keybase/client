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

func NewCmdPGPSign(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "sign",
		Usage:       "keybase pgp sign [-a] [-o <outfile>] [<infile>]",
		Description: "sign a clear document",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPSign{}, "sign", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "output binary message (armored by default)",
			},
			cli.BoolFlag{
				Name:  "t, text",
				Usage: "treat input data as text and canonicalize",
			},
			cli.BoolFlag{
				Name:  "d, detached",
				Usage: "detached signature (we do attached by default)",
			},
			cli.BoolFlag{
				Name:  "c, clearsign",
				Usage: "generate a clearsigned text signature",
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

type CmdPGPSign struct {
	UnixFilter
	msg  string
	opts keybase_1.PgpSignOptions
	arg  engine.PGPSignArg
}

func (s *CmdPGPSign) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.opts.BinaryOut = ctx.Bool("binary")
	s.opts.BinaryIn = !ctx.Bool("text")

	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	var infile string

	if nargs == 1 {
		infile = ctx.Args()[0]
	} else if nargs > 1 {
		err = fmt.Errorf("sign takes at most 1 arg, an infile")
	}

	clr := ctx.Bool("clearsign")
	dtch := ctx.Bool("detached")

	if clr && dtch {
		err = fmt.Errorf("Can't specify both -c and -d")
	} else if clr {
		s.opts.Mode = keybase_1.SignMode_CLEAR
	} else if dtch {
		s.opts.Mode = keybase_1.SignMode_DETACHED
	} else {
		s.opts.Mode = keybase_1.SignMode_ATTACHED
	}

	s.opts.KeyQuery = ctx.String("key")

	if err == nil {
		err = s.FilterInit(msg, infile, outfile)
	}

	return err
}

func (s *CmdPGPSign) RunClient() (err error) {
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
		arg := keybase_1.PgpSignArg{Source: src, Sink: snk, Opts: s.opts}
		err = cli.PgpSign(arg)
	}
	s.Close(err)
	return err
}

func (s *CmdPGPSign) Run() (err error) {
	if err = s.FilterOpen(); err != nil {
		return
	}
	earg := engine.PGPSignArg{Sink: s.sink, Source: s.source, Opts: s.opts}
	ctx := engine.Context{
		SecretUI: G_UI.GetSecretUI(),
	}
	eng := engine.NewPGPSignEngine(&earg)
	err = engine.RunEngine(eng, &ctx, nil, nil)
	s.Close(err)
	return err
}

func (v *CmdPGPSign) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		Terminal:  true,
		KbKeyring: true,
	}
}
