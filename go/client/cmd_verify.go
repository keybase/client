// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"io/ioutil"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
			cli.BoolFlag{
				Name:  "no-output",
				Usage: "Don't output the verified message.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (stdout by default).",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "Assert signed by the given user (can use user assertion format).",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Output the verified message even if the sender's identity can't be verified",
			},
		},
	}
}

type CmdVerify struct {
	libkb.Contextified
	UnixFilter
	detachedData []byte
	signedBy     string
	spui         *SaltpackUI
	force        bool
}

func (c *CmdVerify) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("verify")
	}

	msg := ctx.String("message")
	infile := ctx.String("infile")
	outfile := ctx.String("outfile")
	if ctx.Bool("no-output") {
		if len(outfile) > 0 {
			return errors.New("Cannot specify an outfile and no-output")
		}
		outfile = "/dev/null"
	}
	if err := c.FilterInit(msg, infile, outfile); err != nil {
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

	c.force = ctx.Bool("force")

	return nil
}

func (c *CmdVerify) Run() (err error) {
	cli, err := GetSaltpackClient(c.G())
	if err != nil {
		return err
	}

	c.spui = &SaltpackUI{
		Contextified: libkb.NewContextified(c.G()),
		terminal:     c.G().UI.GetTerminalUI(),
		force:        c.force,
	}

	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
		NewIdentifyUIProtocol(c.G()),
		keybase1.SaltpackUiProtocol(c.spui),
	}

	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	snk, src, err := c.ClientFilterOpen(c.G())
	if err == nil {
		arg := keybase1.SaltpackVerifyArg{
			Source: src,
			Sink:   snk,
			Opts: keybase1.SaltpackVerifyOptions{
				Signature: c.detachedData,
				SignedBy:  c.signedBy,
			},
		}
		err = cli.SaltpackVerify(context.TODO(), arg)
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
