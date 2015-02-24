package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdMykey(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "mykey",
		Usage:       "keybase mykey [subcommands...]",
		Description: "Manipulate your primary Keybase key",
		Subcommands: []cli.Command{
			NewCmdMykeyGen(cl),
			NewCmdMykeyDelete(cl),
			NewCmdMykeySelect(cl),
			NewCmdMykeyShow(cl),
		},
	}
}
