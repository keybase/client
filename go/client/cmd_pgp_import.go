package client

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"io/ioutil"
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
	arg    keybase_1.PgpImportArg
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

func (s *CmdPGPImport) RunClient() (err error) {
	var cli keybase_1.PgpClient

	if err = s.readKeyData(); err != nil {
		return
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}

	if cli, err = GetPGPClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		err = cli.PgpImport(s.arg)
	}
	return err
}

func (s *CmdPGPImport) Run() (err error) {
	ctx := engine.Context{
		SecretUI: G_UI.GetSecretUI(),
		LogUI:    G_UI.GetLogUI(),
	}
	if err = s.readKeyData(); err != nil {
		return
	}
	var eng *engine.PGPKeyImportEngine
	if eng, err = engine.NewPGPKeyImportEngineFromBytes(s.arg.Key, s.arg.PushSecret, nil); err != nil {
		return
	}
	return engine.RunEngine(eng, &ctx)
}

func (s *CmdPGPImport) readKeyData() (err error) {
	var src Source
	if src, err = initSource("", s.infile); err != nil {
	} else if err = src.Open(); err != nil {
	} else {
		s.arg.Key, err = ioutil.ReadAll(src)
	}
	src.Close()
	return
}

func (v *CmdPGPImport) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
