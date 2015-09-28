package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPDecrypt(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "decrypt",
		Usage: "PGP decrypt messages or files for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPDecrypt{}, "decrypt", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "l, local",
				Usage: "Only track locally, don't send a statement to the server.",
			},
			cli.BoolFlag{
				Name:  "y",
				Usage: "Approve remote tracking without prompting.",
			},
			cli.BoolFlag{
				Name:  "s, signed",
				Usage: "Assert signed.",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "Assert signed by the given user (can use user assertion format).",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message on the command line.",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (stdout by default).",
			},
		},
		Description : `Use of this command requires at least one PGP secret key imported
   into the PGP keyring. It will try all secret keys in the local keyring that match the
   given ciphertext, an will succeeed so long as one such key is available.`,
	}
}

type CmdPGPDecrypt struct {
	UnixFilter
	trackOptions keybase1.TrackOptions
	signed       bool
	signedBy     string
}

func (c *CmdPGPDecrypt) Run() error {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(),
		NewIdentifyTrackUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	snk, src, err := c.ClientFilterOpen()
	if err != nil {
		return err
	}
	opts := keybase1.PGPDecryptOptions{
		AssertSigned: c.signed,
		SignedBy:     c.signedBy,
		TrackOptions: c.trackOptions,
	}
	arg := keybase1.PGPDecryptArg{Source: src, Sink: snk, Opts: opts}
	_, err = cli.PGPDecrypt(arg)

	cerr := c.Close(err)

	return libkb.PickFirstError(err, cerr)
}

func (c *CmdPGPDecrypt) ParseArgv(ctx *cli.Context) error {
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, outfile); err != nil {
		return err
	}
	c.trackOptions = keybase1.TrackOptions{
		LocalOnly:     ctx.Bool("local"),
		BypassConfirm: ctx.Bool("y"),
	}
	c.signed = ctx.Bool("signed")
	c.signedBy = ctx.String("signed-by")
	return nil
}

func (c *CmdPGPDecrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
