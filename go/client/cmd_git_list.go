package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdGitList struct {
	libkb.Contextified
}

func newCmdGitList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List the personal and team git repositories you have access to.",
		Action: func(c *cli.Context) {
			cmd := NewCmdGitListRunner(g)
			cl.ChooseCommand(cmd, "list", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "team",
				Usage: "keybase team name (optional)",
			},
		},
	}
}

func NewCmdGitListRunner(g *libkb.GlobalContext) *CmdGitList {
	return &CmdGitList{Contextified: libkb.NewContextified(g)}
}

func (c *CmdGitList) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("list command takes no arguments")
	}
	return nil
}

func (c *CmdGitList) Run() error {
	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()

	repos, err := cli.GetAllGitMetadata(context.Background())
	if err != nil {
		return err
	}

	dui.Printf("personal repos:\n")
	for _, repo := range repos {
		if repo.Folder.FolderType == keybase1.FolderType_PRIVATE {
			dui.Printf("  %s  %s\n", repo.LocalMetadata.RepoName, repo.RepoUrl)
		}
	}
	dui.Printf("team repos:\n")
	for _, repo := range repos {
		if repo.Folder.FolderType == keybase1.FolderType_TEAM {
			dui.Printf("  %s/%s  %s\n", repo.Folder.Name, repo.LocalMetadata.RepoName, repo.RepoUrl)
		}
	}

	return nil
}

func (c *CmdGitList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
