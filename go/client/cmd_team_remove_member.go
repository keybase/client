// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamRemoveMember struct {
	libkb.Contextified
	Team     string
	Username string
	Email    string
	Force    bool
}

func NewCmdTeamRemoveMemberRunner(g *libkb.GlobalContext) *CmdTeamRemoveMember {
	return &CmdTeamRemoveMember{Contextified: libkb.NewContextified(g)}
}

func newCmdTeamRemoveMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "remove-member",
		ArgumentHelp: "<team name> --user=<username>",
		Usage:        "Remove a user from a team.",
		Action: func(c *cli.Context) {
			cmd := &CmdTeamRemoveMember{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "remove-member", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "u, user",
				Usage: "username",
			},
			cli.StringFlag{
				Name:  "email",
				Usage: "cancel pending email invite address",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "bypass warnings",
			},
		},
	}
}

func (c *CmdTeamRemoveMember) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Username = ctx.String("user")
	c.Email = ctx.String("email")
	c.Force = ctx.Bool("force")

	if len(c.Username) > 0 && len(c.Email) > 0 {
		return errors.New("You cannot specify --user and --email.  Please choose one.")
	}

	if len(c.Username) == 0 && len(c.Email) == 0 {
		return errors.New("Username or email required.  Use --user or --email flag.")
	}

	if len(c.Username) > 0 {
		if libkb.CheckEmail.F(c.Username) {
			return errors.New("If you'd like to cancel a pending invite by email address, please use `--email` instead of `--user`. If you'd like to remove an existing member from your team, please use their keybase username.")
		}
	}

	if len(c.Email) > 0 {
		if !libkb.CheckEmail.F(c.Email) {
			return fmt.Errorf("Invalid email address %q. If you'd like to remove an existing member for your team, please use their keybase username and the `--user` flag instead of `--email`.", c.Email)
		}
	}

	return nil
}

func (c *CmdTeamRemoveMember) Run() error {
	ui := c.G().UI.GetTerminalUI()

	if !c.Force {
		configCLI, err := GetConfigClient(c.G())
		if err != nil {
			return err
		}
		curStatus, err := configCLI.GetCurrentStatus(context.TODO(), 0)
		if err != nil {
			return err
		}

		var prompt string
		if curStatus.User != nil && libkb.NewNormalizedUsername(c.Username).Eq(libkb.NewNormalizedUsername(curStatus.User.Username)) {
			prompt = fmt.Sprintf("Are you sure you want to remove yourself from team %s?", c.Team)
		} else {
			prompt = fmt.Sprint("Are you sure?")
		}
		proceed, err := ui.PromptYesNo(PromptDescriptorRemoveMember, prompt, libkb.PromptDefaultNo)
		if err != nil {
			return err
		}
		if !proceed {
			return nil
		}
	}

	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamRemoveMemberArg{
		Name:     c.Team,
		Username: c.Username,
		Email:    c.Email,
	}

	if err = cli.TeamRemoveMember(context.Background(), arg); err != nil {
		switch err.(type) {
		case libkb.NotFoundError:
			if len(c.Email) > 0 {
				ui.Printf("Error: there is currently no pending invitation for %s.\nIf that person is already on your team, please remove them with their keybase username.\n\n", c.Email)
				return nil
			}
			ui.Printf("Error: there is currently no user %s on team %s.\n\n", c.Username, c.Team)
			return nil
		}
		return err
	}

	if len(c.Email) > 0 {
		ui.Printf("Success! %s invitation canceled for team %s.\n", c.Email, c.Team)
	} else {
		ui.Printf("Success! %s removed from team %s.\n", c.Username, c.Team)
	}

	return nil
}

func (c *CmdTeamRemoveMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
