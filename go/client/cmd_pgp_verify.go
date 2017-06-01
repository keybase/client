// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"io/ioutil"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdPGPVerify(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "verify",
		Usage: "PGP verify message or file signatures for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPVerify{Contextified: libkb.NewContextified(g)}, "verify", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "d, detached",
				Usage: "Specify a detached signature file.",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message on the command line.",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "Assert signed by the given user (can use user assertion format).",
			},
		},
	}
}

type CmdPGPVerify struct {
	libkb.Contextified
	UnixFilter
	detachedFilename string
	detachedData     []byte
	signedBy         string
}

func (c *CmdPGPVerify) Run() error {
	cli, err := GetPGPClient(c.G())
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
		NewIdentifyMaybeTrackUIProtocol(c.G()),
		NewPgpUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	_, src, err := c.ClientFilterOpen(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.PGPVerifyArg{
		Source: src,
		Opts: keybase1.PGPVerifyOptions{
			Signature: c.detachedData,
			SignedBy:  c.signedBy,
		},
	}
	_, err = cli.PGPVerify(context.TODO(), arg)

	cerr := c.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdPGPVerify) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("pgp verify")
	}

	msg := ctx.String("message")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, "/dev/null"); err != nil {
		return err
	}
	c.signedBy = ctx.String("signed-by")
	c.detachedFilename = ctx.String("detached")

	if len(c.detachedFilename) > 0 {
		data, err := ioutil.ReadFile(c.detachedFilename)
		if err != nil {
			return err
		}
		c.detachedData = data
	}

	return nil
}

func (c *CmdPGPVerify) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
