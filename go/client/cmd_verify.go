// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
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
	if err := c.FilterInit(c.G(), msg, infile, outfile); err != nil {
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
	var sender keybase1.SaltpackSender
	if err == nil {
		arg := keybase1.SaltpackVerifyArg{
			Source: src,
			Sink:   snk,
			Opts: keybase1.SaltpackVerifyOptions{
				Signature: c.detachedData,
				SignedBy:  c.signedBy,
			},
		}
		sender, err = cli.SaltpackVerify(context.TODO(), arg)
	}
	cerr := c.Close(err)

	if err = libkb.PickFirstError(err, cerr); err != nil {
		return err
	}

	var what string
	if c.UnixFilter.msg != "" {
		what = "message"
	} else {
		what = c.UnixFilter.infile
	}
	var who string
	switch sender.SenderType {
	case keybase1.SaltpackSenderType_NOT_TRACKED:
		who = fmt.Sprintf("authored by %s, who you do not follow", sender.Username)
	case keybase1.SaltpackSenderType_UNKNOWN:
		who = "author is unknown to keybase"
	case keybase1.SaltpackSenderType_ANONYMOUS:
		who = "author chose tho remain anonymous"
	case keybase1.SaltpackSenderType_TRACKING_OK:
		who = fmt.Sprintf("authored by %s", sender.Username)
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
		who = fmt.Sprintf("authored by %s, but review their identity", sender.Username)
	case keybase1.SaltpackSenderType_SELF:
		who = fmt.Sprintf("authored by you: %s", sender.Username)
	case keybase1.SaltpackSenderType_REVOKED:
		who = fmt.Sprintf("authored by %s, but the key was revoked", sender.Username)
	case keybase1.SaltpackSenderType_EXPIRED:
		who = fmt.Sprintf("authored by %s, but the key expired", sender.Username)
	default:
		panic("cmd_decrypt: unexpected sender type.")
	}

	err = cli.NotifySaltpackSuccess(context.TODO(), keybase1.NotifySaltpackSuccessArg{
		Typ:     keybase1.SaltpackOperationType_VERIFY,
		Message: fmt.Sprintf("Successfully verified %s (%s)", what, who),
	})

	return err

}

func (c *CmdVerify) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
