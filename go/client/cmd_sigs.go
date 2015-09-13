package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdSigs(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "sigs",
		ArgumentHelp: "[arguments...]",
		Usage:        "Manage signatures",
		Subcommands: []cli.Command{
			NewCmdSigsList(cl),
			NewCmdSigsRevoke(cl),
		},
	}
}
