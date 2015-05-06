package client

import (
	"fmt"

	"os"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdPGPExport(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "export",
		Usage:       "keybase pgp export [-o <file>] [-q <query>] [-s]",
		Description: "export a PGP key from keybase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPExport{}, "export", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "specify an outfile (stdout by default)",
			},
			cli.BoolFlag{
				Name:  "s, secret",
				Usage: "export secret key",
			},
			cli.StringFlag{
				Name:  "q, query",
				Usage: "only export keys matching that query",
			},
		},
	}
}

type CmdPGPExport struct {
	UnixFilter
	arg     keybase1.PgpExportArg
	outfile string
}

func (s *CmdPGPExport) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.arg.Secret = ctx.Bool("secret")
	s.arg.Query = ctx.String("query")
	s.outfile = ctx.String("outfile")

	if nargs > 0 {
		err = fmt.Errorf("export doesn't take args")
	}

	return err
}

func (s *CmdPGPExport) RunClient() (err error) {
	var cli keybase1.PgpClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}

	if cli, err = GetPGPClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		err = s.finish(cli.PgpExport(s.arg))
	}
	return err
}

func (s *CmdPGPExport) finish(res []keybase1.FingerprintAndKey, err error) error {
	if err != nil {
		return err
	}
	if len(res) > 1 {
		G.Log.Warning("Found several matches:")
		for _, k := range res {
			os.Stderr.Write([]byte(k.Desc + "\n\n"))
		}
		err = fmt.Errorf("Specify a key to export")
	} else if len(res) == 0 {
		err = fmt.Errorf("No matching keys found")
	} else {
		snk := initSink(s.outfile)
		if err = snk.Open(); err == nil {
			snk.Write([]byte(res[0].Key))
			err = snk.Close()
		}
	}
	return err
}

func (s *CmdPGPExport) Run() (err error) {
	ctx := engine.Context{
		SecretUI: G_UI.GetSecretUI(),
		LogUI:    G_UI.GetLogUI(),
	}
	eng := engine.NewPGPKeyExportEngine(s.arg, G)
	err = engine.RunEngine(eng, &ctx)
	err = s.finish(eng.Results(), err)
	return err
}

func (s *CmdPGPExport) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
