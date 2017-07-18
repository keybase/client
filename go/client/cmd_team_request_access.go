package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamRequestAccess struct {
	libkb.Contextified
	Team string
}

func newCmdTeamRequestAccess(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "request-access",
		ArgumentHelp: "<team name>",
		Usage:        "request access to a team",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamRequestAccessRunner(g)
			cl.ChooseCommand(cmd, "request-access", c)
		},
	}
}

func NewCmdTeamRequestAccessRunner(g *libkb.GlobalContext) *CmdTeamRequestAccess {
	return &CmdTeamRequestAccess{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamRequestAccess) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamRequestAccess) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamRequestAccessArg{
		Name: c.Team,
	}

	err = cli.TeamRequestAccess(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("An email has been sent to the admins of %s.\n", c.Team)

	return nil
}

func (c *CmdTeamRequestAccess) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
