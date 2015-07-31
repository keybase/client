package client

import (
	"fmt"

	"io/ioutil"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPImport(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "import",
		Usage:       "keybase pgp import [-o <file>] [-q <query>] [-s]",
		Description: "import a PGP key into keybase (and sign into key ring)",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPImport{}, "import", c)
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
	arg    keybase1.PGPImportArg
	infile string
}

func (s *CmdPGPImport) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.arg.PushSecret = ctx.Bool("push-secret")
	s.infile = ctx.String("infile")

	if nargs > 0 {
		err = fmt.Errorf("import doesn't take args")
	}

	return err
}

func (s *CmdPGPImport) Run() error {
	if err := s.readKeyData(); err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}

	cli, err := GetPGPClient()
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}
	return cli.PGPImport(s.arg)
}

func (s *CmdPGPImport) readKeyData() error {
	src, err := initSource("", s.infile)
	if err != nil {
		return err
	}
	if err = src.Open(); err != nil {
		return err
	}
	defer src.Close()
	s.arg.Key, err = ioutil.ReadAll(src)
	return err
}

func (s *CmdPGPImport) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
