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

type CmdTeamLeave struct {
	libkb.Contextified
	Team      string
	Permanent bool
}

func newCmdTeamLeave(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "leave",
		ArgumentHelp: "<team name> [--permanent]",
		Usage:        "Leave a team.",
		Action: func(c *cli.Context) {
			cmd := &CmdTeamLeave{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "leave", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, permanent",
				Usage: "Prevent being re-added to team",
			},
		},
	}
}

func NewCmdTeamLeaveRunner(g *libkb.GlobalContext) *CmdTeamLeave {
	return &CmdTeamLeave{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamLeave) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Permanent = ctx.Bool("permanent")
	return nil
}

func (c *CmdTeamLeave) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamLeaveArg{
		Name:      c.Team,
		Permanent: c.Permanent,
	}

	if err = cli.TeamLeave(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	if c.Permanent {
		dui.Printf("Success! You have left %s (and will never be added again).\n", c.Team)
	} else {
		dui.Printf("Success! You have left %s.\n", c.Team)
	}

	return nil
}

func (c *CmdTeamLeave) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
