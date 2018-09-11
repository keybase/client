package client

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdGitDelete struct {
	libkb.Contextified
	repoName keybase1.GitRepoName
	teamName keybase1.TeamName
	force    bool
}

func newCmdGitDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "delete",
		ArgumentHelp: "<repo name> [--team=<team name>]",
		Usage:        "Delete a personal or team git repository.",
		Description:  "`keybase git delete reponame` will delete a personal git repo.\n   `keybase git delete reponame --team=treehouse` will delete a\n   team git repo for the `treehouse` team. DELETION IS IMMEDIATE\n   AND IRREVERSIBLE.",
		Action: func(c *cli.Context) {
			cmd := NewCmdGitDeleteRunner(g)
			cl.ChooseCommand(cmd, "delete", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "team",
				Usage: "keybase team name (optional)",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "skip confirmation",
			},
		},
	}
}

func NewCmdGitDeleteRunner(g *libkb.GlobalContext) *CmdGitDelete {
	return &CmdGitDelete{Contextified: libkb.NewContextified(g)}
}

func (c *CmdGitDelete) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return errors.New("repo name argument required")
	}
	c.repoName = keybase1.GitRepoName(ctx.Args()[0])
	if len(ctx.String("team")) > 0 {
		teamName, err := keybase1.TeamNameFromString(ctx.String("team"))
		if err != nil {
			return err
		}
		c.teamName = teamName
	}
	c.force = ctx.Bool("force")

	return nil
}

func (c *CmdGitDelete) Run() error {
	if !c.force {
		ui := c.G().UI.GetTerminalUI()
		err := ui.PromptForConfirmation(fmt.Sprintf(
			"Deletion is permanent. Are you sure you want to delete \"%s\"?",
			c.repoName))
		if err != nil {
			return err
		}
	}

	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	if len(c.teamName.String()) > 0 {
		err = c.runTeam(cli)
	} else {
		err = c.runPersonal(cli)
	}

	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Repo deleted!\n")
	return nil
}

func (c *CmdGitDelete) runPersonal(cli keybase1.GitClient) error {
	return cli.DeletePersonalRepo(context.Background(), c.repoName)
}

func (c *CmdGitDelete) runTeam(cli keybase1.GitClient) error {
	arg := keybase1.DeleteTeamRepoArg{
		TeamName: c.teamName,
		RepoName: c.repoName,
	}
	return cli.DeleteTeamRepo(context.Background(), arg)
}

func (c *CmdGitDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
