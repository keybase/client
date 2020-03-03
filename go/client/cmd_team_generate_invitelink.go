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

type CmdTeamGenerateInvitelink struct {
	libkb.Contextified
	Team string
	Role keybase1.TeamRole
}

func newCmdTeamGenerateInvitelink(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "generate-invitelink",
		ArgumentHelp: "<team name>",
		Usage:        "Generate an invite link that you can send via SMS, iMessage, or similar.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamGenerateInvitelinkRunner(g)
			cl.ChooseCommand(cmd, "generate-invitelink", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "r, role",
				Usage: "team role (admin, writer, reader) [required]",
			},
		},
		Description: teamGenerateInvitelinkDoc,
	}
}

func NewCmdTeamGenerateInvitelinkRunner(g *libkb.GlobalContext) *CmdTeamGenerateInvitelink {
	return &CmdTeamGenerateInvitelink{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamGenerateInvitelink) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Role, err = ParseRole(ctx)
	if err != nil {
		return err
	}
	switch c.Role {
	case keybase1.TeamRole_READER, keybase1.TeamRole_WRITER, keybase1.TeamRole_ADMIN:
	default:
		return errors.New("invalid team role, please use admin, writer, or reader")
	}

	return nil
}

func (c *CmdTeamGenerateInvitelink) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamCreateSeitanInvitelinkArg{
		Teamname: c.Team,
		Role:     c.Role,
	}

	res, err := cli.TeamCreateSeitanInvitelink(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf(`Generated link: %q.
Users can join the team by visiting that link.
If they already have Keybase installed, they can run 'keybase team accept-invite --token %s'.
Or they can go to the teams tab in the app, press "Join a team", and enter the link there.
`, res, res)

	return nil
}

func (c *CmdTeamGenerateInvitelink) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const teamGenerateInvitelinkDoc = `"keybase generate-invitelink" allows you to create a multi-use,
expiring, cryptographically secure link and token that someone can use to join a team.`
