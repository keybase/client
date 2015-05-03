package client

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdCtl(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "ctl",
		Usage:       "keybase ctl [subcommands...]",
		Description: "Control a background keybase service",
		Subcommands: []cli.Command{
			NewCmdCtlLogRotate(cl),
			NewCmdCtlRestart(cl),
			NewCmdCtlStart(cl),
			NewCmdCtlStop(cl),
		},
	}
}
