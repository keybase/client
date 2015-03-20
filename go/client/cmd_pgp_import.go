package main

import (
	"fmt"

	"github.com/codegangsta/cli"
	// "github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	// "os"
)

func NewCmdPGPImport(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "export",
		Usage:       "keybase pgp export [-o <file>] [-q <query>] [-s]",
		Description: "export a PGP key from keybase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPExport{}, "export", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "specify an infile (stdin by default)",
			},
			cli.BoolFlag{
				Name:  "push-secret",
				Usage: "push an encrypted copy of the secret key to the server",
			},
		},
	}
}

type CmdPGPImport struct {
	UnixFilter
	arg    keybase_1.PgpImportArg
	infile string
}

func (s *CmdPGPImport) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.arg.PushPrivate = ctx.Bool("push-secret")
	s.infile = ctx.String("infile")

	if nargs > 0 {
		err = fmt.Errorf("import doesn't take args")
	}

	return err
}

func (s *CmdPGPImport) RunClient() (err error) {
	// var cli keybase_1.PgpClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}

	if _, err = GetPGPClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
	}
	return err
}

func (s *CmdPGPImport) Run() (err error) {
	return err
}

func (v *CmdPGPImport) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
