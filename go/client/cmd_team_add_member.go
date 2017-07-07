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

	if err = cli.TeamAddMember(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Success! A keybase chat message has been sent to %s.\n", c.Username)

	return nil
}

func (c *CmdTeamAddMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
