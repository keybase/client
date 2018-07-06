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
	filter           UnixFilter
	recipients       []string
	binary           bool
	useEntityKeys    bool
	useDeviceKeys    bool
	usePaperKeys     bool
	noSelfEncrypt    bool
	authenticityType keybase1.AuthenticityType
	saltpackVersion  int
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
		cli.BoolTFlag{ // True by default!
			Name:  "use-entity-keys",
			Usage: "Use per user/per team keys for encryption. Default is true.",
		},
		cli.BoolFlag{
			Name:  "use-device-keys",
			Usage: "Use the device keys of all the user recipients (and memebers of teams) for encryption. Not supported for large teams (a warning will be issued).",
		},
		cli.BoolFlag{
			Name:  "use-paper-keys",
			Usage: "Use the paper keys of all the user recipients (and memebers of teams) for encryption. Not supported for large teams (a warning will be issued).",
		},
		cli.BoolFlag{
			Name:  "no-self-encrypt",
			Usage: "Don't encrypt for yourself.",
		},
		cli.StringFlag{
			Name:  "auth-type",
			Value: "SIGNED",
			Usage: "How to guarantee sender authenticity: SIGNED|REPUDIABLE|ANONYMOUS. Uses this device's key for signing, pairwise MACs for repudiability, nothing if anonymous.",
		},
		cli.IntFlag{
			Name:  "saltpack-version",
			Usage: "Force a specific saltpack version",
		},
	}

	return cli.Command{
		Name:         "encrypt",
		ArgumentHelp: "<usernames...>",
		Usage:        "Encrypt messages or files for keybase users and teams",
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
		Recipients:       c.recipients,
		AuthenticityType: c.authenticityType,
		UseEntityKeys:    c.useEntityKeys,
		UseDeviceKeys:    c.useDeviceKeys,
		UsePaperKeys:     c.usePaperKeys,
		NoSelfEncrypt:    c.noSelfEncrypt,
		Binary:           c.binary,
		SaltpackVersion:  c.saltpackVersion,
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
	c.useEntityKeys = ctx.Bool("use-entity-keys")
	c.useDeviceKeys = ctx.Bool("use-device-keys")
	c.usePaperKeys = ctx.Bool("use-paper-keys")
	var ok bool
	if c.authenticityType, ok = keybase1.AuthenticityTypeMap[ctx.String("auth-type")]; !ok {
		return errors.New("invalid auth-type option provided")
	}
	if c.useEntityKeys && c.authenticityType == keybase1.AuthenticityType_REPUDIABLE {
		return errors.New("cannot use --use-entity-keys and --auth-type=repudiable together")
	}
	if !(c.useEntityKeys || c.useDeviceKeys || c.usePaperKeys) {
		return errors.New("please choose at least one type of keys (between --use-entity-keys, --use-device-keys, --use-paper-keys")
	}
	c.noSelfEncrypt = ctx.Bool("no-self-encrypt")
	c.binary = ctx.Bool("binary")
	c.saltpackVersion = ctx.Int("saltpack-version")
	return c.filter.FilterInit(c.G(), msg, infile, outfile)
}
