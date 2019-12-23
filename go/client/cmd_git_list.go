package client

import (
	"errors"
	"fmt"
	"sort"
	"strings"

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

func longestRepoName(repos []keybase1.GitRepoInfo) int {
	max := 0
	for _, repo := range repos {
		l := len(repo.FullName())
		if l > max {
			max = l
		}
	}
	return max
}

func padToLen(s string, paddedLen int) string {
	if len(s) >= paddedLen {
		return s
	}
	return s + strings.Repeat(" ", paddedLen-len(s))
}

func (c *CmdGitList) Run() error {
	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()

	repoResults, err := cli.GetAllGitMetadata(context.Background())
	if err != nil {
		return err
	}

	var repos []keybase1.GitRepoInfo
	for _, repoRes := range repoResults {
		repo, err := repoRes.GetIfOk()
		if err != nil {
			_, _ = dui.PrintfUnescaped(ColorString(c.G(), "red", fmt.Sprintf("Error in repo: %v\n", err)))
			continue
		}
		repos = append(repos, repo)
	}

	sort.Slice(repos, func(i, j int) bool { return repos[i].FullName() < repos[j].FullName() })

	// Get the length of the longest repo name, for some nice looking padding.
	longest := longestRepoName(repos)

	dui.Printf("personal repos:\n")
	for _, repo := range repos {
		if repo.Folder.FolderType == keybase1.FolderType_PRIVATE {
			dui.Printf("  %s  %s\n", padToLen(repo.FullName(), longest), repo.RepoUrl)
		}
	}
	dui.Printf("team repos:\n")
	for _, repo := range repos {
		if repo.Folder.FolderType == keybase1.FolderType_TEAM {
			dui.Printf("  %s  %s\n", padToLen(repo.FullName(), longest), repo.RepoUrl)
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
