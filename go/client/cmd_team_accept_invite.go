package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdTeamAcceptInvite struct {
	libkb.Contextified
	Token  string
	Seitan bool
}

func newCmdTeamAcceptInvite(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "accept-invite",
		ArgumentHelp: "--token=<invite token>",
		Usage:        "Accept a team email invitation.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamAcceptInviteRunner(g)
			cl.ChooseCommand(cmd, "accept-invite", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "token",
				Usage: "token",
			},
			cli.BoolFlag{
				Name:  "seitan",
				Usage: "Is it a seitan token?",
			},
		},
	}
}

func NewCmdTeamAcceptInviteRunner(g *libkb.GlobalContext) *CmdTeamAcceptInvite {
	return &CmdTeamAcceptInvite{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamAcceptInvite) ParseArgv(ctx *cli.Context) error {
	c.Token = ctx.String("token")
	if len(c.Token) == 0 {
		return errors.New("please specify an invite token with the --token flag")
	}

	c.Seitan = ctx.Bool("seitan")

	return nil
}

func (c *CmdTeamAcceptInvite) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.TeamAcceptInviteArg{
		Token:  c.Token,
		Seitan: c.Seitan,
	}

	if err := cli.TeamAcceptInvite(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Invitation accepted! You will receive a notification soon when your invitation has been processed.\n")
	return nil
}

func (c *CmdTeamAcceptInvite) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
