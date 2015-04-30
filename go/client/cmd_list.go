package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "list",
		Usage:       "keybase list [subcommands...]",
		Description: "List trackers, tracking",
		Subcommands: []cli.Command{
			NewCmdListTrackers(cl),
			NewCmdListTracking(cl),
		},
	}
}
