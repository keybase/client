// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamEditMember struct {
	libkb.Contextified
	team     string
	username string
	role     keybase1.TeamRole
}

func newCmdTeamEditMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "edit-member",
		ArgumentHelp: "<team name> --user=<username> --role=<owner|admin|writer|reader>",
		Usage:        "change a user's role on a team",
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
				Usage: "team role (owner, admin, writer, reader)",
			},
		},
	}
}

func (c *CmdTeamEditMember) ParseArgv(ctx *cli.Context) error {
	var err error
	c.team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.username, c.role, err = ParseUserAndRole(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamEditMember) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamEditMemberArg{
		Name:     c.team,
		Username: c.username,
		Role:     c.role,
	}

	if err = cli.TeamEditMember(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Success! %s's role in %s is now %s.\n", c.username, c.team, c.role)

	return nil
}

func (c *CmdTeamEditMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
