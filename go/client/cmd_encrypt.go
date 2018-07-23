// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"strings"

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
	teamRecipients   []string
	binary           bool
	useEntityKeys    bool
	useDeviceKeys    bool
	usePaperKeys     bool
	noSelfEncrypt    bool
	authenticityType keybase1.AuthenticityType
	saltpackVersion  int

	useKbfsKeysOnlyForTesting bool
}

func NewCmdEncrypt(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringSliceFlag{
			Name:  "team",
			Usage: "Encrypt for a team. Can be specified multiple times.",
			Value: &cli.StringSlice{},
		},
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
			Name:  "no-entity-keys",
			Usage: "Do not use per user/per team keys for encryption.",
		},
		cli.BoolFlag{
			Name:  "use-device-keys",
			Usage: "Use the device keys of all the user recipients (and memebers of teams) for encryption.",
		},
		cli.BoolFlag{
			Name:  "use-paper-keys",
			Usage: "Use the paper keys of all the user recipients (and memebers of teams) for encryption.",
		},
		cli.BoolFlag{
			Name:  "no-self-encrypt",
			Usage: "Don't encrypt for yourself.",
		},
		cli.StringFlag{
			Name:  "auth-type",
			Value: "signed",
			Usage: "How to guarantee sender authenticity: signed|repudiable|anonymous. Uses this device's key for signing, pairwise MACs for repudiability, nothing if anonymous.",
		},
		cli.IntFlag{
			Name:  "saltpack-version",
			Usage: "Force a specific saltpack version",
		},
	}
	if develUsage {
		flags = append(flags, cli.BoolFlag{
			Name:  "use-kbfs-keys-only",
			Usage: "[devel only] Encrypt using only kbfs keys (and post kbfs pseudonyms) to simulate messages encrypted with older versions of keybase. Used for tests. It ignores other use-*-keys options and team recipients.",
		})
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
		TeamRecipients:   c.teamRecipients,
		AuthenticityType: c.authenticityType,
		UseEntityKeys:    c.useEntityKeys,
		UseDeviceKeys:    c.useDeviceKeys,
		UsePaperKeys:     c.usePaperKeys,
		NoSelfEncrypt:    c.noSelfEncrypt,
		Binary:           c.binary,
		SaltpackVersion:  c.saltpackVersion,

		UseKBFSKeysOnlyForTesting: c.useKbfsKeysOnlyForTesting,
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
	c.teamRecipients = ctx.StringSlice("team")
	c.recipients = ctx.Args()
	if len(c.recipients) == 0 && len(c.teamRecipients) == 0 {
		return errors.New("Encrypt needs at least one recipient")
	}

	c.useEntityKeys = !ctx.Bool("no-entity-keys")
	c.useDeviceKeys = ctx.Bool("use-device-keys")
	c.usePaperKeys = ctx.Bool("use-paper-keys")
	c.useKbfsKeysOnlyForTesting = ctx.Bool("use-kbfs-keys-only")

	var ok bool
	if c.authenticityType, ok = keybase1.AuthenticityTypeMap[strings.ToUpper(ctx.String("auth-type"))]; !ok {
		return errors.New("invalid auth-type option provided")
	}

	// Repudiable authenticity corresponds to the saltpack encryption format (which uses pairwise macs instead of signatures). Because of the spec
	// and the interface exposed by saltpack v2, we cannot use the pseudonym mechanism with the encryption format. As such, we cannot encrypt for teams
	// (and implicit teams): we can error here for teams, and later if resolving any user would lead to the creation of an implicit team.
	if c.useEntityKeys && len(c.teamRecipients) > 0 && c.authenticityType == keybase1.AuthenticityType_REPUDIABLE {
		return errors.New("--auth-type=repudiable requires --no-entity-keys when encrypting for a team")
	}

	if !(c.useEntityKeys || c.useDeviceKeys || c.usePaperKeys) {
		return errors.New("please choose at least one type of keys (add --use-device-keys, or add --use-paper-keys, or remove --no-entity-keys")
	}

	c.noSelfEncrypt = ctx.Bool("no-self-encrypt")
	c.binary = ctx.Bool("binary")
	c.saltpackVersion = ctx.Int("saltpack-version")

	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	return c.filter.FilterInit(c.G(), msg, infile, outfile)
}
