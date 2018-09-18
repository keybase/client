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
	filter UnixFilter
	opts   keybase1.SaltpackEncryptOptions
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
			Name: "no-device-keys",
			Usage: `Do not use the device keys of all the user recipients
	(and members of recipient teams) for encryption.
	This does not affect paper keys.`,
		},
		cli.BoolFlag{
			Name: "no-paper-keys",
			Usage: `Do not use the paper keys of all the user recipients
	(and members of recipient teams) for encryption.`,
		},
		cli.BoolFlag{
			Name:  "no-self-encrypt",
			Usage: "Don't encrypt for yourself.",
		},
		cli.StringFlag{
			Name:  "auth-type",
			Value: "signed",
			Usage: `How to guarantee sender authenticity:
	signed|repudiable|anonymous. Uses this device's key for signing, pairwise
	MACs for repudiability, or nothing if anonymous.`,
		},
		cli.IntFlag{
			Name:  "saltpack-version",
			Usage: "Force a specific saltpack version",
		},
	}
	if develUsage {
		flags = append(flags, cli.BoolFlag{
			Name: "use-kbfs-keys-only",
			Usage: `[devel only] Encrypt using only kbfs keys (and post kbfs
	pseudonyms) to simulate messages encrypted with older versions of keybase.
	Used for tests. It ignores other no-*-keys options and team recipients.`,
		})
	}

	return cli.Command{
		Name:         "encrypt",
		ArgumentHelp: "<usernames...>",
		Usage:        "Encrypt messages or files for keybase users and teams",
		Description: `
Encrypt messages and files for keybase users and teams using the Saltpack
encryption format (https://saltpack.org). Saltpack is built on top of the
well-established NaCl crypto library (https://nacl.cr.yp.to/), adding support
for multiple recipients, a new copy-paste friendly ASCII output format, and the
ability to encrypt very large files that don't fit into memory. Messages are
securely encrypted and cannot be read by anyone but the intended recipient and
cannot be altered in any way.

"keybase encrypt" makes decryption as simple as possible:

  - When encrypting for a keybase user, decryption is possible with any of the
  recipients current or future devices through their keybase per-user-key.

  - Team encryption, available through the "--team" flag, encrypts the message
  for all devices of the current team members as well as devices of people who
  later join the team through a shared team key. Members will be able to
  decrypt the message *even after they leave the team*.

  - You can also encrypt for users who have not yet joined keybase, but are on
  a social network such as foo@twitter: the message will be encrypted with a
  key known only to your devices and will be automatically rekeyed for the
  recipient once they join keybase and prove they own the account 'foo' on
  twitter.

  - For advanced users, the set of keys used to encrypt the message can be
  customized through flags.

"keybase encrypt" provides strong integrity guarantees. By default, messages are
signed with the key of the encrypting device. Messages can also use repudiable
authentication (the recipient of a message can be convinced that you sent it,
but cannot convince a third party of this fact) or made completely anonymous.

Encrypting for teams (and users not yet on keybase or with missing keys) with
repudiable authentication is not possible. You can still use the signed or
anonymous modes in such cases.
`,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdEncrypt{
				Contextified: libkb.NewContextified(g),
			}, "encrypt", c)
			cl.SetNoStandalone() // CORE-8423 for now we need KBFS.
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

	arg := keybase1.SaltpackEncryptArg{Source: src, Sink: snk, Opts: c.opts}
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
	c.opts.TeamRecipients = ctx.StringSlice("team")
	c.opts.Recipients = ctx.Args()
	if len(c.opts.Recipients) == 0 && len(c.opts.TeamRecipients) == 0 {
		return errors.New("Encrypt needs at least one recipient")
	}

	c.opts.UseEntityKeys = !ctx.Bool("no-entity-keys")
	c.opts.UseDeviceKeys = !ctx.Bool("no-device-keys")
	c.opts.UsePaperKeys = !ctx.Bool("no-paper-keys")
	c.opts.UseKBFSKeysOnlyForTesting = ctx.Bool("use-kbfs-keys-only")

	var ok bool
	if c.opts.AuthenticityType, ok = keybase1.AuthenticityTypeMap[strings.ToUpper(ctx.String("auth-type"))]; !ok {
		return errors.New("invalid auth-type option provided")
	}

	// Repudiable authenticity corresponds to the saltpack encryption format (which uses pairwise MACs instead of signatures). Because of the spec
	// and the interface exposed by saltpack v2, we cannot use the pseudonym mechanism with the encryption format. As such, we cannot encrypt for teams
	// (and implicit teams): we can error here for teams, and later if resolving any user would lead to the creation of an implicit team.
	if c.opts.UseEntityKeys && len(c.opts.TeamRecipients) > 0 && c.opts.AuthenticityType == keybase1.AuthenticityType_REPUDIABLE {
		return errors.New("--auth-type=repudiable requires --no-entity-keys when encrypting for a team")
	}

	if !(c.opts.UseEntityKeys || c.opts.UseDeviceKeys || c.opts.UsePaperKeys) {
		return errors.New("please remove at least one of --no-device-keys, --no-paper-keys or --no-entity-keys")
	}

	c.opts.NoSelfEncrypt = ctx.Bool("no-self-encrypt")
	c.opts.Binary = ctx.Bool("binary")
	c.opts.SaltpackVersion = ctx.Int("saltpack-version")

	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	return c.filter.FilterInit(c.G(), msg, infile, outfile)
}
