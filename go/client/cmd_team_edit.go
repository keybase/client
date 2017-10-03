package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdTeamEdit struct {
	libkb.Contextified
	Team     keybase1.TeamName
	IsSet    bool
	Settings keybase1.TeamSettings
}

func newCmdTeamEdit(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "edit",
		ArgumentHelp: "<team name>",
		Usage:        "Edit team settings.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamEditRunner(g)
			cl.ChooseCommand(cmd, "edit", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "open",
				Usage: "Change team to be open or closed",
			},
			cli.StringFlag{
				Name:  "join-as",
				Usage: "team role (writer, reader) [required when changing team to open]",
			},
		},
	}
}

func NewCmdTeamEditRunner(g *libkb.GlobalContext) *CmdTeamEdit {
	return &CmdTeamEdit{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamEdit) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamNameK1(ctx)
	if err != nil {
		return err
	}

	if ctx.NumFlags() == 0 {
		// Just a team name and no other flags - print current team settings.
		return nil
	}

	sopen := ctx.String("open")
	switch sopen {
	case "true":
		c.Settings.Open = true
	case "false":
		c.Settings.Open = false
	default:
		return errors.New("invalid --open flag, please use true or false")
	}

	if c.Settings.Open {
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
	}

	c.IsSet = true
	return nil
}

func (c *CmdTeamEdit) Run() error {
	protocols := []rpc.Protocol{
		NewTeamsUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetTerminalUI()

	if c.IsSet {
		details, err := cli.TeamGet(context.Background(), keybase1.TeamGetArg{Name: c.Team.String(), ForceRepoll: false})
		if err != nil {
			return err
		}

		if !details.Settings.Equal(c.Settings) {
			arg := keybase1.TeamSetSettingsArg{
				Name:     c.Team.String(),
				Settings: c.Settings,
			}

			err = cli.TeamSetSettings(context.Background(), arg)
			if err != nil {
				return err
			}

			dui.Printf("Team settings change was successful!\n")
		} else {
			dui.Printf("No changes were needed.\n")
		}
	}

	details, err := cli.TeamGet(context.Background(), keybase1.TeamGetArg{Name: c.Team.String(), ForceRepoll: c.IsSet})
	if err != nil {
		return err
	}

	dui.Printf("Current settings of team %q:\n", c.Team.String())
	if details.Settings.Open {
		dui.Printf("  Open:\t\t\ttrue\n")
		dui.Printf("  New member role:\t%s\n", details.Settings.JoinAs)
	} else {
		dui.Printf("  Open:\tfalse\n")
	}

	return nil
}

func (c *CmdTeamEdit) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
