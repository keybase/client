package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamIgnoreRequest struct {
	libkb.Contextified
	Team     string
	Username string
}

func newCmdTeamIgnoreRequest(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "ignore-request",
		ArgumentHelp: "<team name> --user=<username>",
		Usage:        "ignore request to join a team",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamIgnoreRequestRunner(g)
			cl.ChooseCommand(cmd, "ignore-request", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "u, user",
				Usage: "username",
			},
		},
	}
}

func NewCmdTeamIgnoreRequestRunner(g *libkb.GlobalContext) *CmdTeamIgnoreRequest {
	return &CmdTeamIgnoreRequest{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamIgnoreRequest) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Username, err = ParseUser(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamIgnoreRequest) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamIgnoreRequestArg{
		Name:     c.Team,
		Username: c.Username,
	}

	err = cli.TeamIgnoreRequest(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Success! %s's request will be ignored.\n", c.Username)

	return nil
}

func (c *CmdTeamIgnoreRequest) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
