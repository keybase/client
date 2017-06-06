// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdEncrypt struct {
	libkb.Contextified
	filter             UnixFilter
	recipients         []string
	binary             bool
	anonymousSender    bool
	currentDevicesOnly bool // the public-facing term for "encryption-only mode"
	noSelfEncrypt      bool
}

func NewCmdEncrypt(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.BoolFlag{
			Name:  "b, binary",
			Usage: "Output in binary (rather than ASCII/armored).",
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
			Name:  "o, outfile",
			Usage: "Specify an outfile (stdout by default).",
		},
		cli.BoolFlag{
			Name:  "anonymous",
			Usage: "Don't include a sender.",
		},
		cli.BoolFlag{
			Name:  "current-devices-only", // the public-facing term for "encryption-only mode"
			Usage: "Don't use any forward-compatible keys or server assistance.",
		},
		cli.BoolFlag{
			Name:  "no-self",
			Usage: "Don't encrypt for yourself. Requires --current-devices-only.",
		},
	}

	// TODO: This mode is now the default, and we're only retaining this flag
	// for backwards compatibility with the docker tests. Remove it after the
	// switchover is landed.
	if libkb.DefaultRunMode == libkb.DevelRunMode {
		flags = append(flags, cli.BoolFlag{
			Name:  "signcrypt",
			Usage: "TEMPORARY",
		})
	}

	return cli.Command{
		Name:         "encrypt",
		ArgumentHelp: "<usernames...>",
		Usage:        "Encrypt messages or files for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdEncrypt{
				Contextified: libkb.NewContextified(g),
			}, "encrypt", c)
		},
		Flags: flags,
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

	snk, src, err := c.filter.ClientFilterOpen(c.G())
	if err != nil {
		return err
	}

	opts := keybase1.SaltpackEncryptOptions{
		Recipients:         c.recipients,
		AnonymousSender:    c.anonymousSender,
		EncryptionOnlyMode: c.currentDevicesOnly,
		NoSelfEncrypt:      c.noSelfEncrypt,
		Binary:             c.binary,
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
	c.anonymousSender = ctx.Bool("anonymous")
	c.currentDevicesOnly = ctx.Bool("current-devices-only")
	c.noSelfEncrypt = ctx.Bool("no-self")
	if c.noSelfEncrypt && !c.currentDevicesOnly {
		// TODO: Back-compat hack for docker tests. Remove this after landing,
		// and re-enable the error below.
		c.currentDevicesOnly = true
		// return errors.New("--no-self requires --current-devices-only")
	}
	c.binary = ctx.Bool("binary")
	if err := c.filter.FilterInit(msg, infile, outfile); err != nil {
		return err
	}

	return nil
}
