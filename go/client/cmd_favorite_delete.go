package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdFavoriteDelete struct{}

func NewCmdFavoriteDelete(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "delete",
		Usage:       "keybase favorite delete",
		Description: "Unfavorite a kbfs folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteDelete{}, "delete", c)
		},
	}
}

func (c *CmdFavoriteDelete) Run() error {
	return nil
}

func (c *CmdFavoriteDelete) RunClient() error {
	return nil
}

func (c *CmdFavoriteDelete) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdFavoriteDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
