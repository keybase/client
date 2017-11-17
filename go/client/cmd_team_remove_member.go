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
	Team string

	Username string
	Email    string
	InviteID keybase1.TeamInviteID
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
		Examples: `
Remove a user from the team:
    keybase team remove-member acme --user roadrunner
Cancel an email invite:
    keybase team remove-member acme --email roadrunner@acme.com
Cancel a secret token invite (like sms):
    keybase team list-members acme --show-invite-id # to get the invite ID
    keybase team remove-member acme --invite-id 9cfd13f927bcd1f6832fefa084bb2127
`,
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
				Usage: "cancel a pending invite by email address",
			},
			cli.StringFlag{
				Name:  "invite-id",
				Usage: "cancel a pending invite by ID",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "don't ask for confirmation",
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
	if ctx.IsSet("invite-id") {
		c.InviteID, err = keybase1.TeamInviteIDFromString(ctx.String("invite-id"))
		if err != nil {
			errStr := "Invite IDs are 32 characters and end in '27' (%v)."
			errStr = errStr + " Use `keybase team list-members %s --show-invite-id` to find one."
			return fmt.Errorf(errStr, err, c.Team)
		}
	}
	c.Force = ctx.Bool("force")

	var actions []string

	if len(c.Username) > 0 {
		if libkb.CheckEmail.F(c.Username) {
			return fmt.Errorf("Invalid username %q", c.Username)
		}
		actions = append(actions, "username")
	}
	if len(c.Email) > 0 {
		if !libkb.CheckEmail.F(c.Email) {
			return fmt.Errorf("Invalid email address %q", c.Email)
		}
		actions = append(actions, "email")
	}
	if len(c.InviteID) > 0 {
		actions = append(actions, "invite-id")
	}
	if len(actions) != 1 {
		return errors.New("Specify one of 'user', 'email', 'invite-id'")
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
		InviteID: c.InviteID,
	}

	if err = cli.TeamRemoveMember(context.Background(), arg); err != nil {
		switch err.(type) {
		case libkb.NotFoundError:
			if len(c.Email) > 0 {
				ui.Printf("Error: No pending invitation for %s.\nIf that person is already on your team, please remove them with their keybase username.\n\n", c.Email)
				return nil
			}
			if len(c.InviteID) > 0 {
				ui.Printf("Error: No pending invite with ID %v", c.InviteID)
				return nil
			}
			ui.Printf("Error: No user %s on team %s.\n\n", c.Username, c.Team)
			return nil
		}
		return err
	}

	if len(c.Email) > 0 {
		ui.Printf("Success! %s invitation canceled for team %s.\n", c.Email, c.Team)
		return nil
	}
	if len(c.InviteID) > 0 {
		ui.Printf("Success! Invitation canceled for team %s.\n", c.Team)
		return nil
	}
	ui.Printf("Success! %s removed from team %s.\n", c.Username, c.Team)
	return nil
}

func (c *CmdTeamRemoveMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
