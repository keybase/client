package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamSettings struct {
	libkb.Contextified

	Team keybase1.TeamName

	// These fields are non-zero valued when their action is requested
	Description         *string
	JoinAsRole          *keybase1.TeamRole
	ProfilePromote      *bool
	AllowProfilePromote *bool
	Showcase            *bool
}

func newCmdTeamSettings(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "settings",
		ArgumentHelp: "<team name>",
		Usage:        "Edit team settings.",
		Description:  teamSettingsDoc,
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamSettingsRunner(g)
			cl.ChooseCommand(cmd, "settings", c)
		},
		Flags: []cli.Flag{
			// Many of these are StringFlag instead of BoolFlag because BoolFlag is displeasing.
			// For example `keybase team settings teamname --bool-flag false` sets the flag to true.

			cli.BoolFlag{
				Name:  "p, print",
				Usage: "Print all your team settings",
			},
			cli.StringFlag{
				Name:  "description",
				Usage: "Set the team description",
			},
			cli.StringFlag{
				Name:  "open-team",
				Usage: "[reader|writer|off] Set whether anyone can join without being invited and the role they become",
			},
			cli.StringFlag{
				Name:  "profile-promote",
				Usage: "[yes|no] Set whether your own profile should promote this team and its description",
			},
			cli.StringFlag{
				Name:  "allow-profile-promote",
				Usage: "[yes|no] Set whether non-admins are allowed to promote this team and its description on their profiles",
			},
			cli.StringFlag{
				Name:  "showcase",
				Usage: "[yes|no] Set whether to promote this team and its description on keybase.io/popular-teams",
			},
		},
	}
}

