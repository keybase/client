package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
	"io"
)

func NewCmdSign(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "sign",
		Usage:       "keybase sign [-a] [-o <outfile>] [<infile>]",
		Description: "sign a clear document",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSign{}, "sign", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "output binary message (armored by default",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "provide the message to sign on the command line",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "specify an outfile (stdout by default",
			},
		},
	}
}

type CmdSign struct {
	UnixFilter
	binary bool
	msg    string
}

func (s *CmdSign) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.binary = ctx.Bool("binary")
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	var infile string

	if nargs == 1 {
		infile = ctx.Args()[0]
	} else if nargs > 1 {
		err = fmt.Errorf("sign takes at most 1 arg, an infile")
	}

	if err != nil {
		err = s.FilterInit(msg, infile, outfile)
	}

	return err
}

func (s *CmdSign) Run() (err error) {
	var key *libkb.PgpKeyBundle
	var dumpTo io.WriteCloser
	var written int64

	if err = s.FilterOpen(); err != nil {
		return
	}

	defer func() {
		if dumpTo != nil {
			dumpTo.Close()
		}
		s.Close(err)
	}()

	key, err = G.Keyrings.GetSecretKey("command-line signature")
	if err != nil {
		return
	} else if key == nil {
		err = fmt.Errorf("No secret key available")
		return
	}

	dumpTo, err = libkb.AttachedSignWrapper(s.sink, *key, !s.binary)
	if err != nil {
		return
	}

	written, err = io.Copy(dumpTo, s.source)
	if err == nil && written == 0 {
		err = fmt.Errorf("Empty source file, nothing to sign")
	}

	return
}

func (v *CmdSign) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		Terminal:  true,
		KbKeyring: true,
	}
}
