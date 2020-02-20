package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdWebOfTrust(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	// please keep sorted
	subcommands := []cli.Command{
		newCmdWotList(cl, g),
		newCmdWotVouch(cl, g),
	}
	return cli.Command{
		Name:         "wot",
		Usage:        "Web of Trust",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}
