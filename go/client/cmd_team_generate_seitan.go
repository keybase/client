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

type CmdTeamGenerateSeitan struct {
	libkb.Contextified
	Team string
	Role keybase1.TeamRole
}

func newCmdTeamGenerateSeitan(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "generate-invite-token",
		ArgumentHelp: "<team name>",
		Usage:        "Generate an invite token that you can send via SMS, iMessage, or other similar mechanism.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamGenerateSeitanRunner(g)
			cl.ChooseCommand(cmd, "generate-invite-token", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "r, role",
				Usage: "team role (owner, admin, writer, reader) [required]",
			},
		},
		Description: teamGenerateSeitanDoc,
	}
}

func NewCmdTeamGenerateSeitanRunner(g *libkb.GlobalContext) *CmdTeamGenerateSeitan {
	return &CmdTeamGenerateSeitan{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamGenerateSeitan) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Role, err = ParseRole(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamGenerateSeitan) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamCreateSeitanTokenArg{
		Name: c.Team,
		Role: c.Role,
	}

	res, err := cli.TeamCreateSeitanToken(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Generated token: %q.\nAnother Keybase user can join the team using the following command:\n\nkeybase team accept-invite --token %s\n", res, res)

	return nil
}

func (c *CmdTeamGenerateSeitan) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const teamGenerateSeitanDoc = `"keybase team generate-token" allows you to create a one-time use,
expiring, cryptographically secure token that someone can use to join
a team.`
