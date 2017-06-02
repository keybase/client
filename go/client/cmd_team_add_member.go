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

type CmdTeamAddMember struct {
	libkb.Contextified
	team     string
	username string
	role     keybase1.TeamRole
}

func newCmdTeamAddMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "add-member",
		ArgumentHelp: "<team name> --user=<username> --role=<owner|admin|writer|reader>",
		Usage:        "add a user to a team",
		Action: func(c *cli.Context) {
			cmd := &CmdTeamAddMember{Contextified: libkb.NewContextified(g)}
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

func (c *CmdTeamAddMember) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return errors.New("add-member requires team name argument")
	}
	if len(ctx.Args()) > 1 {
		return errors.New("add-member requires one team name argument, multiple found")
	}
	c.team = ctx.Args()[0]
	if len(ctx.String("email")) > 0 {
		return errors.New("add-member via email address not yet supported")
	}

	c.username = ctx.String("user")
	if len(c.username) == 0 {
		return errors.New("username required via --user flag")
	}
	srole := ctx.String("role")
	if srole == "" {
		return errors.New("team role required via --role flag")
	}

	role, ok := keybase1.TeamRoleMap[strings.ToUpper(srole)]
	if !ok {
		return errors.New("invalid team role, please use owner, admin, writer, or reader")
	}
	c.role = role

	return nil
}

func (c *CmdTeamAddMember) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamAddMemberArg{
		Name:                 c.team,
		Username:             c.username,
		Role:                 c.role,
		SendChatNotification: true,
	}

	if err = cli.TeamAddMember(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Success! A keybase chat message has been sent to %s.\n", c.username)

	return nil
}

func (c *CmdTeamAddMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
