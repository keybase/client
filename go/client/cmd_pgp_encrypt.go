package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
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

type CmdPGPEncrypt struct{}

func (c *CmdPGPEncrypt) Run() error {
	return nil
}

func (c *CmdPGPEncrypt) RunClient() error {
	return nil
}

func (c *CmdPGPEncrypt) ParseArgv(ctx *cli.Context) error {
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
