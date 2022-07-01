// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamListMemberships struct {
	libkb.Contextified
	team                 string
	json                 bool
	userAssertion        string
	includeImplicitTeams bool
	showAll              bool
	verbose              bool
	showInviteID         bool
	verified             bool
}

func (c *CmdTeamListMemberships) SetTeam(s string) {
	c.team = s
}

func (c *CmdTeamListMemberships) SetJSON(b bool) {
	c.json = b
}

func NewCmdTeamListMembershipsRunner(g *libkb.GlobalContext) *CmdTeamListMemberships {
	return &CmdTeamListMemberships{Contextified: libkb.NewContextified(g)}
}

func newCmdTeamListMemberships(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.BoolFlag{
			Name:  "j, json",
			Usage: "Output memberships as JSON",
		},
		cli.StringFlag{
			Name:  "u, user",
			Usage: "List memberships for a user assertion",
		},
		cli.BoolFlag{
			Name:  "all",
			Usage: "Show all members of all teams you belong to",
		},
		cli.BoolFlag{
			Name:  "show-invite-id",
			Usage: "Show invite IDs",
		},
		cli.BoolFlag{
			Name:  "v, verbose",
			Usage: "Include more verbose output",
		},
	}
	if develUsage {
		flags = append(flags, cli.BoolFlag{
			Name:  "include-implicit-teams",
			Usage: "[devel only] Include automatic teams that are not normally visible",
		}, cli.BoolFlag{
			Name:  "verified",
			Usage: "[devel only] Verify results by loading every team",
		})
	}
	return cli.Command{
		Name:         "list-memberships",
		ArgumentHelp: "[team name] [--user=username]",
		Aliases:      []string{"list-members"},
		Usage:        "List your teams, or people on a team.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamListMembershipsRunner(g)
			cl.ChooseCommand(cmd, "list-memberships", c)
		},
		Flags: flags,
	}
}

func (c *CmdTeamListMemberships) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return errors.New("at most one team name argument allowed, multiple found")
	}
	if len(ctx.Args()) > 0 {
		c.team = ctx.Args()[0]
	}
	c.userAssertion = ctx.String("user")
	c.includeImplicitTeams = ctx.Bool("include-implicit-teams")
	c.verified = ctx.Bool("verified")
	c.showAll = ctx.Bool("all")
	c.showInviteID = ctx.Bool("show-invite-id")

	if c.showAll {
		if c.team != "" {
			return errors.New("cannot specify a team and --all, please choose one")
		}
		if c.userAssertion != "" {
			return errors.New("cannot specify a user and --all, please choose one")
		}
	}

	c.json = ctx.Bool("json")
	c.verbose = ctx.Bool("verbose")

	return nil
}

func (c *CmdTeamListMemberships) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	if c.team != "" {
		return c.runGet(cli)
	}

	return c.runUser(cli)
}

func (c *CmdTeamListMemberships) runGet(cli keybase1.TeamsClient) error {
	res, err := cli.GetAnnotatedTeamByName(context.Background(), c.team)
	if err != nil {
		return err
	}

	renderer := newTeamMembersRenderer(c.G(), c.json, c.showInviteID)
	return renderer.output(res, c.team, c.verbose)
}

func (c *CmdTeamListMemberships) runUser(cli keybase1.TeamsClient) error {
	var err error
	var list keybase1.AnnotatedTeamList
	if c.showAll {
		arg := keybase1.TeamListTeammatesArg{
			IncludeImplicitTeams: c.includeImplicitTeams,
		}
		list, err = cli.TeamListTeammates(context.Background(), arg)
	} else if c.verified {
		arg := keybase1.TeamListVerifiedArg{
			UserAssertion:        c.userAssertion,
			IncludeImplicitTeams: c.includeImplicitTeams,
		}
		list, err = cli.TeamListVerified(context.Background(), arg)
	} else {
		arg := keybase1.TeamListUnverifiedArg{
			UserAssertion:        c.userAssertion,
			IncludeImplicitTeams: c.includeImplicitTeams,
		}
		list, err = cli.TeamListUnverified(context.Background(), arg)
	}

	if err != nil {
		return err
	}

	renderer := newTeamMembersRenderer(c.G(), c.json, c.showInviteID)
	return renderer.outputTeams(list, c.showAll)
}

func (c *CmdTeamListMemberships) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
