// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"sort"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdLog(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		NewCmdLogSend(cl, g),
		NewCmdLogProfile(cl, g),
	}
	subcommands = append(subcommands, getBuildSpecificLogCommands(cl, g)...)
	sort.Sort(cli.ByName(subcommands))
	return cli.Command{
		Name:         "log",
		Usage:        "Manage keybase logs",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}
