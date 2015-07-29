package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdFavoriteAdd struct{}

func NewCmdFavoriteAdd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "add",
		Usage:       "keybase favorite add",
		Description: "Add a new kbfs favorite folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteAdd{}, "add", c)
		},
	}
}

func (c *CmdFavoriteAdd) Run() error {
	return nil
}

func (c *CmdFavoriteAdd) RunClient() error {
	return nil
}

func (c *CmdFavoriteAdd) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdFavoriteAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
