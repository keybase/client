// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamDebug struct {
	libkb.Contextified
	TeamID keybase1.TeamID
}

func newCmdTeamDebug(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "team-debug",
		ArgumentHelp: "<team id>",
		Usage:        "Show a team's state",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamDebugRunner(g)
			cl.ChooseCommand(cmd, "team-debug", c)
		},
		Flags: []cli.Flag{},
	}
}

func NewCmdTeamDebugRunner(g *libkb.GlobalContext) *CmdTeamDebug {
	return &CmdTeamDebug{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamDebug) ParseArgv(ctx *cli.Context) error {
	var err error
	c.TeamID, err = ParseOneTeamID(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamDebug) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	res, err := cli.TeamDebug(context.Background(), c.TeamID)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("%v", spew.Sdump(res.Chain))
	return nil
}

func (c *CmdTeamDebug) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
