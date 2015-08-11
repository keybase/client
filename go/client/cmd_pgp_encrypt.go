package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPEncrypt(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "encrypt",
		Usage:       "keybase pgp encrypt [-l] [-y] [--no-self] [-s] [-m MESSAGE] [-k KEY] [-b] [-o OUTPUT] [-i file] them",
		Description: "PGP encrypt messages or files for keybase users.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPEncrypt{}, "encrypt", c)
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
				Name:  "skip-track",
				Usage: "Don't track",
			},
			cli.BoolFlag{
				Name:  "no-self",
				Usage: "don't encrypt for self",
			},
			cli.BoolFlag{
				Name:  "s, sign",
				Usage: "sign in addition to encrypting",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "provide the message on the command line",
			},
			cli.StringFlag{
				Name:  "k, key",
				Usage: "specify a key to use (otherwise most recent PGP key is used)",
			},
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "output in binary (rather than ASCII/armored)",
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

type CmdPGPEncrypt struct {
	UnixFilter
	recipients   []string
	trackOptions keybase1.TrackOptions
	sign         bool
	noSelf       bool
	keyQuery     string
	binaryOut    bool
}

func (c *CmdPGPEncrypt) Run() error {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(),
		NewIdentifyUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	snk, src, err := c.ClientFilterOpen()
	if err != nil {
		return err
	}
	opts := keybase1.PGPEncryptOptions{
		Recipients:   c.recipients,
		NoSign:       !c.sign,
		NoSelf:       c.noSelf,
		BinaryOut:    c.binaryOut,
		KeyQuery:     c.keyQuery,
		TrackOptions: c.trackOptions,
	}
	arg := keybase1.PGPEncryptArg{Source: src, Sink: snk, Opts: opts}
	err = cli.PGPEncrypt(arg)

	cerr := c.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdPGPEncrypt) ParseArgv(ctx *cli.Context) error {
	c.noSelf = ctx.Bool("no-self")
	if c.noSelf && len(ctx.Args()) == 0 {
		return errors.New("encrypt needs at least one recipient, or --no-self=false")
	}
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, outfile); err != nil {
		return err
	}
	c.recipients = ctx.Args()
	c.trackOptions = keybase1.TrackOptions{
		LocalOnly:     ctx.Bool("local"),
		BypassConfirm: ctx.Bool("y"),
	}
	c.sign = ctx.Bool("sign")
	c.keyQuery = ctx.String("key")
	c.binaryOut = ctx.Bool("binary")
	return nil
}

func (c *CmdPGPEncrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
