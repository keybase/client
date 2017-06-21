// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdSign(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "sign",
		Usage: "Sign a document",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSign{Contextified: libkb.NewContextified(g)}, "sign", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "Output binary message (default is armored).",
			},
			cli.BoolFlag{
				Name:  "d, detached",
				Usage: "Detached signature (default is attached).",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message to sign on the command line.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (default is STDOUT).",
			},
			cli.IntFlag{
				Name:  "saltpack-version",
				Usage: "Force a specific saltpack version",
			},
		},
	}
}

type CmdSign struct {
	libkb.Contextified
	UnixFilter
	detached        bool
	binary          bool
	saltpackVersion int
}

func (s *CmdSign) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("sign")
	}

	s.detached = ctx.Bool("detached")
	s.binary = ctx.Bool("binary")
	s.saltpackVersion = ctx.Int("saltpack-version")

	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")

	return s.FilterInit(msg, infile, outfile)
}

func (s *CmdSign) Run() (err error) {
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(s.G()),
		NewSecretUIProtocol(s.G()),
	}

	cli, err := GetSaltpackClient(s.G())
	if err != nil {
		return err
	}
	if err = RegisterProtocolsWithContext(protocols, s.G()); err != nil {
		return err
	}
	snk, src, err := s.ClientFilterOpen(s.G())
	if err == nil {
		arg := keybase1.SaltpackSignArg{
			Source: src,
			Sink:   snk,
			Opts: keybase1.SaltpackSignOptions{
				Detached:        s.detached,
				Binary:          s.binary,
				SaltpackVersion: s.saltpackVersion,
			},
		}
		err = cli.SaltpackSign(context.TODO(), arg)
	}
	cerr := s.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (s *CmdSign) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
