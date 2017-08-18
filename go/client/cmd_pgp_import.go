// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"io/ioutil"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdPGPImport(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "import",
		Usage: "Import a PGP key into keybase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPImport{Contextified: libkb.NewContextified(g)}, "import", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an infile (stdin by default).",
			},
			cli.BoolFlag{
				Name:  "push-secret",
				Usage: "Push an encrypted copy of the secret key to the server.",
			},
		},
		Description: `"keybase pgp import" imports a PGP secret key for use with Keybase.
   It accepts that secret key via file (with the "--infile" flag) or
   otherwise via standard input. The secret key is used to sign the
   public PGP key into the user's Keybase sigchain. The secret key
   is also imported into the local Keybase keyring and encrypted with
   the local key security protocol.

   If (and only if) the "--push-secret" flag is specified, this command
   pushes the PGP secret key to the Keybase server, encrypted with the
   user's passphrase. The server, in this case, could theoretically
   recover the PGP secret key by cracking the user's passphrase.`,
	}
}

type CmdPGPImport struct {
	UnixFilter
	arg    keybase1.PGPImportArg
	infile string
	libkb.Contextified
}

func (s *CmdPGPImport) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return fmt.Errorf("Invalid arguments")
	}

	s.arg.PushSecret = ctx.Bool("push-secret")
	s.infile = ctx.String("infile")
	return nil
}

func (s *CmdPGPImport) Run() error {
	if err := s.readKeyData(); err != nil {
		return err
	}

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
	return cli.PGPImport(context.TODO(), s.arg)
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
