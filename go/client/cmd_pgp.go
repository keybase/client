// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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
			NewCmdPGPUpdate(cl, g),
			NewCmdPGPSelect(cl, g),
			NewCmdPGPSign(cl, g),
			NewCmdPGPEncrypt(cl, g),
			NewCmdPGPDecrypt(cl, g),
			NewCmdPGPVerify(cl, g),
			NewCmdPGPExport(cl, g),
			NewCmdPGPImport(cl, g),
			NewCmdPGPDrop(cl, g),
			NewCmdPGPList(cl, g),
			NewCmdPGPPurge(cl, g),
		},
	}
}
