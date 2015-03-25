package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPVerify(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "verify",
		Usage:       "keybase pgp verify [-l] [-y] [-s] [-m MESSAGE] [-i file]",
		Description: "PGP verify message or file signatures for keybase users.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPVerify{}, "verify", c)
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
				Name:  "m, message",
				Usage: "provide the message on the command line",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "specify an input file",
			},
		},
	}
}

type CmdPGPVerify struct {
	UnixFilter
	localOnly     bool
	approveRemote bool
}

func (c *CmdPGPVerify) Run() error {
	if err := c.FilterOpen(); err != nil {
		return err
	}
	arg := &engine.PGPDecryptArg{
		Source:       c.source,
		Sink:         c.sink,
		AssertSigned: true,
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

func (c *CmdPGPVerify) RunClient() error {
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
		AssertSigned:  true,
		LocalOnly:     c.localOnly,
		ApproveRemote: c.approveRemote,
	}
	arg := keybase_1.PgpDecryptArg{Source: src, Sink: snk, Opts: opts}
	err = cli.PgpDecrypt(arg)

	c.Close(err)
	return err
}

func (c *CmdPGPVerify) ParseArgv(ctx *cli.Context) error {
	msg := ctx.String("message")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, "/dev/null"); err != nil {
		return err
	}
	c.localOnly = ctx.Bool("local")
	c.approveRemote = ctx.Bool("y")
	return nil
}

func (c *CmdPGPVerify) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
