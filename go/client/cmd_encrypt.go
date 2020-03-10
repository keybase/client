// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
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
	for encryption. This does not affect paper keys.  This flag is ignored if
	encrypting for teams, where we don't encrypt for device keys by
	default.`,
		},
		cli.BoolFlag{
			Name: "no-paper-keys",
			Usage: `Do not use the paper keys of all the user recipients for
	encryption. This flag is ignored if encrypting for teams, where
	we don't encrypt for paper keys by default.`,
		},
		cli.BoolFlag{
			Name: "no-self-encrypt",
			Usage: `Don't encrypt for yourself. This flag is ignored if encrypting
	for teams, where we don't encrypt for self by default.`},
		cli.BoolFlag{
			Name: "include-device-keys",
			Usage: `Use the device keys of all the user recipients and members of
	recipient teams for encryption.  This does not affect paper keys. This
	flag is accepted if encrypting for teams, where we encrypt for
	device keys by default.`,
		},
		cli.BoolFlag{
			Name: "include-paper-keys",
			Usage: `Use the paper keys of all the user recipients and members of
	recipient teams for encryption. This flag is accepted if encrypting
	for teams, where we encrypt for paper keys by default.`,
		},
		cli.BoolFlag{
			Name: "include-self-encrypt",
			Usage: `Do encrypt for yourself. This flag is accepted if encrypting for
	teams, where we don't encrypt for self by default.`},
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
  for the team key. Future team members can decrypt the message, and members
  who leave the team will be unable to decrypt the message.

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
	res, err := cli.SaltpackEncrypt(context.TODO(), arg)
	switch {
	case err == nil:
	case libkb.IsAssertionParseErrorWithReason(err, libkb.AssertionParseErrorReasonUnexpectedOR):
		return fmt.Errorf("Unexpected OR in assertion (hint: to encrypt to multiple users, try `keybase encrypt alice bob carol -m ...`)")
	default:
		return err
	}
	err = c.filter.Close(err)
	if err != nil {
		return err
	}

	if res.UsedUnresolvedSBS {
		dui := c.G().UI.GetDumbOutputUI()
		_, _ = dui.PrintfStderr("\nNote: Encrypted for %q who is not yet a keybase user.\n\n", res.UnresolvedSBSAssertion)
		_, _ = dui.PrintfStderr("One of your devices will need to be online after they join keybase\n")
		_, _ = dui.PrintfStderr("in order for them to decrypt the message.\n\n")
	}

	return nil
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
	forRecipients := len(c.opts.Recipients) > 0
	forTeamRecipients := len(c.opts.TeamRecipients) > 0
	if !forRecipients && !forTeamRecipients {
		return errors.New("need at least one recipient")
	}
	if forRecipients && forTeamRecipients {
		return errors.New("can only encrypt for either only individuals or only teams")
	}

	c.opts.UseEntityKeys = !ctx.Bool("no-entity-keys") // by default, use entity keys
	if forRecipients {
		// if not encrypting for a team, use all keys unless "no-" flags passed
		if ctx.Bool("include-device-keys") || ctx.Bool("include-paper-keys") || ctx.Bool("include-self-encrypt") {
			return errors.New("can only use these flags if encrypting for teams: --include-device-keys, --include-paper-keys, --include-self-encrypt; please remove")
		}
		c.opts.UseDeviceKeys = !ctx.Bool("no-device-keys")
		c.opts.UsePaperKeys = !ctx.Bool("no-paper-keys")
		c.opts.NoSelfEncrypt = ctx.Bool("no-self-encrypt")
	} else {
		// if encrypting for teams, only use team entity keys unless "include-" flags passed
		if ctx.Bool("no-device-keys") || ctx.Bool("no-paper-keys") || ctx.Bool("no-self-encrypt") {
			return errors.New("cannot use these flags if encrypting for teams: --no-device-keys, --no-paper-keys, --no-self-encrypt; please remove")
		}
		c.opts.UseDeviceKeys = ctx.Bool("include-device-keys")
		c.opts.UsePaperKeys = ctx.Bool("include-paper-keys")
		c.opts.NoSelfEncrypt = !ctx.Bool("include-self-encrypt")
	}
	c.opts.UseKBFSKeysOnlyForTesting = ctx.Bool("use-kbfs-keys-only")

	if !(c.opts.UseEntityKeys || c.opts.UseDeviceKeys || c.opts.UsePaperKeys) {
		if forRecipients {
			// legal arg combos if not encrypting for team: any subset (including empty set) of at most 2 of (--no-device-keys, --no-paper-keys or --no-entity-keys)
			return errors.New("please remove at least one of --no-device-keys, --no-paper-keys or --no-entity-keys")
		}
		// legal arg combos if encrypting for team:
		//		if --no-entity-keys=true, then any subset of at least 1 of  (--include-device-keys, --include-paper-keys).
		//		else if not, any subset (including empty set) of (--include-device-keys,	--include-paperkeys).
		return errors.New("please remove --no-entity-keys, or add at least one of --include-device-keys or --include-paper-keys")
	}

	var ok bool
	if c.opts.AuthenticityType, ok = keybase1.AuthenticityTypeMap[strings.ToUpper(ctx.String("auth-type"))]; !ok {
		return errors.New("invalid auth-type option provided")
	}

	// Repudiable authenticity corresponds to the saltpack encryption format
	// (which uses pairwise MACs instead of signatures). Because of the spec and
	// the interface exposed by saltpack v2, we cannot use the pseudonym
	// mechanism with the encryption format. As such, we cannot encrypt for teams
	// (and implicit teams): we can error here for teams, and later if resolving
	// any user would lead to the creation of an implicit team.
	if forTeamRecipients && c.opts.UseEntityKeys && c.opts.AuthenticityType == keybase1.AuthenticityType_REPUDIABLE {
		return errors.New("--auth-type=repudiable requires --no-entity-keys when encrypting for a team")
	}

	c.opts.Binary = ctx.Bool("binary")
	c.opts.SaltpackVersion = ctx.Int("saltpack-version")

	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	return c.filter.FilterInit(c.G(), msg, infile, outfile)
}
