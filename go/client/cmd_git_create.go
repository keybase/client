package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdGitCreate struct {
	libkb.Contextified
	Name  string
	Token string
}

func newCmdGitCreate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "create",
		ArgumentHelp: "<repo name> --folder=<keybase folder>",
		Usage:        "Create a git repository.",
		Action: func(c *cli.Context) {
			cmd := NewCmdGitCreateRunner(g)
			cl.ChooseCommand(cmd, "create", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "name",
				Usage: "repo name",
			},
			cli.StringFlag{
				Name:  "folder",
				Usage: "keybase folder",
			},
		},
	}
}

func NewCmdGitCreateRunner(g *libkb.GlobalContext) *CmdGitCreate {
	return &CmdGitCreate{Contextified: libkb.NewContextified(g)}
}

func (c *CmdGitCreate) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdGitCreate) Run() error {
	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.CreateGitRepoArg{}

	if _, err := cli.CreateGitRepo(context.Background(), arg); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Repo created!\n")
	return nil
}

func (c *CmdGitCreate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
