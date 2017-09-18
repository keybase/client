package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
		Usage:        "Delete a team.",
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

	arg := keybase1.TeamDeleteArg{
		Name: c.Team.String(),
	}

	err = cli.TeamDelete(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetTerminalUI()
	dui.Printf("Success! Team %s deleted.\n", c.Team)

	return nil
}

func (c *CmdTeamDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
