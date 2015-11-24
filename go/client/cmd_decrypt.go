// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
)

type CmdDecrypt struct {
	libkb.Contextified
	filter     UnixFilter
	recipients []string
}

func NewCmdDecrypt(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "decrypt",
		Usage: "Decrypt messages or files for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDecrypt{
				Contextified: libkb.NewContextified(g),
			}, "decrypt", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message on the command line.",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (stdout by default).",
			},
		},
	}
}

func (c *CmdDecrypt) Run() error {
	cli, err := GetKBCMFClient()
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(c.G()),
		NewIdentifyTrackUIProtocol(c.G()),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	snk, src, err := c.filter.ClientFilterOpen()
	if err != nil {
		return err
	}

	arg := keybase1.KbcmfDecryptArg{Source: src, Sink: snk}
	err = cli.KbcmfDecrypt(context.TODO(), arg)

	cerr := c.filter.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdDecrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		Config:    true,
		KbKeyring: true,
	}
}

func (c *CmdDecrypt) ParseArgv(ctx *cli.Context) error {
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	if err := c.filter.FilterInit(msg, infile, outfile); err != nil {
		return err
	}

	return nil
}
