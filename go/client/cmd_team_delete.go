package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamDelete struct {
	libkb.Contextified
	Team string
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
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamDelete) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamDeleteArg{
		Name: c.Team,
	}

	err = cli.TeamDelete(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
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
