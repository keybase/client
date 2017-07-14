package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
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

	_ = cli

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("done")

	return nil
}

func (c *CmdTeamRequestAccess) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
