// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdTeamCreate struct {
	TeamName  keybase1.TeamName
	Subteam   bool
	SessionID int
	libkb.Contextified
}

func (v *CmdTeamCreate) ParseArgv(ctx *cli.Context) error {
	var err error
	v.TeamName, err = ParseOneTeamNameK1(ctx)
	if err != nil {
		return err
	}

	v.Subteam = ctx.Bool("subteam")

	return nil
}

func (v *CmdTeamCreate) Run() (err error) {
	if v.TeamName.IsRootTeam() && v.Subteam {
		return fmt.Errorf("Leave off --subteam when creating a root team")
	}

	if !v.TeamName.IsRootTeam() && !v.Subteam {
		return fmt.Errorf("Use --subteam to create a subteam. Team names with dots are subteams.")
	}

	cli, err := GetTeamsClient(v.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(v.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	if v.TeamName.IsRootTeam() {
		return cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{
			Name:      v.TeamName,
			SessionID: v.SessionID,
		})
	}
	return cli.TeamCreateSubteam(context.TODO(), keybase1.TeamCreateSubteamArg{
		Name:      v.TeamName,
		SessionID: v.SessionID,
	})
}

func newCmdTeamCreate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "create",
		ArgumentHelp: "teamname",
		Usage:        "Create a team or a subteam.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "subteam",
				Usage: "Create a subteam",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdTeamCreateRunner(g), "teamcreate", c)
		},
		Description: "Create a team or a subteam with specified name.",
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
