// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamRemoveMember struct {
	libkb.Contextified
	team     string
	username string
	role     keybase1.TeamRole
}

func newCmdTeamRemoveMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "remove-member",
		ArgumentHelp: "<team name> --user=<username>",
		Usage:        "remove a user from a team",
		Action: func(c *cli.Context) {
			cmd := &CmdTeamRemoveMember{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "remove-member", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "u, user",
				Usage: "username",
			},
		},
	}
}

func (c *CmdTeamRemoveMember) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return errors.New("remove-member requires team name argument")
	}
	if len(ctx.Args()) > 1 {
		return errors.New("remove-member requires one team name argument, multiple found")
	}
	c.team = ctx.Args()[0]
	c.username = ctx.String("user")
	if len(c.username) == 0 {
		return errors.New("username required via --user flag")
	}

	return nil
}

func (c *CmdTeamRemoveMember) Run() error {
	ui := c.G().UI.GetTerminalUI()
	prompt := fmt.Sprintf("Are you sure you want to remove %s from team %s?", c.username, c.team)
	proceed, err := ui.PromptYesNo(PromptDescriptorRemoveMember, prompt, libkb.PromptDefaultNo)
	if err != nil {
		return err
	}
	if !proceed {
		return nil
	}

	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	req := keybase1.TeamChangeReq{
		None: []string{c.username},
	}
	arg := keybase1.TeamChangeMembershipArg{
		Name: c.team,
		Req:  req,
	}

	if err = cli.TeamChangeMembership(context.Background(), arg); err != nil {
		return err
	}

	ui.Printf("Success! %s removed from team %s.", c.username, c.team)

	return nil
}

func (c *CmdTeamRemoveMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
