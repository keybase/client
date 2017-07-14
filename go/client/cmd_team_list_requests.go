package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdTeamListRequests struct {
	libkb.Contextified
}

func newCmdTeamListRequests(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list-requests",
		Usage: "list requests to join teams",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamListRequestsRunner(g)
			cl.ChooseCommand(cmd, "list-requests", c)
		},
	}
}

func NewCmdTeamListRequestsRunner(g *libkb.GlobalContext) *CmdTeamListRequests {
	return &CmdTeamListRequests{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamListRequests) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdTeamListRequests) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	_ = cli

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("done")

	return nil
}

func (c *CmdTeamListRequests) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
