// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdGit(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdGitCreate(cl, g),
		newCmdGitDelete(cl, g),
		newCmdGitList(cl, g),
		newCmdGitGC(cl, g),
		newCmdGitSettings(cl, g),
	}

	if develUsage {
		subcommands = append(subcommands, []cli.Command{
			NewCmdGitMdput(cl, g),
			NewCmdGitMddel(cl, g),
			NewCmdGitMdget(cl, g),
		}...)
	}

	return cli.Command{
		Name:         "git",
		Usage:        "Manage git repos",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}
