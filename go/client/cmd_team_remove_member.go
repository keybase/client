// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamRemoveMember struct {
	libkb.Contextified
	Team string

	Assertion         string
	Email             string
	Phone             string
	RemoveFromSubtree bool

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
				Usage: "keybase username or social assertion (e.g., foo@twitter)",
			},
			cli.StringFlag{
				Name:  "e, email",
				Usage: "cancel a pending invite by email address",
			},
			cli.StringFlag{
				Name:  "p, phone",
				Usage: "cancel a pending invite by phone number",
			},
			cli.StringFlag{
				Name:  "invite-id",
				Usage: "cancel a pending invite by ID",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "don't ask for confirmation",
			},
			cli.BoolFlag{
				Name:  "r, recursive",
				Usage: "recursively remove member from subtree as well; cannot be used with --invite-id",
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

	c.Assertion = ctx.String("user")
	c.Email = ctx.String("email")
	c.Phone = ctx.String("phone")
	if ctx.IsSet("invite-id") {
		c.InviteID, err = keybase1.TeamInviteIDFromString(ctx.String("invite-id"))
		if err != nil {
			errStr := "Invite IDs are 32 characters and end in '27' (%v)."
			errStr += " Use `keybase team list-members %s --show-invite-id` to find one."
			return fmt.Errorf(errStr, err, c.Team)
		}
	}
	c.Force = ctx.Bool("force")
	c.RemoveFromSubtree = ctx.Bool("recursive")

	var actions []string
	if len(c.Assertion) > 0 {
		actions = append(actions, "username")
	}
	if len(c.Email) > 0 {
		if !libkb.CheckEmail.F(c.Email) {
			return fmt.Errorf("Invalid email address %q", c.Email)
		}
		actions = append(actions, "email")
	}
	if len(c.Phone) > 0 {
		actions = append(actions, "phone")
	}
	if len(c.InviteID) > 0 {
		if c.RemoveFromSubtree {
			return fmt.Errorf("cannot pass --recursive for removal by an invite id")
		}
		actions = append(actions, "invite-id")
	}
	if len(actions) != 1 {
		return errors.New("Specify one of 'user', 'email', 'phone', 'invite-id'")
	}

	return nil
}

func (c *CmdTeamRemoveMember) Run() error {
	ctx := context.TODO()
	ui := c.G().UI.GetTerminalUI()

	if !c.Force {
		configCLI, err := GetConfigClient(c.G())
		if err != nil {
			return err
		}
		curStatus, err := configCLI.GetCurrentStatus(ctx, 0)
		if err != nil {
			return err
		}

		var prompt string
		if curStatus.User != nil && libkb.NewNormalizedUsername(c.Assertion).Eq(libkb.NewNormalizedUsername(curStatus.User.Username)) {
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

	teamID, err := cli.GetTeamID(ctx, c.Team)
	if err != nil {
		return err
	}

	var member keybase1.TeamMemberToRemove
	switch {
	case c.Assertion != "":
		member = keybase1.NewTeamMemberToRemoveWithAssertion(keybase1.AssertionTeamMemberToRemove{
			Assertion:         c.Assertion,
			RemoveFromSubtree: c.RemoveFromSubtree,
		})
	case c.Email != "", c.Phone != "":
		x := c.Email
		typ := "email"
		if c.Phone != "" {
			x = c.Phone
			typ = "phone"
		}
		actx := externals.MakeStaticAssertionContext(ctx)
		assertionURL, err := libkb.ParseAssertionURLKeyValue(actx, typ, x, true /* strict */)
		if err != nil {
			return err
		}
		member = keybase1.NewTeamMemberToRemoveWithAssertion(keybase1.AssertionTeamMemberToRemove{
			Assertion:         assertionURL.String(),
			RemoveFromSubtree: c.RemoveFromSubtree,
		})
	case c.InviteID != "":
		member = keybase1.NewTeamMemberToRemoveWithInviteid(keybase1.InviteTeamMemberToRemove{
			InviteID: c.InviteID,
		})
	default:
		return fmt.Errorf("could not handle removing this type of team member")
	}

	arg := keybase1.TeamRemoveMembersArg{
		TeamID:  teamID,
		Members: []keybase1.TeamMemberToRemove{member},
	}

	// Use the multi-rpc here in case we want to allow this command to remove multiple members at
	// once in the future.
	if result, err := cli.TeamRemoveMembers(ctx, arg); err != nil {
		for _, failure := range result.Failures {
			member := failure.TeamMember
			typ, err := member.Type()
			if err != nil {
				return err
			}
			var name string
			switch typ {
			case keybase1.TeamMemberToRemoveType_ASSERTION:
				name = member.Assertion().Assertion
			case keybase1.TeamMemberToRemoveType_INVITEID:
				name = fmt.Sprintf("invite id %s\n", member.Inviteid().InviteID)
			default:
				return fmt.Errorf("Could not handle member type %v\n", typ)
			}
			if failure.ErrorAtTarget != nil {
				ui.Printf("Could not remove %s from team: %s\n", name, *failure.ErrorAtTarget)
			}
			if failure.ErrorAtSubtree != nil {
				ui.Printf("Could not remove %s from subtree: %s\n", name, *failure.ErrorAtSubtree)
			}
		}

		return err
	}

	ui.Printf("Success!\n")
	return nil
}

func (c *CmdTeamRemoveMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
