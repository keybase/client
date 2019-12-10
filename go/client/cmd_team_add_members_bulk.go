// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamAddMembersBulk struct {
	libkb.Contextified
	arg  keybase1.TeamAddMembersMultiRoleArg
	Team string
}

func newCmdTeamAddMembersBulk(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:         "add-members-bulk",
		ArgumentHelp: "<team name>",
		Usage:        "Add users to a team in bulk.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamAddMembersBulkRunner(g)
			cl.ChooseCommand(cmd, "add-members-bulk", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "r, readers",
				Usage: "specify readers to add",
			},
			cli.StringFlag{
				Name:  "w, writers",
				Usage: "specify writers to add",
			},
			cli.StringFlag{
				Name:  "a, admins",
				Usage: "specify admins to add",
			},
			cli.StringFlag{
				Name:  "o, owners",
				Usage: "specify owners to add",
			},
			cli.BoolFlag{
				Name:  "s, skip-chat-message",
				Usage: "skip chat welcome message",
			},
		},
		Description: teamAddMembersBulkDoc,
	}

	// TODO HOTPOT-599 expose publicly
	if g.Env.GetRunMode() == libkb.DevelRunMode || libkb.IsKeybaseAdmin(g.GetMyUID()) {
		cmd.Flags = append(cmd.Flags, cli.StringFlag{
			Name:  "b, bots",
			Usage: "specify bots to add",
		})
	}
	return cmd
}

func NewCmdTeamAddMembersBulkRunner(g *libkb.GlobalContext) *CmdTeamAddMembersBulk {
	return &CmdTeamAddMembersBulk{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamAddMembersBulk) parseBulkList(v string, role keybase1.TeamRole) (n int, err error) {
	if len(v) == 0 {
		return 0, nil
	}
	parts := strings.Split(v, ",")
	for _, p := range parts {
		if len(p) == 0 {
			return 0, errors.New("cannot specify an empty user")
		}
		c.arg.Users = append(c.arg.Users, keybase1.UserRolePair{AssertionOrEmail: p, Role: role})
		n++
	}
	return n, nil

}

func (c *CmdTeamAddMembersBulk) ParseArgv(ctx *cli.Context) (err error) {
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	var tot int

	roles := []struct {
		s string
		t keybase1.TeamRole
	}{
		{"bots", keybase1.TeamRole_BOT},
		{"readers", keybase1.TeamRole_READER},
		{"writers", keybase1.TeamRole_WRITER},
		{"admins", keybase1.TeamRole_ADMIN},
		{"owners", keybase1.TeamRole_OWNER},
	}
	for _, r := range roles {
		n, err := c.parseBulkList(ctx.String(r.s), r.t)
		if err != nil {
			return err
		}
		tot += n
	}
	if tot == 0 {
		// TODO HOTPOT-599 add --bots
		return errors.New("Need at least one of --readers, --writers, --admins or --owners")
	}
	c.arg.SendChatNotification = !ctx.Bool("skip-chat-message")
	return nil
}

func (c *CmdTeamAddMembersBulk) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	teamID, err := cli.GetTeamID(context.Background(), c.Team)
	if err != nil {
		return err
	}
	c.arg.TeamID = teamID

	err = cli.TeamAddMembersMultiRole(context.Background(), c.arg)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdTeamAddMembersBulk) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

// TODO HOTPOT-599 add --bots here too
const teamAddMembersBulkDoc = `"keybase team add-members-bulk" allows you to add multiple users to a team, in bulk

EXAMPLES:

Add existing keybase users as writers:

    keybase team add-members-bulk acme --writers=alice,bob,charlie

Add users via social assertions:

    keybase team add-members-bulk acme --writers=alice+alice@github,bob@github,jerry@redder --readers=jon,bob32

Add users via email:

    keybase team add-members-bulk acme --readers='[max43@gmail.com]@email,[bill32@yahoo.com]@email' --writers='[lucy32@poems.com]@email'

You can specify one or more of --readers, --writers, --admins, --owners, to add multiple
roles at one go. For each of those lists, you can mix and match Keybase users, social
assertions, and email addresses. Email addresses cannot be combined with other assertions,
however.
`
