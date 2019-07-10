// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdPeopleSearch struct {
	libkb.Contextified
	query    string
	service  string
	contacts bool
}

func NewCmdPeopleSearch(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdPeopleSearch{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "people-search",
		// No usage field, command is hidden in `help`.
		ArgumentHelp: "<query> [--service=<service>] [--contacts]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "people-search", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name: "contacts",
			},
			cli.StringFlag{
				Name: "service",
			},
		},
	}
}

func (c *CmdPeopleSearch) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("<query> argument is missing")
	}
	c.query = ctx.Args().Get(0)
	c.service = ctx.String("service")
	c.contacts = ctx.Bool("contacts")
	return nil
}

func (c *CmdPeopleSearch) Run() error {
	cli, err := GetUserSearchClient(c.G())
	if err != nil {
		return err
	}
	ret, err := cli.UserSearch(context.Background(), keybase1.UserSearchArg{
		Query:                  c.query,
		Service:                c.service,
		IncludeContacts:        c.contacts,
		IncludeServicesSummary: true,
		MaxResults:             10,
	})
	if err != nil {
		return err
	}
	s, err := json.MarshalIndent(ret, "", "  ")
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("%s\n", s)
	return nil
}

func (c *CmdPeopleSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
