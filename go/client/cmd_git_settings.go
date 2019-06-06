package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdGitSettings struct {
	libkb.Contextified
	repoName    keybase1.GitRepoName
	teamName    keybase1.TeamName
	disableChat bool
	channelName string
}

func newCmdGitSettings(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "settings",
		Usage:        "View and change team repo settings",
		ArgumentHelp: "<repo name> <team name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdGitSettingsRunner(g), "settings", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "channel",
				Usage: "chat channel where git push notifications will be sent",
			},
			cli.BoolFlag{
				Name:  "disable-chat",
				Usage: "disable chat notifications for git pushes",
			},
		},
	}
}

func newCmdGitSettingsRunner(g *libkb.GlobalContext) *CmdGitSettings {
	return &CmdGitSettings{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdGitSettings) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("repo name and team name are required")
	}
	c.repoName = keybase1.GitRepoName(ctx.Args()[0])

	teamName, err := keybase1.TeamNameFromString(ctx.Args()[1])
	if err != nil {
		return err
	}
	c.teamName = teamName

	c.disableChat = ctx.Bool("disable-chat")
	c.channelName = ctx.String("channel")

	if c.disableChat && c.channelName != "" {
		return fmt.Errorf("Please choose either --disable-chat or --channel=%q, not both.", c.channelName)
	}

	return nil
}

func (c *CmdGitSettings) Run() error {
	ctx := context.Background()
	repoID, err := c.findRepoID(ctx)
	if err != nil {
		return err
	}

	if c.disableChat || c.channelName != "" {
		return c.setSettings(ctx, repoID)
	}
	return c.getSettings(ctx, repoID)
}

func (c *CmdGitSettings) setSettings(ctx context.Context, repoID keybase1.RepoID) error {
	arg := keybase1.SetTeamRepoSettingsArg{
		Folder: c.folder(),
		RepoID: repoID,
	}
	if c.channelName != "" {
		arg.ChannelName = &c.channelName
	} else {
		arg.ChatDisabled = c.disableChat
	}

	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	err = cli.SetTeamRepoSettings(ctx, arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Team git repo settings changed.\n")
	return nil
}

func (c *CmdGitSettings) getSettings(ctx context.Context, repoID keybase1.RepoID) error {
	arg := keybase1.GetTeamRepoSettingsArg{
		Folder: c.folder(),
		RepoID: repoID,
	}
	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	settings, err := cli.GetTeamRepoSettings(ctx, arg)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	if settings.ChatDisabled {
		dui.Printf("Chat notifications: disabled\n")
	} else {
		dui.Printf("Chat notifications: enabled\n")
		if settings.ChannelName != nil {
			dui.Printf("Chat channel:       %s\n", *settings.ChannelName)
		}
	}

	return nil
}

func (c *CmdGitSettings) folder() keybase1.FolderHandle {
	return keybase1.FolderHandle{
		Name:       c.teamName.String(),
		FolderType: keybase1.FolderType_TEAM,
	}
}

func (c *CmdGitSettings) findRepoID(ctx context.Context) (keybase1.RepoID, error) {
	cli, err := GetGitClient(c.G())
	if err != nil {
		return "", err
	}
	repos, err := cli.GetGitMetadata(ctx, c.folder())
	if err != nil {
		return "", err
	}

	for _, repoResult := range repos {
		repo, err := repoResult.GetIfOk()
		if err != nil {
			continue
		}
		if repo.LocalMetadata.RepoName == c.repoName {
			return repo.RepoID, nil
		}
	}
	return "", fmt.Errorf("No repo found that matches %s", c.folder())
}

func (c *CmdGitSettings) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
