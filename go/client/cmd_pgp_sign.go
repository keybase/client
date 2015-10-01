package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPSign(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "sign",
		Usage:        "PGP sign a document.",
		ArgumentHelp: "[filename]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPSign{}, "sign", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "Output binary message (default is armored).",
			},
			cli.BoolFlag{
				Name:  "t, text",
				Usage: "Treat input data as text and canonicalize.",
			},
			cli.BoolFlag{
				Name:  "d, detached",
				Usage: "Detached signature (default is attached).",
			},
			cli.BoolFlag{
				Name:  "c, clearsign",
				Usage: "Generate a clearsigned text signature.",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "Provide the message to sign on the command line.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (default is STDOUT).",
			},
			cli.StringFlag{
				Name:  "k, key",
				Usage: "Specify a key to use for signing (otherwise most recent PGP key is used).",
			},
		},
		Description: `Use the PGP secret key in your local Keybase keyring to PGP sign
   a file. If you have several keys, you can specify a particular signing key with
   the "--key" flag; otherwise, the most recent PGP key is used.

   Since this command uses only your Keybase keyring, it does not access the GnuPG
   keyring.`,
	}
}

type CmdPGPSign struct {
	UnixFilter
	msg  string
	opts keybase1.PGPSignOptions
	arg  engine.PGPSignArg
}

func (s *CmdPGPSign) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return fmt.Errorf("sign takes at most 1 arg, an infile")
	}

	s.opts.BinaryOut = ctx.Bool("binary")
	s.opts.BinaryIn = !ctx.Bool("text")

	msg := ctx.String("message")
	outfile := ctx.String("outfile")

	var infile string
	if nargs == 1 {
		infile = ctx.Args()[0]
	}

	clr := ctx.Bool("clearsign")
	dtch := ctx.Bool("detached")

	if clr && dtch {
		return fmt.Errorf("Can't specify both -c and -d")
	}

	if clr {
		s.opts.Mode = keybase1.SignMode_CLEAR
	} else if dtch {
		s.opts.Mode = keybase1.SignMode_DETACHED
	} else {
		s.opts.Mode = keybase1.SignMode_ATTACHED
	}

	s.opts.KeyQuery = ctx.String("key")

	return s.FilterInit(msg, infile, outfile)
}

func (s *CmdPGPSign) Run() (err error) {
	protocols := []rpc2.Protocol{
		NewStreamUIProtocol(),
		NewSecretUIProtocol(),
	}

	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	snk, src, err := s.ClientFilterOpen()
	if err == nil {
		arg := keybase1.PGPSignArg{Source: src, Sink: snk, Opts: s.opts}
		err = cli.PGPSign(arg)
	}
	cerr := s.Close(err)
	return libkb.PickFirstError(err, cerr)
}

func (s *CmdPGPSign) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
