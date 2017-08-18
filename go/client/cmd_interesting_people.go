// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdInterestingPeople struct {
	libkb.Contextified
	maxUsers int
}

func (c *CmdInterestingPeople) ParseArgv(ctx *cli.Context) error {
	c.maxUsers = ctx.Int("maxusers")
	return nil
}

func (c *CmdInterestingPeople) Run() error {

	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}

	users, err := cli.InterestingPeople(context.Background(), c.maxUsers)
	if err != nil {
		return err
	}

	for _, user := range users {
		c.G().UI.GetTerminalUI().Output(user.Username + "\n")
	}
	return nil
}
func NewCmdInterestingPeopleRunner(g *libkb.GlobalContext) *CmdInterestingPeople {
	return &CmdInterestingPeople{Contextified: libkb.NewContextified(g)}
}

func NewCmdInterestingPeople(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ret := cli.Command{
		Name:        "interesting-people",
		Description: "List interesting people that you might want to interact with",
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "maxusers",
				Usage: "Max users to return",
				Value: 20,
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdInterestingPeopleRunner(g), "interesting-people", c)
		},
	}
	return ret
}

func (c *CmdInterestingPeople) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
