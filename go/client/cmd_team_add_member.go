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
	// TODO HOTPOT-227 expose in CLI flags
	BotSettings *keybase1.TeamBotSettings
}

func newCmdTeamAddMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "add-member",
		ArgumentHelp: "<team name>",
		Usage:        "Add a user to a team.",
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
				Usage: "team role (owner, admin, writer, reader) [required]",
			},
			cli.BoolFlag{
				Name:  "s, skip-chat-message",
				Usage: "skip chat welcome message",
			},
		},
		Description: teamAddMemberDoc,
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

	c.Role, err = ParseRole(ctx)
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

	c.Username, err = ParseUser(ctx)
	if err != nil {
		return err
	}

	c.SkipChatNotification = ctx.Bool("skip-chat-message")

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
		BotSettings:          c.BotSettings,
		SendChatNotification: !c.SkipChatNotification,
	}

	res, err := cli.TeamAddMember(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	if !res.Invited {
		// TeamAddMember resulted in the user added to the team
		if res.ChatSending {
			// The chat message may still be in flight or fail.
			dui.Printf("Success! A keybase chat message has been sent to %s. To skip this, use `-s` or `--skip-chat-message`\n", res.User.Username)
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

const teamAddMemberDoc = `"keybase team add-member" allows you to add users to a team.

EXAMPLES:

Add an existing keybase user:

    keybase team add-member acme --user=alice --role=writer

Add a user via social assertion:

    keybase team add-member acme --user=alice@twitter --role=writer

Add a user via email:

    keybase team add-member acme --email=alice@mail.com --role=reader
`
