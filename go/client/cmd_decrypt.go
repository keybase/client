// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"fmt"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdDecrypt struct {
	libkb.Contextified
	filter     UnixFilter
	recipients []string
	spui       *SaltpackUI
	opts       keybase1.SaltpackDecryptOptions
	senderfile *FileSink
}

func NewCmdDecrypt(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "decrypt",
		Usage: "Decrypt messages or files for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDecryptRunner(g), "decrypt", c)
		},
		Flags: []cli.Flag{
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
				Name:  "interactive",
				Usage: "Interactive prompt for decryption after sender verification",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Force unprompted decryption, even on an identify failure",
			},
			cli.BoolFlag{
				Name:  "paperkey",
				Usage: "Use a paper key for decryption",
			},
			cli.StringFlag{
				Name:  "encryptor-outfile",
				Usage: "Write the Keybase name of the encryptor to this file",
			},
		},
	}
}

func NewCmdDecryptRunner(g *libkb.GlobalContext) *CmdDecrypt {
	return &CmdDecrypt{
		Contextified: libkb.NewContextified(g),
		opts:         keybase1.SaltpackDecryptOptions{ForceRemoteCheck: true},
	}
}

func (c *CmdDecrypt) explainDecryptionFailure(info *keybase1.SaltpackEncryptedMessageInfo) {
	if info == nil {
		return
	}
	out := c.G().UI.GetTerminalUI().ErrorWriter()
	prnt := func(s string, args ...interface{}) {
		fmt.Fprintf(out, s, args...)
	}
	if len(info.Devices) > 0 {
		prnt("Decryption failed; try one of these devices instead:\n")
		for _, d := range info.Devices {
			t := keybase1.FromTime(d.CTime)
			prnt("  * %s (%s); provisioned %s (%s)\n", ColorString("bold", d.Name), d.Type,
				humanize.Time(t), t.Format("2006-01-02 15:04:05 MST"))
		}
		if info.NumAnonReceivers > 0 {
			prnt("Additionally, there were %d hidden receivers for this message\n", info.NumAnonReceivers)
		}
	} else if info.NumAnonReceivers > 0 {
		prnt("Decryption failed; it was encrypted for %d hidden receivers, which may or may not be you\n", info.NumAnonReceivers)
	} else {
		prnt("Decryption failed; message wasn't encrypted for any of your known keys\n")
	}
}

func (c *CmdDecrypt) Run() error {
	cli, err := GetSaltpackClient(c.G())
	if err != nil {
		return err
	}

	// Can't do this in ParseArgv, need to wait until later
	// in the initialization
	c.spui.terminal = c.G().UI.GetTerminalUI()

	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
		NewIdentifyUIProtocol(c.G()),
		keybase1.SaltpackUiProtocol(c.spui),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	snk, src, err := c.filter.ClientFilterOpen(c.G())
	if err != nil {
		return err
	}

	var info keybase1.SaltpackEncryptedMessageInfo
	arg := keybase1.SaltpackDecryptArg{
		Source: src,
		Sink:   snk,
		Opts:   c.opts,
	}
	info, err = cli.SaltpackDecrypt(context.TODO(), arg)
	if _, ok := err.(libkb.NoDecryptionKeyError); ok {
		c.explainDecryptionFailure(&info)
	} else if c.senderfile != nil {
		if info.Sender.Username != "" {
			if _, err := c.senderfile.Write([]byte(info.Sender.Username)); err != nil {
				c.G().Log.Errorf("failure writing sender file: %s", err)
			}
		}
		c.senderfile.Close()
	}

	cerr := c.filter.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdDecrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		Config:    true,
		KbKeyring: true,
	}
}

func (c *CmdDecrypt) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("decrypt")
	}
	interactive := ctx.Bool("interactive")
	c.spui = &SaltpackUI{
		Contextified: libkb.NewContextified(c.G()),
		interactive:  interactive,
		force:        ctx.Bool("force"),
	}
	c.opts.Interactive = interactive
	c.opts.UsePaperKey = ctx.Bool("paperkey")
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	senderfile := ctx.String("encryptor-outfile")
	if err := c.filter.FilterInit(msg, infile, outfile); err != nil {
		return err
	}
	if senderfile != "" {
		c.senderfile = NewFileSink(senderfile)
	}

	return nil
}
