// Copyright 2018 Keybase, Inc. All rights reserved. Use of
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

type CmdListEmails struct {
	libkb.Contextified
	json bool
}

func NewCmdListEmails(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdListEmails{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "list",
		Usage: "List emails attached to your account",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "list", c)
		},
	}
}

func (c *CmdListEmails) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("invalid number of arguments.")
	}
	c.json = ctx.Bool("json")
	return nil
}

func (c *CmdListEmails) Run() error {
	cli, err := GetEmailsClient(c.G())
	if err != nil {
		return err
	}
	resp, err := cli.GetEmails(context.Background(), 0)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	if c.json {
		b, err := json.Marshal(resp)
		if err != nil {
			return err
		}
		ui.Printf("%s\n", string(b))
		return nil
	}

	for _, p := range resp {
		visibilityName := keybase1.IdentityVisibilityRevMap[p.Visibility]
		ui.Printf("%s (visibility: %s, verified: %t, primary: %t)\n", p.Email,
			visibilityName, p.IsVerified, p.IsPrimary)
	}

	if len(resp) == 0 {
		c.G().UI.GetDumbOutputUI().PrintfStderr(
			"You have no email addresses set. You should add one using `keybase email add` command.\n")
	}
	return nil
}

func (c *CmdListEmails) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
