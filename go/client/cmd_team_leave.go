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
	team      string
	permanent bool
}

func newCmdTeamLeave(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "leave",
		ArgumentHelp: "<team name> [--permanent=<true, false>]",
		Usage:        "leave a team",
		Action: func(c *cli.Context) {
			cmd := &CmdTeamLeave{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "leave", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, permanent",
				Usage: "Prevent being readded to team (true, false)",
			},
		},
	}
}

func (c *CmdTeamLeave) ParseArgv(ctx *cli.Context) error {
	var err error
	c.team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.permanent, err := ParsePermanent(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamLeave) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamLeaveArg{
		Name:      c.team,
		Permanent: c.permanent,
	}

	if err = cli.TeamLeave(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	if c.permanent {
		dui.Printf("Success! You have left %s permanently.", c.team)
	} else {
		dui.Printf("Success! You have left %s non-permanently.", c.team)
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
