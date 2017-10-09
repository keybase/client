package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamSettings struct {
	libkb.Contextified
	Team      keybase1.TeamName
	PrintOnly bool
	Settings  keybase1.TeamSettings
}

func newCmdTeamSettings(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "settings",
		ArgumentHelp: "<team name>",
		Usage:        "Edit team settings.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamSettingsRunner(g)
			cl.ChooseCommand(cmd, "settings", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "set-open",
				Usage: "set team to open",
			},
			cli.BoolFlag{
				Name:  "set-closed",
				Usage: "set team to closed",
			},
			cli.StringFlag{
				Name:  "join-as",
				Usage: "team role (writer, reader) [required when changing team to open]",
			},
		},
	}
}

func NewCmdTeamSettingsRunner(g *libkb.GlobalContext) *CmdTeamSettings {
	return &CmdTeamSettings{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamSettings) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamNameK1(ctx)
	if err != nil {
		return err
	}

	if ctx.NumFlags() == 0 {
		// Just a team name and no other flags - print current team settings.
		c.PrintOnly = true
		return nil
	}

	if ctx.Bool("set-open") && ctx.Bool("set-closed") {
		return errors.New("cannot use --set-open and --set-closed at the same time")

	}

	if ctx.Bool("set-open") {
		c.Settings.Open = true

		srole := ctx.String("join-as")
		if srole == "" {
			return errors.New("team role required via --join-as flag")
		}

		role, ok := keybase1.TeamRoleMap[strings.ToUpper(srole)]
		if !ok {
			return errors.New("invalid team role, please use writer, or reader")
		}

		switch role {
		case keybase1.TeamRole_READER, keybase1.TeamRole_WRITER:
			break
		default:
			return errors.New("invalid team role, please use writer, or reader")
		}

		c.Settings.JoinAs = role
	} else if ctx.Bool("set-closed") {
		c.Settings.Open = false
	} else {
		// Happens when user supplies --join-as only:
		// > keybase team edit teamname --join-as reader
		// For simplicity, we require always --set-open/--set-closed flag,
		// even if user just wants to change join_as role.
		return errors.New("--set-open or --set-closed flag is required")
	}

	return nil
}

func (c *CmdTeamSettings) applySettings(cli keybase1.TeamsClient) error {
	dui := c.G().UI.GetTerminalUI()

	arg := keybase1.TeamSetSettingsArg{
		Name:     c.Team.String(),
		Settings: c.Settings,
	}

	err := cli.TeamSetSettings(context.Background(), arg)
	if err != nil {
		if e, ok := err.(libkb.NoOpError); ok {
			dui.Printf("%s\n", e.Desc)
			return nil
		}

		return err
	}

	dui.Printf("Team settings were changed.\n")
	return nil
}

func (c *CmdTeamSettings) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	if !c.PrintOnly {
		if err := c.applySettings(cli); err != nil {
			return err
		}
	}

	details, err := cli.TeamGet(context.Background(), keybase1.TeamGetArg{Name: c.Team.String(), ForceRepoll: !c.PrintOnly})
	if err != nil {
		return err
	}

	dui := c.G().UI.GetTerminalUI()
	dui.Printf("Current settings of team %q:\n", c.Team.String())
	if details.Settings.Open {
		dui.Printf("  Open:\t\t\ttrue\n")
		dui.Printf("  New member role:\t%s\n", strings.ToLower(details.Settings.JoinAs.String()))
	} else {
		dui.Printf("  Open:\tfalse\n")
	}

	return nil
}

func (c *CmdTeamSettings) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
