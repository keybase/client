// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdPGP(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "pgp",
		Usage:        "Manage keybase PGP keys",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdPGPGen(cl, g),
			NewCmdPGPPull(cl, g),
			NewCmdPGPUpdate(cl),
			NewCmdPGPSelect(cl),
			NewCmdPGPSign(cl, g),
			NewCmdPGPEncrypt(cl, g),
			NewCmdPGPDecrypt(cl, g),
			NewCmdPGPVerify(cl, g),
			NewCmdPGPExport(cl),
			NewCmdPGPImport(cl),
			NewCmdPGPDrop(cl),
			NewCmdPGPList(cl, g),
		},
	}
}
