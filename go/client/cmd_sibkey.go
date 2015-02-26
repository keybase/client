package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdSibkey(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "sibkey",
		Usage:       "keybase sibkey [subcommands...]",
		Description: "Manipulate your sibkeys",
		Subcommands: []cli.Command{
			NewCmdSibkeyAdd(cl),
		},
	}
}
