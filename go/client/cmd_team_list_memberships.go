// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"encoding/json"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamListMemberships struct {
	libkb.Contextified
	team string
	json bool
}

func newCmdTeamListMemberships(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list-memberships",
		ArgumentHelp: "<team name>",
		Usage:        "list team memberships",
		Action: func(c *cli.Context) {
			cmd := &CmdTeamListMemberships{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "list-memberships", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output memberships as JSON",
			},
		},
	}
}

func (c *CmdTeamListMemberships) ParseArgv(ctx *cli.Context) error {
	var err error
	c.team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.json = ctx.Bool("json")
	return nil
}

func (c *CmdTeamListMemberships) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	members, err := cli.TeamGet(context.Background(), keybase1.TeamGetArg{Name: c.team})
	if err != nil {
		return err
	}

	return c.output(members)
}

func (c *CmdTeamListMemberships) output(members keybase1.TeamMembers) error {
	if c.json {
		return c.outputJSON(members)
	}

	return c.outputTerminal(members)
}

func (c *CmdTeamListMemberships) outputJSON(members keybase1.TeamMembers) error {
	b, err := json.MarshalIndent(members, "", "    ")
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

func (c *CmdTeamListMemberships) outputTerminal(members keybase1.TeamMembers) error {
	c.outputRole("owner", members.Owners)
	c.outputRole("admin", members.Admins)
	c.outputRole("writer", members.Writers)
	c.outputRole("reader", members.Readers)
	return nil
}

func (c *CmdTeamListMemberships) outputRole(role string, usernames []string) {
	dui := c.G().UI.GetDumbOutputUI()
	for _, name := range usernames {
		dui.Printf("%s\t%s\t%s\n", c.team, role, name)
	}
}

func (c *CmdTeamListMemberships) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
