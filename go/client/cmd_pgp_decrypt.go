package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
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
			cli.StringFlag{
				Name:  "s, signed",
				Usage: "assert signed",
			},
			cli.BoolFlag{
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
	localOnly     bool
	approveRemote bool
	signed        bool
	signedBy      string
}

func (c *CmdPGPDecrypt) Run() error {
	if err := c.FilterOpen(); err != nil {
		return err
	}
	arg := &engine.PGPDecryptArg{
		Source:       c.source,
		Sink:         c.sink,
		AssertSigned: c.signed,
		SignedBy:     c.signedBy,
		TrackOptions: engine.TrackOptions{
			TrackLocalOnly: c.localOnly,
			TrackApprove:   c.approveRemote,
		},
	}
	ctx := &engine.Context{
		SecretUI:   G.UI.GetSecretUI(),
		IdentifyUI: G.UI.GetIdentifyTrackUI(true),
		LogUI:      G.UI.GetLogUI(),
	}
	eng := engine.NewPGPDecrypt(arg)
	err := engine.RunEngine(eng, ctx)

	c.Close(err)
	return err
}

func (c *CmdPGPDecrypt) RunClient() error {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewStreamUiProtocol(),
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
	opts := keybase_1.PgpDecryptOptions{
		AssertSigned:  c.signed,
		SignedBy:      c.signedBy,
		LocalOnly:     c.localOnly,
		ApproveRemote: c.approveRemote,
	}
	arg := keybase_1.PgpDecryptArg{Source: src, Sink: snk, Opts: opts}
	_, err = cli.PgpDecrypt(arg)

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
	c.localOnly = ctx.Bool("local")
	c.approveRemote = ctx.Bool("y")
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
