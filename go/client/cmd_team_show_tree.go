// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamShowTree struct {
	TeamName  keybase1.TeamName
	SessionID int
	libkb.Contextified
}

func (v *CmdTeamShowTree) ParseArgv(ctx *cli.Context) (err error) {
	v.TeamName, err = ParseOneTeamNameK1(ctx)
	return err
}

func (v *CmdTeamShowTree) Run() (err error) {
	cli, err := GetTeamsClient(v.G())
	if err != nil {
		return err
	}

	// Get the tree from the root.
	treeRes, err := cli.TeamTree(context.TODO(), keybase1.TeamTreeArg{
		Name:      v.TeamName.RootAncestorName(),
		SessionID: v.SessionID,
	})
	if err != nil {
		return err
	}

	var report []string
	var hasStar bool
	for _, row := range treeRes.Entries {
		spaces := strings.Repeat("  ", row.Name.Depth()-1)
		var star string
		if !row.Admin {
			star = " *"
			hasStar = true
		}
		report = append(report, fmt.Sprintf("%s- %s%s", spaces, row.Name.String(), star))
	}
	if hasStar {
		report = append(report, "* Subteams of teams you are not an admin of may be hidden.")
	}
	fmt.Printf("%s\n", strings.Join(report, "\n"))
	return nil
}

func newCmdTeamShowTree(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "show-tree",
		ArgumentHelp: "<team name>",
		Usage:        "Show a team's subteams.",
		Flags:        []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdTeamShowTreeRunner(g), "teamshowtree", c)
		},
		Description: "Show all the subteams of a team.",
	}
}

func NewCmdTeamShowTreeRunner(g *libkb.GlobalContext) *CmdTeamShowTree {
	return &CmdTeamShowTree{Contextified: libkb.NewContextified(g)}
}

func (v *CmdTeamShowTree) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