func NewCmdTeamSettingsRunner(g *libkb.GlobalContext) *CmdTeamSettings {
	return &CmdTeamSettings{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamSettings) ParseArgv(ctx *cli.Context) (err error) {
	c.Team, err = ParseOneTeamNameK1(ctx)
	if err != nil {
		return err
	}

	var exclusiveActions []string

	if ctx.IsSet("description") {
		exclusiveActions = append(exclusiveActions, "description")
		desc := ctx.String("description")
		c.Description = &desc
	}

	if ctx.IsSet("open-team") {
		exclusiveActions = append(exclusiveActions, "open-team")

		role := keybase1.TeamRole_NONE
		val := ctx.String("open-team")
		switch val {
		case "reader":
			role = keybase1.TeamRole_READER
		case "writer":
			role = keybase1.TeamRole_WRITER
		default:
			open, err := cli.ParseBoolFriendly(val)
			if err != nil || open {
				return fmt.Errorf("open-team must be one of [reader|writer|off]")
			}
		}
		c.JoinAsRole = &role
	}

	if ctx.IsSet("profile-promote") {
		exclusiveActions = append(exclusiveActions, "profile-promote")
		val, err := ctx.BoolStrict("profile-promote")
		if err != nil {
			return err
		}
		c.ProfilePromote = &val
	}

	if ctx.IsSet("allow-profile-promote") {
		exclusiveActions = append(exclusiveActions, "allow-profile-promote")
		val, err := ctx.BoolStrict("allow-profile-promote")
		if err != nil {
			return err
		}
		c.AllowProfilePromote = &val
	}

	if ctx.IsSet("showcase") {
		exclusiveActions = append(exclusiveActions, "showcase")
		val, err := ctx.BoolStrict("showcase")
		if err != nil {
			return err
		}
		c.Showcase = &val
	}

	if len(exclusiveActions) > 1 {
		return fmt.Errorf("only one of these actions a time: %v", strings.Join(exclusiveActions, ", "))
	}

	return nil
}

func (c *CmdTeamSettings) Run() error {
	ctx, ctxCancel := context.WithCancel(context.TODO())
	defer ctxCancel()
	ctx = libkb.WithLogTag(ctx, "CTS")

	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	if c.Description != nil {
		err = c.setDescription(ctx, cli, *c.Description)
		if err != nil {
			return err
		}
	}

	if c.JoinAsRole != nil {
		err = c.setOpenness(ctx, cli, *c.JoinAsRole)
		if err != nil {
			return err
		}
	}

	if c.ProfilePromote != nil {
		err = c.setProfilePromote(ctx, cli, *c.ProfilePromote)
		if err != nil {
			return err
		}
	}

	if c.AllowProfilePromote != nil {
		err = c.setAllowProfilePromote(ctx, cli, *c.AllowProfilePromote)
		if err != nil {
			return err
		}
	}

	if c.Showcase != nil {
		err = c.setShowcase(ctx, cli, *c.Showcase)
		if err != nil {
			return err
		}
	}

	err = c.printCurrentSettings(ctx, cli)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamSettings) setDescription(ctx context.Context, cli keybase1.TeamsClient, desc string) error {
	return cli.SetTeamShowcase(ctx, keybase1.SetTeamShowcaseArg{
		Name:        c.Team.String(),
		IsShowcased: nil,
		Description: &desc,
	})
}

func (c *CmdTeamSettings) setOpenness(ctx context.Context, cli keybase1.TeamsClient, joinAsRole keybase1.TeamRole) error {
	dui := c.G().UI.GetTerminalUI()

	open := joinAsRole != keybase1.TeamRole_NONE

	arg := keybase1.TeamSetSettingsArg{
		Name: c.Team.String(),
		Settings: keybase1.TeamSettings{
			Open:   open,
			JoinAs: joinAsRole,
		},
	}

	err := cli.TeamSetSettings(ctx, arg)
	if err != nil {
		if e, ok := err.(libkb.NoOpError); ok {
			dui.Printf("%s\n", e.Desc)
			return nil
		}

		return err
	}

	if open {
		dui.Printf("Team set to open.\n")
	} else {
		dui.Printf("Team set to closed.\n")
	}
	return nil
}

func (c *CmdTeamSettings) setProfilePromote(ctx context.Context, cli keybase1.TeamsClient, promote bool) error {
	return cli.SetTeamMemberShowcase(ctx, keybase1.SetTeamMemberShowcaseArg{
		Name:        c.Team.String(),
		IsShowcased: promote,
	})
}

func (c *CmdTeamSettings) setAllowProfilePromote(ctx context.Context, cli keybase1.TeamsClient, allow bool) error {
	// awaiting CORE-6550
	return fmt.Errorf("The ability to allow non-admins to promote your team is coming soon!")
}

func (c *CmdTeamSettings) setShowcase(ctx context.Context, cli keybase1.TeamsClient, showcase bool) error {
	return cli.SetTeamShowcase(ctx, keybase1.SetTeamShowcaseArg{
		Name:        c.Team.String(),
		IsShowcased: &showcase,
		Description: nil,
	})
}

func (c *CmdTeamSettings) printCurrentSettings(ctx context.Context, cli keybase1.TeamsClient) error {
	details, err := cli.TeamGet(ctx, keybase1.TeamGetArg{Name: c.Team.String(), ForceRepoll: true})
	if err != nil {
		return err
	}

	var showcaseInfo *keybase1.TeamAndMemberShowcase
	tmp, err := cli.GetTeamAndMemberShowcase(ctx, c.Team.String())
	if err != nil {
		c.G().Log.CDebugf(ctx, "failed to get team showcase info: %v", err)
	} else {
		showcaseInfo = &tmp
	}

	dui := c.G().UI.GetTerminalUI()
	dui.Printf("Current settings for team %q:\n", c.Team.String())
	if showcaseInfo != nil && showcaseInfo.TeamShowcase.Description != nil {
		dui.Printf("  Description:     %v\n", *showcaseInfo.TeamShowcase.Description)
	}
	dui.Printf("  Open:            %v\n", c.tfToYn(details.Settings.Open,
		fmt.Sprintf("default membership = %v", strings.ToLower(details.Settings.JoinAs.String()))))
	if showcaseInfo != nil {
		dui.Printf("  Showcased:       %v\n", c.tfToYn(showcaseInfo.TeamShowcase.IsShowcased, "on keybase.io/popular-teams"))
		dui.Printf("  Promoted:        %v\n", c.tfToYn(showcaseInfo.IsMemberShowcased, "on your profile"))
		// CORE-6550: show whether non-admins are allowed to promote
	}

	return nil
}

func (c *CmdTeamSettings) tfToYn(x bool, parenthetical string) string {
	if x {
		if len(parenthetical) > 0 {
			return fmt.Sprintf("yes (%v)", parenthetical)
		}
		return "yes"
	}
	return "no"
}

func (c *CmdTeamSettings) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const teamSettingsDoc = `"keybase team settings" lets you edit settings for a team

EXAMPLES:
Review team settings:
    keybase team settings acme
Open a team so anyone can join as a reader:
    keybase team settings acme --open-team=reader
Showcase a team publicly:
    keybase team settings acme --showcase=yes
Promote a team on your profile:
    keybase team settings acme --profile-promote=yes
Set a description for the team to show if promoted:
    keybase team settings acme --description="Rocket-Powered Products"
Clear the team description:
    keybase team settings acme --description=""
`
