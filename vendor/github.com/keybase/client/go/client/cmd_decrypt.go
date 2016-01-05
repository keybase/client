// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"fmt"
	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
)

type SaltPackUI struct {
	libkb.Contextified
	terminal    libkb.TerminalUI
	interactive bool
	force       bool
}

func (s *SaltPackUI) doNonInteractive(arg keybase1.SaltPackPromptForDecryptArg) error {
	switch arg.Sender.SenderType {
	case keybase1.SaltPackSenderType_TRACKING_BROKE:
		if s.force {
			s.G().Log.Warning("Tracking statement is broken for sender, but forcing through.")
			return nil
		}
		return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "tracking broke"}
	default:
		return nil
	}
}

func (s *SaltPackUI) doInteractive(arg keybase1.SaltPackPromptForDecryptArg) error {
	var why string
	def := libkb.PromptDefaultYes
	switch arg.Sender.SenderType {
	case keybase1.SaltPackSenderType_TRACKING_OK:
		return nil
	case keybase1.SaltPackSenderType_NOT_TRACKED:
		why = "The sender of this message is a Keybase user you don't track"
	case keybase1.SaltPackSenderType_UNKNOWN:
		why = "The sender of this message is unknown to Keybase"
	case keybase1.SaltPackSenderType_ANONYMOUS:
		why = "The sender of this message has choosen to remain anonymous"
	case keybase1.SaltPackSenderType_TRACKING_BROKE:
		why = "You track the sender of this message, but their tracking statement is broken"
		def = libkb.PromptDefaultNo
	}
	why += ". Go ahead and decrypt?"
	ok, err := s.terminal.PromptYesNo(PromptDescriptorDecryptInteractive, why, def)
	if err != nil {
		return err
	}
	if !ok {
		return libkb.CanceledError{M: "decryption canceled"}
	}

	return nil
}

func (s *SaltPackUI) SaltPackPromptForDecrypt(_ context.Context, arg keybase1.SaltPackPromptForDecryptArg) (err error) {
	if !s.interactive {
		return s.doNonInteractive(arg)
	}
	return s.doInteractive(arg)
}

type CmdDecrypt struct {
	libkb.Contextified
	filter     UnixFilter
	recipients []string
	spui       *SaltPackUI
	opts       keybase1.SaltPackDecryptOptions
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
		},
	}
}

func NewCmdDecryptRunner(g *libkb.GlobalContext) *CmdDecrypt {
	return &CmdDecrypt{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdDecrypt) explainDecryptionFailure(info *keybase1.SaltPackEncryptedMessageInfo) {
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
		prnt("Decryption failed; it was encrypted for %d hidden receivers, which may or may not you\n", info.NumAnonReceivers)
	} else {
		prnt("Decryption failed; message wasn't encrypted for any of your known keys\n")
	}
}

func (c *CmdDecrypt) Run() error {
	cli, err := GetSaltPackClient(c.G())
	if err != nil {
		return err
	}

	// Can't do this in ParseArgv, need to wait until later
	// in the initialization
	c.spui.terminal = c.G().UI.GetTerminalUI()

	protocols := []rpc.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(c.G()),
		NewIdentifyUIProtocol(c.G()),
		keybase1.SaltPackUiProtocol(c.spui),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	snk, src, err := c.filter.ClientFilterOpen()
	if err != nil {
		return err
	}

	var info keybase1.SaltPackEncryptedMessageInfo
	arg := keybase1.SaltPackDecryptArg{
		Source: src,
		Sink:   snk,
		Opts:   c.opts,
	}
	info, err = cli.SaltPackDecrypt(context.TODO(), arg)
	if _, ok := err.(libkb.NoDecryptionKeyError); ok {
		c.explainDecryptionFailure(&info)
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
	c.spui = &SaltPackUI{
		Contextified: libkb.NewContextified(c.G()),
		interactive:  interactive,
		force:        ctx.Bool("force"),
	}
	c.opts.Interactive = interactive
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	if err := c.filter.FilterInit(msg, infile, outfile); err != nil {
		return err
	}

	return nil
}
