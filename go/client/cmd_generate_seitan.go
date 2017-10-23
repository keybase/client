// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	//"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdGenerateSeitan struct {
	libkb.Contextified
	Team string
	Role keybase1.TeamRole
}

func newCmdGenerateSeitan(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "generate-seitan",
		ArgumentHelp: "<team name>",
		Usage:        "Generate no-server-trust \"Seitan\" token.",
		Action: func(c *cli.Context) {
			cmd := NewCmdGenerateSeitanRunner(g)
			cl.ChooseCommand(cmd, "generate-seitan", c)
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

func NewCmdGenerateSeitanRunner(g *libkb.GlobalContext) *CmdGenerateSeitan {
	return &CmdGenerateSeitan{Contextified: libkb.NewContextified(g)}
}

func (c *CmdGenerateSeitan) ParseArgv(ctx *cli.Context) error {
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

func (c *CmdGenerateSeitan) Run() error {
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
	dui.Printf("Generated token: %s\n", res)

	return nil
}

func (c *CmdGenerateSeitan) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const teamGenerateSeitanDoc = `"keybase team generate-seitan" allows you to create a one-time use,
expiring, cryptographically secure token that someone can use to join
a team. Seitan because it's not TOFU.`
