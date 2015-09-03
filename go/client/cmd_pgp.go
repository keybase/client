package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdPGP(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "pgp",
		Usage:       "keybase pgp [...]",
		Description: "Manage keybase PGP keys.",
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
