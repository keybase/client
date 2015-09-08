package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdSigs(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "sigs",
		Usage:       "keybase sigs [...]",
		Description: "Manage signatures.",
		Subcommands: []cli.Command{
			NewCmdSigsList(cl),
			NewCmdSigsRevoke(cl),
		},
	}
}
