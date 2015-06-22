package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
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
	opts keybase1.PGPSignOptions
	arg  engine.PGPSignArg
}

func (s *CmdPGPSign) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return fmt.Errorf("sign takes at most 1 arg, an infile")
	}

	s.opts.BinaryOut = ctx.Bool("binary")
	s.opts.BinaryIn = !ctx.Bool("text")

	msg := ctx.String("message")
	outfile := ctx.String("outfile")

	var infile string
	if nargs == 1 {
		infile = ctx.Args()[0]
	}

	clr := ctx.Bool("clearsign")
	dtch := ctx.Bool("detached")

	if clr && dtch {
		return fmt.Errorf("Can't specify both -c and -d")
	}

	if clr {
		s.opts.Mode = keybase1.SignMode_CLEAR
	} else if dtch {
		s.opts.Mode = keybase1.SignMode_DETACHED
	} else {
		s.opts.Mode = keybase1.SignMode_ATTACHED
	}

	s.opts.KeyQuery = ctx.String("key")

	return s.FilterInit(msg, infile, outfile)
}

func (s *CmdPGPSign) RunClient() (err error) {
	protocols := []rpc2.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(),
	}

	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	snk, src, err := s.ClientFilterOpen()
	if err == nil {
		arg := keybase1.PGPSignArg{Source: src, Sink: snk, Opts: s.opts}
		err = cli.PGPSign(arg)
	}
	return s.Close(err)
}

func (s *CmdPGPSign) Run() (err error) {
	if err = s.FilterOpen(); err != nil {
		return
	}
	earg := engine.PGPSignArg{Sink: s.sink, Source: s.source, Opts: s.opts}
	ctx := engine.Context{
		SecretUI: GlobUI.GetSecretUI(),
	}
	eng := engine.NewPGPSignEngine(&earg, G)
	err = engine.RunEngine(eng, &ctx)
	s.Close(err)
	return err
}

func (s *CmdPGPSign) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
