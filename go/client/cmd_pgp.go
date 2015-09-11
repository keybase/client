package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdPGP(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "pgp",
		Usage:        "Manage keybase PGP keys",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdPGPGen(cl),
			NewCmdPGPPull(cl),
			NewCmdPGPUpdate(cl),
			NewCmdPGPSelect(cl),
			NewCmdPGPSign(cl),
			NewCmdPGPEncrypt(cl),
			NewCmdPGPDecrypt(cl),
			NewCmdPGPVerify(cl),
			NewCmdPGPExport(cl),
			NewCmdPGPImport(cl),
		},
	}
}
