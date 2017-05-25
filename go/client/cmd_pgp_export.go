// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdPGPExport(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "export",
		Usage: "Export a PGP key from keybase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPExport{Contextified: libkb.NewContextified(g)}, "export", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an outfile (stdout by default).",
			},
			cli.BoolFlag{
				Name:  "s, secret",
				Usage: "Export secret key.",
			},
			cli.StringFlag{
				Name:  "q, query",
				Usage: "Only export keys matching that query.",
			},
		},
		Description: `"keybase pgp export" exports public (and optionally private) PGP keys
   from Keybase, and into a file or to standard output. It doesn't access
   the GnuPG keychain at all.`,
	}
}

type CmdPGPExport struct {
	UnixFilter
	arg     keybase1.PGPExportArg
	outfile string
	libkb.Contextified
}

func (s *CmdPGPExport) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.arg.Options.Secret = ctx.Bool("secret")
	s.arg.Options.Query = ctx.String("query")
	s.outfile = ctx.String("outfile")

	if nargs > 0 {
		err = fmt.Errorf("export doesn't take args")
	}

	return err
}

func (s *CmdPGPExport) Run() (err error) {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(s.G()),
	}

	cli, err := GetPGPClient(s.G())
	if err != nil {
		return err
	}
	if err = RegisterProtocolsWithContext(protocols, s.G()); err != nil {
		return err
	}
	return s.finish(cli.PGPExport(context.TODO(), s.arg))
}

func (s *CmdPGPExport) finish(res []keybase1.KeyInfo, inErr error) error {
	if inErr != nil {
		return inErr
	}
	if len(res) > 1 {
		s.G().Log.Warning("Found several matches:")
		for _, k := range res {
			// XXX os.Stderr?  why not Log?
			os.Stderr.Write([]byte(k.Desc + "\n\n"))
		}
		return fmt.Errorf("Specify a key to export")
	}
	if len(res) == 0 {
		return fmt.Errorf("No matching keys found")
	}

	snk := initSink(s.outfile)
	if err := snk.Open(); err != nil {
		return err
	}
	snk.Write([]byte(strings.TrimSpace(res[0].Key) + "\n"))
	return snk.Close()
}

func (s *CmdPGPExport) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
