// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdTeamCreate struct {
	teamName  string
	SessionID int
	libkb.Contextified
}

func (v *CmdTeamCreate) ParseArgv(ctx *cli.Context) error {
	var err error
	v.teamName, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (v *CmdTeamCreate) Run() (err error) {
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

	return cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{
		Name:      v.teamName,
		SessionID: v.SessionID,
	})
}

func newCmdTeamCreate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "create",
		ArgumentHelp: "teamname",
		Usage:        "Create a team or a subteam.",
		Flags:        []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTeamCreate{Contextified: libkb.NewContextified(g)}, "teamcreate", c)
		},
		Description: "Create a team or a subteam with specified name.",
	}
}

func (v *CmdTeamCreate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
