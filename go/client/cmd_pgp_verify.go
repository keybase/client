package client

import (
	"io/ioutil"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewCmdPGPVerify(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "verify",
		Usage: "PGP verify message or file signatures for keybase users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPVerify{}, "verify", c)
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
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message on the command line.",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "d, detached",
				Usage: "Specify a detached signature file.",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "Assert signed by the given user (can use user assertion format).",
			},
		},
	}
}

type CmdPGPVerify struct {
	UnixFilter
	trackOptions     keybase1.TrackOptions
	detachedFilename string
	detachedData     []byte
	signedBy         string
}

func (c *CmdPGPVerify) Run() error {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(),
		NewIdentifyTrackUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	_, src, err := c.ClientFilterOpen()
	if err != nil {
		return err
	}
	arg := keybase1.PGPVerifyArg{
		Source: src,
		Opts: keybase1.PGPVerifyOptions{
			TrackOptions: c.trackOptions,
			Signature:    c.detachedData,
			SignedBy:     c.signedBy,
		},
	}
	_, err = cli.PGPVerify(arg)

	cerr := c.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (c *CmdPGPVerify) ParseArgv(ctx *cli.Context) error {
	msg := ctx.String("message")
	infile := ctx.String("infile")
	if err := c.FilterInit(msg, infile, "/dev/null"); err != nil {
		return err
	}
	c.trackOptions = keybase1.TrackOptions{
		LocalOnly:     ctx.Bool("local"),
		BypassConfirm: ctx.Bool("y"),
	}
	c.signedBy = ctx.String("signed-by")
	c.detachedFilename = ctx.String("detached")

	if len(c.detachedFilename) > 0 {
		data, err := ioutil.ReadFile(c.detachedFilename)
		if err != nil {
			return err
		}
		c.detachedData = data
	}

	return nil
}

func (c *CmdPGPVerify) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
