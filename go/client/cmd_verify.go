// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"io/ioutil"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewCmdVerify(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "verify",
		Usage: "Verify message or file signatures for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdVerify{Contextified: libkb.NewContextified(g)}, "verify", c)
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
				Usage: "Provide the message to verify on the command line.",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "Assert signed by the given user (can use user assertion format).",
			},
		},
	}
}

type CmdVerify struct {
	libkb.Contextified
	UnixFilter
	detachedData []byte
	signedBy     string
}

func (c *CmdVerify) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("verify")
	}

	msg := ctx.String("message")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, "/dev/null"); err != nil {
		return err
	}
	c.signedBy = ctx.String("signed-by")
	detachedFilename := ctx.String("detached")

	if len(detachedFilename) > 0 {
		data, err := ioutil.ReadFile(detachedFilename)
		if err != nil {
			return err
		}
		c.detachedData = data
	}

	return nil
}

func (c *CmdVerify) Run() (err error) {
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(c.G()),
		NewIdentifyUIProtocol(c.G()),
	}

	cli, err := GetSaltPackClient(c.G())
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	snk, src, err := c.ClientFilterOpen()
	if err == nil {
		arg := keybase1.SaltPackVerifyArg{
			Source: src,
			Sink:   snk,
			Opts: keybase1.SaltPackVerifyOptions{
				Signature: c.detachedData,
				SignedBy:  c.signedBy,
			},
		}
		err = cli.SaltPackVerify(context.TODO(), arg)
	}
	cerr := c.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdVerify) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
