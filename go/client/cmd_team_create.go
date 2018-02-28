// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamCreate struct {
	TeamName  keybase1.TeamName
	SessionID int
	libkb.Contextified
	JoinSubteam bool
}

func (v *CmdTeamCreate) ParseArgv(ctx *cli.Context) error {
	var err error
	v.TeamName, err = ParseOneTeamNameK1(ctx)
	if err != nil {
		return err
	}

	v.JoinSubteam = ctx.Bool("join-subteam")

	return nil
}

func (v *CmdTeamCreate) Run() (err error) {
	cli, err := GetTeamsClient(v.G())
	if err != nil {
		return err
	}

	dui := v.G().UI.GetDumbOutputUI()

	createRes, err := cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{
		Name:        v.TeamName.String(),
		SessionID:   v.SessionID,
		JoinSubteam: v.JoinSubteam,
	})
	if err != nil {
		return err
	}
	dui.Printf("Success!\n")
	if !createRes.CreatorAdded {
		dui.Printf("\nNOTE: you can administer %s, but you won't see its files or chats\n", v.TeamName)
		dui.Printf("unless you add yourself explicitly with `keybase team add-member`.\n\n")
	}

	return nil
}

func newCmdTeamCreate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "create",
		ArgumentHelp: "<team name>",
		Usage:        "Create a team or a subteam.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdTeamCreateRunner(g), "create", c)
		},
		Description: "Create a team or a subteam with specified name.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, join-subteam",
				Usage: "join subteam after creating it (off by default)",
			},
		},
	}
}

func NewCmdTeamCreateRunner(g *libkb.GlobalContext) *CmdTeamCreate {
	return &CmdTeamCreate{Contextified: libkb.NewContextified(g)}
}

func (v *CmdTeamCreate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
