// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
)

type CmdEncrypt struct {
	libkb.Contextified
	filter       UnixFilter
	recipients   []string
	trackOptions keybase1.TrackOptions
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
			// TODO: Make self-encryption optional:
			// https://keybase.atlassian.net/browse/CORE-2143
			// .
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.BoolFlag{
				Name:  "l, local",
				Usage: "Only track locally, don't send a statement to the server.",
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
				Name:  "y",
				Usage: "Approve remote tracking without prompting.",
			},
		},
	}
}

func (c *CmdEncrypt) Run() error {
	cli, err := GetKBCMFClient(c.G())
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

	opts := keybase1.KBCMFEncryptOptions{
		Recipients:   c.recipients,
		TrackOptions: c.trackOptions,
	}
	arg := keybase1.KbcmfEncryptArg{Source: src, Sink: snk, Opts: opts}
	err = cli.KbcmfEncrypt(context.TODO(), arg)

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
	if err := c.filter.FilterInit(msg, infile, outfile); err != nil {
		return err
	}

	c.trackOptions = keybase1.TrackOptions{
		LocalOnly:     ctx.Bool("local"),
		BypassConfirm: ctx.Bool("y"),
	}

	return nil
}
