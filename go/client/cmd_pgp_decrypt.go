// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func NewCmdPGPDecrypt(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "decrypt",
		Usage: "PGP decrypt messages or files for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPDecrypt{Contextified: libkb.NewContextified(g)}, "decrypt", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message on the command line.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (stdout by default).",
			},
			cli.BoolFlag{
				Name:  "s, signed",
				Usage: "Assert signed.",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "Assert signed by the given user (can use user assertion format).",
			},
		},
		Description: `Use of this command requires at least one PGP secret key imported
   into the local Keybase keyring. It will try all secret keys in the local keyring that match the
   given ciphertext, and will succeed so long as one such key is available.`,
	}
}

type CmdPGPDecrypt struct {
	libkb.Contextified
	UnixFilter
	signed   bool
	signedBy string
}

func (c *CmdPGPDecrypt) Run() error {
	cli, err := GetPGPClient(c.G())
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
		NewPgpUIProtocol(c.G()),
		NewIdentifyUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	snk, src, err := c.ClientFilterOpen(c.G())
	if err != nil {
		return err
	}
	opts := keybase1.PGPDecryptOptions{
		AssertSigned: c.signed,
		SignedBy:     c.signedBy,
	}
	arg := keybase1.PGPDecryptArg{Source: src, Sink: snk, Opts: opts}
	_, err = cli.PGPDecrypt(context.TODO(), arg)

	cerr := c.Close(err)

	return libkb.PickFirstError(err, cerr)
}

func (c *CmdPGPDecrypt) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("pgp decrypt")
	}
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, outfile); err != nil {
		return err
	}
	c.signed = ctx.Bool("signed")
	c.signedBy = ctx.String("signed-by")
	return nil
}

func (c *CmdPGPDecrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
