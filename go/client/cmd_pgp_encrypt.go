package main

import (
	"errors"

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
	recipients    []string
	localOnly     bool
	approveRemote bool
	sign          bool
	noSelf        bool
	keyQuery      string
	binaryOut     bool
}

func (c *CmdPGPEncrypt) Run() error {
	if err := c.FilterOpen(); err != nil {
		return err
	}

	arg := &engine.PGPEncryptArg{
		Recips:       c.recipients,
		Source:       c.source,
		Sink:         c.sink,
		NoSign:       !c.sign,
		NoSelf:       c.noSelf,
		BinaryOutput: c.binaryOut,
		KeyQuery:     c.keyQuery,
		TrackOptions: engine.TrackOptions{
			TrackLocalOnly: c.localOnly,
			TrackApprove:   c.approveRemote,
		},
	}
	ctx := &engine.Context{
		IdentifyUI: G.UI.GetIdentifyTrackUI(true),
		SecretUI:   G.UI.GetSecretUI(),
	}
	eng := engine.NewPGPEncrypt(arg)
	err := engine.RunEngine(eng, ctx)

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
		NoSign:     !c.sign,
		NoSelf:     c.noSelf,
		BinaryOut:  c.binaryOut,
		KeyQuery:   c.keyQuery,
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
	c.localOnly = ctx.Bool("local")
	c.approveRemote = ctx.Bool("y")
	c.sign = ctx.Bool("sign")
	c.noSelf = ctx.Bool("no-self")
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
