// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"sort"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdTeam(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdTeamCreate(cl, g),
		newCmdTeamAddMember(cl, g),
		newCmdTeamAddMembersBulk(cl, g),
		newCmdTeamRemoveMember(cl, g),
		newCmdTeamEditMember(cl, g),
		newCmdTeamListMemberships(cl, g),
		newCmdTeamShowTree(cl, g),
		newCmdTeamRename(cl, g),
		newCmdTeamRequestAccess(cl, g),
		newCmdTeamListRequests(cl, g),
		newCmdTeamIgnoreRequest(cl, g),
		newCmdTeamAcceptInvite(cl, g),
		newCmdTeamLeave(cl, g),
		newCmdTeamDelete(cl, g),
		newCmdTeamAPI(cl, g),
		newCmdTeamSettings(cl, g),
		newCmdTeamProfileLoad(cl, g),
		newCmdTeamFTL(cl, g),
		newCmdTeamBotSettings(cl, g),
		newCmdTeamSearch(cl, g),
		newCmdTeamGenerateSeitan(cl, g),
		newCmdTeamGenerateInvitelink(cl, g),
	}
	subcommands = append(subcommands, getBuildSpecificTeamCommands(cl, g)...)
	sort.Sort(cli.ByName(subcommands))
	return cli.Command{
		Name:         "team",
		Usage:        "Manage teams",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}
