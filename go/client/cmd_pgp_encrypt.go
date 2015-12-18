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

func NewCmdPGPEncrypt(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "encrypt",
		ArgumentHelp: "<usernames...>",
		Usage:        "PGP encrypt messages or files for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPEncrypt{Contextified: libkb.NewContextified(g)}, "encrypt", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "Output in binary (rather than ASCII/armored).",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "k, key",
				Usage: "Specify a key to use (otherwise most recent PGP key is used).",
			},
			cli.BoolFlag{
				Name:  "l, local",
				Usage: "Only track locally, don't send a statement to the server.",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message on the command line.",
			},
			cli.BoolFlag{
				Name:  "no-self",
				Usage: "Don't encrypt for self.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (stdout by default).",
			},
			cli.BoolFlag{
				Name:  "s, sign",
				Usage: "Sign in addition to encrypting.",
			},
			cli.BoolFlag{
				Name:  "skip-track",
				Usage: "Don't track.",
			},
			cli.BoolFlag{
				Name:  "y",
				Usage: "Approve remote tracking without prompting.",
			},
		},
		Description: `If encrypting with signatures, "keybase pgp encrypt" requires an
   imported PGP private key, and accesses the local Keybase keyring when producing
   the signature.`,
	}
}

type CmdPGPEncrypt struct {
	libkb.Contextified
	UnixFilter
	recipients   []string
	trackOptions keybase1.TrackOptions
	sign         bool
	noSelf       bool
	keyQuery     string
	binaryOut    bool
	skipTrack    bool
}

func (c *CmdPGPEncrypt) Run() error {
	cli, err := GetPGPClient()
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
	snk, src, err := c.ClientFilterOpen()
	if err != nil {
		return err
	}
	opts := keybase1.PGPEncryptOptions{
		Recipients:   c.recipients,
		NoSign:       !c.sign,
		NoSelf:       c.noSelf,
		BinaryOut:    c.binaryOut,
		KeyQuery:     c.keyQuery,
		SkipTrack:    c.skipTrack,
		TrackOptions: c.trackOptions,
	}
	arg := keybase1.PGPEncryptArg{Source: src, Sink: snk, Opts: opts}
	err = cli.PGPEncrypt(context.TODO(), arg)

	cerr := c.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdPGPEncrypt) ParseArgv(ctx *cli.Context) error {
	c.noSelf = ctx.Bool("no-self")
	if c.noSelf && len(ctx.Args()) == 0 {
		return errors.New("Encrypt needs at least one recipient, or --no-self=false")
	}
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, outfile); err != nil {
		return err
	}
	c.recipients = ctx.Args()
	c.trackOptions = keybase1.TrackOptions{
		LocalOnly:     ctx.Bool("local"),
		BypassConfirm: ctx.Bool("y"),
	}
	c.sign = ctx.Bool("sign")
	c.skipTrack = ctx.Bool("skip-track")
	c.keyQuery = ctx.String("key")
	c.binaryOut = ctx.Bool("binary")
	return nil
}

func (c *CmdPGPEncrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
