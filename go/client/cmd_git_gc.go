package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdGitGC struct {
	libkb.Contextified
	repoName keybase1.GitRepoName
	teamName keybase1.TeamName
	force    bool
}

func newCmdGitGC(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "gc",
		ArgumentHelp: "<repo name> [--team=<team name>]",
		Usage:        "Run garbage collection on a personal or team git repository.",
		Description:  "`keybase git gc reponame` will run garbage collection on  a personal git\n   repo. `keybase git gc reponame --team=treehouse` will run garbage\n   collection on a team git repo for the `treehouse` team.  Garbage collection\n   cleans up unnecessary files and optimizes the Keybase repo.",
		Action: func(c *cli.Context) {
			cmd := NewCmdGitGCRunner(g)
			cl.ChooseCommand(cmd, "gc", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "team",
				Usage: "keybase team name (optional)",
			},
			cli.BoolFlag{
				Name:  "force",
				Usage: "force garbage collection, even if not needed",
			},
		},
	}
}

func NewCmdGitGCRunner(g *libkb.GlobalContext) *CmdGitGC {
	return &CmdGitGC{Contextified: libkb.NewContextified(g)}
}

func (c *CmdGitGC) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return errors.New("repo name argument required")
	}
	c.repoName = keybase1.GitRepoName(ctx.Args()[0])
	c.force = ctx.Bool("force")
	if len(ctx.String("team")) > 0 {
		teamName, err := keybase1.TeamNameFromString(ctx.String("team"))
		if err != nil {
			return err
		}
		c.teamName = teamName
	}

	return nil
}

func (c *CmdGitGC) Run() error {
	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("This may take several minutes...\n")

	if len(c.teamName.String()) > 0 {
		err = c.runTeam(cli)
	} else {
		err = c.runPersonal(cli)
	}
	if err != nil {
		return err
	}

	dui.Printf("Success!\n")
	return nil
}

func (c *CmdGitGC) runPersonal(cli keybase1.GitClient) error {
	arg := keybase1.GcPersonalRepoArg{
		RepoName: c.repoName,
		Force:    c.force,
	}
	return cli.GcPersonalRepo(context.Background(), arg)
}

func (c *CmdGitGC) runTeam(cli keybase1.GitClient) error {
	arg := keybase1.GcTeamRepoArg{
		TeamName: c.teamName,
		RepoName: c.repoName,
		Force:    c.force,
	}
	return cli.GcTeamRepo(context.Background(), arg)
}

func (c *CmdGitGC) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
