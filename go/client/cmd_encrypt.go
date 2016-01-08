// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CmdEncrypt struct {
	libkb.Contextified
	filter        UnixFilter
	recipients    []string
	noSelfEncrypt bool
}

func NewCmdEncrypt(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "encrypt",
		ArgumentHelp: "<usernames...>",
		Usage:        "Encrypt messages or files for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdEncrypt{
				Contextified: libkb.NewContextified(g),
			}, "encrypt", c)
		},
		Flags: []cli.Flag{
			// TODO: Support anonymous receiver mode:
			// https://keybase.atlassian.net/browse/CORE-2142
			// .
			//
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
				Name:  "no-self",
				Usage: "Don't encrypt for yourself",
			},
		},
	}
}

func (c *CmdEncrypt) Run() error {
	cli, err := GetSaltpackClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
		NewIdentifyUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	snk, src, err := c.filter.ClientFilterOpen()
	if err != nil {
		return err
	}

	opts := keybase1.SaltpackEncryptOptions{
		Recipients:    c.recipients,
		NoSelfEncrypt: c.noSelfEncrypt,
	}
	arg := keybase1.SaltpackEncryptArg{Source: src, Sink: snk, Opts: opts}
	err = cli.SaltpackEncrypt(context.TODO(), arg)
	cerr := c.filter.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdEncrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		Config:    true,
		KbKeyring: true,
	}
}

func (c *CmdEncrypt) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return errors.New("Encrypt needs at least one recipient")
	}
	c.recipients = ctx.Args()

	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	c.noSelfEncrypt = ctx.Bool("no-self")
	if err := c.filter.FilterInit(msg, infile, outfile); err != nil {
		return err
	}

	return nil
}
