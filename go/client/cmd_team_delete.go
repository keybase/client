package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamDelete struct {
	libkb.Contextified
	Team keybase1.TeamName
}

func newCmdTeamDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "delete",
		ArgumentHelp: "<team name>",
		Usage:        "delete a team",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamDeleteRunner(g)
			cl.ChooseCommand(cmd, "delete", c)
		},
	}
}

func NewCmdTeamDeleteRunner(g *libkb.GlobalContext) *CmdTeamDelete {
	return &CmdTeamDelete{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamDelete) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamNameK1(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamDelete) Run() error {
	dui := c.G().UI.GetTerminalUI()

	if c.Team.IsRootTeam() {
		dui.Printf("WARNING: This will:\n\n")
		dui.Printf("(1) destroy all data in %s's chats and KBFS folders\n", c.Team)
		dui.Printf("(2) do the same to any of %s's subteams\n", c.Team)
		dui.Printf("(3) prevent %q from being used again as a team name.\n\n", c.Team)
		confirm := fmt.Sprintf("nuke %s", c.Team)
		response, err := dui.Prompt(PromptDescriptorDeleteRootTeam,
			fmt.Sprintf("** if you are sure, please type: %q > ", confirm))
		if err != nil {
			return err
		}
		if strings.TrimSpace(response) != confirm {
			return errors.New("team delete not confirmed")
		}
	}
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamDeleteArg{
		Name: c.Team.String(),
	}

	err = cli.TeamDelete(context.Background(), arg)
	if err != nil {
		return err
	}

	dui.Printf("Success! Team %s deleted.", c.Team)

	return nil
}

func (c *CmdTeamDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
