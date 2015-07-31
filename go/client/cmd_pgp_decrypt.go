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
		Name:        "decrypt",
		Usage:       "keybase pgp decrypt [-l] [-y] [-s] [-S <user assertion] [-m MESSAGE] [-o OUTPUT] [-i file]",
		Description: "PGP decrypt messages or files for keybase users.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPDecrypt{}, "decrypt", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "l, local",
				Usage: "only track locally, no statement sent to remote server",
			},
			cli.BoolFlag{
				Name:  "y",
				Usage: "approve remote tracking without prompting",
			},
			cli.BoolFlag{
				Name:  "s, signed",
				Usage: "assert signed",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "assert signed by the given user (can use user assertion format)",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "provide the message on the command line",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "specify an input file",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "specify an outfile (stdout by default)",
			},
		},
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
		NewIdentifyUIProtocol(),
		NewLogUIProtocol(),
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

	c.Close(err)

	return err
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
