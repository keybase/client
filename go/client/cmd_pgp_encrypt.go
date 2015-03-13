package main

import (
	"errors"
	"io"
	"os"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPEncrypt(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "encrypt",
		Usage:       "keybase pgp encrypt [-r] [-l] [--no-self] [--batch] [--prompt-remote] [-s] [-m MESSAGE] [-k KEY] [-b] [-o OUTPUT] [-i file] them",
		Description: "PGP encrypt messages or files for keybase users.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPEncrypt{}, "encrypt", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, track-remote",
				Usage: "remotely track by default",
			},
			cli.BoolFlag{
				Name:  "l, track-local",
				Usage: "don't prompt for remote tracking",
			},
			cli.BoolFlag{
				Name:  "no-self",
				Usage: "don't encrypt for self",
			},
			cli.BoolFlag{
				Name:  "batch",
				Usage: "batch-mode without interactivity",
			},
			cli.BoolFlag{
				Name:  "prompt-remote",
				Usage: "prompt for remote tracking",
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
	recipients []string
}

func (c *CmdPGPEncrypt) Run() error {
	if err := c.FilterOpen(); err != nil {
		return err
	}

	arg := &engine.PGPTrackEncryptArg{
		Recips: c.recipients,
		Source: c.source,
		Sink:   c.sink,
	}
	ctx := &engine.Context{
		IdentifyUI: G.UI.GetIdentifyLubaUI(),
		TrackUI:    G.UI.GetIdentifyTrackUI(true), // XXX strict => true?
		SecretUI:   G.UI.GetSecretUI(),
	}
	eng := engine.NewPGPTrackEncrypt(arg)
	err := engine.RunEngine(eng, ctx, nil, nil)

	c.Close(err)
	return err
}

func (c *CmdPGPEncrypt) RunClient() error {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewStreamUiProtocol(),
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
	opts := keybase_1.PgpEncryptOptions{
		Recipients: c.recipients,
	}
	arg := keybase_1.PgpEncryptArg{Source: src, Sink: snk, Opts: opts}
	err = cli.PgpEncrypt(arg)

	c.Close(err)
	return err
}

func (c *CmdPGPEncrypt) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return errors.New("encrypt needs at least one recipient")
	}
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, outfile); err != nil {
		return err
	}
	c.recipients = ctx.Args()
	return nil
}

func (c *CmdPGPEncrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		Terminal:  true,
		KbKeyring: true,
	}
}

func (c *CmdPGPEncrypt) reader() io.Reader {
	// if there's a message arg, use that

	// if there's an infile, open it and use it

	// else, use stdin

	return os.Stdin
}

func (c *CmdPGPEncrypt) writer() io.Writer {
	// if there's an outfile, use that

	// otherwise use stdout

	// if armored, add an armor wrapper around it

	return nil
}
