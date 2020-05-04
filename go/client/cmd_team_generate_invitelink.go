// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/kbtime"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamGenerateInvitelink struct {
	libkb.Contextified
	Team              string
	Role              keybase1.TeamRole
	Etime             *keybase1.UnixTime
	TeamInviteMaxUses keybase1.TeamInviteMaxUses
}

func newCmdTeamGenerateInvitelink(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "generate-invitelink",
		ArgumentHelp: "<team name>",
		Usage:        "Generate an invite link that you can send via iMessage or similar.",
		Unlisted:     true,
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamGenerateInvitelinkRunner(g)
			cl.ChooseCommand(cmd, "generate-invitelink", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "r, role",
				Usage: "team role (writer, reader) [required]",
			},
			cli.StringFlag{
				Name:  "d, duration",
				Usage: "time duration until this invite expires (1D, 3M, 5Y, etc.).",
			},
			cli.IntFlag{
				Name:  "max-uses",
				Usage: "number of uses this invite link is valid for (greater than 0); exclusive with infinite-uses",
			},
			cli.BoolFlag{
				Name:  "infinite-uses",
				Usage: "whether this invite link is valid for infinite uses; exclusive with max-uses",
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
	case keybase1.TeamRole_READER, keybase1.TeamRole_WRITER:
	default:
		return errors.New("invalid team role, please use writer, or reader")
	}

	if ctx.IsSet("duration") {
		durationStr := ctx.String("duration")
		then, err := kbtime.AddLongDuration(time.Now(), durationStr)
		if err != nil {
			return fmt.Errorf("failed to compute expiration date: %w", err)
		}
		t := keybase1.ToUnixTime(then)
		c.Etime = &t
	}

	if ctx.Bool("infinite-uses") && ctx.IsSet("max-uses") {
		return errors.New("can only specify one of max-uses and infinite-uses")
	}

	if ctx.Bool("infinite-uses") {
		c.TeamInviteMaxUses = keybase1.TeamMaxUsesInfinite
	} else if ctx.IsSet("max-uses") {
		c.TeamInviteMaxUses, err = keybase1.NewTeamInviteFiniteUses(ctx.Int("max-uses"))
		if err != nil {
			return err
		}
	} else {
		c.TeamInviteMaxUses, err = keybase1.NewTeamInviteFiniteUses(1)
		if err != nil {
			return err
		}
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
		Etime:    c.Etime,
		MaxUses:  c.TeamInviteMaxUses,
	}

	res, err := cli.TeamCreateSeitanInvitelink(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf(`Generated link: %s.
Users can join the team by visiting that link and following the instructions.
If they already have Keybase installed, they can run 'keybase team accept-invite --token %s'.
Or they can go to the teams tab in the app, press "Join a team", and enter the url there.
`, res.Url, res.Ikey)

	return nil
}

func (c *CmdTeamGenerateInvitelink) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const teamGenerateInvitelinkDoc = `
"keybase generate-invitelink" allows you to create a multi-use, possibly
expiring link that someone can use to join a team.

If neither max-uses nor infinite-uses is passed, defaults to one-time-use.
If duration is not passed, does not expire.`
