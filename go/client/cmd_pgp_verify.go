package client

import (
	"io/ioutil"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPVerify(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "verify",
		Usage:       "keybase pgp verify [-l] [-y] [-s] [-S <user assertion>] [-m MESSAGE] [-d <detached signature file>] [-i <infile>]",
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
			cli.StringFlag{
				Name:  "d, detached",
				Usage: "specify a detached signature file",
			},
			cli.StringFlag{
				Name:  "S, signed-by",
				Usage: "assert signed by the given user (can use user assertion format)",
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
	protocols := []rpc2.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(),
		NewIdentifyUIProtocol(),
		NewLogUIProtocol(),
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
