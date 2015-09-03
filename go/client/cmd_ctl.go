package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdCtl(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "ctl",
		Usage:       "keybase ctl [...]",
		Description: "Control a background keybase service.",
		Subcommands: []cli.Command{
			NewCmdCtlStart(cl),
			NewCmdCtlStop(cl),
			NewCmdCtlReload(cl),
			NewCmdCtlRestart(cl),
			NewCmdCtlLogRotate(cl),
		},
	}
}
