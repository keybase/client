// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdTeam(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "team",
		Usage:        "Manage teams.",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			newCmdTeamCreate(cl, g),
			newCmdTeamListMemberships(cl, g),
			newCmdTeamAddMember(cl, g),
			newCmdTeamRemoveMember(cl, g),
			newCmdTeamEditMember(cl, g),
			newCmdTeamLeave(cl, g),
		},
	}
}
