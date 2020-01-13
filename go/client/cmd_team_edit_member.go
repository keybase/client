// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamEditMember struct {
	libkb.Contextified
	Team        string
	Username    string
	Role        keybase1.TeamRole
	BotSettings *keybase1.TeamBotSettings
}

func newCmdTeamEditMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:         "edit-member",
		ArgumentHelp: "<team name> --user=<username> --role=<owner|admin|writer|reader|bot|restrictedbot>",
		Usage:        "Change a user's role on a team.",
		Action: func(c *cli.Context) {
			cmd := &CmdTeamEditMember{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "edit-member", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "u, user",
				Usage: "username",
			},
			cli.StringFlag{
				Name:  "r, role",
				Usage: "team role (owner, admin, writer, reader, bot, restrictedbot)",
			},
		},
	}

	cmd.Flags = append(cmd.Flags, botSettingsFlags...)
	return cmd
}

func NewCmdTeamEditMemberRunner(g *libkb.GlobalContext) *CmdTeamEditMember {
	return &CmdTeamEditMember{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamEditMember) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Username, c.Role, err = ParseUserAndRole(ctx)
	if err != nil {
		return err
	}

	if c.Role.IsRestrictedBot() {
		c.BotSettings = ParseBotSettings(ctx)
	}

	return nil
}

func (c *CmdTeamEditMember) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	if err := ValidateBotSettingsConvs(c.G(), c.Team,
		chat1.ConversationMembersType_TEAM, c.BotSettings); err != nil {
		return err
	}

	arg := keybase1.TeamEditMemberArg{
		Name:        c.Team,
		Username:    c.Username,
		Role:        c.Role,
		BotSettings: c.BotSettings,
	}

	if err = cli.TeamEditMember(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Success! %s's role in %s is now %s.\n", c.Username, c.Team, c.Role)

	return nil
}

func (c *CmdTeamEditMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
