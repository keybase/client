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

type CmdTeamAddMember struct {
	libkb.Contextified
	Team                 string
	Email                string
	Username             string
	Role                 keybase1.TeamRole
	SkipChatNotification bool
}

func newCmdTeamAddMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "add-member",
		ArgumentHelp: "<team name> --user=<username> --role=<owner|admin|writer|reader>",
		Usage:        "add a user to a team",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamAddMemberRunner(g)
			cl.ChooseCommand(cmd, "add-member", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "u, user",
				Usage: "username",
			},
			cli.StringFlag{
				Name:  "e, email",
				Usage: "email address to invite",
			},
			cli.StringFlag{
				Name:  "r, role",
				Usage: "team role (owner, admin, writer, reader)",
			},
		},
	}
}

func NewCmdTeamAddMemberRunner(g *libkb.GlobalContext) *CmdTeamAddMember {
	return &CmdTeamAddMember{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamAddMember) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Email = ctx.String("email")
	if len(c.Email) > 0 {
		if !libkb.CheckEmail.F(c.Email) {
			return errors.New("invalid email address")
		}
		return nil
	}

	c.Username, c.Role, err = ParseUserAndRole(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamAddMember) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamAddMemberArg{
		Name:                 c.Team,
		Email:                c.Email,
		Username:             c.Username,
		Role:                 c.Role,
		SendChatNotification: !c.SkipChatNotification,
	}

	res, err := cli.TeamAddMember(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	if !res.Invited {
		// TeamAddMember resulted in the user added to the team
		if res.ChatSent {
			dui.Printf("Success! A keybase chat message has been sent to %s.\n", res.User.Username)
		} else {
			dui.Printf("Success! %s added to team.\n", res.User.Username)
		}
		return nil
	}

	// TeamAddMember resulted in the user invited to the team

	if c.Email != "" {
		// email invitation
		dui.Printf("Pending! Email sent to %s with signup instructions. When they join you will be notified.\n", c.Email)
		return nil
	}

	if res.User != nil {
		// user without keys or without puk
		dui.Printf("Pending! Keybase stored a team invitation for %s. When they open the Keybase app, their account will be upgraded and you will be notified.\n", res.User.Username)
	} else {
		// "sharing before signup" user
		dui.Printf("Pending! Keybase stored a team invitation for %s. When they join Keybase you will be notified.\n", c.Username)
	}

	return nil
}

func (c *CmdTeamAddMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
