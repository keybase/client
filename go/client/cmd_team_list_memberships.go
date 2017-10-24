// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamListMemberships struct {
	libkb.Contextified
	team                 string
	json                 bool
	forcePoll            bool
	userAssertion        string
	includeImplicitTeams bool
	showAll              bool
	verbose              bool
	tabw                 *tabwriter.Writer
}

func (c *CmdTeamListMemberships) SetTeam(s string) {
	c.team = s
}

func (c *CmdTeamListMemberships) SetJSON(b bool) {
	c.json = b
}

func (c *CmdTeamListMemberships) SetForcePoll(b bool) {
	c.forcePoll = b
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
		cli.BoolFlag{
			Name:  "force-poll",
			Usage: "Force a poll of the server for all identities",
		},
		cli.StringFlag{
			Name:  "u, user",
			Usage: "List memberships for a user assertion",
		},
		cli.BoolFlag{
			Name:  "include-subteams",
			Usage: "Include any subteam memberships as well",
		},
		cli.BoolFlag{
			Name:  "all",
			Usage: "Show all members of all teams you belong to",
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
	c.showAll = ctx.Bool("all")

	if c.showAll {
		if c.team != "" {
			return errors.New("cannot specify a team and --all, please choose one")
		}
		if c.userAssertion != "" {
			return errors.New("cannot specify a user and --all, please choose one")
		}
	}

	c.json = ctx.Bool("json")
	c.forcePoll = ctx.Bool("force-poll")
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
	details, err := cli.TeamGet(context.Background(), keybase1.TeamGetArg{Name: c.team, ForceRepoll: c.forcePoll})
	if err != nil {
		return err
	}

	return c.output(details)
}

func (c *CmdTeamListMemberships) runUser(cli keybase1.TeamsClient) error {
	arg := keybase1.TeamListArg{
		UserAssertion:        c.userAssertion,
		All:                  c.showAll,
		IncludeImplicitTeams: c.includeImplicitTeams,
	}
	list, err := cli.TeamList(context.Background(), arg)
	if err != nil {
		return err
	}

	sort.Slice(list.Teams, func(i, j int) bool {
		if list.Teams[i].FqName == list.Teams[j].FqName {
			return list.Teams[i].Username < list.Teams[j].Username
		}
		return list.Teams[i].FqName < list.Teams[j].FqName
	})

	if c.json {
		b, err := json.MarshalIndent(list, "", "    ")
		if err != nil {
			return err
		}
		dui := c.G().UI.GetDumbOutputUI()
		_, err = dui.Printf(string(b) + "\n")
		return err
	}

	dui := c.G().UI.GetTerminalUI()
	c.tabw = new(tabwriter.Writer)
	c.tabw.Init(dui.OutputWriter(), 0, 8, 4, ' ', 0)

	// Only print the username and full name columns when we're showing other users.
	if c.showAll {
		fmt.Fprintf(c.tabw, "Team\tRole\tUsername\tFull name\n")
	} else {
		fmt.Fprintf(c.tabw, "Team\tRole\tMembers\n")
	}
	for _, t := range list.Teams {
		var role string
		if t.Implicit != nil {
			role += "implied admin"
		}
		if t.Role != keybase1.TeamRole_NONE {
			if t.Implicit != nil {
				role += ", "
			}
			role += strings.ToLower(t.Role.String())
		}
		if c.showAll {
			fmt.Fprintf(c.tabw, "%s\t%s\t%s\t%s\n", t.FqName, role, t.Username, t.FullName)
		} else {
			fmt.Fprintf(c.tabw, "%s\t%s\t%d\n", t.FqName, role, t.MemberCount)
		}
	}
	if c.showAll {
		c.outputInvites(list.AnnotatedActiveInvites)
	}

	c.tabw.Flush()

	return nil
}

func (c *CmdTeamListMemberships) output(details keybase1.TeamDetails) error {
	if c.json {
		return c.outputJSON(details)
	}

	return c.outputTerminal(details)
}

func (c *CmdTeamListMemberships) outputJSON(details keybase1.TeamDetails) error {
	b, err := json.MarshalIndent(details, "", "    ")
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

func (c *CmdTeamListMemberships) outputTerminal(details keybase1.TeamDetails) error {
	dui := c.G().UI.GetTerminalUI()
	c.tabw = new(tabwriter.Writer)
	c.tabw.Init(dui.OutputWriter(), 0, 8, 2, ' ', 0)

	c.outputRole("owner", details.Members.Owners)
	c.outputRole("admin", details.Members.Admins)
	c.outputRole("writer", details.Members.Writers)
	c.outputRole("reader", details.Members.Readers)
	c.outputInvites(details.AnnotatedActiveInvites)
	c.tabw.Flush()

	if c.verbose {
		dui.Printf("At team key generation: %d\n", details.KeyGeneration)
	}

	return nil
}

func (c *CmdTeamListMemberships) outputRole(role string, members []keybase1.TeamMemberDetails) {
	for _, member := range members {
		var reset string
		if !member.Active {
			reset = " (inactive due to account reset)"
		}
		fmt.Fprintf(c.tabw, "%s\t%s\t%s%s\n", c.team, role, member.Username, reset)
	}
}

func (c *CmdTeamListMemberships) formatInviteName(invite keybase1.AnnotatedTeamInvite) (res string) {
	res = string(invite.Name)
	category, err := invite.Type.C()
	if err == nil {
		switch category {
		case keybase1.TeamInviteCategory_SBS:
			res = fmt.Sprintf("%s@%s", invite.Name, string(invite.Type.Sbs()))
		case keybase1.TeamInviteCategory_SEITAN:
			res = "<secret invite token>"
		}
	}
	return res
}

func (c *CmdTeamListMemberships) outputInvites(invites map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite) {
	for _, invite := range invites {
		fmtstring := "%s\t%s*\t%s\t(* added by %s; awaiting acceptance)\n"
		fmt.Fprintf(c.tabw, fmtstring, invite.TeamName, strings.ToLower(invite.Role.String()),
			c.formatInviteName(invite), invite.InviterUsername)
	}
}

func (c *CmdTeamListMemberships) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
