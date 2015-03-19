package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdPGPDecrypt(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "decrypt",
		Usage:       "keybase pgp decrypt [-l] [-y] [-s] [-m MESSAGE] [-o OUTPUT] [-i file]",
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
}

func (c *CmdPGPDecrypt) Run() error {
	return nil
}

func (c *CmdPGPDecrypt) RunClient() error {
	return nil
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
	return nil
}

func (c *CmdPGPDecrypt) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
