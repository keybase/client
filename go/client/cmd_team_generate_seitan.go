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

type CmdTeamGenerateSeitan struct {
	libkb.Contextified
	Team     string
	Role     keybase1.TeamRole
	FullName string
	Number   string
}

func newCmdTeamGenerateSeitan(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "generate-invite-token",
		ArgumentHelp: "<team name>",
		Usage:        "Generate an invite token that you can send via SMS, iMessage, or similar.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamGenerateSeitanRunner(g)
			cl.ChooseCommand(cmd, "generate-invite-token", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "r, role",
				Usage: "team role (admin, writer, reader) [required]",
			},
			cli.StringFlag{
				Name:  "fullname",
				Usage: "invitee's name",
			},
			cli.StringFlag{
				Name:  "number",
				Usage: "invitee's phone number",
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
	if c.Role == keybase1.TeamRole_OWNER {
		return errors.New("invalid team role, please use admin, writer, or reader")
	}

	c.FullName = ctx.String("fullname")
	c.Number = ctx.String("number")

	return nil
}

func (c *CmdTeamGenerateSeitan) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	var labelSms keybase1.SeitanKeyLabelSms
	labelSms.F = c.FullName
	labelSms.N = c.Number

	arg := keybase1.TeamCreateSeitanTokenV2Arg{
		Name:  c.Team,
		Role:  c.Role,
		Label: keybase1.NewSeitanKeyLabelWithSms(labelSms),
	}

	res, err := cli.TeamCreateSeitanTokenV2(context.Background(), arg)
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

const teamGenerateSeitanDoc = `"keybase generate-invite-token" allows you to create a one-time use,
expiring, cryptographically secure token that someone can use to join
a team.

Optionally, full name and phone number can be provided (using
--fullname and --number flags) to label created token to make them
easier to distinguish. Label data is encrypted and visible only to
admins.
`
